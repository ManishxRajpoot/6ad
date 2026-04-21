import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { decryptCardData } from '../lib/yeewallex.js'
import { verifyToken } from '../middleware/auth.js'

const webhooks = new Hono()

// ============================================================
// Public webhook endpoint — Yeewallex calls this for:
//   - 授权交易结果 (AUTH tx result)
//   - 清算通知   (clearing)
//   - 3DS OTP
//   - 卡片操作   (card operation)
//   - 转授权通知 (forward authorization — decides approve/deny)
//   - 卡片额度释放 (quota release)
//
// Path must match exactly what's configured in YeeVCC Portal:
//   https://api.6ad.in/webhooks/yeewallex
// ============================================================

type YeeBody = Record<string, any>

function firstDefined<T>(...vals: T[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v
  return undefined
}

function tryDecrypt(val: any): any {
  if (typeof val !== 'string' || val.length < 16) return val
  try {
    const decoded = decryptCardData(val)
    // If it looks like JSON, parse it
    if (decoded.startsWith('{') || decoded.startsWith('[')) {
      try { return JSON.parse(decoded) } catch { return decoded }
    }
    return decoded
  } catch { return val }
}

function classifyEvent(body: YeeBody): string {
  const candidates = [
    body.notifyType, body.eventType, body.event, body.type, body.bizType, body.messageType, body.notificationType,
  ].map(v => (v == null ? '' : String(v)).toLowerCase())
  const joined = candidates.join(' ')

  if (joined.includes('3ds') || joined.includes('otp')) return '3DS_OTP'
  if (joined.includes('forward') || joined.includes('transfer') || joined.includes('third') || joined.includes('delegate') || joined.includes('auth_decision')) return 'FORWARD_AUTH'
  if (joined.includes('auth') && joined.includes('result')) return 'AUTH_RESULT'
  if (joined.includes('auth')) return 'FORWARD_AUTH' // best-guess for bare "auth" — treat as decision
  if (joined.includes('clear') || joined.includes('settle')) return 'CLEARING'
  if (joined.includes('card')) return 'CARD_OP'
  if (joined.includes('quota') || joined.includes('release')) return 'QUOTA_RELEASE'

  // Fallback: any body shape hinting at auth decision needed
  if (body.txnId && (body.amount || body.transactionAmount) && !body.settleAmount) return 'FORWARD_AUTH'

  return 'UNKNOWN'
}

function approveResponse() {
  // Maximally compatible approve response — covers YOP-style and common auth-webhook schemas.
  // Yeewallex: we'll pin the exact one after first real event lands.
  return {
    code: '0000',
    message: 'SUCCESS',
    state: 'SUCCESS',
    result: {
      code: '0000',
      state: 'SUCCESS',
      success: true,
      approved: true,
      approve: true,
      decision: 'APPROVE',
      authResult: 'APPROVED',
      authCode: '000000',
    },
    success: true,
    approved: true,
    decision: 'APPROVE',
  }
}

async function logEvent(opts: {
  kind: string
  rawBody: string
  parsed: any
  decrypted: any
  classified: string
  response: any
  ip: string
  userAgent: string
  headers: Record<string, string>
}) {
  try {
    await prisma.cmsAnalytics.create({
      data: {
        event: `yeewallex_hook_${opts.classified.toLowerCase()}`,
        metadata: {
          kind: opts.kind,
          classified: opts.classified,
          raw: opts.rawBody.slice(0, 20000),
          parsed: opts.parsed,
          decrypted: opts.decrypted,
          response: opts.response,
          headers: opts.headers,
        } as any,
        ip: opts.ip,
        userAgent: opts.userAgent,
      },
    })
  } catch (e) {
    console.error('[YeeWebhook] failed to persist log:', (e as any)?.message)
  }
}

async function handleCardStateUpdate(body: YeeBody, decrypted: any) {
  const payload = decrypted && typeof decrypted === 'object' ? { ...body, ...decrypted } : body
  const cardId = firstDefined(payload.cardId, payload.card_id)
  if (!cardId) return

  const card = await prisma.vccCard.findFirst({ where: { yeewallexCardId: String(cardId) } })
  if (!card) return

  // Balance update
  const balance = firstDefined(payload.balance, payload.cardBalance)
  if (balance !== undefined) {
    const parsed = parseFloat(String(balance))
    if (!Number.isNaN(parsed)) {
      await prisma.vccCard.update({ where: { id: card.id }, data: { balance: parsed } })
    }
  }

  // Status update
  const statusRaw = String(firstDefined(payload.cardStatus, payload.status) || '').toUpperCase()
  const statusMap: Record<string, any> = {
    ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', FROZEN: 'FROZEN',
    CANCELLED: 'CANCELLED', CANCELED: 'CANCELLED', CLOSED: 'CANCELLED',
  }
  if (statusMap[statusRaw]) {
    await prisma.vccCard.update({ where: { id: card.id }, data: { status: statusMap[statusRaw] } })
  }
}

async function handleTransaction(body: YeeBody, decrypted: any, classified: string) {
  const payload = decrypted && typeof decrypted === 'object' ? { ...body, ...decrypted } : body
  const cardId = firstDefined(payload.cardId, payload.card_id)
  if (!cardId) return
  const card = await prisma.vccCard.findFirst({ where: { yeewallexCardId: String(cardId) } })
  if (!card) return

  const txId = String(firstDefined(payload.transactionId, payload.txnId, payload.transaction_id, `wh_${Date.now()}`))
  const existing = await prisma.vccTransaction.findFirst({ where: { yeewallexTxId: txId } })
  if (existing) return

  const amount = parseFloat(String(firstDefined(payload.amount, payload.transactionAmount, 0)))
  const isRefund = String(firstDefined(payload.transactionType, payload.txnType) || '').toUpperCase() === 'REFUND'
  const status = classified === 'AUTH_RESULT' || classified === 'CLEARING' ? 'SUCCESS' : 'PENDING'

  await prisma.vccTransaction.create({
    data: {
      yeewallexTxId: txId,
      type: isRefund ? 'REFUND' : 'PURCHASE',
      amount: Number.isNaN(amount) ? 0 : amount,
      currency: String(firstDefined(payload.currency, 'USD')),
      status: status as any,
      merchantName: firstDefined(payload.merchantName, payload.merchant_name) || null,
      merchantCategory: firstDefined(payload.mcc, payload.merchantCategory) || null,
      merchantCountry: firstDefined(payload.merchantCountry, payload.merchant_country) || null,
      description: firstDefined(payload.description, payload.remark) || null,
      metadata: payload,
      cardId: card.id,
    },
  })
}

// ============================================================
// Main catch-all handler
// ============================================================
async function handleHook(c: any, kind: string) {
  const headers: Record<string, string> = {}
  c.req.raw.headers.forEach((v: string, k: string) => { headers[k] = v })
  const ip = headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown'
  const userAgent = headers['user-agent'] || ''

  let rawBody = ''
  let parsed: any = null
  try { rawBody = await c.req.text() } catch { rawBody = '' }
  try { parsed = rawBody ? JSON.parse(rawBody) : {} } catch { parsed = { _rawString: rawBody } }

  // Decrypt any obvious encrypted field — Yeewallex sometimes wraps payload in `data` / `encryptedData`
  let decrypted: any = null
  for (const field of ['data', 'encryptedData', 'payload', 'body', 'content']) {
    if (parsed && typeof parsed[field] === 'string') {
      const dec = tryDecrypt(parsed[field])
      if (dec && dec !== parsed[field]) { decrypted = dec; break }
    }
  }

  const classified = classifyEvent(parsed || {})
  const response = approveResponse()

  console.log(`[YeeWebhook] ${kind} classified=${classified} body=${rawBody.slice(0, 400)}`)

  // Persist first (always), even if subsequent processing fails
  await logEvent({ kind, rawBody, parsed, decrypted, classified, response, ip, userAgent, headers })

  // Best-effort side effects — never block the response
  try {
    if (classified === 'CARD_OP' || classified === 'QUOTA_RELEASE') {
      await handleCardStateUpdate(parsed || {}, decrypted)
    } else if (classified === 'AUTH_RESULT' || classified === 'CLEARING') {
      await handleTransaction(parsed || {}, decrypted, classified)
    }
  } catch (e) {
    console.error('[YeeWebhook] side-effect error:', (e as any)?.message)
  }

  return c.json(response, 200)
}

webhooks.post('/yeewallex', (c) => handleHook(c, 'root'))
webhooks.post('/yeewallex/:sub', (c) => handleHook(c, `sub:${c.req.param('sub')}`))
webhooks.post('/yeewallex/:sub/:sub2', (c) => handleHook(c, `sub:${c.req.param('sub')}/${c.req.param('sub2')}`))

// Health probe (Yeewallex may GET the URL to validate)
webhooks.get('/yeewallex', (c) => c.json({ status: 'ok', service: 'yeewallex-webhook-v2', timestamp: new Date().toISOString() }))
webhooks.get('/yeewallex/:sub', (c) => c.json({ status: 'ok', service: 'yeewallex-webhook-v2', sub: c.req.param('sub') }))

// ============================================================
// Admin: read recent webhook logs
// ============================================================
webhooks.get('/yeewallex/_logs/list', verifyToken, async (c) => {
  if (c.get('userRole') !== 'ADMIN') return c.json({ error: 'Admin only' }, 403)
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 500)
  const logs = await prisma.cmsAnalytics.findMany({
    where: { event: { startsWith: 'yeewallex_hook_' } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return c.json({ logs })
})

export default webhooks
