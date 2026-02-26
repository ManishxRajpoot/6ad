import { Hono } from 'hono'
import { z } from 'zod'
import crypto from 'crypto'
import dns from 'dns'
import { promisify } from 'util'
import { exec } from 'child_process'
import path from 'path'
import { verifyToken } from '../middleware/auth.js'
import { generateEmailLogo } from '../utils/image.js'
import { prisma } from '../lib/prisma.js'

const resolveTxt = promisify(dns.resolveTxt)
const resolve4 = promisify(dns.resolve4)
const execPromise = promisify(exec)

// VPS IP address for custom domain DNS configuration
const VPS_IP = process.env.VPS_IP || '72.61.249.140'

const domains = new Hono()

// Validation schemas
const submitDomainSchema = z.object({
  domain: z.string().min(3).regex(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/, 'Invalid domain format'),
  brandLogo: z.string().optional(), // Base64 logo
  favicon: z.string().optional(), // Base64 favicon
})

const updateDomainBrandingSchema = z.object({
  brandLogo: z.string().optional(), // Base64 logo
  favicon: z.string().optional(), // Base64 favicon
})

const updateDomainStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  adminRemarks: z.string().optional(),
})

// Helper to generate verification token
function generateVerificationToken(): string {
  return `sixmedia-verify-${crypto.randomBytes(16).toString('hex')}`
}

// Helper to setup Nginx and SSL for custom domain
async function setupCustomDomain(domain: string): Promise<{ success: boolean; message: string }> {
  try {
    // Path to the setup script (relative to project root on VPS)
    const scriptPath = '/home/6ad/setup-custom-domain.sh'

    console.log(`[Domain Setup] Running setup script for: ${domain}`)

    // Execute the setup script
    const { stdout, stderr } = await execPromise(`bash ${scriptPath} ${domain}`, {
      timeout: 120000, // 2 minute timeout for SSL setup
    })

    console.log(`[Domain Setup] stdout: ${stdout}`)
    if (stderr) {
      console.log(`[Domain Setup] stderr: ${stderr}`)
    }

    return { success: true, message: 'Domain configured successfully with SSL' }
  } catch (error: any) {
    console.error(`[Domain Setup] Error setting up domain ${domain}:`, error)
    return {
      success: false,
      message: error.message || 'Failed to configure domain on server'
    }
  }
}

// Helper to remove Nginx and SSL for custom domain
async function removeCustomDomain(domain: string): Promise<{ success: boolean; message: string }> {
  try {
    const scriptPath = '/home/6ad/remove-custom-domain.sh'

    console.log(`[Domain Remove] Running removal script for: ${domain}`)

    const { stdout, stderr } = await execPromise(`bash ${scriptPath} ${domain}`, {
      timeout: 30000, // 30 second timeout
    })

    console.log(`[Domain Remove] stdout: ${stdout}`)
    if (stderr) {
      console.log(`[Domain Remove] stderr: ${stderr}`)
    }

    return { success: true, message: 'Domain removed successfully' }
  } catch (error: any) {
    console.error(`[Domain Remove] Error removing domain ${domain}:`, error)
    return {
      success: false,
      message: error.message || 'Failed to remove domain from server'
    }
  }
}

// ==================== PUBLIC ROUTE (NO AUTH) ====================

// GET /domains/dns-config - Get DNS configuration info (Public)
domains.get('/dns-config', async (c) => {
  return c.json({ vpsIp: VPS_IP })
})

// GET /domains/check/:domain - Check if domain is valid and get branding (Public)
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
            username: true,
          },
        },
      },
    })

    if (!customDomain) {
      return c.json({ valid: false, message: 'Domain not found or not approved' }, 404)
    }

    // Return branding from the approved CustomDomain (only logo, no brandName)
    return c.json({
      valid: true,
      domain: customDomain.domain,
      branding: {
        brandLogo: customDomain.brandLogo,
        favicon: customDomain.favicon,
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

    // If approved, setup Nginx and SSL for the domain
    let serverSetupResult = null
    if (status === 'APPROVED') {
      console.log(`[Admin] Domain approved, setting up Nginx and SSL for: ${customDomain.domain}`)
      serverSetupResult = await setupCustomDomain(customDomain.domain)

      if (!serverSetupResult.success) {
        console.error(`[Admin] Server setup failed for ${customDomain.domain}:`, serverSetupResult.message)
        // Still return success for approval, but include setup warning
      }
    }

    return c.json({
      message: `Domain ${status.toLowerCase()} successfully`,
      domain: updatedDomain,
      serverSetup: serverSetupResult,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Update domain status error:', error)
    return c.json({ error: 'Failed to update domain status' }, 500)
  }
})

// GET /domains/admin/pending-whitelabel - Get all agents with pending whitelabel items (Admin only)
domains.get('/admin/pending-whitelabel', async (c) => {
  try {
    const userRole = c.get('userRole')
    if (userRole !== 'ADMIN') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    // 1. Find all CustomDomain records with any pending item
    const pendingDomains = await prisma.customDomain.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { logoStatus: 'PENDING' },
          { faviconStatus: 'PENDING' },
        ],
      },
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            email: true,
            brandName: true,
            brandLogo: true,
            favicon: true,
            logoStatus: true,
            faviconStatus: true,
            emailSenderName: true,
            emailSenderNameApproved: true,
            emailSenderNameStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 2. Find agents with any pending user-level item (email sender, logo, or favicon on User model)
    const pendingAgents = await prisma.user.findMany({
      where: {
        role: 'AGENT',
        OR: [
          { emailSenderNameStatus: 'PENDING', emailSenderName: { not: null } },
          { logoStatus: 'PENDING', brandLogo: { not: null } },
          { faviconStatus: 'PENDING', favicon: { not: null } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        brandName: true,
        brandLogo: true,
        favicon: true,
        logoStatus: true,
        faviconStatus: true,
        emailSenderName: true,
        emailSenderNameApproved: true,
        emailSenderNameStatus: true,
      },
    })

    // 3. Merge into unified agent cards
    const agentMap = new Map<string, any>()

    // Add agents from pending domains
    for (const domain of pendingDomains) {
      const agentId = domain.agentId
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          agent: {
            id: domain.agent.id,
            username: domain.agent.username,
            email: domain.agent.email,
            brandName: domain.agent.brandName,
          },
          domain: null,
          branding: null,
          emailSenderName: null,
        })
      }
      agentMap.get(agentId).domain = {
        id: domain.id,
        domain: domain.domain,
        status: domain.status,
        dnsVerified: domain.dnsVerified,
        brandLogo: domain.brandLogo,
        favicon: domain.favicon,
        logoStatus: domain.logoStatus,
        faviconStatus: domain.faviconStatus,
        createdAt: domain.createdAt,
      }
      // Also include email sender info from the agent
      if (domain.agent.emailSenderNameStatus === 'PENDING' && domain.agent.emailSenderName) {
        agentMap.get(agentId).emailSenderName = {
          requested: domain.agent.emailSenderName,
          current: domain.agent.emailSenderNameApproved,
          status: domain.agent.emailSenderNameStatus,
        }
      }
      // Include user-level branding if pending
      if (domain.agent.logoStatus === 'PENDING' || domain.agent.faviconStatus === 'PENDING') {
        agentMap.get(agentId).branding = {
          brandLogo: domain.agent.brandLogo,
          favicon: domain.agent.favicon,
          logoStatus: domain.agent.logoStatus,
          faviconStatus: domain.agent.faviconStatus,
        }
      }
    }

    // Add agents who have pending user-level items but no pending domain
    for (const agent of pendingAgents) {
      if (!agentMap.has(agent.id)) {
        agentMap.set(agent.id, {
          agent: {
            id: agent.id,
            username: agent.username,
            email: agent.email,
            brandName: agent.brandName,
          },
          domain: null,
          branding: null,
          emailSenderName: null,
        })
      }

      // Set email sender if pending
      if (agent.emailSenderNameStatus === 'PENDING' && agent.emailSenderName && !agentMap.get(agent.id).emailSenderName) {
        agentMap.get(agent.id).emailSenderName = {
          requested: agent.emailSenderName,
          current: agent.emailSenderNameApproved,
          status: agent.emailSenderNameStatus,
        }
      }

      // Set user-level branding if pending (only if no domain-level branding)
      if ((agent.logoStatus === 'PENDING' || agent.faviconStatus === 'PENDING') && !agentMap.get(agent.id).branding) {
        agentMap.get(agent.id).branding = {
          brandLogo: agent.brandLogo,
          favicon: agent.favicon,
          logoStatus: agent.logoStatus,
          faviconStatus: agent.faviconStatus,
        }
      }
    }

    return c.json({ agents: Array.from(agentMap.values()) })
  } catch (error) {
    console.error('Get pending whitelabel error:', error)
    return c.json({ error: 'Failed to get pending whitelabel' }, 500)
  }
})

// PATCH /domains/admin/:id/approve-logo - Approve logo only (Admin only)
domains.patch('/admin/:id/approve-logo', async (c) => {
  try {
    const userRole = c.get('userRole')
    const { id } = c.req.param()
    if (userRole !== 'ADMIN') return c.json({ error: 'Admin access required' }, 403)

    const domain = await prisma.customDomain.findUnique({ where: { id } })
    if (!domain) return c.json({ error: 'Domain not found' }, 404)
    if (domain.logoStatus !== 'PENDING') return c.json({ error: 'Logo is not pending approval' }, 400)

    const updated = await prisma.customDomain.update({
      where: { id },
      data: { logoStatus: 'APPROVED' },
    })
    return c.json({ message: 'Logo approved', domain: updated })
  } catch (error) {
    console.error('Approve logo error:', error)
    return c.json({ error: 'Failed to approve logo' }, 500)
  }
})

// PATCH /domains/admin/:id/reject-logo - Reject logo (Admin only)
domains.patch('/admin/:id/reject-logo', async (c) => {
  try {
    const userRole = c.get('userRole')
    const { id } = c.req.param()
    if (userRole !== 'ADMIN') return c.json({ error: 'Admin access required' }, 403)

    const domain = await prisma.customDomain.findUnique({ where: { id } })
    if (!domain) return c.json({ error: 'Domain not found' }, 404)
    if (domain.logoStatus !== 'PENDING') return c.json({ error: 'Logo is not pending approval' }, 400)

    const updated = await prisma.customDomain.update({
      where: { id },
      data: { logoStatus: 'REJECTED', brandLogo: null, emailLogo: null },
    })
    return c.json({ message: 'Logo rejected', domain: updated })
  } catch (error) {
    console.error('Reject logo error:', error)
    return c.json({ error: 'Failed to reject logo' }, 500)
  }
})

// PATCH /domains/admin/:id/approve-favicon - Approve favicon only (Admin only)
domains.patch('/admin/:id/approve-favicon', async (c) => {
  try {
    const userRole = c.get('userRole')
    const { id } = c.req.param()
    if (userRole !== 'ADMIN') return c.json({ error: 'Admin access required' }, 403)

    const domain = await prisma.customDomain.findUnique({ where: { id } })
    if (!domain) return c.json({ error: 'Domain not found' }, 404)
    if (domain.faviconStatus !== 'PENDING') return c.json({ error: 'Favicon is not pending approval' }, 400)

    const updated = await prisma.customDomain.update({
      where: { id },
      data: { faviconStatus: 'APPROVED' },
    })
    return c.json({ message: 'Favicon approved', domain: updated })
  } catch (error) {
    console.error('Approve favicon error:', error)
    return c.json({ error: 'Failed to approve favicon' }, 500)
  }
})

// PATCH /domains/admin/:id/reject-favicon - Reject favicon (Admin only)
domains.patch('/admin/:id/reject-favicon', async (c) => {
  try {
    const userRole = c.get('userRole')
    const { id } = c.req.param()
    if (userRole !== 'ADMIN') return c.json({ error: 'Admin access required' }, 403)

    const domain = await prisma.customDomain.findUnique({ where: { id } })
    if (!domain) return c.json({ error: 'Domain not found' }, 404)
    if (domain.faviconStatus !== 'PENDING') return c.json({ error: 'Favicon is not pending approval' }, 400)

    const updated = await prisma.customDomain.update({
      where: { id },
      data: { faviconStatus: 'REJECTED', favicon: null },
    })
    return c.json({ message: 'Favicon rejected', domain: updated })
  } catch (error) {
    console.error('Reject favicon error:', error)
    return c.json({ error: 'Failed to reject favicon' }, 500)
  }
})

// POST /domains/admin/:id/approve-all - Approve all pending items for an agent (Admin only)
domains.post('/admin/:id/approve-all', async (c) => {
  try {
    const userRole = c.get('userRole')
    const { id } = c.req.param()
    if (userRole !== 'ADMIN') return c.json({ error: 'Admin access required' }, 403)

    const domain = await prisma.customDomain.findUnique({
      where: { id },
      include: { agent: true },
    })
    if (!domain) return c.json({ error: 'Domain not found' }, 404)

    const summary: string[] = []
    const domainUpdateData: any = {}

    // Approve domain if pending and DNS verified
    if (domain.status === 'PENDING' && domain.dnsVerified) {
      domainUpdateData.status = 'APPROVED'
      domainUpdateData.approvedAt = new Date()
      summary.push('Domain approved')
    } else if (domain.status === 'PENDING' && !domain.dnsVerified) {
      summary.push('Domain skipped (DNS not verified)')
    }

    // Approve logo if pending
    if (domain.logoStatus === 'PENDING') {
      domainUpdateData.logoStatus = 'APPROVED'
      summary.push('Logo approved')
    }

    // Approve favicon if pending
    if (domain.faviconStatus === 'PENDING') {
      domainUpdateData.faviconStatus = 'APPROVED'
      summary.push('Favicon approved')
    }

    // Update domain record
    if (Object.keys(domainUpdateData).length > 0) {
      await prisma.customDomain.update({
        where: { id },
        data: domainUpdateData,
      })
    }

    // Approve user-level items (email sender name, user logo, user favicon)
    const userUpdateData: any = {}

    if (domain.agent.emailSenderNameStatus === 'PENDING' && domain.agent.emailSenderName) {
      userUpdateData.emailSenderNameApproved = domain.agent.emailSenderName
      userUpdateData.emailSenderNameStatus = 'APPROVED'
      summary.push('Email sender name approved')
    }

    if (domain.agent.logoStatus === 'PENDING') {
      userUpdateData.logoStatus = 'APPROVED'
      summary.push('User logo approved')
    }

    if (domain.agent.faviconStatus === 'PENDING') {
      userUpdateData.faviconStatus = 'APPROVED'
      summary.push('User favicon approved')
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: domain.agentId },
        data: userUpdateData,
      })
    }

    // Setup Nginx/SSL if domain was approved
    let serverSetupResult = null
    if (domainUpdateData.status === 'APPROVED') {
      console.log(`[Admin] Approve-all: setting up Nginx and SSL for: ${domain.domain}`)
      serverSetupResult = await setupCustomDomain(domain.domain)
      if (!serverSetupResult.success) {
        console.error(`[Admin] Server setup failed for ${domain.domain}:`, serverSetupResult.message)
      }
    }

    return c.json({
      message: 'Approve all completed',
      summary,
      serverSetup: serverSetupResult,
    })
  } catch (error) {
    console.error('Approve all error:', error)
    return c.json({ error: 'Failed to approve all' }, 500)
  }
})

// GET /domains/admin/whitelabel-history - Get all agents with approved/rejected whitelabel items (Admin only)
domains.get('/admin/whitelabel-history', async (c) => {
  try {
    const userRole = c.get('userRole')
    if (userRole !== 'ADMIN') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    // 1. Find all CustomDomain records with any non-pending resolved status
    const resolvedDomains = await prisma.customDomain.findMany({
      where: {
        OR: [
          { status: { in: ['APPROVED', 'REJECTED'] } },
          { logoStatus: { in: ['APPROVED', 'REJECTED'] } },
          { faviconStatus: { in: ['APPROVED', 'REJECTED'] } },
        ],
      },
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            email: true,
            brandName: true,
            brandLogo: true,
            favicon: true,
            logoStatus: true,
            faviconStatus: true,
            emailSenderName: true,
            emailSenderNameApproved: true,
            emailSenderNameStatus: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // 2. Find agents with resolved user-level items
    const resolvedAgents = await prisma.user.findMany({
      where: {
        role: 'AGENT',
        OR: [
          { emailSenderNameStatus: { in: ['APPROVED', 'REJECTED'] } },
          { logoStatus: { in: ['APPROVED', 'REJECTED'] } },
          { faviconStatus: { in: ['APPROVED', 'REJECTED'] } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        brandName: true,
        brandLogo: true,
        favicon: true,
        logoStatus: true,
        faviconStatus: true,
        emailSenderName: true,
        emailSenderNameApproved: true,
        emailSenderNameStatus: true,
      },
    })

    // 3. Merge into unified agent cards
    const agentMap = new Map<string, any>()

    for (const domain of resolvedDomains) {
      const agentId = domain.agentId
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          agent: {
            id: domain.agent.id,
            username: domain.agent.username,
            email: domain.agent.email,
            brandName: domain.agent.brandName,
          },
          domain: null,
          branding: null,
          emailSenderName: null,
        })
      }
      agentMap.get(agentId).domain = {
        id: domain.id,
        domain: domain.domain,
        status: domain.status,
        dnsVerified: domain.dnsVerified,
        brandLogo: domain.brandLogo,
        favicon: domain.favicon,
        logoStatus: domain.logoStatus,
        faviconStatus: domain.faviconStatus,
        createdAt: domain.createdAt,
        approvedAt: domain.approvedAt,
        rejectedAt: domain.rejectedAt,
      }
      // Email sender info
      if (domain.agent.emailSenderNameStatus && domain.agent.emailSenderNameStatus !== 'PENDING') {
        agentMap.get(agentId).emailSenderName = {
          requested: domain.agent.emailSenderName,
          current: domain.agent.emailSenderNameApproved,
          status: domain.agent.emailSenderNameStatus,
        }
      }
      // User-level branding
      if (domain.agent.logoStatus && domain.agent.logoStatus !== 'PENDING' || domain.agent.faviconStatus && domain.agent.faviconStatus !== 'PENDING') {
        agentMap.get(agentId).branding = {
          brandLogo: domain.agent.brandLogo,
          favicon: domain.agent.favicon,
          logoStatus: domain.agent.logoStatus,
          faviconStatus: domain.agent.faviconStatus,
        }
      }
    }

    for (const agent of resolvedAgents) {
      if (!agentMap.has(agent.id)) {
        agentMap.set(agent.id, {
          agent: {
            id: agent.id,
            username: agent.username,
            email: agent.email,
            brandName: agent.brandName,
          },
          domain: null,
          branding: null,
          emailSenderName: null,
        })
      }

      if (agent.emailSenderNameStatus && agent.emailSenderNameStatus !== 'PENDING' && !agentMap.get(agent.id).emailSenderName) {
        agentMap.get(agent.id).emailSenderName = {
          requested: agent.emailSenderName,
          current: agent.emailSenderNameApproved,
          status: agent.emailSenderNameStatus,
        }
      }

      if ((agent.logoStatus && agent.logoStatus !== 'PENDING' || agent.faviconStatus && agent.faviconStatus !== 'PENDING') && !agentMap.get(agent.id).branding) {
        agentMap.get(agent.id).branding = {
          brandLogo: agent.brandLogo,
          favicon: agent.favicon,
          logoStatus: agent.logoStatus,
          faviconStatus: agent.faviconStatus,
        }
      }
    }

    return c.json({ agents: Array.from(agentMap.values()) })
  } catch (error) {
    console.error('Get whitelabel history error:', error)
    return c.json({ error: 'Failed to get whitelabel history' }, 500)
  }
})

// ==================== USER-LEVEL BRANDING ADMIN ROUTES ====================
// These handle logo/favicon approval for agents who submitted branding WITHOUT a domain

// PATCH /domains/admin/user/:userId/approve-logo - Approve logo on User model (Admin only)
domains.patch('/admin/user/:userId/approve-logo', async (c) => {
  try {
    const userRole = c.get('userRole')
    const { userId } = c.req.param()
    if (userRole !== 'ADMIN') return c.json({ error: 'Admin access required' }, 403)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return c.json({ error: 'User not found' }, 404)
    if (user.logoStatus !== 'PENDING') return c.json({ error: 'Logo is not pending approval' }, 400)

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { logoStatus: 'APPROVED' },
      select: { id: true, brandLogo: true, logoStatus: true },
    })
    return c.json({ message: 'Logo approved', user: updated })
  } catch (error) {
    console.error('Approve user logo error:', error)
    return c.json({ error: 'Failed to approve logo' }, 500)
  }
})

// PATCH /domains/admin/user/:userId/reject-logo - Reject logo on User model (Admin only)
domains.patch('/admin/user/:userId/reject-logo', async (c) => {
  try {
    const userRole = c.get('userRole')
    const { userId } = c.req.param()
    if (userRole !== 'ADMIN') return c.json({ error: 'Admin access required' }, 403)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return c.json({ error: 'User not found' }, 404)
    if (user.logoStatus !== 'PENDING') return c.json({ error: 'Logo is not pending approval' }, 400)

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { logoStatus: 'REJECTED', brandLogo: null, emailLogo: null },
      select: { id: true, brandLogo: true, logoStatus: true },
    })
    return c.json({ message: 'Logo rejected', user: updated })
  } catch (error) {
    console.error('Reject user logo error:', error)
    return c.json({ error: 'Failed to reject logo' }, 500)
  }
})

// PATCH /domains/admin/user/:userId/approve-favicon - Approve favicon on User model (Admin only)
domains.patch('/admin/user/:userId/approve-favicon', async (c) => {
  try {
    const userRole = c.get('userRole')
    const { userId } = c.req.param()
    if (userRole !== 'ADMIN') return c.json({ error: 'Admin access required' }, 403)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return c.json({ error: 'User not found' }, 404)
    if (user.faviconStatus !== 'PENDING') return c.json({ error: 'Favicon is not pending approval' }, 400)

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { faviconStatus: 'APPROVED' },
      select: { id: true, favicon: true, faviconStatus: true },
    })
    return c.json({ message: 'Favicon approved', user: updated })
  } catch (error) {
    console.error('Approve user favicon error:', error)
    return c.json({ error: 'Failed to approve favicon' }, 500)
  }
})

// PATCH /domains/admin/user/:userId/reject-favicon - Reject favicon on User model (Admin only)
domains.patch('/admin/user/:userId/reject-favicon', async (c) => {
  try {
    const userRole = c.get('userRole')
    const { userId } = c.req.param()
    if (userRole !== 'ADMIN') return c.json({ error: 'Admin access required' }, 403)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return c.json({ error: 'User not found' }, 404)
    if (user.faviconStatus !== 'PENDING') return c.json({ error: 'Favicon is not pending approval' }, 400)

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { faviconStatus: 'REJECTED', favicon: null },
      select: { id: true, favicon: true, faviconStatus: true },
    })
    return c.json({ message: 'Favicon rejected', user: updated })
  } catch (error) {
    console.error('Reject user favicon error:', error)
    return c.json({ error: 'Failed to reject favicon' }, 500)
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

    // Check if agent already has a domain (limit: 1 domain per agent)
    const agentExistingDomain = await prisma.customDomain.findFirst({
      where: { agentId: userId },
    })

    if (agentExistingDomain) {
      return c.json({ error: 'You can only have one custom domain. Please delete your existing domain first if you want to add a new one.' }, 400)
    }

    const body = await c.req.json()
    const { domain, brandLogo, favicon } = submitDomainSchema.parse(body)

    // Check if domain already exists (registered by another agent)
    const existingDomain = await prisma.customDomain.findUnique({
      where: { domain: domain.toLowerCase() },
    })

    if (existingDomain) {
      return c.json({ error: 'This domain is already registered' }, 409)
    }

    // Generate verification token
    const verificationToken = generateVerificationToken()

    // Auto-generate optimized email logo
    const emailLogo = brandLogo ? await generateEmailLogo(brandLogo) : null

    // Create domain request with branding
    const customDomain = await prisma.customDomain.create({
      data: {
        domain: domain.toLowerCase(),
        agentId: userId,
        verificationToken,
        status: 'PENDING',
        brandLogo: brandLogo || null,
        emailLogo,
        favicon: favicon || null,
        logoStatus: brandLogo ? 'PENDING' : null,
        faviconStatus: favicon ? 'PENDING' : null,
      },
    })

    return c.json({
      message: 'Domain request submitted successfully',
      domain: customDomain,
      dnsInstructions: {
        type: 'A',
        name: domain.toLowerCase(),
        value: VPS_IP,
        txtRecord: {
          name: `_6ad-verify.${domain.toLowerCase()}`,
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

// PATCH /domains/:id - Update domain branding (Agent only, resets to PENDING for re-approval)
domains.patch('/:id', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { id } = c.req.param()

    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can update domains' }, 403)
    }

    const body = await c.req.json()
    const { brandLogo, favicon } = updateDomainBrandingSchema.parse(body)

    const customDomain = await prisma.customDomain.findFirst({
      where: { id, agentId: userId },
    })

    if (!customDomain) {
      return c.json({ error: 'Domain not found' }, 404)
    }

    // Auto-generate optimized email logo
    const emailLogo = brandLogo ? await generateEmailLogo(brandLogo) : null

    // Update branding — only reset logo/favicon status individually, not the domain status
    const updateData: any = {}

    if (brandLogo !== undefined) {
      updateData.brandLogo = brandLogo || null
      updateData.emailLogo = emailLogo
      updateData.logoStatus = brandLogo ? 'PENDING' : null
    }

    // Update favicon if provided
    if (favicon !== undefined) {
      updateData.favicon = favicon || null
      updateData.faviconStatus = favicon ? 'PENDING' : null
    }

    const updatedDomain = await prisma.customDomain.update({
      where: { id },
      data: updateData,
    })

    return c.json({
      message: 'Domain branding updated successfully. Awaiting admin approval.',
      domain: updatedDomain,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Update domain branding error:', error)
    return c.json({ error: 'Failed to update domain branding' }, 500)
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

    // Real DNS verification
    const domain = customDomain.domain
    const expectedToken = customDomain.verificationToken
    const expectedIP = VPS_IP

    let aRecordValid = false
    let txtRecordValid = false
    const errors: string[] = []

    // Check A record - domain should point to our VPS IP
    try {
      const aRecords = await resolve4(domain)
      if (aRecords.includes(expectedIP)) {
        aRecordValid = true
      } else {
        errors.push(`A record points to ${aRecords.join(', ')} instead of ${expectedIP}`)
      }
    } catch (err: any) {
      if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
        errors.push('A record not found. Please add an A record pointing to ' + expectedIP)
      } else {
        errors.push('Could not verify A record: ' + err.message)
      }
    }

    // Check TXT record for verification token
    try {
      const txtHost = `_6ad-verify.${domain}`
      const txtRecords = await resolveTxt(txtHost)
      // txtRecords is an array of arrays, flatten and check
      const flatRecords = txtRecords.flat()
      if (flatRecords.includes(expectedToken)) {
        txtRecordValid = true
      } else {
        errors.push(`TXT record value doesn't match. Expected: ${expectedToken}`)
      }
    } catch (err: any) {
      if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
        errors.push('TXT verification record not found. Please add the TXT record.')
      } else {
        errors.push('Could not verify TXT record: ' + err.message)
      }
    }

    // Both records must be valid
    const dnsVerified = aRecordValid && txtRecordValid

    if (dnsVerified) {
      await prisma.customDomain.update({
        where: { id },
        data: { dnsVerified: true },
      })

      return c.json({
        message: 'DNS verified successfully! Your domain is now pending admin approval.',
        dnsVerified: true,
        details: {
          aRecord: 'Valid',
          txtRecord: 'Valid',
        },
      })
    } else {
      return c.json({
        message: 'DNS verification failed. Please check the errors below.',
        dnsVerified: false,
        errors,
        details: {
          aRecord: aRecordValid ? 'Valid' : 'Invalid',
          txtRecord: txtRecordValid ? 'Valid' : 'Invalid',
        },
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

    // Allow deleting PENDING or REJECTED domains (not APPROVED)
    if (customDomain.status === 'APPROVED') {
      return c.json({ error: 'Approved domains cannot be deleted. Please contact admin.' }, 400)
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
