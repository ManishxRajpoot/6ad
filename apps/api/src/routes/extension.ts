/**
 * Extension API Routes
 *
 * Admin endpoints for managing FacebookAutomationProfile records.
 * Profile data is still useful for admin reference (FB tokens, AdsPower config, etc.)
 */
import { Hono } from 'hono'
import { verifyToken, requireAdmin } from '../middleware/auth.js'
import { randomBytes } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { cdpAutoLogin, startBrowser, CONFIG } from '../services/adspower-worker.js'

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

    const apiKey = '6ad_' + randomBytes(24).toString('hex')

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
    const newKey = '6ad_' + randomBytes(24).toString('hex')
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
 * POST /extension/admin/profiles/:id/cdp-login — Trigger CDP auto-login for a profile
 * Admin only. Launches AdsPower browser and runs login detection + auto-fill.
 */
admin.post('/profiles/:id/cdp-login', async (c) => {
  const id = c.req.param('id')
  try {
    const profile = await prisma.facebookAutomationProfile.findUnique({
      where: { id },
      select: { id: true, label: true, adsPowerSerialNumber: true, isEnabled: true, fbLoginEmail: true },
    })
    if (!profile) return c.json({ error: 'Profile not found' }, 404)
    if (!profile.adsPowerSerialNumber) return c.json({ error: 'No AdsPower serial number' }, 400)
    if (!profile.fbLoginEmail) return c.json({ error: 'No FB login credentials' }, 400)

    const serial = profile.adsPowerSerialNumber
    console.log(`[CDP-Login] Manual trigger for "${profile.label}" (serial=${serial})`)

    // Launch browser
    const launched = await startBrowser(serial)
    if (!launched) return c.json({ error: 'Failed to launch browser', serial }, 500)

    console.log(`[CDP-Login] Browser launched — waiting 15s for load...`)
    await new Promise(r => setTimeout(r, 15000))

    // Run CDP auto-login
    const result = await cdpAutoLogin(serial, profile)
    console.log(`[CDP-Login] Result: ${result}`)

    return c.json({ success: result, profile: profile.label, serial })
  } catch (err: any) {
    console.error(`[CDP-Login] Error:`, err.message)
    return c.json({ error: err.message }, 500)
  }
})

extension.route('/admin', admin)

// ==================== EXTENSION TOKEN ENDPOINT (API key auth) ====================

/**
 * POST /extension/token — Receive captured FB token from Token Harvester extension
 * Auth: X-API-Key header (extensionApiKey from profile)
 */
extension.post('/token', async (c) => {
  try {
    const apiKey = c.req.header('x-api-key')
    if (!apiKey) return c.json({ error: 'Missing X-API-Key header' }, 401)

    const profile = await prisma.facebookAutomationProfile.findFirst({
      where: { extensionApiKey: apiKey, isEnabled: true },
      select: { id: true, label: true, fbAccessToken: true },
    })
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const { token } = await c.req.json()
    if (!token || typeof token !== 'string' || !token.startsWith('EAA') || token.length < 20) {
      return c.json({ error: 'Invalid token format' }, 400)
    }

    // Skip update if token hasn't changed
    if (token === profile.fbAccessToken) {
      await prisma.facebookAutomationProfile.update({
        where: { id: profile.id },
        data: { lastHeartbeatAt: new Date() },
      })
      return c.json({ ok: true, changed: false })
    }

    // Update profile with new token
    const updateData: any = {
      fbAccessToken: token,
      fbTokenCapturedAt: new Date(),
      lastHeartbeatAt: new Date(),
      status: 'IDLE',
    }

    // Fetch FB user info (name + UID) from Graph API using the token
    try {
      const meResp = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(token)}`)
      if (meResp.ok) {
        const me = await meResp.json() as any
        if (me.id) updateData.fbUserId = me.id
        if (me.name) updateData.fbUserName = me.name
        console.log(`[Extension] FB user info for "${profile.label}": ${me.name} (${me.id})`)
      }
    } catch {}

    await prisma.facebookAutomationProfile.update({
      where: { id: profile.id },
      data: updateData,
    })

    console.log(`[Extension] Token captured for "${profile.label}" (${token.substring(0, 10)}...)`)
    return c.json({ ok: true, changed: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== EXTENSION POLL ENDPOINT (API key auth) ====================

/**
 * GET /extension/poll — Extension polls for pending tasks
 * Returns recharge + BM share tasks for this profile's managed accounts.
 */
extension.get('/poll', async (c) => {
  try {
    const apiKey = c.req.header('x-api-key')
    if (!apiKey) return c.json({ error: 'Missing X-API-Key header' }, 401)

    const profile = await prisma.facebookAutomationProfile.findFirst({
      where: { extensionApiKey: apiKey, isEnabled: true },
      select: { id: true, label: true, managedAdAccountIds: true },
    })
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    // Update heartbeat
    await prisma.facebookAutomationProfile.update({
      where: { id: profile.id },
      data: { lastHeartbeatAt: new Date(), status: 'IDLE' },
    })

    const managedIds = profile.managedAdAccountIds || []
    if (managedIds.length === 0) {
      return c.json({ tasks: [], heartbeat: true })
    }

    const tasks: any[] = []

    // Find pending recharges for managed accounts
    const pendingRecharges = await prisma.accountDeposit.findMany({
      where: {
        status: 'APPROVED',
        rechargeStatus: { in: ['PENDING', 'NONE'] },
        rechargeAttempts: { lt: 10 },
        adAccount: { accountId: { in: managedIds } },
      },
      include: {
        adAccount: { select: { accountId: true, accountName: true, platform: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 2,
    })

    for (const dep of pendingRecharges) {
      tasks.push({
        type: 'RECHARGE',
        depositId: dep.id,
        accountId: dep.adAccount.accountId,
        accountName: dep.adAccount.accountName,
        amount: Number(dep.amount),
        applyId: dep.applyId,
      })
    }

    // Find pending BM shares for managed accounts
    const pendingBmShares = await prisma.bmShareRequest.findMany({
      where: {
        status: 'PENDING',
        platform: 'FACEBOOK',
        shareAttempts: { lt: 10 },
        adAccountId: { in: managedIds },
      },
      orderBy: { createdAt: 'asc' },
      take: 2,
    })

    for (const req of pendingBmShares) {
      tasks.push({
        type: 'BM_SHARE',
        requestId: req.id,
        accountId: req.adAccountId,
        accountName: req.adAccountName,
        bmId: req.bmId,
        applyId: req.applyId,
      })
    }

    return c.json({ tasks, heartbeat: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== EXTENSION TASK RESULT ENDPOINT (API key auth) ====================

/**
 * POST /extension/task-result — Extension reports task completion
 */
extension.post('/task-result', async (c) => {
  try {
    const apiKey = c.req.header('x-api-key')
    if (!apiKey) return c.json({ error: 'Missing X-API-Key header' }, 401)

    const profile = await prisma.facebookAutomationProfile.findFirst({
      where: { extensionApiKey: apiKey, isEnabled: true },
      select: { id: true, label: true },
    })
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const { type, depositId, requestId, success, error, data } = await c.req.json()

    if (type === 'RECHARGE' && depositId) {
      if (success) {
        await prisma.accountDeposit.update({
          where: { id: depositId },
          data: {
            rechargeStatus: 'COMPLETED',
            rechargeMethod: 'EXTENSION',
            rechargedAt: new Date(),
            rechargeError: null,
            rechargeAttempts: { increment: 1 },
            previousSpendCap: data?.previousSpendCap ?? null,
            newSpendCap: data?.newSpendCap ?? null,
          },
        })
        console.log(`[Extension] Recharge SUCCESS by "${profile.label}": deposit ${depositId} ($${data?.newSpendCap || '?'})`)
      } else {
        await prisma.accountDeposit.update({
          where: { id: depositId },
          data: {
            rechargeStatus: 'PENDING',
            rechargeAttempts: { increment: 1 },
            rechargeError: `Extension: ${error || 'Unknown error'}`,
          },
        })
        console.log(`[Extension] Recharge FAILED by "${profile.label}": deposit ${depositId} — ${error}`)
      }
      return c.json({ ok: true })
    }

    if (type === 'BM_SHARE' && requestId) {
      if (success) {
        await prisma.bmShareRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            shareMethod: 'EXTENSION',
            approvedAt: new Date(),
            shareError: null,
            shareAttempts: { increment: 1 },
            adminRemarks: `BM share completed by extension worker "${profile.label}"`,
          },
        })
        console.log(`[Extension] BM Share SUCCESS by "${profile.label}": request ${requestId}`)
      } else {
        await prisma.bmShareRequest.update({
          where: { id: requestId },
          data: {
            shareAttempts: { increment: 1 },
            shareError: `Extension: ${error || 'Unknown error'}`,
          },
        })
        console.log(`[Extension] BM Share FAILED by "${profile.label}": request ${requestId} — ${error}`)
      }
      return c.json({ ok: true })
    }

    return c.json({ error: 'Invalid task type or missing ID' }, 400)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default extension
