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

    const errorData = await response.json().catch(() => ({ message: `Request failed with status ${response.status}` }))
    // API returns { error: "..." } format, but some endpoints return { message: "..." }
    const errorMessage = errorData.error || errorData.message || `Request failed with status ${response.status}`
    throw new Error(errorMessage)
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
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/change-password', data),
  // Email verification
  email: {
    sendCode: () => api.post<{ message: string; code?: string }>('/auth/email/send-code', {}),
    verify: (code: string) => api.post<{ message: string }>('/auth/email/verify', { code }),
    sendChangeCode: (newEmail: string) => api.post<{ message: string }>('/auth/email/change/send-code', { newEmail }),
    verifyChange: (newEmail: string, code: string) => api.post<{ message: string }>('/auth/email/change/verify', { newEmail, code }),
  },
  // Two-factor authentication
  twoFactor: {
    setup: () => api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', {}),
    verify: (code: string) => api.post<{ message: string }>('/auth/2fa/verify', { code }),
    disable: (data: { password: string }) => api.post<{ message: string }>('/auth/2fa/disable', data),
  },
}

// Settings API
export const settingsApi = {
  profile: {
    update: (data: { realName?: string; phone?: string; phone2?: string }) =>
      api.patch<{ user: any }>('/settings/profile', data),
    updateAvatar: (base64: string) =>
      api.patch<{ user: any }>('/settings/profile/avatar', { profileImage: base64 }),
  },
  platforms: {
    get: () => api.get<{ platforms: { facebook: string; google: string; tiktok: string; snapchat: string; bing: string } }>('/settings/platforms'),
  },
}

// Dashboard API (Agent specific)
export const dashboardApi = {
  getStats: (period?: string) => api.get<any>(`/dashboard/agent${period ? `?period=${period}` : ''}`),
  getTopSpenders: (weekFilter: 'current' | 'last') => api.get<any>(`/dashboard/agent?weekFilter=${weekFilter}`),
}

// Users API (Agent manages their users)
export const usersApi = {
  getAll: () => api.get<{ users: any[] }>('/users'),
  getById: (id: string) => api.get<{ user: any }>(`/users/${id}`),
  create: (data: any) => api.post<{ user: any }>('/users', data),
  update: (id: string, data: any) => api.patch<{ user: any }>(`/users/${id}`, data),
  delete: (id: string) => api.delete<{ message: string }>(`/users/${id}`),
  giveCoupons: (id: string, amount: number) =>
    api.post<{ message: string; user: any; agentCouponsRemaining: number }>(`/users/${id}/give-coupons`, { amount }),
  takeCoupons: (id: string, amount: number) =>
    api.post<{ message: string; user: any; agentCouponsRemaining: number }>(`/users/${id}/take-coupons`, { amount }),
  // Distribute money from agent wallet to user wallet
  distributeMoney: (userId: string, data: { amount: number; remarks?: string }) =>
    api.post<{ message: string; user: any; agentBalance: number }>(`/users/${userId}/distribute-money`, data),
  // Block/unblock user
  block: (id: string, reason?: string) =>
    api.post<{ message: string }>(`/users/${id}/block`, { reason }),
  unblock: (id: string) =>
    api.post<{ message: string }>(`/users/${id}/unblock`, {}),
}

// Payment Methods API
export const paymentMethodsApi = {
  getAll: () => api.get<{ paymentMethods: { id: string; name: string; description: string; icon: string }[] }>('/payment-methods'),
}

// Transactions API
export const transactionsApi = {
  deposits: {
    getAll: () => api.get<{ deposits: any[] }>('/transactions/deposits'),
    create: (data: any) => api.post<{ deposit: any; newBalance?: number; verification?: { valid: boolean } }>('/transactions/deposits', data),
  },
  // Agent's own deposits (for Add Money page)
  agentDeposits: {
    getAll: () => api.get<{ deposits: any[] }>('/transactions/agent-deposits'),
    create: (data: any) => api.post<{ deposit: any; newBalance?: number; verification?: { valid: boolean } }>('/transactions/agent-deposits', data),
  },
  withdrawals: {
    getAll: () => api.get<{ withdrawals: any[] }>('/transactions/withdrawals'),
    create: (data: any) => api.post<{ withdrawal: any }>('/transactions/withdrawals', data),
  },
  walletFlow: {
    getAll: () => api.get<{ flows: any[] }>('/transactions/wallet-flow'),
  },
  // Agent's own wallet flow (for Add Money page)
  agentWalletFlow: {
    getAll: () => api.get<{ flows: any[] }>('/transactions/agent-wallet-flow'),
  },
  payLinkRequests: {
    getAll: () => api.get<{ payLinkRequests: any[] }>('/transactions/pay-link-requests'),
    create: (data: any) => api.post<{ payLinkRequest: any }>('/transactions/pay-link-requests', data),
  },
  // Agent's own pay link requests (for Add Money page)
  agentPayLinkRequests: {
    getAll: () => api.get<{ payLinkRequests: any[] }>('/transactions/agent-pay-link-requests'),
    create: (data: any) => api.post<{ payLinkRequest: any }>('/transactions/agent-pay-link-requests', data),
  },
  settings: {
    getPayLinkEnabled: () => api.get<{ payLinkEnabled: boolean }>('/transactions/settings/pay-link'),
  },
  accountDeposits: {
    getAll: (params?: { status?: string; platform?: string; page?: number; limit?: number }) => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.platform) queryParams.append('platform', params.platform)
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      const queryString = queryParams.toString()
      return api.get<{ deposits: any[]; pagination: any }>(`/transactions/account-deposits${queryString ? `?${queryString}` : ''}`)
    },
  },
}

// Applications API (Ad Account Opening)
export const applicationsApi = {
  getAll: (params?: { status?: string; platform?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append('status', params.status)
    if (params?.platform) queryParams.append('platform', params.platform)
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    const queryString = queryParams.toString()
    return api.get<{ applications: any[]; pagination: any }>(`/applications${queryString ? `?${queryString}` : ''}`)
  },
}

// Accounts API
export const accountsApi = {
  getAll: (platform?: string) => api.get<{ accounts: any[] }>(`/accounts${platform ? `?platform=${platform}` : ''}`),
  getById: (id: string) => api.get<{ account: any }>(`/accounts/${id}`),
  create: (data: any) => api.post<{ account: any }>('/accounts', data),
  update: (id: string, data: any) => api.put<{ account: any }>(`/accounts/${id}`, data),
  // Agent: Get all ad accounts for users under this agent with Cheetah status
  getAgentAll: (params?: { platform?: string; search?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams()
    if (params?.platform) queryParams.append('platform', params.platform)
    if (params?.search) queryParams.append('search', params.search)
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    const queryString = queryParams.toString()
    return api.get<{ accounts: any[]; showBalanceToAgents: boolean; pagination: any }>(`/accounts/agent-all${queryString ? `?${queryString}` : ''}`)
  },
}

// Domains API (Agent whitelabel - domain + logo)
export const domainsApi = {
  getAll: () => api.get<{ domains: any[] }>('/domains'),
  submit: (data: { domain: string; brandLogo?: string }) =>
    api.post<{ message: string; domain: any; dnsInstructions: any }>('/domains', data),
  update: (id: string, data: { brandLogo?: string }) =>
    api.patch<{ message: string; domain: any }>(`/domains/${id}`, data),
  verify: (id: string) =>
    api.post<{ message: string; dnsVerified: boolean }>(`/domains/${id}/verify`, {}),
  delete: (id: string) => api.delete<{ message: string }>(`/domains/${id}`),
  getDnsConfig: () => api.get<{ vpsIp: string }>('/domains/dns-config'),
}

// Branding API (Agent email sender name + branding)
export const brandingApi = {
  get: () => api.get<{ branding: { id: string; brandLogo: string | null; brandName: string | null; emailSenderName: string | null; emailSenderNameApproved: string | null; emailSenderNameStatus: string | null } }>('/agents/branding'),
  update: (data: { brandLogo?: string; brandName?: string; emailSenderName?: string }) =>
    api.patch<{ message: string; agent: any }>('/agents/branding', data),
}

// SMTP Configuration API
export const smtpApi = {
  get: () => api.get<{ smtp: {
    smtpEnabled: boolean;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUsername: string | null;
    smtpPassword: string | null;
    smtpEncryption: string | null;
    smtpFromEmail: string | null;
  } }>('/agents/smtp'),
  update: (data: {
    smtpEnabled: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUsername?: string;
    smtpPassword?: string;
    smtpEncryption?: string;
    smtpFromEmail?: string;
  }) => api.patch<{ message: string; smtp: any }>('/agents/smtp', data),
  test: (data: {
    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword: string;
    smtpEncryption: string;
    smtpFromEmail: string;
    testEmail?: string;
  }) => api.post<{ success: boolean; message?: string; error?: string }>('/agents/smtp/test', data),
}

// Agent Withdrawals API
export const agentWithdrawalsApi = {
  getStats: () => api.get<{
    availableToWithdraw: number
    todayRevenue: number
    totalAdAccounts: number
    pendingAccounts: number
    totalEarned: number
    totalWithdrawn: number
    pendingWithdrawalAmount: number
    minimumWithdrawal: number
    canWithdraw: boolean
  }>('/agent-withdrawals/stats'),

  getAll: (params?: { page?: number; limit?: number; status?: string }) => {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.status) queryParams.append('status', params.status)
    const queryString = queryParams.toString()
    return api.get<{ withdrawals: any[]; pagination: any }>(`/agent-withdrawals${queryString ? `?${queryString}` : ''}`)
  },

  create: (data: { amount: number; paymentAddress?: string; paymentMethod?: string; description?: string }) =>
    api.post<{ message: string; withdrawal: any }>('/agent-withdrawals', data),
}

// BM & AD Request API
export const bmAdRequestApi = {
  getStats: () => api.get<{
    totalAdAccounts: number
    totalApprovedRecharges: number
    totalPendingRequests: number
    totalRejectedRequests: number
  }>('/bm-ad-request/stats'),

  getApplications: (params?: { status?: string; platform?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append('status', params.status)
    if (params?.platform) queryParams.append('platform', params.platform)
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    const queryString = queryParams.toString()
    return api.get<{ applications: any[]; pagination: any }>(`/bm-ad-request/applications${queryString ? `?${queryString}` : ''}`)
  },

  getApplicationDetails: (id: string) => api.get<{ application: any }>(`/bm-ad-request/applications/${id}`),

  getBmShares: (params?: { status?: string; platform?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append('status', params.status)
    if (params?.platform) queryParams.append('platform', params.platform)
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    const queryString = queryParams.toString()
    return api.get<{ bmShares: any[]; pagination: any }>(`/bm-ad-request/bm-shares${queryString ? `?${queryString}` : ''}`)
  },
}
