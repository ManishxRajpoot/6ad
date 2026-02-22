/**
 * IMAP Email Reader Service
 *
 * Connects to an email inbox via IMAP to read Facebook verification OTP codes.
 * Used by the checkpoint handler when Facebook shows an email OTP challenge
 * during automation jobs.
 *
 * Supports: Gmail (app passwords), Yahoo, Outlook, Hostinger, and any IMAP server.
 */
import Imap from 'imap'
import { simpleParser } from 'mailparser'

export interface ImapCredentials {
  host: string
  port: number
  user: string
  password: string
  secure: boolean
}

/**
 * Test IMAP connection — connects and disconnects to validate credentials.
 * Returns a success message or throws on failure.
 */
export async function testImapConnection(credentials: ImapCredentials): Promise<string> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: credentials.user,
      password: credentials.password,
      host: credentials.host,
      port: credentials.port,
      tls: credentials.secure,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10_000,
      authTimeout: 10_000,
    })

    imap.once('ready', () => {
      imap.end()
      resolve(`IMAP connection successful to ${credentials.host} as ${credentials.user}`)
    })

    imap.once('error', (err: Error) => {
      reject(new Error(`IMAP connection failed: ${err.message}`))
    })

    imap.connect()
  })
}

/**
 * Connect to an email inbox via IMAP, search for a recent Facebook
 * verification email, and extract the OTP code.
 *
 * Polling strategy: Tries up to maxAttempts times, waiting pollInterval
 * between each attempt (default: every 5s for up to 90s total).
 * This gives Facebook enough time to deliver the email.
 *
 * Returns the OTP string (5-8 digits) or null if not found.
 */
export async function fetchFacebookOtp(
  credentials: ImapCredentials,
  maxWaitMs: number = 90_000
): Promise<string | null> {
  const POLL_INTERVAL = 5_000
  const maxAttempts = Math.ceil(maxWaitMs / POLL_INTERVAL)

  console.log(`[IMAP] Starting OTP fetch from ${credentials.host} (max ${maxAttempts} attempts, ${maxWaitMs / 1000}s)`)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const otp = await searchForOtp(credentials)
      if (otp) {
        console.log(`[IMAP] OTP found on attempt ${attempt}: ${otp}`)
        return otp
      }
      console.log(`[IMAP] Attempt ${attempt}/${maxAttempts} — no OTP email found yet`)
    } catch (err: any) {
      console.error(`[IMAP] Error on attempt ${attempt}:`, err.message)
      // Don't break on transient errors — keep polling
    }

    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL))
    }
  }

  console.log(`[IMAP] OTP not found after ${maxAttempts} attempts`)
  return null
}

/**
 * Single IMAP search attempt — connects, searches for FB emails, extracts OTP.
 */
async function searchForOtp(credentials: ImapCredentials): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: credentials.user,
      password: credentials.password,
      host: credentials.host,
      port: credentials.port,
      tls: credentials.secure,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10_000,
      authTimeout: 10_000,
    })

    let resolved = false

    const cleanup = () => {
      try { imap.end() } catch {}
    }

    const finish = (result: string | null) => {
      if (resolved) return
      resolved = true
      cleanup()
      resolve(result)
    }

    const fail = (err: Error) => {
      if (resolved) return
      resolved = true
      cleanup()
      reject(err)
    }

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) return fail(err)

        // Search for recent Facebook emails (last 5 minutes)
        const sinceDate = new Date(Date.now() - 5 * 60 * 1000)

        // IMAP search criteria: unseen emails from Facebook since 5 min ago
        const searchCriteria: any[] = [
          'UNSEEN',
          ['SINCE', sinceDate],
          ['OR',
            ['FROM', 'facebookmail.com'],
            ['FROM', 'facebook.com']
          ],
        ]

        imap.search(searchCriteria, (err, results) => {
          if (err) return fail(err)

          if (!results || results.length === 0) {
            return finish(null)
          }

          // Get the most recent email (last in the array)
          const latestUid = results[results.length - 1]
          const fetch = imap.fetch([latestUid], { bodies: '', markSeen: true })

          fetch.on('message', (msg) => {
            let rawBody = ''

            msg.on('body', (stream) => {
              stream.on('data', (chunk: Buffer) => {
                rawBody += chunk.toString('utf8')
              })
            })

            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(rawBody)

                // Try to extract OTP from text body first, then HTML
                let otp = extractOtpFromBody(parsed.text || '')
                if (!otp && parsed.html) {
                  // Strip HTML tags for text-based extraction
                  const plainFromHtml = (parsed.html as string).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
                  otp = extractOtpFromBody(plainFromHtml)
                }

                // Also try the subject line
                if (!otp && parsed.subject) {
                  otp = extractOtpFromBody(parsed.subject)
                }

                finish(otp)
              } catch (parseErr: any) {
                console.error('[IMAP] Email parse error:', parseErr.message)
                finish(null)
              }
            })
          })

          fetch.once('error', (err: Error) => {
            fail(err)
          })

          fetch.once('end', () => {
            // If no message was processed, finish with null
            setTimeout(() => finish(null), 500)
          })
        })
      })
    })

    imap.once('error', (err: Error) => {
      fail(err)
    })

    // Timeout safety
    setTimeout(() => {
      if (!resolved) {
        finish(null)
      }
    }, 15_000)

    imap.connect()
  })
}

/**
 * Extract a numeric OTP code from email body text.
 * Facebook typically sends codes like:
 * - "Your confirmation code is 123456"
 * - "Enter the code: 12345678"
 * - "<td>123456</td>" (in HTML)
 * - Just a standalone number in the email
 */
function extractOtpFromBody(text: string): string | null {
  if (!text) return null

  // Clean up the text
  const cleaned = text.replace(/\s+/g, ' ').trim()

  // Patterns ordered from most specific to most general
  const patterns = [
    // "code is 123456" or "code: 123456"
    /(?:code|c\s*o\s*d\s*e)\s*(?:is|:|=)\s*(\d{5,8})/i,
    // "123456 is your code"
    /(\d{5,8})\s+(?:is your|is the)\s/i,
    // "Enter 123456" or "use 123456"
    /(?:enter|use|type|input)\s+(\d{5,8})/i,
    // "code" nearby a number (within 30 chars)
    /code.{1,30}?(\d{6,8})/i,
    /(\d{6,8}).{1,30}?code/i,
    // Standalone 6-digit number (most common OTP length)
    /\b(\d{6})\b/,
    // Standalone 8-digit number
    /\b(\d{8})\b/,
  ]

  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match) return match[1]
  }

  return null
}
