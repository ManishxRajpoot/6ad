// Tracking utility — fires gtag + fbq (client) + Meta CAPI (server)
// Scripts are injected by layout.tsx from CMS config

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    fbq?: (...args: any[]) => void
    dataLayer?: any[]
  }
}

function gtag(...args: any[]) {
  if (typeof window !== 'undefined' && window.gtag) window.gtag(...args)
}

function fbq(...args: any[]) {
  if (typeof window !== 'undefined' && window.fbq) window.fbq(...args)
}

// Generate unique event ID for deduplication between pixel + CAPI
function eventId() {
  return `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
}

// Get API base URL
function getApiUrl() {
  if (typeof window === 'undefined') return 'http://localhost:5001'
  return (window.location.hostname.endsWith('6ad.in') || window.location.hostname.endsWith('ads360.ai'))
    ? 'https://api.6ad.in' : 'http://localhost:5001'
}

// Send server-side CAPI event (non-blocking)
function sendCapi(eventName: string, eventId: string, data: Record<string, any> = {}) {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  fetch(`${getApiUrl()}/tracking/capi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_source_url: url,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      ...data,
    }),
  }).catch(() => {}) // non-blocking, don't care if it fails
}

// ─── Page Views ───
export function trackProductView(product: { id: string; title: string; price: number; platform?: string }) {
  const eid = eventId()
  gtag('event', 'view_item', { items: [{ item_id: product.id, item_name: product.title, price: product.price, item_category: product.platform || 'OTHER' }] })
  fbq('track', 'ViewContent', { content_id: product.id, content_name: product.title, content_type: 'product', currency: 'USD', value: product.price, eventID: eid })
  sendCapi('ViewContent', eid, { content_id: product.id, content_name: product.title, value: product.price, currency: 'USD' })
}

export function trackBlogView(post: { id: string; title: string; slug: string }) {
  const eid = eventId()
  gtag('event', 'page_view', { page_title: post.title, page_path: `/blog/${post.slug}`, content_group: 'blog' })
  fbq('track', 'ViewContent', { content_id: post.id, content_name: post.title, content_type: 'blog_post', eventID: eid })
  sendCapi('ViewContent', eid, { content_id: post.id, content_name: post.title })
}

// ─── Shop Events ───
export function trackInitiateCheckout(product: { id: string; title: string; price: number }) {
  const eid = eventId()
  gtag('event', 'begin_checkout', { currency: 'USD', value: product.price, items: [{ item_id: product.id, item_name: product.title, price: product.price }] })
  fbq('track', 'InitiateCheckout', { currency: 'USD', value: product.price, content_name: product.title, eventID: eid })
  sendCapi('InitiateCheckout', eid, { content_name: product.title, value: product.price, currency: 'USD' })
}

export function trackAddToCart(product: { id: string; title: string; price: number }, orderId: string) {
  const eid = eventId()
  gtag('event', 'add_to_cart', { currency: 'USD', value: product.price, items: [{ item_id: product.id, item_name: product.title, price: product.price }] })
  fbq('track', 'AddToCart', { content_name: product.title, content_ids: [product.id], currency: 'USD', value: product.price, eventID: eid })
  sendCapi('AddToCart', eid, { content_ids: [product.id], content_name: product.title, value: product.price, currency: 'USD' })
}

export function trackPurchase(product: { id: string; title: string; price: number }, orderId: string, paymentMethod: string) {
  const eid = eventId()
  gtag('event', 'purchase', { transaction_id: orderId, currency: 'USD', value: product.price, items: [{ item_id: product.id, item_name: product.title, price: product.price }] })
  fbq('track', 'Purchase', { currency: 'USD', value: product.price, content_name: product.title, content_ids: [product.id], eventID: eid })
  sendCapi('Purchase', eid, { content_ids: [product.id], content_name: product.title, value: product.price, currency: 'USD', order_id: orderId })
}

// ─── Contact & Lead ───
export function trackContactSubmit(email?: string) {
  const eid = eventId()
  gtag('event', 'generate_lead', { event_category: 'engagement', event_label: 'contact_form' })
  fbq('track', 'Lead', { content_name: 'Contact Form', eventID: eid })
  sendCapi('Lead', eid, { content_name: 'Contact Form', ...(email ? { em: email } : {}) })
}

export function trackCtaClick(label: string) {
  gtag('event', 'click', { event_category: 'cta', event_label: label })
  fbq('trackCustom', 'CTAClick', { button: label })
}
