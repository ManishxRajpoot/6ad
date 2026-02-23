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
import { fetchFacebookOtp } from '../services/imap-reader.js'
import * as OTPAuth from 'otpauth'

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
        fbLoginEmail: true,
        fbLoginPassword: true,
        twoFactorSecret: true,
      }
    })

    return c.json({
      profiles: profiles.map(p => ({
        ...p,
        fbAccessToken: p.fbAccessToken ? 'captured' : null,
        isOnline: p.lastHeartbeatAt && (Date.now() - p.lastHeartbeatAt.getTime()) < 60_000,
        // Return booleans for sensitive fields + email for display
        fbLoginEmail: p.fbLoginEmail || null,
        fbLoginPassword: p.fbLoginPassword ? true : false,
        twoFactorSecret: p.twoFactorSecret ? true : false,
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
    const { label, remarks, isEnabled, adsPowerSerialNumber, adsPowerProfileId, managedAdAccountIds, fbLoginEmail, fbLoginPassword, twoFactorSecret } = await c.req.json()
    const data: any = {}
    if (label !== undefined) data.label = label
    if (remarks !== undefined) data.remarks = remarks
    if (isEnabled !== undefined) data.isEnabled = isEnabled
    if (adsPowerSerialNumber !== undefined) data.adsPowerSerialNumber = adsPowerSerialNumber
    if (adsPowerProfileId !== undefined) data.adsPowerProfileId = adsPowerProfileId
    if (managedAdAccountIds !== undefined) data.managedAdAccountIds = managedAdAccountIds
    if (fbLoginEmail !== undefined) data.fbLoginEmail = fbLoginEmail
    if (fbLoginPassword !== undefined) {
      data.fbLoginPassword = fbLoginPassword
      data.passwordLastUpdatedAt = new Date()
      data.passwordUpdatedBy = c.get('userId')
    }
    if (twoFactorSecret !== undefined) data.twoFactorSecret = twoFactorSecret

    const profile = await prisma.facebookAutomationProfile.update({
      where: { id },
      data,
    })

    // Audit log for password update
    if (fbLoginPassword !== undefined) {
      const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
      await prisma.auditLog.create({
        data: {
          action: 'PASSWORD_UPDATE',
          actorId: c.get('userId'),
          actorRole: c.get('userRole'),
          targetType: 'FacebookAutomationProfile',
          targetId: id,
          details: JSON.stringify({ field: 'fbLoginPassword', profileLabel: profile.label }),
          ipAddress: ip,
        }
      }).catch(() => {})
    }

    return c.json({ profile: { ...profile, fbAccessToken: undefined, fbLoginPassword: profile.fbLoginPassword ? true : false, twoFactorSecret: profile.twoFactorSecret ? true : false } })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/admin/profiles/:id/reveal-password
 * Reveals masked password with audit logging + rate limiting.
 * Body: { field: "fbLoginPassword" | "imapPassword" }
 */
admin.post('/profiles/:id/reveal-password', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user') as any
  try {
    const { field } = await c.req.json()

    if (!['fbLoginPassword', 'imapPassword'].includes(field)) {
      return c.json({ error: 'Invalid field. Must be fbLoginPassword or imapPassword.' }, 400)
    }

    // Rate limit: max 10 reveals per hour per admin
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentReveals = await prisma.auditLog.count({
      where: {
        actorId: user.id,
        action: 'PASSWORD_REVEAL',
        createdAt: { gte: oneHourAgo },
      }
    })
    if (recentReveals >= 10) {
      return c.json({ error: 'Rate limit exceeded. Max 10 password reveals per hour.' }, 429)
    }

    const profile = await prisma.facebookAutomationProfile.findUnique({
      where: { id },
      select: { [field]: true, label: true },
    })
    if (!profile) return c.json({ error: 'Profile not found' }, 404)

    // Audit log
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_REVEAL',
        actorId: user.id,
        actorRole: user.role,
        targetType: 'FacebookAutomationProfile',
        targetId: id,
        details: JSON.stringify({ field, profileLabel: profile.label }),
        ipAddress: ip,
      }
    })

    return c.json({ value: (profile as any)[field] || null })
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
 * POST /extension/profiles/:id/reassign — Bulk reassign all ad accounts to another profile & disable this one
 */
admin.post('/profiles/:id/reassign', async (c) => {
  const sourceProfileId = c.req.param('id')
  try {
    const { targetProfileId } = await c.req.json()

    if (!targetProfileId) {
      return c.json({ error: 'targetProfileId is required' }, 400)
    }
    if (sourceProfileId === targetProfileId) {
      return c.json({ error: 'Source and target profiles cannot be the same' }, 400)
    }

    // Verify source profile exists
    const sourceProfile = await prisma.facebookAutomationProfile.findUnique({
      where: { id: sourceProfileId },
      select: { id: true, label: true },
    })
    if (!sourceProfile) {
      return c.json({ error: 'Source profile not found' }, 404)
    }

    // Verify target profile exists and is enabled
    const targetProfile = await prisma.facebookAutomationProfile.findUnique({
      where: { id: targetProfileId },
      select: { id: true, label: true, isEnabled: true },
    })
    if (!targetProfile) {
      return c.json({ error: 'Target profile not found' }, 404)
    }
    if (!targetProfile.isEnabled) {
      return c.json({ error: 'Target profile is disabled' }, 400)
    }

    // 1. Find linked accounts (for audit log)
    const linkedAccounts = await prisma.adAccount.findMany({
      where: { extensionProfileId: sourceProfileId },
      select: { id: true, accountId: true },
    })

    // 2. Reassign all linked AdAccounts to target profile
    const reassignResult = await prisma.adAccount.updateMany({
      where: { extensionProfileId: sourceProfileId },
      data: { extensionProfileId: targetProfileId },
    })

    // 3. Clear old profile's FB credentials and disable it
    await prisma.facebookAutomationProfile.update({
      where: { id: sourceProfileId },
      data: {
        fbAccessToken: null,
        fbTokenCapturedAt: null,
        fbTokenValidatedAt: null,
        fbUserId: null,
        fbUserName: null,
        status: 'ERROR',
        isEnabled: false,
        managedAdAccountIds: [],
        remarks: `Reassigned ${reassignResult.count} account(s) to "${targetProfile.label}" on ${new Date().toISOString().split('T')[0]}`,
      },
    })

    // 4. Audit log
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    await prisma.auditLog.create({
      data: {
        action: 'PROFILE_REASSIGN',
        actorId: c.get('userId'),
        actorRole: c.get('userRole'),
        targetType: 'FacebookAutomationProfile',
        targetId: sourceProfileId,
        details: JSON.stringify({
          sourceProfileId,
          sourceLabel: sourceProfile.label,
          targetProfileId,
          targetLabel: targetProfile.label,
          reassignedCount: reassignResult.count,
          accountIds: linkedAccounts.map(a => a.accountId),
        }),
        ipAddress: ip,
      },
    }).catch(() => {})

    console.log(`[Extension] Profile reassign: "${sourceProfile.label}" → "${targetProfile.label}" (${reassignResult.count} accounts)`)

    return c.json({
      reassignedCount: reassignResult.count,
      sourceProfile: sourceProfile.label,
      targetProfile: targetProfile.label,
    })
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

    // Warn if profile has no FB token but tasks are pending
    if (!fbAccessToken && (pendingRecharges > 0 || pendingBmShares > 0)) {
      console.warn(`[Extension] ⚠️ Profile "${profile.label}" has NO FB token but ${pendingRecharges} recharges + ${pendingBmShares} BM shares pending — FB may be logged out!`)
    }

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
      data: { status: 'REJECTED', shareError: 'MAX_RETRIES_EXCEEDED: Auto-rejected after 5 failed attempts', rejectedAt: new Date(), adminRemarks: 'Auto-rejected: exceeded max retry attempts' }
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
    // Atomic claim: only succeeds if status is still PENDING
    const result = await prisma.bmShareRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { shareMethod: 'EXTENSION', shareAttempts: { increment: 1 } }
    })
    if (result.count === 0) {
      return c.json({ error: 'BM share already claimed or not available' }, 409)
    }
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
      rechargeAttempts: { lt: 5 },  // Max 5 attempts before giving up
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
    // Atomic claim: only succeeds if status is still PENDING/NONE (prevents double-claiming)
    const result = await prisma.accountDeposit.updateMany({
      where: {
        id,
        rechargeStatus: { in: ['PENDING', 'NONE'] },
      },
      data: {
        rechargeStatus: 'IN_PROGRESS',
        rechargeMethod: 'EXTENSION',
        rechargeAttempts: { increment: 1 },
      }
    })
    if (result.count === 0) {
      return c.json({ error: 'Task already claimed or not available' }, 409)
    }
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

extension.post('/recharge/:id/complete', verifyExtensionKey, async (c) => {
  const id = c.req.param('id')
  try {
    // State guard: only complete tasks that are IN_PROGRESS
    const result = await prisma.accountDeposit.updateMany({
      where: { id, rechargeStatus: 'IN_PROGRESS' },
      data: {
        rechargeStatus: 'COMPLETED',
        rechargeMethod: 'EXTENSION',
        rechargedAt: new Date(),
        rechargedBy: 'extension',
        rechargeError: null,
      }
    })
    if (result.count === 0) {
      return c.json({ error: 'Task not in progress — cannot complete' }, 409)
    }
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
    // State guard: only fail tasks that are IN_PROGRESS
    const result = await prisma.accountDeposit.updateMany({
      where: { id, rechargeStatus: 'IN_PROGRESS' },
      data: {
        rechargeStatus: 'FAILED',
        rechargeError: errorMsg,
      }
    })
    if (result.count === 0) {
      return c.json({ error: 'Task not in progress — cannot mark failed' }, 409)
    }
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== AUTO-LOGIN SUPPORT ====================

// GET /extension/login-credentials - Get FB login credentials for auto-re-login
extension.get('/login-credentials', verifyExtensionKey, async (c) => {
  try {
    const profile = c.get('extensionProfile')
    const data = await prisma.facebookAutomationProfile.findUnique({
      where: { id: profile.id },
      select: {
        fbLoginEmail: true,
        fbLoginPassword: true,
        twoFactorSecret: true,
        imapHost: true,
        imapUser: true,
        imapPassword: true,
      },
    })

    if (!data?.fbLoginEmail || !data?.fbLoginPassword) {
      return c.json({ error: 'No login credentials configured for this profile' }, 404)
    }

    return c.json({
      email: data.fbLoginEmail,
      password: data.fbLoginPassword,
      has2fa: !!data.twoFactorSecret,
      hasImap: !!(data.imapHost && data.imapUser && data.imapPassword),
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// POST /extension/fetch-otp - Fetch Facebook OTP code via IMAP
extension.post('/fetch-otp', verifyExtensionKey, async (c) => {
  try {
    const profile = c.get('extensionProfile')
    const data = await prisma.facebookAutomationProfile.findUnique({
      where: { id: profile.id },
      select: {
        label: true,
        imapHost: true,
        imapPort: true,
        imapUser: true,
        imapPassword: true,
        imapSecure: true,
      },
    })

    if (!data?.imapHost || !data?.imapUser || !data?.imapPassword) {
      return c.json({ error: 'No IMAP credentials configured for this profile' }, 404)
    }

    console.log(`[Auto-Login] Fetching OTP for profile "${data.label}" via ${data.imapHost}`)

    const otp = await fetchFacebookOtp({
      host: data.imapHost,
      port: data.imapPort || 993,
      user: data.imapUser,
      password: data.imapPassword,
      secure: data.imapSecure ?? true,
    }, 60_000) // 60s max wait for OTP

    if (!otp) {
      console.warn(`[Auto-Login] OTP not found for profile "${data.label}"`)
      return c.json({ error: 'OTP not received within timeout', otp: null })
    }

    console.log(`[Auto-Login] OTP found for profile "${data.label}": ${otp}`)
    return c.json({ otp })
  } catch (err: any) {
    console.error('[Auto-Login] Fetch OTP error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

// GET /extension/generate-2fa - Generate TOTP 2FA code from stored secret
extension.get('/generate-2fa', verifyExtensionKey, async (c) => {
  try {
    const profile = c.get('extensionProfile')
    const data = await prisma.facebookAutomationProfile.findUnique({
      where: { id: profile.id },
      select: { label: true, twoFactorSecret: true },
    })

    if (!data?.twoFactorSecret) {
      return c.json({ error: 'No 2FA secret configured for this profile' }, 404)
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'Facebook',
      label: data.label || 'FB',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(data.twoFactorSecret),
    })

    const code = totp.generate()
    const remaining = 30 - (Math.floor(Date.now() / 1000) % 30)

    console.log(`[Auto-Login] Generated 2FA code for profile "${data.label}": ${code} (${remaining}s remaining)`)
    return c.json({ code, remaining })
  } catch (err: any) {
    console.error('[Auto-Login] Generate 2FA error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

export default extension
