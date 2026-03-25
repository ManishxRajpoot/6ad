const API_URL = typeof window !== 'undefined' && (window.location.hostname.endsWith('6ad.in') || window.location.hostname.endsWith('ads360.ai'))
  ? 'https://api.6ad.in'
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001')

const _cache = new Map<string, { data: any; ts: number }>()
const CACHE_TTL = 30_000

export async function api(path: string, options: any = {}) {
  const { token, cache, ...fetchOptions } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  // Cache GET requests
  const cacheKey = `${path}:${token?.slice(-8)}`
  if (cache !== false && (!fetchOptions.method || fetchOptions.method === 'GET')) {
    const cached = _cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data
  }

  const res = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.message || `API Error ${res.status}`)
  }
  const data = await res.json()

  if (!fetchOptions.method || fetchOptions.method === 'GET') {
    _cache.set(cacheKey, { data, ts: Date.now() })
  }

  return data
}

export async function uploadFile(file: File, token: string) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/cms/admin/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Upload failed (${res.status})`)
  }
  return res.json()
}
