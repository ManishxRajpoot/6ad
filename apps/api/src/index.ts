import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import authRoutes from './routes/auth.js'
import agentRoutes from './routes/agents.js'
import userRoutes from './routes/users.js'
import transactionRoutes from './routes/transactions.js'
import accountRoutes from './routes/accounts.js'
import applicationRoutes from './routes/applications.js'
import dashboardRoutes from './routes/dashboard.js'
import settingsRoutes from './routes/settings.js'
import paymentMethodRoutes from './routes/payment-methods.js'
import bmShareRoutes from './routes/bm-share.js'
import domainRoutes from './routes/domains.js'
import facebookRoutes from './routes/facebook.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    // Allow all localhost origins for development
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin || '*'
    }
    // Allow production domains
    const allowedOrigins = [
      'https://easy.6ad.in',
      'https://agency.6ad.in',
      'https://ads.6ad.in',
      'https://super.6ad.in',
      'https://partner.6ad.in',
      'https://api.6ad.in',
      'http://super.6ad.in',
      'http://partner.6ad.in',
      'http://ads.6ad.in',
      'http://api.6ad.in'
    ]
    if (allowedOrigins.includes(origin)) {
      return origin
    }
    // Allow any 6ad.in subdomain
    if (origin && origin.includes('6ad.in')) {
      return origin
    }
    return null
  },
  credentials: true,
}))

// Health check
app.get('/', (c) => c.json({ message: '6AD API is running', version: '1.0.0' }))
app.get('/health', (c) => c.json({ status: 'ok' }))

// Routes
app.route('/auth', authRoutes)
app.route('/agents', agentRoutes)
app.route('/users', userRoutes)
app.route('/transactions', transactionRoutes)
app.route('/accounts', accountRoutes)
app.route('/applications', applicationRoutes)
app.route('/dashboard', dashboardRoutes)
app.route('/settings', settingsRoutes)
app.route('/payment-methods', paymentMethodRoutes)
app.route('/bm-share', bmShareRoutes)
app.route('/domains', domainRoutes)
app.route('/facebook', facebookRoutes)

// Start server
const port = Number(process.env.PORT) || 5001
console.log(`🚀 Server running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})

export default app
