/**
 * Facebook Checkpoint Detection and Auto-Handler
 *
 * Detects when Facebook shows a verification/checkpoint page during
 * automation jobs, and attempts to auto-resolve by reading the OTP
 * code from the associated email inbox via IMAP.
 *
 * Supported checkpoint types:
 * - email_otp: Facebook sends a code via email → auto-handled via IMAP
 * - sms_otp: Facebook sends a code via SMS → NOT auto-handled (needs manual action)
 * - identity_confirm: Facebook asks to confirm identity → NOT auto-handled
 */
import { PrismaClient } from '@prisma/client'
import { fetchFacebookOtp } from './imap-reader.js'
import { humanDelay } from '../utils/delays.js'
import type { Page } from 'rebrowser-puppeteer'

const prisma = new PrismaClient()

export interface CheckpointResult {
  detected: boolean
  handled: boolean
  type?: 'email_otp' | 'sms_otp' | 'identity_confirm' | 'unknown'
  message?: string
}

/**
 * Check if the current page is a Facebook checkpoint/verification page.
 * Call this after every navigation in the worker flow.
 */
export async function detectCheckpoint(page: Page): Promise<{
  isCheckpoint: boolean
  type: 'email_otp' | 'sms_otp' | 'identity_confirm' | 'unknown' | null
}> {
  try {
    // Check 1: URL patterns
    const url = page.url()
    const checkpointUrlPatterns = [
      '/checkpoint/',
      '/login/checkpoint/',
      '/checkpoint?',
      '/security/',
      '/recover/',
      '/challenge/',
      'checkpoint',
    ]
    const isCheckpointUrl = checkpointUrlPatterns.some(p => url.toLowerCase().includes(p))

    // Check 2: Page content indicators
    const pageIndicators = await page.evaluate(() => {
      const bodyText = document.body?.innerText?.toLowerCase() || ''
      return {
        hasCodePrompt: /enter the code|enter.*code|confirmation code|security code|verify.*code|code.*sent|we sent/i.test(bodyText),
        hasIdentityPrompt: /confirm your identity|verify your identity|verify it.?s you|unusual activity|suspicious activity|we need to verify/i.test(bodyText),
        hasEmailMention: /sent.*code.*email|code.*sent.*to.*@|email.*verification|we sent.*code.*email|sent.*to your email/i.test(bodyText),
        hasSmsMention: /sent.*code.*phone|code.*sent.*to.*\+|text message|sms.*code|sent.*to your phone/i.test(bodyText),
        hasCodeInput: !!document.querySelector('input[name="approvals_code"], input[type="tel"][maxlength], input[placeholder*="code" i], input[aria-label*="code" i]'),
      }
    })

    if (!isCheckpointUrl && !pageIndicators.hasCodePrompt && !pageIndicators.hasIdentityPrompt) {
      return { isCheckpoint: false, type: null }
    }

    // Determine checkpoint type
    let type: 'email_otp' | 'sms_otp' | 'identity_confirm' | 'unknown' = 'unknown'

    if (pageIndicators.hasCodePrompt && pageIndicators.hasEmailMention) {
      type = 'email_otp'
    } else if (pageIndicators.hasCodePrompt && pageIndicators.hasSmsMention) {
      type = 'sms_otp'
    } else if (pageIndicators.hasIdentityPrompt && !pageIndicators.hasCodePrompt) {
      type = 'identity_confirm'
    } else if (pageIndicators.hasCodePrompt || pageIndicators.hasCodeInput) {
      // Default: if there's a code prompt but unclear source, assume email
      type = 'email_otp'
    }

    return { isCheckpoint: true, type }
  } catch (err) {
    console.error('[Checkpoint] Error during detection:', err)
    return { isCheckpoint: false, type: null }
  }
}

/**
 * Attempt to automatically handle a Facebook checkpoint.
 * Currently supports: email OTP via IMAP.
 * Returns whether the checkpoint was successfully resolved.
 */
export async function handleCheckpoint(
  page: Page,
  profileId: string,
  jobId: string,
  addLog: (id: string, level: string, msg: string) => Promise<void>,
  takeScreenshot: (page: Page, jobId: string, label: string) => Promise<void>
): Promise<CheckpointResult> {
  // 1. Detect what kind of checkpoint this is
  const detection = await detectCheckpoint(page)
  if (!detection.isCheckpoint) {
    return { detected: false, handled: false }
  }

  await addLog(jobId, 'warning', `Facebook checkpoint detected! Type: ${detection.type}, URL: ${page.url()}`)
  await takeScreenshot(page, jobId, 'checkpoint-detected')

  // 2. Only handle email_otp automatically
  if (detection.type !== 'email_otp') {
    return {
      detected: true,
      handled: false,
      type: detection.type || undefined,
      message: `Cannot auto-handle checkpoint type: ${detection.type}. Manual action required.`,
    }
  }

  // 3. Load the profile's IMAP credentials
  const profile = await prisma.facebookAutomationProfile.findUnique({
    where: { id: profileId },
    select: {
      emailAddress: true,
      imapHost: true,
      imapPort: true,
      imapUser: true,
      imapPassword: true,
      imapSecure: true,
    },
  })

  if (!profile?.imapHost || !profile?.imapUser || !profile?.imapPassword) {
    return {
      detected: true,
      handled: false,
      type: 'email_otp',
      message: 'Email OTP checkpoint detected but no IMAP credentials configured for this profile. Add IMAP settings in Admin → Automation.',
    }
  }

  // 4. Sometimes FB has a "Send code via email" button that needs to be clicked first
  await tryClickSendCodeButton(page)
  await humanDelay(2000, 4000)

  // 5. Fetch OTP from email inbox
  await addLog(jobId, 'info', `Fetching OTP from ${profile.imapHost} for ${profile.imapUser}...`)

  const otp = await fetchFacebookOtp({
    host: profile.imapHost,
    port: profile.imapPort || 993,
    user: profile.imapUser,
    password: profile.imapPassword,
    secure: profile.imapSecure ?? true,
  })

  if (!otp) {
    await addLog(jobId, 'error', 'Could not fetch OTP from email within timeout (90s)')
    await takeScreenshot(page, jobId, 'otp-not-found')
    return {
      detected: true,
      handled: false,
      type: 'email_otp',
      message: 'OTP email not received within timeout. Check IMAP credentials and email inbox.',
    }
  }

  await addLog(jobId, 'info', `OTP code extracted: ${otp}`)

  // 6. Enter OTP into the form
  const codeInput = await findCodeInput(page)
  if (!codeInput) {
    await addLog(jobId, 'error', 'OTP fetched but could not find the code input field on the page')
    await takeScreenshot(page, jobId, 'otp-input-not-found')
    return {
      detected: true,
      handled: false,
      type: 'email_otp',
      message: 'OTP fetched but could not find input field on checkpoint page',
    }
  }

  await codeInput.click({ clickCount: 3 }) // Select any existing text
  await codeInput.type(otp)
  await humanDelay(1000, 2000)
  await takeScreenshot(page, jobId, 'otp-entered')
  await addLog(jobId, 'info', 'OTP entered into form')

  // 7. Click Continue/Submit button
  const submitClicked = await clickSubmitButton(page)
  if (submitClicked) {
    await addLog(jobId, 'info', 'Clicked submit button')
  } else {
    // Fallback: press Enter
    await page.keyboard.press('Enter')
    await addLog(jobId, 'info', 'Pressed Enter to submit (no submit button found)')
  }

  await humanDelay(5000, 8000)
  await takeScreenshot(page, jobId, 'otp-submitted')

  // 8. Verify checkpoint was resolved
  const stillCheckpoint = await detectCheckpoint(page)
  if (stillCheckpoint.isCheckpoint) {
    await addLog(jobId, 'error', 'Checkpoint still present after OTP submission')
    await takeScreenshot(page, jobId, 'checkpoint-still-present')
    return {
      detected: true,
      handled: false,
      type: 'email_otp',
      message: 'OTP submitted but checkpoint was not resolved. Code may be incorrect or expired.',
    }
  }

  await addLog(jobId, 'success', 'Checkpoint resolved successfully via email OTP!')
  return { detected: true, handled: true, type: 'email_otp' }
}

// ============================================================
// Helper functions
// ============================================================

/**
 * Try to click a "Send code via email" or "Get code" button
 * that Facebook sometimes shows before sending the code.
 */
async function tryClickSendCodeButton(page: Page): Promise<boolean> {
  try {
    const clicked = await page.evaluate(() => {
      const buttonTexts = ['send code', 'get code', 'send email', 'email me', 'send via email', 'email']
      const buttons = document.querySelectorAll('button, [role="button"], a, input[type="submit"]')
      for (const btn of buttons) {
        const text = (btn.textContent?.trim().toLowerCase() || '') + ' ' + ((btn as HTMLInputElement).value?.toLowerCase() || '')
        if (buttonTexts.some(t => text.includes(t))) {
          const rect = btn.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            (btn as HTMLElement).click()
            return true
          }
        }
      }
      // Also check for radio buttons/options for "email" method
      const labels = document.querySelectorAll('label, [role="radio"], [role="option"]')
      for (const label of labels) {
        const text = label.textContent?.trim().toLowerCase() || ''
        if (text.includes('email') && !text.includes('phone')) {
          (label as HTMLElement).click()
          return true
        }
      }
      return false
    })
    return clicked
  } catch {
    return false
  }
}

/**
 * Find the OTP code input field on the checkpoint page.
 */
async function findCodeInput(page: Page): Promise<any | null> {
  // Try specific selectors first
  const selectors = [
    'input[name="approvals_code"]',
    'input[type="tel"]',
    'input[placeholder*="code" i]',
    'input[aria-label*="code" i]',
    'input[placeholder*="enter" i]',
    'input[name="code"]',
  ]

  for (const sel of selectors) {
    const input = await page.$(sel)
    if (input) {
      const isVisible = await page.evaluate((el: any) => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }, input)
      if (isVisible) return input
    }
  }

  // Fallback: first visible text input that isn't obviously something else
  const fallback = await page.evaluateHandle(() => {
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"], input:not([type])')
    for (const inp of inputs) {
      const rect = inp.getBoundingClientRect()
      const name = (inp as HTMLInputElement).name?.toLowerCase() || ''
      const type = (inp as HTMLInputElement).type?.toLowerCase() || ''
      // Skip hidden inputs and search boxes
      if (rect.width > 0 && rect.height > 0 && type !== 'hidden' && name !== 'search') {
        return inp
      }
    }
    return null
  })

  const isNull = await page.evaluate((el: any) => el === null, fallback)
  return isNull ? null : fallback
}

/**
 * Click the Continue/Submit button on the checkpoint page.
 */
async function clickSubmitButton(page: Page): Promise<boolean> {
  try {
    const clicked = await page.evaluate(() => {
      const buttonTexts = ['continue', 'submit', 'confirm', 'next', 'verify', 'send']
      const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]')
      for (const btn of buttons) {
        const text = (btn.textContent?.trim().toLowerCase() || '') + ' ' + ((btn as HTMLInputElement).value?.toLowerCase() || '')
        if (buttonTexts.some(t => text.includes(t))) {
          const rect = btn.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            (btn as HTMLElement).click()
            return true
          }
        }
      }
      return false
    })
    return clicked
  } catch {
    return false
  }
}
