import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
import { verifyToken, requireAdmin, requireUser } from '../middleware/auth.js'
import { broadcast } from '../services/event-bus.js'

const settings = new Hono()

settings.use('*', verifyToken)

// ============= PAY LINKS =============

// GET /settings/paylinks - List pay links
settings.get('/paylinks', requireAdmin, async (c) => {
  try {
    const { status, page = '1', limit = '20' } = c.req.query()

    const where: any = {}
    if (status) where.status = status.toUpperCase()

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [paylinks, total] = await Promise.all([
      prisma.payLink.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, email: true }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payLink.count({ where })
    ])

    return c.json({
      paylinks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get paylinks error:', error)
    return c.json({ error: 'Failed to get paylinks' }, 500)
  }
})

// POST /settings/paylinks - Create pay link
settings.post('/paylinks', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const {
      type,
      title,
      description,
      bankName,
      accountNumber,
      accountHolderName,
      ifscCode,
      upiId,
    } = await c.req.json()

    if (!type || !title) {
      return c.json({ error: 'Type and title are required' }, 400)
    }

    const paylink = await prisma.payLink.create({
      data: {
        type,
        title,
        description,
        bankName,
        accountNumber,
        accountHolderName,
        ifscCode,
        upiId,
        userId,
      }
    })

    return c.json({ message: 'Pay link created', paylink }, 201)
  } catch (error) {
    console.error('Create paylink error:', error)
    return c.json({ error: 'Failed to create pay link' }, 500)
  }
})

// PATCH /settings/paylinks/:id/status - Toggle pay link status
settings.patch('/paylinks/:id/status', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { status } = await c.req.json()

    await prisma.payLink.update({
      where: { id },
      data: { status }
    })

    return c.json({ message: 'Pay link status updated' })
  } catch (error) {
    console.error('Update paylink status error:', error)
    return c.json({ error: 'Failed to update status' }, 500)
  }
})

// ============= CUSTOM DOMAINS =============

// GET /settings/domains - List custom domain applications
settings.get('/domains', requireAdmin, async (c) => {
  try {
    const { status, page = '1', limit = '20' } = c.req.query()

    const where: any = {}
    if (status) where.status = status.toUpperCase()

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [domains, total] = await Promise.all([
      prisma.customDomain.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.customDomain.count({ where })
    ])

    return c.json({
      domains,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get domains error:', error)
    return c.json({ error: 'Failed to get domains' }, 500)
  }
})

// POST /settings/domains - Apply for custom domain
settings.post('/domains', async (c) => {
  try {
    const {
      domain,
      brandName,
      applicantEmail,
      applicantName,
    } = await c.req.json()

    if (!domain || !brandName || !applicantEmail || !applicantName) {
      return c.json({ error: 'All fields are required' }, 400)
    }

    // Check if domain already exists
    const existing = await prisma.customDomain.findUnique({
      where: { domain }
    })

    if (existing) {
      return c.json({ error: 'Domain already exists' }, 409)
    }

    const domainApp = await prisma.customDomain.create({
      data: {
        domain,
        brandName,
        applicantEmail,
        applicantName,
      }
    })

    return c.json({ message: 'Domain application submitted', domain: domainApp }, 201)
  } catch (error) {
    console.error('Create domain error:', error)
    return c.json({ error: 'Failed to apply for domain' }, 500)
  }
})

// POST /settings/domains/:id/approve
settings.post('/domains/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    await prisma.customDomain.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminRemarks,
        approvedAt: new Date()
      }
    })

    return c.json({ message: 'Domain approved' })
  } catch (error) {
    console.error('Approve domain error:', error)
    return c.json({ error: 'Failed to approve domain' }, 500)
  }
})

// POST /settings/domains/:id/reject
settings.post('/domains/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    await prisma.customDomain.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks,
        rejectedAt: new Date()
      }
    })

    return c.json({ message: 'Domain rejected' })
  } catch (error) {
    console.error('Reject domain error:', error)
    return c.json({ error: 'Failed to reject domain' }, 500)
  }
})

// ============= SITE SETTINGS =============

// GET /settings/site - Get site settings
settings.get('/site', async (c) => {
  try {
    const host = c.req.header('host') || '6ad.in'
    const domain = host.replace(/:\d+$/, '') // Remove port

    let siteSettings = await prisma.siteSettings.findUnique({
      where: { domain }
    })

    // Return default settings if not found
    if (!siteSettings) {
      siteSettings = await prisma.siteSettings.findUnique({
        where: { domain: '6ad.in' }
      })
    }

    return c.json({ settings: siteSettings })
  } catch (error) {
    console.error('Get site settings error:', error)
    return c.json({ error: 'Failed to get settings' }, 500)
  }
})

// PATCH /settings/site - Update site settings (Admin only)
settings.patch('/site', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const domain = body.domain || '6ad.in'

    const updated = await prisma.siteSettings.upsert({
      where: { domain },
      update: body,
      create: {
        domain,
        brandName: body.brandName || '6AD',
        ...body
      }
    })

    // Broadcast real-time update
    broadcast({ event: 'site-settings-updated', data: { action: 'updated' } })

    return c.json({ message: 'Settings updated', settings: updated })
  } catch (error) {
    console.error('Update site settings error:', error)
    return c.json({ error: 'Failed to update settings' }, 500)
  }
})

// ============= MODULES =============

// GET /settings/modules - Get all modules
settings.get('/modules', requireAdmin, async (c) => {
  try {
    const modules = await prisma.module.findMany({
      orderBy: [{ role: 'asc' }, { priority: 'asc' }]
    })

    return c.json({ modules })
  } catch (error) {
    console.error('Get modules error:', error)
    return c.json({ error: 'Failed to get modules' }, 500)
  }
})

// POST /settings/modules - Create module
settings.post('/modules', requireAdmin, async (c) => {
  try {
    const { route, label, icon, role, priority } = await c.req.json()

    const module = await prisma.module.create({
      data: { route, label, icon, role, priority }
    })

    return c.json({ message: 'Module created', module }, 201)
  } catch (error) {
    console.error('Create module error:', error)
    return c.json({ error: 'Failed to create module' }, 500)
  }
})

// PATCH /settings/modules/:id
settings.patch('/modules/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json()

    const module = await prisma.module.update({
      where: { id },
      data: body
    })

    return c.json({ message: 'Module updated', module })
  } catch (error) {
    console.error('Update module error:', error)
    return c.json({ error: 'Failed to update module' }, 500)
  }
})

// ============= PLATFORM SETTINGS =============

// GET /settings/platforms - Get platform visibility settings
settings.get('/platforms', async (c) => {
  try {
    let globalSettings = await prisma.globalSettings.findFirst()

    // Create default settings if not exists
    if (!globalSettings) {
      globalSettings = await prisma.globalSettings.create({
        data: {
          payLinkEnabled: true,
          facebookStatus: 'active',
          googleStatus: 'active',
          tiktokStatus: 'active',
          snapchatStatus: 'active',
          bingStatus: 'active',
        }
      })
    }

    return c.json({
      platforms: {
        facebook: globalSettings.facebookStatus || 'active',
        google: globalSettings.googleStatus || 'active',
        tiktok: globalSettings.tiktokStatus || 'active',
        snapchat: globalSettings.snapchatStatus || 'active',
        bing: globalSettings.bingStatus || 'active',
      }
    })
  } catch (error) {
    console.error('Get platform settings error:', error)
    return c.json({ error: 'Failed to get platform settings' }, 500)
  }
})

// PATCH /settings/platforms - Update platform visibility settings (Admin only)
settings.patch('/platforms', requireAdmin, async (c) => {
  try {
    const { facebook, google, tiktok, snapchat, bing } = await c.req.json()

    let globalSettings = await prisma.globalSettings.findFirst()

    const updateData: any = {}
    if (facebook !== undefined) updateData.facebookStatus = facebook
    if (google !== undefined) updateData.googleStatus = google
    if (tiktok !== undefined) updateData.tiktokStatus = tiktok
    if (snapchat !== undefined) updateData.snapchatStatus = snapchat
    if (bing !== undefined) updateData.bingStatus = bing

    if (globalSettings) {
      globalSettings = await prisma.globalSettings.update({
        where: { id: globalSettings.id },
        data: updateData
      })
    } else {
      globalSettings = await prisma.globalSettings.create({
        data: {
          payLinkEnabled: true,
          facebookStatus: facebook || 'active',
          googleStatus: google || 'active',
          tiktokStatus: tiktok || 'active',
          snapchatStatus: snapchat || 'active',
          bingStatus: bing || 'active',
        }
      })
    }

    // Broadcast real-time update
    broadcast({ event: 'platforms-updated', data: { action: 'updated' } })

    return c.json({
      message: 'Platform settings updated',
      platforms: {
        facebook: globalSettings.facebookStatus,
        google: globalSettings.googleStatus,
        tiktok: globalSettings.tiktokStatus,
        snapchat: globalSettings.snapchatStatus,
        bing: globalSettings.bingStatus,
      }
    })
  } catch (error) {
    console.error('Update platform settings error:', error)
    return c.json({ error: 'Failed to update platform settings' }, 500)
  }
})

// ============= PROFILE SHARE LINKS =============

// GET /settings/profile-share-links - Get profile share links for platforms
settings.get('/profile-share-links', async (c) => {
  try {
    let globalSettings = await prisma.globalSettings.findFirst()

    // Create default settings if not exists
    if (!globalSettings) {
      globalSettings = await prisma.globalSettings.create({
        data: {
          payLinkEnabled: true,
          facebookStatus: 'active',
          googleStatus: 'active',
          tiktokStatus: 'active',
          snapchatStatus: 'active',
          bingStatus: 'active',
          facebookProfileShareLink: 'https://www.facebook.com/profile/6adplatform',
          tiktokProfileShareLink: 'https://business.tiktok.com/share/6adplatform',
        }
      })
    }

    return c.json({
      profileShareLinks: {
        facebook: globalSettings.facebookProfileShareLink || 'https://www.facebook.com/profile/6adplatform',
        tiktok: globalSettings.tiktokProfileShareLink || 'https://business.tiktok.com/share/6adplatform',
      }
    })
  } catch (error) {
    console.error('Get profile share links error:', error)
    return c.json({ error: 'Failed to get profile share links' }, 500)
  }
})

// PATCH /settings/profile-share-links - Update profile share links (Admin only)
settings.patch('/profile-share-links', requireAdmin, async (c) => {
  try {
    const { facebook, tiktok } = await c.req.json()

    let globalSettings = await prisma.globalSettings.findFirst()

    const updateData: any = {}
    if (facebook !== undefined) updateData.facebookProfileShareLink = facebook
    if (tiktok !== undefined) updateData.tiktokProfileShareLink = tiktok

    if (globalSettings) {
      globalSettings = await prisma.globalSettings.update({
        where: { id: globalSettings.id },
        data: updateData
      })
    } else {
      globalSettings = await prisma.globalSettings.create({
        data: {
          payLinkEnabled: true,
          facebookStatus: 'active',
          googleStatus: 'active',
          tiktokStatus: 'active',
          snapchatStatus: 'active',
          bingStatus: 'active',
          facebookProfileShareLink: facebook || 'https://www.facebook.com/profile/6adplatform',
          tiktokProfileShareLink: tiktok || 'https://business.tiktok.com/share/6adplatform',
        }
      })
    }

    // Broadcast real-time update
    broadcast({ event: 'settings-updated', data: { setting: 'profile-share-links' } })

    return c.json({
      message: 'Profile share links updated',
      profileShareLinks: {
        facebook: globalSettings.facebookProfileShareLink,
        tiktok: globalSettings.tiktokProfileShareLink,
      }
    })
  } catch (error) {
    console.error('Update profile share links error:', error)
    return c.json({ error: 'Failed to update profile share links' }, 500)
  }
})

// ============= PROFILE =============

// PATCH /settings/profile - Update own profile
settings.patch('/profile', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const {
      username,
      phone,
      phone2,
      realName,
      address,
      website,
    } = await c.req.json()

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        username,
        phone,
        phone2,
        realName,
        address,
        website,
      },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        phone2: true,
        realName: true,
        address: true,
        website: true,
        profileImage: true,
        updatedAt: true,
      }
    })

    return c.json({ message: 'Profile updated', user })
  } catch (error) {
    console.error('Update profile error:', error)
    return c.json({ error: 'Failed to update profile' }, 500)
  }
})

// PATCH /settings/profile/avatar - Update profile image
settings.patch('/profile/avatar', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const { profileImage } = await c.req.json()

    if (!profileImage) {
      return c.json({ error: 'Profile image is required' }, 400)
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { profileImage },
      select: {
        id: true,
        profileImage: true,
        updatedAt: true,
      }
    })

    return c.json({ message: 'Avatar updated', user })
  } catch (error) {
    console.error('Update avatar error:', error)
    return c.json({ error: 'Failed to update avatar' }, 500)
  }
})

// ============= AGENT BALANCE VISIBILITY =============

// GET /settings/agent-balance-visibility - Get agent balance visibility setting
settings.get('/agent-balance-visibility', async (c) => {
  try {
    let globalSettings = await prisma.globalSettings.findFirst()

    // Create default settings if not exists
    if (!globalSettings) {
      globalSettings = await prisma.globalSettings.create({
        data: {
          showBalanceToAgents: false
        }
      })
    }

    return c.json({
      showBalanceToAgents: globalSettings.showBalanceToAgents ?? false
    })
  } catch (error) {
    console.error('Get agent balance visibility error:', error)
    return c.json({ error: 'Failed to get agent balance visibility setting' }, 500)
  }
})

// PUT /settings/agent-balance-visibility - Update agent balance visibility (Admin only)
settings.put('/agent-balance-visibility', requireAdmin, async (c) => {
  try {
    const { showBalanceToAgents } = await c.req.json()

    if (typeof showBalanceToAgents !== 'boolean') {
      return c.json({ error: 'showBalanceToAgents must be a boolean' }, 400)
    }

    let globalSettings = await prisma.globalSettings.findFirst()

    if (globalSettings) {
      globalSettings = await prisma.globalSettings.update({
        where: { id: globalSettings.id },
        data: { showBalanceToAgents }
      })
    } else {
      globalSettings = await prisma.globalSettings.create({
        data: { showBalanceToAgents }
      })
    }

    // Broadcast real-time update to agents only
    broadcast({ event: 'settings-updated', data: { setting: 'agent-balance-visibility' }, targets: 'agents' })

    return c.json({
      message: 'Agent balance visibility updated',
      showBalanceToAgents: globalSettings.showBalanceToAgents
    })
  } catch (error) {
    console.error('Update agent balance visibility error:', error)
    return c.json({ error: 'Failed to update agent balance visibility' }, 500)
  }
})

// ============= REFERRAL DOMAIN =============

// GET /settings/referral-domain - Get referral domain (public for users)
settings.get('/referral-domain', requireUser, async (c) => {
  try {
    let globalSettings = await prisma.globalSettings.findFirst()

    // Create default if not exists
    if (!globalSettings) {
      globalSettings = await prisma.globalSettings.create({
        data: {
          referralDomain: 'https://ads.sixad.io'
        }
      })
    }

    return c.json({
      referralDomain: globalSettings.referralDomain || 'https://ads.sixad.io'
    })
  } catch (error) {
    console.error('Get referral domain error:', error)
    return c.json({ error: 'Failed to get referral domain' }, 500)
  }
})

// PUT /settings/referral-domain - Update referral domain (admin only)
settings.put('/referral-domain', requireAdmin, async (c) => {
  try {
    const { referralDomain } = await c.req.json()

    if (!referralDomain) {
      return c.json({ error: 'Referral domain is required' }, 400)
    }

    let globalSettings = await prisma.globalSettings.findFirst()

    if (globalSettings) {
      globalSettings = await prisma.globalSettings.update({
        where: { id: globalSettings.id },
        data: { referralDomain }
      })
    } else {
      globalSettings = await prisma.globalSettings.create({
        data: { referralDomain }
      })
    }

    // Broadcast real-time update
    broadcast({ event: 'settings-updated', data: { setting: 'referral-domain' } })

    return c.json({
      message: 'Referral domain updated',
      referralDomain: globalSettings.referralDomain
    })
  } catch (error) {
    console.error('Update referral domain error:', error)
    return c.json({ error: 'Failed to update referral domain' }, 500)
  }
})

export default settings
