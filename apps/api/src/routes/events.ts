/**
 * SSE (Server-Sent Events) endpoint for real-time updates
 *
 * Flow: Client calls POST /events/ticket (with JWT in Authorization header)
 *       → receives a one-time ticket
 *       → connects to GET /events/stream?ticket=<ticket>
 *
 * This avoids exposing the JWT in the URL (browser history, logs, referrer headers)
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import jwt from 'jsonwebtoken'
import { addClient, removeClient, getClientCount } from '../services/event-bus.js'
import type { JWTPayload } from '../middleware/auth.js'
import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'
const app = new Hono()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// In-memory ticket store: ticket → { userId, role, expiresAt }
const sseTickets = new Map<string, { userId: string; role: string; expiresAt: number }>()

// Clean expired tickets every 60s
setInterval(() => {
  const now = Date.now()
  for (const [ticket, data] of sseTickets.entries()) {
    if (data.expiresAt < now) sseTickets.delete(ticket)
  }
}, 60_000)

// Issue a one-time SSE ticket (requires JWT in Authorization header)
app.post('/ticket', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization required' }, 401)
  }

  let decoded: JWTPayload
  try {
    decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as JWTPayload
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, role: true, status: true }
  })

  if (!user || user.status === 'BLOCKED') {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Generate one-time ticket (30s expiry)
  const ticket = crypto.randomBytes(32).toString('hex')
  sseTickets.set(ticket, {
    userId: user.id,
    role: user.role,
    expiresAt: Date.now() + 30_000,
  })

  return c.json({ ticket })
})

// SSE stream endpoint — accepts ticket OR token (backwards compatible)
app.get('/stream', async (c) => {
  let userId: string
  let userRole: string

  // Try ticket first (new secure method)
  const ticket = c.req.query('ticket')
  if (ticket) {
    const ticketData = sseTickets.get(ticket)
    if (!ticketData || ticketData.expiresAt < Date.now()) {
      return c.json({ error: 'Invalid or expired ticket' }, 401)
    }
    // One-time use — delete immediately
    sseTickets.delete(ticket)
    userId = ticketData.userId
    userRole = ticketData.role
  } else {
    // Fallback: accept JWT token (backwards compatible during rollout)
    const token = c.req.query('token')
    if (!token) {
      return c.json({ error: 'Ticket or token required' }, 401)
    }

    let decoded: JWTPayload
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, status: true }
    })

    if (!user || user.status === 'BLOCKED') {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    userId = user.id
    userRole = user.role
  }

  // Open SSE stream
  return streamSSE(c, async (stream) => {
    const connectionId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    addClient({
      id: connectionId,
      userId,
      role: userRole as 'USER' | 'AGENT' | 'ADMIN',
      stream,
      connectedAt: new Date(),
    })

    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ connectionId, connectedClients: getClientCount() }),
    })

    stream.onAbort(() => {
      removeClient(connectionId)
    })

    // Keep stream open indefinitely
    await new Promise<void>(() => {})
  })
})

// Health check
app.get('/status', (c) => {
  return c.json({
    connectedClients: getClientCount(),
    timestamp: new Date().toISOString(),
  })
})

export default app
