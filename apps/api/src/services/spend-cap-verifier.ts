/**
 * Spend Cap Verifier Service
 *
 * After the Chrome extension reports a recharge as "SUCCESS", we don't blindly
 * trust it. Instead the deposit goes to rechargeStatus='VERIFYING' and this
 * cron verifies the actual spending cap on Facebook via:
 *   1. Cheetah API  (preferred — works for Cheetah-managed accounts)
 *   2. Facebook Graph API  (fallback — uses fbAccessToken from the profile)
 *
 * If verified  → APPROVED + balance increment
 * If mismatch → VERIFY_FAILED, verificationFailed=true, admin must handle
 */

import { prisma } from '../lib/prisma.js'
import { cheetahApi } from './cheetah-api.js'

const FB_GRAPH = 'https://graph.facebook.com/v21.0'
const POLL_INTERVAL_MS = 2 * 60 * 1000  // Every 2 minutes
const TOLERANCE_DOLLARS = 0.01           // $0.01 tolerance for float comparison

let pollInterval: NodeJS.Timeout | null = null

// ─── Get actual spend cap from Facebook ───────────────────────────────

interface SpendCapResult {
  success: boolean
  spendCapDollars?: number
  source?: 'CHEETAH' | 'GRAPH_API'
  error?: string
}

/**
 * Try Cheetah API first, then fall back to Facebook Graph API.
 * Returns the current spend_cap in DOLLARS.
 */
async function getActualSpendCap(
  accountId: string,
  fbAccessToken: string | null
): Promise<SpendCapResult> {
  // 1. Try Cheetah API
  try {
    await cheetahApi.loadConfig()
    const result = await cheetahApi.getAccount(accountId)
    if (result.code === 0 && result.data?.length > 0) {
      const spendCap = parseFloat(result.data[0].spend_cap) || 0
      return { success: true, spendCapDollars: spendCap, source: 'CHEETAH' }
    }
    // code 110 = account not found on Cheetah → try Graph API
  } catch (err: any) {
    console.log(`[SpendCapVerifier] Cheetah API error for act_${accountId}: ${err.message}`)
  }

  // 2. Fall back to Facebook Graph API
  if (!fbAccessToken) {
    return { success: false, error: 'No fbAccessToken available for Graph API fallback' }
  }

  try {
    const resp = await fetch(
      `${FB_GRAPH}/act_${accountId}?fields=spend_cap&access_token=${encodeURIComponent(fbAccessToken)}`
    )
    const text = await resp.text()
    let data: any
    try { data = JSON.parse(text) } catch {
      return { success: false, error: `Invalid FB response: ${text.substring(0, 200)}` }
    }
    if (data.error) {
      return { success: false, error: `FB Graph error: ${data.error.message || JSON.stringify(data.error)}` }
    }

    // Graph API returns spend_cap in CENTS
    const spendCapCents = parseInt(data.spend_cap || '0', 10)
    const spendCapDollars = spendCapCents / 100
    return { success: true, spendCapDollars, source: 'GRAPH_API' }
  } catch (err: any) {
    return { success: false, error: `Graph API fetch error: ${err.message}` }
  }
}

// ─── Verify a single deposit ──────────────────────────────────────────

export async function verifyDeposit(depositId: string): Promise<{
  verified: boolean
  error?: string
}> {
  // Load deposit + ad account (need accountId + extensionProfileId)
  const deposit = await prisma.accountDeposit.findUnique({
    where: { id: depositId },
    select: {
      id: true,
      amount: true,
      status: true,
      newSpendCap: true,
      previousSpendCap: true,
      rechargeStatus: true,
      adAccountId: true,
      adAccount: {
        select: {
          accountId: true,
          extensionProfileId: true,
        },
      },
    },
  })

  if (!deposit) {
    return { verified: false, error: 'Deposit not found' }
  }

  if (deposit.status === 'APPROVED') {
    // Already approved (maybe by force-approve) — skip
    return { verified: true }
  }

  if (!deposit.newSpendCap) {
    return { verified: false, error: 'No expected newSpendCap recorded — cannot verify' }
  }

  // Get the fb access token from the extension profile (if available)
  let fbAccessToken: string | null = null
  if (deposit.adAccount.extensionProfileId) {
    const profile = await prisma.facebookAutomationProfile.findUnique({
      where: { id: deposit.adAccount.extensionProfileId },
      select: { fbAccessToken: true },
    })
    fbAccessToken = profile?.fbAccessToken || null
  }

  // Get actual spend cap from Facebook
  const result = await getActualSpendCap(deposit.adAccount.accountId, fbAccessToken)

  if (!result.success) {
    // Can't fetch — leave as VERIFYING for next attempt
    console.log(`[SpendCapVerifier] Cannot fetch spend cap for deposit ${depositId}: ${result.error}`)
    return { verified: false, error: result.error }
  }

  const actualCap = result.spendCapDollars!
  const expectedCap = deposit.newSpendCap

  console.log(`[SpendCapVerifier] deposit ${depositId}: actual=$${actualCap} (${result.source}), expected=$${expectedCap}`)

  // Compare: actual should be >= expected (tolerance for float precision)
  if (actualCap >= expectedCap - TOLERANCE_DOLLARS) {
    // ✅ VERIFIED — approve and increment balance
    await prisma.$transaction(async (tx) => {
      const dep = await tx.accountDeposit.findUnique({
        where: { id: depositId },
        select: { status: true, amount: true, adAccountId: true },
      })
      if (!dep) return

      await tx.accountDeposit.update({
        where: { id: depositId },
        data: {
          status: 'APPROVED',
          rechargeStatus: 'COMPLETED',
          verifiedAt: new Date(),
          verificationFailed: false,
          rechargeError: null,
        },
      })

      // Only increment balance if not already APPROVED (prevent double-increment)
      if (dep.status !== 'APPROVED') {
        await tx.adAccount.update({
          where: { id: dep.adAccountId },
          data: {
            totalDeposit: { increment: dep.amount },
            balance: { increment: dep.amount },
          },
        })
      }
    })

    console.log(`[SpendCapVerifier] ✅ VERIFIED deposit ${depositId} via ${result.source}: actual=$${actualCap} >= expected=$${expectedCap}`)
    return { verified: true }
  } else {
    // ❌ MISMATCH — mark as failed
    await prisma.accountDeposit.update({
      where: { id: depositId },
      data: {
        rechargeStatus: 'VERIFY_FAILED',
        verificationFailed: true,
        rechargeError: `Verification failed (${result.source}): expected spend cap $${expectedCap}, actual $${actualCap}`,
      },
    })

    console.log(`[SpendCapVerifier] ❌ FAILED deposit ${depositId}: expected=$${expectedCap}, actual=$${actualCap} (${result.source})`)
    return { verified: false, error: `Expected $${expectedCap}, actual $${actualCap}` }
  }
}

// ─── Verification Cron ────────────────────────────────────────────────

async function runVerificationCycle(): Promise<void> {
  try {
    // Find all deposits waiting for verification
    const deposits = await prisma.accountDeposit.findMany({
      where: {
        rechargeStatus: 'VERIFYING',
        verificationFailed: false,
      },
      select: { id: true, adAccount: { select: { accountId: true } } },
      take: 20, // Process max 20 per cycle to avoid rate limits
    })

    if (deposits.length === 0) return

    console.log(`[SpendCapVerifier] Found ${deposits.length} deposits to verify`)

    let verified = 0
    let failed = 0
    let skipped = 0

    for (const deposit of deposits) {
      try {
        const result = await verifyDeposit(deposit.id)
        if (result.verified) verified++
        else if (result.error?.includes('Cannot fetch')) skipped++
        else failed++
      } catch (err: any) {
        console.error(`[SpendCapVerifier] Error verifying deposit ${deposit.id}:`, err.message)
        skipped++
      }

      // Small delay between verifications to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    if (verified > 0 || failed > 0) {
      console.log(`[SpendCapVerifier] Cycle complete — verified: ${verified}, failed: ${failed}, skipped: ${skipped}`)
    }
  } catch (err) {
    console.error('[SpendCapVerifier] Cycle error:', err)
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export function startVerificationCron(): void {
  console.log('[SpendCapVerifier] Starting spend cap verification cron...')
  console.log(`[SpendCapVerifier] Poll interval: ${POLL_INTERVAL_MS / 1000}s`)

  // First run after 30 seconds (let server start)
  setTimeout(() => {
    runVerificationCycle().catch(err => console.error('[SpendCapVerifier] Initial cycle error:', err))
  }, 30000)

  pollInterval = setInterval(() => {
    runVerificationCycle().catch(err => console.error('[SpendCapVerifier] Cycle error:', err))
  }, POLL_INTERVAL_MS)

  console.log('[SpendCapVerifier] Started — checking every 2 minutes')
}

export function stopVerificationCron(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  console.log('[SpendCapVerifier] Stopped')
}
