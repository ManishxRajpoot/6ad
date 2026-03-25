import { Hono } from 'hono'
import { verifyToken } from '../middleware/auth.js'

const app = new Hono()

// All routes require admin authentication
app.use('*', verifyToken)

// Airwallex API credentials
const AIRWALLEX_CONFIG = {
  clientId: process.env.AIRWALLEX_CLIENT_ID || 'GkNuJdR2S6SigDKiThwzwg',
  apiKey: process.env.AIRWALLEX_API_KEY || 'c5f3e37ff8bc101033e319d26a90be4634f6a3237cf81fcc7896e9895734322ed43662d83e98233007f6817f7c8360de',
  baseUrl: process.env.AIRWALLEX_BASE_URL || 'https://api.airwallex.com',
}

// Cache the bearer token (valid for ~30 min)
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAuthToken(): Promise<string> {
  // Return cached if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }

  const res = await fetch(`${AIRWALLEX_CONFIG.baseUrl}/api/v1/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': AIRWALLEX_CONFIG.clientId,
      'x-api-key': AIRWALLEX_CONFIG.apiKey,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Airwallex auth failed: ${err.message || res.statusText}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + (data.expires_at ? new Date(data.expires_at).getTime() - Date.now() : 25 * 60 * 1000),
  }
  return cachedToken.token
}

async function airwallexRequest(method: string, path: string, body?: any) {
  const token = await getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }

  const res = await fetch(`${AIRWALLEX_CONFIG.baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: true, status: res.status, data }
  }
  return { error: false, status: res.status, data }
}

function requireAdmin(c: any) {
  const user = c.get('user' as any)
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return c.json({ error: 'Unauthorized' }, 403)
  }
  return null
}

// ==================== Authentication Test ====================
app.get('/auth/test', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const token = await getAuthToken()
    return c.json({ success: true, message: 'Airwallex authentication successful', tokenPreview: token.substring(0, 20) + '...' })
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500)
  }
})

// ==================== Account / Balances ====================
app.get('/balances', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const result = await airwallexRequest('GET', '/api/v1/balances/current')
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== Cards ====================

// List all cards
app.get('/cards', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const page = c.req.query('page_num') || '0'
    const size = c.req.query('page_size') || '20'
    const status = c.req.query('status') || ''
    let path = `/api/v1/issuing/cards?page_num=${page}&page_size=${size}`
    if (status) path += `&statuses=${status}`
    const result = await airwallexRequest('GET', path)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Get card details
app.get('/cards/:id', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const result = await airwallexRequest('GET', `/api/v1/issuing/cards/${c.req.param('id')}`)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Get card sensitive details (PAN, CVV, expiry)
app.get('/cards/:id/details', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const result = await airwallexRequest('GET', `/api/v1/issuing/cards/${c.req.param('id')}/details`)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Create a new card
app.post('/cards', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const body = await c.req.json()
    const result = await airwallexRequest('POST', '/api/v1/issuing/cards/create', body)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Update card (activate, set limits etc.)
app.post('/cards/:id/update', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const body = await c.req.json()
    const result = await airwallexRequest('POST', `/api/v1/issuing/cards/${c.req.param('id')}/update`, body)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Activate card
app.post('/cards/:id/activate', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const result = await airwallexRequest('POST', `/api/v1/issuing/cards/${c.req.param('id')}/activate`, {})
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Freeze card
app.post('/cards/:id/deactivate', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const result = await airwallexRequest('POST', `/api/v1/issuing/cards/${c.req.param('id')}/deactivate`, {})
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Cancel card
app.post('/cards/:id/cancel', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const body = await c.req.json().catch(() => ({}))
    const result = await airwallexRequest('POST', `/api/v1/issuing/cards/${c.req.param('id')}/cancel`, body)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== Cardholders ====================

// List cardholders
app.get('/cardholders', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const page = c.req.query('page_num') || '0'
    const size = c.req.query('page_size') || '20'
    const result = await airwallexRequest('GET', `/api/v1/issuing/cardholders?page_num=${page}&page_size=${size}`)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Create cardholder
app.post('/cardholders', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const body = await c.req.json()
    const result = await airwallexRequest('POST', '/api/v1/issuing/cardholders/create', body)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Get cardholder details
app.get('/cardholders/:id', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const result = await airwallexRequest('GET', `/api/v1/issuing/cardholders/${c.req.param('id')}`)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== Transactions ====================

// List card transactions
app.get('/transactions', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const page = c.req.query('page_num') || '0'
    const size = c.req.query('page_size') || '20'
    const cardId = c.req.query('card_id') || ''
    let path = `/api/v1/issuing/transactions?page_num=${page}&page_size=${size}`
    if (cardId) path += `&card_id=${cardId}`
    const result = await airwallexRequest('GET', path)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== Funding ====================

// Fund a card
app.post('/cards/:id/fund', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const body = await c.req.json()
    const result = await airwallexRequest('POST', `/api/v1/issuing/cards/${c.req.param('id')}/fund`, body)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Withdraw from card
app.post('/cards/:id/withdraw', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const body = await c.req.json()
    const result = await airwallexRequest('POST', `/api/v1/issuing/cards/${c.req.param('id')}/withdraw`, body)
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ==================== Config Limits ====================

// Get issuing config
app.get('/config', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const result = await airwallexRequest('GET', '/api/v1/issuing/config')
    if (result.error) return c.json(result.data, result.status)
    return c.json(result.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default app
