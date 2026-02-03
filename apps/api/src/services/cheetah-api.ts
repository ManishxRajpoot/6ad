import crypto from 'crypto'

// Cheetah Mobile Open API Service
// Documentation: 猎豹移动 OPEN API

interface CheetahConfig {
  appid: string
  secret: string
  baseUrl: string
}

interface CheetahAccount {
  account_id: string
  account_status: number
  account_status_text: string
  account_name: string
  spend_cap: string
  amount_spent: string
  total_amount_spent: string
  disable_reason: number
  created_time: number
  currency: string
  timezone_offset_hours_utc: string
  balance: string
  promotable_page_ids: string[]
  promotable_urls: string[]
  company_cn: string
  company_en: string
  funding_source_details: { type: number }
  business_registration_id: string
  request_id: string
  disabled_transfer_amount: string
  oe_id?: string
  freeze?: number
}

interface CheetahResponse<T> {
  code: number
  msg: string
  data: T
  log_id: string
}

// Account status map
export const ACCOUNT_STATUS = {
  1: 'ACTIVE',
  2: 'DISABLED',
  3: 'UNSETTLED',
  7: 'PENDING_RISK_REVIEW',
  8: 'PENDING_SETTLEMENT',
  9: 'IN_GRACE_PERIOD',
  100: 'PENDING_CLOSURE',
  101: 'CLOSED',
  201: 'ANY_ACTIVE',
  202: 'ANY_CLOSED',
} as const

// Disable reason map
export const DISABLE_REASON = {
  0: 'NONE',
  1: 'ADS_INTEGRITY_POLICY',
  2: 'ADS_IP_REVIEW',
  3: 'RISK_PAYMENT',
  4: 'GRAY_ACCOUNT_SHUT_DOWN',
  5: 'ADS_AFC_REVIEW',
  6: 'BUSINESS_INTEGRITY_RAR',
  7: 'PERMANENT_CLOSE',
  8: 'UNUSED_RESELLER_ACCOUNT',
  9: 'UNUSED_ACCOUNT',
  10: 'UMBRELLA_AD_ACCOUNT',
  11: 'BUSINESS_MANAGER_INTEGRITY_POLICY',
  12: 'MISREPRESENTED_AD_ACCOUNT',
  13: 'AOAB_DESHARE_LEGAL_ENTITY',
  14: 'CTX_THREAD_REVIEW',
  15: 'COMPROMISED_AD_ACCOUNT',
} as const

// Job status map
export const JOB_STATUS = {
  1: 'PENDING_CONFIRM',
  2: 'FB_AUTO_REJECTED',
  10: 'PROCESSING',
  11: 'RESUBMIT_PENDING',
  20: 'COMPLETED',
  30: 'REJECTED',
  40: 'RETURNED_FOR_MODIFICATION',
  41: 'CUSTOMER_REJECTED',
  50: 'TIMEOUT_CLOSED',
  60: 'MODIFICATION_SUBMITTED',
} as const

// Operation type map
export const OPERATION_TYPE = {
  1: 'RECHARGE',
  2: 'TRANSFER_OUT',
  3: 'TRANSFER_IN',
  4: 'RESET',
  5: 'DEDUCT',
  6: 'DISABLED_WITHDRAWAL',
  7: 'ADJUST_SPEND_CAP',
  8: 'RESET_AMOUNT_SPENT',
  9: 'DISABLED_WITHDRAWAL_RESET',
  10: 'DISABLED_WITHDRAWAL_ROLLBACK',
  11: 'TRANSFER_TO_QUOTA',
  12: 'DISABLED_ACCOUNT_RESET',
  13: 'CLOSED_RESET',
} as const

class CheetahApiService {
  private config: CheetahConfig | null = null
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  // Initialize with config
  setConfig(config: CheetahConfig) {
    this.config = config
    this.accessToken = null
    this.tokenExpiry = 0
  }

  // Generate signature for authentication
  private generateSignature(appid: string, secret: string, timestamp: number): string {
    const str = `appid=${appid}&secret=${secret}&timestamp=${timestamp}`
    return crypto.createHash('sha1').update(str).digest('hex')
  }

  // Get access token
  async getAccessToken(): Promise<string> {
    if (!this.config) {
      throw new Error('Cheetah API not configured. Please set appid and secret.')
    }

    // Return cached token if still valid (with 5 min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = this.generateSignature(
      this.config.appid,
      this.config.secret,
      timestamp
    )

    const response = await fetch(`${this.config.baseUrl}/v1/access-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appid: this.config.appid,
        secret: this.config.secret,
        timestamp,
        signature,
      }),
    })

    const result = await response.json() as CheetahResponse<{ access_token: string }>

    if (result.code !== 0) {
      throw new Error(`Failed to get access token: ${result.msg}`)
    }

    this.accessToken = result.data.access_token
    // Token valid for 30 days, but we'll refresh earlier
    this.tokenExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000

    return this.accessToken
  }

  // Make authenticated request
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<CheetahResponse<T>> {
    if (!this.config) {
      throw new Error('Cheetah API not configured')
    }

    const token = await this.getAccessToken()

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
    }

    if (body && method === 'POST') {
      options.body = JSON.stringify(body)
    }

    let url = `${this.config.baseUrl}${endpoint}`
    if (body && method === 'GET') {
      const params = new URLSearchParams(body)
      url += `?${params.toString()}`
    }

    const response = await fetch(url, options)
    return response.json() as Promise<CheetahResponse<T>>
  }

  // ==================== Account APIs ====================

  // Get account list
  async getAccountList(params?: {
    page?: number
    page_size?: number
    account_id?: string
    start_time?: number
    end_time?: number
    account_status?: string
    disable_reason?: string
  }): Promise<CheetahResponse<{ list: CheetahAccount[]; pager: any }>> {
    return this.request('/v1/facebook-account-list', 'GET', {
      page: params?.page || 1,
      page_size: params?.page_size || 200,
      ...params,
    })
  }

  // Get single account
  async getAccount(accountId: string): Promise<CheetahResponse<CheetahAccount[]>> {
    return this.request('/v1/facebook-account-single', 'GET', { account_id: accountId })
  }

  // Update account name
  async updateAccountName(accountId: string, name: string): Promise<CheetahResponse<any>> {
    return this.request('/v1/facebook-update-name', 'POST', {
      account_id: accountId,
      name,
    })
  }

  // Recharge account (adjust spend cap)
  async rechargeAccount(accountId: string, spendCap: number): Promise<CheetahResponse<{
    serial_number: string
    operation_type: number
  }>> {
    return this.request('/v1/facebook-account-recharge', 'POST', {
      account_id: accountId,
      spend_cap: spendCap,
    })
  }

  // Reset account (clear spent amount)
  async resetAccount(accountId: string): Promise<CheetahResponse<{
    account_id: string
    account_status: number
    reset_amount: string
    serial_number: string
    operation_type: number
  }>> {
    return this.request('/v1/facebook-account-reset', 'POST', {
      account_id: accountId,
    })
  }

  // Get account operation log
  async getAccountOperationLog(params?: {
    page?: number
    page_size?: number
    start_time?: string
    end_time?: string
    serial_number?: string
    account_id?: string
  }): Promise<CheetahResponse<any[]>> {
    return this.request('/v1/facebook-account-operation-log', 'GET', params)
  }

  // Get account used count (API limit check)
  async getAccountUsedCount(accountId: string): Promise<CheetahResponse<{ used_count: number }>> {
    return this.request('/v1/account-used-count', 'GET', { account_id: accountId })
  }

  // ==================== BM Share APIs ====================

  // Bind account to BM
  async bindAccountToBM(
    accountId: string,
    businessId: string,
    type: 0 | 1 | 2 // 0=unbind, 1=view, 2=manage
  ): Promise<CheetahResponse<any>> {
    return this.request('/v1/facebook-account-grant', 'POST', {
      account_id: accountId,
      business_id: businessId,
      type,
    })
  }

  // Get BM bindings for account
  async getBMBindings(accountId: string): Promise<CheetahResponse<{
    account_id: string
    business_id: string[]
  }>> {
    return this.request('/v1/business-account-bindings', 'GET', { account_id: accountId })
  }

  // ==================== Pixel APIs ====================

  // Bind pixel to account
  async bindPixelToAccount(
    pixelId: string,
    accountId: string,
    type: 1 | 2 // 1=bind, 2=unbind
  ): Promise<CheetahResponse<any>> {
    return this.request('/v1/facebook-account-pixel', 'POST', {
      pixel_id: pixelId,
      account_id: accountId,
      type,
    })
  }

  // Get pixel-account bindings
  async getPixelBindings(params: {
    pixel_id?: string
    account_id?: string
  }): Promise<CheetahResponse<any>> {
    return this.request('/v1/pixel-account-bindings', 'GET', params)
  }

  // Submit pixel-BM binding job
  async submitPixelBMBindingJob(
    bindings: { pixel_id: string; bm_id: string; operate: '1' | '2' }[]
  ): Promise<CheetahResponse<{ job_id: string; flow_type: number }>> {
    return this.request('/v1/facebook-pixel-bind-bm-job', 'POST', bindings)
  }

  // Get job result
  async getJobResult(jobId: string): Promise<CheetahResponse<{
    job_status: number
    job_status_msg: string
    flow_type: number
    desc: string
    job_detail: any
  }>> {
    return this.request('/v1/job-result', 'GET', { job_id: jobId })
  }

  // ==================== Job/Opening APIs ====================

  // Get job status
  async getJobStatus(params: {
    job_id?: string
    oe_id?: string
  }): Promise<CheetahResponse<{
    job_status: number
    job_status_msg: string
    desc: string
    account_info: { name: string; id: string }[]
  }>> {
    return this.request('/v1/job-status', 'GET', params)
  }

  // Get job list
  async getJobList(params?: {
    business_license_name?: string
    oe_token?: string
    oe_id?: string
    job_status?: number
    open_account_type?: 1 | 2
    fields?: string
    page?: number
    page_size?: number
  }): Promise<CheetahResponse<{ pager: any; list: any[] }>> {
    return this.request('/v1/open-account/job-list', 'GET', params)
  }

  // Generate OE opening link
  async createOEToken(): Promise<CheetahResponse<{
    token: string
    open_account_link: string
  }>> {
    return this.request('/v1/oe-token/create', 'POST')
  }

  // ==================== Spending/Insights APIs ====================

  // Get daily spend for account
  async getDaySpend(
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<CheetahResponse<{
    date_start: string
    date_stop: string
    account_id: string
    spend: number
  }[]>> {
    return this.request('/v1/day-spend', 'GET', {
      account_id: accountId,
      start_date: startDate,
      end_date: endDate,
    })
  }

  // Get total daily spend for all accounts
  async getDayTotalSpend(date: string): Promise<CheetahResponse<{
    date: string
    total_spend: string
  }>> {
    return this.request('/v1/day-total-spend', 'GET', { date })
  }

  // Get accounts with spend in date range
  async getDayRangeAccountSpend(
    startDate: string,
    endDate: string
  ): Promise<CheetahResponse<{
    date: string
    spend: string
    account_id: string
  }[]>> {
    return this.request('/v1/day-range-account-spend', 'GET', {
      start_date: startDate,
      end_date: endDate,
    })
  }

  // Get account insights
  async getAccountInsights(
    accountId: string,
    date: string,
    fields: string = 'impressions,clicks,actions,spend'
  ): Promise<CheetahResponse<any>> {
    return this.request('/v1/insights/account', 'GET', {
      account_id: accountId,
      date,
      fields,
    })
  }

  // Get account insights for date range
  async getAccountInsightsDateRange(
    accountId: string,
    startDate: string,
    endDate: string,
    fields: string = 'impressions,clicks,actions,spend'
  ): Promise<CheetahResponse<any>> {
    return this.request('/v1/insights/account-date-range', 'GET', {
      account_id: accountId,
      start_date: startDate,
      end_date: endDate,
      fields,
    })
  }

  // ==================== Finance APIs ====================

  // Get payment records
  async getPaymentList(params?: {
    page?: number
    page_size?: number
    payment_start_date?: string
    payment_end_date?: string
    claim_start_datetime?: string
    claim_end_datetime?: string
  }): Promise<CheetahResponse<{
    list: {
      pay_date: string
      pay_money: string
      claim_money: string
      claim_time: string
      remark: string
    }[]
    pager: any
  }>> {
    return this.request('/v1/pay-list', 'GET', params)
  }

  // Get available quota
  async getQuota(): Promise<CheetahResponse<{ available_quota: string }>> {
    return this.request('/v1/quota', 'GET')
  }
}

// Export singleton instance
export const cheetahApi = new CheetahApiService()

// Export class for testing
export { CheetahApiService }
