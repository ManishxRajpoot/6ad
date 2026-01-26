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

  const response = await fetch(`${API_URL}${endpoint}`, config)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || 'Request failed')
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
  register: (data: { email: string; password: string; username: string }) =>
    api.post<{ token: string; user: any }>('/auth/register', data),
  me: () => api.get<{ user: any }>('/auth/me'),
}

// Dashboard API (User specific)
export const dashboardApi = {
  getStats: () => api.get<any>('/dashboard/user'),
}

// Accounts API (User's own accounts)
export const accountsApi = {
  getAll: (platform?: string) => api.get<{ accounts: any[] }>(`/accounts${platform ? `?platform=${platform}` : ''}`),
  getById: (id: string) => api.get<{ account: any }>(`/accounts/${id}`),
}

// Transactions API (User's own transactions)
export const transactionsApi = {
  deposits: {
    getAll: () => api.get<{ deposits: any[]; pagination: any }>('/transactions/deposits'),
    create: (data: any) => api.post<{ deposit: any }>('/transactions/deposits', data),
  },
  withdrawals: {
    getAll: () => api.get<{ withdrawals: any[]; pagination: any }>('/transactions/withdrawals'),
    create: (data: any) => api.post<{ withdrawal: any }>('/transactions/withdrawals', data),
  },
  refunds: {
    getAll: (platform?: string) => api.get<{ refunds: any[]; pagination: any }>(`/transactions/refunds${platform ? `?platform=${platform}` : ''}`),
    create: (data: { amount: number; platform: string; accountId?: string; reason?: string }) =>
      api.post<{ refund: any }>('/transactions/refunds', data),
  },
  walletFlow: {
    getAll: () => api.get<{ flows: any[]; pagination: any }>('/transactions/wallet-flow'),
  },
  payLinkRequests: {
    getAll: () => api.get<{ payLinkRequests: any[] }>('/transactions/pay-link-requests'),
    create: (data: any) => api.post<{ payLinkRequest: any }>('/transactions/pay-link-requests', data),
  },
  settings: {
    getPayLinkEnabled: () => api.get<{ payLinkEnabled: boolean }>('/transactions/settings/pay-link'),
  },
}

// Account Deposits API (deposits to ad accounts - different from wallet deposits)
export const accountDepositsApi = {
  getAll: (platform?: string) => {
    const params = new URLSearchParams()
    if (platform) params.append('platform', platform)
    const queryString = params.toString()
    return api.get<{ deposits: any[]; pagination: any }>(`/accounts/deposits${queryString ? `?${queryString}` : ''}`)
  },
  create: (accountId: string, data: { amount: number; remarks?: string }) =>
    api.post<{ deposit: any }>(`/accounts/${accountId}/deposit`, data),
}

// Account Refunds API (refunds from ad accounts to wallet)
export const accountRefundsApi = {
  getAll: (platform?: string) => {
    const params = new URLSearchParams()
    if (platform) params.append('platform', platform)
    const queryString = params.toString()
    return api.get<{ refunds: any[]; pagination: any }>(`/accounts/refunds${queryString ? `?${queryString}` : ''}`)
  },
  create: (accountId: string, data: { amount: number; reason?: string }) =>
    api.post<{ refund: any }>(`/accounts/${accountId}/refund`, data),
}

// Balance Transfers API (transfers between ad accounts)
export const balanceTransfersApi = {
  getAll: (platform?: string) => {
    const params = new URLSearchParams()
    if (platform) params.append('platform', platform)
    const queryString = params.toString()
    return api.get<{ transfers: any[]; pagination: any }>(`/accounts/transfers${queryString ? `?${queryString}` : ''}`)
  },
  create: (data: { fromAccountId: string; toAccountId: string; amount: number; remarks?: string }) =>
    api.post<{ transfer: any }>('/accounts/transfer', data),
}

// Payment Methods API (public - only enabled methods for users)
export const paymentMethodsApi = {
  getAll: () => api.get<{ paymentMethods: any[] }>('/payment-methods'),
}

// BM Share API
export const bmShareApi = {
  getAll: (platform?: string) => {
    const params = new URLSearchParams()
    if (platform) params.append('platform', platform)
    const queryString = params.toString()
    return api.get<{ bmShareRequests: any[]; pagination: any }>(`/bm-share${queryString ? `?${queryString}` : ''}`)
  },
  create: (data: { platform: string; adAccountId: string; adAccountName: string; bmId: string; message?: string }) =>
    api.post<{ message: string; bmShareRequest: any }>('/bm-share', data),
}

// Ad Account Applications API (User's own applications)
export const applicationsApi = {
  // Get user's own applications with optional filters
  getAll: (platform?: string, status?: string) => {
    const params = new URLSearchParams()
    if (platform) params.append('platform', platform)
    if (status) params.append('status', status)
    const queryString = params.toString()
    return api.get<{ applications: any[]; pagination: any }>(`/applications${queryString ? `?${queryString}` : ''}`)
  },

  // Get single application by ID
  getById: (id: string) => api.get<{ application: any }>(`/applications/${id}`),

  // Submit new ad account application
  create: (data: {
    platform: string
    licenseType: 'NEW' | 'OLD'
    licenseNo?: string
    pageUrls?: string
    isApp?: string
    shopifyShop?: boolean
    accountDetails: { name: string }[]
    depositAmount: number
    remarks?: string
  }) => api.post<{ message: string; application: any }>('/applications', data),
}

// Domains API (User - view agent's approved domain)
export const domainsApi = {
  getAgentDomain: () => api.get<{ domain: any; agent: any }>('/domains/user'),
}
