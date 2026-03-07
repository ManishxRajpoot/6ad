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

// ==================== AUTH HELPER (accepts both X-Extension-Key and x-api-key) ====================

async function getProfileByKey(c: any, selectFields?: any) {
  const apiKey = c.req.header('x-extension-key') || c.req.header('X-Extension-Key') || c.req.header('x-api-key')
  if (!apiKey) return null
  return prisma.facebookAutomationProfile.findFirst({
    where: { extensionApiKey: apiKey, isEnabled: true },
    select: selectFields || { id: true, label: true, managedAdAccountIds: true, fbAccessToken: true, fbTokenCapturedAt: true },
  })
}

// ==================== EXTENSION HEARTBEAT (v3 extension uses this) ====================

/**
 * POST /extension/heartbeat — Main polling endpoint for v3 extension
 * Auth: X-Extension-Key header
 * Body: { adAccountIds, fbUserId, fbUserName, fbAccessToken }
 * Returns: { pendingCount, pendingBmShareCount, jobs, profileLabel, profileAdAccountIds, nextPollMs, tokenRefreshNeeded }
 */
extension.post('/heartbeat', async (c) => {
  try {
    const profile = await getProfileByKey(c, {
      id: true, label: true, managedAdAccountIds: true,
      fbAccessToken: true, fbTokenCapturedAt: true, fbTokenValidatedAt: true, fbUserName: true,
    })
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const body = await c.req.json().catch(() => ({}))
    const { adAccountIds, fbUserId, fbUserName, fbAccessToken } = body as any

    // Update heartbeat + any provided data (token saved AFTER validation below)
    const updateData: any = { lastHeartbeatAt: new Date(), status: 'IDLE' }
    if (adAccountIds && Array.isArray(adAccountIds) && adAccountIds.length > 0) {
      updateData.managedAdAccountIds = adAccountIds
    }
    if (fbUserId) updateData.fbUserId = fbUserId
    if (fbUserName) updateData.fbUserName = fbUserName
    // NOTE: fbAccessToken is NOT saved here — saved after validation to prevent re-saving invalid tokens

    await prisma.facebookAutomationProfile.update({ where: { id: profile.id }, data: updateData })

    // Get managed account IDs (prefer freshly sent ones, fallback to stored)
    const managedIds = (adAccountIds && adAccountIds.length > 0) ? adAccountIds : (profile.managedAdAccountIds || [])

    // Count linked ad accounts in DB
    const linkedAdAccountCount = await prisma.adAccount.count({
      where: { extensionProfileId: profile.id },
    }).catch(() => 0)

    // Build jobs array from pending tasks
    const jobs: any[] = []
    let pendingCount = 0
    let pendingBmShareCount = 0

    if (managedIds.length > 0) {
      // Pending recharges (include FAILED so extension can retry server-side failures)
      const pendingRecharges = await prisma.accountDeposit.findMany({
        where: {
          status: 'PENDING',
          rechargeStatus: { in: ['PENDING', 'NONE', 'FAILED'] },
          rechargeAttempts: { lt: 10 },
          adAccount: { accountId: { in: managedIds } },
        },
        include: { adAccount: { select: { accountId: true, accountName: true } } },
        orderBy: { createdAt: 'asc' },
        take: 3,
      })

      pendingCount = pendingRecharges.length
      for (const dep of pendingRecharges) {
        jobs.push({
          jobId: dep.id,
          type: 'RECHARGE',
          priority: 10,
          payload: {
            depositId: dep.id,
            fbAdAccountId: dep.adAccount.accountId,
            amount: Number(dep.amount).toString(),
            accountName: dep.adAccount.accountName,
          },
        })
      }
    }

    // Pending BM shares — only for ad accounts assigned to THIS profile (via extensionProfileId)
    const assignedAccounts = await prisma.adAccount.findMany({
      where: { extensionProfileId: profile.id },
      select: { accountId: true },
    })
    const assignedAccountIds = assignedAccounts.map((a: any) => a.accountId)

    if (assignedAccountIds.length > 0) {
      const pendingBmShares = await prisma.bmShareRequest.findMany({
        where: {
          status: 'PENDING',
          platform: 'FACEBOOK',
          shareAttempts: { lt: 10 },
          adAccountId: { in: assignedAccountIds },
          NOT: { shareMethod: 'EXTENSION', shareError: null },
        },
        orderBy: { createdAt: 'asc' },
        take: 3,
      })

      pendingBmShareCount = pendingBmShares.length
      for (const req of pendingBmShares) {
        jobs.push({
          jobId: req.id,
          type: 'BM_SHARE',
          priority: 5,
          payload: {
            requestId: req.id,
            adAccountId: req.adAccountId,
            userBmId: req.bmId,
            ownerBmId: null,
            username: req.adAccountName || 'Unknown',
          },
        })
      }
    }

    // Token handling: Extension validates tokens in-browser via /me/adaccounts before sending.
    // Server TRUSTS extension's validation — server can't re-validate because tokens are session/IP-bound.
    let tokenInvalid = false
    let tokenRefreshNeeded = false

    const incomingToken = fbAccessToken && typeof fbAccessToken === 'string' && fbAccessToken.startsWith('EAA') ? fbAccessToken : null
    const isNewToken = incomingToken && incomingToken !== profile.fbAccessToken

    // Save new incoming token (already validated by extension via /me/adaccounts)
    if (isNewToken) {
      console.log(`[Extension] New token from "${profile.label}" (len=${incomingToken!.length}) — saving (extension-validated)`)
      await prisma.facebookAutomationProfile.update({
        where: { id: profile.id },
        data: { fbAccessToken: incomingToken, fbTokenCapturedAt: new Date(), fbTokenValidatedAt: new Date() },
      }).catch(() => {})
    }

    const currentToken = isNewToken ? incomingToken : profile.fbAccessToken
    if (!currentToken) {
      tokenRefreshNeeded = true
    }

    // Adaptive polling: faster when tasks pending, slower when idle
    const nextPollMs = (pendingCount > 0 || pendingBmShareCount > 0) ? 8000 : 15000

    // Build profile-level ad account IDs (from DB linked accounts)
    const linkedAccounts = await prisma.adAccount.findMany({
      where: { extensionProfileId: profile.id },
      select: { accountId: true },
    }).catch(() => [] as any[])
    const profileAdAccountIds = linkedAccounts.map((a: any) => a.accountId)

    return c.json({
      pendingCount: tokenInvalid ? 0 : pendingCount,
      pendingBmShareCount: tokenInvalid ? 0 : pendingBmShareCount,
      jobs,
      profileLabel: profile.label,
      profileAdAccountIds,
      linkedAdAccountCount,
      nextPollMs,
      tokenRefreshNeeded,
      tokenInvalid,
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== FUNDING SOURCES (VCard detection) ====================

/**
 * POST /extension/funding-sources
 * Auth: X-Extension-Key header
 * Body: { fundingSources: { [accountId]: [{id, display}] } }
 * Updates fundingSources JSON on each AdAccount
 */
extension.post('/funding-sources', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const { fundingSources } = await c.req.json()
    if (!fundingSources || typeof fundingSources !== 'object') {
      return c.json({ error: 'fundingSources object required' }, 400)
    }

    const entries = Object.entries(fundingSources)
    let updated = 0

    for (const [accountId, cards] of entries) {
      try {
        await prisma.adAccount.updateMany({
          where: { accountId: String(accountId) },
          data: {
            fundingSources: JSON.stringify(cards),
            fundingSourceUpdatedAt: new Date(),
          },
        })
        updated++
      } catch (err: any) {
        // Individual account failure is non-fatal
        console.log(`[Extension] Failed to update funding sources for ${accountId}:`, err.message)
      }
    }

    console.log(`[Extension] Funding sources updated for ${updated}/${entries.length} accounts`)
    return c.json({ updated, total: entries.length })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== LEGACY RECHARGE ENDPOINTS (v3 extension uses these as fallback) ====================

/**
 * GET /extension/pending-recharges
 */
extension.get('/pending-recharges', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const managedIds = profile.managedAdAccountIds || []
    if (managedIds.length === 0) return c.json({ recharges: [] })

    const pendingRecharges = await prisma.accountDeposit.findMany({
      where: {
        status: 'PENDING',
        rechargeStatus: { in: ['PENDING', 'NONE', 'FAILED'] },
        rechargeAttempts: { lt: 10 },
        adAccount: { accountId: { in: managedIds }, sourceBmId: { not: 'cheetah' } },
      },
      include: { adAccount: { select: { accountId: true, accountName: true } } },
      orderBy: { createdAt: 'asc' },
      take: 5,
    })

    return c.json({
      recharges: pendingRecharges.map(dep => ({
        depositId: dep.id,
        adAccountId: dep.adAccount.accountId,
        accountName: dep.adAccount.accountName,
        amount: Number(dep.amount),
      }))
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/recharge/:id/claim
 */
extension.post('/recharge/:id/claim', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const depositId = c.req.param('id')
    await prisma.accountDeposit.update({
      where: { id: depositId },
      data: { rechargeStatus: 'IN_PROGRESS' },
    })
    console.log(`[Extension] Recharge claimed by "${profile.label}": ${depositId}`)
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/recharge/:id/complete
 */
extension.post('/recharge/:id/complete', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const depositId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const { previousSpendCap, newSpendCap, fbAccessToken: tokenUsed } = body as any

    await prisma.accountDeposit.update({
      where: { id: depositId },
      data: {
        rechargeStatus: 'VERIFYING',
        rechargeMethod: 'EXTENSION',
        rechargedAt: new Date(),
        rechargeError: null,
        rechargeAttempts: { increment: 1 },
        previousSpendCap: previousSpendCap ?? null,
        newSpendCap: newSpendCap ?? null,
      },
    })

    // Update profile token if provided
    if (tokenUsed && typeof tokenUsed === 'string' && tokenUsed.startsWith('EAA')) {
      await prisma.facebookAutomationProfile.update({
        where: { id: profile.id },
        data: { fbAccessToken: tokenUsed, fbTokenCapturedAt: new Date() },
      }).catch(() => {})
    }

    console.log(`[Extension] Recharge SUCCESS by "${profile.label}": ${depositId} (cap $${previousSpendCap} → $${newSpendCap}) — awaiting verification`)
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/recharge/:id/failed
 */
extension.post('/recharge/:id/failed', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const depositId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const { error: errorMsg } = body as any

    await prisma.accountDeposit.update({
      where: { id: depositId },
      data: {
        rechargeStatus: 'FAILED',
        rechargeAttempts: { increment: 1 },
        rechargeError: `Extension (${profile.label}): ${errorMsg || 'Unknown error'}`,
      },
    })
    console.log(`[Extension] Recharge FAILED by "${profile.label}": ${depositId} — ${errorMsg}`)
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== LEGACY BM SHARE ENDPOINTS ====================

/**
 * GET /extension/pending-bm-shares
 */
extension.get('/pending-bm-shares', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const managedIds = profile.managedAdAccountIds || []
    if (managedIds.length === 0) return c.json({ bmShares: [] })

    const pendingBmShares = await prisma.bmShareRequest.findMany({
      where: {
        status: 'PENDING',
        platform: 'FACEBOOK',
        shareAttempts: { lt: 10 },
        adAccountId: { in: managedIds },
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
    })

    return c.json({
      bmShares: pendingBmShares.map(req => ({
        requestId: req.id,
        adAccountId: req.adAccountId,
        userBmId: req.bmId,
        ownerBmId: null,
        username: req.adAccountName || 'Unknown',
      }))
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/bm-share/:id/claim
 */
extension.post('/bm-share/:id/claim', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const requestId = c.req.param('id')
    // TransactionStatus has no IN_PROGRESS — mark claimed via shareMethod
    await prisma.bmShareRequest.update({
      where: { id: requestId },
      data: { shareMethod: 'EXTENSION', shareError: null },
    }).catch(() => {})
    console.log(`[Extension] BM Share claimed by "${profile.label}": ${requestId}`)
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/bm-share/:id/complete
 */
extension.post('/bm-share/:id/complete', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const requestId = c.req.param('id')
    await prisma.bmShareRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        shareMethod: 'EXTENSION',
        approvedAt: new Date(),
        shareError: null,
        shareAttempts: { increment: 1 },
        adminRemarks: `BM share completed by extension "${profile.label}"`,
      },
    })
    console.log(`[Extension] BM Share SUCCESS by "${profile.label}": ${requestId}`)
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/bm-share/:id/failed
 */
extension.post('/bm-share/:id/failed', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const requestId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const { error: errorMsg } = body as any

    // Check if the error indicates the BM is already shared (duplicate)
    const lower = (errorMsg || '').toLowerCase()
    const isDuplicate = lower.includes('duplicate') ||
      lower.includes('already claimed') ||
      lower.includes('already has access') ||
      lower.includes('already exists') ||
      lower.includes('already been added') ||
      lower.includes('already associated') ||
      lower.includes('already shared') ||
      lower.includes('already assigned') ||
      lower.includes('already a member') ||
      lower.includes('has already been') ||
      lower.includes('relationship already exists')

    if (isDuplicate) {
      // Auto-approve — BM is already shared on Facebook's side
      await prisma.bmShareRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          shareMethod: 'EXTENSION',
          approvedAt: new Date(),
          adminRemarks: 'Auto-approved: BM already shared (duplicate detected from FB response).',
          shareError: null,
        },
      })
      console.log(`[Extension] BM Share auto-APPROVED (duplicate) by "${profile.label}": ${requestId} — ${errorMsg}`)
      return c.json({ ok: true, autoApproved: true })
    }

    await prisma.bmShareRequest.update({
      where: { id: requestId },
      data: {
        shareAttempts: { increment: 1 },
        shareError: `Extension (${profile.label}): ${errorMsg || 'Unknown error'}`,
      },
    })
    console.log(`[Extension] BM Share FAILED by "${profile.label}": ${requestId} — ${errorMsg}`)
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== JOB ENDPOINTS (unified job processing from heartbeat) ====================

/**
 * POST /extension/job/:id/claim — Claim a job (could be recharge or BM share)
 */
extension.post('/job/:id/claim', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const jobId = c.req.param('id')

    // Try as deposit first
    const deposit = await prisma.accountDeposit.findUnique({ where: { id: jobId } }).catch(() => null)
    if (deposit) {
      if (deposit.rechargeStatus === 'IN_PROGRESS') {
        return c.json({ error: 'Already claimed' }, 409)
      }
      await prisma.accountDeposit.update({
        where: { id: jobId },
        data: { rechargeStatus: 'IN_PROGRESS' },
      })
      console.log(`[Extension] Job claimed (RECHARGE) by "${profile.label}": ${jobId}`)
      return c.json({ ok: true })
    }

    // Try as BM share
    const bmShare = await prisma.bmShareRequest.findUnique({ where: { id: jobId } }).catch(() => null)
    if (bmShare) {
      if (bmShare.shareMethod === 'EXTENSION' && bmShare.status === 'PENDING') {
        return c.json({ error: 'Already claimed' }, 409)
      }
      await prisma.bmShareRequest.update({
        where: { id: jobId },
        data: { shareMethod: 'EXTENSION', shareError: null },
      })
      console.log(`[Extension] Job claimed (BM_SHARE) by "${profile.label}": ${jobId}`)
      return c.json({ ok: true })
    }

    return c.json({ error: 'Job not found' }, 404)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/job/:id/complete — Complete a job
 */
extension.post('/job/:id/complete', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const jobId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const { result } = body as any

    // Try as deposit first
    const deposit = await prisma.accountDeposit.findUnique({ where: { id: jobId } }).catch(() => null)
    if (deposit) {
      await prisma.accountDeposit.update({
        where: { id: jobId },
        data: {
          rechargeStatus: 'VERIFYING',
          rechargeMethod: 'EXTENSION',
          rechargedAt: new Date(),
          rechargeError: null,
          rechargeAttempts: { increment: 1 },
          previousSpendCap: result?.previousSpendCap ?? null,
          newSpendCap: result?.newSpendCap ?? null,
        },
      })
      console.log(`[Extension] Job complete (RECHARGE) by "${profile.label}": ${jobId} (cap → $${result?.newSpendCap}) — awaiting verification`)
      return c.json({ ok: true })
    }

    // Try as BM share
    const bmShare = await prisma.bmShareRequest.findUnique({ where: { id: jobId } }).catch(() => null)
    if (bmShare) {
      await prisma.bmShareRequest.update({
        where: { id: jobId },
        data: {
          status: 'APPROVED',
          shareMethod: 'EXTENSION',
          approvedAt: new Date(),
          shareError: null,
          shareAttempts: { increment: 1 },
          adminRemarks: result?.bmName
            ? `Done — shared to ${result.bmName}`
            : `BM share via ${result?.method || 'extension'} by "${profile.label}"`,
        },
      })
      console.log(`[Extension] Job complete (BM_SHARE) by "${profile.label}": ${jobId}`)
      return c.json({ ok: true })
    }

    return c.json({ error: 'Job not found' }, 404)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

/**
 * POST /extension/job/:id/failed — Report job failure
 */
extension.post('/job/:id/failed', async (c) => {
  try {
    const profile = await getProfileByKey(c)
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const jobId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const { error: errorMsg, shouldRetry } = body as any

    // Try as deposit first
    const deposit = await prisma.accountDeposit.findUnique({ where: { id: jobId } }).catch(() => null)
    if (deposit) {
      await prisma.accountDeposit.update({
        where: { id: jobId },
        data: {
          rechargeStatus: shouldRetry ? 'PENDING' : 'FAILED',
          rechargeAttempts: { increment: 1 },
          rechargeError: `Extension (${profile.label}): ${errorMsg || 'Unknown error'}`,
        },
      })
      console.log(`[Extension] Job failed (RECHARGE) by "${profile.label}": ${jobId} — ${errorMsg}`)
      return c.json({ ok: true })
    }

    // Try as BM share
    const bmShare = await prisma.bmShareRequest.findUnique({ where: { id: jobId } }).catch(() => null)
    if (bmShare) {
      await prisma.bmShareRequest.update({
        where: { id: jobId },
        data: {
          shareAttempts: { increment: 1 },
          shareError: `Extension (${profile.label}): ${errorMsg || 'Unknown error'}`,
          // Keep shareMethod as MANUAL so BmShareCron doesn't re-try Cheetah
          // Heartbeat will still pick it up for extension retry
          ...(shouldRetry ? { shareMethod: 'MANUAL' } : { status: 'REJECTED' }),
        },
      })
      console.log(`[Extension] Job failed (BM_SHARE) by "${profile.label}": ${jobId} — ${errorMsg}`)
      return c.json({ ok: true })
    }

    return c.json({ error: 'Job not found' }, 404)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== EXTENSION TOKEN ENDPOINT (API key auth) ====================

/**
 * POST /extension/token — Receive captured FB token from Token Harvester extension
 * Auth: X-API-Key header (extensionApiKey from profile)
 */
extension.post('/token', async (c) => {
  try {
    const profile = await getProfileByKey(c, { id: true, label: true, fbAccessToken: true })
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
    const profile = await getProfileByKey(c, { id: true, label: true, managedAdAccountIds: true })
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

    // Pick up PENDING deposits for recharge. After recharge → system verifies spending cap → APPROVED or REJECTED.
    const pendingRecharges = await prisma.accountDeposit.findMany({
      where: {
        status: 'PENDING',
        rechargeStatus: { in: ['PENDING', 'NONE', 'FAILED'] },
        rechargeAttempts: { lt: 10 },
        adAccount: { accountId: { in: managedIds }, sourceBmId: { not: 'cheetah' } },
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
    const profile = await getProfileByKey(c, { id: true, label: true })
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    const { type, depositId, requestId, success, error, data } = await c.req.json()

    if (type === 'RECHARGE' && depositId) {
      if (success) {
        // Extension says recharge done — mark VERIFYING (don't trust blindly)
        // Spend-cap-verifier cron will confirm the actual cap on Facebook
        await prisma.accountDeposit.update({
          where: { id: depositId },
          data: {
            rechargeStatus: 'VERIFYING',
            rechargeMethod: 'EXTENSION',
            rechargedAt: new Date(),
            rechargeError: null,
            rechargeAttempts: { increment: 1 },
            previousSpendCap: data?.previousSpendCap ?? null,
            newSpendCap: data?.newSpendCap ?? null,
          },
        })
        // DO NOT set status='APPROVED' or increment balance — verifier will do that
        console.log(`[Extension] Recharge reported SUCCESS by "${profile.label}": deposit ${depositId} ($${data?.newSpendCap || '?'}) — awaiting verification`)
      } else {
        await prisma.accountDeposit.update({
          where: { id: depositId },
          data: {
            rechargeStatus: 'FAILED',
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

// ==================== EXTENSION CDP LOGIN REQUEST (API key auth) ====================

/**
 * POST /extension/request-cdp-login — Extension requests CDP auto-login when it has no token
 * Auth: X-Extension-Key header
 * Flow: Extension tried opening adsmanager + waited 15s but still no token → calls this
 * Server launches AdsPower browser + runs CDP auto-login to capture FB token
 */
extension.post('/request-cdp-login', async (c) => {
  try {
    const profile = await getProfileByKey(c, {
      id: true, label: true, adsPowerSerialNumber: true, fbLoginEmail: true,
    })
    if (!profile) return c.json({ error: 'Invalid API key' }, 401)

    if (!profile.adsPowerSerialNumber) {
      return c.json({ error: 'No AdsPower serial number configured' }, 400)
    }
    if (!profile.fbLoginEmail) {
      return c.json({ error: 'No FB login email configured — admin must set fbLoginEmail' }, 400)
    }

    console.log(`[CDP-Login] Extension "${profile.label}" requesting CDP auto-login (serial=${profile.adsPowerSerialNumber})`)

    // Run CDP auto-login (non-blocking — don't make extension wait for full login)
    ;(async () => {
      try {
        const result = await cdpAutoLogin(profile.adsPowerSerialNumber!, profile)
        console.log(`[CDP-Login] CDP auto-login result for "${profile.label}": ${result}`)
      } catch (err: any) {
        console.error(`[CDP-Login] CDP auto-login failed for "${profile.label}":`, err.message)
      }
    })()

    return c.json({ ok: true, message: 'CDP auto-login triggered' })
  } catch (err: any) {
    console.error(`[CDP-Login] Error:`, err.message)
    return c.json({ error: err.message }, 500)
  }
})

export default extension
