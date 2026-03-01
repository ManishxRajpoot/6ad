/**
 * Token Manager Service (Minimal)
 *
 * This module has been simplified. The system now uses Puppeteer UI automation
 * instead of extracted EAA tokens for Facebook actions.
 *
 * Facebook trusts browser sessions doing UI actions — not extracted tokens.
 * Token capture has been removed. Workers launch real browser sessions instead.
 *
 * Kept: validateToken() for optional diagnostic purposes only.
 */

const FB_GRAPH_BASE = 'https://graph.facebook.com/v18.0'

/**
 * Validate a Facebook access token by calling /me
 * Used for diagnostic purposes only — NOT used by workers.
 */
export async function validateToken(token: string): Promise<{ valid: boolean; userId?: string; name?: string; error?: string }> {
  try {
    const res = await fetch(`${FB_GRAPH_BASE}/me?fields=id,name&access_token=${token}`)
    const data = await res.json() as any

    if (data.error) {
      return { valid: false, error: data.error.message || 'Token validation failed' }
    }

    if (data.id && data.name) {
      return { valid: true, userId: data.id, name: data.name }
    }

    return { valid: false, error: 'Invalid response from Facebook' }
  } catch (err: any) {
    return { valid: false, error: err.message || 'Network error during validation' }
  }
}
