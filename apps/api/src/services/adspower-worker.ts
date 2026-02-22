/**
 * AdsPower On-Demand Worker
 *
 * Smart task routing by ad account ID:
 *   - Each profile stores managedAdAccountIds (auto-populated from extension heartbeat)
 *   - When a task comes in for act_123, worker finds which profile has "123" in managedAdAccountIds
 *   - Opens ONLY that specific AdsPower browser
 *   - Extension processes the task, then browser is closed
 *
 * AdsPower Local API: http://localhost:50325/api/v1/browser/...
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Configuration ─────────────────────────────────────────────────
const CONFIG = {
  POLL_INTERVAL_MS: 30_000,
  ADSPOWER_API_BASE: process.env.ADSPOWER_API_BASE || 'http://localhost:50325',
  ADSPOWER_API_KEY: process.env.ADSPOWER_API_KEY || '1c36652b562b009f94bb48545b3b091f00205f7c6f0c18b1',
  BROWSER_LAUNCH_WAIT_MS: 15_000,
  HEARTBEAT_TIMEOUT_MS: 120_000,
  TASK_TIMEOUT_MS: 300_000,
  IDLE_CLOSE_DELAY_MS: 30_000,
}

const activeBrowsers = new Map<string, { profileId: string; serialNumber: string; launchedAt: number }>()

let pollInterval: NodeJS.Timeout | null = null
let isProcessing = false

// ─── AdsPower API helpers ──────────────────────────────────────────

interface AdsPowerResponse {
  code: number
  msg: string
  data?: { ws?: { puppeteer: string; selenium: string }; webdriver?: string; status?: string }
}

async function adsPowerRequest(path: string): Promise<AdsPowerResponse> {
  try {
    // Append api_key to every request (required by AdsPower paid plans)
    const separator = path.includes('?') ? '&' : '?'
    const url = `${CONFIG.ADSPOWER_API_BASE}${path}${separator}api_key=${CONFIG.ADSPOWER_API_KEY}`
    const res = await fetch(url)
    return await res.json() as AdsPowerResponse
  } catch (err: any) {
    return { code: -1, msg: `AdsPower API unreachable: ${err.message}` }
  }
}

async function startBrowser(serialNumber: string): Promise<boolean> {
  console.log(`[AdsPower] Starting browser serial=${serialNumber} with extension`)
  const launchArgs = encodeURIComponent(JSON.stringify(['--no-sandbox']))
  const openTabs = encodeURIComponent(JSON.stringify(['https://www.facebook.com/']))
  const res = await adsPowerRequest(`/api/v1/browser/start?serial_number=${serialNumber}&launch_args=${launchArgs}&open_tabs=${openTabs}`)
  if (res.code === 0) { console.log(`[AdsPower] Browser started: serial=${serialNumber}`); return true }
  if (res.msg?.includes('bindled') || res.msg?.includes('bindling')) { console.log(`[AdsPower] Browser already running: serial=${serialNumber}`); return true }
  console.error(`[AdsPower] Failed to start serial=${serialNumber}: ${res.msg}`)
  return false
}

async function stopBrowser(serialNumber: string): Promise<boolean> {
  console.log(`[AdsPower] Stopping browser serial=${serialNumber}`)
  const res = await adsPowerRequest(`/api/v1/browser/stop?serial_number=${serialNumber}`)
  if (res.code === 0) { console.log(`[AdsPower] Browser stopped: serial=${serialNumber}`); return true }
  console.error(`[AdsPower] Failed to stop serial=${serialNumber}: ${res.msg}`)
  return false
}

async function isBrowserActive(serialNumber: string): Promise<boolean> {
  const res = await adsPowerRequest(`/api/v1/browser/active?serial_number=${serialNumber}`)
  return res.code === 0 && res.data?.status === 'Active'
}

// ─── Task Detection ────────────────────────────────────────────────

interface PendingTask {
  type: 'bm_share' | 'recharge'
  id: string
  adAccountId: string
}

/**
 * Get all pending tasks (just id + Facebook accountId)
 *
 * BmShareRequest.adAccountId = Facebook account ID string (e.g. "879772328363257")
 * AccountDeposit.adAccountId = MongoDB ObjectID → need adAccount.accountId for Facebook ID
 */
async function getPendingTasks(): Promise<PendingTask[]> {
  const tasks: PendingTask[] = []

  // BM shares: adAccountId is already the Facebook account ID (no relation needed)
  const bmShares = await prisma.bmShareRequest.findMany({
    where: { status: 'PENDING', platform: 'FACEBOOK', shareAttempts: { lt: 5 } },
    select: { id: true, adAccountId: true },
    take: 20,
  }).catch(() => [] as any[])

  // Recharges: adAccountId is MongoDB ObjectID, need adAccount.accountId for Facebook ID
  const recharges = await prisma.accountDeposit.findMany({
    where: { status: 'APPROVED', rechargeStatus: { in: ['PENDING', 'NONE'] } },
    select: { id: true, adAccountId: true, adAccount: { select: { accountId: true } } },
    take: 20,
  }).catch(() => [] as any[])

  for (const s of bmShares) tasks.push({ type: 'bm_share', id: s.id, adAccountId: s.adAccountId })
  for (const r of recharges) tasks.push({ type: 'recharge', id: r.id, adAccountId: r.adAccount?.accountId || r.adAccountId })

  return tasks
}

// ─── Profile Matching by Ad Account ID ─────────────────────────────

/**
 * Find which profile manages this ad account.
 *
 * Strategy:
 *   1. Direct link: AdAccount.extensionProfileId → profile (set by admin when creating account)
 *   2. Heartbeat match: profile has this adAccountId in managedAdAccountIds
 *   3. No match: return null → caller uses fallback
 */
async function findProfileForAdAccount(adAccountId: string): Promise<any | null> {
  // 1. Direct link from AdAccount → extensionProfileId
  const adAccount = await prisma.adAccount.findFirst({
    where: { accountId: adAccountId },
    select: { extensionProfileId: true },
  }).catch(() => null)

  if (adAccount?.extensionProfileId) {
    const profile = await prisma.facebookAutomationProfile.findFirst({
      where: {
        id: adAccount.extensionProfileId,
        isEnabled: true,
        adsPowerSerialNumber: { not: null },
      },
    })
    if (profile) {
      console.log(`[AdsPower] Direct link: act_${adAccountId} → profile "${profile.label}"`)
      return profile
    }
  }

  // 2. Heartbeat match: check managedAdAccountIds
  const profiles = await prisma.facebookAutomationProfile.findMany({
    where: {
      isEnabled: true,
      adsPowerSerialNumber: { not: null },
      extensionApiKey: { not: null },
      managedAdAccountIds: { has: adAccountId },
    },
  })

  if (profiles.length > 0) {
    for (const p of profiles) {
      if (!activeBrowsers.has(p.id)) return p
    }
    return profiles[0]
  }

  return null
}

/**
 * Fallback: get any available profile
 */
async function getAnyAvailableProfile(): Promise<any | null> {
  const profiles = await prisma.facebookAutomationProfile.findMany({
    where: {
      isEnabled: true,
      adsPowerSerialNumber: { not: null },
      extensionApiKey: { not: null },
    },
  })

  for (const p of profiles) {
    if (!activeBrowsers.has(p.id)) return p
  }
  return null
}

// ─── Browser Lifecycle ─────────────────────────────────────────────

async function waitForHeartbeat(profileId: string): Promise<boolean> {
  const startTime = Date.now()
  while (Date.now() - startTime < CONFIG.HEARTBEAT_TIMEOUT_MS) {
    const profile = await prisma.facebookAutomationProfile.findUnique({
      where: { id: profileId },
      select: { lastHeartbeatAt: true },
    })
    if (profile?.lastHeartbeatAt && (Date.now() - profile.lastHeartbeatAt.getTime()) < 30_000) {
      console.log(`[AdsPower] Extension heartbeat confirmed for profile ${profileId}`)
      return true
    }
    await sleep(5_000)
  }
  console.warn(`[AdsPower] Heartbeat timeout for profile ${profileId}`)
  return false
}

async function ensureBrowserRunning(profile: any): Promise<boolean> {
  const serialNumber = profile.adsPowerSerialNumber!

  if (activeBrowsers.has(profile.id)) return true

  const alreadyActive = await isBrowserActive(serialNumber)
  if (!alreadyActive) {
    const launched = await startBrowser(serialNumber)
    if (!launched) return false
    console.log(`[AdsPower] Waiting ${CONFIG.BROWSER_LAUNCH_WAIT_MS / 1000}s for browser to load...`)
    await sleep(CONFIG.BROWSER_LAUNCH_WAIT_MS)
  }

  activeBrowsers.set(profile.id, { profileId: profile.id, serialNumber, launchedAt: Date.now() })

  const heartbeatOk = await waitForHeartbeat(profile.id)
  if (!heartbeatOk) {
    console.warn(`[AdsPower] Extension not responding in "${profile.label}" — stopping`)
    await stopBrowser(serialNumber)
    activeBrowsers.delete(profile.id)
    return false
  }

  return true
}

// ─── Main Poll Loop ────────────────────────────────────────────────

async function pollForTasks(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  try {
    const tasks = await getPendingTasks()

    if (tasks.length === 0) {
      await cleanupIdleBrowsers()
      return
    }

    console.log(`[AdsPower] Found ${tasks.length} pending tasks`)

    // Group tasks by ad account → find correct profile for each
    const profilesToLaunch = new Map<string, { profile: any; adAccountIds: Set<string> }>()

    for (const task of tasks) {
      // Find profile that has this ad account
      let profile = await findProfileForAdAccount(task.adAccountId)

      if (!profile) {
        // No profile has this ad account — use fallback
        profile = await getAnyAvailableProfile()
        if (!profile) {
          console.log(`[AdsPower] No profile found for ad account ${task.adAccountId}`)
          continue
        }
        console.log(`[AdsPower] No profile match for act_${task.adAccountId}, using fallback "${profile.label}"`)
      }

      if (!profilesToLaunch.has(profile.id)) {
        profilesToLaunch.set(profile.id, { profile, adAccountIds: new Set() })
      }
      profilesToLaunch.get(profile.id)!.adAccountIds.add(task.adAccountId)
    }

    if (profilesToLaunch.size === 0) {
      console.log(`[AdsPower] No profiles available for pending tasks`)
      return
    }

    // Launch each needed profile
    for (const [profileId, { profile, adAccountIds }] of profilesToLaunch) {
      console.log(`[AdsPower] Opening "${profile.label}" (serial=${profile.adsPowerSerialNumber}) for ${adAccountIds.size} ad accounts: ${Array.from(adAccountIds).map(id => 'act_' + id).join(', ')}`)
      const ok = await ensureBrowserRunning(profile)
      if (!ok) continue
      console.log(`[AdsPower] Extension running in "${profile.label}" — processing...`)
    }

    // Wait for tasks to complete
    const startTime = Date.now()
    while (Date.now() - startTime < CONFIG.TASK_TIMEOUT_MS) {
      const remaining = await getPendingTasks()
      if (remaining.length === 0) {
        console.log(`[AdsPower] All tasks completed`)
        break
      }
      console.log(`[AdsPower] Waiting... ${remaining.length} tasks remaining`)
      await sleep(10_000)
    }

    // Check if tasks failed due to login issues — if so, keep browser open and retry
    const failedDeposits = await prisma.accountDeposit.findMany({
      where: {
        status: 'APPROVED',
        rechargeStatus: 'FAILED',
        rechargeError: { contains: 'Auto-login' },
        updatedAt: { gte: new Date(Date.now() - 120_000) }, // Failed in last 2 min
      },
      select: { id: true, rechargeError: true },
      take: 10,
    }).catch(() => [] as any[])

    if (failedDeposits.length > 0) {
      console.log(`[AdsPower] ${failedDeposits.length} deposits failed due to login issues — waiting for content-script auto-login...`)

      // Wait 90 seconds for content.js auto-login to complete (fill form + FB login + page load)
      await sleep(90_000)

      // Check if extension now has a valid token (login succeeded)
      for (const [profileId] of profilesToLaunch) {
        const profile = await prisma.facebookAutomationProfile.findUnique({
          where: { id: profileId },
          select: { fbAccessToken: true, fbTokenCapturedAt: true, label: true },
        })
        const tokenFresh = profile?.fbTokenCapturedAt && (Date.now() - profile.fbTokenCapturedAt.getTime()) < 120_000
        if (profile?.fbAccessToken && tokenFresh) {
          console.log(`[AdsPower] Login succeeded for "${profile.label}"! Token captured. Resetting failed deposits for retry...`)

          // Reset login-failed deposits back to PENDING for retry
          const resetResult = await prisma.accountDeposit.updateMany({
            where: {
              status: 'APPROVED',
              rechargeStatus: 'FAILED',
              rechargeError: { contains: 'Auto-login' },
              updatedAt: { gte: new Date(Date.now() - 300_000) },
            },
            data: { rechargeStatus: 'PENDING', rechargeError: null },
          })
          console.log(`[AdsPower] Reset ${resetResult.count} deposits to PENDING`)

          // Wait for extension to process the retried tasks
          await sleep(60_000)
        } else {
          console.log(`[AdsPower] Login still not successful for "${profile?.label || profileId}" — no fresh token found`)
        }
      }
    }

    // Idle delay then stop browsers
    await sleep(CONFIG.IDLE_CLOSE_DELAY_MS)

    const finalTasks = await getPendingTasks()
    if (finalTasks.length === 0) {
      for (const [profileId, { profile }] of profilesToLaunch) {
        const serial = profile.adsPowerSerialNumber!
        console.log(`[AdsPower] Tasks done. Stopping "${profile.label}" (serial=${serial})`)
        await stopBrowser(serial)
        activeBrowsers.delete(profileId)
      }
    } else {
      console.log(`[AdsPower] Still ${finalTasks.length} tasks remaining — keeping browsers open`)
    }

  } catch (err: any) {
    console.error(`[AdsPower] Worker error:`, err.message)
  } finally {
    isProcessing = false
  }
}

async function cleanupIdleBrowsers(): Promise<void> {
  for (const [profileId, info] of activeBrowsers.entries()) {
    if (Date.now() - info.launchedAt > CONFIG.TASK_TIMEOUT_MS) {
      console.log(`[AdsPower] Cleaning up idle browser: serial=${info.serialNumber}`)
      await stopBrowser(info.serialNumber)
      activeBrowsers.delete(profileId)
    }
  }
}

// ─── Account Discovery ──────────────────────────────────────────────

/**
 * Discover which AdsPower profile manages a given ad account.
 *
 * Opens each enabled profile one by one, waits for extension heartbeat
 * (which calls FB /me/adaccounts and reports managedAdAccountIds),
 * then checks if the target account appears. Stops as soon as found.
 *
 * Sets AdAccount.extensionProfileId when found.
 *
 * @returns profileId if found, null if not found in any profile
 */
export async function discoverAccountProfile(adAccountId: string): Promise<string | null> {
  console.log(`[AdsPower Discovery] Starting discovery for act_${adAccountId}`)

  // Get all enabled profiles with AdsPower config
  const profiles = await prisma.facebookAutomationProfile.findMany({
    where: {
      isEnabled: true,
      adsPowerSerialNumber: { not: null },
      extensionApiKey: { not: null },
    },
  })

  if (profiles.length === 0) {
    console.log(`[AdsPower Discovery] No profiles available`)
    return null
  }

  // First check if any profile already has it in managedAdAccountIds (from previous heartbeats)
  for (const profile of profiles) {
    if (profile.managedAdAccountIds?.includes(adAccountId)) {
      console.log(`[AdsPower Discovery] Already known: act_${adAccountId} → "${profile.label}"`)
      // Link it directly
      await prisma.adAccount.updateMany({
        where: { accountId: adAccountId },
        data: { extensionProfileId: profile.id },
      })
      return profile.id
    }
  }

  console.log(`[AdsPower Discovery] Account not in any cached heartbeat. Opening ${profiles.length} profiles to discover...`)

  // Open each profile, wait for heartbeat, check if account discovered
  for (const profile of profiles) {
    const serialNumber = profile.adsPowerSerialNumber!
    const wasAlreadyActive = activeBrowsers.has(profile.id) || await isBrowserActive(serialNumber)

    console.log(`[AdsPower Discovery] Trying "${profile.label}" (serial=${serialNumber})...`)

    const ok = await ensureBrowserRunning(profile)
    if (!ok) {
      console.log(`[AdsPower Discovery] Failed to start "${profile.label}", skipping`)
      continue
    }

    // Give extension a moment to heartbeat with fresh ad account list
    await sleep(10_000)

    // Re-read profile to get updated managedAdAccountIds
    const updatedProfile = await prisma.facebookAutomationProfile.findUnique({
      where: { id: profile.id },
      select: { managedAdAccountIds: true },
    })

    if (updatedProfile?.managedAdAccountIds?.includes(adAccountId)) {
      console.log(`[AdsPower Discovery] FOUND: act_${adAccountId} → "${profile.label}"`)

      // Link it
      await prisma.adAccount.updateMany({
        where: { accountId: adAccountId },
        data: { extensionProfileId: profile.id },
      })

      // Close browser if we opened it
      if (!wasAlreadyActive) {
        await stopBrowser(serialNumber)
        activeBrowsers.delete(profile.id)
      }

      return profile.id
    }

    console.log(`[AdsPower Discovery] act_${adAccountId} NOT in "${profile.label}"`)

    // Close browser if we opened it just for discovery
    if (!wasAlreadyActive) {
      await stopBrowser(serialNumber)
      activeBrowsers.delete(profile.id)
    }
  }

  console.log(`[AdsPower Discovery] act_${adAccountId} not found in any profile`)
  return null
}

// ─── Public API ────────────────────────────────────────────────────

export function startAdsPowerWorker(): void {
  console.log('[AdsPower] Starting on-demand worker...')
  console.log(`[AdsPower] API base: ${CONFIG.ADSPOWER_API_BASE}`)
  console.log(`[AdsPower] Poll interval: ${CONFIG.POLL_INTERVAL_MS / 1000}s`)

  pollForTasks().catch(err => console.error('[AdsPower] Initial poll error:', err))
  pollInterval = setInterval(() => {
    pollForTasks().catch(err => console.error('[AdsPower] Poll error:', err))
  }, CONFIG.POLL_INTERVAL_MS)

  console.log('[AdsPower] Worker started')
}

export async function stopAdsPowerWorker(): Promise<void> {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
  for (const [, info] of activeBrowsers.entries()) await stopBrowser(info.serialNumber)
  activeBrowsers.clear()
  console.log('[AdsPower] Worker stopped')
}

export function getWorkerStatus() {
  return {
    isRunning: pollInterval !== null,
    isProcessing,
    activeBrowserCount: activeBrowsers.size,
    activeBrowsers: Array.from(activeBrowsers.entries()).map(([id, info]) => ({
      profileId: id,
      serialNumber: info.serialNumber,
      launchedAt: new Date(info.launchedAt).toISOString(),
      runningForMs: Date.now() - info.launchedAt,
    })),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
