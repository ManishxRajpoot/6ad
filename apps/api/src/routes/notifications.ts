import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken, verifyAdmin } from '../middleware/auth'
import { broadcast } from '../services/event-bus.js'

const notifications = new Hono()

// GET /notifications - Get user's notifications
notifications.get('/', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = parseInt(c.req.query('offset') || '0')
    const unreadOnly = c.req.query('unreadOnly') === 'true'

    const where: any = { userId }
    if (unreadOnly) {
      where.isRead = false
    }

    const [notificationsList, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } })
    ])

    return c.json({
      notifications: notificationsList,
      total,
      unreadCount
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    return c.json({ error: 'Failed to get notifications' }, 500)
  }
})

// GET /notifications/unread-count - Get unread count only
notifications.get('/unread-count', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false }
    })

    return c.json({ unreadCount })
  } catch (error) {
    console.error('Get unread count error:', error)
    return c.json({ error: 'Failed to get unread count' }, 500)
  }
})

// PATCH /notifications/:id/read - Mark notification as read
notifications.patch('/:id/read', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const notificationId = c.req.param('id')

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId }
    })

    if (!notification) {
      return c.json({ error: 'Notification not found' }, 404)
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() }
    })

    return c.json({ success: true })
  } catch (error) {
    console.error('Mark read error:', error)
    return c.json({ error: 'Failed to mark as read' }, 500)
  }
})

// PATCH /notifications/read-all - Mark all notifications as read
notifications.patch('/read-all', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() }
    })

    return c.json({ success: true })
  } catch (error) {
    console.error('Mark all read error:', error)
    return c.json({ error: 'Failed to mark all as read' }, 500)
  }
})

// DELETE /notifications/:id - Delete a notification
notifications.delete('/:id', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const notificationId = c.req.param('id')

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId }
    })

    if (!notification) {
      return c.json({ error: 'Notification not found' }, 404)
    }

    await prisma.notification.delete({
      where: { id: notificationId }
    })

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete notification error:', error)
    return c.json({ error: 'Failed to delete notification' }, 500)
  }
})

// ============ ADMIN ENDPOINTS ============

// GET /notifications/admin/logs - Get all notifications (admin)
notifications.get('/admin/logs', verifyToken, verifyAdmin, async (c) => {
  try {
    const notificationsList = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    // Get user info for each notification
    const notificationsWithUsers = await Promise.all(
      notificationsList.map(async (notification) => {
        const user = await prisma.user.findUnique({
          where: { id: notification.userId },
          select: { username: true, email: true }
        })
        return {
          ...notification,
          user: user || { username: 'Unknown', email: 'unknown' }
        }
      })
    )

    return c.json({ notifications: notificationsWithUsers })
  } catch (error) {
    console.error('Get admin logs error:', error)
    return c.json({ error: 'Failed to get notifications' }, 500)
  }
})

// POST /notifications/admin/send - Send notification to a user (admin)
notifications.post('/admin/send', verifyToken, verifyAdmin, async (c) => {
  try {
    const { userId, type, title, message, link } = await c.req.json()

    if (!userId || !type || !title || !message) {
      return c.json({ error: 'userId, type, title, and message are required' }, 400)
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: type as any,
        title,
        message,
        link: link || null
      }
    })

    // Broadcast real-time notification push
    broadcast({ event: 'notification', data: { userId, action: 'new' } })

    return c.json({ notification, message: 'Notification sent successfully' })
  } catch (error) {
    console.error('Send notification error:', error)
    return c.json({ error: 'Failed to send notification' }, 500)
  }
})

// POST /notifications/admin/send-all - Send notification to all users (admin)
notifications.post('/admin/send-all', verifyToken, verifyAdmin, async (c) => {
  try {
    const { type, title, message, link } = await c.req.json()

    if (!type || !title || !message) {
      return c.json({ error: 'type, title, and message are required' }, 400)
    }

    // Get all users except admins
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['USER', 'AGENT'] }
      },
      select: { id: true }
    })

    if (users.length === 0) {
      return c.json({ count: 0, message: 'No users to notify' })
    }

    const notificationsData = users.map(user => ({
      userId: user.id,
      type: type as any,
      title,
      message,
      link: link || null
    }))

    const result = await prisma.notification.createMany({
      data: notificationsData
    })

    // Broadcast real-time notification push to all
    broadcast({ event: 'notification', data: { action: 'broadcast' } })

    return c.json({ count: result.count, message: `Sent to ${result.count} users` })
  } catch (error) {
    console.error('Send all notifications error:', error)
    return c.json({ error: 'Failed to send notifications' }, 500)
  }
})

// Helper function to create notifications (for internal use)
export async function createNotification(data: {
  userId: string
  type: 'ACCOUNT_APPROVED' | 'ACCOUNT_REJECTED' | 'DEPOSIT_APPROVED' | 'DEPOSIT_REJECTED' | 'LOW_BALANCE' | 'REFUND_PROCESSED' | 'REFERRAL_REWARD' | 'SYSTEM' | 'ANNOUNCEMENT'
  title: string
  message: string
  link?: string
  metadata?: any
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null
      }
    })

    // Broadcast real-time notification push
    broadcast({ event: 'notification', data: { userId: data.userId, action: 'new', type: data.type } })

    return notification
  } catch (error) {
    console.error('Create notification error:', error)
    return null
  }
}

export default notifications
