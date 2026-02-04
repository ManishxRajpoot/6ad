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

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }))
      const error: any = new Error(errorData.message || errorData.error || 'Request failed')
      error.response = { data: errorData, status: response.status }
      throw error
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
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: any }>('/auth/login', data),
  me: () => api.get<{ user: any }>('/auth/me'),
}

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get<any>('/dashboard/admin'),
}

// Agents API
export const agentsApi = {
  getAll: () => api.get<{ agents: any[] }>('/agents'),
  getById: (id: string) => api.get<{ agent: any }>(`/agents/${id}`),
  create: (data: any) => api.post<{ agent: any }>('/agents', data),
  update: (id: string, data: any) => api.patch<{ agent: any }>(`/agents/${id}`, data),
  delete: (id: string) => api.delete<{ message: string }>(`/agents/${id}`),
  block: (id: string, reason: string) => api.post<{ message: string }>(`/agents/${id}/block`, { reason }),
  unblock: (id: string) => api.post<{ message: string }>(`/agents/${id}/unblock`, {}),
  addCoupons: (agentId: string, amount: number) => api.post<{ message: string; agent: any }>(`/agents/${agentId}/add-coupons`, { amount }),
  removeCoupons: (agentId: string, amount: number) => api.post<{ message: string; agent: any }>(`/agents/${agentId}/remove-coupons`, { amount }),
  // Email Sender Name Approvals
  emailSettings: {
    getPending: () => api.get<{ requests: any[] }>('/agents/email-settings/pending'),
    approve: (id: string) => api.patch<{ message: string; agent: any }>(`/agents/email-settings/${id}/approve`, {}),
    reject: (id: string, reason?: string) => api.patch<{ message: string; agent: any }>(`/agents/email-settings/${id}/reject`, { reason }),
  }
}

// Users API
export const usersApi = {
  getAll: () => api.get<{ users: any[] }>('/users'),
  getById: (id: string) => api.get<{ user: any }>(`/users/${id}`),
  create: (data: any) => api.post<{ user: any }>('/users', data),
  update: (id: string, data: any) => api.patch<{ user: any }>(`/users/${id}`, data),
  delete: (id: string) => api.delete<{ message: string }>(`/users/${id}`),
  addCoupons: (userId: string, amount: number) => api.post<{ message: string; user: any }>(`/users/${userId}/coupons`, { amount }),
  removeCoupons: (userId: string, amount: number) => api.post<{ message: string; user: any }>(`/users/${userId}/remove-coupons`, { amount }),
}

// Transactions API
export const transactionsApi = {
  deposits: {
    getAll: () => api.get<{ deposits: any[] }>('/transactions/deposits'),
    approve: (id: string) => api.post<{ deposit: any }>(`/transactions/deposits/${id}/approve`, {}),
    reject: (id: string, reason: string) => api.post<{ deposit: any }>(`/transactions/deposits/${id}/reject`, { adminRemarks: reason }),
    update: (id: string, data: { amount?: number; createdAt?: string }) => api.patch<{ deposit: any }>(`/transactions/deposits/${id}`, data),
    bulkApprove: (ids: string[]) => api.post<{ message: string; count: number }>('/transactions/deposits/bulk-approve', { ids }),
    bulkReject: (ids: string[], reason?: string) => api.post<{ message: string; count: number }>('/transactions/deposits/bulk-reject', { ids, reason }),
  },
  withdrawals: {
    getAll: () => api.get<{ withdrawals: any[] }>('/transactions/withdrawals'),
    approve: (id: string) => api.post<{ withdrawal: any }>(`/transactions/withdrawals/${id}/approve`, {}),
    reject: (id: string, reason: string) => api.post<{ withdrawal: any }>(`/transactions/withdrawals/${id}/reject`, { adminRemarks: reason }),
  },
  refunds: {
    getAll: () => api.get<{ refunds: any[] }>('/transactions/refunds'),
    approve: (id: string) => api.post<{ refund: any }>(`/transactions/refunds/${id}/approve`, {}),
    reject: (id: string, reason: string) => api.post<{ refund: any }>(`/transactions/refunds/${id}/reject`, { adminRemarks: reason }),
  },
  payLinkRequests: {
    getAll: () => api.get<{ payLinkRequests: any[] }>('/transactions/pay-link-requests'),
    createLink: (id: string, payLink: string, adminRemarks?: string) =>
      api.post<{ payLinkRequest: any }>(`/transactions/pay-link-requests/${id}/create-link`, { payLink, adminRemarks }),
    reject: (id: string, adminRemarks?: string) =>
      api.post<{ message: string }>(`/transactions/pay-link-requests/${id}/reject`, { adminRemarks }),
    complete: (id: string) =>
      api.post<{ message: string }>(`/transactions/pay-link-requests/${id}/complete`, {}),
  },
  settings: {
    getPayLinkEnabled: () => api.get<{ payLinkEnabled: boolean }>('/transactions/settings/pay-link'),
    setPayLinkEnabled: (enabled: boolean) => api.post<{ payLinkEnabled: boolean }>('/transactions/settings/pay-link', { enabled }),
  },
  creditAction: (data: {
    userId: string
    amount: number
    mode: 'deposit' | 'remove'
    transactionId?: string
    payway?: string
    description?: string
    paymentProof?: string
    remarks?: string
  }) => api.post<{ message: string; user: any }>('/transactions/credit-action', data),
}

// Accounts API
export const accountsApi = {
  getAll: (platform?: string) => api.get<{ accounts: any[] }>(`/accounts${platform ? `?platform=${platform}` : ''}`),
  getById: (id: string) => api.get<{ account: any }>(`/accounts/${id}`),
  create: (data: any) => api.post<{ account: any }>('/accounts', data),
  update: (id: string, data: any) => api.put<{ account: any }>(`/accounts/${id}`, data),
  delete: (id: string) => api.delete<{ message: string }>(`/accounts/${id}`),
}

// Settings API
export const settingsApi = {
  paylinks: {
    getAll: () => api.get<{ paylinks: any[] }>('/settings/paylinks'),
    create: (data: any) => api.post<{ paylink: any }>('/settings/paylinks', data),
    update: (id: string, data: any) => api.put<{ paylink: any }>(`/settings/paylinks/${id}`, data),
    delete: (id: string) => api.delete<{ message: string }>(`/settings/paylinks/${id}`),
  },
  platforms: {
    get: () => api.get<{ platforms: { facebook: string; google: string; tiktok: string; snapchat: string; bing: string } }>('/settings/platforms'),
    update: (data: { facebook?: string; google?: string; tiktok?: string; snapchat?: string; bing?: string }) =>
      api.patch<{ message: string; platforms: any }>('/settings/platforms', data),
  },
  profileShareLinks: {
    get: () => api.get<{ profileShareLinks: { facebook: string; tiktok: string } }>('/settings/profile-share-links'),
    update: (data: { facebook?: string; tiktok?: string }) =>
      api.patch<{ message: string; profileShareLinks: { facebook: string; tiktok: string } }>('/settings/profile-share-links', data),
  },
  referralDomain: {
    get: () => api.get<{ referralDomain: string }>('/settings/referral-domain'),
    update: (domain: string) => api.put<{ message: string; referralDomain: string }>('/settings/referral-domain', { referralDomain: domain }),
  },
  // Email Branding Settings
  emailBranding: {
    get: () => api.get<{ branding: {
      brandName: string
      brandLogo: string
      primaryColor: string
      secondaryColor: string
      senderEmail: string
      senderName: string
      helpCenterUrl: string
      contactSupportUrl: string
    } }>('/settings/email-branding'),
    update: (data: {
      brandName?: string
      brandLogo?: string
      primaryColor?: string
      secondaryColor?: string
      senderEmail?: string
      senderName?: string
      helpCenterUrl?: string
      contactSupportUrl?: string
    }) => api.patch<{ message: string; branding: any }>('/settings/email-branding', data),
  },
  // SMTP Settings
  smtp: {
    get: () => api.get<{ smtp: {
      host: string
      port: number
      secure: boolean
      user: string
      isConfigured: boolean
    } }>('/settings/smtp'),
    update: (data: {
      host: string
      port: number
      secure: boolean
      user: string
      password?: string
    }) => api.patch<{ message: string }>('/settings/smtp', data),
    test: (email: string) => api.post<{ success: boolean; message: string }>('/settings/smtp/test', { email }),
  },
  // Referral Settings
  referrals: {
    get: () => api.get<{ settings: { commissionRate: number; minWithdrawal: number; maxTiers: number } }>('/settings/referrals'),
    update: (data: { commissionRate?: number; minWithdrawal?: number; maxTiers?: number }) =>
      api.patch<{ message: string; settings: any }>('/settings/referrals', data),
  },
}

// Payment Methods API
export const paymentMethodsApi = {
  getAll: (showAll?: boolean) => api.get<{ paymentMethods: any[] }>(`/payment-methods${showAll ? '?all=true' : ''}`),
  getById: (id: string) => api.get<{ paymentMethod: any }>(`/payment-methods/${id}`),
  create: (data: any) => api.post<{ paymentMethod: any; message: string }>('/payment-methods', data),
  update: (id: string, data: any) => api.patch<{ paymentMethod: any; message: string }>(`/payment-methods/${id}`, data),
  delete: (id: string) => api.delete<{ message: string }>(`/payment-methods/${id}`),
  reorder: (orders: { id: string; sortOrder: number }[]) => api.post<{ message: string }>('/payment-methods/reorder', { orders }),
}

// Ad Account Applications API
export const applicationsApi = {
  // Get all applications with optional filters
  getAll: (platform: string, status?: string, page?: number, limit?: number) => {
    const params = new URLSearchParams()
    params.append('platform', platform)
    if (status) params.append('status', status)
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())
    return api.get<{ applications: any[]; total: number; page: number; totalPages: number }>(`/applications/admin?${params.toString()}`)
  },

  // Get application stats by platform
  getStats: (platform: string) => api.get<{
    totalBalance: number
    approved: number
    pending: number
    rejected: number
  }>(`/applications/admin/stats?platform=${platform}`),

  // Get single application by ID
  getById: (id: string) => api.get<{ application: any }>(`/applications/${id}`),

  // Update application
  update: (id: string, data: any) => api.put<{ application: any }>(`/applications/${id}`, data),

  // Approve application with account IDs
  approve: (id: string, accountIds: { name: string; accountId: string }[]) =>
    api.post<{ application: any; accounts: any[] }>(`/applications/${id}/approve`, { accountIds }),

  // Reject application
  reject: (id: string, refund: boolean, adminRemarks?: string) =>
    api.post<{ application: any }>(`/applications/${id}/reject`, { refund, adminRemarks }),

  // Create ad account directly (without application)
  createDirect: (userId: string, platform: string, accounts: { name: string; accountId: string; bmId?: string; timezone?: string; currency?: string }[]) =>
    api.post<{ accounts: any[] }>('/applications/create-direct', { userId, platform, accounts }),

  // Bulk approve applications
  bulkApprove: (ids: string[], accountData: { [applicationId: string]: { name: string; accountId: string }[] }) =>
    api.post<{ message: string; count: number }>('/applications/bulk-approve', { applicationIds: ids, accountData }),

  // Bulk reject applications
  bulkReject: (ids: string[], refund: boolean, adminRemarks?: string) =>
    api.post<{ message: string; count: number }>('/applications/bulk-reject', { applicationIds: ids, refund, adminRemarks }),
}

// BM Share Requests API (Admin)
export const bmShareApi = {
  getAll: (platform?: string, status?: string) => {
    const params = new URLSearchParams()
    if (platform) params.append('platform', platform)
    if (status) params.append('status', status)
    const queryString = params.toString()
    return api.get<{ bmShareRequests: any[]; pagination: any }>(`/bm-share/admin${queryString ? `?${queryString}` : ''}`)
  },
  approve: (id: string, adminRemarks?: string) =>
    api.post<{ message: string; bmShareRequest: any }>(`/bm-share/${id}/approve`, { adminRemarks }),
  reject: (id: string, adminRemarks?: string) =>
    api.post<{ message: string; bmShareRequest: any }>(`/bm-share/${id}/reject`, { adminRemarks }),
}

// Account Deposits API (Admin)
export const accountDepositsApi = {
  getAll: (platform?: string, status?: string) => {
    const params = new URLSearchParams()
    if (platform) params.append('platform', platform)
    if (status) params.append('status', status)
    const queryString = params.toString()
    return api.get<{ deposits: any[]; pagination: any }>(`/accounts/deposits/admin${queryString ? `?${queryString}` : ''}`)
  },
  approve: (id: string, adminRemarks?: string) =>
    api.post<{ message: string; deposit: any }>(`/accounts/deposits/${id}/approve`, { adminRemarks }),
  reject: (id: string, adminRemarks?: string) =>
    api.post<{ message: string; deposit: any }>(`/accounts/deposits/${id}/reject`, { adminRemarks }),
}

// Account Refunds API (Admin)
export const accountRefundsApi = {
  getAll: (platform?: string, status?: string) => {
    const params = new URLSearchParams()
    if (platform) params.append('platform', platform)
    if (status) params.append('status', status)
    const queryString = params.toString()
    return api.get<{ refunds: any[]; pagination: any }>(`/accounts/refunds/admin${queryString ? `?${queryString}` : ''}`)
  },
  approve: (id: string, adminRemarks?: string) =>
    api.post<{ message: string; refund: any }>(`/accounts/refunds/${id}/approve`, { adminRemarks }),
  reject: (id: string, adminRemarks?: string) =>
    api.post<{ message: string; refund: any }>(`/accounts/refunds/${id}/reject`, { adminRemarks }),
  updateAmount: (id: string, amount: number) =>
    api.patch<{ message: string; refund: any }>(`/accounts/refunds/${id}`, { amount }),
}

// Balance Transfers API (Admin)
export const balanceTransfersApi = {
  getAll: (platform?: string, status?: string) => {
    const params = new URLSearchParams()
    if (platform) params.append('platform', platform)
    if (status) params.append('status', status)
    const queryString = params.toString()
    return api.get<{ transfers: any[]; pagination: any }>(`/accounts/transfers/admin${queryString ? `?${queryString}` : ''}`)
  },
  approve: (id: string, adminRemarks?: string) =>
    api.post<{ message: string; transfer: any }>(`/accounts/transfers/${id}/approve`, { adminRemarks }),
  reject: (id: string, adminRemarks?: string) =>
    api.post<{ message: string; transfer: any }>(`/accounts/transfers/${id}/reject`, { adminRemarks }),
  updateAmount: (id: string, amount: number) =>
    api.patch<{ message: string; transfer: any }>(`/accounts/transfers/${id}`, { amount }),
}

// Custom Domains API (Admin)
export const domainsApi = {
  getAll: (status?: string) => {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    const queryString = params.toString()
    return api.get<{ domains: any[] }>(`/domains/admin/all${queryString ? `?${queryString}` : ''}`)
  },
  approve: (id: string, adminRemarks?: string) =>
    api.patch<{ message: string; domain: any }>(`/domains/admin/${id}`, { status: 'APPROVED', adminRemarks }),
  reject: (id: string, adminRemarks?: string) =>
    api.patch<{ message: string; domain: any }>(`/domains/admin/${id}`, { status: 'REJECTED', adminRemarks }),
}

// Announcements API (Admin)
export const announcementsApi = {
  getAllAdmin: () => api.get<{ announcements: any[] }>('/announcements/admin'),
  create: (data: { title: string; message: string; type: string; isActive?: boolean; targetRole?: string; startDate?: string; endDate?: string }) =>
    api.post<{ announcement: any }>('/announcements', data),
  update: (id: string, data: Partial<{ title: string; message: string; type: string; isActive: boolean; targetRole?: string; startDate?: string; endDate?: string }>) =>
    api.patch<{ announcement: any }>(`/announcements/${id}`, data),
  delete: (id: string) => api.delete<{ message: string }>(`/announcements/${id}`),
}

// Chat API (Admin)
export const chatApi = {
  getAdminRooms: () => api.get<{ rooms: any[] }>('/chat/admin/rooms'),
  getMessages: (roomId: string, options?: { limit?: number }) => {
    const params = new URLSearchParams()
    if (options?.limit) params.append('limit', options.limit.toString())
    const queryString = params.toString()
    return api.get<{ messages: any[] }>(`/chat/messages/${roomId}${queryString ? `?${queryString}` : ''}`)
  },
  sendAdminMessage: (data: { roomId: string; message: string }) =>
    api.post<{ message: any }>('/chat/admin/send', data),
  closeRoom: (id: string) => api.patch<{ room: any }>(`/chat/admin/rooms/${id}/close`, {}),
  reopenRoom: (id: string) => api.patch<{ room: any }>(`/chat/admin/rooms/${id}/reopen`, {}),
  assignAgent: (id: string, agentId: string) => api.patch<{ room: any }>(`/chat/admin/rooms/${id}/assign`, { agentId }),
}

// Notifications API (Admin)
export const notificationsApi = {
  getAdminLogs: () => api.get<{ notifications: any[] }>('/notifications/admin/logs'),
  send: (data: { userId: string; type: string; title: string; message: string; link?: string }) =>
    api.post<{ notification: any }>('/notifications/admin/send', data),
  sendToAll: (data: { type: string; title: string; message: string; link?: string }) =>
    api.post<{ count: number }>('/notifications/admin/send-all', data),
}

// Referrals API (Admin)
export const referralsApi = {
  getAll: () => api.get<{ referrals: any[] }>('/referrals/admin'),
}

// Agent Withdrawals API (Admin)
export const agentWithdrawalsApi = {
  getAll: (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.status) query.append('status', params.status)
    if (params?.search) query.append('search', params.search)
    if (params?.page) query.append('page', params.page.toString())
    if (params?.limit) query.append('limit', params.limit.toString())
    const queryString = query.toString()
    return api.get<{ withdrawals: any[]; pagination: any }>(`/agent-withdrawals/admin${queryString ? `?${queryString}` : ''}`)
  },
  approve: (id: string, data?: { approvedAmount?: number; adminRemarks?: string }) =>
    api.post<{ message: string; requestedAmount: number; approvedAmount: number }>(`/agent-withdrawals/${id}/approve`, data || {}),
  reject: (id: string, adminRemarks?: string) =>
    api.post<{ message: string }>(`/agent-withdrawals/${id}/reject`, { adminRemarks }),
}

// Cheetah Mobile API (猎豹移动)
export const cheetahApi = {
  // Configuration
  config: {
    getStatus: () => api.get<{ isConfigured: boolean; baseUrl: string | null; environment?: string }>('/cheetah/config/status'),
    update: (data: { environment: 'test' | 'production' }) =>
      api.post<{ message: string; environment: string }>('/cheetah/config', data),
    test: () => api.post<{ success: boolean; message: string; quota?: string }>('/cheetah/config/test', {}),
  },
  // Account operations
  accounts: {
    getAll: (params?: { page?: number; page_size?: number; account_id?: string; account_status?: string }) => {
      const query = new URLSearchParams()
      if (params?.page) query.append('page', params.page.toString())
      if (params?.page_size) query.append('page_size', params.page_size.toString())
      if (params?.account_id) query.append('account_id', params.account_id)
      if (params?.account_status) query.append('account_status', params.account_status)
      return api.get<{ list: any[]; pager: any }>(`/cheetah/accounts?${query.toString()}`)
    },
    getOne: (accountId: string) => api.get<{ account: any }>(`/cheetah/accounts/${accountId}`),
    updateName: (accountId: string, name: string) =>
      api.patch<{ message: string }>(`/cheetah/accounts/${accountId}/name`, { name }),
    recharge: (accountId: string, spendCap: number) =>
      api.post<{ message: string; serial_number: string }>(`/cheetah/accounts/${accountId}/recharge`, { spend_cap: spendCap }),
    reset: (accountId: string) =>
      api.post<{ message: string; reset_amount: string; serial_number: string }>(`/cheetah/accounts/${accountId}/reset`, {}),
    getOperations: (accountId: string) =>
      api.get<{ operations: any[] }>(`/cheetah/accounts/${accountId}/operations`),
    getUsage: (accountId: string) =>
      api.get<{ used_count: number; remaining: number }>(`/cheetah/accounts/${accountId}/usage`),
  },
  // BM Share operations
  bm: {
    bind: (accountId: string, businessId: string, type: 0 | 1 | 2) =>
      api.post<{ message: string }>('/cheetah/bm/bind', { account_id: accountId, business_id: businessId, type }),
    getBindings: (accountId: string) =>
      api.get<{ account_id: string; business_id: string[] }>(`/cheetah/bm/bindings/${accountId}`),
  },
  // Pixel operations
  pixel: {
    bind: (pixelId: string, accountId: string, type: 1 | 2) =>
      api.post<{ message: string }>('/cheetah/pixel/bind', { pixel_id: pixelId, account_id: accountId, type }),
    getBindings: (params: { pixel_id?: string; account_id?: string }) => {
      const query = new URLSearchParams()
      if (params.pixel_id) query.append('pixel_id', params.pixel_id)
      if (params.account_id) query.append('account_id', params.account_id)
      return api.get<any>(`/cheetah/pixel/bindings?${query.toString()}`)
    },
    submitBMJob: (bindings: { pixel_id: string; bm_id: string; operate: '1' | '2' }[]) =>
      api.post<{ message: string; job_id: string }>('/cheetah/pixel/bm-job', bindings),
  },
  // Job operations
  jobs: {
    getStatus: (jobId: string) => api.get<any>(`/cheetah/jobs/${jobId}/status`),
    getAll: (params?: { page?: number; page_size?: number; job_status?: number }) => {
      const query = new URLSearchParams()
      if (params?.page) query.append('page', params.page.toString())
      if (params?.page_size) query.append('page_size', params.page_size.toString())
      if (params?.job_status) query.append('job_status', params.job_status.toString())
      return api.get<{ list: any[]; pager: any }>(`/cheetah/jobs?${query.toString()}`)
    },
    createOELink: () => api.post<{ token: string; open_account_link: string }>('/cheetah/jobs/oe-link', {}),
  },
  // Spending/Insights
  spend: {
    getDaily: (accountId: string, startDate: string, endDate: string) =>
      api.get<{ spend: any[] }>(`/cheetah/spend/daily?account_id=${accountId}&start_date=${startDate}&end_date=${endDate}`),
    getTotal: (date: string) =>
      api.get<{ date: string; total_spend: string }>(`/cheetah/spend/total?date=${date}`),
  },
  insights: {
    get: (accountId: string, date: string, fields?: string) =>
      api.get<{ insights: any }>(`/cheetah/insights?account_id=${accountId}&date=${date}${fields ? `&fields=${fields}` : ''}`),
    getRange: (accountId: string, startDate: string, endDate: string, fields?: string) =>
      api.get<{ insights: any }>(`/cheetah/insights?account_id=${accountId}&start_date=${startDate}&end_date=${endDate}${fields ? `&fields=${fields}` : ''}`),
  },
  // Finance
  finance: {
    getQuota: () => api.get<{ available_quota: string; available_quota_usd: number }>('/cheetah/quota'),
    getPayments: (page?: number, pageSize?: number) =>
      api.get<{ list: any[]; pager: any }>(`/cheetah/payments?page=${page || 1}&page_size=${pageSize || 10}`),
  },
}

// Crypto Wallet Configuration API
export const cryptoApi = {
  config: {
    getAll: () => api.get<{ configs: any[] }>('/transactions/crypto/config'),
    save: (data: { network: string; walletAddress: string; isEnabled?: boolean }) =>
      api.post<{ message: string; config: any }>('/transactions/crypto/config', data),
    update: (network: string, data: { walletAddress?: string; isEnabled?: boolean }) =>
      api.patch<{ message: string; config: any }>(`/transactions/crypto/config/${network}`, data),
  },
}

// BM Configuration API - Manage multiple Facebook Business Managers
export const bmConfigApi = {
  // Get all BM configurations
  getAll: () => api.get<{ configs: BMConfig[] }>('/bm-config'),

  // Get single BM config with full token
  getOne: (id: string) => api.get<{ config: BMConfigFull }>(`/bm-config/${id}`),

  // Create new BM configuration
  create: (data: { bmId: string; bmName: string; accessToken: string; apiType?: 'facebook' | 'cheetah' }) =>
    api.post<{ message: string; config: BMConfig }>('/bm-config', data),

  // Update BM configuration
  update: (id: string, data: { bmName?: string; accessToken?: string; isActive?: boolean }) =>
    api.put<{ message: string; config: BMConfig }>(`/bm-config/${id}`, data),

  // Delete BM configuration
  delete: (id: string) => api.delete<{ message: string }>(`/bm-config/${id}`),

  // Test BM connection
  test: (id: string) => api.post<{ success: boolean; bmName?: string; accountCount?: number; message?: string; error?: string }>(`/bm-config/${id}/test`, {}),

  // Sync accounts from BM
  syncAccounts: (id: string) => api.post<{ success: boolean; accounts: any[]; total: number; error?: string }>(`/bm-config/${id}/sync-accounts`, {}),
}

// Types for BM Config
export interface BMConfig {
  id: string
  bmId: string
  bmName: string
  apiType: 'facebook' | 'cheetah'
  isActive: boolean
  totalAccounts: number
  lastSyncAt: string | null
  createdAt: string
}

export interface BMConfigFull extends BMConfig {
  accessToken: string
  fullToken: string
}
