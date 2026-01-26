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
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }))
    const error: any = new Error(errorData.message || errorData.error || 'Request failed')
    error.response = { data: errorData, status: response.status }
    throw error
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
}

// Users API
export const usersApi = {
  getAll: () => api.get<{ users: any[] }>('/users'),
  getById: (id: string) => api.get<{ user: any }>(`/users/${id}`),
  create: (data: any) => api.post<{ user: any }>('/users', data),
  update: (id: string, data: any) => api.patch<{ user: any }>(`/users/${id}`, data),
  delete: (id: string) => api.delete<{ message: string }>(`/users/${id}`),
  addCoupons: (userId: string, amount: number) => api.post<{ message: string; user: any }>(`/users/${userId}/coupons`, { amount }),
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
