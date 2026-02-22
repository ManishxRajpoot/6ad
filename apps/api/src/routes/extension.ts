/**
 * Extension API Routes
 *
 * Multi-profile extension management.
 * Each extension profile has its own API key (extensionApiKey on FacebookAutomationProfile).
 * The Chrome extension sends X-Extension-Key header, server matches to profile.
 *
 * Admin endpoints (JWT auth): CRUD profiles, generate keys
 * Extension endpoints (API key auth): heartbeat, pending tasks, claim/complete/fail
 */
import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { verifyToken, requireAdmin } from '../middleware/auth.js'
import { randomBytes } from 'crypto'
import { getWorkerStatus } from '../services/adspower-worker.js'

const prisma = new PrismaClient()
const extension = new Hono()

// ==================== ADMIN ENDPOINTS (JWT auth) ====================

const admin = new Hono()
admin.use('*', verifyToken)
admin.use('*', requireAdmin)

/**
 * GET /extension/admin/profiles — List all extension profiles
 */
admin.get('/profiles', async (c) => {
  try {
    const profiles = await prisma.facebookAutomationProfile.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        fbUserId: true,
        fbUserName: true,
        extensionApiKey: true,
        lastHeartbeatAt: true,
        fbAccessToken: true,
        fbTokenCapturedAt: true,
        status: true,
        isEnabled: true,
        remarks: true,
        managedAdAccountIds: true,
        adsPowerSerialNumber: true,
        adsPowerProfileId: true,
        createdAt: true,
      }
    })

    return c.json({
      profiles: profiles.map(p => ({
        ...p,
        fbAccessToken: p.fbAccessToken ? 'captured' : null,
        isOnline: p.lastHeartbeatAt && (Date.now() - p.lastHeartbeatAt.getTime()) < 60_000,
      }))
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/profiles — Create new extension profile
 */
admin.post('/profiles', async (c) => {
  try {
    const { label, remarks, adsPowerSerialNumber, adsPowerProfileId, managedAdAccountIds } = await c.req.json()
    if (!label) return c.json({ error: 'Label is required' }, 400)

    const apiKey = 'ext_' + randomBytes(24).toString('hex')

    const profile = await prisma.facebookAutomationProfile.create({
      data: {
        label,
        remarks: remarks || null,
        extensionApiKey: apiKey,
        status: 'IDLE',
        isEnabled: true,
        adsPowerSerialNumber: adsPowerSerialNumber || null,
        adsPowerProfileId: adsPowerProfileId || null,
        managedAdAccountIds: managedAdAccountIds || [],
      }
    })

    return c.json({ profile: { ...profile, fbAccessToken: undefined } }, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * PATCH /extension/profiles/:id — Update profile label/remarks
 */
admin.patch('/profiles/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const { label, remarks, isEnabled, adsPowerSerialNumber, adsPowerProfileId, managedAdAccountIds } = await c.req.json()
    const data: any = {}
    if (label !== undefined) data.label = label
    if (remarks !== undefined) data.remarks = remarks
    if (isEnabled !== undefined) data.isEnabled = isEnabled
    if (adsPowerSerialNumber !== undefined) data.adsPowerSerialNumber = adsPowerSerialNumber
    if (adsPowerProfileId !== undefined) data.adsPowerProfileId = adsPowerProfileId
    if (managedAdAccountIds !== undefined) data.managedAdAccountIds = managedAdAccountIds

    const profile = await prisma.facebookAutomationProfile.update({
      where: { id },
      data,
    })
    return c.json({ profile: { ...profile, fbAccessToken: undefined } })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * DELETE /extension/profiles/:id — Delete profile
 */
admin.delete('/profiles/:id', async (c) => {
  const id = c.req.param('id')
  try {
    await prisma.facebookAutomationProfile.delete({ where: { id } })
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/profiles/:id/regenerate-key — Generate new API key for profile
 */
admin.post('/profiles/:id/regenerate-key', async (c) => {
  const id = c.req.param('id')
  try {
    const newKey = 'ext_' + randomBytes(24).toString('hex')
    const profile = await prisma.facebookAutomationProfile.update({
      where: { id },
      data: { extensionApiKey: newKey },
    })
    return c.json({ apiKey: newKey })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * GET /extension/admin/adspower-status — Get AdsPower worker status
 */
admin.get('/adspower-status', async (c) => {
  try {
    const status = getWorkerStatus()
    const { recharges, bmShares } = await getPendingTaskCountsForAdmin()
    return c.json({ ...status, pendingRecharges: recharges, pendingBmShares: bmShares })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

async function getPendingTaskCountsForAdmin() {
  const [recharges, bmShares] = await Promise.all([
    prisma.accountDeposit.count({
      where: { status: 'APPROVED', rechargeStatus: { in: ['PENDING', 'NONE'] } }
    }).catch(() => 0),
    prisma.bmShareRequest.count({
      where: { status: 'PENDING', platform: 'FACEBOOK', shareAttempts: { lt: 5 } }
    }).catch(() => 0),
  ])
  return { recharges, bmShares }
}

extension.route('/admin', admin)

// ==================== EXTENSION ENDPOINTS (API key auth) ====================

/**
 * Middleware: Find profile by X-Extension-Key header
 */
async function verifyExtensionKey(c: any, next: any) {
  const key = c.req.header('X-Extension-Key')
  if (!key) {
    return c.json({ error: 'Missing X-Extension-Key header' }, 401)
  }

  // Find profile with this API key
  const profile = await prisma.facebookAutomationProfile.findFirst({
    where: { extensionApiKey: key, isEnabled: true },
  })

  if (!profile) {
    return c.json({ error: 'Invalid extension key' }, 401)
  }

  // Store profile in context for downstream handlers
  c.set('extensionProfile', profile)
  await next()
}

/**
 * POST /extension/heartbeat
 * Extension sends this every 10 seconds with the latest FB access token.
 */
extension.post('/heartbeat', verifyExtensionKey, async (c) => {
  try {
    const profile = c.get('extensionProfile')
    const body = await c.req.json()
    const { fbAccessToken, fbUserId, fbUserName, adAccountIds } = body

    // Update profile with heartbeat data
    const updateData: any = {
      lastHeartbeatAt: new Date(),
      status: 'ACTIVE',
    }

    if (fbUserId) updateData.fbUserId = fbUserId
    if (fbUserName) updateData.fbUserName = fbUserName

    if (fbAccessToken) {
      updateData.fbAccessToken = fbAccessToken
      updateData.fbTokenCapturedAt = new Date()
      updateData.fbTokenValidatedAt = new Date()
    }

    // Store ad account IDs this profile has access to (for smart task routing)
    if (adAccountIds && Array.isArray(adAccountIds) && adAccountIds.length > 0) {
      updateData.managedAdAccountIds = adAccountIds
    }

    await prisma.facebookAutomationProfile.update({
      where: { id: profile.id },
      data: updateData,
    })

    // Count pending items for the extension to process
    const [pendingRecharges, pendingBmShares] = await Promise.all([
      prisma.accountDeposit.count({
        where: {
          status: 'APPROVED',
          rechargeStatus: { in: ['PENDING', 'NONE'] },
        }
      }).catch(() => 0),
      prisma.bmShareRequest.count({
        where: {
          status: 'PENDING',
          platform: 'FACEBOOK',
        }
      }).catch(() => 0),
    ])

    return c.json({
      ok: true,
      profileId: profile.id,
      pendingCount: pendingRecharges,
      pendingBmShareCount: pendingBmShares,
    })
  } catch (err: any) {
    console.error('[Extension] Heartbeat error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

// ==================== BM SHARE ====================

extension.get('/pending-bm-shares', verifyExtensionKey, async (c) => {
  try {
    const profile = c.get('extensionProfile')
    const managedIds = profile.managedAdAccountIds || []

    // Auto-reject requests that have failed too many times
    await prisma.bmShareRequest.updateMany({
      where: { status: 'PENDING', shareAttempts: { gte: 5 } },
      data: { status: 'REJECTED', adminRemarks: 'Auto-rejected: exceeded max retry attempts' }
    }).catch(() => {})

    // Build filter: only return tasks for ad accounts this profile manages
    const whereClause: any = {
      status: 'PENDING',
      platform: 'FACEBOOK',
      shareAttempts: { lt: 5 },
    }
    if (managedIds.length > 0) {
      whereClause.adAccountId = { in: managedIds }
    }

    const shares = await prisma.bmShareRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: {
        id: true,
        adAccountId: true,
        adAccountName: true,
        bmId: true,
        user: { select: { username: true } },
      }
    })

    // Look up sourceBmId for each ad account (the owner's BM)
    const bmShares = await Promise.all(shares.map(async (s) => {
      let ownerBmId: string | null = null
      try {
        const adAccount = await prisma.adAccount.findFirst({
          where: { accountId: s.adAccountId },
          select: { sourceBmId: true, bmId: true }
        })
        ownerBmId = adAccount?.sourceBmId || adAccount?.bmId || null
      } catch {}

      return {
        requestId: s.id,
        adAccountId: s.adAccountId,
        adAccountName: s.adAccountName,
        userBmId: s.bmId,
        ownerBmId,
        username: s.user?.username || 'unknown',
      }
    }))

    return c.json({ bmShares })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

extension.post('/bm-share/:id/claim', verifyExtensionKey, async (c) => {
  const id = c.req.param('id')
  try {
    await prisma.bmShareRequest.update({
      where: { id },
      data: { shareMethod: 'EXTENSION', shareAttempts: { increment: 1 } }
    })
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

extension.post('/bm-share/:id/complete', verifyExtensionKey, async (c) => {
  const id = c.req.param('id')
  const profile = c.get('extensionProfile')
  try {
    await prisma.bmShareRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        shareMethod: 'EXTENSION',
        approvedAt: new Date(),
        shareError: null,
        adminRemarks: `BM share completed via Chrome extension (${profile.label}).`,
      }
    })
    console.log(`[Extension] BM share completed: ${id} by ${profile.label}`)
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

extension.post('/bm-share/:id/failed', verifyExtensionKey, async (c) => {
  const id = c.req.param('id')
  try {
    const body = await c.req.json().catch(() => ({}))
    await prisma.bmShareRequest.update({
      where: { id },
      data: {
        shareError: body.error || 'Extension BM share failed',
        shareAttempts: { increment: 1 },
      }
    })
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== RECHARGES ====================

extension.get('/pending-recharges', verifyExtensionKey, async (c) => {
  try {
    const profile = c.get('extensionProfile')
    const managedIds = profile.managedAdAccountIds || []

    // Build filter: only return tasks for ad accounts this profile manages
    const whereClause: any = {
      status: 'APPROVED',
      rechargeStatus: { in: ['PENDING', 'NONE'] },
    }
    if (managedIds.length > 0) {
      whereClause.adAccount = { accountId: { in: managedIds } }
    }

    const deposits = await prisma.accountDeposit.findMany({
      where: whereClause,
      orderBy: { approvedAt: 'asc' },
      take: 5,
      include: {
        adAccount: { select: { accountId: true, accountName: true } },
      }
    })

    return c.json({
      recharges: deposits.map(d => ({
        depositId: d.id,
        adAccountId: d.adAccount?.accountId || d.adAccountId,
        adAccountName: d.adAccount?.accountName || '',
        amount: d.amount,
        approvedAt: d.approvedAt,
      }))
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

extension.post('/recharge/:id/claim', verifyExtensionKey, async (c) => {
  const id = c.req.param('id')
  try {
    await prisma.accountDeposit.update({
      where: { id },
      data: {
        rechargeStatus: 'IN_PROGRESS',
        rechargeMethod: 'EXTENSION',
        rechargeAttempts: { increment: 1 },
      }
    })
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

extension.post('/recharge/:id/complete', verifyExtensionKey, async (c) => {
  const id = c.req.param('id')
  try {
    await prisma.accountDeposit.update({
      where: { id },
      data: {
        rechargeStatus: 'COMPLETED',
        rechargeMethod: 'EXTENSION',
        rechargedAt: new Date(),
        rechargedBy: 'extension',
        rechargeError: null,
      }
    })
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

extension.post('/recharge/:id/failed', verifyExtensionKey, async (c) => {
  const id = c.req.param('id')
  try {
    const body = await c.req.json().catch(() => ({}))
    const errorMsg = body.error || 'Extension recharge failed'
    console.error(`[Recharge Failed] Deposit ${id}: ${errorMsg}`)
    await prisma.accountDeposit.update({
      where: { id },
      data: {
        rechargeStatus: 'FAILED',
        rechargeError: errorMsg,
      }
    })
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default extension
