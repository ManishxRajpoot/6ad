import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import crypto from 'crypto'
import dns from 'dns'
import { promisify } from 'util'
import { exec } from 'child_process'
import path from 'path'
import { verifyToken } from '../middleware/auth.js'
import { generateEmailLogo } from '../utils/image.js'

const resolveTxt = promisify(dns.resolveTxt)
const resolve4 = promisify(dns.resolve4)
const execPromise = promisify(exec)

const prisma = new PrismaClient()

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

    // Update branding and reset status to PENDING for re-approval
    const updateData: any = {
      brandLogo: brandLogo || null,
      emailLogo,
      status: 'PENDING', // Reset to pending when branding is updated
      approvedAt: null,
      rejectedAt: null,
      adminRemarks: null,
    }

    // Update favicon if provided
    if (favicon !== undefined) {
      updateData.favicon = favicon || null
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
