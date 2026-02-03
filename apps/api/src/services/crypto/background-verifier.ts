import { PrismaClient, CryptoNetwork } from '@prisma/client'
import { verifyTransaction } from './blockchain-verifier.js'
import { processDepositReferralReward } from '../referral-rewards.js'

const prisma = new PrismaClient()

// Configuration
const VERIFICATION_CONFIG = {
  POLL_INTERVAL_MS: 15000, // Check every 15 seconds
  MAX_RETRIES: 40, // Max verification attempts (~10 minutes total)
  RETRY_DELAY_MS: 15000, // Delay between retries
}

interface PendingDeposit {
  id: string
  txHash: string
  cryptoNetwork: CryptoNetwork
  amount: number
  userId: string
  paymentMethod: string
  retryCount?: number
}

// In-memory queue for pending verifications
const pendingVerifications: Map<string, PendingDeposit & { retryCount: number }> = new Map()

/**
 * Add a deposit to the background verification queue
 */
export function queueForVerification(deposit: PendingDeposit): void {
  if (!deposit.txHash || !deposit.cryptoNetwork) {
    console.error('[BackgroundVerifier] Invalid deposit - missing txHash or network')
    return
  }

  const key = deposit.txHash.toLowerCase()

  if (pendingVerifications.has(key)) {
    console.log(`[BackgroundVerifier] Deposit ${deposit.id} already in queue`)
    return
  }

  pendingVerifications.set(key, {
    ...deposit,
    txHash: key,
    retryCount: 0
  })

  console.log(`[BackgroundVerifier] Queued deposit ${deposit.id} for verification (${deposit.cryptoNetwork})`)
}

/**
 * Process a single pending deposit verification
 */
async function processVerification(deposit: PendingDeposit & { retryCount: number }): Promise<boolean> {
  const key = deposit.txHash.toLowerCase()

  try {
    console.log(`[BackgroundVerifier] Verifying ${deposit.id} (attempt ${deposit.retryCount + 1}/${VERIFICATION_CONFIG.MAX_RETRIES})`)

    // Detect actual network from transaction hash format
    const detectedNetwork = detectNetworkFromTxHash(deposit.txHash, deposit.cryptoNetwork)

    if (detectedNetwork !== deposit.cryptoNetwork) {
      console.log(`[BackgroundVerifier] Network mismatch detected: stored=${deposit.cryptoNetwork}, detected=${detectedNetwork}`)
      // Update the deposit's crypto network
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          cryptoNetwork: detectedNetwork,
          paymentMethod: detectedNetwork === 'TRON_TRC20' ? 'USDT TRC 20' : 'USDT BEP20'
        }
      })
      deposit.cryptoNetwork = detectedNetwork
    }

    // Get wallet config for the detected network
    const walletConfig = await prisma.cryptoWalletConfig.findUnique({
      where: { network: detectedNetwork }
    })

    // Also try payment method
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        OR: [
          { name: deposit.paymentMethod },
          { name: { contains: detectedNetwork === 'TRON_TRC20' ? 'TRC' : 'BEP' } }
        ]
      }
    })

    const walletAddress = walletConfig?.walletAddress || paymentMethod?.walletAddress

    if (!walletAddress) {
      console.error(`[BackgroundVerifier] No wallet address found for ${detectedNetwork}`)

      // Try the other network as fallback
      const otherNetwork = detectedNetwork === 'TRON_TRC20' ? 'BSC_BEP20' : 'TRON_TRC20'
      const otherConfig = await prisma.cryptoWalletConfig.findUnique({
        where: { network: otherNetwork as CryptoNetwork }
      })

      if (otherConfig?.walletAddress) {
        console.log(`[BackgroundVerifier] Trying fallback network: ${otherNetwork}`)
        const verification = await verifyTransaction(
          otherNetwork as 'TRON_TRC20' | 'BSC_BEP20',
          deposit.txHash,
          otherConfig.walletAddress
        )

        if (verification.valid) {
          // Update to correct network
          await prisma.deposit.update({
            where: { id: deposit.id },
            data: {
              cryptoNetwork: otherNetwork as CryptoNetwork,
              paymentMethod: otherNetwork === 'TRON_TRC20' ? 'USDT TRC 20' : 'USDT BEP20'
            }
          })
          deposit.cryptoNetwork = otherNetwork as CryptoNetwork
        }

        return await handleVerificationResult(deposit, verification, key)
      }

      pendingVerifications.delete(key)
      await markForManualReview(deposit.id, 'No wallet address configured')
      return false
    }

    // Verify using detected network
    let verification = await verifyTransaction(
      detectedNetwork as 'TRON_TRC20' | 'BSC_BEP20',
      deposit.txHash,
      walletAddress
    )

    // If "not found" error, try the other network
    if (!verification.valid && verification.error?.includes('not found')) {
      const otherNetwork = detectedNetwork === 'TRON_TRC20' ? 'BSC_BEP20' : 'TRON_TRC20'
      const otherConfig = await prisma.cryptoWalletConfig.findUnique({
        where: { network: otherNetwork as CryptoNetwork }
      })

      if (otherConfig?.walletAddress) {
        console.log(`[BackgroundVerifier] TX not found on ${detectedNetwork}, trying ${otherNetwork}`)
        const otherVerification = await verifyTransaction(
          otherNetwork as 'TRON_TRC20' | 'BSC_BEP20',
          deposit.txHash,
          otherConfig.walletAddress
        )

        if (otherVerification.valid || !otherVerification.error?.includes('not found')) {
          verification = otherVerification
          // Update to correct network
          await prisma.deposit.update({
            where: { id: deposit.id },
            data: {
              cryptoNetwork: otherNetwork as CryptoNetwork,
              paymentMethod: otherNetwork === 'TRON_TRC20' ? 'USDT TRC 20' : 'USDT BEP20'
            }
          })
          deposit.cryptoNetwork = otherNetwork as CryptoNetwork
        }
      }
    }

    return await handleVerificationResult(deposit, verification, key)
  } catch (error) {
    console.error(`[BackgroundVerifier] Error verifying ${deposit.id}:`, error)

    // Increment retry count
    deposit.retryCount++

    if (deposit.retryCount >= VERIFICATION_CONFIG.MAX_RETRIES) {
      console.log(`[BackgroundVerifier] Max retries reached for ${deposit.id}, marking for manual review`)
      await markForManualReview(deposit.id, 'Max verification attempts reached')
      pendingVerifications.delete(key)
      return false
    }

    return false
  }
}

/**
 * Handle verification result
 */
async function handleVerificationResult(
  deposit: PendingDeposit & { retryCount: number },
  verification: { valid: boolean; error?: string; amount?: number; from?: string; blockNumber?: string; confirmations?: number },
  key: string
): Promise<boolean> {
  if (!verification.valid) {
    deposit.retryCount++

    // Check if it's a retryable error (confirmations, not found - might be pending)
    const isRetryable = verification.error?.includes('confirmation') ||
                        verification.error?.includes('Insufficient') ||
                        verification.error?.includes('not found') ||
                        verification.error?.includes('pending')

    if (isRetryable) {
      if (deposit.retryCount >= VERIFICATION_CONFIG.MAX_RETRIES) {
        console.log(`[BackgroundVerifier] Max retries for ${deposit.id}: ${verification.error}`)
        await markForManualReview(deposit.id, verification.error || 'Max retries reached')
        pendingVerifications.delete(key)
        return false
      }

      // Don't update remarks during verification - keep it clean
      console.log(`[BackgroundVerifier] ${deposit.id}: ${verification.error}, will retry (${deposit.retryCount}/${VERIFICATION_CONFIG.MAX_RETRIES})`)
      return false
    }

    // Non-retryable error (recipient mismatch, no transfer found, etc.) - mark for manual review
    console.log(`[BackgroundVerifier] ${deposit.id} verification failed permanently: ${verification.error}`)
    await markForManualReview(deposit.id, verification.error || 'Verification failed')
    pendingVerifications.delete(key)
    return false
  }

  // Verification successful! Auto-approve
  console.log(`[BackgroundVerifier] ${deposit.id} verified successfully!`)
  await approveDeposit(deposit, verification)
  pendingVerifications.delete(key)
  return true
}

/**
 * Auto-approve a verified deposit
 */
async function approveDeposit(
  deposit: PendingDeposit,
  verification: { amount?: number; from?: string; blockNumber?: string; confirmations?: number }
): Promise<void> {
  try {
    const depositAmount = verification.amount || deposit.amount

    await prisma.$transaction(async (tx) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: deposit.userId }
      })

      if (!user) {
        throw new Error('User not found')
      }

      const balanceBefore = Number(user.walletBalance)
      const balanceAfter = balanceBefore + depositAmount

      // Update deposit to APPROVED - keep remarks empty (don't override user remarks)
      await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: 'APPROVED',
          amount: depositAmount,
          fromAddress: verification.from,
          blockNumber: verification.blockNumber,
          verifiedAt: new Date(),
          approvedAt: new Date()
        }
      })

      // Update user wallet balance
      await tx.user.update({
        where: { id: deposit.userId },
        data: { walletBalance: balanceAfter }
      })

      // Create wallet flow record
      await tx.walletFlow.create({
        data: {
          type: 'DEPOSIT',
          amount: depositAmount,
          balanceBefore,
          balanceAfter,
          referenceId: deposit.id,
          referenceType: 'deposit',
          userId: deposit.userId,
          description: `Wallet deposit approved`
        }
      })

      // Process referral rewards (first deposit bonus + lifetime commission)
      await processDepositReferralReward(deposit.userId, depositAmount, tx)

      console.log(`[BackgroundVerifier] Deposit ${deposit.id} approved. Balance: ${balanceBefore} -> ${balanceAfter}`)
    })
  } catch (error) {
    console.error(`[BackgroundVerifier] Error approving deposit ${deposit.id}:`, error)
    await markForManualReview(deposit.id, `Auto-approval failed: ${error}`)
  }
}

/**
 * Mark a deposit for manual admin review
 */
async function markForManualReview(depositId: string, reason: string): Promise<void> {
  try {
    await prisma.deposit.update({
      where: { id: depositId },
      data: {
        remarks: `Manual review required: ${reason}`
      }
    })
  } catch (error) {
    console.error(`[BackgroundVerifier] Error marking deposit ${depositId} for review:`, error)
  }
}

/**
 * Determine correct network from transaction hash format
 * TRON hashes are 64 hex chars without 0x prefix
 * BSC/ETH hashes are 66 chars with 0x prefix
 */
function detectNetworkFromTxHash(txHash: string, currentNetwork: CryptoNetwork): CryptoNetwork {
  const hash = txHash.toLowerCase().trim()

  // BSC/ETH hashes start with 0x
  if (hash.startsWith('0x')) {
    return 'BSC_BEP20'
  }

  // TRON hashes are 64 hex chars without 0x
  if (!hash.startsWith('0x') && hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
    return 'TRON_TRC20'
  }

  // Fall back to what was specified
  return currentNetwork
}

/**
 * Main verification loop
 */
async function runVerificationLoop(): Promise<void> {
  console.log(`[BackgroundVerifier] Processing ${pendingVerifications.size} pending verifications`)

  for (const [key, deposit] of pendingVerifications.entries()) {
    await processVerification(deposit)
    // Small delay between processing each deposit to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

/**
 * Load existing pending crypto deposits on startup
 */
async function loadPendingDeposits(): Promise<void> {
  try {
    const pendingDeposits = await prisma.deposit.findMany({
      where: {
        status: 'PENDING',
        cryptoNetwork: { not: null },
        txHash: { not: null }
      },
      select: {
        id: true,
        txHash: true,
        cryptoNetwork: true,
        amount: true,
        userId: true,
        paymentMethod: true
      }
    })

    console.log(`[BackgroundVerifier] Found ${pendingDeposits.length} pending crypto deposits`)

    for (const deposit of pendingDeposits) {
      if (deposit.txHash && deposit.cryptoNetwork) {
        queueForVerification({
          id: deposit.id,
          txHash: deposit.txHash,
          cryptoNetwork: deposit.cryptoNetwork,
          amount: deposit.amount,
          userId: deposit.userId,
          paymentMethod: deposit.paymentMethod
        })
      }
    }
  } catch (error) {
    console.error('[BackgroundVerifier] Error loading pending deposits:', error)
  }
}

// Interval reference for cleanup
let verificationInterval: NodeJS.Timeout | null = null

/**
 * Start the background verification service
 */
export async function startBackgroundVerifier(): Promise<void> {
  console.log('[BackgroundVerifier] Starting background verification service...')

  // Load existing pending deposits
  await loadPendingDeposits()

  // Start the verification loop
  verificationInterval = setInterval(async () => {
    if (pendingVerifications.size > 0) {
      await runVerificationLoop()
    }
  }, VERIFICATION_CONFIG.POLL_INTERVAL_MS)

  console.log(`[BackgroundVerifier] Service started. Polling every ${VERIFICATION_CONFIG.POLL_INTERVAL_MS / 1000}s`)
}

/**
 * Stop the background verification service
 */
export function stopBackgroundVerifier(): void {
  if (verificationInterval) {
    clearInterval(verificationInterval)
    verificationInterval = null
  }
  pendingVerifications.clear()
  console.log('[BackgroundVerifier] Service stopped')
}

/**
 * Get verification status for a deposit
 */
export function getVerificationStatus(txHash: string): { queued: boolean; retryCount?: number } {
  const key = txHash.toLowerCase()
  const pending = pendingVerifications.get(key)

  if (pending) {
    return { queued: true, retryCount: pending.retryCount }
  }

  return { queued: false }
}

/**
 * Get all pending verifications count
 */
export function getPendingCount(): number {
  return pendingVerifications.size
}
