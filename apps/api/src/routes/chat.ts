import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken, verifyAdmin } from '../middleware/auth'

const chat = new Hono()

// GET /chat/room - Get or create user's chat room
chat.get('/room', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')

    let room = await prisma.chatRoom.findFirst({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100  // Last 100 messages
        }
      }
    })

    // Create room if doesn't exist
    if (!room) {
      room = await prisma.chatRoom.create({
        data: { userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      })
    }

    return c.json({ room })
  } catch (error) {
    console.error('Get chat room error:', error)
    return c.json({ error: 'Failed to get chat room' }, 500)
  }
})

// POST /chat/send - Send a message
chat.post('/send', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { roomId, message, attachmentUrl, attachmentType } = await c.req.json()

    if (!message && !attachmentUrl) {
      return c.json({ error: 'Message or attachment is required' }, 400)
    }

    // Get or create room
    let room
    if (roomId) {
      room = await prisma.chatRoom.findFirst({
        where: {
          id: roomId,
          OR: [
            { userId },
            { adminId: userId }
          ]
        }
      })
    } else {
      // For users, get their room
      room = await prisma.chatRoom.findFirst({ where: { userId } })
      if (!room) {
        room = await prisma.chatRoom.create({ data: { userId } })
      }
    }

    if (!room) {
      return c.json({ error: 'Chat room not found' }, 404)
    }

    // Create message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderId: userId,
        senderRole: userRole === 'ADMIN' ? 'ADMIN' : 'USER',
        message: message || '',
        attachmentUrl,
        attachmentType
      }
    })

    // Update room's last message time
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { lastMessageAt: new Date() }
    })

    return c.json({ message: chatMessage })
  } catch (error) {
    console.error('Send message error:', error)
    return c.json({ error: 'Failed to send message' }, 500)
  }
})

// GET /chat/messages/:roomId - Get messages for a room
chat.get('/messages/:roomId', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const roomId = c.req.param('roomId')
    const limit = parseInt(c.req.query('limit') || '50')
    const before = c.req.query('before')  // For pagination

    // Verify access to room
    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: userRole === 'ADMIN'
          ? [{ id: roomId }]  // Admins can access any room
          : [{ userId }, { adminId: userId }]
      }
    })

    if (!room) {
      return c.json({ error: 'Chat room not found' }, 404)
    }

    const where: any = { roomId }
    if (before) {
      where.createdAt = { lt: new Date(before) }
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    // Mark messages as read if user is not the sender
    const unreadMessages = messages.filter(m => m.senderId !== userId && !m.isRead)
    if (unreadMessages.length > 0) {
      await prisma.chatMessage.updateMany({
        where: {
          id: { in: unreadMessages.map(m => m.id) }
        },
        data: { isRead: true, readAt: new Date() }
      })
    }

    return c.json({ messages: messages.reverse() })
  } catch (error) {
    console.error('Get messages error:', error)
    return c.json({ error: 'Failed to get messages' }, 500)
  }
})

// GET /chat/unread - Get unread message count
chat.get('/unread', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')

    const room = await prisma.chatRoom.findFirst({
      where: { userId }
    })

    if (!room) {
      return c.json({ unreadCount: 0 })
    }

    const unreadCount = await prisma.chatMessage.count({
      where: {
        roomId: room.id,
        senderId: { not: userId },
        isRead: false
      }
    })

    return c.json({ unreadCount })
  } catch (error) {
    console.error('Get unread count error:', error)
    return c.json({ error: 'Failed to get unread count' }, 500)
  }
})

// ============= ADMIN ENDPOINTS =============

// POST /chat/admin/send - Admin send message to a room
chat.post('/admin/send', verifyToken, verifyAdmin, async (c) => {
  try {
    const adminId = c.get('userId')
    const { roomId, message } = await c.req.json()

    if (!roomId || !message) {
      return c.json({ error: 'roomId and message are required' }, 400)
    }

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId }
    })

    if (!room) {
      return c.json({ error: 'Chat room not found' }, 404)
    }

    const chatMessage = await prisma.chatMessage.create({
      data: {
        roomId,
        senderId: adminId,
        senderRole: 'ADMIN',
        message
      }
    })

    // Update room's last message time
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date(), adminId }
    })

    return c.json({ message: chatMessage })
  } catch (error) {
    console.error('Admin send message error:', error)
    return c.json({ error: 'Failed to send message' }, 500)
  }
})

// GET /chat/admin/rooms - Get all chat rooms (admin only)
chat.get('/admin/rooms', verifyToken, verifyAdmin, async (c) => {
  try {
    const status = c.req.query('status')  // open, assigned, closed

    const where: any = {}
    if (status) {
      where.status = status
    }

    const rooms = await prisma.chatRoom.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1  // Just the last message
        }
      }
    })

    // Get user info for each room
    const roomsWithUsers = await Promise.all(
      rooms.map(async (room) => {
        const user = await prisma.user.findUnique({
          where: { id: room.userId },
          select: { id: true, username: true, email: true, profileImage: true }
        })

        const unreadCount = await prisma.chatMessage.count({
          where: {
            roomId: room.id,
            senderRole: 'USER',
            isRead: false
          }
        })

        return {
          ...room,
          user,
          unreadCount,
          lastMessage: room.messages[0] || null
        }
      })
    )

    return c.json({ rooms: roomsWithUsers })
  } catch (error) {
    console.error('Get admin rooms error:', error)
    return c.json({ error: 'Failed to get rooms' }, 500)
  }
})

// PATCH /chat/admin/rooms/:id/assign - Assign admin to room
chat.patch('/admin/rooms/:id/assign', verifyToken, verifyAdmin, async (c) => {
  try {
    const adminId = c.get('userId')
    const roomId = c.req.param('id')

    const room = await prisma.chatRoom.update({
      where: { id: roomId },
      data: { adminId, status: 'assigned' }
    })

    return c.json({ room })
  } catch (error) {
    console.error('Assign room error:', error)
    return c.json({ error: 'Failed to assign room' }, 500)
  }
})

// PATCH /chat/admin/rooms/:id/close - Close a chat room
chat.patch('/admin/rooms/:id/close', verifyToken, verifyAdmin, async (c) => {
  try {
    const roomId = c.req.param('id')

    const room = await prisma.chatRoom.update({
      where: { id: roomId },
      data: { status: 'closed' }
    })

    return c.json({ room })
  } catch (error) {
    console.error('Close room error:', error)
    return c.json({ error: 'Failed to close room' }, 500)
  }
})

// PATCH /chat/admin/rooms/:id/reopen - Reopen a chat room
chat.patch('/admin/rooms/:id/reopen', verifyToken, verifyAdmin, async (c) => {
  try {
    const roomId = c.req.param('id')

    const room = await prisma.chatRoom.update({
      where: { id: roomId },
      data: { status: 'open' }
    })

    return c.json({ room })
  } catch (error) {
    console.error('Reopen room error:', error)
    return c.json({ error: 'Failed to reopen room' }, 500)
  }
})

export default chat
