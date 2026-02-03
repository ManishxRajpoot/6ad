// Facebook Business Manager API Service
// Used to share ad accounts to user's BM automatically

interface FacebookBMConfig {
  bmId: string           // Your Business Manager ID
  bmName: string         // Name for display
  accessToken: string    // System User Access Token
  isActive: boolean
}

interface FacebookAPIResponse {
  success?: boolean
  error?: {
    message: string
    type: string
    code: number
    fbtrace_id: string
  }
}

class FacebookBMApiService {
  private configs: Map<string, FacebookBMConfig> = new Map()

  // Add a BM configuration
  addBMConfig(config: FacebookBMConfig) {
    this.configs.set(config.bmId, config)
    console.log(`[FB API] Added BM config: ${config.bmName} (${config.bmId})`)
  }

  // Remove a BM configuration
  removeBMConfig(bmId: string) {
    this.configs.delete(bmId)
  }

  // Get all configured BMs
  getAllBMConfigs(): FacebookBMConfig[] {
    return Array.from(this.configs.values())
  }

  // Check if BM is configured
  hasBMConfig(bmId: string): boolean {
    return this.configs.has(bmId)
  }

  // Get BM config
  getBMConfig(bmId: string): FacebookBMConfig | undefined {
    return this.configs.get(bmId)
  }

  // Share ad account to user's Business Manager
  // This grants the user's BM access to the ad account
  async shareAdAccountToBM(
    adAccountId: string,      // The ad account ID (without 'act_' prefix)
    userBmId: string,         // User's Business Manager ID they want access from
    sourceBmId: string,       // Your BM that owns the account
    permittedTasks: ('MANAGE' | 'ADVERTISE' | 'ANALYZE')[] = ['MANAGE', 'ADVERTISE', 'ANALYZE']
  ): Promise<{ success: boolean; error?: string }> {

    const config = this.configs.get(sourceBmId)
    if (!config) {
      return {
        success: false,
        error: `Source BM ${sourceBmId} not configured. Please add access token for this BM.`
      }
    }

    if (!config.isActive) {
      return {
        success: false,
        error: `Source BM ${config.bmName} is inactive.`
      }
    }

    try {
      // Facebook Graph API endpoint to share ad account
      // POST /{business-id}/owned_ad_accounts
      // This shares the ad account with another business

      const url = `https://graph.facebook.com/v18.0/${userBmId}/client_ad_accounts`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adaccount_id: `act_${adAccountId}`,
          permitted_tasks: permittedTasks,
          access_token: config.accessToken,
        }),
      })

      const result = await response.json() as FacebookAPIResponse

      if (result.error) {
        console.error('[FB API] Share error:', result.error)
        return {
          success: false,
          error: `Facebook API Error: ${result.error.message}`
        }
      }

      console.log(`[FB API] Successfully shared account ${adAccountId} to BM ${userBmId}`)
      return { success: true }

    } catch (error: any) {
      console.error('[FB API] Request failed:', error)
      return {
        success: false,
        error: `Request failed: ${error.message}`
      }
    }
  }

  // Alternative method: Assign ad account using agency relationship
  // Use this if you have an agency relationship with the user's BM
  async assignAdAccountToClient(
    adAccountId: string,
    clientBmId: string,
    sourceBmId: string,
    permittedTasks: string[] = ['MANAGE', 'ADVERTISE', 'ANALYZE']
  ): Promise<{ success: boolean; error?: string }> {

    const config = this.configs.get(sourceBmId)
    if (!config) {
      return {
        success: false,
        error: `Source BM ${sourceBmId} not configured.`
      }
    }

    try {
      // Using the owned_ad_accounts edge to share
      const url = `https://graph.facebook.com/v18.0/act_${adAccountId}/assigned_users`

      // First, we need to share the ad account with the business
      const shareUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/agencies`

      const shareResponse = await fetch(shareUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: clientBmId,
          permitted_tasks: permittedTasks,
          access_token: config.accessToken,
        }),
      })

      const shareResult = await shareResponse.json() as FacebookAPIResponse

      if (shareResult.error) {
        // Try alternative method - direct share
        return this.directShareAdAccount(adAccountId, clientBmId, config.accessToken, permittedTasks)
      }

      return { success: true }

    } catch (error: any) {
      console.error('[FB API] Assignment failed:', error)
      return {
        success: false,
        error: `Assignment failed: ${error.message}`
      }
    }
  }

  // Direct share using Business Manager's shared_ad_accounts edge
  private async directShareAdAccount(
    adAccountId: string,
    targetBmId: string,
    accessToken: string,
    permittedTasks: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `https://graph.facebook.com/v18.0/${targetBmId}/client_ad_accounts`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adaccount_id: `act_${adAccountId}`,
          permitted_tasks: permittedTasks,
          access_token: accessToken,
        }),
      })

      const result = await response.json() as FacebookAPIResponse

      if (result.error) {
        return {
          success: false,
          error: `Facebook API Error: ${result.error.message}`
        }
      }

      return { success: true }

    } catch (error: any) {
      return {
        success: false,
        error: `Direct share failed: ${error.message}`
      }
    }
  }

  // Get ad accounts owned by a Business Manager
  async getOwnedAdAccounts(bmId: string): Promise<{ accounts: any[]; error?: string }> {
    const config = this.configs.get(bmId)
    if (!config) {
      return { accounts: [], error: `BM ${bmId} not configured` }
    }

    try {
      const url = `https://graph.facebook.com/v18.0/${bmId}/owned_ad_accounts?access_token=${config.accessToken}&limit=200`

      const response = await fetch(url)
      const result = await response.json() as any

      if (result.error) {
        return { accounts: [], error: result.error.message }
      }

      return { accounts: result.data || [] }

    } catch (error: any) {
      return { accounts: [], error: error.message }
    }
  }
}

// Export singleton instance
export const facebookBMApi = new FacebookBMApiService()

// Export class for testing
export { FacebookBMApiService }
export type { FacebookBMConfig }
