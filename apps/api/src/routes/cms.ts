import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken, verifyAdmin } from '../middleware/auth'
import { sendEmail } from '../utils/email.js'
import fs from 'fs'
import path from 'path'

const ADMIN_NOTIFY_EMAILS = (process.env.CONTACT_NOTIFY_EMAILS || 'bit22hr@gmail.com').split(',')

// Dedicated SMTP config for contact form emails (Namecheap / ads360.ai)
const CONTACT_SMTP = process.env.CONTACT_SMTP_HOST ? {
  host: process.env.CONTACT_SMTP_HOST,
  port: parseInt(process.env.CONTACT_SMTP_PORT || '465'),
  encryption: (process.env.CONTACT_SMTP_SECURE !== 'false' ? 'SSL' : 'TLS') as 'SSL' | 'TLS',
  username: process.env.CONTACT_SMTP_USER || '',
  password: process.env.CONTACT_SMTP_PASS || '',
  fromEmail: process.env.CONTACT_SMTP_FROM_EMAIL || process.env.CONTACT_SMTP_USER || '',
  fromName: process.env.CONTACT_SMTP_FROM_NAME || 'ADS360',
} : null

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')
// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const cms = new Hono()

// ============================================================
// PUBLIC ROUTES (no auth)
// ============================================================

// 1. GET /sections — Return all active CmsSections
cms.get('/sections', async (c) => {
  try {
    const sections = await prisma.cmsSection.findMany({
      where: { isActive: true },
      orderBy: { sectionKey: 'asc' },
    })
    return c.json({ sections })
  } catch (error) {
    console.error('Get sections error:', error)
    return c.json({ error: 'Failed to get sections' }, 500)
  }
})

// 2. GET /sections/:key — Return single CmsSection by sectionKey
cms.get('/sections/:key', async (c) => {
  try {
    const key = c.req.param('key')
    const section = await prisma.cmsSection.findUnique({
      where: { sectionKey: key },
    })
    if (!section) {
      return c.json({ error: 'Section not found' }, 404)
    }
    return c.json({ section })
  } catch (error) {
    console.error('Get section error:', error)
    return c.json({ error: 'Failed to get section' }, 500)
  }
})

// 3. POST /contact — Create ContactSubmission + send Telegram notification
cms.post('/contact', async (c) => {
  try {
    const body = await c.req.json()
    const {
      fullName,
      email,
      phone,
      companyName,
      website,
      country,
      budget,
      platform,
      description,
      promoCode,
    } = body

    if (!fullName || !email) {
      return c.json({ error: 'fullName and email are required' }, 400)
    }

    // Create the contact submission
    const submission = await prisma.contactSubmission.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        companyName: companyName || null,
        website: website || null,
        country: country || null,
        budget: budget || null,
        platform: platform || null,
        description: description || null,
        promoCode: promoCode || null,
      },
    })

    // Track analytics event
    const ip = c.req.header('x-forwarded-for') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    await prisma.cmsAnalytics.create({
      data: {
        event: 'contact_submit',
        metadata: { fullName, email },
        ip,
        userAgent,
      },
    })

    // Send Telegram notification (non-blocking)
    sendTelegramNotification({
      fullName,
      email,
      phone,
      companyName,
      website,
      country,
      budget,
      platform,
      description,
      promoCode,
    }).catch((err) => console.error('Telegram notification error:', err))

    // Send confirmation email to customer (non-blocking) — via support@ads360.ai
    sendEmail({
      to: email,
      subject: `Thanks for reaching out, ${fullName}! — ADS360`,
      html: getCustomerConfirmationEmail(fullName, companyName),
      ...(CONTACT_SMTP && { smtpConfig: CONTACT_SMTP }),
      senderName: 'ADS360',
    }).catch((err) => console.error('Customer confirmation email error:', err))

    // Send notification email to admin team (non-blocking) — via support@ads360.ai
    for (const adminEmail of ADMIN_NOTIFY_EMAILS) {
      sendEmail({
        to: adminEmail.trim(),
        subject: `🔔 New Lead: ${fullName} — ${companyName || 'No company'} (${platform || 'N/A'})`,
        html: getAdminNotificationEmail({ fullName, email, phone, companyName, website, country, budget, platform, description, promoCode }),
        ...(CONTACT_SMTP && { smtpConfig: CONTACT_SMTP }),
        senderName: 'ADS360',
      }).catch((err) => console.error('Admin notification email error:', err))
    }

    return c.json({ success: true, id: submission.id }, 201)
  } catch (error) {
    console.error('Contact submission error:', error)
    return c.json({ error: 'Failed to submit contact form' }, 500)
  }
})

// 4. POST /analytics — Create CmsAnalytics event
cms.post('/analytics', async (c) => {
  try {
    const body = await c.req.json()
    const { event, metadata } = body

    if (!event) {
      return c.json({ error: 'event is required' }, 400)
    }

    const ip = c.req.header('x-forwarded-for') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''

    const analytics = await prisma.cmsAnalytics.create({
      data: {
        event,
        metadata: metadata || null,
        ip,
        userAgent,
      },
    })

    return c.json({ success: true, id: analytics.id }, 201)
  } catch (error) {
    console.error('Analytics error:', error)
    return c.json({ error: 'Failed to record analytics' }, 500)
  }
})

// ============================================================
// ADMIN ROUTES (verifyToken + verifyAdmin)
// ============================================================

// 5. GET /admin/sections — List all CmsSections (including inactive)
cms.get('/admin/sections', verifyToken, async (c) => {
  try {
    const sections = await prisma.cmsSection.findMany({
      orderBy: { sectionKey: 'asc' },
    })
    return c.json({ sections })
  } catch (error) {
    console.error('Admin get sections error:', error)
    return c.json({ error: 'Failed to get sections' }, 500)
  }
})

// 6. GET /admin/sections/:key — Get single section for editing
cms.get('/admin/sections/:key', verifyToken, async (c) => {
  try {
    const key = c.req.param('key')
    const section = await prisma.cmsSection.findUnique({
      where: { sectionKey: key },
    })
    if (!section) {
      return c.json({ error: 'Section not found' }, 404)
    }
    return c.json({ section })
  } catch (error) {
    console.error('Admin get section error:', error)
    return c.json({ error: 'Failed to get section' }, 500)
  }
})

// 7. PUT /admin/sections/:key — Upsert CmsSection
cms.put('/admin/sections/:key', verifyToken, async (c) => {
  try {
    const key = c.req.param('key')
    const body = await c.req.json()
    const { data, isActive } = body
    const userId = c.get('userId')

    if (!data) {
      return c.json({ error: 'data is required' }, 400)
    }

    const section = await prisma.cmsSection.upsert({
      where: { sectionKey: key },
      create: {
        sectionKey: key,
        data,
        isActive: isActive !== undefined ? isActive : true,
        updatedBy: userId,
      },
      update: {
        data,
        ...(isActive !== undefined && { isActive }),
        updatedBy: userId,
      },
    })

    return c.json({ section })
  } catch (error) {
    console.error('Admin upsert section error:', error)
    return c.json({ error: 'Failed to update section' }, 500)
  }
})

// 8. PATCH /admin/sections/:key/toggle — Toggle isActive on CmsSection
cms.patch('/admin/sections/:key/toggle', verifyToken, async (c) => {
  try {
    const key = c.req.param('key')

    const existing = await prisma.cmsSection.findUnique({
      where: { sectionKey: key },
    })
    if (!existing) {
      return c.json({ error: 'Section not found' }, 404)
    }

    const section = await prisma.cmsSection.update({
      where: { sectionKey: key },
      data: {
        isActive: !existing.isActive,
        updatedBy: c.get('userId'),
      },
    })

    return c.json({ section })
  } catch (error) {
    console.error('Admin toggle section error:', error)
    return c.json({ error: 'Failed to toggle section' }, 500)
  }
})

// 9. POST /admin/upload — Upload image to local storage
cms.post('/admin/upload', verifyToken, async (c) => {
  try {
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400)
    }

    // Max 10MB
    const arrayBuffer = await file.arrayBuffer()
    if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
      return c.json({ error: 'File too large. Max 10MB.' }, 400)
    }

    const buffer = Buffer.from(arrayBuffer)
    const ext = file.name?.split('.').pop() || 'png'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    // Save to local uploads folder
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer)

    const apiBase = process.env.API_URL || `http://localhost:${process.env.PORT || 5001}`
    const url = `${apiBase}/uploads/${filename}`

    // Save to CmsMedia
    const media = await prisma.cmsMedia.create({
      data: {
        url,
        publicId: filename,
        filename: file.name || 'upload',
        section: (body['section'] as string) || null,
      },
    })

    return c.json({
      url: media.url,
      publicId: media.publicId,
      id: media.id,
    }, 201)
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'Failed to upload image' }, 500)
  }
})

// 10. DELETE /admin/media/:id — Delete from Cloudinary + delete CmsMedia record
cms.delete('/admin/media/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')

    const media = await prisma.cmsMedia.findUnique({ where: { id } })
    if (!media) {
      return c.json({ error: 'Media not found' }, 404)
    }

    // Delete local file
    const filePath = path.join(UPLOADS_DIR, media.publicId)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete from database
    await prisma.cmsMedia.delete({ where: { id } })

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete media error:', error)
    return c.json({ error: 'Failed to delete media' }, 500)
  }
})

// 11. GET /admin/media — List all CmsMedia
cms.get('/admin/media', verifyToken, async (c) => {
  try {
    const media = await prisma.cmsMedia.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return c.json({ media })
  } catch (error) {
    console.error('Get media error:', error)
    return c.json({ error: 'Failed to get media' }, 500)
  }
})

// 12. GET /admin/contacts — List ContactSubmissions with filters
cms.get('/admin/contacts', verifyToken, async (c) => {
  try {
    const status = c.req.query('status')
    const page = parseInt(c.req.query('page') || '1', 10)
    const limit = parseInt(c.req.query('limit') || '20', 10)
    const search = c.req.query('search')

    const skip = (page - 1) * limit

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [contacts, total] = await Promise.all([
      prisma.contactSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contactSubmission.count({ where }),
    ])

    return c.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get contacts error:', error)
    return c.json({ error: 'Failed to get contacts' }, 500)
  }
})

// 13. GET /admin/contacts/:id — Get single contact
cms.get('/admin/contacts/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')
    const contact = await prisma.contactSubmission.findUnique({ where: { id } })
    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404)
    }
    return c.json({ contact })
  } catch (error) {
    console.error('Get contact error:', error)
    return c.json({ error: 'Failed to get contact' }, 500)
  }
})

// 14. PATCH /admin/contacts/:id — Update ContactSubmission status and/or notes
cms.patch('/admin/contacts/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { status, notes } = body

    const existing = await prisma.contactSubmission.findUnique({ where: { id } })
    if (!existing) {
      return c.json({ error: 'Contact not found' }, 404)
    }

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes

    const contact = await prisma.contactSubmission.update({
      where: { id },
      data: updateData,
    })

    return c.json({ contact })
  } catch (error) {
    console.error('Update contact error:', error)
    return c.json({ error: 'Failed to update contact' }, 500)
  }
})

// 15. DELETE /admin/contacts/:id — Delete ContactSubmission
cms.delete('/admin/contacts/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')

    const existing = await prisma.contactSubmission.findUnique({ where: { id } })
    if (!existing) {
      return c.json({ error: 'Contact not found' }, 404)
    }

    await prisma.contactSubmission.delete({ where: { id } })

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete contact error:', error)
    return c.json({ error: 'Failed to delete contact' }, 500)
  }
})

// 16. GET /admin/analytics — Aggregated analytics
cms.get('/admin/analytics', verifyToken, async (c) => {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Run queries in parallel
    const [totalPageviews, totalContacts, recentAnalytics, topEvents] = await Promise.all([
      // Total pageviews
      prisma.cmsAnalytics.count({ where: { event: 'pageview' } }),
      // Total contacts
      prisma.contactSubmission.count(),
      // Last 30 days analytics for daily grouping
      prisma.cmsAnalytics.findMany({
        where: {
          event: 'pageview',
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Top events with counts
      prisma.cmsAnalytics.groupBy({
        by: ['event'],
        _count: { event: true },
        orderBy: { _count: { event: 'desc' } },
        take: 10,
      }),
    ])

    // Group pageviews by day in JS
    const viewsByDay: Record<string, number> = {}
    for (const record of recentAnalytics) {
      const day = record.createdAt.toISOString().split('T')[0]
      viewsByDay[day] = (viewsByDay[day] || 0) + 1
    }

    // Convert to sorted array
    const dailyViews = Object.entries(viewsByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Format top events
    const formattedTopEvents = topEvents.map((e) => ({
      event: e.event,
      count: e._count.event,
    }))

    return c.json({
      totalPageviews,
      totalContacts,
      dailyViews,
      topEvents: formattedTopEvents,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return c.json({ error: 'Failed to get analytics' }, 500)
  }
})

// 17. POST /admin/seed — Seed placeholder
cms.post('/admin/seed', verifyToken, async (c) => {
  try {
    return c.json({ success: true, message: 'Seed endpoint ready — populate with seed data separately' })
  } catch (error) {
    console.error('Seed error:', error)
    return c.json({ error: 'Failed to seed' }, 500)
  }
})

// ============================================================
// HELPER: Send Telegram notification
// ============================================================

async function sendTelegramNotification(data: {
  fullName: string
  email: string
  phone?: string
  companyName?: string
  website?: string
  country?: string
  budget?: string
  platform?: string
  description?: string
  promoCode?: string
}) {
  try {
    // Get Telegram config from CmsSection
    const contactSection = await prisma.cmsSection.findUnique({
      where: { sectionKey: 'contact' },
    })

    if (!contactSection) return

    const sectionData = contactSection.data as any
    const botToken = sectionData?.telegramBotToken
    const chatId = sectionData?.telegramChatId

    if (!botToken || !chatId) return

    const message = `\u{1F514} New Contact Form Submission

Name: ${data.fullName}
Email: ${data.email}
Phone: ${data.phone || '-'}
Company: ${data.companyName || '-'}
Website: ${data.website || '-'}
Country: ${data.country || '-'}
Budget: ${data.budget || '-'}
Platform: ${data.platform || '-'}
Description: ${data.description || '-'}
Promo Code: ${data.promoCode || '-'}`

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch (error) {
    console.error('Telegram notification failed:', error)
  }
}

// ============================================================
// HERO HEADLINES — Daily rotating headlines
// ============================================================

// GET /headlines/today — Public: get today's headline based on IST date
cms.get('/headlines/today', async (c) => {
  try {
    const headlines = await prisma.heroHeadline.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })

    if (headlines.length === 0) {
      return c.json({
        headline: 'UNSTOPPABLE ADS UNSTOPPABLE BUSINESS',
        subtitle: 'Real agency ad accounts, live in 1 hour — no stress, no bans.',
      })
    }

    // Calculate which headline to show based on IST date (UTC+5:30)
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istDate = new Date(now.getTime() + istOffset)
    const dayOfYear = Math.floor((istDate.getTime() - new Date(istDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
    const index = dayOfYear % headlines.length

    const today = headlines[index]
    return c.json({
      headline: today.headline,
      subtitle: today.subtitle,
      totalHeadlines: headlines.length,
      dayIndex: index,
    })
  } catch (error) {
    console.error('Get today headline error:', error)
    return c.json({
      headline: 'UNSTOPPABLE ADS UNSTOPPABLE BUSINESS',
      subtitle: 'Real agency ad accounts, live in 1 hour — no stress, no bans.',
    })
  }
})

// GET /admin/headlines — Admin: list all headlines
cms.get('/admin/headlines', verifyToken, async (c) => {
  try {
    const headlines = await prisma.heroHeadline.findMany({
      orderBy: { order: 'asc' },
    })
    return c.json({ headlines })
  } catch (error) {
    console.error('Get headlines error:', error)
    return c.json({ error: 'Failed to get headlines' }, 500)
  }
})

// POST /admin/headlines — Admin: create headline
cms.post('/admin/headlines', verifyToken, async (c) => {
  try {
    const { headline, subtitle } = await c.req.json()
    if (!headline || !subtitle) {
      return c.json({ error: 'Headline and subtitle are required' }, 400)
    }

    // Get next order number
    const last = await prisma.heroHeadline.findFirst({ orderBy: { order: 'desc' } })
    const nextOrder = (last?.order ?? -1) + 1

    const created = await prisma.heroHeadline.create({
      data: { headline, subtitle, order: nextOrder },
    })
    return c.json({ headline: created })
  } catch (error) {
    console.error('Create headline error:', error)
    return c.json({ error: 'Failed to create headline' }, 500)
  }
})

// PUT /admin/headlines/:id — Admin: update headline
cms.put('/admin/headlines/:id', verifyToken, async (c) => {
  try {
    const { id } = c.req.param()
    const { headline, subtitle, order, isActive } = await c.req.json()

    const updated = await prisma.heroHeadline.update({
      where: { id },
      data: {
        ...(headline !== undefined && { headline }),
        ...(subtitle !== undefined && { subtitle }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    return c.json({ headline: updated })
  } catch (error) {
    console.error('Update headline error:', error)
    return c.json({ error: 'Failed to update headline' }, 500)
  }
})

// DELETE /admin/headlines/:id — Admin: delete headline
cms.delete('/admin/headlines/:id', verifyToken, async (c) => {
  try {
    const { id } = c.req.param()
    await prisma.heroHeadline.delete({ where: { id } })
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete headline error:', error)
    return c.json({ error: 'Failed to delete headline' }, 500)
  }
})

// PUT /admin/headlines/reorder — Admin: reorder all headlines
cms.put('/admin/headlines/reorder', verifyToken, async (c) => {
  try {
    const { ids } = await c.req.json() // array of IDs in desired order
    if (!Array.isArray(ids)) return c.json({ error: 'ids array required' }, 400)

    await Promise.all(
      ids.map((id: string, index: number) =>
        prisma.heroHeadline.update({ where: { id }, data: { order: index } })
      )
    )
    return c.json({ success: true })
  } catch (error) {
    console.error('Reorder headlines error:', error)
    return c.json({ error: 'Failed to reorder' }, 500)
  }
})

// ============================================================
// EMAIL TEMPLATES — Contact form
// ============================================================

function getCustomerConfirmationEmail(name: string, company?: string) {
  const firstName = name.split(' ')[0]
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:0;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;">

<!-- Header -->
<tr><td style="padding:24px 28px;border-bottom:1px solid #f0f0f0;">
  <span style="color:#1d1d1f;font-size:12px;font-weight:700;letter-spacing:3.5px;">ADS360</span>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px 28px 24px;">
  <p style="margin:0 0 4px;color:#86868b;font-size:11px;font-weight:500;letter-spacing:0.5px;">CONFIRMATION</p>
  <h1 style="margin:0 0 14px;color:#1d1d1f;font-size:20px;font-weight:600;line-height:1.3;">We've received your inquiry, ${firstName}.</h1>
  <p style="margin:0;color:#86868b;font-size:13px;line-height:1.65;">A member of our team will review your details and get back to you within 30 minutes during business hours.</p>
</td></tr>

<!-- Steps -->
<tr><td style="padding:0 28px 28px;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#f5f5f7;border-radius:8px;overflow:hidden;">
    <tr><td style="padding:14px 18px;border-bottom:1px solid #ebebed;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td><p style="margin:0;color:#1d1d1f;font-size:12px;font-weight:600;">Review</p><p style="margin:1px 0 0;color:#86868b;font-size:11px;">We match the right account for you</p></td>
        <td width="20" style="text-align:right;"><span style="color:#86868b;font-size:10px;">1</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:14px 18px;border-bottom:1px solid #ebebed;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td><p style="margin:0;color:#1d1d1f;font-size:12px;font-weight:600;">Connect</p><p style="margin:1px 0 0;color:#86868b;font-size:11px;">A specialist reaches out personally</p></td>
        <td width="20" style="text-align:right;"><span style="color:#86868b;font-size:10px;">2</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:14px 18px;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td><p style="margin:0;color:#1d1d1f;font-size:12px;font-weight:600;">Activate</p><p style="margin:1px 0 0;color:#86868b;font-size:11px;">Your ad account goes live in minutes</p></td>
        <td width="20" style="text-align:right;"><span style="color:#86868b;font-size:10px;">3</span></td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>

<!-- Buttons -->
<tr><td style="padding:0 28px 28px;">
  <table cellpadding="0" cellspacing="0" width="100%"><tr>
    <td style="padding-right:5px;"><a href="https://t.me/ads360support" style="display:block;background:#0071e3;color:#fff;text-decoration:none;padding:10px 0;border-radius:6px;font-size:12px;font-weight:600;text-align:center;">Telegram</a></td>
    <td style="padding-left:5px;"><a href="https://ads360.ai" style="display:block;background:#f5f5f7;color:#1d1d1f;text-decoration:none;padding:9px 0;border-radius:6px;font-size:12px;font-weight:500;text-align:center;border:1px solid #d2d2d7;">ads360.ai</a></td>
  </tr></table>
</td></tr>

<!-- Footer -->
<tr><td style="padding:16px 28px;background:#f5f5f7;border-top:1px solid #ebebed;">
  <p style="margin:0;color:#86868b;font-size:10px;">ADS360 &middot; Premium agency ad accounts &middot; <a href="https://ads360.ai" style="color:#0071e3;text-decoration:none;">ads360.ai</a></p>
</td></tr>

</table>

<p style="margin:12px 0 0;color:#c7c7cc;font-size:9px;text-align:center;">This email was sent because you submitted a contact form on ADS360.</p>

</td></tr>
</table>
</body></html>`
}

function getAdminNotificationEmail(data: {
  fullName: string; email: string; phone?: string; companyName?: string;
  website?: string; country?: string; budget?: string; platform?: string;
  description?: string; promoCode?: string;
}) {
  const row = (label: string, value?: string) =>
    `<tr>
      <td style="padding:8px 12px;color:#6b7280;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;width:140px;">${label}</td>
      <td style="padding:8px 12px;color:#111827;font-size:13px;border-bottom:1px solid #f3f4f6;">${value || '<span style="color:#d1d5db">—</span>'}</td>
    </tr>`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<!-- Header -->
<tr><td style="background:#dc2626;padding:20px 40px;">
  <h1 style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">&#128680; New Lead — Action Required</h1>
  <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">Someone just submitted the contact form on ADS360</p>
</td></tr>

<!-- Lead Details -->
<tr><td style="padding:24px 40px;">
  <h2 style="margin:0 0 4px;color:#111827;font-size:18px;">${data.fullName}</h2>
  <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">${data.companyName || 'No company name'} · ${data.country || 'Unknown location'}</p>

  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    ${row('Name', data.fullName)}
    ${row('Email', `<a href="mailto:${data.email}" style="color:#3b82f6;text-decoration:none;">${data.email}</a>`)}
    ${row('Phone', data.phone ? `<a href="tel:${data.phone}" style="color:#3b82f6;text-decoration:none;">${data.phone}</a>` : undefined)}
    ${row('Company', data.companyName)}
    ${row('Website', data.website ? `<a href="${data.website}" style="color:#3b82f6;text-decoration:none;">${data.website}</a>` : undefined)}
    ${row('Country', data.country)}
    ${row('Budget', data.budget ? `<strong style="color:#059669">${data.budget}</strong>` : undefined)}
    ${row('Platform', data.platform)}
    ${row('Promo Code', data.promoCode)}
  </table>

  ${data.description ? `
  <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
    <p style="margin:0 0 6px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Business Description</p>
    <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;">${data.description}</p>
  </div>` : ''}

  <!-- Quick actions -->
  <div style="margin-top:20px;text-align:center;">
    <a href="mailto:${data.email}?subject=Re: Your ADS360 Inquiry&body=Hi ${encodeURIComponent(data.fullName)}," style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:600;margin-right:8px;">Reply via Email</a>
    ${data.phone ? `<a href="tel:${data.phone}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:600;">Call Now</a>` : ''}
  </div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:16px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
  <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">ADS360 CRM — Contact this lead ASAP</p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

export default cms

// ==================== BLOG POSTS ====================

// GET /blog — Public: list published posts
cms.get('/blog', async (c) => {
  try {
    const { category, limit = '10', page = '1' } = c.req.query()
    const take = Math.min(parseInt(limit), 50)
    const skip = (parseInt(page) - 1) * take

    const where: any = { status: 'PUBLISHED' }
    if (category) where.category = category

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take,
        skip,
        select: {
          id: true, title: true, slug: true, excerpt: true,
          coverImage: true, category: true, tags: true,
          authorName: true, authorImage: true, readTime: true,
          views: true, publishedAt: true, createdAt: true,
        },
      }),
      prisma.blogPost.count({ where }),
    ])
    return c.json({ posts, total, page: parseInt(page), pages: Math.ceil(total / take) })
  } catch (e) {
    return c.json({ error: 'Failed to fetch posts' }, 500)
  }
})

// GET /blog/:slug — Public: get single post + increment views
cms.get('/blog/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    const post = await prisma.blogPost.findUnique({ where: { slug } })
    if (!post || post.status !== 'PUBLISHED') return c.json({ error: 'Not found' }, 404)
    // increment views async
    prisma.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {})
    return c.json({ post })
  } catch (e) {
    return c.json({ error: 'Failed to fetch post' }, 500)
  }
})

// GET /admin/blog — Admin: list all posts
cms.get('/admin/blog', verifyToken, async (c) => {
  try {
    const { status, page = '1', limit = '20' } = c.req.query()
    const take = parseInt(limit)
    const skip = (parseInt(page) - 1) * take
    const where: any = {}
    if (status) where.status = status

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where, orderBy: { createdAt: 'desc' }, take, skip,
      }),
      prisma.blogPost.count({ where }),
    ])
    return c.json({ posts, total })
  } catch (e) {
    return c.json({ error: 'Failed to fetch posts' }, 500)
  }
})

// POST /admin/blog — Admin: create post
cms.post('/admin/blog', verifyToken, async (c) => {
  try {
    const data = await c.req.json()
    if (!data.title || !data.slug) return c.json({ error: 'title and slug required' }, 400)

    // auto slug from title if empty
    const slug = data.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const post = await prisma.blogPost.create({
      data: {
        title: data.title,
        slug,
        excerpt: data.excerpt || '',
        content: data.content || '',
        coverImage: data.coverImage || null,
        category: data.category || null,
        tags: data.tags || [],
        status: data.status || 'DRAFT',
        authorName: data.authorName || 'ADS360 Team',
        authorImage: data.authorImage || null,
        metaTitle: data.metaTitle || null,
        metaDesc: data.metaDesc || null,
        readTime: data.readTime || 3,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
      },
    })
    return c.json({ post })
  } catch (e: any) {
    if (e?.code === 'P2002') return c.json({ error: 'Slug already exists' }, 400)
    return c.json({ error: 'Failed to create post' }, 500)
  }
})

// PUT /admin/blog/:id — Admin: update post
cms.put('/admin/blog/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')
    const data = await c.req.json()

    const existing = await prisma.blogPost.findUnique({ where: { id } })
    if (!existing) return c.json({ error: 'Not found' }, 404)

    const wasPublished = existing.status === 'PUBLISHED'
    const nowPublished = data.status === 'PUBLISHED'

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.slug && { slug: data.slug }),
        ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.status && { status: data.status }),
        ...(data.authorName && { authorName: data.authorName }),
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
        ...(data.metaDesc !== undefined && { metaDesc: data.metaDesc }),
        ...(data.readTime && { readTime: data.readTime }),
        ...(!wasPublished && nowPublished && { publishedAt: new Date() }),
      },
    })
    return c.json({ post })
  } catch (e) {
    return c.json({ error: 'Failed to update post' }, 500)
  }
})

// DELETE /admin/blog/:id — Admin: delete post
cms.delete('/admin/blog/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')
    await prisma.blogPost.delete({ where: { id } })
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to delete post' }, 500)
  }
})
