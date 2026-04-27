/**
 * Token Encryption — AES-256-GCM
 *
 * Encrypts BMSU tokens at rest. Key is read from TOKEN_ENCRYPTION_KEY env var
 * (must be 32 bytes hex-encoded = 64 hex chars).
 *
 * Format of encrypted blob: `<iv-hex>:<auth-tag-hex>:<ciphertext-hex>`
 *
 * Generate a key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY_HEX = process.env.TOKEN_ENCRYPTION_KEY || ''

let keyBuffer: Buffer | null = null

function getKey(): Buffer {
  if (keyBuffer) return keyBuffer
  if (!KEY_HEX) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY env var is not set. Generate one with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  if (KEY_HEX.length !== 64) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Got ${KEY_HEX.length} chars.`)
  }
  keyBuffer = Buffer.from(KEY_HEX, 'hex')
  return keyBuffer
}

/**
 * Encrypt a plaintext token. Returns format: <iv-hex>:<tag-hex>:<ct-hex>
 * IV is randomly generated each call so identical plaintext encrypts differently.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error('plaintext required')
  const key = getKey()
  const iv = crypto.randomBytes(12)  // 12 bytes = recommended for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`
}

/**
 * Decrypt a blob produced by encryptToken().
 * Throws if the blob is malformed or auth tag doesn't match (tampering check).
 */
export function decryptToken(blob: string): string {
  if (!blob) throw new Error('encrypted blob required')
  const parts = blob.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted blob format (expected iv:tag:ct)')
  const [ivHex, tagHex, ctHex] = parts
  const key = getKey()
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ct = Buffer.from(ctHex, 'hex')
  if (iv.length !== 12) throw new Error('Invalid IV length')
  if (tag.length !== 16) throw new Error('Invalid auth tag length')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()])
  return plaintext.toString('utf8')
}

/**
 * Mask a token for display (e.g. in admin UI/logs).
 * Returns the first 10 chars + "..." + last 4 chars.
 */
export function maskToken(token: string): string {
  if (!token || token.length < 14) return '***'
  return `${token.slice(0, 10)}...${token.slice(-4)}`
}
