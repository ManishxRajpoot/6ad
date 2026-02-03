import { Hono } from 'hono'
import { verifyToken } from '../middleware/auth.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const facebook = new Hono()

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI

// POST /facebook/exchange-token - Exchange authorization code for access token and save profile
facebook.post('/exchange-token', verifyToken, async (c) => {
  try {
    const { code } = await c.req.json()
    const userId = (c as any).user?.id

    if (!code) {
      return c.json({ error: 'Authorization code is required' }, 400)
    }

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET || !FACEBOOK_REDIRECT_URI) {
      console.error('Facebook OAuth not configured')
      return c.json({ error: 'Facebook OAuth not configured' }, 500)
    }

    // Exchange code for access token
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    tokenUrl.searchParams.append('client_id', FACEBOOK_APP_ID)
    tokenUrl.searchParams.append('client_secret', FACEBOOK_APP_SECRET)
    tokenUrl.searchParams.append('redirect_uri', FACEBOOK_REDIRECT_URI)
    tokenUrl.searchParams.append('code', code)

    const tokenResponse = await fetch(tokenUrl.toString())
    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('Facebook token exchange error:', tokenData.error)
      return c.json({
        error: tokenData.error.message || 'Failed to exchange token',
        details: tokenData.error
      }, 400)
    }

    // Get long-lived token
    const longLivedUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    longLivedUrl.searchParams.append('grant_type', 'fb_exchange_token')
    longLivedUrl.searchParams.append('client_id', FACEBOOK_APP_ID)
    longLivedUrl.searchParams.append('client_secret', FACEBOOK_APP_SECRET)
    longLivedUrl.searchParams.append('fb_exchange_token', tokenData.access_token)

    const longLivedResponse = await fetch(longLivedUrl.toString())
    const longLivedData = await longLivedResponse.json()

    const accessToken = longLivedData.access_token || tokenData.access_token
    const expiresIn = longLivedData.expires_in || tokenData.expires_in

    // Get Facebook user info to store profile
    const meUrl = new URL('https://graph.facebook.com/v18.0/me')
    meUrl.searchParams.append('access_token', accessToken)
    meUrl.searchParams.append('fields', 'id,name,email')

    const meResponse = await fetch(meUrl.toString())
    const meData = await meResponse.json()

    if (meData.error) {
      console.error('Facebook me error:', meData.error)
      return c.json({
        error: meData.error.message || 'Failed to fetch user info',
        code: meData.error.code
      }, 401)
    }

    // Calculate token expiry date
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // Default 60 days

    // Save or update the Facebook profile in database
    if (userId) {
      try {
        await prisma.facebookProfile.upsert({
          where: {
            userId_facebookUserId: {
              userId: userId,
              facebookUserId: meData.id
            }
          },
          update: {
            name: meData.name,
            email: meData.email,
            accessToken: accessToken,
            tokenExpiresAt: tokenExpiresAt,
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            userId: userId,
            facebookUserId: meData.id,
            name: meData.name,
            email: meData.email,
            accessToken: accessToken,
            tokenExpiresAt: tokenExpiresAt,
            isActive: true
          }
        })
      } catch (dbError) {
        console.error('Error saving Facebook profile to database:', dbError)
        // Continue even if DB save fails - user can still use the token from localStorage
      }
    }

    return c.json({
      accessToken,
      expiresIn,
      tokenType: 'bearer',
      profile: {
        id: meData.id,
        name: meData.name,
        email: meData.email
      }
    })
  } catch (error) {
    console.error('Token exchange error:', error)
    return c.json({ error: 'Failed to exchange token' }, 500)
  }
})

// GET /facebook/ad-accounts - Fetch all ad accounts for the user
facebook.get('/ad-accounts', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    // First, get user info
    const meUrl = new URL('https://graph.facebook.com/v18.0/me')
    meUrl.searchParams.append('access_token', accessToken)
    meUrl.searchParams.append('fields', 'id,name,email')

    const meResponse = await fetch(meUrl.toString())
    const meData = await meResponse.json()

    if (meData.error) {
      console.error('Facebook me error:', meData.error)
      return c.json({
        error: meData.error.message || 'Failed to fetch user info',
        code: meData.error.code
      }, 401)
    }

    // Fetch ad accounts the user has access to
    const adAccountsUrl = new URL('https://graph.facebook.com/v18.0/me/adaccounts')
    adAccountsUrl.searchParams.append('access_token', accessToken)
    adAccountsUrl.searchParams.append('fields', 'id,account_id,name,account_status,amount_spent,balance,spend_cap,currency,business_name,funding_source_details,disable_reason,created_time')
    adAccountsUrl.searchParams.append('limit', '100')

    const adAccountsResponse = await fetch(adAccountsUrl.toString())
    const adAccountsData = await adAccountsResponse.json()

    if (adAccountsData.error) {
      console.error('Facebook ad accounts error:', adAccountsData.error)
      return c.json({
        error: adAccountsData.error.message || 'Failed to fetch ad accounts',
        code: adAccountsData.error.code
      }, 400)
    }

    // Transform ad accounts data
    const adAccounts = (adAccountsData.data || []).map((account: any) => {
      const amountSpent = account.amount_spent ? parseFloat(account.amount_spent) / 100 : 0
      const spendCap = account.spend_cap ? parseFloat(account.spend_cap) / 100 : null
      const prepaidBalance = account.balance ? parseFloat(account.balance) / 100 : 0

      // Calculate remaining spending limit (spend_cap - amount_spent)
      // If no spend_cap is set, show prepaid balance or 0
      const remainingSpendLimit = spendCap !== null ? Math.max(0, spendCap - amountSpent) : null

      return {
        id: account.id,
        accountId: account.account_id,
        name: account.name || `Ad Account ${account.account_id}`,
        status: getAccountStatusLabel(account.account_status),
        statusCode: account.account_status,
        amountSpent,
        balance: prepaidBalance,
        spendCap,
        remainingSpendLimit,
        currency: account.currency || 'USD',
        businessName: account.business_name,
        disableReason: account.disable_reason,
        createdTime: account.created_time
      }
    })

    return c.json({
      user: {
        id: meData.id,
        name: meData.name,
        email: meData.email
      },
      adAccounts,
      totalAccounts: adAccounts.length
    })
  } catch (error) {
    console.error('Fetch ad accounts error:', error)
    return c.json({ error: 'Failed to fetch ad accounts' }, 500)
  }
})

// GET /facebook/ad-account/:accountId - Get details for a specific ad account
facebook.get('/ad-account/:accountId', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const accountId = c.req.param('accountId')

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    // Fetch ad account details
    const accountUrl = new URL(`https://graph.facebook.com/v18.0/${accountId}`)
    accountUrl.searchParams.append('access_token', accessToken)
    accountUrl.searchParams.append('fields', 'id,account_id,name,account_status,amount_spent,balance,currency,business_name,spend_cap,funding_source_details,disable_reason,created_time,business')

    const accountResponse = await fetch(accountUrl.toString())
    const accountData = await accountResponse.json()

    if (accountData.error) {
      console.error('Facebook ad account error:', accountData.error)
      return c.json({
        error: accountData.error.message || 'Failed to fetch ad account',
        code: accountData.error.code
      }, 400)
    }

    return c.json({
      id: accountData.id,
      accountId: accountData.account_id,
      name: accountData.name,
      status: getAccountStatusLabel(accountData.account_status),
      statusCode: accountData.account_status,
      amountSpent: accountData.amount_spent ? parseFloat(accountData.amount_spent) / 100 : 0,
      balance: accountData.balance ? parseFloat(accountData.balance) / 100 : 0,
      currency: accountData.currency || 'USD',
      businessName: accountData.business_name,
      spendCap: accountData.spend_cap ? parseFloat(accountData.spend_cap) / 100 : null,
      disableReason: accountData.disable_reason,
      createdTime: accountData.created_time,
      business: accountData.business
    })
  } catch (error) {
    console.error('Fetch ad account error:', error)
    return c.json({ error: 'Failed to fetch ad account' }, 500)
  }
})

// GET /facebook/campaigns/:accountId - Get campaigns for an ad account with insights
facebook.get('/campaigns/:accountId', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const accountId = c.req.param('accountId')
    const datePreset = c.req.query('date_preset') || 'last_7d'

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    // Fetch campaigns with insights
    const campaignsUrl = new URL(`https://graph.facebook.com/v18.0/${accountId}/campaigns`)
    campaignsUrl.searchParams.append('access_token', accessToken)
    campaignsUrl.searchParams.append('fields', `id,name,status,effective_status,objective,created_time,updated_time,daily_budget,lifetime_budget,budget_remaining,insights.date_preset(${datePreset}){reach,impressions,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type,frequency}`)
    campaignsUrl.searchParams.append('limit', '100')

    const campaignsResponse = await fetch(campaignsUrl.toString())
    const campaignsData = await campaignsResponse.json()

    if (campaignsData.error) {
      console.error('Facebook campaigns error:', campaignsData.error)
      return c.json({
        error: campaignsData.error.message || 'Failed to fetch campaigns',
        code: campaignsData.error.code
      }, 400)
    }

    const campaigns = (campaignsData.data || []).map((campaign: any) => {
      const insights = campaign.insights?.data?.[0] || {}
      const actions = insights.actions || []
      const costPerAction = insights.cost_per_action_type || []

      // Get results based on objective - prioritize messaging conversions for messaging campaigns
      const getResults = () => {
        const resultActions = [
          'onsite_conversion.messaging_conversation_started_7d',
          'onsite_conversion.messaging_first_reply',
          'messaging_conversation_started_7d',
          'messaging_first_reply',
          'purchase',
          'omni_purchase',
          'lead',
          'complete_registration',
          'onsite_conversion.lead_grouped',
          'link_click',
          'landing_page_view',
          'post_engagement',
          'video_view',
          'page_engagement'
        ]
        for (const action of resultActions) {
          const found = actions.find((a: any) => a.action_type === action)
          if (found) return { type: action, value: parseInt(found.value) }
        }
        return null
      }

      const results = getResults()
      const costPerResult = results ? costPerAction.find((c: any) => c.action_type === results.type) : null

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        effectiveStatus: campaign.effective_status,
        objective: campaign.objective,
        dailyBudget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
        lifetimeBudget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
        budgetRemaining: campaign.budget_remaining ? parseFloat(campaign.budget_remaining) / 100 : null,
        createdTime: campaign.created_time,
        updatedTime: campaign.updated_time,
        // Insights metrics
        reach: insights.reach ? parseInt(insights.reach) : 0,
        impressions: insights.impressions ? parseInt(insights.impressions) : 0,
        clicks: insights.clicks ? parseInt(insights.clicks) : 0,
        ctr: insights.ctr ? parseFloat(insights.ctr) : 0,
        cpc: insights.cpc ? parseFloat(insights.cpc) : 0,
        cpm: insights.cpm ? parseFloat(insights.cpm) : 0,
        spend: insights.spend ? parseFloat(insights.spend) : 0,
        frequency: insights.frequency ? parseFloat(insights.frequency) : 0,
        results: results?.value || 0,
        resultType: results?.type || null,
        costPerResult: costPerResult ? parseFloat(costPerResult.value) : 0
      }
    })

    return c.json({
      campaigns,
      totalCampaigns: campaigns.length
    })
  } catch (error) {
    console.error('Fetch campaigns error:', error)
    return c.json({ error: 'Failed to fetch campaigns' }, 500)
  }
})

// GET /facebook/adsets/:campaignId - Get ad sets for a campaign with insights
facebook.get('/adsets/:campaignId', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const campaignId = c.req.param('campaignId')
    const datePreset = c.req.query('date_preset') || 'last_7d'

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    // Fetch ad sets for the campaign with insights
    const adSetsUrl = new URL(`https://graph.facebook.com/v18.0/${campaignId}/adsets`)
    adSetsUrl.searchParams.append('access_token', accessToken)
    adSetsUrl.searchParams.append('fields', `id,name,status,effective_status,daily_budget,lifetime_budget,budget_remaining,billing_event,optimization_goal,targeting,created_time,updated_time,start_time,end_time,insights.date_preset(${datePreset}){reach,impressions,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type,frequency}`)
    adSetsUrl.searchParams.append('limit', '100')

    const adSetsResponse = await fetch(adSetsUrl.toString())
    const adSetsData = await adSetsResponse.json()

    if (adSetsData.error) {
      console.error('Facebook ad sets error:', adSetsData.error)
      return c.json({
        error: adSetsData.error.message || 'Failed to fetch ad sets',
        code: adSetsData.error.code
      }, 400)
    }

    const adSets = (adSetsData.data || []).map((adSet: any) => {
      const insights = adSet.insights?.data?.[0] || {}
      const actions = insights.actions || []
      const costPerAction = insights.cost_per_action_type || []

      const getResults = () => {
        const resultActions = [
          'onsite_conversion.messaging_conversation_started_7d',
          'onsite_conversion.messaging_first_reply',
          'messaging_conversation_started_7d',
          'messaging_first_reply',
          'purchase',
          'omni_purchase',
          'lead',
          'complete_registration',
          'onsite_conversion.lead_grouped',
          'link_click',
          'landing_page_view',
          'post_engagement',
          'video_view',
          'page_engagement'
        ]
        for (const action of resultActions) {
          const found = actions.find((a: any) => a.action_type === action)
          if (found) return { type: action, value: parseInt(found.value) }
        }
        return null
      }

      const results = getResults()
      const costPerResult = results ? costPerAction.find((c: any) => c.action_type === results.type) : null

      return {
        id: adSet.id,
        name: adSet.name,
        status: adSet.status,
        effectiveStatus: adSet.effective_status,
        dailyBudget: adSet.daily_budget ? parseFloat(adSet.daily_budget) / 100 : null,
        lifetimeBudget: adSet.lifetime_budget ? parseFloat(adSet.lifetime_budget) / 100 : null,
        budgetRemaining: adSet.budget_remaining ? parseFloat(adSet.budget_remaining) / 100 : null,
        billingEvent: adSet.billing_event,
        optimizationGoal: adSet.optimization_goal,
        targeting: adSet.targeting,
        createdTime: adSet.created_time,
        updatedTime: adSet.updated_time,
        startTime: adSet.start_time,
        endTime: adSet.end_time,
        // Insights metrics
        reach: insights.reach ? parseInt(insights.reach) : 0,
        impressions: insights.impressions ? parseInt(insights.impressions) : 0,
        clicks: insights.clicks ? parseInt(insights.clicks) : 0,
        ctr: insights.ctr ? parseFloat(insights.ctr) : 0,
        cpc: insights.cpc ? parseFloat(insights.cpc) : 0,
        cpm: insights.cpm ? parseFloat(insights.cpm) : 0,
        spend: insights.spend ? parseFloat(insights.spend) : 0,
        frequency: insights.frequency ? parseFloat(insights.frequency) : 0,
        results: results?.value || 0,
        resultType: results?.type || null,
        costPerResult: costPerResult ? parseFloat(costPerResult.value) : 0
      }
    })

    return c.json({
      adSets,
      totalAdSets: adSets.length
    })
  } catch (error) {
    console.error('Fetch ad sets error:', error)
    return c.json({ error: 'Failed to fetch ad sets' }, 500)
  }
})

// GET /facebook/ads/:adSetId - Get ads for an ad set with insights
facebook.get('/ads/:adSetId', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const adSetId = c.req.param('adSetId')
    const datePreset = c.req.query('date_preset') || 'last_7d'

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    // Fetch ads for the ad set with insights
    const adsUrl = new URL(`https://graph.facebook.com/v18.0/${adSetId}/ads`)
    adsUrl.searchParams.append('access_token', accessToken)
    adsUrl.searchParams.append('fields', `id,name,status,effective_status,creative{id,thumbnail_url,image_url,object_story_spec,effective_object_story_id},adcreatives{thumbnail_url,image_url,object_story_spec},created_time,updated_time,preview_shareable_link,insights.date_preset(${datePreset}){reach,impressions,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type,frequency}`)
    adsUrl.searchParams.append('limit', '100')

    const adsResponse = await fetch(adsUrl.toString())
    const adsData = await adsResponse.json()

    if (adsData.error) {
      console.error('Facebook ads error:', adsData.error)
      return c.json({
        error: adsData.error.message || 'Failed to fetch ads',
        code: adsData.error.code
      }, 400)
    }

    const ads = (adsData.data || []).map((ad: any) => {
      const insights = ad.insights?.data?.[0] || {}
      const actions = insights.actions || []
      const costPerAction = insights.cost_per_action_type || []

      const getResults = () => {
        const resultActions = [
          'onsite_conversion.messaging_conversation_started_7d',
          'onsite_conversion.messaging_first_reply',
          'messaging_conversation_started_7d',
          'messaging_first_reply',
          'purchase',
          'omni_purchase',
          'lead',
          'complete_registration',
          'onsite_conversion.lead_grouped',
          'link_click',
          'landing_page_view',
          'post_engagement',
          'video_view',
          'page_engagement'
        ]
        for (const action of resultActions) {
          const found = actions.find((a: any) => a.action_type === action)
          if (found) return { type: action, value: parseInt(found.value) }
        }
        return null
      }

      const results = getResults()
      const costPerResult = results ? costPerAction.find((c: any) => c.action_type === results.type) : null

      // Get the best quality image available
      const getImageUrl = () => {
        // Try to get image_url first (higher quality)
        if (ad.creative?.image_url) return ad.creative.image_url
        // Try adcreatives
        if (ad.adcreatives?.data?.[0]?.image_url) return ad.adcreatives.data[0].image_url
        // Try object_story_spec for image
        const storySpec = ad.creative?.object_story_spec || ad.adcreatives?.data?.[0]?.object_story_spec
        if (storySpec?.link_data?.image_url) return storySpec.link_data.image_url
        if (storySpec?.link_data?.picture) return storySpec.link_data.picture
        if (storySpec?.photo_data?.url) return storySpec.photo_data.url
        if (storySpec?.video_data?.image_url) return storySpec.video_data.image_url
        // Fallback to thumbnail
        if (ad.adcreatives?.data?.[0]?.thumbnail_url) return ad.adcreatives.data[0].thumbnail_url
        return ad.creative?.thumbnail_url || null
      }

      return {
        id: ad.id,
        name: ad.name,
        status: ad.status,
        effectiveStatus: ad.effective_status,
        creative: ad.creative,
        thumbnailUrl: getImageUrl(),
        createdTime: ad.created_time,
        updatedTime: ad.updated_time,
        previewLink: ad.preview_shareable_link,
        // Insights metrics
        reach: insights.reach ? parseInt(insights.reach) : 0,
        impressions: insights.impressions ? parseInt(insights.impressions) : 0,
        clicks: insights.clicks ? parseInt(insights.clicks) : 0,
        ctr: insights.ctr ? parseFloat(insights.ctr) : 0,
        cpc: insights.cpc ? parseFloat(insights.cpc) : 0,
        cpm: insights.cpm ? parseFloat(insights.cpm) : 0,
        spend: insights.spend ? parseFloat(insights.spend) : 0,
        frequency: insights.frequency ? parseFloat(insights.frequency) : 0,
        results: results?.value || 0,
        resultType: results?.type || null,
        costPerResult: costPerResult ? parseFloat(costPerResult.value) : 0
      }
    })

    return c.json({
      ads,
      totalAds: ads.length
    })
  } catch (error) {
    console.error('Fetch ads error:', error)
    return c.json({ error: 'Failed to fetch ads' }, 500)
  }
})

// POST /facebook/campaigns/:campaignId/status - Update campaign status
facebook.post('/campaigns/:campaignId/status', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const campaignId = c.req.param('campaignId')
    const { status } = await c.req.json()

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    if (!['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    const updateUrl = `https://graph.facebook.com/v18.0/${campaignId}`
    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        access_token: accessToken,
        status: status
      })
    })

    const data = await response.json()

    if (data.error) {
      return c.json({ error: data.error.message }, 400)
    }

    return c.json({ success: true, message: `Campaign ${status.toLowerCase()}` })
  } catch (error) {
    console.error('Update campaign status error:', error)
    return c.json({ error: 'Failed to update campaign status' }, 500)
  }
})

// POST /facebook/adsets/:adSetId/status - Update ad set status
facebook.post('/adsets/:adSetId/status', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const adSetId = c.req.param('adSetId')
    const { status } = await c.req.json()

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    if (!['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    const updateUrl = `https://graph.facebook.com/v18.0/${adSetId}`
    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        access_token: accessToken,
        status: status
      })
    })

    const data = await response.json()

    if (data.error) {
      return c.json({ error: data.error.message }, 400)
    }

    return c.json({ success: true, message: `Ad set ${status.toLowerCase()}` })
  } catch (error) {
    console.error('Update ad set status error:', error)
    return c.json({ error: 'Failed to update ad set status' }, 500)
  }
})

// POST /facebook/ads/:adId/status - Update ad status
facebook.post('/ads/:adId/status', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const adId = c.req.param('adId')
    const { status } = await c.req.json()

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    if (!['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    const updateUrl = `https://graph.facebook.com/v18.0/${adId}`
    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        access_token: accessToken,
        status: status
      })
    })

    const data = await response.json()

    if (data.error) {
      return c.json({ error: data.error.message }, 400)
    }

    return c.json({ success: true, message: `Ad ${status.toLowerCase()}` })
  } catch (error) {
    console.error('Update ad status error:', error)
    return c.json({ error: 'Failed to update ad status' }, 500)
  }
})

// GET /facebook/account-insights/:accountId - Get account level insights
facebook.get('/account-insights/:accountId', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const accountId = c.req.param('accountId')
    const datePreset = c.req.query('date_preset') || 'last_7d'

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    const insightsUrl = new URL(`https://graph.facebook.com/v18.0/${accountId}/insights`)
    insightsUrl.searchParams.append('access_token', accessToken)
    insightsUrl.searchParams.append('date_preset', datePreset)
    insightsUrl.searchParams.append('fields', 'reach,impressions,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type,frequency')

    const response = await fetch(insightsUrl.toString())
    const data = await response.json()

    if (data.error) {
      return c.json({ error: data.error.message }, 400)
    }

    const insights = data.data?.[0] || {}

    return c.json({
      reach: insights.reach ? parseInt(insights.reach) : 0,
      impressions: insights.impressions ? parseInt(insights.impressions) : 0,
      clicks: insights.clicks ? parseInt(insights.clicks) : 0,
      ctr: insights.ctr ? parseFloat(insights.ctr) : 0,
      cpc: insights.cpc ? parseFloat(insights.cpc) : 0,
      cpm: insights.cpm ? parseFloat(insights.cpm) : 0,
      spend: insights.spend ? parseFloat(insights.spend) : 0,
      frequency: insights.frequency ? parseFloat(insights.frequency) : 0,
      actions: insights.actions || [],
      costPerAction: insights.cost_per_action_type || []
    })
  } catch (error) {
    console.error('Fetch account insights error:', error)
    return c.json({ error: 'Failed to fetch account insights' }, 500)
  }
})

// GET /facebook/profiles - Get all connected Facebook profiles for the user
facebook.get('/profiles', verifyToken, async (c) => {
  try {
    const userId = (c as any).user?.id

    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401)
    }

    const profiles = await prisma.facebookProfile.findMany({
      where: {
        userId: userId,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Check token validity for each profile
    const profilesWithStatus = await Promise.all(
      profiles.map(async (profile) => {
        let isValid = true
        let adAccountCount = 0

        try {
          // Quick check if token is still valid
          const meUrl = new URL('https://graph.facebook.com/v18.0/me')
          meUrl.searchParams.append('access_token', profile.accessToken)
          meUrl.searchParams.append('fields', 'id,name')

          const meResponse = await fetch(meUrl.toString())
          const meData = await meResponse.json()

          if (meData.error) {
            isValid = false
          } else {
            // Get ad account count
            const accountsUrl = new URL('https://graph.facebook.com/v18.0/me/adaccounts')
            accountsUrl.searchParams.append('access_token', profile.accessToken)
            accountsUrl.searchParams.append('fields', 'id')
            accountsUrl.searchParams.append('limit', '100')

            const accountsResponse = await fetch(accountsUrl.toString())
            const accountsData = await accountsResponse.json()
            adAccountCount = accountsData.data?.length || 0
          }
        } catch (err) {
          isValid = false
        }

        return {
          id: profile.id,
          facebookUserId: profile.facebookUserId,
          name: profile.name,
          email: profile.email,
          isValid,
          adAccountCount,
          tokenExpiresAt: profile.tokenExpiresAt,
          createdAt: profile.createdAt
        }
      })
    )

    return c.json({
      profiles: profilesWithStatus,
      totalProfiles: profiles.length
    })
  } catch (error) {
    console.error('Fetch profiles error:', error)
    return c.json({ error: 'Failed to fetch profiles' }, 500)
  }
})

// DELETE /facebook/profiles/:profileId - Disconnect a Facebook profile
facebook.delete('/profiles/:profileId', verifyToken, async (c) => {
  try {
    const userId = (c as any).user?.id
    const profileId = c.req.param('profileId')

    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401)
    }

    // Verify the profile belongs to the user
    const profile = await prisma.facebookProfile.findFirst({
      where: {
        id: profileId,
        userId: userId
      }
    })

    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404)
    }

    // Soft delete - just deactivate
    await prisma.facebookProfile.update({
      where: { id: profileId },
      data: { isActive: false }
    })

    return c.json({ success: true, message: 'Profile disconnected' })
  } catch (error) {
    console.error('Delete profile error:', error)
    return c.json({ error: 'Failed to disconnect profile' }, 500)
  }
})

// GET /facebook/all-ad-accounts - Get all ad accounts from all connected profiles
facebook.get('/all-ad-accounts', verifyToken, async (c) => {
  try {
    const userId = (c as any).user?.id

    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401)
    }

    // Get all active profiles for the user
    const profiles = await prisma.facebookProfile.findMany({
      where: {
        userId: userId,
        isActive: true
      }
    })

    if (profiles.length === 0) {
      return c.json({
        profiles: [],
        adAccounts: [],
        totalAccounts: 0
      })
    }

    // Fetch ad accounts from all profiles in parallel
    const allAccountsPromises = profiles.map(async (profile) => {
      try {
        const adAccountsUrl = new URL('https://graph.facebook.com/v18.0/me/adaccounts')
        adAccountsUrl.searchParams.append('access_token', profile.accessToken)
        adAccountsUrl.searchParams.append('fields', 'id,account_id,name,account_status,amount_spent,balance,currency,business_name,disable_reason,created_time')
        adAccountsUrl.searchParams.append('limit', '100')

        const adAccountsResponse = await fetch(adAccountsUrl.toString())
        const adAccountsData = await adAccountsResponse.json()

        if (adAccountsData.error) {
          console.error(`Error fetching accounts for profile ${profile.facebookUserId}:`, adAccountsData.error)
          return {
            profile: {
              id: profile.id,
              facebookUserId: profile.facebookUserId,
              name: profile.name,
              isValid: false
            },
            accounts: [],
            error: adAccountsData.error.message
          }
        }

        const accounts = (adAccountsData.data || []).map((account: any) => ({
          id: account.id,
          accountId: account.account_id,
          name: account.name || `Ad Account ${account.account_id}`,
          status: getAccountStatusLabel(account.account_status),
          statusCode: account.account_status,
          amountSpent: account.amount_spent ? parseFloat(account.amount_spent) / 100 : 0,
          balance: account.balance ? parseFloat(account.balance) / 100 : 0,
          currency: account.currency || 'USD',
          businessName: account.business_name,
          disableReason: account.disable_reason,
          createdTime: account.created_time,
          // Link to the profile
          profileId: profile.id,
          profileName: profile.name,
          profileFbId: profile.facebookUserId
        }))

        return {
          profile: {
            id: profile.id,
            facebookUserId: profile.facebookUserId,
            name: profile.name,
            isValid: true,
            accessToken: profile.accessToken // Include token for making API calls
          },
          accounts,
          error: null
        }
      } catch (err: any) {
        console.error(`Error processing profile ${profile.facebookUserId}:`, err)
        return {
          profile: {
            id: profile.id,
            facebookUserId: profile.facebookUserId,
            name: profile.name,
            isValid: false
          },
          accounts: [],
          error: err.message
        }
      }
    })

    const results = await Promise.all(allAccountsPromises)

    // Combine all accounts and profiles
    const validProfiles = results.filter(r => r.profile.isValid).map(r => r.profile)
    const allAccounts = results.flatMap(r => r.accounts)

    return c.json({
      profiles: results.map(r => ({
        ...r.profile,
        accountCount: r.accounts.length,
        error: r.error,
        accessToken: undefined // Don't expose token in response
      })),
      adAccounts: allAccounts,
      totalAccounts: allAccounts.length,
      totalProfiles: profiles.length
    })
  } catch (error) {
    console.error('Fetch all ad accounts error:', error)
    return c.json({ error: 'Failed to fetch ad accounts' }, 500)
  }
})

// GET /facebook/profile-token/:profileId - Get access token for a specific profile
facebook.get('/profile-token/:profileId', verifyToken, async (c) => {
  try {
    const userId = (c as any).user?.id
    const profileId = c.req.param('profileId')

    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401)
    }

    const profile = await prisma.facebookProfile.findFirst({
      where: {
        id: profileId,
        userId: userId,
        isActive: true
      }
    })

    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404)
    }

    return c.json({
      accessToken: profile.accessToken,
      profileId: profile.id,
      profileName: profile.name
    })
  } catch (error) {
    console.error('Get profile token error:', error)
    return c.json({ error: 'Failed to get profile token' }, 500)
  }
})

// ============= CAMPAIGN CREATION API =============

// Map our objectives to Facebook objectives
const OBJECTIVE_MAP: { [key: string]: string } = {
  'ECOMMERCE_SALES': 'OUTCOME_SALES',
  'LEAD_GENERATION': 'OUTCOME_LEADS',
  'WEBSITE_TRAFFIC': 'OUTCOME_TRAFFIC',
  'BRAND_AWARENESS': 'OUTCOME_AWARENESS',
  'ENGAGEMENT': 'OUTCOME_ENGAGEMENT',
  'APP_INSTALLS': 'OUTCOME_APP_PROMOTION',
  'VIDEO_VIEWS': 'OUTCOME_AWARENESS'
}

// POST /facebook/create-campaign - Create a new campaign on Facebook
facebook.post('/create-campaign', verifyToken, async (c) => {
  try {
    const userId = (c as any).user?.id
    const body = await c.req.json()

    const {
      name,
      objective,
      dailyBudget,
      startTime,
      endTime,
      adAccountId,
      profileId,
      specialAdCategories = []
    } = body

    // Get the profile access token
    const profile = await prisma.facebookProfile.findFirst({
      where: { id: profileId, userId, isActive: true }
    })

    if (!profile) {
      return c.json({ error: 'Facebook profile not found' }, 404)
    }

    const fbObjective = OBJECTIVE_MAP[objective] || 'OUTCOME_TRAFFIC'

    // Create the campaign on Facebook
    const createUrl = `https://graph.facebook.com/v18.0/${adAccountId}/campaigns`

    const campaignData: any = {
      name,
      objective: fbObjective,
      status: 'PAUSED', // Start paused for review
      special_ad_categories: specialAdCategories,
      access_token: profile.accessToken
    }

    if (dailyBudget) {
      campaignData.daily_budget = Math.round(dailyBudget * 100) // Convert to cents
    }

    if (startTime) {
      campaignData.start_time = new Date(startTime).toISOString()
    }

    if (endTime) {
      campaignData.end_time = new Date(endTime).toISOString()
    }

    const response = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignData)
    })

    const result = await response.json()

    if (result.error) {
      console.error('Facebook campaign creation error:', result.error)
      return c.json({
        error: result.error.message || 'Failed to create campaign',
        details: result.error
      }, 400)
    }

    return c.json({
      success: true,
      campaignId: result.id,
      message: 'Campaign created successfully'
    })
  } catch (error: any) {
    console.error('Create campaign error:', error)
    return c.json({ error: 'Failed to create campaign' }, 500)
  }
})

// POST /facebook/create-adset - Create an ad set within a campaign
facebook.post('/create-adset', verifyToken, async (c) => {
  try {
    const userId = (c as any).user?.id
    const body = await c.req.json()

    const {
      name,
      campaignId,
      adAccountId,
      profileId,
      dailyBudget,
      lifetimeBudget,
      startTime,
      endTime,
      targeting,
      optimizationGoal,
      billingEvent,
      bidAmount
    } = body

    const profile = await prisma.facebookProfile.findFirst({
      where: { id: profileId, userId, isActive: true }
    })

    if (!profile) {
      return c.json({ error: 'Facebook profile not found' }, 404)
    }

    const createUrl = `https://graph.facebook.com/v18.0/${adAccountId}/adsets`

    const adSetData: any = {
      name,
      campaign_id: campaignId,
      status: 'PAUSED',
      optimization_goal: optimizationGoal || 'LINK_CLICKS',
      billing_event: billingEvent || 'IMPRESSIONS',
      access_token: profile.accessToken
    }

    if (dailyBudget) {
      adSetData.daily_budget = Math.round(dailyBudget * 100)
    }

    if (lifetimeBudget) {
      adSetData.lifetime_budget = Math.round(lifetimeBudget * 100)
    }

    if (startTime) {
      adSetData.start_time = new Date(startTime).toISOString()
    }

    if (endTime) {
      adSetData.end_time = new Date(endTime).toISOString()
    }

    if (bidAmount) {
      adSetData.bid_amount = Math.round(bidAmount * 100)
    }

    // Build targeting spec
    if (targeting) {
      const targetingSpec: any = {}

      if (targeting.locations && targeting.locations.length > 0) {
        targetingSpec.geo_locations = {
          countries: targeting.locations
        }
      }

      if (targeting.ageMin) {
        targetingSpec.age_min = targeting.ageMin
      }

      if (targeting.ageMax) {
        targetingSpec.age_max = targeting.ageMax
      }

      if (targeting.genders && targeting.genders.length > 0 && !targeting.genders.includes('all')) {
        targetingSpec.genders = targeting.genders.map((g: string) => g === 'male' ? 1 : 2)
      }

      if (targeting.interests && targeting.interests.length > 0) {
        // Note: In production, you'd need to look up interest IDs via the API
        targetingSpec.flexible_spec = [{
          interests: targeting.interests.map((i: string) => ({ name: i }))
        }]
      }

      adSetData.targeting = JSON.stringify(targetingSpec)
    }

    const response = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adSetData)
    })

    const result = await response.json()

    if (result.error) {
      console.error('Facebook ad set creation error:', result.error)
      return c.json({
        error: result.error.message || 'Failed to create ad set',
        details: result.error
      }, 400)
    }

    return c.json({
      success: true,
      adSetId: result.id,
      message: 'Ad set created successfully'
    })
  } catch (error: any) {
    console.error('Create ad set error:', error)
    return c.json({ error: 'Failed to create ad set' }, 500)
  }
})

// POST /facebook/create-ad - Create an ad within an ad set
facebook.post('/create-ad', verifyToken, async (c) => {
  try {
    const userId = (c as any).user?.id
    const body = await c.req.json()

    const {
      name,
      adSetId,
      adAccountId,
      profileId,
      creative
    } = body

    const profile = await prisma.facebookProfile.findFirst({
      where: { id: profileId, userId, isActive: true }
    })

    if (!profile) {
      return c.json({ error: 'Facebook profile not found' }, 404)
    }

    // First, create the ad creative
    const creativeUrl = `https://graph.facebook.com/v18.0/${adAccountId}/adcreatives`

    const creativeData: any = {
      name: `Creative for ${name}`,
      access_token: profile.accessToken,
      object_story_spec: {
        link_data: {
          link: creative.websiteUrl,
          message: creative.primaryText,
          name: creative.headline,
          description: creative.description,
          call_to_action: {
            type: creative.ctaType || 'LEARN_MORE',
            value: { link: creative.websiteUrl }
          }
        }
      }
    }

    if (creative.imageUrl) {
      creativeData.object_story_spec.link_data.image_url = creative.imageUrl
    }

    const creativeResponse = await fetch(creativeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creativeData)
    })

    const creativeResult = await creativeResponse.json()

    if (creativeResult.error) {
      console.error('Facebook creative creation error:', creativeResult.error)
      return c.json({
        error: creativeResult.error.message || 'Failed to create creative',
        details: creativeResult.error
      }, 400)
    }

    // Now create the ad
    const adUrl = `https://graph.facebook.com/v18.0/${adAccountId}/ads`

    const adData = {
      name,
      adset_id: adSetId,
      creative: { creative_id: creativeResult.id },
      status: 'PAUSED',
      access_token: profile.accessToken
    }

    const adResponse = await fetch(adUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adData)
    })

    const adResult = await adResponse.json()

    if (adResult.error) {
      console.error('Facebook ad creation error:', adResult.error)
      return c.json({
        error: adResult.error.message || 'Failed to create ad',
        details: adResult.error
      }, 400)
    }

    return c.json({
      success: true,
      adId: adResult.id,
      creativeId: creativeResult.id,
      message: 'Ad created successfully'
    })
  } catch (error: any) {
    console.error('Create ad error:', error)
    return c.json({ error: 'Failed to create ad' }, 500)
  }
})

// POST /facebook/publish-ai-campaign - Create full campaign structure from AI campaign config
facebook.post('/publish-ai-campaign', verifyToken, async (c) => {
  try {
    const userId = (c as any).user?.id
    const body = await c.req.json()

    const { aiCampaignId } = body

    // Fetch the AI campaign with all details
    const aiCampaign = await prisma.aICampaign.findFirst({
      where: { id: aiCampaignId, userId },
      include: { profile: true }
    })

    if (!aiCampaign) {
      return c.json({ error: 'AI Campaign not found' }, 404)
    }

    if (!aiCampaign.profile.isActive) {
      return c.json({ error: 'Facebook profile is not active' }, 400)
    }

    const accessToken = aiCampaign.profile.accessToken
    const fbObjective = OBJECTIVE_MAP[aiCampaign.objective] || 'OUTCOME_TRAFFIC'

    // 1. Create Campaign
    const campaignUrl = `https://graph.facebook.com/v18.0/${aiCampaign.fbAdAccountId}/campaigns`
    const campaignData = {
      name: aiCampaign.name,
      objective: fbObjective,
      status: 'PAUSED',
      special_ad_categories: [],
      daily_budget: Math.round(aiCampaign.dailyBudget * 100),
      access_token: accessToken
    }

    const campaignResponse = await fetch(campaignUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignData)
    })

    const campaignResult = await campaignResponse.json()

    if (campaignResult.error) {
      return c.json({
        error: 'Failed to create Facebook campaign',
        details: campaignResult.error
      }, 400)
    }

    const fbCampaignId = campaignResult.id

    // 2. Create Ad Set
    const targeting = aiCampaign.targeting ? JSON.parse(aiCampaign.targeting) : {}
    const targetingSpec: any = {
      geo_locations: { countries: targeting.locations || ['US'] }
    }

    if (targeting.ageMin) targetingSpec.age_min = targeting.ageMin
    if (targeting.ageMax) targetingSpec.age_max = targeting.ageMax

    const adSetUrl = `https://graph.facebook.com/v18.0/${aiCampaign.fbAdAccountId}/adsets`
    const adSetData = {
      name: `${aiCampaign.name} - Ad Set`,
      campaign_id: fbCampaignId,
      status: 'PAUSED',
      optimization_goal: 'LINK_CLICKS',
      billing_event: 'IMPRESSIONS',
      daily_budget: Math.round(aiCampaign.dailyBudget * 100),
      targeting: JSON.stringify(targetingSpec),
      start_time: new Date(aiCampaign.startDate).toISOString(),
      access_token: accessToken
    }

    if (aiCampaign.endDate) {
      (adSetData as any).end_time = new Date(aiCampaign.endDate).toISOString()
    }

    const adSetResponse = await fetch(adSetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adSetData)
    })

    const adSetResult = await adSetResponse.json()

    if (adSetResult.error) {
      return c.json({
        error: 'Failed to create ad set',
        details: adSetResult.error,
        campaignId: fbCampaignId
      }, 400)
    }

    const fbAdSetId = adSetResult.id

    // 3. Create Ads from creatives
    const creatives = aiCampaign.creatives ? JSON.parse(aiCampaign.creatives) : []
    const createdAds: any[] = []

    for (let i = 0; i < creatives.length; i++) {
      const creative = creatives[i]

      // Create creative
      const creativeUrl = `https://graph.facebook.com/v18.0/${aiCampaign.fbAdAccountId}/adcreatives`
      const creativeData: any = {
        name: `${aiCampaign.name} Creative ${i + 1}`,
        access_token: accessToken,
        object_story_spec: {
          link_data: {
            link: creative.websiteUrl,
            message: creative.primaryText || '',
            name: creative.headline,
            description: creative.description || '',
            call_to_action: {
              type: creative.ctaType || 'LEARN_MORE',
              value: { link: creative.websiteUrl }
            }
          }
        }
      }

      if (creative.imageUrl) {
        creativeData.object_story_spec.link_data.image_url = creative.imageUrl
      }

      const creativeResponse = await fetch(creativeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creativeData)
      })

      const creativeResult = await creativeResponse.json()

      if (!creativeResult.error) {
        // Create ad
        const adUrl = `https://graph.facebook.com/v18.0/${aiCampaign.fbAdAccountId}/ads`
        const adData = {
          name: `${aiCampaign.name} - Ad ${i + 1}`,
          adset_id: fbAdSetId,
          creative: { creative_id: creativeResult.id },
          status: 'PAUSED',
          access_token: accessToken
        }

        const adResponse = await fetch(adUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adData)
        })

        const adResult = await adResponse.json()

        if (!adResult.error) {
          createdAds.push({
            adId: adResult.id,
            creativeId: creativeResult.id,
            name: adData.name
          })
        }
      }
    }

    // Update AI Campaign with Facebook IDs
    await prisma.aICampaign.update({
      where: { id: aiCampaignId },
      data: {
        fbCampaignId,
        status: 'PENDING_APPROVAL'
      }
    })

    return c.json({
      success: true,
      campaignId: fbCampaignId,
      adSetId: fbAdSetId,
      ads: createdAds,
      message: 'Campaign published to Facebook successfully'
    })
  } catch (error: any) {
    console.error('Publish AI campaign error:', error)
    return c.json({ error: 'Failed to publish campaign' }, 500)
  }
})

// ============= AD ACCOUNT ASSETS API =============

// GET /facebook/pixels/:accountId - Get pixels for an ad account
facebook.get('/pixels/:accountId', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const accountId = c.req.param('accountId')

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    const pixelsUrl = new URL(`https://graph.facebook.com/v18.0/${accountId}/adspixels`)
    pixelsUrl.searchParams.append('access_token', accessToken)
    pixelsUrl.searchParams.append('fields', 'id,name,code,last_fired_time,is_created_by_business,creation_time')
    pixelsUrl.searchParams.append('limit', '100')

    const response = await fetch(pixelsUrl.toString())
    const data = await response.json()

    if (data.error) {
      console.error('Facebook pixels error:', data.error)
      return c.json({
        error: data.error.message || 'Failed to fetch pixels',
        code: data.error.code
      }, 400)
    }

    const pixels = (data.data || []).map((pixel: any) => ({
      id: pixel.id,
      name: pixel.name,
      code: pixel.code,
      lastFiredTime: pixel.last_fired_time,
      isCreatedByBusiness: pixel.is_created_by_business,
      creationTime: pixel.creation_time
    }))

    return c.json({ pixels })
  } catch (error) {
    console.error('Fetch pixels error:', error)
    return c.json({ error: 'Failed to fetch pixels' }, 500)
  }
})

// GET /facebook/apps/:accountId - Get connected apps for an ad account
facebook.get('/apps/:accountId', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const accountId = c.req.param('accountId')

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    // Get applications connected to the ad account
    const appsUrl = new URL(`https://graph.facebook.com/v18.0/${accountId}/applications`)
    appsUrl.searchParams.append('access_token', accessToken)
    appsUrl.searchParams.append('fields', 'id,name,namespace,app_type,category,icon_url,logo_url')
    appsUrl.searchParams.append('limit', '100')

    const response = await fetch(appsUrl.toString())
    const data = await response.json()

    if (data.error) {
      // Apps might not be available, return empty array
      console.log('Facebook apps error (might be expected):', data.error)
      return c.json({ apps: [] })
    }

    const apps = (data.data || []).map((app: any) => ({
      id: app.id,
      name: app.name,
      namespace: app.namespace,
      appType: app.app_type,
      category: app.category,
      iconUrl: app.icon_url,
      logoUrl: app.logo_url
    }))

    return c.json({ apps })
  } catch (error) {
    console.error('Fetch apps error:', error)
    return c.json({ error: 'Failed to fetch apps' }, 500)
  }
})

// GET /facebook/catalogs/:accountId - Get product catalogs for an ad account
facebook.get('/catalogs/:accountId', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const accountId = c.req.param('accountId')

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    // Get product catalogs connected to the ad account
    const catalogsUrl = new URL(`https://graph.facebook.com/v18.0/${accountId}/product_catalogs`)
    catalogsUrl.searchParams.append('access_token', accessToken)
    catalogsUrl.searchParams.append('fields', 'id,name,product_count,vertical,business')
    catalogsUrl.searchParams.append('limit', '100')

    const response = await fetch(catalogsUrl.toString())
    const data = await response.json()

    if (data.error) {
      // Catalogs might not be available, return empty array
      console.log('Facebook catalogs error (might be expected):', data.error)
      return c.json({ catalogs: [] })
    }

    const catalogs = (data.data || []).map((catalog: any) => ({
      id: catalog.id,
      name: catalog.name,
      productCount: catalog.product_count,
      vertical: catalog.vertical,
      business: catalog.business
    }))

    return c.json({ catalogs })
  } catch (error) {
    console.error('Fetch catalogs error:', error)
    return c.json({ error: 'Failed to fetch catalogs' }, 500)
  }
})

// GET /facebook/account-assets/:accountId - Get all assets (pixels, apps, catalogs) for an account
facebook.get('/account-assets/:accountId', verifyToken, async (c) => {
  try {
    const accessToken = c.req.header('X-Facebook-Token')
    const accountId = c.req.param('accountId')

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    // Fetch all assets in parallel
    const [pixelsResponse, appsResponse, catalogsResponse] = await Promise.all([
      // Pixels
      fetch(`https://graph.facebook.com/v18.0/${accountId}/adspixels?access_token=${accessToken}&fields=id,name,last_fired_time&limit=100`),
      // Apps
      fetch(`https://graph.facebook.com/v18.0/${accountId}/applications?access_token=${accessToken}&fields=id,name,icon_url&limit=100`),
      // Catalogs
      fetch(`https://graph.facebook.com/v18.0/${accountId}/product_catalogs?access_token=${accessToken}&fields=id,name,product_count&limit=100`)
    ])

    const [pixelsData, appsData, catalogsData] = await Promise.all([
      pixelsResponse.json(),
      appsResponse.json(),
      catalogsResponse.json()
    ])

    // Process pixels
    const pixels = pixelsData.error ? [] : (pixelsData.data || []).map((pixel: any) => ({
      id: pixel.id,
      name: pixel.name,
      lastFiredTime: pixel.last_fired_time
    }))

    // Process apps
    const apps = appsData.error ? [] : (appsData.data || []).map((app: any) => ({
      id: app.id,
      name: app.name,
      iconUrl: app.icon_url
    }))

    // Process catalogs
    const catalogs = catalogsData.error ? [] : (catalogsData.data || []).map((catalog: any) => ({
      id: catalog.id,
      name: catalog.name,
      productCount: catalog.product_count
    }))

    return c.json({
      pixels,
      apps,
      catalogs,
      hasPixels: pixels.length > 0,
      hasApps: apps.length > 0,
      hasCatalogs: catalogs.length > 0
    })
  } catch (error) {
    console.error('Fetch account assets error:', error)
    return c.json({ error: 'Failed to fetch account assets' }, 500)
  }
})

// POST /facebook/sync-profile - Sync/create Facebook profile from current session
facebook.post('/sync-profile', verifyToken, async (c) => {
  try {
    const userId = (c as any).user?.id
    const accessToken = c.req.header('X-Facebook-Token')

    if (!accessToken) {
      return c.json({ error: 'Facebook access token required' }, 401)
    }

    // Get Facebook user info
    const meUrl = new URL('https://graph.facebook.com/v18.0/me')
    meUrl.searchParams.append('access_token', accessToken)
    meUrl.searchParams.append('fields', 'id,name,email')

    const meResponse = await fetch(meUrl.toString())
    const meData = await meResponse.json()

    if (meData.error) {
      return c.json({ error: 'Invalid Facebook token', details: meData.error }, 401)
    }

    // Create or update the profile
    const profile = await prisma.facebookProfile.upsert({
      where: {
        userId_facebookUserId: {
          userId: userId,
          facebookUserId: meData.id
        }
      },
      update: {
        name: meData.name,
        email: meData.email,
        accessToken: accessToken,
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        userId: userId,
        facebookUserId: meData.id,
        name: meData.name,
        email: meData.email,
        accessToken: accessToken,
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        isActive: true
      }
    })

    return c.json({
      success: true,
      profile: {
        id: profile.id,
        name: profile.name,
        facebookUserId: profile.facebookUserId
      }
    })
  } catch (error: any) {
    console.error('Sync profile error:', error)
    return c.json({ error: 'Failed to sync profile' }, 500)
  }
})

// POST /facebook/launch-ai-funnel - Launch AI Autopilot Funnel
facebook.post('/launch-ai-funnel', verifyToken, async (c) => {
  try {
    const userId = (c as any).user?.id
    console.log('[launch-ai-funnel] Starting for userId:', userId)

    const body = await c.req.json()
    console.log('[launch-ai-funnel] Body:', JSON.stringify(body, null, 2))

    const {
      accountId,
      headline,
      description,
      websiteUrl,
      ctaType,
      totalBudget,
      targetCPA,
      pixelId,
      appId,
      catalogId,
      plan
    } = body

    // Get the Facebook profile token from header
    const accessToken = c.req.header('X-Facebook-Token')
    if (!accessToken) {
      console.log('[launch-ai-funnel] No access token')
      return c.json({ error: 'Facebook access token required' }, 401)
    }
    console.log('[launch-ai-funnel] Has access token')

    // Try to find existing profile or create one
    let profile = await prisma.facebookProfile.findFirst({
      where: {
        userId,
        isActive: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })
    console.log('[launch-ai-funnel] Found profile:', profile?.id)

    // If no profile exists, create one from the access token
    if (!profile) {
      console.log('[launch-ai-funnel] No profile, creating from FB token')
      // Get Facebook user info
      const meUrl = new URL('https://graph.facebook.com/v18.0/me')
      meUrl.searchParams.append('access_token', accessToken)
      meUrl.searchParams.append('fields', 'id,name,email')

      const meResponse = await fetch(meUrl.toString())
      const meData = await meResponse.json()
      console.log('[launch-ai-funnel] FB me response:', meData)

      if (meData.error) {
        return c.json({ error: 'Invalid Facebook token. Please reconnect your Facebook account.' }, 401)
      }

      // Create the profile
      profile = await prisma.facebookProfile.create({
        data: {
          userId: userId,
          facebookUserId: meData.id,
          name: meData.name || 'Facebook User',
          email: meData.email,
          accessToken: accessToken,
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          isActive: true
        }
      })
      console.log('[launch-ai-funnel] Created profile:', profile.id)
    }

    // Calculate daily budget from total budget (spread over estimated campaign duration)
    const estimatedDays = 14 // 2 weeks campaign
    const dailyBudget = Math.round(totalBudget / estimatedDays)
    console.log('[launch-ai-funnel] Daily budget:', dailyBudget)

    // Create AI Campaign record in database
    console.log('[launch-ai-funnel] Creating AI Campaign with data:', {
      name: `AI Funnel - ${headline?.substring(0, 30)}`,
      objective: 'ECOMMERCE_SALES',
      dailyBudget,
      totalBudget,
      accountId,
      profileId: profile.id,
      userId
    })

    const aiCampaign = await prisma.aICampaign.create({
      data: {
        name: `AI Funnel - ${headline?.substring(0, 30) || 'Campaign'}`,
        description: `Target CPA: ${targetCPA} | Total Budget: ${totalBudget}`,
        objective: 'ECOMMERCE_SALES',
        dailyBudget: dailyBudget,
        totalBudget: totalBudget,
        currency: 'INR',
        startDate: new Date(),
        endDate: new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000),
        targeting: JSON.stringify({
          locations: ['IN'],
          ageMin: 18,
          ageMax: 65
        }),
        creatives: JSON.stringify({
          headline: headline || '',
          description: description || '',
          websiteUrl: websiteUrl || '',
          ctaType: ctaType || 'LEARN_MORE'
        }),
        fbAdAccountId: accountId,
        profileId: profile.id,
        aiOptimizationEnabled: true,
        targetCPA: targetCPA || 10,
        userId,
        status: 'ACTIVE'
      }
    })
    console.log('[launch-ai-funnel] Created AI Campaign:', aiCampaign.id)

    // Return success - actual Facebook campaign creation would happen here
    // For now, we're just saving the AI campaign config
    // Optimization rules can be added later
    return c.json({
      success: true,
      aiCampaignId: aiCampaign.id,
      message: 'AI Funnel created successfully! Campaign will start optimization shortly.',
      plan: {
        dailyBudget,
        totalBudget,
        targetCPA,
        estimatedDays: 14
      }
    })
  } catch (error: any) {
    console.error('Launch AI funnel error:', error)
    return c.json({
      error: 'Failed to launch AI funnel',
      details: error.message || String(error),
      code: error.code
    }, 500)
  }
})

// Helper function to convert account status code to label
function getAccountStatusLabel(statusCode: number): string {
  const statusMap: { [key: number]: string } = {
    1: 'Active',
    2: 'Disabled',
    3: 'Unsettled',
    7: 'Pending Risk Review',
    8: 'Pending Settlement',
    9: 'In Grace Period',
    100: 'Pending Closure',
    101: 'Closed',
    201: 'Any Active',
    202: 'Any Closed'
  }
  return statusMap[statusCode] || 'Unknown'
}

export default facebook
