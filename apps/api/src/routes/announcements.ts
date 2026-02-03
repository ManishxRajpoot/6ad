import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken, verifyAdmin } from '../middleware/auth'

const announcements = new Hono()

// GET /announcements - Get active announcements for users
announcements.get('/', verifyToken, async (c) => {
  try {
    const userRole = c.get('userRole') || 'USER'
    const now = new Date()

    const announcementsList = await prisma.announcement.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ],
        AND: [
          {
            OR: [
              { targetRole: null },
              { targetRole: 'ALL' },
              { targetRole: userRole }
            ]
          }
        ]
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return c.json({ announcements: announcementsList })
  } catch (error) {
    console.error('Get announcements error:', error)
    return c.json({ error: 'Failed to get announcements' }, 500)
  }
})

// GET /announcements/admin - Get all announcements (admin only)
announcements.get('/admin', verifyToken, verifyAdmin, async (c) => {
  try {
    const announcementsList = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return c.json({ announcements: announcementsList })
  } catch (error) {
    console.error('Get all announcements error:', error)
    return c.json({ error: 'Failed to get announcements' }, 500)
  }
})

// POST /announcements - Create announcement (admin only)
announcements.post('/', verifyToken, verifyAdmin, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()

    const { title, message, type, isPinned, showOnce, startDate, endDate, targetRole } = body

    if (!title || !message) {
      return c.json({ error: 'Title and message are required' }, 400)
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        message,
        type: type ? type.toLowerCase() : 'info',
        isPinned: isPinned || false,
        showOnce: showOnce || false,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        targetRole: targetRole || null,
        createdById: userId
      }
    })

    return c.json({ announcement }, 201)
  } catch (error) {
    console.error('Create announcement error:', error)
    return c.json({ error: 'Failed to create announcement' }, 500)
  }
})

// PATCH /announcements/:id - Update announcement (admin only)
announcements.patch('/:id', verifyToken, verifyAdmin, async (c) => {
  try {
    const announcementId = c.req.param('id')
    const body = await c.req.json()

    const { title, message, type, isActive, isPinned, showOnce, startDate, endDate, targetRole } = body

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (message !== undefined) updateData.message = message
    if (type !== undefined) updateData.type = type.toLowerCase()
    if (isActive !== undefined) updateData.isActive = isActive
    if (isPinned !== undefined) updateData.isPinned = isPinned
    if (showOnce !== undefined) updateData.showOnce = showOnce
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (targetRole !== undefined) updateData.targetRole = targetRole

    const announcement = await prisma.announcement.update({
      where: { id: announcementId },
      data: updateData
    })

    return c.json({ announcement })
  } catch (error) {
    console.error('Update announcement error:', error)
    return c.json({ error: 'Failed to update announcement' }, 500)
  }
})

// DELETE /announcements/:id - Delete announcement (admin only)
announcements.delete('/:id', verifyToken, verifyAdmin, async (c) => {
  try {
    const announcementId = c.req.param('id')

    await prisma.announcement.delete({
      where: { id: announcementId }
    })

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete announcement error:', error)
    return c.json({ error: 'Failed to delete announcement' }, 500)
  }
})

export default announcements
