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
  CHEETAH_MAX_ATTEMPTS: 2,        // Cheetah accounts: only try 2 times, then wait for admin retry
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

  // Cheetah accounts: skip if already tried 2 times (admin must manually retry)
  if (isCheetahAccount && deposit.rechargeAttempts >= CONFIG.CHEETAH_MAX_ATTEMPTS) {
    return // Don't process — waiting for admin manual retry
  }

  // Non-Cheetah accounts: skip entirely — extension worker handles these via /poll
  if (!isCheetahAccount) {
    return
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
      const newSpendCap = currentSpendCap + amount

      // Check quota
      const quotaResult = await cheetahApi.getQuota()
      if (quotaResult.code === 0) {
        const availableQuota = parseFloat(quotaResult.data.available_quota) || 0
        if (availableQuota >= amount) {
          const rechargeResult = await cheetahApi.rechargeAccount(accountId, newSpendCap)
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
            console.log(`[RechargeCron] Cheetah recharge SUCCESS: act_${accountId} +$${amount} (${deposit.applyId || deposit.id})`)
            cheetahHandled = true
            return
          } else {
            console.log(`[RechargeCron] Cheetah recharge API error: code=${rechargeResult.code}, msg=${rechargeResult.msg}`)
          }
        } else {
          console.log(`[RechargeCron] Cheetah insufficient quota: need $${amount}, have $${availableQuota}`)
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
      // This IS a Cheetah account — do NOT send to extension worker
      const newAttempts = (deposit.rechargeAttempts || 0) + 1
      const reachedLimit = newAttempts >= CONFIG.CHEETAH_MAX_ATTEMPTS

      await prisma.accountDeposit.update({
        where: { id: deposit.id },
        data: {
          rechargeStatus: 'PENDING',
          rechargeMethod: 'CHEETAH',
          rechargeAttempts: { increment: 1 },
          rechargeError: reachedLimit
            ? 'Cheetah recharge failed after 2 attempts — admin must click Retry when quota is available'
            : 'Cheetah account — insufficient quota, retrying...',
        },
      })

      if (reachedLimit) {
        console.log(`[RechargeCron] act_${accountId} Cheetah STOPPED after ${newAttempts} attempts — waiting for admin retry (${deposit.applyId || deposit.id})`)
      } else {
        console.log(`[RechargeCron] act_${accountId} Cheetah attempt ${newAttempts}/${CONFIG.CHEETAH_MAX_ATTEMPTS} — will retry (${deposit.applyId || deposit.id})`)
      }
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
