import { Hono } from 'hono'
import { cheetahApi } from '../services/cheetah-api.js'
import { verifyToken } from '../middleware/auth.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const app = new Hono()

// All routes require authentication
app.use('*', verifyToken)

// Hardcoded Cheetah API credentials
const CHEETAH_CREDENTIALS = {
  test: {
    appid: 'D6lVRPk',
    secret: 'f38d64ad-0d0b-4e94-8c5f-27a9e014bf87',
    baseUrl: 'https://test-open-api.neverbugs.com',
  },
  production: {
    appid: 'wvLY386',
    secret: '7fd454af-84f1-4e62-9130-4989181063ed',
    baseUrl: 'https://open-api.cmcm.com',
  },
}

// ==================== Configuration ====================

// Get Cheetah API configuration status
app.get('/config/status', async (c) => {
  try {
    const settings = await prisma.setting.findUnique({
      where: { key: 'cheetah_api_config' }
    })

    if (settings?.value) {
      const config = JSON.parse(settings.value)
      const env = (config.environment || 'test') as 'test' | 'production'
      return c.json({
        isConfigured: true,
        environment: env,
        baseUrl: CHEETAH_CREDENTIALS[env].baseUrl,
      })
    }

    return c.json({
      isConfigured: false,
      environment: 'test',
      baseUrl: null,
    })
  } catch (error) {
    return c.json({ isConfigured: false, environment: 'test' })
  }
})

// Update Cheetah API configuration (admin only)
// Only needs environment selection: 'test' or 'production'
app.post('/config', async (c) => {
  const user = c.get('user' as any)
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const body = await c.req.json()
  const { environment } = body // 'test' or 'production'

  if (!environment || !['test', 'production'].includes(environment)) {
    return c.json({ error: 'environment must be "test" or "production"' }, 400)
  }

  const credentials = CHEETAH_CREDENTIALS[environment as 'test' | 'production']
  const config = {
    appId: credentials.appid,
    secret: credentials.secret,
    baseUrl: credentials.baseUrl,
    environment,
  }

  try {
    // Save to database WITHOUT testing connection
    // Connection will be tested when actually used
    await prisma.setting.upsert({
      where: { key: 'cheetah_api_config' },
      update: { value: JSON.stringify(config) },
      create: { key: 'cheetah_api_config', value: JSON.stringify(config) },
    })

    // Set config for immediate use
    cheetahApi.setConfig(credentials)

    return c.json({
      message: `Cheetah API configured successfully (${environment} environment)`,
      environment,
    })
  } catch (error: any) {
    return c.json({ error: `Configuration failed: ${error.message}` }, 400)
  }
})

// Test Cheetah API connection
app.post('/config/test', async (c) => {
  const user = c.get('user' as any)
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  try {
    await initCheetahApi()
    const token = await cheetahApi.getAccessToken()

    // Also try to get quota to verify full functionality
    const quotaResult = await cheetahApi.getQuota()

    return c.json({
      success: true,
      message: 'Connection successful',
      quota: quotaResult.code === 0 ? quotaResult.data.available_quota : 'Unable to fetch quota'
    })
  } catch (error: any) {
    return c.json({
      success: false,
      error: `Connection test failed: ${error.message}`
    }, 400)
  }
})

// Initialize Cheetah API from database config
async function initCheetahApi() {
  try {
    const settings = await prisma.setting.findUnique({
      where: { key: 'cheetah_api_config' }
    })

    if (settings?.value) {
      const config = JSON.parse(settings.value)
      // Support both old format (appId) and use hardcoded credentials
      const env = config.environment || 'test'
      const credentials = CHEETAH_CREDENTIALS[env as 'test' | 'production']
      cheetahApi.setConfig(credentials)
      return true
    }
    return false
  } catch (error) {
    console.error('Failed to initialize Cheetah API:', error)
    return false
  }
}

// ==================== Account APIs ====================

// Get all Facebook accounts from Cheetah
app.get('/accounts', async (c) => {
  await initCheetahApi()

  const page = Number(c.req.query('page')) || 1
  const pageSize = Number(c.req.query('page_size')) || 200
  const accountId = c.req.query('account_id')
  const accountStatus = c.req.query('account_status')

  try {
    const result = await cheetahApi.getAccountList({
      page,
      page_size: pageSize,
      account_id: accountId,
      account_status: accountStatus,
    })

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json(result.data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get single account
app.get('/accounts/:accountId', async (c) => {
  await initCheetahApi()

  const accountId = c.req.param('accountId')

  try {
    const result = await cheetahApi.getAccount(accountId)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({ account: result.data[0] })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Update account name
app.patch('/accounts/:accountId/name', async (c) => {
  await initCheetahApi()

  const accountId = c.req.param('accountId')
  const { name } = await c.req.json()

  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  try {
    const result = await cheetahApi.updateAccountName(accountId, name)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({ message: 'Account name updated successfully' })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Recharge account (adjust spend cap)
app.post('/accounts/:accountId/recharge', async (c) => {
  await initCheetahApi()

  const accountId = c.req.param('accountId')
  const { spend_cap } = await c.req.json()

  if (!spend_cap || spend_cap <= 0) {
    return c.json({ error: 'Valid spend_cap is required' }, 400)
  }

  try {
    const result = await cheetahApi.rechargeAccount(accountId, spend_cap)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({
      message: 'Account recharged successfully',
      serial_number: result.data.serial_number,
      operation_type: result.data.operation_type,
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Reset account (clear spent amount)
app.post('/accounts/:accountId/reset', async (c) => {
  await initCheetahApi()

  const accountId = c.req.param('accountId')

  try {
    const result = await cheetahApi.resetAccount(accountId)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({
      message: 'Account reset successfully',
      account_id: result.data.account_id,
      reset_amount: result.data.reset_amount,
      serial_number: result.data.serial_number,
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get account operation log
app.get('/accounts/:accountId/operations', async (c) => {
  await initCheetahApi()

  const accountId = c.req.param('accountId')
  const startTime = c.req.query('start_time')
  const endTime = c.req.query('end_time')

  try {
    const result = await cheetahApi.getAccountOperationLog({
      account_id: accountId,
      start_time: startTime,
      end_time: endTime,
    })

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({ operations: result.data })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get account API usage count
app.get('/accounts/:accountId/usage', async (c) => {
  await initCheetahApi()

  const accountId = c.req.param('accountId')

  try {
    const result = await cheetahApi.getAccountUsedCount(accountId)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({
      account_id: accountId,
      used_count: result.data.used_count,
      remaining: 7 - result.data.used_count,
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ==================== BM Share APIs ====================

// Bind account to BM
app.post('/bm/bind', async (c) => {
  await initCheetahApi()

  const { account_id, business_id, type } = await c.req.json()

  if (!account_id || !business_id || type === undefined) {
    return c.json({ error: 'account_id, business_id, and type are required' }, 400)
  }

  if (![0, 1, 2].includes(type)) {
    return c.json({ error: 'type must be 0 (unbind), 1 (view), or 2 (manage)' }, 400)
  }

  try {
    const result = await cheetahApi.bindAccountToBM(account_id, business_id, type)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    const typeText = type === 0 ? 'unbound' : type === 1 ? 'view access' : 'manage access'
    return c.json({ message: `Successfully ${type === 0 ? 'unbound' : 'bound'} account with ${typeText}` })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get BM bindings for account
app.get('/bm/bindings/:accountId', async (c) => {
  await initCheetahApi()

  const accountId = c.req.param('accountId')

  try {
    const result = await cheetahApi.getBMBindings(accountId)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json(result.data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ==================== Pixel APIs ====================

// Bind pixel to account
app.post('/pixel/bind', async (c) => {
  await initCheetahApi()

  const { pixel_id, account_id, type } = await c.req.json()

  if (!pixel_id || !account_id || !type) {
    return c.json({ error: 'pixel_id, account_id, and type are required' }, 400)
  }

  if (![1, 2].includes(type)) {
    return c.json({ error: 'type must be 1 (bind) or 2 (unbind)' }, 400)
  }

  try {
    const result = await cheetahApi.bindPixelToAccount(pixel_id, account_id, type)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({ message: `Pixel ${type === 1 ? 'bound' : 'unbound'} successfully` })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get pixel bindings
app.get('/pixel/bindings', async (c) => {
  await initCheetahApi()

  const pixelId = c.req.query('pixel_id')
  const accountId = c.req.query('account_id')

  if (!pixelId && !accountId) {
    return c.json({ error: 'Either pixel_id or account_id is required' }, 400)
  }

  try {
    const result = await cheetahApi.getPixelBindings({
      pixel_id: pixelId,
      account_id: accountId,
    })

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json(result.data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Submit pixel-BM binding job
app.post('/pixel/bm-job', async (c) => {
  await initCheetahApi()

  const bindings = await c.req.json()

  if (!Array.isArray(bindings) || bindings.length === 0) {
    return c.json({ error: 'Array of bindings is required' }, 400)
  }

  try {
    const result = await cheetahApi.submitPixelBMBindingJob(bindings)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({
      message: 'Pixel-BM binding job submitted',
      job_id: result.data.job_id,
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ==================== Job APIs ====================

// Get job status
app.get('/jobs/:jobId/status', async (c) => {
  await initCheetahApi()

  const jobId = c.req.param('jobId')

  try {
    const result = await cheetahApi.getJobStatus({ job_id: jobId })

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json(result.data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get job list
app.get('/jobs', async (c) => {
  await initCheetahApi()

  const page = Number(c.req.query('page')) || 1
  const pageSize = Number(c.req.query('page_size')) || 10
  const jobStatus = c.req.query('job_status')

  try {
    const result = await cheetahApi.getJobList({
      page,
      page_size: pageSize,
      job_status: jobStatus ? Number(jobStatus) : undefined,
    })

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json(result.data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Create OE opening link
app.post('/jobs/oe-link', async (c) => {
  await initCheetahApi()

  try {
    const result = await cheetahApi.createOEToken()

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({
      token: result.data.token,
      open_account_link: result.data.open_account_link,
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ==================== Spending/Insights APIs ====================

// Get daily spend
app.get('/spend/daily', async (c) => {
  await initCheetahApi()

  const accountId = c.req.query('account_id')
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')

  if (!accountId || !startDate || !endDate) {
    return c.json({ error: 'account_id, start_date, and end_date are required' }, 400)
  }

  try {
    const result = await cheetahApi.getDaySpend(accountId, startDate, endDate)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({ spend: result.data })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get total daily spend
app.get('/spend/total', async (c) => {
  await initCheetahApi()

  const date = c.req.query('date')

  if (!date) {
    return c.json({ error: 'date is required (YYYY-MM-DD)' }, 400)
  }

  try {
    const result = await cheetahApi.getDayTotalSpend(date)

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json(result.data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get account insights
app.get('/insights', async (c) => {
  await initCheetahApi()

  const accountId = c.req.query('account_id')
  const date = c.req.query('date')
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')
  const fields = c.req.query('fields') || 'impressions,clicks,actions,spend'

  if (!accountId) {
    return c.json({ error: 'account_id is required' }, 400)
  }

  try {
    let result
    if (startDate && endDate) {
      result = await cheetahApi.getAccountInsightsDateRange(accountId, startDate, endDate, fields)
    } else if (date) {
      result = await cheetahApi.getAccountInsights(accountId, date, fields)
    } else {
      return c.json({ error: 'Either date or (start_date and end_date) is required' }, 400)
    }

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({ insights: result.data })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ==================== Finance APIs ====================

// Get available quota
app.get('/quota', async (c) => {
  await initCheetahApi()

  try {
    const result = await cheetahApi.getQuota()

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json({
      available_quota: result.data.available_quota,
      available_quota_usd: parseFloat(result.data.available_quota),
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get payment list
app.get('/payments', async (c) => {
  await initCheetahApi()

  const page = Number(c.req.query('page')) || 1
  const pageSize = Number(c.req.query('page_size')) || 10

  try {
    const result = await cheetahApi.getPaymentList({
      page,
      page_size: pageSize,
    })

    if (result.code !== 0) {
      return c.json({ error: result.msg }, 400)
    }

    return c.json(result.data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default app
