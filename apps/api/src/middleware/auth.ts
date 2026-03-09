import { Context, Next } from 'hono'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'

type UserRole = 'ADMIN' | 'AGENT' | 'USER'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface JWTPayload {
  id: string
  email: string
  role: UserRole
  iat: number
  exp: number
}

// In-memory user cache — avoids DB hit on every request
// TTL: 30s, auto-evict on size limit
const _userCache = new Map<string, { data: any; ts: number }>()
const USER_CACHE_TTL = 30_000 // 30 seconds
const USER_CACHE_MAX = 2000

function getCachedUser(id: string) {
  const entry = _userCache.get(id)
  if (entry && Date.now() - entry.ts < USER_CACHE_TTL) return entry.data
  if (entry) _userCache.delete(id) // expired
  return null
}

function setCachedUser(id: string, data: any) {
  // Evict oldest entries if cache is too large
  if (_userCache.size >= USER_CACHE_MAX) {
    const firstKey = _userCache.keys().next().value
    if (firstKey) _userCache.delete(firstKey)
  }
  _userCache.set(id, { data, ts: Date.now() })
}

// Invalidate a specific user's cache (call after status changes)
export function invalidateUserCache(userId?: string) {
  if (userId) _userCache.delete(userId)
  else _userCache.clear()
}

export const verifyToken = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401)
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload

    // Check cache first — avoids DB query on every request
    let user = getCachedUser(decoded.id)
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
          agentId: true,
        }
      })
      if (user) setCachedUser(decoded.id, user)
    }

    if (!user) {
      return c.json({ error: 'User not found' }, 401)
    }

    if (user.status === 'BLOCKED') {
      return c.json({ error: 'Account is blocked' }, 403)
    }

    // Attach user to context
    c.set('user', user)
    c.set('userId', user.id)
    c.set('userRole', user.role)

    await next()
  } catch (error) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}

// Role-based middleware
export const requireRole = (...roles: UserRole[]) => {
  return async (c: Context, next: Next) => {
    const userRole = c.get('userRole') as UserRole

    if (!roles.includes(userRole)) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    await next()
  }
}

export const requireAdmin = requireRole('ADMIN')
export const requireAgent = requireRole('ADMIN', 'AGENT')
export const requireUser = requireRole('ADMIN', 'AGENT', 'USER')

// Aliases for convenience
export const verifyAdmin = requireAdmin
export const verifyAgent = requireAgent
export const verifyUser = requireUser

// Generate JWT token
// Default: 24hr session. With rememberMe: 72hr session (trusted device)
export const generateToken = (user: { id: string; email: string; role: UserRole }, rememberMe: boolean = false): string => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, rememberMe },
    JWT_SECRET,
    { expiresIn: rememberMe ? '72h' : '24h' }
  )
}
