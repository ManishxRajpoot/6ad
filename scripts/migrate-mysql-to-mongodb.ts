/**
 * Migration Script: MySQL (sixad_db) to MongoDB (6AD Platform)
 *
 * Run with: npx ts-node scripts/migrate-mysql-to-mongodb.ts
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'

// Load environment variables from apps/api/.env
config({ path: '/Users/manishrajpoot/Coinest_Share/6ad/apps/api/.env' })

const prisma = new PrismaClient()

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
      const plainPassword = String(user.pass || '12345678')
      const hashedPassword = await bcrypt.hash(plainPassword, 10)

      const newUser = await prisma.user.create({
        data: {
          email: user.email,
          username: user.username || user.name,
          password: hashedPassword,
          plaintextPassword: plainPassword,
          role: mapUserRole(user.type),
          walletBalance: user.balance || 0,
          phone: user.mobile ? String(user.mobile) : null,
          phone2: user.contact1 ? String(user.contact1) : null,
          realName: user.name,

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

      userIdMap.set(user.id, newUser.id)
      console.log(`  ✅ User: ${user.email} (${mapUserRole(user.type)})`)
    } catch (error: any) {
      if (error.code === 'P2002') {
        const existing = await prisma.user.findUnique({ where: { email: user.email } })
        if (existing) {
          userIdMap.set(user.id, existing.id)
          console.log(`  ⚠️ User exists: ${user.email}`)
        }
      } else {
        console.error(`  ❌ Failed to migrate user ${user.email}:`, error.message)
      }
    }
  }
}

async function migrateFbApplications(applications: OldFbAds[]) {
  console.log(`\n📦 Migrating ${applications.length} FB ad applications...`)

  for (const app of applications) {
    const userId = userIdMap.get(app.uid)
    if (!userId) {
      console.log(`  ⚠️ Skipping application ${app.apply_id} - user ${app.uid} not found`)
      continue
    }

    try {
      const newApp = await prisma.adAccountApplication.create({
        data: {
          applyId: app.apply_id,
          platform: 'FACEBOOK',
          userId,

          licenseNo: app.license_name,
          pageUrls: app.page,
          isApp: app.is_app === 'Yes' ? app.app_ids : null,
          shopifyShop: app.shopify_shop === 'Yes',

          adAccountQty: 1,
          depositAmount: app.ads_total_deposit,
          platformFee: app.commission || 0,
          openingFee: app.opening_fee || 0,
          totalCost: app.total_cost,

          status: mapStatus(app.status),
          adminRemarks: app.remark || null,

          createdAt: new Date(app.create_time),
          updatedAt: app.updated_at ? new Date(app.updated_at) : new Date(app.create_time),
        }
      })

      applicationIdMap.set(app.id, newApp.id)
      console.log(`  ✅ Application: ${app.apply_id} (${app.status})`)
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`  ⚠️ Application exists: ${app.apply_id}`)
      } else {
        console.error(`  ❌ Failed to migrate application ${app.apply_id}:`, error.message)
      }
    }
  }
}

async function migrateFbAccounts(accounts: OldFbAccountList[]) {
  console.log(`\n📦 Migrating ${accounts.length} FB ad accounts...`)

  for (const acc of accounts) {
    const userId = userIdMap.get(acc.uid)
    const applicationId = applicationIdMap.get(acc.fb_ads_id)

    if (!userId) {
      console.log(`  ⚠️ Skipping account ${acc.ads_account_id} - user ${acc.uid} not found`)
      continue
    }

    try {
      const newAccount = await prisma.adAccount.create({
        data: {
          platform: 'FACEBOOK',
          accountId: acc.ads_account_id || `PENDING_${acc.id}`,
          accountName: acc.ads_account_name,
          timezone: acc.timezone,

          userId,
          applicationId: applicationId || undefined,

          totalDeposit: acc.deposit,
          balance: acc.deposit,

          status: acc.ads_account_id ? 'APPROVED' : 'PENDING',

          createdAt: new Date(acc.create_time),
        }
      })

      accountIdMap.set(acc.id, newAccount.id)
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
      await prisma.deposit.create({
        data: {
          applyId: `WD${dep.apply_id}`,
          userId,
          amount: parseFloat(dep.charge),
          paymentMethod: dep.payway,
          transactionId: dep.trans_id,
          paymentProof: dep.image || null,
          status: mapStatus(dep.status),
          adminRemarks: dep.remove_reason || null,

          createdAt: new Date(dep.create_time),
        }
      })

      console.log(`  ✅ Deposit: $${dep.charge} via ${dep.payway} (${dep.status})`)
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`  ⚠️ Deposit exists: ${dep.apply_id}`)
      } else {
        console.error(`  ❌ Failed to migrate deposit ${dep.apply_id}:`, error.message)
      }
    }
  }
}

async function migrateAccountDeposits(deposits: OldSocialDeposit[], fbAccounts: OldFbAccountList[]) {
  console.log(`\n📦 Migrating ${deposits.length} account deposits...`)

  // Create a lookup for fb_account_list by fb_ads_id to get account mapping
  const fbAdsToAccount = new Map<number, number>()
  for (const acc of fbAccounts) {
    fbAdsToAccount.set(acc.fb_ads_id, acc.id)
  }

  for (const dep of deposits) {
    // Try to find the adAccount in our new system
    // The old system stores apply_id which corresponds to fb_ads.apply_id
    // We need to find the account via fb_account_list

    const oldAccountId = parseInt(dep.ad_id)
    const newAccountId = accountIdMap.get(oldAccountId)

    if (!newAccountId) {
      console.log(`  ⚠️ Skipping account deposit ${dep.apply_id} - account ${dep.ad_id} not found`)
      continue
    }

    try {
      await prisma.accountDeposit.create({
        data: {
          adAccountId: newAccountId,
          amount: parseFloat(dep.charge),
          status: mapStatus(dep.status),

          createdAt: new Date(dep.create_time),
          updatedAt: dep.updated_at ? new Date(dep.updated_at) : new Date(dep.create_time),
        }
      })

      console.log(`  ✅ Account Deposit: $${dep.charge} to account (${dep.status})`)
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate account deposit ${dep.apply_id}:`, error.message)
    }
  }
}

async function main() {
  console.log('🚀 Starting MySQL to MongoDB Migration')
  console.log('=====================================\n')

  const sqlPath = '/Users/manishrajpoot/Coinest_Share/sixad_db.sql'
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

  console.log(`  Users: ${users.length}`)
  console.log(`  FB Applications: ${fbAds.length}`)
  console.log(`  FB Accounts: ${fbAccounts.length}`)
  console.log(`  Wallet Deposits: ${walletDeposits.length}`)
  console.log(`  Account Deposits: ${socialDeposits.length}`)

  // Migrate in order
  await migrateUsers(users)
  await migrateFbApplications(fbAds)
  await migrateFbAccounts(fbAccounts)
  await migrateWalletDeposits(walletDeposits)
  await migrateAccountDeposits(socialDeposits, fbAccounts)

  console.log('\n=====================================')
  console.log('✅ Migration completed!')
  console.log(`  Users migrated: ${userIdMap.size}`)
  console.log(`  Applications migrated: ${applicationIdMap.size}`)
  console.log(`  Accounts migrated: ${accountIdMap.size}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Migration failed:', error)
  prisma.$disconnect()
  process.exit(1)
})
