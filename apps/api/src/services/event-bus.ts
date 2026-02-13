/**
 * Event Bus - In-memory SSE client registry and broadcast system
 * Manages connected SSE clients and broadcasts real-time events
 */

import type { SSEStreamingApi } from 'hono/streaming'

// Types
export type EventType =
  | 'payment-methods-updated'
  | 'settings-updated'
  | 'platforms-updated'
  | 'announcements-updated'
  | 'notification'
  | 'site-settings-updated'
  | 'modules-updated'
  | 'force-logout'

export type BroadcastTarget = 'all' | 'users' | 'agents'

export interface SSEClient {
  id: string
  userId: string
  role: 'USER' | 'AGENT' | 'ADMIN'
  stream: SSEStreamingApi
  connectedAt: Date
}

export interface BroadcastEvent {
  event: EventType
  data?: Record<string, any>
  targets?: BroadcastTarget
}

// In-memory client registry
const clients = new Map<string, SSEClient>()

let heartbeatInterval: ReturnType<typeof setInterval> | null = null

/**
 * Add a connected SSE client
 */
export function addClient(client: SSEClient): void {
  clients.set(client.id, client)
  console.log(`[SSE] Client connected: ${client.userId} (${client.role}) — ${clients.size} total`)
}

/**
 * Remove a disconnected SSE client
 */
export function removeClient(connectionId: string): void {
  const client = clients.get(connectionId)
  if (client) {
    clients.delete(connectionId)
    console.log(`[SSE] Client disconnected: ${client.userId} (${client.role}) — ${clients.size} total`)
  }
}

/**
 * Broadcast an event to targeted clients
 * Events are "invalidation signals" — clients refetch data via REST after receiving
 */
export function broadcast(event: BroadcastEvent): void {
  const { event: eventType, data = {}, targets = 'all' } = event
  const payload = JSON.stringify(data)

  let sentCount = 0

  for (const [connectionId, client] of clients.entries()) {
    // Skip admin clients (admin is the source of truth)
    if (client.role === 'ADMIN') continue

    // Filter by target
    if (targets === 'users' && client.role !== 'USER') continue
    if (targets === 'agents' && client.role !== 'AGENT') continue

    try {
      client.stream.writeSSE({
        event: eventType,
        data: payload,
        id: `${Date.now()}-${connectionId.slice(0, 8)}`,
      })
      sentCount++
    } catch (err) {
      // Client likely disconnected, clean up
      console.log(`[SSE] Write failed for ${client.userId}, removing`)
      clients.delete(connectionId)
    }
  }

  if (sentCount > 0) {
    console.log(`[SSE] Broadcast "${eventType}" → ${sentCount} client(s)`)
  }
}

/**
 * Broadcast an event to a specific user (all their connected sessions)
 */
export function broadcastToUser(userId: string, event: EventType, data: Record<string, any> = {}): void {
  const payload = JSON.stringify(data)
  let sentCount = 0

  for (const [connectionId, client] of clients.entries()) {
    if (client.userId !== userId) continue

    try {
      client.stream.writeSSE({
        event,
        data: payload,
        id: `${Date.now()}-${connectionId.slice(0, 8)}`,
      })
      sentCount++
    } catch (err) {
      console.log(`[SSE] Write failed for ${client.userId}, removing`)
      clients.delete(connectionId)
    }
  }

  if (sentCount > 0) {
    console.log(`[SSE] Sent "${event}" to user ${userId} → ${sentCount} session(s)`)
  }
}

/**
 * Get count of connected clients (for monitoring/health check)
 */
export function getClientCount(): number {
  return clients.size
}

/**
 * Start the heartbeat loop — sends a comment every 30s to keep connections alive
 * and prune dead connections
 */
export function startHeartbeat(): void {
  if (heartbeatInterval) return

  heartbeatInterval = setInterval(() => {
    for (const [connectionId, client] of clients.entries()) {
      try {
        // Send SSE comment (invisible to EventSource API but keeps connection alive)
        client.stream.writeSSE({
          event: 'heartbeat',
          data: '',
        })
      } catch (err) {
        // Connection is dead, remove it
        console.log(`[SSE] Heartbeat failed for ${client.userId}, removing`)
        clients.delete(connectionId)
      }
    }
  }, 30000) // Every 30 seconds

  console.log('[SSE] Heartbeat started (30s interval)')
}
