/**
 * Migration Script V2: MySQL (sixad_db) to MongoDB (6AD Platform)
 * This version handles existing records and fills in missing data
 *
 * Run with: npx ts-node scripts/migrate-mysql-to-mongodb-v2.ts
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'

// Load environment variables from apps/api/.env
config({ path: '/home/6ad/apps/api/.env' })

const prisma = new PrismaClient()

// Generate unique referral code for migrated users
function generateReferralCode(username: string): string {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  const userPart = (username || 'USR').substring(0, 3).toUpperCase()
  return `${userPart}${randomPart}`
}

// Old MySQL user type mapping
const mapUserRole = (type: number): 'ADMIN' | 'AGENT' | 'USER' => {
  switch (type) {
    case 1: return 'ADMIN'
    case 2: return 'AGENT'
    default: return 'USER'
  }
}

// Status mapping
const mapStatus = (status: string): 'PENDING' | 'APPROVED' | 'REJECTED' => {
  const s = status?.toLowerCase() || 'pending'
  if (s.includes('approved') || s.includes('received')) return 'APPROVED'
  if (s.includes('reject')) return 'REJECTED'
  return 'PENDING'
}

// Old user ID to new MongoDB ID mapping
const userIdMap = new Map<number, string>()
const applicationIdMap = new Map<number, string>()
const accountIdMap = new Map<number, string>()
const applyIdToAppMap = new Map<string, string>() // Map apply_id string to new app id

// Stats
let stats = {
  usersCreated: 0,
  usersExisting: 0,
  applicationsCreated: 0,
  applicationsExisting: 0,
  accountsCreated: 0,
  accountsExisting: 0,
  walletDepositsCreated: 0,
  walletDepositsExisting: 0,
  accountDepositsCreated: 0,
  accountDepositsSkipped: 0,
  bmSharesCreated: 0,
  bmSharesExisting: 0,
  bmSharesSkipped: 0,
}

// ============== TYPES ==============

interface OldUser {
  id: number
  name: string
  email: string
  username: string | null
  facebook_opening_fee: number | null
  facebook_deposit_commission: number | null
  google_opening_fee: number | null
  google_deposit_commission: number | null
  tiktok_opening_fee: number | null
  tiktok_deposit_commission: number | null
  bing_opening_fee: number | null
  bing_deposit_commission: number | null
  snapchat_opening_fee: number | null
  snapchat_deposit_commission: number | null
  balance: number
  mobile: string | null
  contact1: string | null
  contact2: string | null
  remark: string | null
  pass: string
  password: string
  type: number
  created_at: string | null
  ref_id: number
  sts: number
}

interface OldFbAds {
  id: number
  apply_id: string
  license_name: string
  page: string
  shared_page: number
  domain: string
  is_app: string
  app_ids: string | null
  shopify_shop: string
  ad: string | null
  remark: string | null
  status: string
  ads_total_deposit: number
  commission: number | null
  opening_fee: number | null
  total_cost: number
  create_time: string
  uid: number
  updated_at: string | null
}

interface OldFbAccountList {
  id: number
  ads_account_id: string | null
  ads_account_name: string
  timezone: string
  deposit: number
  commission: number | null
  create_time: string
  fb_ads_id: number
  uid: number
}

interface OldSocialDeposit {
  id: number
  apply_id: string
  ad_id: string
  user_id: number
  charge: string
  commission: number | null
  total: string
  status: string
  create_time: string
  social_name: string
  uid: number
  type: number
  updated_at: string | null
}

interface OldWalletAddMoney {
  id: number
  apply_id: string
  charge: string
  trans_id: string
  image: string
  payway: string
  create_time: string
  status: string
  uid: number
  remove_reason: string | null
}

interface OldFbBmShare {
  id: number
  bm_id: string
  create_time: string
  fb_ads_account_id: number
  status: string
  uid: number
}

interface OldGoogleAdShare {
  id: number
  share_gmail: string | null
  create_time: string
  google_ad_id: number
  status: string
  uid: number
}

interface OldTtBmShare {
  id: number
  bm_id: string | null
  create_time: string
  tt_ads_account_id: number
  status: string
  uid: number
}

interface OldBingBmShare {
  id: number
  bm_id: string | null
  create_time: string
  bing_ads_account_id: number
  status: string
  uid: number
}

interface OldSnapBmShare {
  id: number
  bm_id: string | null
  create_time: string
  snap_ads_account_id: number
  status: string
  uid: number
}

// Parse SQL INSERT statements
function parseInsertStatements(sql: string, tableName: string): any[] {
  const regex = new RegExp(`INSERT INTO \`${tableName}\`[^;]+;`, 'gis')
  const matches = sql.match(regex)
  if (!matches) return []

  const results: any[] = []

  for (const match of matches) {
    const colMatch = match.match(/\(`([^)]+)`\)\s+VALUES/i)
    if (!colMatch) continue
    const columns = colMatch[1].split('`, `')

    const valuesSection = match.substring(match.indexOf('VALUES') + 6)

    let depth = 0
    let inString = false
    let escapeNext = false
    let currentValue = ''
    const valueSets: string[] = []

    for (let i = 0; i < valuesSection.length; i++) {
      const char = valuesSection[i]

      if (escapeNext) {
        currentValue += char
        escapeNext = false
        continue
      }

      if (char === '\\') {
        escapeNext = true
        currentValue += char
        continue
      }

      if (char === "'" && !escapeNext) {
        inString = !inString
        currentValue += char
        continue
      }

      if (!inString) {
        if (char === '(') {
          depth++
          if (depth === 1) {
            currentValue = ''
            continue
          }
        } else if (char === ')') {
          depth--
          if (depth === 0) {
            valueSets.push(currentValue)
            continue
          }
        }
      }

      currentValue += char
    }

    for (const valueSet of valueSets) {
      const values = parseCSVLine(valueSet)
      if (values.length === columns.length) {
        const obj: any = {}
        columns.forEach((col, i) => {
          let val = values[i]
          if (val === 'NULL' || val === 'null') {
            obj[col] = null
          } else if (val.match(/^-?\d+$/)) {
            obj[col] = parseInt(val)
          } else if (val.match(/^-?\d+\.\d+$/)) {
            obj[col] = parseFloat(val)
          } else {
            obj[col] = val
          }
        })
        results.push(obj)
      }
    }
  }

  return results
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  let escapeNext = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (escapeNext) {
      if (char === 'n') current += '\n'
      else if (char === 'r') current += '\r'
      else if (char === 't') current += '\t'
      else current += char
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (char === "'" && !escapeNext) {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

async function migrateUsers(users: OldUser[]) {
  console.log(`\n📦 Migrating ${users.length} users...`)

  for (const user of users) {
    try {
      // First check if user already exists
      const existing = await prisma.user.findUnique({ where: { email: user.email } })

      if (existing) {
        userIdMap.set(user.id, existing.id)
        stats.usersExisting++
        continue
      }

      const plainPassword = String(user.pass || '12345678')
      const hashedPassword = await bcrypt.hash(plainPassword, 10)
      const username = user.username || String(user.name)

      // Retry with different referral codes in case of collision
      let retries = 5
      let newUser: any = null
      while (retries > 0) {
        const referralCode = generateReferralCode(username)
        try {
          newUser = await prisma.user.create({
            data: {
              email: user.email,
              username,
              password: hashedPassword,
              plaintextPassword: plainPassword,
              role: mapUserRole(user.type),
              walletBalance: user.balance || 0,
              phone: user.mobile ? String(user.mobile) : null,
              phone2: user.contact1 ? String(user.contact1) : null,
              realName: user.name ? String(user.name) : null,
              referralCode,

              // Commission settings - map old fields to new
              fbFee: user.facebook_opening_fee || 30,
              fbCommission: user.facebook_deposit_commission || 5,
              googleFee: user.google_opening_fee || 30,
              googleCommission: user.google_deposit_commission || 5,
              tiktokFee: user.tiktok_opening_fee || 30,
              tiktokCommission: user.tiktok_deposit_commission || 5,
              bingFee: user.bing_opening_fee || 30,
              bingCommission: user.bing_deposit_commission || 5,
              snapchatFee: user.snapchat_opening_fee || 30,
              snapchatCommission: user.snapchat_deposit_commission || 5,

              status: user.sts === 1 ? 'ACTIVE' : 'BLOCKED',
              emailVerified: true,
              twoFactorEnabled: false,

              createdAt: user.created_at ? new Date(user.created_at) : new Date(),
            }
          })
          break // Success, exit retry loop
        } catch (err: any) {
          if (err?.message?.includes('referralCode') && retries > 1) {
            retries--
            continue // Retry with new code
          }
          throw err // Re-throw non-referralCode errors or final retry
        }
      }

      if (newUser) {
        userIdMap.set(user.id, newUser.id)
        stats.usersCreated++
        console.log(`  ✅ User: ${user.email} (${mapUserRole(user.type)})`)
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate user ${user.email}:`, error.message)
    }
  }
}

async function migrateFbApplications(applications: OldFbAds[]) {
  console.log(`\n📦 Migrating ${applications.length} FB ad applications...`)

  for (const app of applications) {
    const userId = userIdMap.get(app.uid)
    if (!userId) {
      // Try to find user by looking up in database
      console.log(`  ⚠️ User ${app.uid} not in map for application ${app.apply_id}, skipping...`)
      continue
    }

    try {
      // Check if application already exists by applyId
      const existing = await prisma.adAccountApplication.findFirst({
        where: { applyId: app.apply_id }
      })

      if (existing) {
        applicationIdMap.set(app.id, existing.id)
        applyIdToAppMap.set(app.apply_id, existing.id)
        stats.applicationsExisting++
        continue
      }

      const newApp = await prisma.adAccountApplication.create({
        data: {
          applyId: String(app.apply_id),
          platform: 'FACEBOOK',
          userId,

          licenseNo: app.license_name ? String(app.license_name) : null,
          pageUrls: app.page ? String(app.page) : null,
          isApp: app.is_app === 'Yes' && app.app_ids ? String(app.app_ids) : null,
          shopifyShop: app.shopify_shop === 'Yes',

          adAccountQty: 1,
          depositAmount: app.ads_total_deposit || 0,
          platformFee: app.commission || 0,
          openingFee: app.opening_fee || 0,
          totalCost: app.total_cost || 0,

          status: mapStatus(app.status),
          adminRemarks: app.remark ? String(app.remark) : null,

          createdAt: new Date(app.create_time),
          updatedAt: app.updated_at ? new Date(app.updated_at) : new Date(app.create_time),
        }
      })

      applicationIdMap.set(app.id, newApp.id)
      applyIdToAppMap.set(app.apply_id, newApp.id)
      stats.applicationsCreated++
      console.log(`  ✅ Application: ${app.apply_id} (${app.status})`)
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate application ${app.apply_id}:`, error.message)
    }
  }
}

async function migrateFbAccounts(accounts: OldFbAccountList[], fbAds: OldFbAds[]) {
  console.log(`\n📦 Migrating ${accounts.length} FB ad accounts...`)

  // Create lookup from fb_ads_id to apply_id
  const fbAdsIdToApplyId = new Map<number, string>()
  for (const ad of fbAds) {
    fbAdsIdToApplyId.set(ad.id, ad.apply_id)
  }

  for (const acc of accounts) {
    const userId = userIdMap.get(acc.uid)

    // Get applicationId either from our map or by looking up the apply_id
    let applicationId = applicationIdMap.get(acc.fb_ads_id)
    if (!applicationId) {
      // Try to find via apply_id
      const applyId = fbAdsIdToApplyId.get(acc.fb_ads_id)
      if (applyId) {
        applicationId = applyIdToAppMap.get(applyId)
      }
    }

    if (!userId) {
      console.log(`  ⚠️ Skipping account ${acc.ads_account_id} - user ${acc.uid} not found`)
      continue
    }

    try {
      // Check if account already exists
      const accountIdStr = acc.ads_account_id ? String(acc.ads_account_id) : `PENDING_${acc.id}`
      const accountNameStr = acc.ads_account_name ? String(acc.ads_account_name) : `Account_${acc.id}`
      const existing = await prisma.adAccount.findFirst({
        where: {
          OR: [
            { accountId: accountIdStr },
            { accountName: accountNameStr, userId }
          ]
        }
      })

      if (existing) {
        accountIdMap.set(acc.id, existing.id)
        stats.accountsExisting++
        continue
      }

      const newAccount = await prisma.adAccount.create({
        data: {
          platform: 'FACEBOOK',
          accountId: accountIdStr,
          accountName: accountNameStr,
          timezone: acc.timezone ? String(acc.timezone) : 'UTC',

          userId,
          applicationId: applicationId || undefined,

          totalDeposit: acc.deposit || 0,
          balance: acc.deposit || 0,

          status: acc.ads_account_id ? 'APPROVED' : 'PENDING',

          createdAt: new Date(acc.create_time),
        }
      })

      accountIdMap.set(acc.id, newAccount.id)
      stats.accountsCreated++
      console.log(`  ✅ Account: ${acc.ads_account_name} (${acc.ads_account_id || 'pending'})`)
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate account ${acc.ads_account_name}:`, error.message)
    }
  }
}

async function migrateWalletDeposits(deposits: OldWalletAddMoney[]) {
  console.log(`\n📦 Migrating ${deposits.length} wallet deposits...`)

  for (const dep of deposits) {
    const userId = userIdMap.get(dep.uid)
    if (!userId) {
      console.log(`  ⚠️ Skipping deposit ${dep.apply_id} - user ${dep.uid} not found`)
      continue
    }

    try {
      const applyId = `WD${dep.apply_id}`

      // Check if deposit already exists
      const existing = await prisma.deposit.findFirst({
        where: { applyId }
      })

      if (existing) {
        stats.walletDepositsExisting++
        continue
      }

      const amount = parseFloat(String(dep.charge)) || 0
      if (amount <= 0) {
        continue // Skip invalid deposits
      }

      await prisma.deposit.create({
        data: {
          applyId,
          userId,
          amount,
          paymentMethod: dep.payway ? String(dep.payway) : 'Unknown',
          transactionId: dep.trans_id ? String(dep.trans_id) : null,
          paymentProof: dep.image ? String(dep.image) : null,
          status: mapStatus(dep.status),
          adminRemarks: dep.remove_reason ? String(dep.remove_reason) : null,

          createdAt: new Date(dep.create_time),
        }
      })

      stats.walletDepositsCreated++
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate deposit ${dep.apply_id}:`, error.message)
    }
  }

  console.log(`  ✅ Created: ${stats.walletDepositsCreated}, Existing: ${stats.walletDepositsExisting}`)
}

async function migrateAccountDeposits(deposits: OldSocialDeposit[], fbAccounts: OldFbAccountList[]) {
  console.log(`\n📦 Migrating ${deposits.length} account deposits...`)

  // Create lookups
  const fbAccountById = new Map<number, OldFbAccountList>()
  for (const acc of fbAccounts) {
    fbAccountById.set(acc.id, acc)
  }

  // Also create a lookup by ads_account_id string
  const adsAccountIdToNewId = new Map<string, string>()
  for (const [oldId, newId] of accountIdMap.entries()) {
    const oldAcc = fbAccountById.get(oldId)
    if (oldAcc?.ads_account_id) {
      adsAccountIdToNewId.set(String(oldAcc.ads_account_id), newId)
    }
  }

  for (const dep of deposits) {
    // Try multiple ways to find the account
    let newAccountId: string | undefined

    // Method 1: Direct ID mapping (ad_id is the old fb_account_list.id)
    const oldAccountId = parseInt(String(dep.ad_id))
    if (!isNaN(oldAccountId)) {
      newAccountId = accountIdMap.get(oldAccountId)
    }

    // Method 2: Try ad_id as string (might be the ads_account_id)
    if (!newAccountId && dep.ad_id) {
      newAccountId = adsAccountIdToNewId.get(String(dep.ad_id))
    }

    // Method 3: Look up in database by account ID string
    if (!newAccountId && dep.ad_id) {
      const dbAccount = await prisma.adAccount.findFirst({
        where: { accountId: String(dep.ad_id) }
      })
      if (dbAccount) {
        newAccountId = dbAccount.id
      }
    }

    // Method 4: If we have the old account data, try to create the account
    if (!newAccountId && !isNaN(oldAccountId)) {
      const oldAcc = fbAccountById.get(oldAccountId)
      if (oldAcc) {
        const userId = userIdMap.get(oldAcc.uid)
        if (userId) {
          try {
            const accountIdStr = oldAcc.ads_account_id ? String(oldAcc.ads_account_id) : `PENDING_${oldAcc.id}`
            const accountNameStr = oldAcc.ads_account_name ? String(oldAcc.ads_account_name) : `Account_${oldAcc.id}`

            // Check if exists
            const existing = await prisma.adAccount.findFirst({
              where: { OR: [{ accountId: accountIdStr }, { accountName: accountNameStr, userId }] }
            })

            if (existing) {
              newAccountId = existing.id
              accountIdMap.set(oldAcc.id, existing.id)
            } else {
              const newAccount = await prisma.adAccount.create({
                data: {
                  platform: 'FACEBOOK',
                  accountId: accountIdStr,
                  accountName: accountNameStr,
                  timezone: oldAcc.timezone ? String(oldAcc.timezone) : 'UTC',
                  userId,
                  totalDeposit: oldAcc.deposit || 0,
                  balance: oldAcc.deposit || 0,
                  status: oldAcc.ads_account_id ? 'APPROVED' : 'PENDING',
                  createdAt: new Date(oldAcc.create_time),
                }
              })
              newAccountId = newAccount.id
              accountIdMap.set(oldAcc.id, newAccount.id)
              stats.accountsCreated++
              console.log(`  ✅ Created missing account: ${accountNameStr}`)
            }
          } catch (err: any) {
            // Ignore creation errors
          }
        }
      }
    }

    if (!newAccountId) {
      stats.accountDepositsSkipped++
      continue
    }

    try {
      // Check for duplicate
      const existingCount = await prisma.accountDeposit.count({
        where: {
          adAccountId: newAccountId,
          amount: parseFloat(dep.charge),
          createdAt: new Date(dep.create_time)
        }
      })

      if (existingCount > 0) {
        continue
      }

      await prisma.accountDeposit.create({
        data: {
          adAccountId: newAccountId,
          amount: parseFloat(String(dep.charge)),
          status: mapStatus(dep.status),

          createdAt: new Date(dep.create_time),
          updatedAt: dep.updated_at ? new Date(dep.updated_at) : new Date(dep.create_time),
        }
      })

      stats.accountDepositsCreated++
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate account deposit ${dep.apply_id}:`, error.message)
    }
  }

  console.log(`  ✅ Created: ${stats.accountDepositsCreated}, Skipped: ${stats.accountDepositsSkipped}`)
}

async function migrateBmShares(
  fbBmShares: OldFbBmShare[],
  googleShares: OldGoogleAdShare[],
  ttBmShares: OldTtBmShare[],
  bingBmShares: OldBingBmShare[],
  snapBmShares: OldSnapBmShare[],
  fbAccounts: OldFbAccountList[]
) {
  console.log(`\n📦 Migrating BM Share History...`)
  console.log(`  FB BM Shares: ${fbBmShares.length}`)
  console.log(`  Google Shares: ${googleShares.length}`)
  console.log(`  TikTok BM Shares: ${ttBmShares.length}`)
  console.log(`  Bing BM Shares: ${bingBmShares.length}`)
  console.log(`  Snap BM Shares: ${snapBmShares.length}`)

  // Create lookup from fb_account_list id to account details
  const fbAccountById = new Map<number, OldFbAccountList>()
  for (const acc of fbAccounts) {
    fbAccountById.set(acc.id, acc)
  }

  // Generate apply ID for BM share
  const generateApplyId = (platform: string, index: number): string => {
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 10000000).toString().padStart(7, '0')
    return `BM${dateStr}${random}`
  }

  // Migrate FB BM Shares
  console.log(`\n  📋 Processing FB BM Shares...`)
  for (const share of fbBmShares) {
    const userId = userIdMap.get(share.uid)
    if (!userId) {
      stats.bmSharesSkipped++
      continue
    }

    // Get the account info from fb_account_list
    const fbAccount = fbAccountById.get(share.fb_ads_account_id)
    if (!fbAccount) {
      stats.bmSharesSkipped++
      continue
    }

    try {
      // Check if already exists
      const existing = await prisma.bmShareRequest.findFirst({
        where: {
          userId,
          bmId: String(share.bm_id),
          adAccountId: String(fbAccount.ads_account_id || `ACC_${fbAccount.id}`),
        }
      })

      if (existing) {
        stats.bmSharesExisting++
        continue
      }

      const applyId = generateApplyId('FB', share.id)

      await prisma.bmShareRequest.create({
        data: {
          applyId,
          platform: 'FACEBOOK',
          adAccountId: String(fbAccount.ads_account_id || `ACC_${fbAccount.id}`),
          adAccountName: String(fbAccount.ads_account_name || 'Unknown'),
          bmId: String(share.bm_id),
          status: mapStatus(share.status),
          userId,
          createdAt: new Date(share.create_time),
        }
      })

      stats.bmSharesCreated++
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate FB BM share ${share.id}:`, error.message)
    }
  }

  // Migrate Google Shares
  console.log(`  📋 Processing Google Shares...`)
  for (const share of googleShares) {
    const userId = userIdMap.get(share.uid)
    if (!userId || !share.share_gmail) {
      stats.bmSharesSkipped++
      continue
    }

    try {
      // Check if already exists
      const existing = await prisma.bmShareRequest.findFirst({
        where: {
          userId,
          bmId: share.share_gmail,
          platform: 'GOOGLE',
        }
      })

      if (existing) {
        stats.bmSharesExisting++
        continue
      }

      const applyId = generateApplyId('G', share.id)

      await prisma.bmShareRequest.create({
        data: {
          applyId,
          platform: 'GOOGLE',
          adAccountId: `GOOGLE_${share.google_ad_id}`,
          adAccountName: 'Google Ad Account',
          bmId: share.share_gmail,
          status: mapStatus(share.status),
          userId,
          createdAt: new Date(share.create_time),
        }
      })

      stats.bmSharesCreated++
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate Google share ${share.id}:`, error.message)
    }
  }

  // Migrate TikTok BM Shares
  console.log(`  📋 Processing TikTok BM Shares...`)
  for (const share of ttBmShares) {
    const userId = userIdMap.get(share.uid)
    if (!userId || !share.bm_id) {
      stats.bmSharesSkipped++
      continue
    }

    try {
      const existing = await prisma.bmShareRequest.findFirst({
        where: {
          userId,
          bmId: share.bm_id,
          platform: 'TIKTOK',
        }
      })

      if (existing) {
        stats.bmSharesExisting++
        continue
      }

      const applyId = generateApplyId('TT', share.id)

      await prisma.bmShareRequest.create({
        data: {
          applyId,
          platform: 'TIKTOK',
          adAccountId: `TIKTOK_${share.tt_ads_account_id}`,
          adAccountName: 'TikTok Ad Account',
          bmId: share.bm_id,
          status: mapStatus(share.status),
          userId,
          createdAt: new Date(share.create_time),
        }
      })

      stats.bmSharesCreated++
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate TikTok BM share ${share.id}:`, error.message)
    }
  }

  // Migrate Bing BM Shares
  console.log(`  📋 Processing Bing BM Shares...`)
  for (const share of bingBmShares) {
    const userId = userIdMap.get(share.uid)
    if (!userId || !share.bm_id) {
      stats.bmSharesSkipped++
      continue
    }

    try {
      const existing = await prisma.bmShareRequest.findFirst({
        where: {
          userId,
          bmId: share.bm_id,
          platform: 'BING',
        }
      })

      if (existing) {
        stats.bmSharesExisting++
        continue
      }

      const applyId = generateApplyId('BING', share.id)

      await prisma.bmShareRequest.create({
        data: {
          applyId,
          platform: 'BING',
          adAccountId: `BING_${share.bing_ads_account_id}`,
          adAccountName: 'Bing Ad Account',
          bmId: share.bm_id,
          status: mapStatus(share.status),
          userId,
          createdAt: new Date(share.create_time),
        }
      })

      stats.bmSharesCreated++
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate Bing BM share ${share.id}:`, error.message)
    }
  }

  // Migrate Snap BM Shares
  console.log(`  📋 Processing Snap BM Shares...`)
  for (const share of snapBmShares) {
    const userId = userIdMap.get(share.uid)
    if (!userId || !share.bm_id) {
      stats.bmSharesSkipped++
      continue
    }

    try {
      const existing = await prisma.bmShareRequest.findFirst({
        where: {
          userId,
          bmId: share.bm_id,
          platform: 'SNAPCHAT',
        }
      })

      if (existing) {
        stats.bmSharesExisting++
        continue
      }

      const applyId = generateApplyId('SNAP', share.id)

      await prisma.bmShareRequest.create({
        data: {
          applyId,
          platform: 'SNAPCHAT',
          adAccountId: `SNAP_${share.snap_ads_account_id}`,
          adAccountName: 'Snapchat Ad Account',
          bmId: share.bm_id,
          status: mapStatus(share.status),
          userId,
          createdAt: new Date(share.create_time),
        }
      })

      stats.bmSharesCreated++
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate Snap BM share ${share.id}:`, error.message)
    }
  }

  console.log(`\n  ✅ BM Shares - Created: ${stats.bmSharesCreated}, Existing: ${stats.bmSharesExisting}, Skipped: ${stats.bmSharesSkipped}`)
}

async function main() {
  console.log('🚀 Starting MySQL to MongoDB Migration V2')
  console.log('=========================================\n')

  const sqlPath = '/home/6ad/sixad_db.sql'
  console.log(`📄 Reading SQL file: ${sqlPath}`)

  if (!fs.existsSync(sqlPath)) {
    console.error('❌ SQL file not found!')
    console.log('Please place sixad_db.sql in the Coinest_Share folder')
    process.exit(1)
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8')
  console.log(`✅ SQL file loaded (${(sql.length / 1024 / 1024).toFixed(2)} MB)\n`)

  console.log('📊 Parsing SQL data...')
  const users = parseInsertStatements(sql, 'users') as OldUser[]
  const fbAds = parseInsertStatements(sql, 'fb_ads') as OldFbAds[]
  const fbAccounts = parseInsertStatements(sql, 'fb_account_list') as OldFbAccountList[]
  const walletDeposits = parseInsertStatements(sql, 'wallet_add_money') as OldWalletAddMoney[]
  const socialDeposits = parseInsertStatements(sql, 'social_deposit') as OldSocialDeposit[]

  // BM Share tables
  const fbBmShares = parseInsertStatements(sql, 'fb_bm_share') as OldFbBmShare[]
  const googleShares = parseInsertStatements(sql, 'google_ad_share') as OldGoogleAdShare[]
  const ttBmShares = parseInsertStatements(sql, 'tt_bm_share') as OldTtBmShare[]
  const bingBmShares = parseInsertStatements(sql, 'bing_bm_share') as OldBingBmShare[]
  const snapBmShares = parseInsertStatements(sql, 'snap_bm_share') as OldSnapBmShare[]

  console.log(`  Users: ${users.length}`)
  console.log(`  FB Applications: ${fbAds.length}`)
  console.log(`  FB Accounts: ${fbAccounts.length}`)
  console.log(`  Wallet Deposits: ${walletDeposits.length}`)
  console.log(`  Account Deposits: ${socialDeposits.length}`)
  console.log(`  FB BM Shares: ${fbBmShares.length}`)
  console.log(`  Google Shares: ${googleShares.length}`)
  console.log(`  TikTok BM Shares: ${ttBmShares.length}`)
  console.log(`  Bing BM Shares: ${bingBmShares.length}`)
  console.log(`  Snap BM Shares: ${snapBmShares.length}`)

  // First, fix existing users with null referralCode to avoid unique constraint conflicts
  console.log('\n🔧 Fixing existing users with null referralCode...')
  const usersWithNullCode = await prisma.user.findMany({
    where: { referralCode: null },
    select: { id: true, username: true }
  })
  let fixedCount = 0
  for (const u of usersWithNullCode) {
    let retries = 5
    while (retries > 0) {
      try {
        const code = generateReferralCode(u.username || 'USR')
        await prisma.user.update({
          where: { id: u.id },
          data: { referralCode: code }
        })
        fixedCount++
        break
      } catch (err: any) {
        if (err?.message?.includes('referralCode') && retries > 1) {
          retries--
          continue
        }
        console.error(`  ⚠️ Could not fix referralCode for user ${u.id}:`, err.message)
        break
      }
    }
  }
  console.log(`  ✅ Fixed ${fixedCount}/${usersWithNullCode.length} users with null referralCode`)

  // Migrate in order
  await migrateUsers(users)
  await migrateFbApplications(fbAds)
  await migrateFbAccounts(fbAccounts, fbAds)
  await migrateWalletDeposits(walletDeposits)
  await migrateAccountDeposits(socialDeposits, fbAccounts)
  await migrateBmShares(fbBmShares, googleShares, ttBmShares, bingBmShares, snapBmShares, fbAccounts)

  console.log('\n=========================================')
  console.log('✅ Migration V2 completed!')
  console.log('\n📊 Summary:')
  console.log(`  Users: ${stats.usersCreated} created, ${stats.usersExisting} existing (Total mapped: ${userIdMap.size})`)
  console.log(`  Applications: ${stats.applicationsCreated} created, ${stats.applicationsExisting} existing (Total mapped: ${applicationIdMap.size})`)
  console.log(`  Accounts: ${stats.accountsCreated} created, ${stats.accountsExisting} existing (Total mapped: ${accountIdMap.size})`)
  console.log(`  Wallet Deposits: ${stats.walletDepositsCreated} created, ${stats.walletDepositsExisting} existing`)
  console.log(`  Account Deposits: ${stats.accountDepositsCreated} created, ${stats.accountDepositsSkipped} skipped (no matching account)`)
  console.log(`  BM Shares: ${stats.bmSharesCreated} created, ${stats.bmSharesExisting} existing, ${stats.bmSharesSkipped} skipped`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Migration failed:', error)
  prisma.$disconnect()
  process.exit(1)
})
