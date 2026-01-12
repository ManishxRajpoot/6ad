import { Context } from 'hono'

export type UserRole = 'ADMIN' | 'AGENT' | 'USER'

export interface Variables {
  user: {
    id: string
    email: string
    username: string
    role: UserRole
    status: string
    agentId: string | null
  }
  userId: string
  userRole: UserRole
}

export type AppContext = Context<{ Variables: Variables }>
