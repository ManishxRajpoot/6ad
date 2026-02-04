import { PrismaClient, UserRole, UserStatus, Platform, AccountStatus, TransactionStatus, TransactionType, PayLinkRequestType, PayLinkRequestStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Helper to hash passwords
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

// Generate random string for IDs
function generateId(prefix: string, length: number = 7): string {
  const chars = '0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  const date = new Date()
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `${prefix}${dateStr}${result}`
}

async function main() {
  console.log('🌱 Starting database seed...\n')

  // Clear existing data
  console.log('🗑️  Clearing existing data...')
  await prisma.chatMessage.deleteMany()
  await prisma.chatRoom.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.referral.deleteMany()
  await prisma.walletFlow.deleteMany()
  await prisma.balanceTransfer.deleteMany()
  await prisma.accountRefund.deleteMany()
  await prisma.accountDeposit.deleteMany()
  await prisma.bmShareRequest.deleteMany()
  await prisma.payLinkRequest.deleteMany()
  await prisma.payLink.deleteMany()
  await prisma.refund.deleteMany()
  await prisma.withdrawal.deleteMany()
  await prisma.deposit.deleteMany()
  await prisma.adAccount.deleteMany()
  await prisma.adAccountApplication.deleteMany()
  await prisma.agentWithdrawal.deleteMany()
  await prisma.blockHistory.deleteMany()
  await prisma.customDomain.deleteMany()
  // Clear self-referential user relations first
  await prisma.user.updateMany({ data: { creatorId: null, agentId: null } })
  await prisma.user.deleteMany()
  await prisma.globalSettings.deleteMany()
  await prisma.paymentMethod.deleteMany()
  console.log('✅ Cleared existing data\n')

  // ============= CREATE ADMIN =============
  console.log('👤 Creating Admin user...')
  const adminPassword = await hashPassword('admin123')
  const admin = await prisma.user.create({
    data: {
      email: 'admin@6ad.io',
      password: adminPassword,
      plaintextPassword: 'admin123',
      username: 'admin',
      realName: 'System Admin',
      phone: '+91 9876543210',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      walletBalance: 0,
      emailVerified: true,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    },
  })
  console.log(`✅ Admin created: ${admin.email} (password: admin123)\n`)

  // ============= CREATE AGENTS =============
  console.log('👥 Creating Agent users...')
  const agentPassword = await hashPassword('agent123')

  const agent1 = await prisma.user.create({
    data: {
      email: 'agent@6ad.io',
      password: agentPassword,
      plaintextPassword: 'agent123',
      username: 'agency_partner',
      realName: 'John Smith',
      phone: '+91 9876543211',
      role: UserRole.AGENT,
      status: UserStatus.ACTIVE,
      walletBalance: 0,
      couponBalance: 0,
      emailVerified: true,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXQ',
      brandName: 'AdsPro Agency',
      // Platform fees
      fbFee: 150,
      fbCommission: 5,
      fbUnlimitedDomainFee: 50,
      googleFee: 200,
      googleCommission: 6,
      tiktokFee: 180,
      tiktokCommission: 5,
      snapchatFee: 160,
      snapchatCommission: 4,
      bingFee: 120,
      bingCommission: 3,
      creatorId: admin.id,
    },
  })

  const agent2 = await prisma.user.create({
    data: {
      email: 'partner@6ad.io',
      password: agentPassword,
      plaintextPassword: 'agent123',
      username: 'digital_partner',
      realName: 'Emily Johnson',
      phone: '+91 9876543212',
      role: UserRole.AGENT,
      status: UserStatus.ACTIVE,
      walletBalance: 0,
      couponBalance: 5,
      emailVerified: true,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXR',
      brandName: 'Digital Edge',
      // Platform fees
      fbFee: 140,
      fbCommission: 4,
      googleFee: 180,
      googleCommission: 5,
      tiktokFee: 160,
      tiktokCommission: 4,
      snapchatFee: 150,
      snapchatCommission: 4,
      bingFee: 100,
      bingCommission: 3,
      creatorId: admin.id,
    },
  })

  console.log(`✅ Agent 1 created: ${agent1.email} (password: agent123)`)
  console.log(`✅ Agent 2 created: ${agent2.email} (password: agent123)\n`)

  // ============= CREATE USERS =============
  console.log('👥 Creating Regular users...')
  const userPassword = await hashPassword('user123')

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'user@6ad.io',
        password: userPassword,
        plaintextPassword: 'user123',
        username: 'demo_user',
        realName: 'Demo User',
        phone: '+91 9876543213',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 0,
        emailVerified: true,
        twoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXS',
        agentId: agent1.id,
        creatorId: agent1.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'alice@example.com',
        password: userPassword,
        plaintextPassword: 'user123',
        username: 'alice_ads',
        realName: 'Alice Williams',
        phone: '+91 9876543214',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 0,
        emailVerified: true,
        twoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXT',
        agentId: agent1.id,
        creatorId: agent1.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob@example.com',
        password: userPassword,
        plaintextPassword: 'user123',
        username: 'bob_marketing',
        realName: 'Bob Anderson',
        phone: '+91 9876543215',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 0,
        emailVerified: true,
        twoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXU',
        agentId: agent1.id,
        creatorId: agent1.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'charlie@example.com',
        password: userPassword,
        plaintextPassword: 'user123',
        username: 'charlie_digital',
        realName: 'Charlie Brown',
        phone: '+91 9876543216',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 0,
        emailVerified: true,
        twoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXV',
        agentId: agent2.id,
        creatorId: agent2.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'diana@example.com',
        password: userPassword,
        plaintextPassword: 'user123',
        username: 'diana_ecom',
        realName: 'Diana Prince',
        phone: '+91 9876543217',
        role: UserRole.USER,
        status: UserStatus.BLOCKED,
        walletBalance: 0,
        emailVerified: true,
        twoFactorEnabled: false,
        agentId: agent2.id,
        creatorId: agent2.id,
      },
    }),
  ])

  console.log(`✅ Created ${users.length} regular users (password: user123)\n`)

  // ============= CREATE MORE USERS (50 Demo Records) =============
  console.log('👥 Creating additional demo users (50 records)...')

  const userFirstNames = ['John', 'Emma', 'Michael', 'Sarah', 'David', 'Lisa', 'Robert', 'Jennifer', 'William', 'Jessica', 'James', 'Ashley', 'Christopher', 'Amanda', 'Matthew', 'Stephanie', 'Daniel', 'Nicole', 'Andrew', 'Heather', 'Ryan', 'Michelle', 'Kevin', 'Rachel', 'Brian']
  const userLastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young']
  const userStatuses = [UserStatus.ACTIVE, UserStatus.ACTIVE, UserStatus.ACTIVE, UserStatus.ACTIVE, UserStatus.BLOCKED] // 80% active, 20% blocked

  const additionalUsers = []
  for (let i = 0; i < 50; i++) {
    const firstName = userFirstNames[Math.floor(Math.random() * userFirstNames.length)]
    const lastName = userLastNames[Math.floor(Math.random() * userLastNames.length)]
    const agentPrefix = i % 2 === 0 ? 'agency_partner_' : 'digital_partner_'
    const username = `${agentPrefix}${firstName.toLowerCase()}${i}`
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`
    const status = userStatuses[Math.floor(Math.random() * userStatuses.length)]
    const walletBalance = Math.floor(Math.random() * 9000) + 500 // 500-9500
    const couponBalance = Math.floor(Math.random() * 10) // 0-9 coupons
    const daysAgo = Math.floor(Math.random() * 180) // Random date within last 180 days
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    additionalUsers.push(
      prisma.user.create({
        data: {
          email,
          password: userPassword,
          plaintextPassword: 'user123',
          username,
          realName: `${firstName} ${lastName}`,
          phone: `+91 98765${String(43218 + i).padStart(5, '0')}`,
          role: UserRole.USER,
          status,
          walletBalance,
          couponBalance,
          emailVerified: true,
          twoFactorEnabled: false,
          agentId: i % 2 === 0 ? agent1.id : agent2.id,
          creatorId: i % 2 === 0 ? agent1.id : agent2.id,
          createdAt,
        },
      })
    )
  }

  await Promise.all(additionalUsers)
  console.log(`✅ Created 50 additional user records\n`)

  // ============= CREATE AD ACCOUNT APPLICATIONS =============
  console.log('📝 Creating Ad Account Applications...')

  const applications = await Promise.all([
    prisma.adAccountApplication.create({
      data: {
        applyId: generateId('AD'),
        platform: Platform.FACEBOOK,
        licenseType: 'NEW',
        accountDetails: JSON.stringify([{ name: 'FB Account 1', accountId: '' }]),
        adAccountQty: 1,
        depositAmount: 500,
        openingFee: 150,
        platformFee: 5,
        totalCost: 675,
        status: TransactionStatus.APPROVED,
        userId: users[0].id,
        approvedAt: new Date(),
      },
    }),
    prisma.adAccountApplication.create({
      data: {
        applyId: generateId('AD'),
        platform: Platform.GOOGLE,
        licenseType: 'NEW',
        accountDetails: JSON.stringify([{ name: 'Google Ads 1', accountId: '' }]),
        adAccountQty: 1,
        depositAmount: 300,
        openingFee: 200,
        platformFee: 6,
        totalCost: 518,
        status: TransactionStatus.APPROVED,
        userId: users[1].id,
        approvedAt: new Date(),
      },
    }),
    prisma.adAccountApplication.create({
      data: {
        applyId: generateId('AD'),
        platform: Platform.TIKTOK,
        licenseType: 'NEW',
        accountDetails: JSON.stringify([{ name: 'TikTok Ads 1', accountId: '' }]),
        adAccountQty: 1,
        depositAmount: 400,
        openingFee: 180,
        platformFee: 5,
        totalCost: 600,
        status: TransactionStatus.PENDING,
        userId: users[2].id,
      },
    }),
    prisma.adAccountApplication.create({
      data: {
        applyId: generateId('AD'),
        platform: Platform.SNAPCHAT,
        licenseType: 'NEW',
        accountDetails: JSON.stringify([{ name: 'Snapchat Ads 1', accountId: '' }]),
        adAccountQty: 1,
        depositAmount: 250,
        openingFee: 160,
        platformFee: 4,
        totalCost: 420,
        status: TransactionStatus.PENDING,
        userId: users[3].id,
      },
    }),
  ])

  console.log(`✅ Created ${applications.length} ad account applications\n`)

  // ============= CREATE AD ACCOUNTS =============
  console.log('📊 Creating Ad Accounts...')

  const adAccounts = await Promise.all([
    prisma.adAccount.create({
      data: {
        platform: Platform.FACEBOOK,
        accountId: 'act_123456789',
        accountName: 'FB Ecommerce Account',
        licenseName: 'Demo License',
        bmId: '987654321',
        timezone: 'Asia/Kolkata',
        status: AccountStatus.APPROVED,
        totalDeposit: 2500,
        totalSpend: 1800,
        balance: 700,
        userId: users[0].id,
        applicationId: applications[0].id,
      },
    }),
    prisma.adAccount.create({
      data: {
        platform: Platform.GOOGLE,
        accountId: '123-456-7890',
        accountName: 'Google Search Campaign',
        licenseName: 'Demo License',
        timezone: 'Asia/Kolkata',
        status: AccountStatus.APPROVED,
        totalDeposit: 1500,
        totalSpend: 1200,
        balance: 300,
        userId: users[1].id,
        applicationId: applications[1].id,
      },
    }),
    prisma.adAccount.create({
      data: {
        platform: Platform.FACEBOOK,
        accountId: 'act_987654321',
        accountName: 'FB Leads Account',
        licenseName: 'Demo License',
        bmId: '123456789',
        timezone: 'Asia/Kolkata',
        status: AccountStatus.APPROVED,
        totalDeposit: 3000,
        totalSpend: 2500,
        balance: 500,
        userId: users[2].id,
      },
    }),
    prisma.adAccount.create({
      data: {
        platform: Platform.TIKTOK,
        accountId: 'tiktok_12345',
        accountName: 'TikTok Brand Account',
        licenseName: 'Demo License',
        timezone: 'Asia/Kolkata',
        status: AccountStatus.PENDING,
        totalDeposit: 0,
        balance: 0,
        userId: users[0].id,
      },
    }),
  ])

  console.log(`✅ Created ${adAccounts.length} ad accounts\n`)

  // ============= CREATE DEPOSITS =============
  console.log('💰 Creating Wallet Deposits...')

  const deposits = await Promise.all([
    prisma.deposit.create({
      data: {
        applyId: generateId('WD'),
        amount: 5000,
        status: TransactionStatus.APPROVED,
        paymentMethod: 'Bank Transfer',
        transactionId: 'TXN123456',
        userId: users[0].id,
        approvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
    }),
    prisma.deposit.create({
      data: {
        applyId: generateId('WD'),
        amount: 3500,
        status: TransactionStatus.APPROVED,
        paymentMethod: 'UPI',
        transactionId: 'TXN234567',
        userId: users[1].id,
        approvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      },
    }),
    prisma.deposit.create({
      data: {
        applyId: generateId('WD'),
        amount: 2000,
        status: TransactionStatus.PENDING,
        paymentMethod: 'USDT TRC20',
        userId: users[2].id,
      },
    }),
    prisma.deposit.create({
      data: {
        applyId: generateId('WD'),
        amount: 1500,
        status: TransactionStatus.PENDING,
        paymentMethod: 'Bank Transfer',
        userId: users[3].id,
      },
    }),
  ])

  console.log(`✅ Created ${deposits.length} wallet deposits\n`)

  // ============= CREATE AGENT DEPOSITS (100 Demo Records) =============
  console.log('💰 Creating Agent Wallet Deposits (100 demo records)...')

  const paymentMethods = ['Bank Transfer', 'UPI', 'USDT TRC20', 'USDT BEP20', 'PayPal']
  const statuses = [TransactionStatus.APPROVED, TransactionStatus.APPROVED, TransactionStatus.PENDING, TransactionStatus.REJECTED]

  const agentDeposits = []
  for (let i = 0; i < 100; i++) {
    const amount = Math.floor(Math.random() * 9000) + 1000 // Random amount between 1000-10000
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)]
    const daysAgo = Math.floor(Math.random() * 60) // Random date within last 60 days
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    agentDeposits.push(
      prisma.deposit.create({
        data: {
          applyId: generateId('PWD'),
          amount,
          status,
          paymentMethod,
          transactionId: status !== TransactionStatus.PENDING ? `TXN${Date.now()}${i}` : null,
          paymentProof: status !== TransactionStatus.PENDING ? `https://placehold.co/400x300/7C3AED/white?text=Payment+${i + 1}` : null,
          remarks: i % 3 === 0 ? `Agent deposit request #${i + 1}` : null,
          userId: i % 2 === 0 ? agent1.id : agent2.id, // Alternate between agents
          approvedAt: status === TransactionStatus.APPROVED ? createdAt : null,
          createdAt,
        },
      })
    )
  }

  await Promise.all(agentDeposits)
  console.log(`✅ Created 100 agent deposit records\n`)

  // ============= CREATE PAY LINK REQUESTS (100 Demo Records) =============
  console.log('🔗 Creating Pay Link Requests (100 demo records)...')

  const countries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'India', 'Singapore', 'UAE', 'Japan']
  const firstNames = ['John', 'Emma', 'Michael', 'Sarah', 'David', 'Lisa', 'Robert', 'Jennifer', 'William', 'Jessica', 'James', 'Ashley', 'Christopher', 'Amanda', 'Matthew', 'Stephanie', 'Daniel', 'Nicole', 'Andrew', 'Heather']
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris']
  const companyNames = ['TechCorp Inc', 'Global Media LLC', 'Digital Solutions', 'Marketing Pro', 'AdVentures Agency', 'Cloud Nine Studios', 'Pixel Perfect', 'Growth Hackers', 'Scale Up Media', 'Infinity Ads', 'Blue Ocean Digital', 'Red Rock Marketing', 'Green Valley Tech', 'Silver Line Media', 'Gold Standard Ads']
  const payLinkStatuses = [PayLinkRequestStatus.PENDING, PayLinkRequestStatus.PENDING, PayLinkRequestStatus.LINK_CREATED, PayLinkRequestStatus.COMPLETED, PayLinkRequestStatus.REJECTED]

  const payLinkRequests = []
  for (let i = 0; i < 100; i++) {
    const isCompany = Math.random() > 0.6 // 40% company, 60% individual
    const type = isCompany ? PayLinkRequestType.COMPANY : PayLinkRequestType.INDIVIDUAL
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const fullName = `${firstName} ${lastName}`
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`
    const country = countries[Math.floor(Math.random() * countries.length)]
    const amount = Math.floor(Math.random() * 4500) + 500 // Random amount between 500-5000
    const status = payLinkStatuses[Math.floor(Math.random() * payLinkStatuses.length)]
    const daysAgo = Math.floor(Math.random() * 90) // Random date within last 90 days
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    const requestData: any = {
      applyId: generateId('PL'),
      type,
      fullName,
      email,
      country,
      amount,
      status,
      userId: i % 2 === 0 ? agent1.id : agent2.id, // Alternate between agents
      createdAt,
    }

    // Add company fields if company type
    if (isCompany) {
      requestData.companyName = companyNames[Math.floor(Math.random() * companyNames.length)]
      requestData.website = `https://www.${requestData.companyName.toLowerCase().replace(/\s+/g, '')}.com`
    }

    // Add pay link if status is LINK_CREATED or COMPLETED
    if (status === PayLinkRequestStatus.LINK_CREATED || status === PayLinkRequestStatus.COMPLETED) {
      requestData.payLink = `https://pay.stripe.com/c/${Math.random().toString(36).substring(2, 15)}`
    }

    // Add admin remarks for rejected ones
    if (status === PayLinkRequestStatus.REJECTED) {
      requestData.adminRemarks = 'Unable to verify business information'
    }

    payLinkRequests.push(
      prisma.payLinkRequest.create({
        data: requestData,
      })
    )
  }

  await Promise.all(payLinkRequests)
  console.log(`✅ Created 100 pay link request records\n`)

  // ============= CREATE ACCOUNT DEPOSITS (Recharges) =============
  console.log('💳 Creating Account Deposits (Recharges)...')

  const accountDeposits = await Promise.all([
    prisma.accountDeposit.create({
      data: {
        applyId: generateId('RC'),
        amount: 1000,
        status: TransactionStatus.APPROVED,
        commissionRate: 5,
        commissionAmount: 50,
        adAccountId: adAccounts[0].id,
        approvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.accountDeposit.create({
      data: {
        applyId: generateId('RC'),
        amount: 500,
        status: TransactionStatus.APPROVED,
        commissionRate: 6,
        commissionAmount: 30,
        adAccountId: adAccounts[1].id,
        approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.accountDeposit.create({
      data: {
        applyId: generateId('RC'),
        amount: 800,
        status: TransactionStatus.PENDING,
        commissionRate: 5,
        commissionAmount: 40,
        adAccountId: adAccounts[2].id,
      },
    }),
  ])

  console.log(`✅ Created ${accountDeposits.length} account recharges\n`)

  // ============= CREATE WITHDRAWALS =============
  console.log('📤 Creating Withdrawals...')

  const withdrawals = await Promise.all([
    prisma.withdrawal.create({
      data: {
        amount: 500,
        status: TransactionStatus.APPROVED,
        bankName: 'HDFC Bank',
        accountNumber: '1234567890',
        accountHolderName: 'Demo User',
        ifscCode: 'HDFC0001234',
        userId: users[0].id,
        approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.withdrawal.create({
      data: {
        amount: 300,
        status: TransactionStatus.PENDING,
        bankName: 'SBI',
        accountNumber: '0987654321',
        accountHolderName: 'Alice Williams',
        ifscCode: 'SBIN0012345',
        userId: users[1].id,
      },
    }),
  ])

  console.log(`✅ Created ${withdrawals.length} withdrawals\n`)

  // ============= CREATE WALLET FLOWS (100 Demo Records) =============
  console.log('📈 Creating Wallet Flow Records (100 demo records)...')

  const transactionTypes = [TransactionType.DEPOSIT, TransactionType.DEPOSIT, TransactionType.WITHDRAWAL, TransactionType.REFUND, TransactionType.TRANSFER, TransactionType.CREDIT]
  const referenceTypes = ['deposit', 'withdrawal', 'refund', 'transfer', 'ad_account', 'bonus']
  const flowDescriptions = [
    'Wallet deposit via Bank Transfer',
    'Wallet deposit via UPI',
    'Wallet deposit via USDT TRC20',
    'Withdrawal to bank account',
    'Refund from ad account',
    'Balance transfer received',
    'Ad account recharge',
    'Commission credit',
    'Bonus credit added',
    'Pay link payment received',
  ]

  const walletFlows = []
  let runningBalance = 10000 // Starting balance for demo

  for (let i = 0; i < 100; i++) {
    const txType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)]
    const isDebit = txType === TransactionType.WITHDRAWAL
    const amount = isDebit
      ? -(Math.floor(Math.random() * 500) + 100) // Withdrawal: -100 to -600
      : Math.floor(Math.random() * 2000) + 200   // Credit: 200 to 2200

    const balanceBefore = runningBalance
    const balanceAfter = runningBalance + amount
    runningBalance = balanceAfter > 0 ? balanceAfter : 1000 // Reset if goes negative

    const daysAgo = Math.floor(Math.random() * 90)
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    const description = isDebit
      ? flowDescriptions[3]
      : flowDescriptions[Math.floor(Math.random() * flowDescriptions.length)]

    walletFlows.push(
      prisma.walletFlow.create({
        data: {
          type: txType,
          amount,
          balanceBefore,
          balanceAfter: balanceAfter > 0 ? balanceAfter : 1000,
          referenceId: `ref_${Date.now()}_${i}`,
          referenceType: referenceTypes[Math.floor(Math.random() * referenceTypes.length)],
          userId: i % 3 === 0 ? agent1.id : (i % 3 === 1 ? agent2.id : users[i % users.length].id),
          description,
          createdAt,
        },
      })
    )
  }

  await Promise.all(walletFlows)
  console.log(`✅ Created 100 wallet flow records\n`)

  // ============= CREATE GLOBAL SETTINGS =============
  console.log('⚙️  Creating Global Settings...')

  await prisma.globalSettings.create({
    data: {
      payLinkEnabled: true,
      facebookStatus: 'active',
      googleStatus: 'active',
      tiktokStatus: 'active',
      snapchatStatus: 'active',
      bingStatus: 'active',
    },
  })

  console.log(`✅ Created global settings\n`)

  // ============= CREATE PAYMENT METHODS =============
  console.log('💳 Creating Payment Methods...')

  await Promise.all([
    prisma.paymentMethod.create({
      data: {
        name: 'Bank Transfer',
        description: 'Direct bank transfer (NEFT/IMPS/RTGS)',
        icon: '🏦',
        isEnabled: true,
        isDefault: true,
        sortOrder: 1,
      },
    }),
    prisma.paymentMethod.create({
      data: {
        name: 'UPI',
        description: 'Pay via UPI apps (GPay, PhonePe, Paytm)',
        icon: '📱',
        isEnabled: true,
        sortOrder: 2,
      },
    }),
    prisma.paymentMethod.create({
      data: {
        name: 'USDT TRC20',
        description: 'Cryptocurrency payment via TRON network',
        icon: '💎',
        walletAddress: 'TXz123abc456def789',
        isEnabled: true,
        sortOrder: 3,
      },
    }),
    prisma.paymentMethod.create({
      data: {
        name: 'USDT BEP20',
        description: 'Cryptocurrency payment via BSC network',
        icon: '🔶',
        walletAddress: '0x123abc456def789',
        isEnabled: true,
        sortOrder: 4,
      },
    }),
  ])

  console.log(`✅ Created payment methods\n`)

  // ============= CREATE ANNOUNCEMENTS =============
  console.log('📢 Creating Announcements...')

  await Promise.all([
    prisma.announcement.create({
      data: {
        title: 'Welcome to 6AD Platform!',
        message: 'We are excited to have you here. Start by depositing funds to your wallet.',
        type: 'info',
        isActive: true,
        isPinned: true,
        targetRole: 'ALL',
        createdById: admin.id,
      },
    }),
    prisma.announcement.create({
      data: {
        title: 'New TikTok Ads Available',
        message: 'You can now apply for TikTok ad accounts with reduced fees this month!',
        type: 'success',
        isActive: true,
        targetRole: 'USER',
        createdById: admin.id,
      },
    }),
  ])

  console.log(`✅ Created announcements\n`)

  // ============= CREATE NOTIFICATIONS =============
  console.log('🔔 Creating Notifications...')

  await Promise.all([
    prisma.notification.create({
      data: {
        userId: users[0].id,
        type: 'DEPOSIT_APPROVED',
        title: 'Deposit Approved',
        message: 'Your deposit of $5,000 has been approved and credited to your wallet.',
        isRead: true,
      },
    }),
    prisma.notification.create({
      data: {
        userId: users[0].id,
        type: 'ACCOUNT_APPROVED',
        title: 'Ad Account Approved',
        message: 'Your Facebook ad account application has been approved!',
        isRead: false,
      },
    }),
    prisma.notification.create({
      data: {
        userId: users[1].id,
        type: 'DEPOSIT_APPROVED',
        title: 'Deposit Approved',
        message: 'Your deposit of $3,500 has been approved and credited to your wallet.',
        isRead: false,
      },
    }),
  ])

  console.log(`✅ Created notifications\n`)

  // ============= SUMMARY =============
  console.log('='.repeat(50))
  console.log('🎉 Database seed completed successfully!')
  console.log('='.repeat(50))
  console.log('\n📋 Test Accounts Summary:\n')
  console.log('ADMIN:')
  console.log('  Email: admin@6ad.io')
  console.log('  Password: admin123')
  console.log('  2FA Secret: JBSWY3DPEHPK3PXP')
  console.log('')
  console.log('AGENTS:')
  console.log('  1. Email: agent@6ad.io')
  console.log('     Password: agent123')
  console.log('     2FA Secret: JBSWY3DPEHPK3PXQ')
  console.log('')
  console.log('  2. Email: partner@6ad.io')
  console.log('     Password: agent123')
  console.log('     2FA Secret: JBSWY3DPEHPK3PXR')
  console.log('')
  console.log('USERS:')
  console.log('  1. Email: user@6ad.io')
  console.log('     Password: user123')
  console.log('     2FA Secret: JBSWY3DPEHPK3PXS')
  console.log('')
  console.log('  2. Email: alice@example.com')
  console.log('     Password: user123')
  console.log('  3. Email: bob@example.com')
  console.log('     Password: user123')
  console.log('  4. Email: charlie@example.com')
  console.log('     Password: user123')
  console.log('  5. Email: diana@example.com (BLOCKED)')
  console.log('     Password: user123')
  console.log('')
  console.log('='.repeat(50))
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
