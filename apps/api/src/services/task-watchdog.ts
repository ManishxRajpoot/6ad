/**
 * Task Watchdog Service
 *
 * Runs every 2 minutes to:
 * A) Timeout stuck recharges (IN_PROGRESS > 15 min, PENDING with max retries)
 * B) Timeout stuck BM shares (PENDING with max retries)
 * C) Auto-refund permanently failed recharges (FAILED + attempts >= 5)
 * E) Auto-fix profile ↔ ad account mapping mismatches
 */

import {
  sendEmail,
  buildSmtpConfig,
  getAccountRechargeRejectedTemplate,
} from '../utils/email.js'
import { createNotification } from '../routes/notifications.js'
import { prisma } from '../lib/prisma.js'

// ─── Configuration ─────────────────────────────────────────────────
const CONFIG = {
  POLL_INTERVAL_MS: 2 * 60 * 1000,         // Check every 2 minutes
  IN_PROGRESS_TIMEOUT_MS: 15 * 60 * 1000,  // IN_PROGRESS > 15 min → FAILED
  PENDING_TIMEOUT_MS: 30 * 60 * 1000,      // PENDING > 30 min (only if max retries hit)
  VERIFYING_TIMEOUT_MS: 30 * 60 * 1000,    // VERIFYING > 30 min → VERIFY_FAILED
  MAX_RECHARGE_ATTEMPTS: 10,               // Matches recharge-cron MAX_ATTEMPTS
  MAX_SHARE_ATTEMPTS: 10,                  // Matches bm-share-cron MAX_ATTEMPTS
}

let pollInterval: NodeJS.Timeout | null = null

// ─── Step A: Timeout stuck recharges ───────────────────────────────
async function timeoutStuckRecharges(): Promise<number> {
  let count = 0

  // A1: IN_PROGRESS for too long → FAILED (TIMEOUT)
  const stuckInProgress = await prisma.accountDeposit.findMany({
    where: {
      status: 'APPROVED',
      rechargeStatus: 'IN_PROGRESS',
      updatedAt: { lt: new Date(Date.now() - CONFIG.IN_PROGRESS_TIMEOUT_MS) },
    },
    select: { id: true, applyId: true },
  })

  if (stuckInProgress.length > 0) {
    await prisma.accountDeposit.updateMany({
      where: { id: { in: stuckInProgress.map(d => d.id) } },
      data: {
        rechargeStatus: 'FAILED',
        rechargeError: 'TIMEOUT: Task stuck IN_PROGRESS for >15 minutes',
      },
    })
    for (const d of stuckInProgress) {
      console.log(`[Watchdog] Timed out IN_PROGRESS recharge: ${d.id} (${d.applyId || 'N/A'})`)
    }
    count += stuckInProgress.length
  }

  // A2: PENDING/NONE with max retries exhausted → FAILED (MAX_RETRIES_EXCEEDED)
  const maxRetriesPending = await prisma.accountDeposit.findMany({
    where: {
      status: 'APPROVED',
      rechargeStatus: { in: ['PENDING', 'NONE'] },
      rechargeAttempts: { gte: CONFIG.MAX_RECHARGE_ATTEMPTS },
    },
    select: { id: true, applyId: true, rechargeAttempts: true },
  })

  if (maxRetriesPending.length > 0) {
    await prisma.accountDeposit.updateMany({
      where: { id: { in: maxRetriesPending.map(d => d.id) } },
      data: {
        rechargeStatus: 'FAILED',
        rechargeError: 'MAX_RETRIES_EXCEEDED: Maximum recharge attempts exhausted',
      },
    })
    for (const d of maxRetriesPending) {
      console.log(`[Watchdog] Max retries exceeded for recharge: ${d.id} (${d.applyId || 'N/A'}) — ${d.rechargeAttempts} attempts`)
    }
    count += maxRetriesPending.length
  }

  return count
}

// ─── Step A3: Timeout stuck VERIFYING deposits ─────────────────────
async function timeoutStuckVerifications(): Promise<number> {
  const stuckVerifying = await prisma.accountDeposit.findMany({
    where: {
      rechargeStatus: 'VERIFYING',
      verificationFailed: false,
      updatedAt: { lt: new Date(Date.now() - CONFIG.VERIFYING_TIMEOUT_MS) },
    },
    select: { id: true, applyId: true },
  })

  if (stuckVerifying.length > 0) {
    await prisma.accountDeposit.updateMany({
      where: { id: { in: stuckVerifying.map(d => d.id) } },
      data: {
        rechargeStatus: 'VERIFY_FAILED',
        verificationFailed: true,
        rechargeError: 'TIMEOUT: Spend cap verification stuck for >30 minutes',
      },
    })
    for (const d of stuckVerifying) {
      console.log(`[Watchdog] Timed out VERIFYING deposit: ${d.id} (${d.applyId || 'N/A'})`)
    }
  }

  return stuckVerifying.length
}

// ─── Step B: Timeout stuck BM shares ───────────────────────────────
async function timeoutStuckBmShares(): Promise<number> {
  // PENDING or APPROVED with max retries exhausted → auto-reject
  const stuckBmShares = await prisma.bmShareRequest.findMany({
    where: {
      status: { in: ['PENDING', 'APPROVED'] },
      shareAttempts: { gte: CONFIG.MAX_SHARE_ATTEMPTS },
    },
    select: { id: true, applyId: true, shareAttempts: true },
  })

  if (stuckBmShares.length > 0) {
    await prisma.bmShareRequest.updateMany({
      where: { id: { in: stuckBmShares.map(r => r.id) } },
      data: {
        status: 'REJECTED',
        shareError: 'MAX_RETRIES_EXCEEDED: Auto-rejected after maximum failed attempts',
        rejectedAt: new Date(),
        adminRemarks: 'Auto-rejected by watchdog: max share attempts exhausted',
      },
    })
    for (const r of stuckBmShares) {
      console.log(`[Watchdog] Auto-rejected BM share: ${r.id} (${r.applyId || 'N/A'}) — ${r.shareAttempts} attempts`)
    }
  }

  return stuckBmShares.length
}

// ─── Step C: Auto-refund permanently failed recharges ──────────────
async function autoRefundFailedRecharges(): Promise<number> {
  // Find deposits that are APPROVED (money deducted) but recharge permanently FAILED
  const permanentlyFailed = await prisma.accountDeposit.findMany({
    where: {
      status: 'APPROVED',
      rechargeStatus: 'FAILED',
      rechargeAttempts: { gte: CONFIG.MAX_RECHARGE_ATTEMPTS },
    },
    include: {
      adAccount: {
        include: {
          user: {
            include: {
              agent: {
                select: {
                  brandLogo: true,
                  emailLogo: true,
                  username: true,
                  emailSenderNameApproved: true,
                  smtpEnabled: true,
                  smtpHost: true,
                  smtpPort: true,
                  smtpUsername: true,
                  smtpPassword: true,
                  smtpEncryption: true,
                  smtpFromEmail: true,
                  customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 },
                },
              },
            },
          },
        },
      },
    },
  })

  let refundedCount = 0

  for (const deposit of permanentlyFailed) {
    try {
      const depositAmount = Number(deposit.amount) || 0
      const commissionAmount = Number(deposit.commissionAmount) || 0
      const totalRefund = depositAmount + commissionAmount

      if (totalRefund <= 0) {
        console.log(`[Watchdog] Skipping auto-refund for ${deposit.id} — zero amount`)
        continue
      }

      await prisma.$transaction(async (tx) => {
        // 1. Mark deposit as REJECTED (same pattern as manual reject in accounts.ts)
        await tx.accountDeposit.update({
          where: { id: deposit.id },
          data: {
            status: 'REJECTED',
            adminRemarks: `Auto-refunded: Recharge permanently failed after ${deposit.rechargeAttempts} attempts. Error: ${deposit.rechargeError || 'unknown'}`,
          },
        })

        // 2. Reverse the ad account balance increment (undo the approval)
        await tx.adAccount.update({
          where: { id: deposit.adAccountId },
          data: {
            totalDeposit: { decrement: depositAmount },
            balance: { decrement: depositAmount },
          },
        })

        // 3. Refund to user wallet
        const balanceBefore = Number(deposit.adAccount.user.walletBalance)
        const balanceAfter = balanceBefore + totalRefund

        await tx.user.update({
          where: { id: deposit.adAccount.userId },
          data: { walletBalance: balanceAfter },
        })

        // 4. Create WalletFlow REFUND record
        await tx.walletFlow.create({
          data: {
            type: 'REFUND',
            amount: totalRefund,
            balanceBefore,
            balanceAfter,
            referenceId: deposit.id,
            referenceType: 'recharge_auto_refund',
            userId: deposit.adAccount.userId,
            description: `Auto-refund: Recharge failed for ${deposit.adAccount.platform} account ${deposit.adAccount.accountId}. $${depositAmount.toFixed(2)} + Fee $${commissionAmount.toFixed(2)} = $${totalRefund.toFixed(2)}`,
          },
        })
      })

      // 5. Send notification (fire and forget)
      createNotification({
        userId: deposit.adAccount.userId,
        type: 'DEPOSIT_REJECTED',
        title: 'Deposit Auto-Refunded',
        message: `Your deposit of $${depositAmount.toLocaleString()} for account ${deposit.adAccount.accountName || deposit.adAccount.accountId} could not be recharged and has been automatically refunded to your wallet.`,
        link: '/facebook',
      }).catch(() => {})

      // 6. Send rejection email with refund info (reuse existing template)
      const approvedDomain = deposit.adAccount.user.agent?.customDomains?.[0]
      const agent = deposit.adAccount.user.agent
      const agentLogo = approvedDomain?.emailLogo || approvedDomain?.brandLogo || agent?.emailLogo || agent?.brandLogo || null
      const agentBrandName = agent?.username || null
      const emailTemplate = getAccountRechargeRejectedTemplate({
        username: deposit.adAccount.user.username,
        applyId: deposit.applyId,
        amount: depositAmount,
        commission: commissionAmount,
        totalCost: totalRefund,
        platform: deposit.adAccount.platform,
        accountId: deposit.adAccount.accountId,
        accountName: deposit.adAccount.accountName || undefined,
        adminRemarks: `Recharge failed after ${deposit.rechargeAttempts} attempts. Your deposit has been automatically refunded.`,
        agentLogo,
        agentBrandName,
      })
      sendEmail({
        to: deposit.adAccount.user.email,
        ...emailTemplate,
        senderName: agent?.emailSenderNameApproved || undefined,
        smtpConfig: buildSmtpConfig(agent),
      }).catch(console.error)

      console.log(`[Watchdog] Auto-refunded deposit ${deposit.id} (${deposit.applyId || 'N/A'}) — $${totalRefund.toFixed(2)} → user ${deposit.adAccount.userId}`)
      refundedCount++
    } catch (error) {
      console.error(`[Watchdog] Failed to auto-refund deposit ${deposit.id}:`, error)
    }
  }

  return refundedCount
}

// ─── Step D: Token health check (logging only) ──────────────────────
async function logTokenHealth(): Promise<void> {
  const profiles = await prisma.facebookAutomationProfile.findMany({
    where: { isEnabled: true },
    select: { fbAccessToken: true, fbTokenCapturedAt: true },
  })

  const total = profiles.length
  if (total === 0) return

  const withToken = profiles.filter(p => !!p.fbAccessToken).length
  const staleThreshold = Date.now() - 24 * 60 * 60 * 1000
  const stale = profiles.filter(p => p.fbAccessToken && p.fbTokenCapturedAt && p.fbTokenCapturedAt.getTime() < staleThreshold).length
  const missing = total - withToken

  if (missing > 0 || stale > 0) {
    console.log(`[Watchdog] Token health: ${withToken}/${total} profiles have tokens (${stale} stale >24h, ${missing} missing)`)
  }
}

// ─── Step E: Auto-fix profile ↔ ad account mapping ─────────────────
async function autoFixProfileMappings(): Promise<number> {
  let fixCount = 0

  // Get all ad accounts that have an extensionProfileId assigned
  const accounts = await prisma.adAccount.findMany({
    where: { extensionProfileId: { not: null } },
    select: { id: true, accountId: true, extensionProfileId: true },
  })

  if (accounts.length === 0) return 0

  // Get all enabled profiles with their managedAdAccountIds
  const profiles = await prisma.facebookAutomationProfile.findMany({
    where: { isEnabled: true },
    select: { id: true, label: true, adsPowerSerialNumber: true, managedAdAccountIds: true },
  })

  // Build a map: accountId → profile (from managedAdAccountIds across ALL profiles)
  const accountToProfile = new Map<string, { profileId: string, label: string }>()
  for (const profile of profiles) {
    const label = profile.label || profile.adsPowerSerialNumber || profile.id
    for (const accId of profile.managedAdAccountIds) {
      accountToProfile.set(accId, { profileId: profile.id, label })
    }
  }

  for (const account of accounts) {
    const assignedProfileId = account.extensionProfileId!
    const assignedProfile = profiles.find(p => p.id === assignedProfileId)

    // Check if account is already in assigned profile's managedAdAccountIds
    const isInAssignedProfile = assignedProfile?.managedAdAccountIds.includes(account.accountId)
    if (isInAssignedProfile) continue // All good

    // Account NOT in assigned profile — check if it's in another profile
    const correctMapping = accountToProfile.get(account.accountId)

    if (correctMapping && correctMapping.profileId !== assignedProfileId) {
      // Found in a DIFFERENT profile → fix extensionProfileId to the correct one
      await prisma.adAccount.update({
        where: { id: account.id },
        data: { extensionProfileId: correctMapping.profileId },
      })
      const oldLabel = assignedProfile?.label || assignedProfile?.adsPowerSerialNumber || assignedProfileId
      console.log(`[Watchdog] Fixed mapping: act_${account.accountId} → profile "${correctMapping.label}" (was "${oldLabel}")`)
      fixCount++
    } else if (!correctMapping && assignedProfile) {
      // Not in ANY profile's managedAdAccountIds → add to the assigned profile
      await prisma.facebookAutomationProfile.update({
        where: { id: assignedProfileId },
        data: { managedAdAccountIds: { push: account.accountId } },
      })
      const label = assignedProfile.label || assignedProfile.adsPowerSerialNumber || assignedProfileId
      console.log(`[Watchdog] Added act_${account.accountId} to profile "${label}" managedAdAccountIds`)
      fixCount++
    }
  }

  return fixCount
}

// ─── Main watchdog cycle ───────────────────────────────────────────
async function runWatchdogCycle(): Promise<void> {
  try {
    const timedOutRecharges = await timeoutStuckRecharges()
    const timedOutVerifications = await timeoutStuckVerifications()
    const timedOutBmShares = await timeoutStuckBmShares()
    const refundedDeposits = await autoRefundFailedRecharges()
    const fixedMappings = await autoFixProfileMappings()
    await logTokenHealth()

    // Only log if something happened
    if (timedOutRecharges > 0 || timedOutVerifications > 0 || timedOutBmShares > 0 || refundedDeposits > 0 || fixedMappings > 0) {
      console.log(`[Watchdog] Cycle complete — timed out ${timedOutRecharges} recharges, ${timedOutVerifications} verifications, ${timedOutBmShares} BM shares, auto-refunded ${refundedDeposits} deposits, fixed ${fixedMappings} profile mappings`)
    }
  } catch (error) {
    console.error('[Watchdog] Cycle error:', error)
  }
}

// ─── Public API ────────────────────────────────────────────────────
export function startTaskWatchdog(): void {
  console.log('[Watchdog] Starting task watchdog...')
  console.log(`[Watchdog] Poll interval: ${CONFIG.POLL_INTERVAL_MS / 1000}s`)
  console.log(`[Watchdog] IN_PROGRESS timeout: ${CONFIG.IN_PROGRESS_TIMEOUT_MS / 60000} min`)
  console.log(`[Watchdog] Max recharge attempts: ${CONFIG.MAX_RECHARGE_ATTEMPTS}`)
  console.log(`[Watchdog] Max share attempts: ${CONFIG.MAX_SHARE_ATTEMPTS}`)

  // Run first cycle after a short delay (let server fully start)
  setTimeout(() => {
    runWatchdogCycle().catch(err => console.error('[Watchdog] Initial cycle error:', err))
  }, 10000)

  pollInterval = setInterval(() => {
    runWatchdogCycle().catch(err => console.error('[Watchdog] Cycle error:', err))
  }, CONFIG.POLL_INTERVAL_MS)

  console.log('[Watchdog] Started — checking every 2 minutes')
}

export function stopTaskWatchdog(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  console.log('[Watchdog] Stopped')
}
