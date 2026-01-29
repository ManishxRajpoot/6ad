const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

type RequestOptions = {
  method?: string
  body?: any
  headers?: Record<string, string>
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
  }

  if (body) {
    config.body = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${endpoint}`, config)
  } catch (err) {
    // Network error - API server likely not running
    throw new Error(`Unable to connect to API server at ${API_URL}. Please ensure the API is running.`)
  }

  if (!response.ok) {
    // Handle specific HTTP status codes
    if (response.status === 401) {
      // Clear invalid token and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
      throw new Error('Session expired. Please login again.')
    }

    if (response.status === 403) {
      throw new Error('You do not have permission to access this resource.')
    }

    const error = await response.json().catch(() => ({ message: `Request failed with status ${response.status}` }))
    throw new Error(error.message || error.error || `Request failed with status ${response.status}`)
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'POST', body }),
  put: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'PUT', body }),
  patch: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'PATCH', body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
}

// Auth API
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: any }>('/auth/login', data),
  me: () => api.get<{ user: any }>('/auth/me'),
}

// Dashboard API (Agent specific)
export const dashboardApi = {
  getStats: () => api.get<any>('/dashboard/agent'),
}

// Users API (Agent manages their users)
export const usersApi = {
  getAll: () => api.get<{ users: any[] }>('/users'),
  getById: (id: string) => api.get<{ user: any }>(`/users/${id}`),
  create: (data: any) => api.post<{ user: any }>('/users', data),
  update: (id: string, data: any) => api.put<{ user: any }>(`/users/${id}`, data),
  delete: (id: string) => api.delete<{ message: string }>(`/users/${id}`),
}

// Transactions API
export const transactionsApi = {
  deposits: {
    getAll: () => api.get<{ deposits: any[] }>('/transactions/deposits'),
    create: (data: any) => api.post<{ deposit: any }>('/transactions/deposits', data),
  },
  withdrawals: {
    getAll: () => api.get<{ withdrawals: any[] }>('/transactions/withdrawals'),
    create: (data: any) => api.post<{ withdrawal: any }>('/transactions/withdrawals', data),
  },
}

// Accounts API
export const accountsApi = {
  getAll: (platform?: string) => api.get<{ accounts: any[] }>(`/accounts${platform ? `?platform=${platform}` : ''}`),
  getById: (id: string) => api.get<{ account: any }>(`/accounts/${id}`),
  create: (data: any) => api.post<{ account: any }>('/accounts', data),
  update: (id: string, data: any) => api.put<{ account: any }>(`/accounts/${id}`, data),
}

// Branding API (Agent whitelabel)
export const brandingApi = {
  update: (data: { brandLogo?: string; brandName?: string }) =>
    api.patch<{ message: string; agent: any }>('/agents/branding', data),
}

// Domains API (Agent custom domains)
export const domainsApi = {
  getAll: () => api.get<{ domains: any[] }>('/domains'),
  submit: (data: { domain: string }) =>
    api.post<{ message: string; domain: any; dnsInstructions: any }>('/domains', data),
  verify: (id: string) =>
    api.post<{ message: string; dnsVerified: boolean }>(`/domains/${id}/verify`, {}),
  delete: (id: string) => api.delete<{ message: string }>(`/domains/${id}`),
}
