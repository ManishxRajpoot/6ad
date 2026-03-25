/**
 * Populate BM names from Cheetah API for all ad accounts
 * Run on VPS: cd /home/6ad && node scripts/populate-bm-names-cheetah.js
 */
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const prisma = new PrismaClient()

const CHEETAH = {
  appid: 'wvLY386',
  secret: '7fd454af-84f1-4e62-9130-4989181063ed',
  baseUrl: 'https://open-api.cmcm.com',
}

function generateSign(params, secret) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  return crypto.createHash('md5').update(sorted + secret).digest('hex')
}

async function cheetahRequest(path, params = {}) {
  const allParams = { ...params, appid: CHEETAH.appid, ts: Math.floor(Date.now() / 1000) }
  allParams.sign = generateSign(allParams, CHEETAH.secret)
  const qs = Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  const res = await fetch(`${CHEETAH.baseUrl}${path}?${qs}`)
  return res.json()
}

async function main() {
  // First, let's see what a single account looks like
  const testAccounts = await prisma.adAccount.findMany({
    where: { platform: 'FACEBOOK', accountId: { not: '' }, sourceBmId: 'cheetah' },
    take: 3,
    select: { id: true, accountId: true, accountName: true }
  })

  if (testAccounts.length > 0) {
    console.log('Testing with account:', testAccounts[0].accountId)
    const result = await cheetahRequest('/v1/facebook-account-single', { account_id: testAccounts[0].accountId })
    console.log('Full Cheetah response:', JSON.stringify(result, null, 2))
  }

  // Now fetch all cheetah accounts
  const accounts = await prisma.adAccount.findMany({
    where: { platform: 'FACEBOOK', accountId: { not: '' } },
    select: { id: true, accountId: true, accountName: true, sourceBmName: true }
  })
  console.log(`\nProcessing ${accounts.length} accounts...`)

  let updated = 0
  let failed = 0
  for (const acc of accounts) {
    if (acc.sourceBmName) continue

    try {
      const result = await cheetahRequest('/v1/facebook-account-single', { account_id: acc.accountId })
      if (result.code === 0 && result.data?.length > 0) {
        const d = result.data[0]
        const bmName = d.company_en || d.company_cn || null
        const oeId = d.oe_id || null
        if (bmName) {
          await prisma.adAccount.update({
            where: { id: acc.id },
            data: {
              sourceBmName: bmName,
              ...(oeId && !acc.sourceBmId ? { sourceBmId: oeId } : {})
            }
          })
          console.log(`  ✓ ${acc.accountId} (${acc.accountName}) -> BM: ${bmName}`)
          updated++
        } else {
          console.log(`  ? ${acc.accountId} (${acc.accountName}) -> No BM name in Cheetah (company_en=${d.company_en}, company_cn=${d.company_cn})`)
          failed++
        }
      } else {
        console.log(`  ✗ ${acc.accountId} (${acc.accountName}) -> Not in Cheetah`)
        failed++
      }
      await new Promise(r => setTimeout(r, 100))
    } catch (err) {
      console.log(`  ✗ ${acc.accountId} -> ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed/skipped`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
