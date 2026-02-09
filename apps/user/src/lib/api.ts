const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

type RequestOptions = {
  method?: string
  body?: any
  headers?: Record<string, string>
}

// Auto logout function - clears token and redirects to login
function handleAutoLogout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // Only redirect if not already on the login page (prevents reload loop)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
  }
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

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Request failed' }))

      // Check for authentication errors - auto logout
      if (response.status === 401) {
        // Check if this is a login/auth flow request (login page security wizard)
        const isAuthFlow = endpoint.includes('/auth/')

        if (isAuthFlow) {
          // Auth flow failure - throw the actual API error message (don't auto-logout)
          throw new Error(errorData.error || errorData.message || 'Authentication failed')
        }

        // Token invalid/expired - auto logout
        handleAutoLogout()
        return Promise.reject(new Error('Session expired. Please login again.'))
      }

      // Also auto-logout if user not found (stale JWT from before migration)
      if (response.status === 404) {
        const msg = (errorData.error || errorData.message || '').toLowerCase()
        if (msg.includes('user not found')) {
          handleAutoLogout()
          return Promise.reject(new Error('Session expired. Please login again.'))
        }
      }

      throw new Error(errorData.error || errorData.message || 'Request failed')
    }

    return response.json()
  } catch (error) {
    // Handle network errors (server not running, CORS, etc.)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to server. Please check if the API is running.')
    }
    throw error
  }
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
  login: (data: { email: string; password: string; totpCode?: string; emailOtp?: string }) =>
    api.post<{ token: string; user: any; requires2FA?: boolean; maskedEmail?: string; message?: string }>('/auth/login', data),
  register: (data: { email: string; password: string; username: string; referralCode?: string }) =>
    api.post<{ token: string; user: any }>('/auth/register', data),
  me: () => api.get<{ user: any }>('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/change-password', data),
  setPassword: (data: { newPassword: string }) =>
    api.post<{ message: string }>('/auth/password/change', data),
  checkUsername: (username: string) =>
    api.get<{ available: boolean; error?: string }>(`/auth/check-username?username=${encodeURIComponent(username)}`),
  getReferrerInfo: (code: string) =>
    api.get<{ found: boolean; referrerUsername?: string; usernamePrefix?: string; agentId?: string }>(`/auth/referrer-info?code=${encodeURIComponent(code)}`),
  // 2FA
  twoFactor: {
    setup: () => api.post<{ secret: string; otpauthUrl: string; message: string }>('/auth/2fa/setup', {}),
    verify: (code: string) => api.post<{ message: string }>('/auth/2fa/verify', { code }),
    disable: (data: { password: string; code?: string }) => api.post<{ message: string }>('/auth/2fa/disable', data),
    status: () => api.get<{ enabled: boolean }>('/auth/2fa/status'),
    sendEmailCode: (email: string, password: string) =>
      api.post<{ message: string; maskedEmail: string }>('/auth/2fa/send-email-code', { email, password }),
  },
  // Email verification
  email: {
    sendCode: () => api.post<{ message: string; code?: string }>('/auth/email/send-code', {}),
    verify: (code: string) => api.post<{ message: string }>('/auth/email/verify', { code }),
    sendChangeCode: (newEmail: string) => api.post<{ message: string }>('/auth/email/change/send-code', { newEmail }),
    verifyChange: (newEmail: string, code: string) => api.post<{ message: string }>('/auth/email/change/verify', { newEmail, code }),
  },
}

// Dashboard API (User specific)
export const dashboardApi = {
  getStats: () => api.get<any>('/dashboard/user'),
}

// Accounts API (User's own accounts)
export const accountsApi = {
  getAll: (platform?: string) => api.get<{ accounts: any[] }>(`/accounts${platform ? `?platform=${platform}` : ''}`),
  getById: (id: string) => api.get<{ account: any }>(`/accounts/${id}`),
  getCheetahBalance: (id: string) => api.get<{ cheetahAccount: any; error?: string }>(`/accounts/${id}/cheetah-balance`),
  getCheetahBalancesBatch: (accountIds: string[]) =>
    api.get<{ balances: Record<string, any>; error?: string }>(`/accounts/cheetah-balances/batch?accountIds=${accountIds.join(',')}`),
  getMonthlyInsights: (accountId: string) =>
    api.get<{
      monthlyData: {
        month: string
        year: number
        deposits: number
        spent: number
        impressions: number
        clicks: number
        results: number
        conversions: number
        cpc: number
        ctr: number
        cpr: number
        cpm: number
        cpa: number
      }[]
      totals: {
        impressions: number
        clicks: number
        spent: number
        results: number
        conversions: number
        cpc: number
        ctr: number
        cpr: number
        cpm: number
        cpa: number
      } | null
      isCheetah: boolean
      error?: string
    }>(`/accounts/insights/monthly/${accountId}`),
  getInsightsDateRange: (id: string, startDate: string, endDate: string) =>
    api.get<{
      insights: any[] | null
      startDate: string
      endDate: string
      error?: string
    }>(`/accounts/${id}/insights?startDate=${startDate}&endDate=${endDate}`),
}

// Transactions API (User's own transactions)
export const transactionsApi = {
  deposits: {
    getAll: () => api.get<{ deposits: any[]; pagination: any }>('/transactions/deposits'),
    create: (data: any) => api.post<{
      message: string;
      deposit: any;
      newBalance?: number;
      verification?: { valid: boolean; error?: string; amount?: number; from?: string; confirmations?: number }
    }>('/transactions/deposits', data),
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
  // Check if a custom domain is valid and get branding info (public API)
  checkDomain: (domain: string) =>
    fetch(`${API_URL}/domains/check/${domain}`)
      .then(res => res.json())
      .then(data => data as { valid: boolean; domain?: string; branding?: { brandName: string | null; brandLogo: string | null }; agentId?: string; message?: string }),
}

// Platform Settings API (for visibility settings)
export type PlatformStatus = 'active' | 'stop' | 'hidden'
export type PlatformSettings = {
  facebook: PlatformStatus
  google: PlatformStatus
  tiktok: PlatformStatus
  snapchat: PlatformStatus
  bing: PlatformStatus
}

export const settingsApi = {
  platforms: {
    get: () => api.get<{ platforms: PlatformSettings }>('/settings/platforms'),
  },
  profileShareLinks: {
    get: () => api.get<{ profileShareLinks: { facebook: string; tiktok: string } }>('/settings/profile-share-links'),
  },
  referralDomain: {
    get: () => api.get<{ referralDomain: string }>('/settings/referral-domain'),
  },
  profile: {
    update: (data: { username?: string; phone?: string; phone2?: string; realName?: string; address?: string; website?: string; profileImage?: string }) =>
      api.patch<{ message: string; user: any }>('/settings/profile', data),
    updateAvatar: (profileImage: string) =>
      api.patch<{ message: string; user: any }>('/settings/profile/avatar', { profileImage }),
  },
}

// Referrals API
export const referralsApi = {
  getMyCode: () => api.get<{ referralCode: string; referralEarnings: number }>('/referrals/my-code'),
  getStats: () => api.get<{
    referralCode: string;
    stats: { totalReferrals: number; qualifiedReferrals: number; pendingRewards: number; totalEarned: number };
    referrals: any[]
  }>('/referrals/stats'),
  validateCode: (code: string) => api.post<{ valid: boolean; referrerName?: string; error?: string }>('/referrals/validate', { code }),
  applyCode: (code: string) => api.post<{ success: boolean; message: string }>('/referrals/apply', { code }),
}

// Notifications API
export const notificationsApi = {
  getAll: (params?: { limit?: number; offset?: number; unreadOnly?: boolean }) => {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    if (params?.unreadOnly) queryParams.append('unreadOnly', 'true')
    const queryString = queryParams.toString()
    return api.get<{ notifications: any[]; total: number; unreadCount: number }>(`/notifications${queryString ? `?${queryString}` : ''}`)
  },
  getUnreadCount: () => api.get<{ unreadCount: number }>('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch<{ success: boolean }>(`/notifications/${id}/read`, {}),
  markAllAsRead: () => api.patch<{ success: boolean }>('/notifications/read-all', {}),
  delete: (id: string) => api.delete<{ success: boolean }>(`/notifications/${id}`),
}

// Announcements API
export const announcementsApi = {
  getAll: () => api.get<{ announcements: any[] }>('/announcements'),
}

// Chat API
export const chatApi = {
  getRoom: () => api.get<{ room: any }>('/chat/room'),
  sendMessage: (data: { roomId?: string; message: string; attachmentUrl?: string; attachmentType?: string }) =>
    api.post<{ message: any }>('/chat/send', data),
  getMessages: (roomId: string, params?: { limit?: number; before?: string }) => {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.before) queryParams.append('before', params.before)
    const queryString = queryParams.toString()
    return api.get<{ messages: any[] }>(`/chat/messages/${roomId}${queryString ? `?${queryString}` : ''}`)
  },
  getUnreadCount: () => api.get<{ unreadCount: number }>('/chat/unread'),
}
