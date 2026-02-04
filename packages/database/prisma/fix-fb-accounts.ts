import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing Facebook ad account IDs (removing act_ prefix)...\n')

  const accountIds = [
    'act_1611312900291315',
    'act_1414669130312236',
    'act_670477596061712',
    'act_1458794105670936',
    'act_710595721986070'
  ]

  for (const oldId of accountIds) {
    const newId = oldId.replace('act_', '')

    const updated = await prisma.adAccount.updateMany({
      where: { accountId: oldId },
      data: { accountId: newId }
    })

    if (updated.count > 0) {
      console.log(`✅ Updated: ${oldId} → ${newId}`)
    } else {
      console.log(`⚠️  Not found: ${oldId}`)
    }
  }

  console.log('\n🎉 Done!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
