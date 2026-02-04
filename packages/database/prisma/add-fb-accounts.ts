import { PrismaClient, Platform, AccountStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Finding demo_user...')

  const demoUser = await prisma.user.findFirst({
    where: { username: 'demo_user' }
  })

  if (!demoUser) {
    console.error('❌ demo_user not found!')
    return
  }

  console.log(`✅ Found demo_user: ${demoUser.email} (ID: ${demoUser.id})`)

  // Facebook Ad Account IDs to add
  const fbAccountIds = [
    '1611312900291315',
    '1414669130312236',
    '670477596061712',
    '1458794105670936',
    '710595721986070'
  ]

  console.log(`\n📊 Adding ${fbAccountIds.length} Facebook ad accounts...`)

  for (let i = 0; i < fbAccountIds.length; i++) {
    const accountId = fbAccountIds[i]

    // Check if account already exists
    const existing = await prisma.adAccount.findFirst({
      where: { accountId: `act_${accountId}` }
    })

    if (existing) {
      console.log(`⚠️  Account act_${accountId} already exists, skipping...`)
      continue
    }

    const adAccount = await prisma.adAccount.create({
      data: {
        platform: Platform.FACEBOOK,
        accountId: `act_${accountId}`,
        accountName: `FB Ad Account ${i + 1}`,
        licenseName: 'Demo License',
        bmId: '987654321',
        timezone: 'Asia/Kolkata',
        status: AccountStatus.APPROVED,
        totalDeposit: Math.floor(Math.random() * 5000) + 1000,
        totalSpend: Math.floor(Math.random() * 3000) + 500,
        balance: Math.floor(Math.random() * 2000) + 100,
        userId: demoUser.id,
      },
    })

    console.log(`✅ Created: ${adAccount.accountName} (${adAccount.accountId})`)
  }

  console.log('\n🎉 Done! Facebook ad accounts added to demo_user.')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
