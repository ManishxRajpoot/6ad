import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '/Users/manishrajpoot/Coinest_Share/6ad/apps/api/.env' })

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.count()
  const applications = await prisma.adAccountApplication.count()
  const accounts = await prisma.adAccount.count()
  const deposits = await prisma.deposit.count()
  const accountDeposits = await prisma.accountDeposit.count()

  console.log('📊 Current Database Totals:')
  console.log('  Users:', users)
  console.log('  Applications:', applications)
  console.log('  Ad Accounts:', accounts)
  console.log('  Wallet Deposits:', deposits)
  console.log('  Account Deposits:', accountDeposits)

  await prisma.$disconnect()
}

main()
