import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken, verifyAdmin } from '../middleware/auth'
import fs from 'fs'
import path from 'path'

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

export default cms
