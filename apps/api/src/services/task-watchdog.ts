/**
 * Task Watchdog Service
 *
 * Runs every 2 minutes to:
 * A) Timeout stuck recharges (IN_PROGRESS > 15 min, PENDING with max retries)
 * B) Timeout stuck BM shares (PENDING with max retries)
 * C) Auto-reject permanently failed recharges (FAILED + attempts >= max) — NO auto-refund, admin decides
 * E) Auto-fix profile ↔ ad account mapping mismatches
 * F) Revive stale profiles — detect FB logout, restart browser + CDP auto-login
 */
import { createNotification } from '../routes/notifications.js'
import { prisma } from '../lib/prisma.js'
import { cdpAutoLogin, startBrowser, stopBrowser, isBrowserActive } from './adspower-worker.js'

// ─── Configuration ─────────────────────────────────────────────────
const CONFIG = {
  POLL_INTERVAL_MS: 2 * 60 * 1000,         // Check every 2 minutes
  IN_PROGRESS_TIMEOUT_MS: 15 * 60 * 1000,  // IN_PROGRESS > 15 min → FAILED
  PENDING_TIMEOUT_MS: 30 * 60 * 1000,      // PENDING > 30 min (only if max retries hit)
  VERIFYING_TIMEOUT_MS: 30 * 60 * 1000,    // VERIFYING > 30 min → VERIFY_FAILED
  MAX_RECHARGE_ATTEMPTS: 10,               // Matches recharge-cron MAX_ATTEMPTS
  MAX_SHARE_ATTEMPTS: 10,                  // Matches bm-share-cron MAX_ATTEMPTS
  STALE_HEARTBEAT_MS: 5 * 60 * 1000,       // Extension heartbeat older than 5 min → stale
  REVIVE_COOLDOWN_MS: 10 * 60 * 1000,      // Don't retry revive within 10 min of last attempt
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

// ─── Step C: Auto-reject permanently failed recharges (NO auto-refund) ──────────────
async function autoRejectFailedRecharges(): Promise<number> {
  // Find PENDING deposits where recharge permanently FAILED (max attempts exhausted)
  // Mark as REJECTED — admin must manually review and decide on refund
  const permanentlyFailed = await prisma.accountDeposit.findMany({
    where: {
      status: 'PENDING',
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

  let rejectedCount = 0

  for (const deposit of permanentlyFailed) {
    try {
      // Mark as REJECTED — NO auto-refund. Funds stay on hold, admin must review.
      await prisma.accountDeposit.update({
        where: { id: deposit.id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          adminRemarks: `Auto-rejected: Recharge failed after ${deposit.rechargeAttempts} attempts. Error: ${deposit.rechargeError || 'unknown'}. Funds on hold — admin must review.`,
        },
      })

      // Send notification to user
      createNotification({
        userId: deposit.adAccount.userId,
        type: 'DEPOSIT_REJECTED',
        title: 'Recharge Request Rejected',
        message: `Your recharge of $${Number(deposit.amount).toLocaleString()} for account ${deposit.adAccount.accountName || deposit.adAccount.accountId} could not be completed. Please contact admin for resolution.`,
        link: '/facebook',
      }).catch(() => {})

      console.log(`[Watchdog] Auto-rejected deposit ${deposit.id} (${deposit.applyId || 'N/A'}) — funds on hold, admin must review`)
      rejectedCount++
    } catch (error) {
      console.error(`[Watchdog] Failed to auto-reject deposit ${deposit.id}:`, error)
    }
  }

  return rejectedCount
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

// ─── Step F: Revive stale profiles (FB logged out → CDP auto-login) ──
const lastReviveAttempt = new Map<string, number>()

async function reviveStaleProfiles(): Promise<number> {
  let revivedCount = 0

  // Find enabled profiles with stale heartbeat (extension stopped polling)
  const staleThreshold = new Date(Date.now() - CONFIG.STALE_HEARTBEAT_MS)
  const staleProfiles = await prisma.facebookAutomationProfile.findMany({
    where: {
      isEnabled: true,
      adsPowerSerialNumber: { not: null },
      fbLoginEmail: { not: null },  // Must have login credentials for CDP
      OR: [
        { lastHeartbeatAt: { lt: staleThreshold } },
        { lastHeartbeatAt: null },
      ],
    },
    select: {
      id: true,
      label: true,
      adsPowerSerialNumber: true,
      managedAdAccountIds: true,
      lastHeartbeatAt: true,
    },
  })

  if (staleProfiles.length === 0) return 0

  for (const profile of staleProfiles) {
    const serial = profile.adsPowerSerialNumber!
    const label = profile.label || serial

    // Check cooldown — don't retry if we just attempted
    const lastAttempt = lastReviveAttempt.get(profile.id) || 0
    if (Date.now() - lastAttempt < CONFIG.REVIVE_COOLDOWN_MS) continue

    // Check if this profile has any pending deposits
    const managedIds = profile.managedAdAccountIds || []
    if (managedIds.length === 0) continue

    const pendingCount = await prisma.accountDeposit.count({
      where: {
        approvedAt: { not: null },
        rechargeStatus: { in: ['PENDING', 'NONE'] },
        adAccount: { accountId: { in: managedIds } },
      },
    })

    // Also check pending BM shares
    const pendingBmShares = await prisma.bmShareRequest.count({
      where: {
        status: 'PENDING',
        platform: 'FACEBOOK',
        adAccountId: { in: managedIds },
      },
    })

    if (pendingCount === 0 && pendingBmShares === 0) continue

    // This profile is stale AND has pending tasks → revive it
    const staleMinutes = profile.lastHeartbeatAt
      ? ((Date.now() - profile.lastHeartbeatAt.getTime()) / 60000).toFixed(0)
      : 'never'

    console.log(`[Watchdog] Reviving stale profile "${label}" (heartbeat: ${staleMinutes} min ago, ${pendingCount} deposits + ${pendingBmShares} BM shares pending)`)
    lastReviveAttempt.set(profile.id, Date.now())

    try {
      // 1. Check if browser is running
      const isActive = await isBrowserActive(serial)

      if (isActive) {
        // Browser running but extension stale → FB probably logged out
        // Stop and restart for a clean session
        console.log(`[Watchdog] Browser active but extension stale for "${label}" — restarting...`)
        await stopBrowser(serial)
        await new Promise(r => setTimeout(r, 5000))
      }

      // 2. Start browser
      const launched = await startBrowser(serial)
      if (!launched) {
        console.log(`[Watchdog] Failed to start browser for "${label}"`)
        continue
      }
      console.log(`[Watchdog] Browser started for "${label}" — waiting 15s for load...`)
      await new Promise(r => setTimeout(r, 15000))

      // 3. Reload full profile for CDP login (needs credentials)
      const fullProfile = await prisma.facebookAutomationProfile.findUnique({
        where: { id: profile.id },
      })
      if (!fullProfile) continue

      // 4. Run CDP auto-login
      const cdpOk = await cdpAutoLogin(serial, fullProfile)
      if (cdpOk) {
        console.log(`[Watchdog] ✅ CDP login triggered for "${label}" — FB session should restore`)
        revivedCount++
      } else {
        console.log(`[Watchdog] ❌ CDP login failed for "${label}" — will retry in ${CONFIG.REVIVE_COOLDOWN_MS / 60000} min`)
      }
    } catch (err: any) {
      console.error(`[Watchdog] Error reviving "${label}":`, err.message)
    }
  }

  return revivedCount
}

// ─── Main watchdog cycle ───────────────────────────────────────────
async function runWatchdogCycle(): Promise<void> {
  try {
    const timedOutRecharges = await timeoutStuckRecharges()
    const timedOutVerifications = await timeoutStuckVerifications()
    const timedOutBmShares = await timeoutStuckBmShares()
    const rejectedDeposits = await autoRejectFailedRecharges()
    const fixedMappings = await autoFixProfileMappings()
    const revivedProfiles = await reviveStaleProfiles()
    await logTokenHealth()

    // Only log if something happened
    if (timedOutRecharges > 0 || timedOutVerifications > 0 || timedOutBmShares > 0 || rejectedDeposits > 0 || fixedMappings > 0 || revivedProfiles > 0) {
      console.log(`[Watchdog] Cycle complete — timed out ${timedOutRecharges} recharges, ${timedOutVerifications} verifications, ${timedOutBmShares} BM shares, rejected ${rejectedDeposits} deposits, fixed ${fixedMappings} mappings, revived ${revivedProfiles} profiles`)
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
