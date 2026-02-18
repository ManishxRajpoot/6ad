import { PrismaClient, UserRole, UserStatus, Platform, AccountStatus, TransactionStatus, TransactionType, PayLinkRequestType, PayLinkRequestStatus, NotificationType, LicenseType } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

// ============================================================
// 🔒 SEPARATE TEST DATABASE - NEVER TOUCHES PRODUCTION
// ============================================================
const TEST_DATABASE_URL = 'mongodb://127.0.0.1:27017/6ad_seed_test?directConnection=true'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DATABASE_URL,
    },
  },
})

// ============= HELPERS =============

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

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

function randomDate(daysAgo: number): Date {
  const d = Math.floor(Math.random() * daysAgo)
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000)
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ============= DATA POOLS =============

const INDIAN_FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Atharva', 'Advik', 'Pranav', 'Advaith', 'Aarush', 'Kabir', 'Ritvik', 'Rudra', 'Dhruv',
  'Ananya', 'Diya', 'Aadhya', 'Myra', 'Isha', 'Saanvi', 'Aanya', 'Kiara', 'Riya', 'Prisha',
  'Navya', 'Anika', 'Sara', 'Avni', 'Ahana', 'Pari', 'Tara', 'Zara', 'Meera', 'Nisha',
  'Rohan', 'Rahul', 'Vikram', 'Nikhil', 'Amit', 'Karan', 'Raj', 'Suresh', 'Deepak', 'Manish',
  'Priya', 'Neha', 'Pooja', 'Sneha', 'Divya', 'Anjali', 'Shruti', 'Sakshi', 'Komal', 'Tanvi',
  'Harsh', 'Yash', 'Dev', 'Aryan', 'Varun', 'Siddharth', 'Gaurav', 'Akash', 'Ravi', 'Mohit',
  'Simran', 'Kritika', 'Anisha', 'Kavya', 'Aditi', 'Bhavya', 'Chhavi', 'Dhara', 'Esha', 'Gauri',
  'Hemant', 'Ishan', 'Jayesh', 'Kunal', 'Lakshya', 'Mayank', 'Nakul', 'Om', 'Parth', 'Sahil',
  'Radhika', 'Sonal', 'Tanya', 'Uma', 'Vanshika', 'Yamini',
]

const INDIAN_LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Shah', 'Joshi', 'Mehta', 'Agarwal',
  'Reddy', 'Nair', 'Rao', 'Pillai', 'Menon', 'Iyer', 'Chopra', 'Kapoor', 'Malhotra', 'Bhatia',
  'Chauhan', 'Tiwari', 'Pandey', 'Mishra', 'Saxena', 'Dubey', 'Shukla', 'Dwivedi', 'Rastogi', 'Kulkarni',
  'Deshmukh', 'Patil', 'Jadhav', 'Kadam', 'Thakur', 'Rathore', 'Rajput', 'Bhatt', 'Trivedi', 'Dave',
]

const INDIAN_BANK_NAMES = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Punjab National Bank',
  'Bank of Baroda', 'Kotak Mahindra Bank', 'Yes Bank', 'IndusInd Bank', 'Union Bank of India',
  'Canara Bank', 'Indian Bank', 'Bank of India', 'Central Bank of India', 'IDBI Bank',
]

const IFSC_PREFIXES = [
  'SBIN0', 'HDFC0', 'ICIC0', 'UTIB0', 'PUNB0', 'BARB0', 'KKBK0', 'YESB0', 'INDB0', 'UBIN0',
]

const PLATFORMS: Platform[] = [Platform.FACEBOOK, Platform.GOOGLE, Platform.TIKTOK, Platform.SNAPCHAT, Platform.BING]
const ACCOUNT_STATUSES: AccountStatus[] = [AccountStatus.APPROVED, AccountStatus.APPROVED, AccountStatus.APPROVED, AccountStatus.PENDING, AccountStatus.REJECTED, AccountStatus.SUSPENDED]
const PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'USDT TRC20', 'USDT BEP20']
const TIMEZONES = ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'Asia/Singapore', 'America/Los_Angeles']

const NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.ACCOUNT_APPROVED, NotificationType.DEPOSIT_APPROVED,
  NotificationType.DEPOSIT_REJECTED, NotificationType.LOW_BALANCE,
  NotificationType.SYSTEM, NotificationType.ANNOUNCEMENT,
]

const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; message: string }[]> = {
  [NotificationType.ACCOUNT_APPROVED]: [
    { title: 'Ad Account Approved', message: 'Your ad account application has been approved! You can now start advertising.' },
    { title: 'Account Ready', message: 'Great news! Your ad account is now active and ready to use.' },
  ],
  [NotificationType.DEPOSIT_APPROVED]: [
    { title: 'Deposit Approved', message: 'Your wallet deposit has been approved and credited to your account.' },
    { title: 'Funds Added', message: 'Your deposit has been processed. Funds are now available in your wallet.' },
  ],
  [NotificationType.DEPOSIT_REJECTED]: [
    { title: 'Deposit Rejected', message: 'Your deposit request was rejected. Please contact support for details.' },
    { title: 'Payment Issue', message: 'We could not verify your payment. Please submit a new deposit request.' },
  ],
  [NotificationType.LOW_BALANCE]: [
    { title: 'Low Balance Alert', message: 'Your wallet balance is running low. Consider adding funds to continue advertising.' },
    { title: 'Balance Warning', message: 'Your account balance is below $100. Top up to avoid service interruption.' },
  ],
  [NotificationType.SYSTEM]: [
    { title: 'System Maintenance', message: 'Scheduled maintenance will occur tonight from 2 AM to 4 AM IST.' },
    { title: 'Platform Update', message: 'New features have been added to the platform. Check them out!' },
    { title: 'Security Update', message: 'We recommend enabling 2FA for enhanced account security.' },
  ],
  [NotificationType.ANNOUNCEMENT]: [
    { title: 'Special Offer', message: 'Get 10% bonus on deposits above $500 this week!' },
    { title: 'New Platform Added', message: 'You can now create ad accounts on Bing Ads through our platform.' },
    { title: 'Holiday Notice', message: 'Our support team will be available with limited hours during the holidays.' },
  ],
  [NotificationType.ACCOUNT_REJECTED]: [
    { title: 'Account Rejected', message: 'Your ad account application was rejected. Please review the requirements.' },
  ],
  [NotificationType.REFUND_PROCESSED]: [
    { title: 'Refund Processed', message: 'Your refund request has been processed and credited to your wallet.' },
  ],
  [NotificationType.REFERRAL_REWARD]: [
    { title: 'Referral Bonus', message: 'You earned a referral bonus! Thank you for spreading the word.' },
  ],
}

// ============= MAIN SEED FUNCTION =============

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('🔒 Using SEPARATE test database: 6ad_seed_test')
  console.log(`📍 Database URL: ${TEST_DATABASE_URL}`)
  console.log('='.repeat(60) + '\n')

  console.log('🌱 Starting test database seed (100 users)...\n')

  // ============= CLEAR EXISTING DATA =============
  console.log('🗑️  Clearing existing data in test database...')
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

  // ============= HASH PASSWORDS =============
  const password = await hashPassword('test123')

  // ============= 1. CREATE ADMIN =============
  console.log('👑 Creating Admin...')
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.6ad.io',
      password,
      plaintextPassword: 'admin123',
      username: 'admin',
      realName: 'System Admin',
      phone: '+91 9000000001',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      walletBalance: 0,
      emailVerified: true,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    },
  })
  console.log(`  ✅ Admin: admin@test.6ad.io / admin123\n`)

  // ============= 2. CREATE 3 AGENTS =============
  console.log('🏢 Creating 3 Agents...')

  const agent1 = await prisma.user.create({
    data: {
      email: 'agent1@test.6ad.io',
      password,
      plaintextPassword: 'test123',
      username: 'adspro_agency',
      realName: 'Rajesh Sharma',
      phone: '+91 9000000002',
      role: UserRole.AGENT,
      status: UserStatus.ACTIVE,
      walletBalance: 25000,
      couponBalance: 10,
      emailVerified: true,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXQ',
      brandName: 'AdsPro Digital',
      brandLogo: null,
      fbFee: 150, fbCommission: 5, fbUnlimitedDomainFee: 50,
      googleFee: 200, googleCommission: 6,
      tiktokFee: 180, tiktokCommission: 5,
      snapchatFee: 160, snapchatCommission: 4,
      bingFee: 120, bingCommission: 3,
      creatorId: admin.id,
    },
  })

  const agent2 = await prisma.user.create({
    data: {
      email: 'agent2@test.6ad.io',
      password,
      plaintextPassword: 'test123',
      username: 'digital_edge',
      realName: 'Priya Mehta',
      phone: '+91 9000000003',
      role: UserRole.AGENT,
      status: UserStatus.ACTIVE,
      walletBalance: 18000,
      couponBalance: 5,
      emailVerified: true,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXR',
      brandName: 'Digital Edge Media',
      brandLogo: null,
      fbFee: 140, fbCommission: 4,
      googleFee: 180, googleCommission: 5,
      tiktokFee: 160, tiktokCommission: 4,
      snapchatFee: 150, snapchatCommission: 4,
      bingFee: 100, bingCommission: 3,
      creatorId: admin.id,
    },
  })

  const agent3 = await prisma.user.create({
    data: {
      email: 'agent3@test.6ad.io',
      password,
      plaintextPassword: 'test123',
      username: 'growth_media',
      realName: 'Vikram Singh',
      phone: '+91 9000000004',
      role: UserRole.AGENT,
      status: UserStatus.ACTIVE,
      walletBalance: 32000,
      couponBalance: 15,
      emailVerified: true,
      twoFactorEnabled: false,
      brandName: 'Growth Media Solutions',
      brandLogo: null,
      fbFee: 130, fbCommission: 4.5,
      googleFee: 190, googleCommission: 5.5,
      tiktokFee: 170, tiktokCommission: 4.5,
      snapchatFee: 140, snapchatCommission: 3.5,
      bingFee: 110, bingCommission: 2.5,
      creatorId: admin.id,
    },
  })

  const agents = [agent1, agent2, agent3]
  console.log(`  ✅ Agent 1: agent1@test.6ad.io / test123 (AdsPro Digital)`)
  console.log(`  ✅ Agent 2: agent2@test.6ad.io / test123 (Digital Edge Media)`)
  console.log(`  ✅ Agent 3: agent3@test.6ad.io / test123 (Growth Media Solutions)\n`)

  // ============= 3. CREATE 96 REGULAR USERS (32 per agent) =============
  console.log('👥 Creating 96 Regular Users (32 per agent)...')

  const usedEmails = new Set<string>()
  const usedUsernames = new Set<string>()
  const allUsers: any[] = []

  for (let agentIdx = 0; agentIdx < 3; agentIdx++) {
    const agent = agents[agentIdx]
    for (let i = 0; i < 32; i++) {
      const globalIdx = agentIdx * 32 + i
      const firstName = INDIAN_FIRST_NAMES[globalIdx % INDIAN_FIRST_NAMES.length]
      const lastName = INDIAN_LAST_NAMES[globalIdx % INDIAN_LAST_NAMES.length]

      // Ensure unique email
      let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${globalIdx}@test.6ad.io`
      while (usedEmails.has(email)) {
        email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${globalIdx}${randomInt(100, 999)}@test.6ad.io`
      }
      usedEmails.add(email)

      // Ensure unique username
      let username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${globalIdx}`
      while (usedUsernames.has(username)) {
        username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${globalIdx}_${randomInt(100, 999)}`
      }
      usedUsernames.add(username)

      // Status distribution: ~85 ACTIVE, ~7 BLOCKED, ~4 INACTIVE
      let status: UserStatus = UserStatus.ACTIVE
      if (globalIdx % 14 === 13) status = UserStatus.BLOCKED
      if (globalIdx % 24 === 23) status = UserStatus.INACTIVE

      const walletBalance = randomFloat(0, 10000)
      const couponBalance = randomInt(0, 20)
      const has2FA = globalIdx % 5 === 0 // 20% have 2FA
      const daysAgo = randomInt(1, 180)

      allUsers.push(
        prisma.user.create({
          data: {
            email,
            password,
            plaintextPassword: 'test123',
            username,
            realName: `${firstName} ${lastName}`,
            phone: `+91 ${9100000000 + globalIdx}`,
            role: UserRole.USER,
            status,
            walletBalance,
            couponBalance,
            emailVerified: true,
            twoFactorEnabled: has2FA,
            twoFactorSecret: has2FA ? `TEST2FA${String(globalIdx).padStart(10, '0')}` : null,
            agentId: agent.id,
            creatorId: agent.id,
            createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          },
        })
      )
    }
  }

  const users = await Promise.all(allUsers)
  console.log(`  ✅ Created ${users.length} regular users (all password: test123)\n`)

  // ============= 4. CREATE AD ACCOUNTS (~3-5 per user = ~300-400 total) =============
  console.log('📊 Creating Ad Accounts (3-5 per user)...')

  const adAccountPromises: any[] = []
  const adAccountMap: Map<string, any[]> = new Map() // userId -> account data for later use

  for (const user of users) {
    const numAccounts = randomInt(3, 5)
    const userAccounts: any[] = []

    for (let j = 0; j < numAccounts; j++) {
      const platform = PLATFORMS[j % PLATFORMS.length]
      const status = pick(ACCOUNT_STATUSES)
      const isApproved = status === AccountStatus.APPROVED

      let accountId: string
      switch (platform) {
        case Platform.FACEBOOK:
          accountId = `act_${randomInt(100000000, 999999999)}`
          break
        case Platform.GOOGLE:
          accountId = `${randomInt(100, 999)}-${randomInt(100, 999)}-${randomInt(1000, 9999)}`
          break
        case Platform.TIKTOK:
          accountId = `${randomInt(7000000000, 7999999999)}`
          break
        case Platform.SNAPCHAT:
          accountId = `snap_${randomInt(10000000, 99999999)}`
          break
        case Platform.BING:
          accountId = `bing_${randomInt(10000000, 99999999)}`
          break
        default:
          accountId = `acc_${randomInt(10000000, 99999999)}`
      }

      const totalDeposit = isApproved ? randomFloat(100, 5000) : 0
      const spendPct = randomFloat(0.5, 0.8)
      const totalSpend = isApproved ? parseFloat((totalDeposit * spendPct).toFixed(2)) : 0
      const balance = isApproved ? parseFloat((totalDeposit - totalSpend).toFixed(2)) : 0

      const accountData = {
        platform,
        accountId,
        accountName: `${platform} ${['Ecommerce', 'Brand', 'Lead Gen', 'Performance', 'Retargeting'][j % 5]} Account`,
        licenseName: `License ${randomInt(1000, 9999)}`,
        bmId: platform === Platform.FACEBOOK ? `${randomInt(100000000, 999999999)}` : null,
        timezone: pick(TIMEZONES),
        status,
        totalDeposit,
        totalSpend,
        balance,
        userId: user.id,
        createdAt: randomDate(120),
      }

      userAccounts.push(accountData)
      adAccountPromises.push(prisma.adAccount.create({ data: accountData }))
    }
    adAccountMap.set(user.id, userAccounts)
  }

  const adAccounts = await Promise.all(adAccountPromises)
  console.log(`  ✅ Created ${adAccounts.length} ad accounts\n`)

  // ============= 5. CREATE AD ACCOUNT APPLICATIONS (~150) =============
  console.log('📝 Creating Ad Account Applications (~150)...')

  const applicationPromises: any[] = []
  const APPLICATION_STATUSES = [TransactionStatus.APPROVED, TransactionStatus.APPROVED, TransactionStatus.PENDING, TransactionStatus.COMPLETED, TransactionStatus.REJECTED]
  const LICENSE_TYPES: LicenseType[] = [LicenseType.NEW, LicenseType.NEW, LicenseType.NEW, LicenseType.OLD] // 70% NEW

  for (let i = 0; i < 150; i++) {
    const user = pick(users)
    const platform = pick(PLATFORMS)
    const status = pick(APPLICATION_STATUSES)
    const licenseType = pick(LICENSE_TYPES)
    const depositAmount = randomFloat(100, 2000)
    const openingFee = randomFloat(100, 200)
    const platformFee = randomFloat(3, 6)
    const totalCost = parseFloat((depositAmount + openingFee + (depositAmount * platformFee / 100)).toFixed(2))

    applicationPromises.push(
      prisma.adAccountApplication.create({
        data: {
          applyId: generateId('AD'),
          platform,
          licenseType,
          accountDetails: JSON.stringify([{ name: `${platform} Account`, accountId: '' }]),
          adAccountQty: randomInt(1, 3),
          depositAmount,
          openingFee,
          platformFee,
          totalCost,
          status,
          userId: user.id,
          approvedAt: status === TransactionStatus.APPROVED || status === TransactionStatus.COMPLETED ? randomDate(60) : null,
          createdAt: randomDate(90),
        },
      })
    )
  }

  const applications = await Promise.all(applicationPromises)
  console.log(`  ✅ Created ${applications.length} ad account applications\n`)

  // ============= 6. CREATE DEPOSITS (~250-300) =============
  console.log('💰 Creating Deposits (2-4 per user)...')

  const depositPromises: any[] = []
  const DEPOSIT_STATUSES = [TransactionStatus.APPROVED, TransactionStatus.APPROVED, TransactionStatus.PENDING, TransactionStatus.PENDING, TransactionStatus.COMPLETED, TransactionStatus.REJECTED]

  for (const user of users) {
    const numDeposits = randomInt(2, 4)
    for (let j = 0; j < numDeposits; j++) {
      const status = pick(DEPOSIT_STATUSES)
      const amount = randomFloat(50, 5000)
      const paymentMethod = pick(PAYMENT_METHODS)
      const createdAt = randomDate(90)

      depositPromises.push(
        prisma.deposit.create({
          data: {
            applyId: generateId('WD'),
            amount,
            status,
            paymentMethod,
            transactionId: status !== TransactionStatus.PENDING ? `TXN${Date.now()}${randomInt(1000, 9999)}` : null,
            paymentProof: status !== TransactionStatus.PENDING ? `https://placehold.co/400x300/7C3AED/white?text=Proof` : null,
            userId: user.id,
            approvedAt: status === TransactionStatus.APPROVED ? createdAt : null,
            rejectedAt: status === TransactionStatus.REJECTED ? createdAt : null,
            createdAt,
          },
        })
      )
    }
  }

  const deposits = await Promise.all(depositPromises)
  console.log(`  ✅ Created ${deposits.length} deposits\n`)

  // ============= 7. CREATE WITHDRAWALS (~50-80) =============
  console.log('📤 Creating Withdrawals (0-1 per user)...')

  const withdrawalPromises: any[] = []
  const WITHDRAWAL_STATUSES = [TransactionStatus.APPROVED, TransactionStatus.APPROVED, TransactionStatus.PENDING, TransactionStatus.PENDING, TransactionStatus.REJECTED]

  for (const user of users) {
    // ~60% of users have a withdrawal
    if (Math.random() > 0.6) continue

    const status = pick(WITHDRAWAL_STATUSES)
    const amount = randomFloat(50, 2000)
    const bankName = pick(INDIAN_BANK_NAMES)
    const ifscPrefix = pick(IFSC_PREFIXES)
    const createdAt = randomDate(60)

    withdrawalPromises.push(
      prisma.withdrawal.create({
        data: {
          amount,
          status,
          bankName,
          accountNumber: `${randomInt(10000000, 99999999)}${randomInt(1000, 9999)}`,
          accountHolderName: user.realName || 'Account Holder',
          ifscCode: `${ifscPrefix}${randomInt(10000, 99999)}`,
          userId: user.id,
          approvedAt: status === TransactionStatus.APPROVED ? createdAt : null,
          rejectedAt: status === TransactionStatus.REJECTED ? createdAt : null,
          createdAt,
        },
      })
    )
  }

  const withdrawals = await Promise.all(withdrawalPromises)
  console.log(`  ✅ Created ${withdrawals.length} withdrawals\n`)

  // ============= 8. CREATE ACCOUNT DEPOSITS / RECHARGES (~200-300) =============
  console.log('💳 Creating Account Deposits / Recharges...')

  const accountDepositPromises: any[] = []
  const RECHARGE_STATUSES = ['COMPLETED', 'COMPLETED', 'PENDING', 'IN_PROGRESS', 'FAILED']
  const RECHARGE_METHODS = ['CHEETAH', 'EXTENSION', 'MANUAL']

  // Only for APPROVED ad accounts
  const approvedAccounts = adAccounts.filter(a => a.status === AccountStatus.APPROVED)
  for (const account of approvedAccounts) {
    const numDeposits = randomInt(1, 3)
    for (let j = 0; j < numDeposits; j++) {
      const amount = randomFloat(100, 2000)
      const commissionRate = randomFloat(3, 6)
      const commissionAmount = parseFloat((amount * commissionRate / 100).toFixed(2))
      const rechargeStatus = pick(RECHARGE_STATUSES)
      const rechargeMethod = rechargeStatus === 'COMPLETED' ? pick(RECHARGE_METHODS) : 'NONE'
      const createdAt = randomDate(60)

      accountDepositPromises.push(
        prisma.accountDeposit.create({
          data: {
            applyId: generateId('RC'),
            amount,
            status: rechargeStatus === 'COMPLETED' ? TransactionStatus.APPROVED : TransactionStatus.PENDING,
            commissionRate,
            commissionAmount,
            adAccountId: account.id,
            rechargeStatus,
            rechargeMethod,
            rechargeAttempts: rechargeStatus === 'FAILED' ? randomInt(1, 3) : (rechargeStatus === 'COMPLETED' ? 1 : 0),
            rechargeError: rechargeStatus === 'FAILED' ? 'Cheetah API timeout' : null,
            rechargedAt: rechargeStatus === 'COMPLETED' ? createdAt : null,
            approvedAt: rechargeStatus === 'COMPLETED' ? createdAt : null,
            createdAt,
          },
        })
      )
    }
  }

  const accountDeposits = await Promise.all(accountDepositPromises)
  console.log(`  ✅ Created ${accountDeposits.length} account deposits / recharges\n`)

  // ============= 9. CREATE WALLET FLOWS (~500-600) =============
  console.log('📈 Creating Wallet Flows...')

  const walletFlowPromises: any[] = []

  // Create flows for deposits
  for (const deposit of deposits) {
    if (deposit.status === TransactionStatus.APPROVED || deposit.status === TransactionStatus.COMPLETED) {
      const balanceBefore = randomFloat(0, 5000)
      walletFlowPromises.push(
        prisma.walletFlow.create({
          data: {
            type: TransactionType.DEPOSIT,
            amount: deposit.amount,
            balanceBefore,
            balanceAfter: parseFloat((balanceBefore + deposit.amount).toFixed(2)),
            referenceId: deposit.id,
            referenceType: 'deposit',
            userId: deposit.userId,
            description: `Wallet deposit via ${deposit.paymentMethod || 'Bank Transfer'}`,
            createdAt: deposit.createdAt,
          },
        })
      )
    }
  }

  // Create flows for withdrawals
  for (const withdrawal of withdrawals) {
    if (withdrawal.status === TransactionStatus.APPROVED) {
      const balanceBefore = randomFloat(500, 8000)
      walletFlowPromises.push(
        prisma.walletFlow.create({
          data: {
            type: TransactionType.WITHDRAWAL,
            amount: -withdrawal.amount,
            balanceBefore,
            balanceAfter: parseFloat((balanceBefore - withdrawal.amount).toFixed(2)),
            referenceId: withdrawal.id,
            referenceType: 'withdrawal',
            userId: withdrawal.userId,
            description: `Withdrawal to ${withdrawal.bankName}`,
            createdAt: withdrawal.createdAt,
          },
        })
      )
    }
  }

  // Create additional refund and credit flows
  for (let i = 0; i < 100; i++) {
    const user = pick(users)
    const isRefund = i % 3 === 0
    const amount = randomFloat(50, 1000)
    const balanceBefore = randomFloat(100, 5000)

    walletFlowPromises.push(
      prisma.walletFlow.create({
        data: {
          type: isRefund ? TransactionType.REFUND : TransactionType.CREDIT,
          amount,
          balanceBefore,
          balanceAfter: parseFloat((balanceBefore + amount).toFixed(2)),
          referenceId: `ref_${Date.now()}_${i}`,
          referenceType: isRefund ? 'refund' : 'bonus',
          userId: user.id,
          description: isRefund ? 'Refund from ad account closure' : 'Bonus credit added',
          createdAt: randomDate(90),
        },
      })
    )
  }

  const walletFlows = await Promise.all(walletFlowPromises)
  console.log(`  ✅ Created ${walletFlows.length} wallet flow records\n`)

  // ============= 10. CREATE REFUNDS (~30-40) =============
  console.log('🔄 Creating Refunds...')

  const refundPromises: any[] = []
  const REFUND_STATUSES = [TransactionStatus.APPROVED, TransactionStatus.APPROVED, TransactionStatus.PENDING, TransactionStatus.PENDING, TransactionStatus.REJECTED]
  const REFUND_REASONS = [
    'Ad account disabled by platform',
    'Unused balance from closed account',
    'Overcharged on commission',
    'Service not rendered',
    'Duplicate deposit refund',
    'Platform policy change refund',
  ]

  for (let i = 0; i < 35; i++) {
    const user = pick(users)
    const platform = pick(PLATFORMS)
    const status = pick(REFUND_STATUSES)
    const createdAt = randomDate(60)

    refundPromises.push(
      prisma.refund.create({
        data: {
          amount: randomFloat(20, 500),
          status,
          platform,
          accountId: `acc_${randomInt(100000, 999999)}`,
          userId: user.id,
          reason: pick(REFUND_REASONS),
          approvedAt: status === TransactionStatus.APPROVED ? createdAt : null,
          rejectedAt: status === TransactionStatus.REJECTED ? createdAt : null,
          createdAt,
        },
      })
    )
  }

  const refunds = await Promise.all(refundPromises)
  console.log(`  ✅ Created ${refunds.length} refunds\n`)

  // ============= 11. CREATE NOTIFICATIONS (~300-400) =============
  console.log('🔔 Creating Notifications (3-5 per user)...')

  const notificationPromises: any[] = []

  for (const user of users) {
    const numNotifications = randomInt(3, 5)
    for (let j = 0; j < numNotifications; j++) {
      const type = pick(NOTIFICATION_TYPES)
      const templates = NOTIFICATION_TEMPLATES[type]
      const template = pick(templates)
      const isRead = Math.random() > 0.4 // 60% read
      const createdAt = randomDate(30)

      notificationPromises.push(
        prisma.notification.create({
          data: {
            userId: user.id,
            type,
            title: template.title,
            message: template.message,
            isRead,
            readAt: isRead ? createdAt : null,
            createdAt,
          },
        })
      )
    }
  }

  const notifications = await Promise.all(notificationPromises)
  console.log(`  ✅ Created ${notifications.length} notifications\n`)

  // ============= 12. CREATE GLOBAL SETTINGS =============
  console.log('⚙️  Creating Global Settings...')

  await prisma.globalSettings.create({
    data: {
      payLinkEnabled: true,
      facebookStatus: 'active',
      googleStatus: 'active',
      tiktokStatus: 'active',
      snapchatStatus: 'active',
      bingStatus: 'active',
      showBalanceToAgents: true,
    },
  })
  console.log(`  ✅ Created global settings\n`)

  // ============= 13. CREATE PAYMENT METHODS =============
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
        walletAddress: 'TXz123abc456def789ghi012jkl345',
        isEnabled: true,
        sortOrder: 3,
      },
    }),
    prisma.paymentMethod.create({
      data: {
        name: 'USDT BEP20',
        description: 'Cryptocurrency payment via BSC network',
        icon: '🔶',
        walletAddress: '0x123abc456def789ghi012jkl345mno',
        isEnabled: true,
        sortOrder: 4,
      },
    }),
  ])
  console.log(`  ✅ Created 4 payment methods\n`)

  // ============= 14. CREATE ANNOUNCEMENTS =============
  console.log('📢 Creating Announcements...')

  await Promise.all([
    prisma.announcement.create({
      data: {
        title: 'Welcome to 6AD Test Platform!',
        message: 'This is a test environment with 100 users for comprehensive testing.',
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
    prisma.announcement.create({
      data: {
        title: 'Agent Commission Update',
        message: 'Commission rates have been updated for all platforms. Check your dashboard.',
        type: 'warning',
        isActive: true,
        targetRole: 'AGENT',
        createdById: admin.id,
      },
    }),
  ])
  console.log(`  ✅ Created 3 announcements\n`)

  // ============= SUMMARY =============
  console.log('\n' + '='.repeat(60))
  console.log('🎉 TEST DATABASE SEED COMPLETED SUCCESSFULLY!')
  console.log('='.repeat(60))
  console.log(`\n📊 Data Summary:`)
  console.log(`  👑 Admin:          1`)
  console.log(`  🏢 Agents:         3`)
  console.log(`  👥 Users:          ${users.length}`)
  console.log(`  📊 Ad Accounts:    ${adAccounts.length}`)
  console.log(`  📝 Applications:   ${applications.length}`)
  console.log(`  💰 Deposits:       ${deposits.length}`)
  console.log(`  📤 Withdrawals:    ${withdrawals.length}`)
  console.log(`  💳 Acct Deposits:  ${accountDeposits.length}`)
  console.log(`  📈 Wallet Flows:   ${walletFlows.length}`)
  console.log(`  🔄 Refunds:        ${refunds.length}`)
  console.log(`  🔔 Notifications:  ${notifications.length}`)
  console.log(`  ─────────────────────────`)
  console.log(`  📦 Total Records:  ${1 + 3 + users.length + adAccounts.length + applications.length + deposits.length + withdrawals.length + accountDeposits.length + walletFlows.length + refunds.length + notifications.length + 4 + 3 + 1}`)
  console.log('')
  console.log('📋 Test Accounts:')
  console.log('  ┌─────────────────────────────────────────────────────┐')
  console.log('  │ ADMIN                                               │')
  console.log('  │   Email:    admin@test.6ad.io                       │')
  console.log('  │   Password: admin123                                │')
  console.log('  │   2FA:      JBSWY3DPEHPK3PXP                       │')
  console.log('  ├─────────────────────────────────────────────────────┤')
  console.log('  │ AGENT 1 (AdsPro Digital)                            │')
  console.log('  │   Email:    agent1@test.6ad.io                      │')
  console.log('  │   Password: test123                                 │')
  console.log('  ├─────────────────────────────────────────────────────┤')
  console.log('  │ AGENT 2 (Digital Edge Media)                        │')
  console.log('  │   Email:    agent2@test.6ad.io                      │')
  console.log('  │   Password: test123                                 │')
  console.log('  ├─────────────────────────────────────────────────────┤')
  console.log('  │ AGENT 3 (Growth Media Solutions)                    │')
  console.log('  │   Email:    agent3@test.6ad.io                      │')
  console.log('  │   Password: test123                                 │')
  console.log('  ├─────────────────────────────────────────────────────┤')
  console.log('  │ ALL 96 USERS:  password = test123                   │')
  console.log('  │   Emails:  {firstname}.{lastname}{n}@test.6ad.io    │')
  console.log('  └─────────────────────────────────────────────────────┘')
  console.log('')
  console.log(`🔒 Database: ${TEST_DATABASE_URL}`)
  console.log(`📌 To inspect: DATABASE_URL="${TEST_DATABASE_URL}" npx prisma studio`)
  console.log('='.repeat(60) + '\n')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding test database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
