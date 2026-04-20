import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// ============================================================
// YEEWALLEX VCC API CLIENT
// YOP v3 RSA2048-SHA256 signing protocol
// ============================================================

const CONFIG = {
  baseUrl: process.env.YEEWALLEX_API_URL || 'https://api.kun.global/yop-center',
  appKey: process.env.YEEWALLEX_APP_KEY || 'app_10027281',
  aesKey: process.env.YEEWALLEX_AES_KEY || '',
}

export const CARD_BINS = {
  OTA_USD: '1945436787911512065',
  OTA_HKD: '1945437035283173378',
  ADS_USD: '1945437632107466754',
}

let privateKey = ''
try {
  const keyPath = path.resolve(process.cwd(), process.env.YEEWALLEX_PRIVATE_KEY_PATH || './src/keys/yeewallex_private.pem')
  privateKey = fs.readFileSync(keyPath, 'utf8')
  console.log('[Yeewallex] RSA private key loaded')
} catch (err) {
  console.warn('[Yeewallex] Private key not found')
}

// ============================================================
// AES DECRYPTION
// ============================================================

export function decryptCardData(encrypted: string): string {
  if (!CONFIG.aesKey) throw new Error('AES key not configured')
  const keyBuf = Buffer.from(CONFIG.aesKey, 'utf8')

  // Step 1: AES-128-ECB decrypt without auto-padding
  const decipher = crypto.createDecipheriv('aes-128-ecb', keyBuf, Buffer.alloc(0))
  decipher.setAutoPadding(false)
  const raw = Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()])

  // Step 2: XOR with key bytes (Yeewallex's custom encryption layer)
  const result = Buffer.alloc(raw.length)
  for (let i = 0; i < raw.length; i++) {
    result[i] = raw[i] ^ keyBuf[i % keyBuf.length]
  }

  // Step 3: Remove PKCS5/PKCS7 padding
  const padByte = result[result.length - 1]
  if (padByte > 0 && padByte <= 16) {
    return result.subarray(0, result.length - padByte).toString('utf8')
  }
  return result.toString('utf8').replace(/[^\x20-\x7E]/g, '')
}

// ============================================================
// YOP v3 SIGNING (matches official SDK exactly)
// ============================================================

function urlEncode(str: string): string {
  return encodeURIComponent(String(str))
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/%20/g, '+')
}

function uuid(): string {
  return crypto.randomUUID()
}

function formatTimestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}Z`
}

function getCanonicalParams(params: Record<string, any>): string {
  const pairs: string[] = []
  for (const key of Object.keys(params).sort()) {
    const val = params[key]
    if (val === undefined || val === null) continue
    pairs.push(`${urlEncode(key)}=${urlEncode(String(val))}`)
  }
  return pairs.join('&')
}

function signRequest(canonicalRequest: string): string {
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(canonicalRequest, 'utf8')
  let sig = sign.sign(privateKey, 'base64')
  // URL-safe base64
  sig = sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  sig += '$SHA256'
  return sig
}

function buildAuthHeaders(method: string, apiPath: string, params: Record<string, any>): Record<string, string> {
  const timestamp = formatTimestamp()
  const authString = `yop-auth-v3/${CONFIG.appKey}/${timestamp}/1800`

  // Content SHA256
  let contentStr = ''
  if (method === 'GET' && Object.keys(params).length > 0) {
    contentStr = getCanonicalParams(params)
  } else if (method === 'POST' && Object.keys(params).length > 0) {
    // For JSON POST: hash the sorted JSON string
    const sorted: Record<string, any> = {}
    Object.keys(params).sort().forEach(k => { sorted[k] = params[k] })
    contentStr = JSON.stringify(sorted)
  }
  const contentSha256 = crypto.createHash('sha256').update(contentStr, 'utf8').digest('hex')

  const requestId = uuid()

  // Headers to sign (only these 3)
  const headersToSign: Record<string, string> = {
    'x-yop-appkey': CONFIG.appKey,
    'x-yop-content-sha256': contentSha256,
    'x-yop-request-id': requestId,
  }

  // Build canonical headers (sorted, url-encoded)
  const sortedKeys = Object.keys(headersToSign).sort()
  const canonicalHeaderStr = sortedKeys.map(k => `${urlEncode(k)}:${urlEncode(headersToSign[k])}`).join('\n')
  const signedHeadersStr = sortedKeys.join(';')

  // Query string (only for GET)
  const canonicalQueryString = method === 'GET' ? getCanonicalParams(params) : ''

  // Canonical request
  const canonicalRequest = [
    authString,
    method,
    apiPath,
    canonicalQueryString,
    canonicalHeaderStr,
  ].join('\n')

  // Sign
  const signature = signRequest(canonicalRequest)

  // Authorization header
  const authorization = `YOP-RSA2048-SHA256 ${authString}/${signedHeadersStr}/${signature}`

  return {
    'Authorization': authorization,
    'x-yop-appkey': CONFIG.appKey,
    'x-yop-content-sha256': contentSha256,
    'x-yop-request-id': requestId,
    'x-yop-sdk-version': 'node-custom-1.0',
    'x-yop-sdk-lang': 'nodejs',
  }
}

// ============================================================
// REQUEST HANDLER
// ============================================================

async function yeewallexRequest(
  method: 'GET' | 'POST',
  apiPath: string,
  params: Record<string, any> = {}
): Promise<{ error: boolean; code: string; message: string; data: any }> {
  if (!privateKey) return { error: true, code: 'NO_KEY', message: 'RSA private key not loaded', data: null }

  try {
    const headers = buildAuthHeaders(method, apiPath, params)
    const url = `${CONFIG.baseUrl}${apiPath}`
    let response: Response

    if (method === 'GET') {
      const qs = Object.keys(params).length > 0 ? '?' + getCanonicalParams(params) : ''
      response = await fetch(`${url}${qs}`, { method: 'GET', headers })
    } else {
      // POST: use JSON body with sorted keys
      const sorted: Record<string, any> = {}
      Object.keys(params).sort().forEach(k => { sorted[k] = params[k] })
      const jsonBody = JSON.stringify(sorted)
      response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: jsonBody,
      })
    }

    const text = await response.text()
    let result: any
    try { result = JSON.parse(text) } catch { result = { raw: text } }

    console.log(`[Yeewallex] ${method} ${apiPath} → ${response.status}:`, JSON.stringify(result).slice(0, 300))

    if (result.state === 'SUCCESS' || result.code === '00000' || result.code === 'OPR00000') {
      return { error: false, code: result.code || '00000', message: 'Success', data: result.result || result.data || result }
    }
    if (response.ok && !result.state && !result.error) {
      return { error: false, code: '00000', message: 'Success', data: result }
    }

    return {
      error: true,
      code: result.error?.code || result.code || String(response.status),
      message: result.error?.message || result.message || `HTTP ${response.status}`,
      data: result,
    }
  } catch (err: any) {
    console.error(`[Yeewallex] ${method} ${apiPath} error:`, err.message)
    return { error: true, code: 'NETWORK_ERROR', message: err.message, data: null }
  }
}

// ============================================================
// API FUNCTIONS
// ============================================================

export const getAccountInfo = () => yeewallexRequest('GET', '/rest/v1.0/vcc/user-info')
export const getCardBins = () => yeewallexRequest('GET', '/rest/v1.0/vcc/card-bins')

export const addCardholder = (data: { firstName: string; lastName: string; email?: string; phone?: string; idType?: string; idNumber?: string }) =>
  yeewallexRequest('POST', '/rest/v1.0/vcc/add-card-holder', data)

export const openCard = (data: { cardBinId: string; cardholderId: string; currency?: string; alias?: string; amount?: number }) =>
  yeewallexRequest('POST', '/rest/v1.0/vcc/card-open', {
    requestNo: `6AD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    cardBinId: data.cardBinId, cardholderId: data.cardholderId, currency: data.currency || 'USD',
    ...(data.alias && { alias: data.alias }), ...(data.amount !== undefined && { amount: String(data.amount) }),
  })

export const getCardOpenTask = (taskId: string) => yeewallexRequest('GET', '/rest/v1.0/vcc/card-open-task', { taskId })
export const activateCard = (cardId: string) => yeewallexRequest('POST', '/rest/v1.0/vcc/card-activate', { cardId })

export async function getCardKeyInfo(cardId: string) {
  const result = await yeewallexRequest('GET', '/rest/v1.0/vcc/card-key-info', { cardId })
  if (!result.error && result.data) {
    const rd = result.data?.data || result.data
    const cardNo = rd.cardNumber || rd.cardNo || ''

    // Try AES decryption for CVV and expiry
    let cvv = ''
    let expireDate = ''

    if (rd.cvv) {
      try { cvv = decryptCardData(rd.cvv) }
      catch { cvv = rd.cvv } // Return encrypted value if decrypt fails
    }

    if (rd.expiryDate || rd.expireDate) {
      try { expireDate = decryptCardData(rd.expiryDate || rd.expireDate) }
      catch { expireDate = rd.expiryDate || rd.expireDate } // Return encrypted value
    }

    return { ...result, data: { cardNo, cvv, expireDate, encrypted: cvv === rd.cvv } }
  }
  return result
}

export const rechargeCard = (data: { cardId: string; amount: number; currency?: string }) =>
  yeewallexRequest('POST', '/rest/v1.0/vcc/card-recharge', {
    cardId: data.cardId,
    amount: String(data.amount),
    currency: data.currency || 'USDT',
    requestNo: `RC_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  })

export const getRechargeStatus = (rechargeId: string) => yeewallexRequest('GET', '/rest/v1.0/vcc/card-recharge-query', { rechargeId })

export const withdrawCard = (data: { cardId: string; amount: number; currency?: string }) =>
  yeewallexRequest('POST', '/rest/v1.0/vcc/card-withdraw', { cardId: data.cardId, amount: String(data.amount), currency: data.currency || 'USD' })

export const freezeCard = (cardId: string) => yeewallexRequest('POST', '/rest/v1.0/vcc/card-freeze', { cardId })
export const unfreezeCard = (cardId: string) => yeewallexRequest('POST', '/rest/v1.0/vcc/card-unfreeze', { cardId })
export const cancelCard = (cardId: string) => yeewallexRequest('POST', '/rest/v1.0/vcc/card-cancel', { cardId })

export const getCards = (params: { pageNo?: number; pageSize?: number; status?: string } = {}) =>
  yeewallexRequest('GET', '/rest/v1.0/vcc/cards', { pageNo: String(params.pageNo || 1), pageSize: String(params.pageSize || 20), ...(params.status && { status: params.status }) })

export const getCardDetail = (cardId: string) => yeewallexRequest('GET', '/rest/v1.0/vcc/card-info', { cardId })

export const getCardholders = (params: { pageNo?: number; pageSize?: number } = {}) =>
  yeewallexRequest('GET', '/rest/v1.0/vcc/card-holders', { pageNo: String(params.pageNo || 1), pageSize: String(params.pageSize || 50) })

export const getTransactions = (params: { cardId?: string; page?: number; size?: number; startDate?: string; endDate?: string } = {}) => {
  // Default: last 90 days
  const now = new Date()
  const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const defaultStart = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
  const defaultEnd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate() + 1)}`

  return yeewallexRequest('GET', '/rest/v1.0/vcc/transactions', {
    page: String(params.page || 1),
    size: String(params.size || 50),
    startDate: params.startDate || defaultStart,
    endDate: params.endDate || defaultEnd,
    ...(params.cardId && { cardId: params.cardId }),
  })
}
