import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import crypto from 'crypto'
import { verifyToken } from '../middleware/auth.js'

const prisma = new PrismaClient()

const domains = new Hono()

// Validation schemas
const submitDomainSchema = z.object({
  domain: z.string().min(3).regex(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/, 'Invalid domain format'),
})

const updateDomainStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  adminRemarks: z.string().optional(),
})

// Helper to generate verification token
function generateVerificationToken(): string {
  return `coinest-verify-${crypto.randomBytes(16).toString('hex')}`
}

// ==================== PUBLIC ROUTE (NO AUTH) ====================

// GET /domains/check/:domain - Check if domain is valid and get agent info (Public)
domains.get('/check/:domain', async (c) => {
  try {
    const { domain } = c.req.param()

    const customDomain = await prisma.customDomain.findFirst({
      where: {
        domain: domain.toLowerCase(),
        status: 'APPROVED',
      },
      include: {
        agent: {
          select: {
            id: true,
            brandName: true,
            brandLogo: true,
          },
        },
      },
    })

    if (!customDomain) {
      return c.json({ valid: false, message: 'Domain not found or not approved' }, 404)
    }

    return c.json({
      valid: true,
      domain: customDomain.domain,
      branding: {
        brandName: customDomain.agent.brandName,
        brandLogo: customDomain.agent.brandLogo,
      },
      agentId: customDomain.agentId,
    })
  } catch (error) {
    console.error('Check domain error:', error)
    return c.json({ error: 'Failed to check domain' }, 500)
  }
})

// ==================== PROTECTED ROUTES (AUTH REQUIRED) ====================

// Apply auth middleware to all routes below
domains.use('/*', verifyToken)

// ==================== ADMIN ROUTES (must be before /:id routes) ====================

// GET /domains/admin/all - Get all domain requests (Admin only)
domains.get('/admin/all', async (c) => {
  try {
    const userRole = c.get('userRole')

    if (userRole !== 'ADMIN') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const { status } = c.req.query()

    const where: any = {}
    if (status) {
      where.status = status
    }

    const customDomains = await prisma.customDomain.findMany({
      where,
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            email: true,
            brandName: true,
            brandLogo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return c.json({ domains: customDomains })
  } catch (error) {
    console.error('Get all domains error:', error)
    return c.json({ error: 'Failed to get domains' }, 500)
  }
})

// PATCH /domains/admin/:id - Approve/Reject domain request (Admin only)
domains.patch('/admin/:id', async (c) => {
  try {
    const userRole = c.get('userRole')
    const { id } = c.req.param()

    if (userRole !== 'ADMIN') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const body = await c.req.json()
    const { status, adminRemarks } = updateDomainStatusSchema.parse(body)

    const customDomain = await prisma.customDomain.findUnique({
      where: { id },
    })

    if (!customDomain) {
      return c.json({ error: 'Domain not found' }, 404)
    }

    if (customDomain.status !== 'PENDING') {
      return c.json({ error: 'Only pending requests can be updated' }, 400)
    }

    const updateData: any = {
      status,
      adminRemarks: adminRemarks || null,
    }

    if (status === 'APPROVED') {
      updateData.approvedAt = new Date()
    } else if (status === 'REJECTED') {
      updateData.rejectedAt = new Date()
    }

    const updatedDomain = await prisma.customDomain.update({
      where: { id },
      data: updateData,
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    })

    return c.json({
      message: `Domain ${status.toLowerCase()} successfully`,
      domain: updatedDomain,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Update domain status error:', error)
    return c.json({ error: 'Failed to update domain status' }, 500)
  }
})

// ==================== USER ROUTES ====================

// GET /domains/user - Get user's agent's approved domain (Any authenticated user)
domains.get('/user', async (c) => {
  try {
    const userId = c.get('userId')

    // Get user with their agent
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        agentId: true,
        agent: {
          select: {
            id: true,
            username: true,
            brandName: true,
            brandLogo: true,
          },
        },
      },
    })

    if (!user?.agentId) {
      return c.json({ domain: null, agent: null, message: 'No agent assigned' })
    }

    // Get agent's approved domain
    const approvedDomain = await prisma.customDomain.findFirst({
      where: {
        agentId: user.agentId,
        status: 'APPROVED',
      },
    })

    return c.json({
      domain: approvedDomain,
      agent: user.agent,
    })
  } catch (error) {
    console.error('Get user domain error:', error)
    return c.json({ error: 'Failed to get domain' }, 500)
  }
})

// ==================== AGENT ROUTES ====================

// GET /domains - Get agent's own domains
domains.get('/', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    // Only agents can have custom domains
    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can have custom domains' }, 403)
    }

    const customDomains = await prisma.customDomain.findMany({
      where: { agentId: userId },
      orderBy: { createdAt: 'desc' },
    })

    return c.json({ domains: customDomains })
  } catch (error) {
    console.error('Get domains error:', error)
    return c.json({ error: 'Failed to get domains' }, 500)
  }
})

// POST /domains - Submit new domain request (Agent only)
domains.post('/', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    // Only agents can submit domain requests
    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can submit domain requests' }, 403)
    }

    const body = await c.req.json()
    const { domain } = submitDomainSchema.parse(body)

    // Check if domain already exists
    const existingDomain = await prisma.customDomain.findUnique({
      where: { domain: domain.toLowerCase() },
    })

    if (existingDomain) {
      return c.json({ error: 'This domain is already registered' }, 409)
    }

    // Generate verification token
    const verificationToken = generateVerificationToken()

    // Create domain request
    const customDomain = await prisma.customDomain.create({
      data: {
        domain: domain.toLowerCase(),
        agentId: userId,
        verificationToken,
        status: 'PENDING',
      },
    })

    return c.json({
      message: 'Domain request submitted successfully',
      domain: customDomain,
      dnsInstructions: {
        type: 'CNAME',
        name: domain.toLowerCase(),
        value: 'app.coinest.com', // Your main platform domain
        txtRecord: {
          name: `_coinest-verify.${domain.toLowerCase()}`,
          value: verificationToken,
        },
      },
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Submit domain error:', error)
    return c.json({ error: 'Failed to submit domain request' }, 500)
  }
})

// POST /domains/:id/verify - Verify DNS configuration (Agent only)
domains.post('/:id/verify', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { id } = c.req.param()

    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can verify domains' }, 403)
    }

    const customDomain = await prisma.customDomain.findFirst({
      where: { id, agentId: userId },
    })

    if (!customDomain) {
      return c.json({ error: 'Domain not found' }, 404)
    }

    // In production, you would actually check DNS records here
    // For now, we'll simulate DNS verification
    // You could use a library like 'dns' to check TXT records

    // Simulated verification (in production, implement real DNS check)
    const dnsVerified = true // Replace with actual DNS verification

    if (dnsVerified) {
      await prisma.customDomain.update({
        where: { id },
        data: { dnsVerified: true },
      })

      return c.json({
        message: 'DNS verified successfully',
        dnsVerified: true,
      })
    } else {
      return c.json({
        message: 'DNS verification failed. Please ensure your DNS records are configured correctly.',
        dnsVerified: false,
      }, 400)
    }
  } catch (error) {
    console.error('Verify DNS error:', error)
    return c.json({ error: 'Failed to verify DNS' }, 500)
  }
})

// DELETE /domains/:id - Delete domain request (Agent only, only if PENDING)
domains.delete('/:id', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { id } = c.req.param()

    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can delete domains' }, 403)
    }

    const customDomain = await prisma.customDomain.findFirst({
      where: { id, agentId: userId },
    })

    if (!customDomain) {
      return c.json({ error: 'Domain not found' }, 404)
    }

    if (customDomain.status !== 'PENDING') {
      return c.json({ error: 'Only pending domain requests can be deleted' }, 400)
    }

    await prisma.customDomain.delete({
      where: { id },
    })

    return c.json({ message: 'Domain request deleted successfully' })
  } catch (error) {
    console.error('Delete domain error:', error)
    return c.json({ error: 'Failed to delete domain' }, 500)
  }
})

export default domains
