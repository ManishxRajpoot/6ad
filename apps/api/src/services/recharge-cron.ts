/**
 * Recharge Cron Service
 *
 * Polls every 30s for APPROVED deposits with PENDING recharge status.
 * Cheetah accounts: auto-retry 2 times, then stop (admin manually retries).
 * Non-Cheetah: left PENDING for extension worker (browser-side Graph API).
 */

import { cheetahApi } from './cheetah-api.js'
import { startBrowser } from './adspower-worker.js'
import { prisma } from '../lib/prisma.js'

const CONFIG = {
  POLL_INTERVAL_MS: 30 * 1000,   // 30 seconds
  BATCH_SIZE: 5,                  // Max deposits per cycle
  MAX_ATTEMPTS: 10,               // Give up after 10 tries (non-cheetah / extension)
  CHEETAH_MAX_ATTEMPTS: 10,       // Credit Line: retry up to 10 times (API may have temp issues)
  CHEETAH_RETRY_DELAY_MS: 5000,   // Wait 5s between Cheetah retries
}

let pollInterval: NodeJS.Timeout | null = null
let isProcessing = false

async function processRechargeCycle(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  try {
    // Find deposits admin-approved (approvedAt set) needing recharge
    const deposits = await prisma.accountDeposit.findMany({
      where: {
        approvedAt: { not: null },
        rechargeStatus: { in: ['PENDING', 'NONE'] },
        rechargeAttempts: { lt: CONFIG.MAX_ATTEMPTS },
      },
      include: {
        adAccount: {
          select: {
            accountId: true,
            extensionProfileId: true,
            accountName: true,
            sourceBmId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: CONFIG.BATCH_SIZE,
    })

    if (deposits.length === 0) { isProcessing = false; return }

    // Load Cheetah config once per cycle
    await cheetahApi.loadConfig()

    for (const deposit of deposits) {
      try {
        await processDeposit(deposit)
      } catch (err: any) {
        console.error(`[RechargeCron] Error processing ${deposit.id}: ${err.message}`)
        await prisma.accountDeposit.update({
          where: { id: deposit.id },
          data: {
            rechargeAttempts: { increment: 1 },
            rechargeError: err.message,
          },
        })
      }
    }
  } catch (err: any) {
    console.error('[RechargeCron] Cycle error:', err.message)
  } finally {
    isProcessing = false
  }
}

async function processDeposit(deposit: any): Promise<void> {
  const accountId = deposit.adAccount.accountId
  const amount = Number(deposit.amount) || 0

  if (amount <= 0) return

  // ─── Check if this is a Cheetah account (sourceBmId) ───
  const isCheetahAccount = deposit.adAccount.sourceBmId === 'cheetah'

  // Cheetah accounts: give up after max attempts — mark FAILED so it stops retrying
  if (isCheetahAccount && deposit.rechargeAttempts >= CONFIG.CHEETAH_MAX_ATTEMPTS) {
    await prisma.accountDeposit.update({
      where: { id: deposit.id },
      data: {
        rechargeStatus: 'FAILED',
        rechargeError: `Credit Line recharge failed after ${CONFIG.CHEETAH_MAX_ATTEMPTS} attempts — admin must manually retry`,
      },
    })
    console.log(`[RechargeCron] act_${accountId} Credit Line GAVE UP after ${CONFIG.CHEETAH_MAX_ATTEMPTS} attempts (${deposit.applyId || deposit.id})`)
    return
  }

  // Non-Cheetah accounts: skip entirely — extension worker handles these via /poll
  if (!isCheetahAccount) {
    return
  }

  // Skip if rate-limited recently (don't hammer API every 30s)
  if (deposit.rechargeError?.includes('rate limit') && deposit.updatedAt) {
    const msSinceUpdate = Date.now() - new Date(deposit.updatedAt).getTime()
    if (msSinceUpdate < 10 * 60 * 1000) { // Wait 10 min before retrying rate-limited accounts
      return
    }
  }

  // Mark as IN_PROGRESS (Cheetah accounts only)
  await prisma.accountDeposit.update({
    where: { id: deposit.id },
    data: { rechargeStatus: 'IN_PROGRESS' },
  })

  // ─── Step 1: Try Cheetah API ───
  let cheetahHandled = false
  let cheetahAccountFound = false
  try {
    const accountResult = await cheetahApi.getAccount(accountId)

    if (accountResult.code === 0 && accountResult.data?.length > 0) {
      cheetahAccountFound = true
      const cheetahAccount = accountResult.data[0]
      const currentSpendCap = parseFloat(cheetahAccount.spend_cap) || 0

      // ─── SNAPSHOT-FIRST: compute target ONCE, reuse on retries ───
      let targetSpendCap = deposit.targetSpendCap
      if (!targetSpendCap) {
        // First attempt — snapshot current cap and compute target
        targetSpendCap = currentSpendCap + amount
        await prisma.accountDeposit.update({
          where: { id: deposit.id },
          data: { previousSpendCap: currentSpendCap, targetSpendCap },
        })
        console.log(`[RechargeCron] Snapshot cap for act_${accountId}: current=$${currentSpendCap}, target=$${targetSpendCap} (${deposit.applyId || deposit.id})`)
      }

      // ─── GUARD: if current cap already >= target, recharge was already done ───
      if (currentSpendCap >= targetSpendCap - 0.01) {
        await prisma.$transaction(async (tx) => {
          await tx.accountDeposit.update({
            where: { id: deposit.id },
            data: {
              status: 'APPROVED',
              rechargeStatus: 'COMPLETED',
              rechargeMethod: 'CHEETAH',
              rechargeAttempts: { increment: 1 },
              rechargedAt: new Date(),
              rechargeError: null,
            },
          })
          if (deposit.status !== 'APPROVED') {
            await tx.adAccount.update({
              where: { id: deposit.adAccountId },
              data: { totalDeposit: { increment: deposit.amount }, balance: { increment: deposit.amount } }
            })
          }
        })
        console.log(`[RechargeCron] SKIP — already at target: act_${accountId} cap=$${currentSpendCap} >= target=$${targetSpendCap} (${deposit.applyId || deposit.id})`)

        // Audit log
        await prisma.rechargeAuditLog.create({
          data: { depositId: deposit.id, adAccountId: accountId, action: 'SKIP_ALREADY_DONE', actor: 'recharge-cron', previousCap: currentSpendCap, targetCap: targetSpendCap, amount }
        }).catch(() => {})

        cheetahHandled = true
        return
      }

      // Check quota
      const quotaResult = await cheetahApi.getQuota()
      if (quotaResult.code === 0) {
        const availableQuota = parseFloat(quotaResult.data.available_quota) || 0
        if (availableQuota >= amount) {
          // Use stored targetSpendCap (absolute value, not currentCap + amount)
          const rechargeResult = await cheetahApi.rechargeAccount(accountId, targetSpendCap)

          // Audit log
          await prisma.rechargeAuditLog.create({
            data: { depositId: deposit.id, adAccountId: accountId, action: 'FB_POST', actor: 'recharge-cron', previousCap: currentSpendCap, targetCap: targetSpendCap, amount }
          }).catch(() => {})

          if (rechargeResult.code === 0) {
            await prisma.$transaction(async (tx) => {
              await tx.accountDeposit.update({
                where: { id: deposit.id },
                data: {
                  status: 'APPROVED',
                  rechargeStatus: 'COMPLETED',
                  rechargeMethod: 'CHEETAH',
                  rechargeAttempts: { increment: 1 },
                  rechargedAt: new Date(),
                  rechargeError: null,
                  newSpendCap: targetSpendCap,
                },
              })
              // Only increment balance if not already APPROVED
              if (deposit.status !== 'APPROVED') {
                await tx.adAccount.update({
                  where: { id: deposit.adAccountId },
                  data: {
                    totalDeposit: { increment: deposit.amount },
                    balance: { increment: deposit.amount }
                  }
                })
              }
            })
            console.log(`[RechargeCron] Cheetah recharge SUCCESS: act_${accountId} +$${amount} target=$${targetSpendCap} (${deposit.applyId || deposit.id})`)
            cheetahHandled = true
            return
          } else {
            // Code 115 = rate limit (7 ops per account per 24h) — don't waste retries, just wait
            if (rechargeResult.code === 115) {
              await prisma.accountDeposit.update({
                where: { id: deposit.id },
                data: {
                  rechargeStatus: 'PENDING',
                  rechargeMethod: 'CHEETAH',
                  // DON'T increment attempts — rate limit is temporary, will auto-clear in hours
                  rechargeError: `Cheetah rate limit hit (7 ops/24h) — will auto-retry when limit resets`,
                },
              })
              console.log(`[RechargeCron] act_${accountId} Cheetah RATE LIMITED (code=115) — will auto-retry later (${deposit.applyId || deposit.id})`)
              cheetahHandled = true
              return
            }

            console.log(`[RechargeCron] Cheetah recharge API error: code=${rechargeResult.code}, msg=${rechargeResult.msg} — retrying in ${CONFIG.CHEETAH_RETRY_DELAY_MS / 1000}s...`)
            // Wait and retry once more in same cycle
            await new Promise(r => setTimeout(r, CONFIG.CHEETAH_RETRY_DELAY_MS))
            const retryResult = await cheetahApi.rechargeAccount(accountId, targetSpendCap)
            if (retryResult.code === 0) {
              await prisma.$transaction(async (tx) => {
                await tx.accountDeposit.update({
                  where: { id: deposit.id },
                  data: {
                    status: 'APPROVED',
                    rechargeStatus: 'COMPLETED',
                    rechargeMethod: 'CHEETAH',
                    rechargeAttempts: { increment: 1 },
                    rechargedAt: new Date(),
                    rechargeError: null,
                    newSpendCap: targetSpendCap,
                  },
                })
                if (deposit.status !== 'APPROVED') {
                  await tx.adAccount.update({
                    where: { id: deposit.adAccountId },
                    data: { totalDeposit: { increment: deposit.amount }, balance: { increment: deposit.amount } }
                  })
                }
              })
              console.log(`[RechargeCron] Cheetah recharge SUCCESS (retry): act_${accountId} +$${amount} target=$${targetSpendCap} (${deposit.applyId || deposit.id})`)
              cheetahHandled = true
              return
            } else {
              console.log(`[RechargeCron] Cheetah retry also failed: code=${retryResult.code}, msg=${retryResult.msg}`)
            }
          }
        } else {
          // Insufficient quota — leave PENDING, increment attempt, will auto-retry on next cycle
          await prisma.accountDeposit.update({
            where: { id: deposit.id },
            data: {
              rechargeStatus: 'PENDING',
              rechargeMethod: 'CHEETAH',
              rechargeAttempts: { increment: 1 },
              rechargeError: `Insufficient Credit Line quota: need $${amount}, available $${availableQuota}`,
            },
          })
          console.log(`[RechargeCron] act_${accountId} Credit Line insufficient quota: need $${amount}, have $${availableQuota} — will retry (attempt ${deposit.rechargeAttempts + 1}/${CONFIG.CHEETAH_MAX_ATTEMPTS}) (${deposit.applyId || deposit.id})`)
          return
        }
      }
    }
    // code 110 or account not found → not a Cheetah account
  } catch (err: any) {
    console.log(`[RechargeCron] Cheetah error for act_${accountId}: ${err.message}`)
  }

  // ─── Step 2: Handle based on whether it's a Cheetah account ───
  if (!cheetahHandled) {
    if (isCheetahAccount || cheetahAccountFound) {
      // Credit Line account — API call failed, increment attempt and retry on next cycle
      await prisma.accountDeposit.update({
        where: { id: deposit.id },
        data: {
          rechargeStatus: 'PENDING',
          rechargeMethod: 'CHEETAH',
          rechargeAttempts: { increment: 1 },
          rechargeError: 'Credit Line recharge failed — will auto-retry',
        },
      })
      console.log(`[RechargeCron] act_${accountId} Credit Line failed — will retry (attempt ${deposit.rechargeAttempts + 1}/${CONFIG.CHEETAH_MAX_ATTEMPTS}) (${deposit.applyId || deposit.id})`)
    } else {
      // Not a Cheetah account — auto-launch assigned AdsPower browser so extension can process
      const extensionProfileId = deposit.adAccount.extensionProfileId
      if (extensionProfileId) {
        const profile = await prisma.facebookAutomationProfile.findUnique({
          where: { id: extensionProfileId },
          select: { adsPowerSerialNumber: true, label: true, isOnline: true },
        })
        if (profile?.adsPowerSerialNumber && !profile.isOnline) {
          try {
            await startBrowser(profile.adsPowerSerialNumber)
            console.log(`[RechargeCron] Auto-launched AdsPower "${profile.label}" (serial=${profile.adsPowerSerialNumber}) for act_${accountId}`)
          } catch (e: any) {
            console.log(`[RechargeCron] Failed to launch AdsPower: ${e.message}`)
          }
        }
      }

      await prisma.accountDeposit.update({
        where: { id: deposit.id },
        data: {
          rechargeStatus: 'PENDING',
          rechargeError: extensionProfileId
            ? 'Not a Cheetah account — browser launched, waiting for extension'
            : 'Not a Cheetah account — no browser profile assigned',
        },
      })
      console.log(`[RechargeCron] act_${accountId} not Cheetah — left PENDING for extension (${deposit.applyId || deposit.id})`)
    }
  }
}

// ─── Public API ───
export function startRechargeCron(): void {
  console.log(`[RechargeCron] Starting — poll every ${CONFIG.POLL_INTERVAL_MS / 1000}s, batch ${CONFIG.BATCH_SIZE}, cheetah max ${CONFIG.CHEETAH_MAX_ATTEMPTS}, extension max ${CONFIG.MAX_ATTEMPTS}`)

  // First run after short delay
  setTimeout(() => {
    processRechargeCycle().catch(err => console.error('[RechargeCron] Initial cycle error:', err))
  }, 5000)

  pollInterval = setInterval(() => {
    processRechargeCycle().catch(err => console.error('[RechargeCron] Cycle error:', err))
  }, CONFIG.POLL_INTERVAL_MS)
}

export function stopRechargeCron(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  console.log('[RechargeCron] Stopped')
}
