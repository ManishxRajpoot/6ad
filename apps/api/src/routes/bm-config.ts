// BM Configuration Routes - Admin only
// Manage Business Manager configurations for auto BM sharing

import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { verifyToken, requireAdmin } from '../middleware/auth.js'
import { facebookBMApi } from '../services/facebook-bm-api.js'

const prisma = new PrismaClient()
const bmConfig = new Hono()

bmConfig.use('*', verifyToken)

// Schema for creating/updating BM config
const bmConfigSchema = z.object({
  bmId: z.string().min(1),
  bmName: z.string().min(1),
  accessToken: z.string().min(1),
  apiType: z.enum(['facebook', 'cheetah']).default('facebook'),
  isActive: z.boolean().default(true),
})

// GET /bm-config - List all BM configurations
bmConfig.get('/', requireAdmin, async (c) => {
  try {
    const configs = await prisma.bMConfig.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        bmId: true,
        bmName: true,
        apiType: true,
        isActive: true,
        totalAccounts: true,
        lastSyncAt: true,
        createdAt: true,
        // Don't return accessToken for security
      }
    })

    return c.json({ configs })
  } catch (error) {
    console.error('Get BM configs error:', error)
    return c.json({ error: 'Failed to get BM configurations' }, 500)
  }
})

// GET /bm-config/:id - Get single BM config (with token for editing)
bmConfig.get('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    const config = await prisma.bMConfig.findUnique({
      where: { id }
    })

    if (!config) {
      return c.json({ error: 'BM configuration not found' }, 404)
    }

    // Mask the token for display (show first and last 10 chars)
    const maskedToken = config.accessToken.length > 20
      ? `${config.accessToken.substring(0, 10)}...${config.accessToken.substring(config.accessToken.length - 10)}`
      : '***'

    return c.json({
      config: {
        ...config,
        accessToken: maskedToken,
        fullToken: config.accessToken // Only for edit form
      }
    })
  } catch (error) {
    console.error('Get BM config error:', error)
    return c.json({ error: 'Failed to get BM configuration' }, 500)
  }
})

// POST /bm-config - Create new BM configuration
bmConfig.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const data = bmConfigSchema.parse(body)

    // Check if BM already exists
    const existing = await prisma.bMConfig.findUnique({
      where: { bmId: data.bmId }
    })

    if (existing) {
      return c.json({ error: 'This Business Manager is already configured' }, 400)
    }

    // Validate token by making a test API call
    if (data.apiType === 'facebook') {
      try {
        const testUrl = `https://graph.facebook.com/v18.0/${data.bmId}?fields=name&access_token=${data.accessToken}`
        const testResponse = await fetch(testUrl)
        const testResult = await testResponse.json() as any

        if (testResult.error) {
          return c.json({
            error: `Invalid token or BM ID: ${testResult.error.message}`
          }, 400)
        }

        // Update BM name from Facebook if available
        if (testResult.name) {
          data.bmName = testResult.name
        }
      } catch (e: any) {
        return c.json({ error: `Token validation failed: ${e.message}` }, 400)
      }
    }

    const config = await prisma.bMConfig.create({
      data: {
        bmId: data.bmId,
        bmName: data.bmName,
        accessToken: data.accessToken,
        apiType: data.apiType,
        isActive: data.isActive,
      }
    })

    // Add to in-memory service
    facebookBMApi.addBMConfig({
      bmId: config.bmId,
      bmName: config.bmName,
      accessToken: config.accessToken,
      isActive: config.isActive,
    })

    return c.json({
      message: 'BM configuration created successfully',
      config: {
        id: config.id,
        bmId: config.bmId,
        bmName: config.bmName,
        apiType: config.apiType,
        isActive: config.isActive,
      }
    })
  } catch (error: any) {
    console.error('Create BM config error:', error)
    if (error.name === 'ZodError') {
      return c.json({ error: 'Invalid input data', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to create BM configuration' }, 500)
  }
})

// PUT /bm-config/:id - Update BM configuration
bmConfig.put('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()

    const existing = await prisma.bMConfig.findUnique({ where: { id } })
    if (!existing) {
      return c.json({ error: 'BM configuration not found' }, 404)
    }

    const updateData: any = {}
    if (body.bmName) updateData.bmName = body.bmName
    if (body.accessToken) updateData.accessToken = body.accessToken
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive

    const config = await prisma.bMConfig.update({
      where: { id },
      data: updateData
    })

    // Update in-memory service
    facebookBMApi.addBMConfig({
      bmId: config.bmId,
      bmName: config.bmName,
      accessToken: config.accessToken,
      isActive: config.isActive,
    })

    return c.json({
      message: 'BM configuration updated successfully',
      config: {
        id: config.id,
        bmId: config.bmId,
        bmName: config.bmName,
        isActive: config.isActive,
      }
    })
  } catch (error) {
    console.error('Update BM config error:', error)
    return c.json({ error: 'Failed to update BM configuration' }, 500)
  }
})

// DELETE /bm-config/:id - Delete BM configuration
bmConfig.delete('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    const existing = await prisma.bMConfig.findUnique({ where: { id } })
    if (!existing) {
      return c.json({ error: 'BM configuration not found' }, 404)
    }

    await prisma.bMConfig.delete({ where: { id } })

    // Remove from in-memory service
    facebookBMApi.removeBMConfig(existing.bmId)

    return c.json({ message: 'BM configuration deleted successfully' })
  } catch (error) {
    console.error('Delete BM config error:', error)
    return c.json({ error: 'Failed to delete BM configuration' }, 500)
  }
})

// POST /bm-config/:id/test - Test BM configuration
bmConfig.post('/:id/test', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    const config = await prisma.bMConfig.findUnique({ where: { id } })
    if (!config) {
      return c.json({ error: 'BM configuration not found' }, 404)
    }

    if (config.apiType === 'facebook') {
      // Test by fetching BM info
      const testUrl = `https://graph.facebook.com/v18.0/${config.bmId}?fields=name,id&access_token=${config.accessToken}`
      const testResponse = await fetch(testUrl)
      const testResult = await testResponse.json() as any

      if (testResult.error) {
        return c.json({
          success: false,
          error: `Facebook API Error: ${testResult.error.message}`
        })
      }

      // Also get owned ad accounts count
      const accountsUrl = `https://graph.facebook.com/v18.0/${config.bmId}/owned_ad_accounts?access_token=${config.accessToken}&limit=200`
      const accountsResponse = await fetch(accountsUrl)
      const accountsResult = await accountsResponse.json() as any

      const accountCount = accountsResult.data?.length || 0

      // Update total accounts count
      await prisma.bMConfig.update({
        where: { id },
        data: {
          totalAccounts: accountCount,
          lastSyncAt: new Date()
        }
      })

      return c.json({
        success: true,
        bmName: testResult.name,
        bmId: testResult.id,
        accountCount,
        message: `Connected successfully! Found ${accountCount} ad accounts.`
      })
    }

    return c.json({ error: 'Unsupported API type' }, 400)
  } catch (error: any) {
    console.error('Test BM config error:', error)
    return c.json({
      success: false,
      error: `Test failed: ${error.message}`
    })
  }
})

// POST /bm-config/:id/sync-accounts - Sync ad accounts from this BM
bmConfig.post('/:id/sync-accounts', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    const config = await prisma.bMConfig.findUnique({ where: { id } })
    if (!config) {
      return c.json({ error: 'BM configuration not found' }, 404)
    }

    if (config.apiType === 'facebook') {
      const accountsUrl = `https://graph.facebook.com/v18.0/${config.bmId}/owned_ad_accounts?fields=id,name,account_status&access_token=${config.accessToken}&limit=200`
      const accountsResponse = await fetch(accountsUrl)
      const accountsResult = await accountsResponse.json() as any

      if (accountsResult.error) {
        return c.json({
          success: false,
          error: `Facebook API Error: ${accountsResult.error.message}`
        })
      }

      const accounts = accountsResult.data || []

      // Update total accounts count
      await prisma.bMConfig.update({
        where: { id },
        data: {
          totalAccounts: accounts.length,
          lastSyncAt: new Date()
        }
      })

      return c.json({
        success: true,
        accounts: accounts.map((acc: any) => ({
          accountId: acc.id.replace('act_', ''),
          name: acc.name,
          status: acc.account_status
        })),
        total: accounts.length
      })
    }

    return c.json({ error: 'Unsupported API type' }, 400)
  } catch (error: any) {
    console.error('Sync accounts error:', error)
    return c.json({
      success: false,
      error: `Sync failed: ${error.message}`
    })
  }
})

// Initialize BM configs from database on startup
export async function initializeBMConfigs() {
  try {
    const configs = await prisma.bMConfig.findMany({
      where: { isActive: true }
    })

    for (const config of configs) {
      facebookBMApi.addBMConfig({
        bmId: config.bmId,
        bmName: config.bmName,
        accessToken: config.accessToken,
        isActive: config.isActive,
      })
    }

    console.log(`[BM Config] Loaded ${configs.length} BM configurations`)
  } catch (error) {
    console.error('[BM Config] Failed to initialize:', error)
  }
}

export default bmConfig
