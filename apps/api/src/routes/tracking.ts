import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()
const tracking = new Hono()

// POST /capi — Meta Conversions API (server-side pixel events)
// Receives events from client, forwards to Facebook Graph API
tracking.post('/capi', async (c) => {
  try {
    const body = await c.req.json()
    const { event_name, event_id, event_source_url, user_agent, em, ...customData } = body

    if (!event_name) return c.json({ error: 'event_name required' }, 400)

    // Get pixel config from CMS
    const section = await prisma.cmsSection.findUnique({ where: { sectionKey: 'tracking-pixels' } })
    const config = (section?.data as any) || {}
    const pixelId = config.metaPixelId
    const accessToken = config.metaCapiToken

    if (!pixelId || !accessToken || !config.enabled) {
      return c.json({ ok: true, skipped: true }) // silently skip if not configured
    }

    // Get client IP
    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || '0.0.0.0'

    // Hash email for user matching (SHA256, lowercase, trimmed)
    const hashedEmail = em
      ? crypto.createHash('sha256').update(em.toLowerCase().trim()).digest('hex')
      : undefined

    // Build CAPI event payload
    const eventData: any = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id, // for deduplication with browser pixel
      event_source_url: event_source_url || 'https://ads360.ai',
      action_source: 'website',
      user_data: {
        client_ip_address: clientIp,
        client_user_agent: user_agent || c.req.header('user-agent') || '',
        ...(hashedEmail && { em: [hashedEmail] }),
      },
    }

    // Add custom data (value, currency, content_ids, etc.)
    const cd: any = {}
    if (customData.value) cd.value = customData.value
    if (customData.currency) cd.currency = customData.currency
    if (customData.content_ids) cd.content_ids = customData.content_ids
    if (customData.content_name) cd.content_name = customData.content_name
    if (customData.content_type) cd.content_type = customData.content_type
    if (customData.order_id) cd.order_id = customData.order_id
    if (customData.content_id) cd.content_ids = [customData.content_id]
    if (Object.keys(cd).length > 0) eventData.custom_data = cd

    // Send to Meta Conversions API
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [eventData],
        access_token: accessToken,
      }),
    })

    const result = await res.json()
    if (!res.ok) {
      console.error('[CAPI] Meta API error:', JSON.stringify(result))
      return c.json({ ok: false, error: result.error?.message || 'CAPI failed' }, 500)
    }

    console.log(`[CAPI] ${event_name} sent (event_id: ${event_id}, events_received: ${result.events_received})`)
    return c.json({ ok: true, events_received: result.events_received })
  } catch (e: any) {
    console.error('[CAPI] Error:', e.message)
    return c.json({ ok: false, error: e.message }, 500)
  }
})

export default tracking
