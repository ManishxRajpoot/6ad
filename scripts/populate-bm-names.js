/**
 * One-time script: Fetch BM names from Facebook Graph API for all ad accounts
 * Run on VPS: cd /home/6ad && node scripts/populate-bm-names.js
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Get all profiles with tokens
  const profiles = await prisma.facebookAutomationProfile.findMany({
    where: { fbAccessToken: { not: null } },
    select: { id: true, label: true, fbAccessToken: true, managedAdAccountIds: true }
  })
  console.log(`Found ${profiles.length} profiles with tokens`)

  // Get all ad accounts that don't have sourceBmName yet
  const accounts = await prisma.adAccount.findMany({
    where: {
      platform: 'FACEBOOK',
      accountId: { not: '' }
    },
    select: { id: true, accountId: true, accountName: true, extensionProfileId: true, sourceBmName: true }
  })
  console.log(`Found ${accounts.length} accounts without BM name`)

  // Build a map: profileId -> token
  const tokenMap = new Map()
  const accountToProfile = new Map()
  for (const p of profiles) {
    tokenMap.set(p.id, p.fbAccessToken)
    for (const accId of p.managedAdAccountIds) {
      if (!accountToProfile.has(accId)) accountToProfile.set(accId, p.id)
    }
  }

  let updated = 0
  let failed = 0
  for (const acc of accounts) {
    if (acc.sourceBmName) continue // already populated
    // Find a token: prefer extensionProfileId, fallback to managedAdAccountIds lookup
    const profileId = acc.extensionProfileId || accountToProfile.get(acc.accountId)
    const token = profileId ? tokenMap.get(profileId) : null
    if (!token) {
      console.log(`  SKIP ${acc.accountId} (${acc.accountName}) - no token`)
      continue
    }

    try {
      const url = `https://graph.facebook.com/v21.0/act_${acc.accountId}?fields=business{id,name}&access_token=${token}`
      const res = await fetch(url)
      const data = await res.json()

      if (data.business && data.business.name) {
        await prisma.adAccount.update({
          where: { id: acc.id },
          data: { sourceBmName: data.business.name, sourceBmId: data.business.id }
        })
        console.log(`  ✓ ${acc.accountId} (${acc.accountName}) -> BM: ${data.business.name} (${data.business.id})`)
        updated++
      } else if (data.error) {
        console.log(`  ✗ ${acc.accountId} (${acc.accountName}) -> FB error: ${data.error.message}`)
        failed++
      } else {
        console.log(`  ? ${acc.accountId} (${acc.accountName}) -> No BM in response`)
        failed++
      }

      // Rate limit: 200ms between requests
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.log(`  ✗ ${acc.accountId} (${acc.accountName}) -> ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
