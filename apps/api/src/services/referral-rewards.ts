import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Referral reward constants
const REFERRAL_REWARDS = {
  FIRST_DEPOSIT_REWARD: 5, // $5 reward when referred user makes first deposit
  AD_ACCOUNT_APPROVAL_REWARD: 15, // $15 reward when referred user's ad account is approved
  LIFETIME_COMMISSION_RATE: 0.005, // 0.5% of all wallet recharges
}

/**
 * Process referral reward when a user makes a deposit
 * - $5 reward for first deposit
 * - 0.5% lifetime commission on all deposits
 */
export async function processDepositReferralReward(
  userId: string,
  depositAmount: number,
  tx?: any // Prisma transaction client
): Promise<{ firstDepositReward: number; lifetimeReward: number; referrerId: string | null }> {
  const client = tx || prisma

  const result = {
    firstDepositReward: 0,
    lifetimeReward: 0,
    referrerId: null as string | null
  }

  try {
    // Get the user and check if they were referred
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, referredBy: true }
    })

    if (!user?.referredBy) {
      return result // User was not referred
    }

    result.referrerId = user.referredBy

    // Get the referrer
    const referrer = await client.user.findUnique({
      where: { id: user.referredBy },
      select: { id: true, walletBalance: true, referralEarnings: true }
    })

    if (!referrer) {
      return result // Referrer not found
    }

    // Check if this is the first approved deposit for this user
    const approvedDepositsCount = await client.deposit.count({
      where: {
        userId: userId,
        status: 'APPROVED'
      }
    })

    let totalReward = 0

    // First deposit reward ($5)
    if (approvedDepositsCount === 0) {
      // This is their first deposit (about to be approved)
      result.firstDepositReward = REFERRAL_REWARDS.FIRST_DEPOSIT_REWARD
      totalReward += REFERRAL_REWARDS.FIRST_DEPOSIT_REWARD
    }

    // Lifetime commission (0.5% of deposit amount)
    result.lifetimeReward = Number((depositAmount * REFERRAL_REWARDS.LIFETIME_COMMISSION_RATE).toFixed(2))
    totalReward += result.lifetimeReward

    if (totalReward > 0) {
      const balanceBefore = Number(referrer.walletBalance)
      const balanceAfter = balanceBefore + totalReward

      // Update referrer's wallet balance and earnings
      await client.user.update({
        where: { id: referrer.id },
        data: {
          walletBalance: balanceAfter,
          referralEarnings: Number(referrer.referralEarnings) + totalReward
        }
      })

      // Create wallet flow record for referral reward
      let description = 'Referral reward'
      if (result.firstDepositReward > 0 && result.lifetimeReward > 0) {
        description = `Referral reward: $${result.firstDepositReward} (first deposit) + $${result.lifetimeReward} (0.5% commission)`
      } else if (result.firstDepositReward > 0) {
        description = `Referral reward: $${result.firstDepositReward} (first deposit bonus)`
      } else if (result.lifetimeReward > 0) {
        description = `Referral commission: $${result.lifetimeReward} (0.5% of deposit)`
      }

      await client.walletFlow.create({
        data: {
          type: 'CREDIT',
          amount: totalReward,
          balanceBefore,
          balanceAfter,
          userId: referrer.id,
          referenceType: 'referral_reward',
          description
        }
      })

      console.log(`[ReferralRewards] Awarded $${totalReward} to referrer ${referrer.id} for user ${userId} deposit`)
    }

    return result
  } catch (error) {
    console.error('[ReferralRewards] Error processing deposit referral reward:', error)
    return result
  }
}

/**
 * Process referral reward when a user's ad account is approved
 * - $15 reward for first ad account approval
 */
export async function processAdAccountApprovalReward(
  userId: string,
  tx?: any // Prisma transaction client
): Promise<{ reward: number; referrerId: string | null }> {
  const client = tx || prisma

  const result = {
    reward: 0,
    referrerId: null as string | null
  }

  try {
    // Get the user and check if they were referred
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, referredBy: true }
    })

    if (!user?.referredBy) {
      return result // User was not referred
    }

    result.referrerId = user.referredBy

    // Check if we've already given this reward (only once per referred user)
    // We do this by checking for existing referral reward with this specific type
    const existingReward = await client.walletFlow.findFirst({
      where: {
        userId: user.referredBy,
        referenceType: 'referral_ad_account_approval',
        description: { contains: userId }
      }
    })

    if (existingReward) {
      console.log(`[ReferralRewards] Ad account approval reward already given for user ${userId}`)
      return result // Already rewarded
    }

    // Get the referrer
    const referrer = await client.user.findUnique({
      where: { id: user.referredBy },
      select: { id: true, walletBalance: true, referralEarnings: true }
    })

    if (!referrer) {
      return result // Referrer not found
    }

    result.reward = REFERRAL_REWARDS.AD_ACCOUNT_APPROVAL_REWARD

    const balanceBefore = Number(referrer.walletBalance)
    const balanceAfter = balanceBefore + result.reward

    // Update referrer's wallet balance and earnings
    await client.user.update({
      where: { id: referrer.id },
      data: {
        walletBalance: balanceAfter,
        referralEarnings: Number(referrer.referralEarnings) + result.reward
      }
    })

    // Create wallet flow record for referral reward
    await client.walletFlow.create({
      data: {
        type: 'CREDIT',
        amount: result.reward,
        balanceBefore,
        balanceAfter,
        userId: referrer.id,
        referenceType: 'referral_ad_account_approval',
        description: `Referral reward: $${result.reward} (ad account approved for user ${userId})`
      }
    })

    console.log(`[ReferralRewards] Awarded $${result.reward} to referrer ${referrer.id} for user ${userId} ad account approval`)

    return result
  } catch (error) {
    console.error('[ReferralRewards] Error processing ad account approval reward:', error)
    return result
  }
}

export { REFERRAL_REWARDS }
