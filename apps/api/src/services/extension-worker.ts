/**
 * Extension Worker - Server-side background processor
 *
 * Replaces the need for a Chrome browser to be open 24/7.
 * Uses FB access tokens stored in ExtensionSession (captured by extension, exchanged for 60-day tokens)
 * to process pending recharges and BM shares via Facebook Graph API.
 *
 * Flow:
 * 1. User opens Facebook once → extension captures EAA token → sent to API via heartbeat
 * 2. API exchanges for 60-day long-lived token → stored in ExtensionSession.fbAccessToken
 * 3. This worker runs every 10s on the server, picks up pending tasks, uses stored token
 * 4. No Chrome browser needed after initial token capture!
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FB_GRAPH_VERSION = 'v18.0'
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`
const POLL_INTERVAL_MS = 10_000 // 10 seconds

let isRunning = false
let intervalId: ReturnType<typeof setInterval> | null = null
let isProcessingRecharges = false
let isProcessingBmShares = false

// Stats for admin dashboard
let workerStats = {
  startedAt: null as Date | null,
  lastPollAt: null as Date | null,
  totalRechargesProcessed: 0,
  totalBmSharesProcessed: 0,
  totalErrors: 0,
  lastError: null as string | null,
}

// ==================== FB Graph API Helper ====================

async function fbGraphRequest(
  endpoint: string,
  method: 'GET' | 'POST',
  params: Record<string, string>,
  accessToken: string
): Promise<any> {
  const url = new URL(`${FB_GRAPH_BASE}${endpoint}`)

  if (method === 'GET') {
    params.access_token = accessToken
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const response = await fetch(url.toString())
    const data = await response.json() as any
    if (data.error) throw new Error(data.error.message || 'FB API error')
    return data
  } else {
    params.access_token = accessToken
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    })
    const data = await response.json() as any
    if (data.error) throw new Error(data.error.message || 'FB API error')
    return data
  }
}

// ==================== Get Active FB Token ====================

async function getActiveFBToken(): Promise<{ token: string; sessionId: string } | null> {
  // Find an active extension session with a valid FB token
  const sessions = await prisma.extensionSession.findMany({
    where: {
      isActive: true,
      fbAccessToken: { not: null },
    },
    orderBy: { lastSeenAt: 'desc' },
  })

  for (const session of sessions) {
    if (!session.fbAccessToken) continue

    // Validate token is still working
    try {
      const url = `${FB_GRAPH_BASE}/me?fields=id,name&access_token=${encodeURIComponent(session.fbAccessToken)}`
      const response = await fetch(url)
      const data = await response.json() as any

      if (data.id) {
        return { token: session.fbAccessToken, sessionId: session.id }
      }

      // Token expired/invalid — clear it
      console.log(`[Worker] Token expired for session ${session.name}, clearing`)
      await prisma.extensionSession.update({
        where: { id: session.id },
        data: { fbAccessToken: null, lastError: 'FB token expired' }
      })
    } catch {
      // Network error, skip this session
    }
  }

  return null
}

// ==================== Recharge Processing ====================

async function processRecharges() {
  if (isProcessingRecharges) return
  isProcessingRecharges = true

  try {
    const deposits = await prisma.accountDeposit.findMany({
      where: {
        status: 'APPROVED',
        rechargeStatus: 'PENDING',
        rechargeMethod: 'EXTENSION',
        adAccount: { platform: 'FACEBOOK' }
      },
      include: {
        adAccount: { select: { accountId: true, accountName: true } }
      },
      take: 5,
      orderBy: { approvedAt: 'asc' }
    })

    if (deposits.length === 0) return

    const tokenInfo = await getActiveFBToken()
    if (!tokenInfo) {
      console.log('[Worker] No valid FB token available for recharges')
      return
    }

    for (const deposit of deposits) {
      await processOneRecharge(deposit, tokenInfo)
    }
  } catch (err: any) {
    console.error('[Worker] Recharge processing error:', err.message)
    workerStats.totalErrors++
    workerStats.lastError = err.message
  } finally {
    isProcessingRecharges = false
  }
}

async function processOneRecharge(
  deposit: any,
  tokenInfo: { token: string; sessionId: string }
) {
  const depositId = deposit.id
  const accountId = deposit.adAccount.accountId
  const amount = parseFloat(deposit.amount)

  if (!accountId || isNaN(amount) || amount <= 0) return

  try {
    // Claim it
    await prisma.accountDeposit.update({
      where: { id: depositId },
      data: {
        rechargeStatus: 'IN_PROGRESS',
        rechargedBy: `worker:${tokenInfo.sessionId}`,
      }
    })

    // Get current spend cap
    const accountData = await fbGraphRequest(`/act_${accountId}`, 'GET', {
      fields: 'spend_cap,amount_spent,name'
    }, tokenInfo.token)

    const currentCapCents = parseInt(accountData.spend_cap || '0', 10)
    const spentCents = parseInt(accountData.amount_spent || '0', 10)
    const currentCapDollars = currentCapCents / 100
    const spentDollars = spentCents / 100
    const newCapDollars = currentCapDollars + amount

    console.log(`[Worker] Recharging act_${accountId}: cap $${currentCapDollars} → $${newCapDollars} (+$${amount})`)

    // Update spend cap
    await fbGraphRequest(`/act_${accountId}`, 'POST', {
      spend_cap: newCapDollars.toString()
    }, tokenInfo.token)

    // Mark complete
    await prisma.accountDeposit.update({
      where: { id: depositId },
      data: {
        rechargeStatus: 'COMPLETED',
        rechargedAt: new Date(),
        rechargedBy: `worker:${tokenInfo.sessionId}`,
        rechargeError: null,
      }
    })

    // Update session stats
    await prisma.extensionSession.update({
      where: { id: tokenInfo.sessionId },
      data: {
        totalRecharges: { increment: 1 },
        lastError: null,
      }
    })

    workerStats.totalRechargesProcessed++
    console.log(`[Worker] Recharge completed: act_${accountId} +$${amount}`)

  } catch (err: any) {
    console.error(`[Worker] Recharge failed for act_${accountId}:`, err.message)
    workerStats.totalErrors++
    workerStats.lastError = err.message

    const newAttempts = (deposit.rechargeAttempts || 0) + 1
    const maxAttempts = 3
    const newStatus = newAttempts >= maxAttempts ? 'FAILED' : 'PENDING'

    await prisma.accountDeposit.update({
      where: { id: depositId },
      data: {
        rechargeStatus: newStatus,
        rechargeAttempts: newAttempts,
        rechargeError: err.message,
        rechargedBy: null,
      }
    })
  }
}

// ==================== BM Share Processing ====================

async function processBmShares() {
  if (isProcessingBmShares) return
  isProcessingBmShares = true

  try {
    const requests = await prisma.bmShareRequest.findMany({
      where: {
        status: 'PENDING',
        platform: 'FACEBOOK',
        shareMethod: 'EXTENSION',
      },
      include: {
        user: { select: { id: true, username: true } }
      },
      take: 5,
      orderBy: { createdAt: 'asc' }
    })

    if (requests.length === 0) return

    const tokenInfo = await getActiveFBToken()
    if (!tokenInfo) {
      console.log('[Worker] No valid FB token available for BM shares')
      return
    }

    for (const request of requests) {
      await processOneBmShare(request, tokenInfo)
    }
  } catch (err: any) {
    console.error('[Worker] BM share processing error:', err.message)
    workerStats.totalErrors++
    workerStats.lastError = err.message
  } finally {
    isProcessingBmShares = false
  }
}

async function processOneBmShare(
  request: any,
  tokenInfo: { token: string; sessionId: string }
) {
  const requestId = request.id
  const accountId = request.adAccountId
  const userBmId = request.bmId
  const username = request.user.username

  if (!accountId || !userBmId) return

  try {
    console.log(`[Worker] Sharing act_${accountId} → BM ${userBmId} (${username})`)

    // Update remarks
    await prisma.bmShareRequest.update({
      where: { id: requestId },
      data: { adminRemarks: 'Processing your BM share request...' }
    })

    // Call Facebook Graph API to share the ad account
    await fbGraphRequest(`/${userBmId}/client_ad_accounts`, 'POST', {
      adaccount_id: `act_${accountId}`,
      permitted_tasks: JSON.stringify(['MANAGE', 'ADVERTISE', 'ANALYZE']),
    }, tokenInfo.token)

    // Success
    await prisma.bmShareRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        adminRemarks: 'BM share completed successfully! Ad account has been shared to your Business Manager.',
        approvedAt: new Date(),
        shareMethod: 'EXTENSION',
      }
    })

    workerStats.totalBmSharesProcessed++
    console.log(`[Worker] BM share completed: act_${accountId} → BM ${userBmId}`)

  } catch (err: any) {
    console.error(`[Worker] BM share failed for act_${accountId}:`, err.message)
    workerStats.totalErrors++
    workerStats.lastError = err.message

    const newAttempts = (request.shareAttempts || 0) + 1
    const maxAttempts = 3

    if (newAttempts >= maxAttempts) {
      await prisma.bmShareRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          adminRemarks: 'BM share failed. Please contact support.',
          rejectedAt: new Date(),
          shareAttempts: newAttempts,
          shareError: err.message,
        }
      })
    } else {
      await prisma.bmShareRequest.update({
        where: { id: requestId },
        data: {
          shareAttempts: newAttempts,
          shareError: err.message,
          adminRemarks: 'Processing your BM share request...',
        }
      })
    }
  }
}

// ==================== Main Poll Loop ====================

async function poll() {
  workerStats.lastPollAt = new Date()

  try {
    await Promise.all([
      processRecharges(),
      processBmShares()
    ])
  } catch (err: any) {
    console.error('[Worker] Poll error:', err.message)
  }
}

// ==================== Public API ====================

export function startExtensionWorker() {
  if (isRunning) {
    console.log('[Worker] Already running')
    return
  }

  isRunning = true
  workerStats.startedAt = new Date()

  console.log(`[Worker] Started — polling every ${POLL_INTERVAL_MS / 1000}s for pending recharges and BM shares`)

  // Initial poll after 5s delay (let server finish starting)
  setTimeout(poll, 5000)

  // Then poll every 10s
  intervalId = setInterval(poll, POLL_INTERVAL_MS)
}

export function stopExtensionWorker() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  isRunning = false
  console.log('[Worker] Stopped')
}

export function getWorkerStats() {
  return {
    ...workerStats,
    isRunning,
  }
}
