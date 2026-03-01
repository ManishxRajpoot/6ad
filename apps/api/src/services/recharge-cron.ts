/**
 * Recharge Cron Service
 *
 * Polls every 30s for APPROVED deposits with PENDING recharge status.
 * Tries Cheetah API only. Graph API fallback handled by extension worker (browser-side).
 */

import { cheetahApi } from './cheetah-api.js'
import { prisma } from '../lib/prisma.js'

const CONFIG = {
  POLL_INTERVAL_MS: 30 * 1000,   // 30 seconds
  BATCH_SIZE: 5,                  // Max deposits per cycle
  MAX_ATTEMPTS: 10,               // Give up after 10 tries
}

let pollInterval: NodeJS.Timeout | null = null
let isProcessing = false

async function processRechargeCycle(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  try {
    // Find PENDING deposits
    const deposits = await prisma.accountDeposit.findMany({
      where: {
        status: 'APPROVED',
        rechargeStatus: { in: ['PENDING', 'NONE'] },
        rechargeAttempts: { lt: CONFIG.MAX_ATTEMPTS },
      },
      include: {
        adAccount: {
          select: {
            accountId: true,
            extensionProfileId: true,
            accountName: true,
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

  // Mark as IN_PROGRESS
  await prisma.accountDeposit.update({
    where: { id: deposit.id },
    data: { rechargeStatus: 'IN_PROGRESS' },
  })

  // ─── Step 1: Try Cheetah API ───
  let cheetahHandled = false
  try {
    const accountResult = await cheetahApi.getAccount(accountId)

    if (accountResult.code === 0 && accountResult.data?.length > 0) {
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
            await prisma.accountDeposit.update({
              where: { id: deposit.id },
              data: {
                rechargeStatus: 'COMPLETED',
                rechargeMethod: 'CHEETAH',
                rechargeAttempts: { increment: 1 },
                rechargedAt: new Date(),
                rechargeError: null,
              },
            })
            console.log(`[RechargeCron] Cheetah recharge SUCCESS: act_${accountId} +$${amount} (${deposit.applyId || deposit.id})`)
            cheetahHandled = true
            return
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

  // ─── Step 2: Leave as PENDING for extension worker (browser-side Graph API) ───
  if (!cheetahHandled) {
    await prisma.accountDeposit.update({
      where: { id: deposit.id },
      data: {
        rechargeStatus: 'PENDING',
        rechargeAttempts: { increment: 1 },
        rechargeError: 'Not a Cheetah account — waiting for extension worker',
      },
    })
    console.log(`[RechargeCron] act_${accountId} not Cheetah — left PENDING for extension (${deposit.applyId || deposit.id})`)
  }
}

// ─── Public API ───
export function startRechargeCron(): void {
  console.log(`[RechargeCron] Starting — poll every ${CONFIG.POLL_INTERVAL_MS / 1000}s, batch ${CONFIG.BATCH_SIZE}, max attempts ${CONFIG.MAX_ATTEMPTS}`)

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
