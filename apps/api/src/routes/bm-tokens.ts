/**
 * BM Token routes — admin endpoints for managing BMSU tokens used for
 * server-side ad account recharge.
 *
 * Endpoints:
 *   POST   /bm-tokens/validate    — Validate a token (no save) and preview info
 *   POST   /bm-tokens             — Save a new BM token (validates + auto-links accounts)
 *   GET    /bm-tokens             — List all saved BM tokens (admin view)
 *   GET    /bm-tokens/:id         — Get one BM token detail (with linked accounts)
 *   PATCH  /bm-tokens/:id         — Update token (refresh) or status
 *   POST   /bm-tokens/:id/sync    — Re-fetch ad accounts and re-link
 *   DELETE /bm-tokens/:id         — Remove BM token (does NOT unlink ad accounts)
 */

import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken, verifyAdmin } from '../middleware/auth'
import { encryptToken, decryptToken, maskToken } from '../lib/token-crypto.js'

const FB_GRAPH = 'https://graph.facebook.com/v25.0'

const bmTokens = new Hono()

// All endpoints require admin auth
bmTokens.use('*', verifyToken, verifyAdmin)

// ─── Helpers ─────────────────────────────────────────────────────────

interface DebugTokenResult {
  app_id: string
  type: string                    // "USER" | "SYSTEM_USER" | etc
  application: string
  expires_at: number              // 0 = never
  data_access_expires_at: number
  is_valid: boolean
  scopes: string[]
  user_id: string
}

interface BMInfo {
  id: string
  name: string
  verification_status?: string
}

interface FBAdAccount {
  id: string                      // "act_123..."
  account_id: string              // "123..."
  name: string
  account_status: number
  spend_cap?: string
  amount_spent?: string
  balance?: string
  currency?: string
}

async function debugToken(token: string): Promise<DebugTokenResult> {
  const r = await fetch(`${FB_GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`)
  const j = await r.json() as any
  if (j.error) throw new Error(`debug_token: ${j.error.message}`)
  if (!j.data?.is_valid) throw new Error('Token is not valid')
  return j.data as DebugTokenResult
}

async function fetchUserInfo(token: string, userId: string): Promise<{ id: string; name: string }> {
  const r = await fetch(`${FB_GRAPH}/${userId}?fields=id,name&access_token=${encodeURIComponent(token)}`)
  const j = await r.json() as any
  if (j.error) throw new Error(`me: ${j.error.message}`)
  return { id: j.id, name: j.name }
}

async function fetchAdAccountsForToken(token: string): Promise<FBAdAccount[]> {
  // Paginate through /me/adaccounts
  const all: FBAdAccount[] = []
  let url = `${FB_GRAPH}/me/adaccounts?fields=id,account_id,name,account_status,spend_cap,amount_spent,balance,currency,owner&limit=100&access_token=${encodeURIComponent(token)}`
  while (url) {
    const r = await fetch(url)
    const j = await r.json() as any
    if (j.error) throw new Error(`me/adaccounts: ${j.error.message}`)
    if (Array.isArray(j.data)) all.push(...j.data)
    url = j.paging?.next || ''
    if (all.length >= 1000) break  // safety cap
  }
  return all
}

async function fetchBMInfo(token: string, bmId: string): Promise<BMInfo | null> {
  try {
    const r = await fetch(`${FB_GRAPH}/${bmId}?fields=id,name,verification_status&access_token=${encodeURIComponent(token)}`)
    const j = await r.json() as any
    if (j.error) return null
    return { id: j.id, name: j.name, verification_status: j.verification_status }
  } catch {
    return null
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────

/**
 * POST /bm-tokens/validate
 * Body: { token: string }
 * Response: { valid, tokenInfo, ownerBM, adAccounts: [...], dbMatches: [...] }
 *
 * Validates a token without saving. Used by the admin "Add BM" form to
 * preview what will be linked before confirming.
 */
bmTokens.post('/validate', async (c) => {
  try {
    const { token } = await c.req.json()
    if (!token || typeof token !== 'string') return c.json({ error: 'token required' }, 400)

    // 1. debug_token — confirm valid + scopes
    let debug: DebugTokenResult
    try {
      debug = await debugToken(token)
    } catch (e: any) {
      return c.json({ valid: false, error: e.message }, 200)
    }

    // 2. Fetch user/system-user owner
    const owner = await fetchUserInfo(token, debug.user_id).catch(() => null)

    // 3. Fetch all ad accounts the token can manage
    const fbAccounts = await fetchAdAccountsForToken(token)

    // 4. Determine the "owning BM" — for SYSTEM_USER tokens, all accessible
    //    accounts share the same `owner` field which is the BM ID.
    //    For USER tokens, multiple BMs possible — we pick the most common.
    const bmCounts: Record<string, number> = {}
    for (const a of fbAccounts) {
      const bm = (a as any).owner
      if (bm) bmCounts[bm] = (bmCounts[bm] || 0) + 1
    }
    const primaryBmId = Object.entries(bmCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

    let ownerBM: BMInfo | null = null
    if (primaryBmId) ownerBM = await fetchBMInfo(token, primaryBmId)

    // 5. Match against existing AdAccount records
    const accountIds = fbAccounts.map(a => a.account_id)
    const existingAccounts = await prisma.adAccount.findMany({
      where: { accountId: { in: accountIds } },
      select: { id: true, accountId: true, accountName: true, sourceBmId: true, status: true },
    })
    const existingMap = new Map(existingAccounts.map(a => [a.accountId, a]))

    const adAccounts = fbAccounts.map(fb => {
      const existing = existingMap.get(fb.account_id)
      return {
        accountId: fb.account_id,
        fbName: fb.name,
        fbStatus: fb.account_status,
        spend_cap: fb.spend_cap,
        balance: fb.balance,
        currency: fb.currency,
        existsInDb: !!existing,
        dbId: existing?.id || null,
        dbName: existing?.accountName || null,
        currentSourceBmId: existing?.sourceBmId || null,
      }
    })

    return c.json({
      valid: true,
      tokenInfo: {
        type: debug.type,
        appId: debug.app_id,
        appName: debug.application,
        userId: debug.user_id,
        userName: owner?.name || null,
        scopes: debug.scopes,
        expiresAt: debug.expires_at,    // 0 = never
        permanent: debug.expires_at === 0,
      },
      ownerBM,                          // primary BM the token manages
      adAccounts,                       // all FB accounts + DB match status
      summary: {
        totalFb: adAccounts.length,
        existsInDb: adAccounts.filter(a => a.existsInDb).length,
        notInDb: adAccounts.filter(a => !a.existsInDb).length,
      },
    })
  } catch (e: any) {
    console.error('[bm-tokens/validate]', e)
    return c.json({ error: e.message || 'validation failed' }, 500)
  }
})

/**
 * POST /bm-tokens
 * Body: { token: string, bmId?: string }
 *   - bmId optional; if omitted, derived from /me/adaccounts owner field
 *
 * Saves the token (encrypted), auto-links existing AdAccounts to this BM
 * by setting AdAccount.sourceBmId = bmId.
 */
bmTokens.post('/', async (c) => {
  try {
    const adminId = c.get('userId') as string
    const body = await c.req.json()
    const { token, bmId: explicitBmId } = body
    if (!token) return c.json({ error: 'token required' }, 400)

    // Validate
    const debug = await debugToken(token)
    const fbAccounts = await fetchAdAccountsForToken(token)

    // Determine BM ID
    const bmCounts: Record<string, number> = {}
    for (const a of fbAccounts) {
      const bm = (a as any).owner
      if (bm) bmCounts[bm] = (bmCounts[bm] || 0) + 1
    }
    const primaryBmId = explicitBmId || Object.entries(bmCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!primaryBmId) return c.json({ error: 'Could not determine BM ID from token' }, 400)

    const bmInfo = await fetchBMInfo(token, primaryBmId)

    // Check for duplicate
    const existing = await prisma.bmToken.findUnique({ where: { bmId: primaryBmId } })
    if (existing) {
      return c.json({
        error: `A token for BM ${primaryBmId} (${existing.bmName || 'unnamed'}) already exists. Use PATCH to update it.`,
        existingId: existing.id,
      }, 409)
    }

    // Encrypt and save
    const encryptedToken = encryptToken(token)

    // Auto-link: find existing AdAccount records by accountId, set sourceBmId
    const accountIds = fbAccounts.map(a => a.account_id)
    const updateResult = await prisma.adAccount.updateMany({
      where: { accountId: { in: accountIds } },
      data: { sourceBmId: primaryBmId },
    })

    const created = await prisma.bmToken.create({
      data: {
        bmId: primaryBmId,
        bmName: bmInfo?.name || null,
        verificationStatus: bmInfo?.verification_status || null,
        encryptedToken,
        status: 'ACTIVE',
        scopes: debug.scopes,
        tokenType: debug.type,
        appId: debug.app_id,
        systemUserId: debug.user_id,
        addedById: adminId,
        validatedAt: new Date(),
        linkedAccountsCount: updateResult.count,
      },
    })

    return c.json({
      success: true,
      bmToken: { ...created, encryptedToken: undefined },  // never return token
      linkedAccounts: updateResult.count,
      totalFbAccounts: fbAccounts.length,
      skipped: fbAccounts.length - updateResult.count,
    })
  } catch (e: any) {
    console.error('[bm-tokens POST]', e)
    return c.json({ error: e.message || 'save failed' }, 500)
  }
})

/**
 * GET /bm-tokens
 * List all saved BM tokens with linked-account counts.
 */
bmTokens.get('/', async (c) => {
  const tokens = await prisma.bmToken.findMany({
    orderBy: { addedAt: 'desc' },
    select: {
      id: true, bmId: true, bmName: true, verificationStatus: true,
      status: true, tokenType: true, scopes: true,
      addedAt: true, lastUsedAt: true, lastErrorAt: true, lastError: true,
      validatedAt: true, linkedAccountsCount: true, updatedAt: true,
    },
  })
  return c.json({ tokens })
})

/**
 * GET /bm-tokens/:id
 * Detail view + linked ad accounts.
 */
bmTokens.get('/:id', async (c) => {
  const id = c.req.param('id')
  const token = await prisma.bmToken.findUnique({
    where: { id },
    select: {
      id: true, bmId: true, bmName: true, verificationStatus: true,
      status: true, tokenType: true, scopes: true, appId: true, systemUserId: true,
      addedAt: true, lastUsedAt: true, lastErrorAt: true, lastError: true,
      validatedAt: true, linkedAccountsCount: true, updatedAt: true,
    },
  })
  if (!token) return c.json({ error: 'not found' }, 404)

  const linkedAccounts = await prisma.adAccount.findMany({
    where: { sourceBmId: token.bmId },
    select: {
      id: true, accountId: true, accountName: true, status: true,
      balance: true, totalDeposit: true, totalSpend: true, currency: true,
    },
    orderBy: { accountName: 'asc' },
  })

  return c.json({ token, linkedAccounts })
})

/**
 * PATCH /bm-tokens/:id
 * Body: { token?: string, status?: 'ACTIVE'|'PAUSED' }
 */
bmTokens.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { token: newToken, status } = body

  const existing = await prisma.bmToken.findUnique({ where: { id } })
  if (!existing) return c.json({ error: 'not found' }, 404)

  const data: any = {}
  if (newToken) {
    const debug = await debugToken(newToken).catch((e) => { throw new Error(`new token invalid: ${e.message}`) })
    data.encryptedToken = encryptToken(newToken)
    data.scopes = debug.scopes
    data.tokenType = debug.type
    data.systemUserId = debug.user_id
    data.validatedAt = new Date()
    data.status = 'ACTIVE'
    data.lastError = null
    data.lastErrorAt = null
  }
  if (status && ['ACTIVE', 'PAUSED', 'INVALID', 'EXPIRED'].includes(status)) {
    data.status = status
  }

  const updated = await prisma.bmToken.update({
    where: { id },
    data,
    select: { id: true, bmId: true, bmName: true, status: true, validatedAt: true },
  })

  return c.json({ success: true, token: updated })
})

/**
 * POST /bm-tokens/:id/sync
 * Re-fetch ad accounts and link to this BM.
 */
bmTokens.post('/:id/sync', async (c) => {
  const id = c.req.param('id')
  const t = await prisma.bmToken.findUnique({ where: { id } })
  if (!t) return c.json({ error: 'not found' }, 404)

  try {
    const token = decryptToken(t.encryptedToken)
    const fbAccounts = await fetchAdAccountsForToken(token)
    const accountIds = fbAccounts.map(a => a.account_id)

    const updateResult = await prisma.adAccount.updateMany({
      where: { accountId: { in: accountIds }, sourceBmId: { not: t.bmId } },
      data: { sourceBmId: t.bmId },
    })

    const totalLinked = await prisma.adAccount.count({
      where: { sourceBmId: t.bmId },
    })

    await prisma.bmToken.update({
      where: { id },
      data: {
        validatedAt: new Date(),
        linkedAccountsCount: totalLinked,
        lastError: null,
        lastErrorAt: null,
        status: 'ACTIVE',
      },
    })

    return c.json({
      success: true,
      newlyLinked: updateResult.count,
      totalLinked,
      totalFbAccounts: fbAccounts.length,
    })
  } catch (e: any) {
    await prisma.bmToken.update({
      where: { id },
      data: { lastError: e.message?.slice(0, 500), lastErrorAt: new Date() },
    }).catch(() => {})
    return c.json({ error: e.message || 'sync failed' }, 500)
  }
})

/**
 * DELETE /bm-tokens/:id
 * Removes the token. Does NOT unlink ad accounts (keeps sourceBmId so historical
 * records preserved). Recharge for those accounts will fall through to fallback path.
 */
bmTokens.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const t = await prisma.bmToken.findUnique({ where: { id } })
  if (!t) return c.json({ error: 'not found' }, 404)

  await prisma.bmToken.delete({ where: { id } })
  return c.json({ success: true, deleted: { id: t.id, bmId: t.bmId, bmName: t.bmName } })
})

export default bmTokens
