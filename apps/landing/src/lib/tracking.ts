// Tracking utility — fires gtag + fbq events if available
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

// ─── Page Views ───
export function trackProductView(product: { id: string; title: string; price: number; platform?: string }) {
  gtag('event', 'view_item', {
    items: [{ item_id: product.id, item_name: product.title, price: product.price, item_category: product.platform || 'OTHER' }],
  })
  fbq('track', 'ViewContent', { content_id: product.id, content_name: product.title, content_type: 'product', currency: 'USD', value: product.price })
}

export function trackBlogView(post: { id: string; title: string; slug: string }) {
  gtag('event', 'page_view', { page_title: post.title, page_path: `/blog/${post.slug}`, content_group: 'blog' })
  fbq('track', 'ViewContent', { content_id: post.id, content_name: post.title, content_type: 'blog_post' })
}

// ─── Shop Events ───
export function trackInitiateCheckout(product: { id: string; title: string; price: number }) {
  gtag('event', 'begin_checkout', { currency: 'USD', value: product.price, items: [{ item_id: product.id, item_name: product.title, price: product.price }] })
  fbq('track', 'InitiateCheckout', { currency: 'USD', value: product.price, content_name: product.title })
}

export function trackAddToCart(product: { id: string; title: string; price: number }, orderId: string) {
  gtag('event', 'add_to_cart', { currency: 'USD', value: product.price, items: [{ item_id: product.id, item_name: product.title, price: product.price }] })
  fbq('track', 'AddToCart', { content_name: product.title, content_ids: [product.id], currency: 'USD', value: product.price })
}

export function trackPurchase(product: { id: string; title: string; price: number }, orderId: string, paymentMethod: string) {
  gtag('event', 'purchase', { transaction_id: orderId, currency: 'USD', value: product.price, items: [{ item_id: product.id, item_name: product.title, price: product.price }] })
  fbq('track', 'Purchase', { currency: 'USD', value: product.price, content_name: product.title, content_ids: [product.id] })
}

// ─── Contact & Lead ───
export function trackContactSubmit(email?: string) {
  gtag('event', 'generate_lead', { event_category: 'engagement', event_label: 'contact_form' })
  fbq('track', 'Lead', { content_name: 'Contact Form' })
}

export function trackCtaClick(label: string) {
  gtag('event', 'click', { event_category: 'cta', event_label: label })
  fbq('trackCustom', 'CTAClick', { button: label })
}
