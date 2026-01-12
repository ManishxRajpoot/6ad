import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken, requireAdmin, requireUser } from '../middleware/auth.js'

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

export default settings
