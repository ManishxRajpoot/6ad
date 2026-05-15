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

// Whose Facebook profile / system-user does this token actually belong to?
// Calls /me?fields=id,name on Graph and returns the result. Works for both
// USER and SYSTEM_USER tokens.
async function fetchTokenOwner(token: string): Promise<{ id: string; name: string } | null> {
  try {
    const r = await fetch(`${FB_GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(token)}`)
    const j = await r.json() as any
    if (j.error || !j.id) return null
    return { id: String(j.id), name: j.name || '' }
  } catch {
    return null
  }
}

async function fetchAdAccountsForToken(token: string): Promise<FBAdAccount[]> {
  // Paginate through /me/adaccounts
  const all: FBAdAccount[] = []
  let url = `${FB_GRAPH}/me/adaccounts?fields=id,account_id,name,account_status,disable_reason,spend_cap,amount_spent,balance,currency,owner&limit=100&access_token=${encodeURIComponent(token)}`
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

/**
 * Returns ALL ad accounts the BM owns — including ones the SU was just made
 * owner of (which /me/adaccounts misses until per-account roles propagate).
 */
async function fetchOwnedAdAccountsForBm(token: string, bmId: string): Promise<FBAdAccount[]> {
  const all: FBAdAccount[] = []
  let url = `${FB_GRAPH}/${bmId}/owned_ad_accounts?fields=id,account_id,name,account_status,disable_reason,spend_cap,amount_spent,balance,currency&limit=100&access_token=${encodeURIComponent(token)}`
  while (url) {
    const r = await fetch(url)
    const j = await r.json() as any
    if (j.error) throw new Error(`${bmId}/owned_ad_accounts: ${j.error.message}`)
    if (Array.isArray(j.data)) all.push(...j.data)
    url = j.paging?.next || ''
    if (all.length >= 1000) break
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
    const owner = await fetchTokenOwner(token)

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
        fbProfileId: owner?.id || debug.user_id || null,
        fbProfileName: owner?.name || null,
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
      fbProfileId: true, fbProfileName: true,
      systemUserId: true,
      addedAt: true, lastUsedAt: true, lastErrorAt: true, lastError: true,
      validatedAt: true, linkedAccountsCount: true, updatedAt: true,
    },
  })
  return c.json({ tokens })
})

/**
 * POST /bm-tokens/:id/refresh-owner
 * Re-fetch /me from Graph API to update fbProfileId + fbProfileName.
 * Useful for tokens added before this field existed, or after the SU
 * was renamed inside FB.
 */
bmTokens.post('/:id/refresh-owner', async (c) => {
  const id = c.req.param('id')
  const existing = await prisma.bmToken.findUnique({ where: { id } })
  if (!existing) return c.json({ error: 'not found' }, 404)

  let token: string
  try { token = decryptToken(existing.encryptedToken) } catch (e: any) {
    return c.json({ error: `decrypt failed: ${e.message}` }, 500)
  }

  const owner = await fetchTokenOwner(token)
  if (!owner) return c.json({ error: 'Could not fetch /me from Graph — token may be invalid' }, 400)

  const updated = await prisma.bmToken.update({
    where: { id },
    data: { fbProfileId: owner.id, fbProfileName: owner.name },
    select: { id: true, fbProfileId: true, fbProfileName: true, bmId: true, bmName: true },
  })
  return c.json({ success: true, bmToken: updated })
})

/**
 * GET /bm-tokens/find?accountId=...
 * Locate which BM owns a given FB ad account.
 *  - First checks our DB (AdAccount.sourceBmId).
 *  - If not in DB, walks active BM tokens and queries Graph API for owner.
 * Returns { found: true, bmTokenId, bmId, bmName } so the admin UI can jump to it.
 */
bmTokens.get('/find', async (c) => {
  const raw = (c.req.query('accountId') || '').trim().replace(/^act_/, '')
  if (!raw) return c.json({ error: 'accountId query param required' }, 400)

  // 1. DB shortcut
  const db = await prisma.adAccount.findFirst({
    where: { accountId: raw },
    select: { accountId: true, sourceBmId: true, accountName: true, user: { select: { username: true } } },
  })
  if (db?.sourceBmId && db.sourceBmId !== 'cheetah') {
    const bm = await prisma.bmToken.findUnique({
      where: { bmId: db.sourceBmId },
      select: { id: true, bmId: true, bmName: true },
    })
    if (bm) {
      return c.json({
        found: true, source: 'db',
        bmTokenId: bm.id, bmId: bm.bmId, bmName: bm.bmName,
        accountName: db.accountName,
        userName: db.user?.username || null,
      })
    }
  }
  if (db?.sourceBmId === 'cheetah') {
    return c.json({ found: true, source: 'db', cheetah: true, accountName: db.accountName, userName: db.user?.username || null })
  }

  // 2. Live Graph API lookup against every active BM token
  const tokens = await prisma.bmToken.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, bmId: true, bmName: true, encryptedToken: true },
  })
  for (const t of tokens) {
    try {
      const accessToken = decryptToken(t.encryptedToken)
      const r = await fetch(`${FB_GRAPH}/act_${raw}?fields=id,account_id,name,owner&access_token=${encodeURIComponent(accessToken)}`)
      const j: any = await r.json()
      if (j?.error) continue
      if (j?.owner === t.bmId) {
        return c.json({
          found: true, source: 'live',
          bmTokenId: t.id, bmId: t.bmId, bmName: t.bmName,
          accountName: j.name, userName: null,
        })
      }
    } catch {}
  }

  return c.json({ found: false })
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
      fbProfileId: true, fbProfileName: true,
      addedAt: true, lastUsedAt: true, lastErrorAt: true, lastError: true,
      validatedAt: true, linkedAccountsCount: true, updatedAt: true,
    },
  })
  if (!token) return c.json({ error: 'not found' }, 404)

  // DB ad accounts linked to this BM (sourceBmId is set at creation time by
  // detect-account-ownership). Indexed by FB accountId for the merge below.
  const dbAccounts = await prisma.adAccount.findMany({
    where: { sourceBmId: token.bmId },
    select: {
      id: true, accountId: true, accountName: true, status: true,
      balance: true, totalDeposit: true, totalSpend: true, currency: true,
      user: { select: { id: true, username: true, email: true } },
    },
  })
  const dbByFbId: Record<string, typeof dbAccounts[number]> = {}
  for (const a of dbAccounts) dbByFbId[a.accountId] = a

  // Live fetch from Meta — every ad account this BM owns/manages, plus owned
  // count summary so the row can show "X created".
  let fbAccounts: any[] = []
  let ownedCount: number | null = null
  let liveOk = false
  try {
    const accessToken = decryptToken((await prisma.bmToken.findUnique({
      where: { id }, select: { encryptedToken: true },
    }))!.encryptedToken)
    // Use BM's owned_ad_accounts so brand-new accounts show up immediately
    // (/me/adaccounts misses them until per-account roles propagate).
    fbAccounts = await fetchOwnedAdAccountsForBm(accessToken, token.bmId)
    liveOk = true

    // Owned-account summary (Meta does not expose the creation cap publicly)
    try {
      const FB_GRAPH = 'https://graph.facebook.com/v21.0'
      const summaryResp = await fetch(
        `${FB_GRAPH}/${token.bmId}/owned_ad_accounts?summary=total_count&limit=0&access_token=${encodeURIComponent(accessToken)}`,
      )
      const summaryJson: any = await summaryResp.json()
      if (summaryJson?.summary?.total_count != null) ownedCount = summaryJson.summary.total_count
    } catch {}
  } catch (e: any) {
    console.warn('[bm-tokens GET] live fetch failed:', e.message)
  }

  // Merge — return ALL FB accounts (not just DB-linked). For each, attach the
  // 6AD user's username if we have a record for it.
  const enriched = fbAccounts.map(fb => {
    const spent = fb.amount_spent ? parseFloat(fb.amount_spent) / 100 : 0
    const spendCap = fb.spend_cap ? parseFloat(fb.spend_cap) / 100 : null
    const balance = fb.balance ? parseFloat(fb.balance) / 100 : 0
    const remaining = spendCap != null ? Math.max(spendCap - spent, 0) : null
    const db = dbByFbId[fb.account_id]
    return {
      id: db?.id || `fb-${fb.account_id}`,
      accountId: fb.account_id,
      accountName: db?.accountName || fb.name || `act_${fb.account_id}`,
      status: db?.status || 'UNLINKED',
      balance,
      totalDeposit: Number(db?.totalDeposit ?? 0),
      totalSpend: spent,
      currency: fb.currency || db?.currency || 'USD',
      spendCap,
      remaining,
      live: true,
      inDb: !!db,
      userName: db?.user?.username || null,
      userEmail: db?.user?.email || null,
      fbStatus: typeof fb.account_status === 'number' ? fb.account_status : null,
      disableReason: typeof fb.disable_reason === 'number' ? fb.disable_reason : null,
    }
  })

  // If FB fetch failed entirely, fall back to DB-only list so the page still loads.
  if (!liveOk && enriched.length === 0) {
    for (const a of dbAccounts) {
      enriched.push({
        id: a.id,
        accountId: a.accountId,
        accountName: a.accountName,
        status: a.status,
        balance: Number(a.balance ?? 0),
        totalDeposit: Number(a.totalDeposit ?? 0),
        totalSpend: Number(a.totalSpend ?? 0),
        currency: a.currency,
        spendCap: null,
        remaining: null,
        live: false,
        inDb: true,
        userName: a.user?.username || null,
        userEmail: a.user?.email || null,
      })
    }
  }

  // Sort: assigned (has user) first, alphabetical by user then name
  enriched.sort((a, b) => {
    if (!!a.userName !== !!b.userName) return a.userName ? -1 : 1
    const ua = (a.userName || '').localeCompare(b.userName || '')
    if (ua !== 0) return ua
    return (a.accountName || '').localeCompare(b.accountName || '')
  })

  const tokenWithStats = {
    ...token,
    ownedCount,                          // total ad accounts the BM owns (live)
    liveCount: fbAccounts.length,        // accounts visible to this token (live)
    dbLinkedCount: dbAccounts.length,    // accounts in our DB
  }
  return c.json({ token: tokenWithStats, linkedAccounts: enriched })
})

/**
 * POST /bm-tokens/:id/import-account
 * Body: { accountId: string, userId: string }
 *
 * Creates an AdAccount DB record for an FB-side ad account that this BM owns
 * but isn't yet in our DB. Pulls the live name/currency/status from FB so the
 * record matches reality. Sets sourceBmId to the BM, so all the recharge wiring
 * and live data overlay works automatically afterwards.
 */
bmTokens.post('/:id/import-account', async (c) => {
  const id = c.req.param('id')
  const { accountId, userId } = await c.req.json().catch(() => ({} as any))
  if (!accountId || !userId) return c.json({ error: 'accountId and userId required' }, 400)

  const bm = await prisma.bmToken.findUnique({ where: { id } })
  if (!bm) return c.json({ error: 'BM token not found' }, 404)

  // Make sure user exists
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } })
  if (!user) return c.json({ error: 'user not found' }, 404)

  // Refuse if the account is already in our DB
  const existing = await prisma.adAccount.findFirst({ where: { accountId } })
  if (existing) return c.json({ error: 'Ad account already exists in DB', adAccountId: existing.id }, 409)

  // Pull live FB info using the BM's stored token
  let fb: any = null
  try {
    const token = decryptToken(bm.encryptedToken)
    const resp = await fetch(
      `${FB_GRAPH}/act_${accountId}?fields=id,account_id,name,account_status,currency,timezone_name,spend_cap,amount_spent,balance,owner&access_token=${encodeURIComponent(token)}`,
    )
    fb = await resp.json()
    if (fb?.error) return c.json({ error: `FB error: ${fb.error.message}` }, 400)
  } catch (e: any) {
    return c.json({ error: `Failed to fetch ad account from FB: ${e.message}` }, 500)
  }

  // FB account_status: 1=Active, 2=Disabled, 3=Unsettled, 7=RiskReview, 9=Grace, 100/101/202=Closed
  // Map onto our AccountStatus enum.
  const status = fb.account_status === 1 ? 'APPROVED'
               : fb.account_status === 2 ? 'SUSPENDED'
               : 'PENDING'

  const created = await prisma.adAccount.create({
    data: {
      platform: 'FACEBOOK',
      accountId: fb.account_id,
      accountName: fb.name || `act_${accountId}`,
      currency: fb.currency || 'USD',
      timezone: fb.timezone_name || null,
      status: status as any,
      sourceBmId: bm.bmId,
      sourceBmName: bm.bmName,
      userId,
      balance: fb.balance ? parseFloat(fb.balance) / 100 : 0,
      totalSpend: fb.amount_spent ? parseFloat(fb.amount_spent) / 100 : 0,
      totalDeposit: 0,
    },
    select: { id: true, accountId: true, accountName: true, status: true },
  })

  // Bump the cached count on the BM token so the row stat updates
  await prisma.bmToken.update({
    where: { id },
    data: { linkedAccountsCount: { increment: 1 } },
  }).catch(() => {})

  console.log(`[bm-tokens] Imported act_${accountId} → user ${user.username} (${userId}) under BM ${bm.bmId}`)
  return c.json({ success: true, adAccount: created, assignedTo: { id: user.id, username: user.username } })
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
    const owner = await fetchTokenOwner(newToken)
    data.encryptedToken = encryptToken(newToken)
    data.scopes = debug.scopes
    data.tokenType = debug.type
    data.systemUserId = debug.user_id
    data.fbProfileId = owner?.id || debug.user_id || null
    data.fbProfileName = owner?.name || null
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
