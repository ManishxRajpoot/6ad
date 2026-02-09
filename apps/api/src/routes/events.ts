/**
 * SSE (Server-Sent Events) endpoint for real-time updates
 * Clients connect via: GET /events/stream?token=<jwt>
 *
 * EventSource API doesn't support custom headers, so JWT is passed as query param
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { addClient, removeClient, getClientCount } from '../services/event-bus.js'
import type { JWTPayload } from '../middleware/auth.js'

const prisma = new PrismaClient()
const app = new Hono()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// SSE stream endpoint
app.get('/stream', async (c) => {
  // 1. Extract token from query param
  const token = c.req.query('token')
  if (!token) {
    return c.json({ error: 'Token required' }, 401)
  }

  // 2. Verify JWT (same logic as auth middleware)
  let decoded: JWTPayload
  try {
    decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch (err) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  // 3. Verify user exists and is not blocked
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, role: true, status: true }
  })

  if (!user) {
    return c.json({ error: 'User not found' }, 401)
  }

  if (user.status === 'BLOCKED') {
    return c.json({ error: 'Account is blocked' }, 403)
  }

  // 4. Open SSE stream
  return streamSSE(c, async (stream) => {
    const connectionId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // 5. Register client in event bus
    addClient({
      id: connectionId,
      userId: user.id,
      role: user.role as 'USER' | 'AGENT' | 'ADMIN',
      stream,
      connectedAt: new Date(),
    })

    // 6. Send initial connected event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ connectionId, connectedClients: getClientCount() }),
    })

    // 7. Clean up on disconnect
    stream.onAbort(() => {
      removeClient(connectionId)
    })

    // 8. Keep stream open indefinitely
    // The stream stays alive until client disconnects or server closes it
    // Heartbeat in event-bus.ts handles keepalive pings
    await new Promise<void>(() => {
      // Never resolves — keeps the handler alive
    })
  })
})

// Health check — shows connected client count
app.get('/status', (c) => {
  return c.json({
    connectedClients: getClientCount(),
    timestamp: new Date().toISOString(),
  })
})

export default app
