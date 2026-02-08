import { PrismaClient } from '@prisma/client'
import { generateEmailLogo } from '../utils/image.js'

const prisma = new PrismaClient()

async function backfillEmailLogos() {
  console.log('[BACKFILL] Starting email logo backfill...')

  // Backfill User.emailLogo - fetch all with brandLogo, filter in code
  // (MongoDB may not match `emailLogo: null` for docs where the field doesn't exist)
  const allUsersWithLogo = await prisma.user.findMany({
    where: { brandLogo: { not: null } },
    select: { id: true, brandLogo: true, emailLogo: true, username: true },
  })
  const usersWithLogo = allUsersWithLogo.filter(u => !u.emailLogo)

  console.log(`[BACKFILL] Found ${usersWithLogo.length} users with brandLogo but no emailLogo`)

  let userSuccess = 0
  let userFailed = 0
  for (const user of usersWithLogo) {
    try {
      const emailLogo = await generateEmailLogo(user.brandLogo!)
      if (emailLogo) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailLogo },
        })
        userSuccess++
        console.log(`[BACKFILL] User ${user.username}: OK (${emailLogo.length} chars)`)
      } else {
        userFailed++
        console.warn(`[BACKFILL] User ${user.username}: failed to generate`)
      }
    } catch (err) {
      userFailed++
      console.error(`[BACKFILL] User ${user.username} error:`, err)
    }
  }
  console.log(`[BACKFILL] Users: ${userSuccess} success, ${userFailed} failed`)

  // Backfill CustomDomain.emailLogo - fetch all with brandLogo, filter in code
  const allDomainsWithLogo = await prisma.customDomain.findMany({
    where: { brandLogo: { not: null } },
    select: { id: true, domain: true, brandLogo: true, emailLogo: true },
  })
  const domainsWithLogo = allDomainsWithLogo.filter(d => !d.emailLogo)

  console.log(`[BACKFILL] Found ${domainsWithLogo.length} domains with brandLogo but no emailLogo`)

  let domainSuccess = 0
  let domainFailed = 0
  for (const domain of domainsWithLogo) {
    try {
      const emailLogo = await generateEmailLogo(domain.brandLogo!)
      if (emailLogo) {
        await prisma.customDomain.update({
          where: { id: domain.id },
          data: { emailLogo },
        })
        domainSuccess++
        console.log(`[BACKFILL] Domain ${domain.domain}: OK (${emailLogo.length} chars)`)
      } else {
        domainFailed++
        console.warn(`[BACKFILL] Domain ${domain.domain}: failed to generate`)
      }
    } catch (err) {
      domainFailed++
      console.error(`[BACKFILL] Domain ${domain.domain} error:`, err)
    }
  }
  console.log(`[BACKFILL] Domains: ${domainSuccess} success, ${domainFailed} failed`)

  console.log('[BACKFILL] Complete!')
  await prisma.$disconnect()
}

backfillEmailLogos().catch(console.error)
