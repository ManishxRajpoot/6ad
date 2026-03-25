/**
 * Quick BM Share Test Script
 *
 * Usage:
 *   node test-bm-share.mjs <adAccountId> <targetBmId> [sourceBmId]
 *
 * Example:
 *   node test-bm-share.mjs 2176590489538801 642431908960424 1595645287677231
 *
 * This launches a HEADED browser (visible) using the first active profile,
 * navigates to FB Business Settings, and shares the ad account to the target BM.
 * You can watch each step happen in real-time.
 */

import puppeteer from 'rebrowser-puppeteer'
import { PrismaClient } from '@prisma/client'
import * as path from 'path'
import * as fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

const wait = (ms) => new Promise(r => setTimeout(r, ms))

// Parse args
const [,, adAccountId, targetBmId, sourceBmId] = process.argv

if (!adAccountId || !targetBmId) {
  console.log(`
Usage: node test-bm-share.mjs <adAccountId> <targetBmId> [sourceBmId]

  adAccountId  - The ad account to share (without act_ prefix)
  targetBmId   - The BM ID to share the ad account TO
  sourceBmId   - (Optional) The BM that OWNS the ad account (for URL navigation)

Example:
  node test-bm-share.mjs 2176590489538801 642431908960424 1595645287677231
`)
  process.exit(1)
}

console.log(`\n🔧 BM Share Test Script`)
console.log(`   Ad Account: ${adAccountId}`)
console.log(`   Target BM:  ${targetBmId}`)
console.log(`   Source BM:  ${sourceBmId || '(not provided — will use default)'}\n`)

async function run() {
  // Step 1: Find an active profile with saved session
  const profiles = await prisma.facebookAutomationProfile.findMany({
    where: { status: 'ACTIVE', isEnabled: true, cookiesBackup: { not: null } },
    orderBy: { lastJobAssignedAt: 'asc' },
  })

  if (profiles.length === 0) {
    console.error('❌ No active profiles with saved sessions found')
    process.exit(1)
  }

  const profile = profiles[0]
  console.log(`✅ Using profile: "${profile.label}" (${profile.id})`)

  // Step 2: Launch browser (HEADED — you can see everything)
  const profileDir = path.join(__dirname, 'data', 'browser-profiles', profile.id)
  await fs.mkdir(profileDir, { recursive: true })

  // Clean stale lock files
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    await fs.rm(path.join(profileDir, f), { force: true }).catch(() => {})
  }

  console.log('🚀 Launching browser (headed mode)...')
  const browser = await puppeteer.launch({
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    userDataDir: profileDir,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1400,900',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--mute-audio',
    ],
    defaultViewport: null,
  })

  const pages = await browser.pages()
  const page = pages[0] || await browser.newPage()

  // Restore cookies
  if (profile.cookiesBackup) {
    const cookies = JSON.parse(profile.cookiesBackup)
    await page.setCookie(...cookies)
    console.log(`🍪 Restored ${cookies.length} cookies`)
  }

  try {
    // Step 3: Verify session
    console.log('🔍 Verifying Facebook session...')
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 })
    const cookies = await page.cookies()
    const cUser = cookies.find(c => c.name === 'c_user')
    if (!cUser) {
      console.error('❌ Not logged in — no c_user cookie. Please login manually in this browser.')
      console.log('   Press Ctrl+C to close when done.')
      await new Promise(() => {}) // Keep browser open
    }
    console.log(`✅ Logged in as FB user: ${cUser.value}`)

    // Step 4: Navigate to Business Settings
    const url = sourceBmId
      ? `https://business.facebook.com/latest/settings/ad_accounts/?business_id=${sourceBmId}`
      : `https://business.facebook.com/latest/settings/ad_accounts/`

    console.log(`📄 Navigating to: ${url}`)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 })
    await wait(5000)
    console.log('✅ Business Settings loaded')

    // Step 5: Search for the ad account
    console.log(`🔎 Searching for ad account ${adAccountId}...`)

    // Try search box
    const searchInput = await page.$('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], input[aria-label*="Search"]')
    if (searchInput) {
      await searchInput.click()
      await searchInput.type(adAccountId)
      await wait(3000)
      console.log('   Typed in search box, waiting for results...')

      // Click first result in the left sidebar
      const clicked = await page.evaluate(() => {
        const items = document.querySelectorAll('a, [role="row"], [role="listitem"], [role="link"]')
        for (const item of items) {
          const rect = item.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0 && rect.left < 600 && rect.top > 100) {
            item.click()
            return item.textContent?.trim()?.substring(0, 50)
          }
        }
        return null
      })
      if (clicked) {
        console.log(`✅ Clicked: "${clicked}"`)
      } else {
        console.log('⚠️  No search result found to click. Check the browser.')
      }
    } else {
      console.log('⚠️  Search input not found. Try finding the account manually in the browser.')
    }

    await wait(3000)

    // Step 6: Click "Assign partner"
    console.log('🔘 Looking for "Assign partner" button...')
    const assignBtn = await findButton(page, ['Assign partner', 'Assign Partner', 'Assign partners'])
    if (assignBtn) {
      await assignBtn.click()
      console.log('✅ Clicked "Assign partner"')
      await wait(4000)
    } else {
      console.log('⚠️  "Assign partner" button not found. Check the browser.')
      console.log('   You may need to scroll down or click the account first.')
      await waitForInput('Press Enter when ready to continue...')
    }

    // Step 7: Enter BM ID
    console.log(`📝 Entering BM ID: ${targetBmId}`)
    const bmInput = await findDialogInput(page)
    if (bmInput) {
      await bmInput.click({ clickCount: 3 })
      await bmInput.type(targetBmId)
      await wait(3000)
      console.log('✅ BM ID entered, waiting for autocomplete...')

      // Try to click the matching result
      const resultClicked = await page.evaluate((bmId) => {
        const elements = document.querySelectorAll('div, span, [role="option"], [role="listitem"]')
        for (const el of elements) {
          if (el.textContent?.includes(bmId)) {
            const rect = el.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
              el.click()
              return true
            }
          }
        }
        return false
      }, targetBmId)

      if (resultClicked) {
        console.log('✅ Selected BM from autocomplete')
      } else {
        await bmInput.press('Enter')
        console.log('⏎ Pressed Enter (no autocomplete match found)')
      }
      await wait(2000)
    } else {
      console.log('⚠️  BM ID input not found. Check the browser.')
      await waitForInput('Press Enter when ready to continue...')
    }

    // Step 8: Enable permissions
    console.log('🔧 Enabling permissions...')
    const toggleLabels = ['Manage campaigns', 'View performance', 'Manage Creative Hub']
    for (const label of toggleLabels) {
      const result = await page.evaluate((labelText) => {
        const allEls = document.querySelectorAll('span, div, label, p')
        for (const el of allEls) {
          if (el.textContent?.trim().includes(labelText)) {
            const parent = el.closest('[role="row"], [role="listitem"], div') || el.parentElement
            if (!parent) continue
            const toggle = parent.querySelector('[role="switch"], [aria-checked], input[type="checkbox"]')
            if (toggle) {
              const isOn = toggle.getAttribute('aria-checked') === 'true' || toggle.checked === true
              if (!isOn) {
                toggle.click()
                return `✅ Enabled: ${labelText}`
              }
              return `  Already on: ${labelText}`
            }
          }
        }
        return `⚠️  Not found: ${labelText}`
      }, label)
      console.log(`   ${result}`)
      await wait(500)
    }

    // Step 9: Click Assign/Save
    console.log('💾 Looking for Assign/Save button...')
    const saveBtn = await findButton(page, ['Assign', 'Save changes', 'Save Changes', 'Confirm', 'Save', 'Done'])
    if (saveBtn) {
      const btnText = await page.evaluate(el => el.textContent?.trim(), saveBtn)
      console.log(`✅ Found button: "${btnText}"`)
      await waitForInput(`Press Enter to click "${btnText}" and complete the share...`)
      await saveBtn.click()
      await wait(5000)
      console.log('🎉 Done! Check the browser for the result.')
    } else {
      // Dump all visible buttons for debugging
      const buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, [role="button"]'))
          .map(b => `"${b.textContent?.trim()}"`)
          .filter(Boolean)
          .join(', ')
      })
      console.log(`⚠️  No Assign/Save button found.`)
      console.log(`   Visible buttons: ${buttons}`)
    }

    console.log('\n📸 Browser is still open. Inspect the result manually.')
    console.log('   Press Ctrl+C to close.\n')
    await new Promise(() => {}) // Keep browser open

  } catch (err) {
    console.error('❌ Error:', err.message)
    console.log('\n   Browser is still open. You can inspect the state.')
    console.log('   Press Ctrl+C to close.\n')
    await new Promise(() => {})
  }
}

// Helper: find a button by text
async function findButton(page, texts) {
  for (const text of texts) {
    const btn = await page.evaluateHandle((searchText) => {
      const buttons = document.querySelectorAll('button, [role="button"], a')
      for (const b of buttons) {
        const t = b.textContent?.trim() || ''
        if (t === searchText) {
          const rect = b.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) return b
        }
      }
      // Partial match
      for (const b of buttons) {
        const t = b.textContent?.trim() || ''
        if (t.includes(searchText) && t.length < searchText.length + 20) {
          const rect = b.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) return b
        }
      }
      return null
    }, text)
    const isNull = await page.evaluate(el => el === null, btn)
    if (!isNull) return btn
  }
  return null
}

// Helper: find input inside dialog
async function findDialogInput(page) {
  const input = await page.evaluateHandle(() => {
    const dialogSels = ['[role="dialog"]', '[aria-modal="true"]', '[class*="modal"]', '[class*="dialog"]']
    for (const sel of dialogSels) {
      const dialog = document.querySelector(sel)
      if (dialog) {
        const inp = dialog.querySelector('input[type="text"], input[type="search"], input:not([type="hidden"]):not([type="checkbox"])')
        if (inp) {
          const rect = inp.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) return inp
        }
      }
    }
    // Fallback: last visible input
    const allInputs = document.querySelectorAll('input[type="text"], input[type="search"]')
    for (let i = allInputs.length - 1; i >= 0; i--) {
      const rect = allInputs[i].getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) return allInputs[i]
    }
    return null
  })
  const isNull = await page.evaluate(el => el === null, input)
  return isNull ? null : input
}

// Helper: wait for user input
function waitForInput(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt)
    process.stdin.once('data', () => resolve())
  })
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
