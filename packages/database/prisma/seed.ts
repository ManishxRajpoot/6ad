import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create Admin
  const adminPassword = await bcrypt.hash('123456', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@6ad.in' },
    update: {},
    create: {
      email: 'admin@6ad.in',
      password: adminPassword,
      username: 'Admin',
      realName: 'Super Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    }
  })
  console.log('✅ Admin created:', admin.email)

  // Create Agent
  const agentPassword = await bcrypt.hash('123456', 10)
  const agent = await prisma.user.upsert({
    where: { email: 'agent@6ad.in' },
    update: {},
    create: {
      email: 'agent@6ad.in',
      password: agentPassword,
      username: 'TestAgent',
      realName: 'Test Agent',
      role: 'AGENT',
      status: 'ACTIVE',
      fbFee: 3,
      fbCommission: 2,
      googleFee: 3,
      googleCommission: 2,
      tiktokFee: 3,
      tiktokCommission: 2,
      snapchatFee: 3,
      snapchatCommission: 2,
      bingFee: 3,
      bingCommission: 2,
      creatorId: admin.id,
    }
  })
  console.log('✅ Agent created:', agent.email)

  // Create User
  const userPassword = await bcrypt.hash('123456', 10)
  const user = await prisma.user.upsert({
    where: { email: 'user@6ad.in' },
    update: {},
    create: {
      email: 'user@6ad.in',
      password: userPassword,
      username: 'TestUser',
      realName: 'Test User',
      role: 'USER',
      status: 'ACTIVE',
      walletBalance: 1000,
      agentId: agent.id,
      creatorId: agent.id,
    }
  })
  console.log('✅ User created:', user.email)

  // Create Modules for Admin
  const adminModules = [
    { route: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', role: 'ADMIN' as const, priority: 1 },
    { route: '/agents', label: 'Agents', icon: 'Users', role: 'ADMIN' as const, priority: 2 },
    { route: '/users', label: 'Users', icon: 'User', role: 'ADMIN' as const, priority: 3 },
    { route: '/transactions', label: 'Transactions', icon: 'CreditCard', role: 'ADMIN' as const, priority: 4 },
    { route: '/reports', label: 'Reports', icon: 'FileText', role: 'ADMIN' as const, priority: 5 },
    { route: '/facebook', label: 'Facebook', icon: 'Facebook', role: 'ADMIN' as const, priority: 6 },
    { route: '/google', label: 'Google', icon: 'Chrome', role: 'ADMIN' as const, priority: 7 },
    { route: '/snapchat', label: 'Snapchat', icon: 'Ghost', role: 'ADMIN' as const, priority: 8 },
    { route: '/tiktok', label: 'TikTok', icon: 'Music', role: 'ADMIN' as const, priority: 9 },
    { route: '/bing', label: 'Bing', icon: 'Search', role: 'ADMIN' as const, priority: 10 },
    { route: '/withdrawals', label: 'Withdrawals', icon: 'ArrowUpRight', role: 'ADMIN' as const, priority: 11 },
    { route: '/user-settings', label: 'User Settings', icon: 'Settings', role: 'ADMIN' as const, priority: 12 },
    { route: '/notices', label: 'Notices', icon: 'Bell', role: 'ADMIN' as const, priority: 13 },
    { route: '/settings', label: 'Settings', icon: 'Settings', role: 'ADMIN' as const, priority: 14 },
  ]

  // Create Modules for Agent
  const agentModules = [
    { route: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', role: 'AGENT' as const, priority: 1 },
    { route: '/users', label: 'Users', icon: 'User', role: 'AGENT' as const, priority: 2 },
    { route: '/transactions', label: 'Transactions', icon: 'CreditCard', role: 'AGENT' as const, priority: 3 },
    { route: '/facebook', label: 'Facebook', icon: 'Facebook', role: 'AGENT' as const, priority: 4 },
    { route: '/google', label: 'Google', icon: 'Chrome', role: 'AGENT' as const, priority: 5 },
    { route: '/snapchat', label: 'Snapchat', icon: 'Ghost', role: 'AGENT' as const, priority: 6 },
    { route: '/tiktok', label: 'TikTok', icon: 'Music', role: 'AGENT' as const, priority: 7 },
    { route: '/bing', label: 'Bing', icon: 'Search', role: 'AGENT' as const, priority: 8 },
    { route: '/reports', label: 'Reports', icon: 'FileText', role: 'AGENT' as const, priority: 9 },
    { route: '/settings', label: 'Settings', icon: 'Settings', role: 'AGENT' as const, priority: 10 },
  ]

  // Create Modules for User
  const userModules = [
    { route: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', role: 'USER' as const, priority: 1 },
    { route: '/wallet', label: 'Wallet', icon: 'Wallet', role: 'USER' as const, priority: 2 },
    { route: '/facebook', label: 'Facebook', icon: 'Facebook', role: 'USER' as const, priority: 3 },
    { route: '/google', label: 'Google', icon: 'Chrome', role: 'USER' as const, priority: 4 },
    { route: '/snapchat', label: 'Snapchat', icon: 'Ghost', role: 'USER' as const, priority: 5 },
    { route: '/tiktok', label: 'TikTok', icon: 'Music', role: 'USER' as const, priority: 6 },
    { route: '/bing', label: 'Bing', icon: 'Search', role: 'USER' as const, priority: 7 },
    { route: '/settings', label: 'Settings', icon: 'Settings', role: 'USER' as const, priority: 8 },
  ]

  // Insert all modules
  for (const mod of [...adminModules, ...agentModules, ...userModules]) {
    await prisma.module.upsert({
      where: { id: 0 }, // This will always create
      update: {},
      create: mod,
    }).catch(() => {
      // If upsert fails, just create
      return prisma.module.create({ data: mod })
    })
  }
  console.log('✅ Modules created')

  // Create site settings
  await prisma.siteSettings.upsert({
    where: { domain: '6ad.in' },
    update: {},
    create: {
      domain: '6ad.in',
      brandName: '6AD',
      supportEmail: 'support@6ad.in',
    }
  })
  console.log('✅ Site settings created')

  console.log('\n🎉 Seed completed!')
  console.log('\n📧 Test Accounts:')
  console.log('   Admin: admin@6ad.in / 123456')
  console.log('   Agent: agent@6ad.in / 123456')
  console.log('   User:  user@6ad.in / 123456')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
