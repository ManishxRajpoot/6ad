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
    adAccountsUrl.searchParams.append('fields', 'id,account_id,name,account_status,amount_spent,balance,currency,business_name,funding_source_details,disable_reason,created_time')
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
    const adAccounts = (adAccountsData.data || []).map((account: any) => ({
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
      createdTime: account.created_time
    }))

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
