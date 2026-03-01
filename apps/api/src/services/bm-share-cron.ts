/**
 * BM Share Cron Service
 *
 * Polls every 30s for PENDING BM share requests.
 * Tries Cheetah API only. Graph API fallback handled by extension worker (browser-side).
 */

import { cheetahApi } from './cheetah-api.js'
import { prisma } from '../lib/prisma.js'

const CONFIG = {
  POLL_INTERVAL_MS: 30 * 1000,   // 30 seconds
  BATCH_SIZE: 5,                  // Max shares per cycle
  MAX_ATTEMPTS: 10,               // Give up after 10 tries
}

let pollInterval: NodeJS.Timeout | null = null
let isProcessing = false

async function processBmShareCycle(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  try {
    // Find PENDING BM share requests
    const requests = await prisma.bmShareRequest.findMany({
      where: {
        status: 'PENDING',
        platform: 'FACEBOOK',
        shareAttempts: { lt: CONFIG.MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'asc' },
      take: CONFIG.BATCH_SIZE,
    })

    if (requests.length === 0) { isProcessing = false; return }

    // Load Cheetah config once per cycle
    await cheetahApi.loadConfig()

    for (const request of requests) {
      try {
        await processBmShare(request)
      } catch (err: any) {
        console.error(`[BmShareCron] Error processing ${request.id}: ${err.message}`)
        await prisma.bmShareRequest.update({
          where: { id: request.id },
          data: {
            shareAttempts: { increment: 1 },
            shareError: err.message,
          },
        })
      }
    }
  } catch (err: any) {
    console.error('[BmShareCron] Cycle error:', err.message)
  } finally {
    isProcessing = false
  }
}

async function processBmShare(request: any): Promise<void> {
  const { adAccountId, bmId } = request

  // ─── Step 1: Try Cheetah API ───
  let cheetahHandled = false
  try {
    const result = await cheetahApi.bindAccountToBM(adAccountId, bmId, 2) // type=2 manage

    if (result.code === 0) {
      await prisma.bmShareRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          shareMethod: 'CHEETAH',
          shareAttempts: { increment: 1 },
          approvedAt: new Date(),
          adminRemarks: 'BM share completed successfully via Cheetah API.',
          shareError: null,
        },
      })
      console.log(`[BmShareCron] Cheetah BM share SUCCESS: act_${adAccountId} → BM ${bmId} (${request.applyId || request.id})`)
      cheetahHandled = true
      return
    }

    if (result.code === 999) {
      // BM has agency account — definitive rejection
      await prisma.bmShareRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          shareMethod: 'CHEETAH',
          shareAttempts: { increment: 1 },
          rejectedAt: new Date(),
          adminRemarks: 'This Business Manager already has an agency ad account. Please provide a fresh BM ID.',
          shareError: `Cheetah code ${result.code}: ${result.msg}`,
        },
      })
      console.log(`[BmShareCron] Cheetah REJECTED (code 999): act_${adAccountId} → BM ${bmId}`)
      cheetahHandled = true
      return
    }

    // Check if msg contains success indicator
    if (result.msg && result.msg.includes('成功')) {
      await prisma.bmShareRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          shareMethod: 'CHEETAH',
          shareAttempts: { increment: 1 },
          approvedAt: new Date(),
          adminRemarks: 'BM share completed successfully via Cheetah API.',
          shareError: null,
        },
      })
      cheetahHandled = true
      return
    }

    // code 110 or other = not a Cheetah account
    console.log(`[BmShareCron] Cheetah failed (code ${result.code}): ${result.msg}`)
  } catch (err: any) {
    console.log(`[BmShareCron] Cheetah error for act_${adAccountId}: ${err.message}`)
  }

  // ─── Step 2: Leave as PENDING for extension worker (browser-side Graph API) ───
  if (!cheetahHandled) {
    await prisma.bmShareRequest.update({
      where: { id: request.id },
      data: {
        shareAttempts: { increment: 1 },
        shareError: 'Not a Cheetah account — waiting for extension worker',
      },
    })
    console.log(`[BmShareCron] act_${adAccountId} not Cheetah — left PENDING for extension (${request.applyId || request.id})`)
  }
}

// ─── Public API ───
export function startBmShareCron(): void {
  console.log(`[BmShareCron] Starting — poll every ${CONFIG.POLL_INTERVAL_MS / 1000}s, batch ${CONFIG.BATCH_SIZE}, max attempts ${CONFIG.MAX_ATTEMPTS}`)

  // First run after short delay
  setTimeout(() => {
    processBmShareCycle().catch(err => console.error('[BmShareCron] Initial cycle error:', err))
  }, 8000) // Stagger slightly from recharge cron

  pollInterval = setInterval(() => {
    processBmShareCycle().catch(err => console.error('[BmShareCron] Cycle error:', err))
  }, CONFIG.POLL_INTERVAL_MS)
}

export function stopBmShareCron(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  console.log('[BmShareCron] Stopped')
}
