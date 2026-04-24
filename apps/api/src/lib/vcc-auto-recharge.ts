import { prisma } from './prisma.js'
import { rechargeCard } from './yeewallex.js'

/**
 * When an ad-account deposit is approved, auto-recharge the VCC card
 * assigned to that ad account with the same amount. Fire-and-forget
 * semantics: errors are logged but never thrown — we must not break
 * the surrounding deposit flow.
 *
 * Call this AFTER the deposit has been marked APPROVED and the
 * adAccount balance incremented.
 */
export async function autoRechargeAssignedVccCard(params: {
  adAccountId: string
  amount: number
  reason: string          // Short tag for logs: 'ADMIN_APPROVE' | 'SPEND_CAP_VERIFY' | 'CHEETAH_CRON'
  depositId?: string
}): Promise<{ triggered: boolean; error?: string; cardId?: string }> {
  const { adAccountId, amount, reason, depositId } = params

  try {
    if (!amount || amount <= 0) {
      return { triggered: false, error: 'invalid amount' }
    }

    // Find the VCC card assigned to this ad account + fetch ad account info for audit trail
    const [card, adAccount] = await Promise.all([
      prisma.vccCard.findFirst({
        where: { assignedAdAccountId: adAccountId },
        select: { id: true, yeewallexCardId: true, status: true, label: true },
      }),
      prisma.adAccount.findUnique({
        where: { id: adAccountId },
        select: { accountId: true, accountName: true, platform: true },
      }),
    ])
    const adAcctLabel = adAccount
      ? `${adAccount.accountName || 'Unnamed'} (${adAccount.accountId})`
      : `ad-account:${adAccountId}`

    if (!card) {
      console.log(`[VCC-AutoRecharge] ${reason}: no card assigned to ad account ${adAccountId} — skip`)
      return { triggered: false }
    }

    if (!card.yeewallexCardId) {
      console.log(`[VCC-AutoRecharge] ${reason}: card ${card.id} has no yeewallexCardId — skip`)
      if (depositId) {
        await prisma.accountDeposit.update({
          where: { id: depositId },
          data: { cardPaymentStatus: 'FAILED', vccRechargeError: 'card not issued yet' },
        }).catch(() => {})
      }
      return { triggered: false, cardId: card.id, error: 'no yeewallexCardId' }
    }

    if (card.status !== 'ACTIVE') {
      console.log(`[VCC-AutoRecharge] ${reason}: card ${card.id} status=${card.status}, not ACTIVE — skip`)
      if (depositId) {
        await prisma.accountDeposit.update({
          where: { id: depositId },
          data: { cardPaymentStatus: 'FAILED', vccCardId: card.id, vccRechargeError: `card is ${card.status}` },
        }).catch(() => {})
      }
      return { triggered: false, cardId: card.id, error: `card status ${card.status}` }
    }

    // ATOMIC CLAIM: mark as PENDING only if not already PENDING/DONE.
    // MongoDB's updateMany with a conditional `where` is atomic — only ONE concurrent
    // caller can match this filter. Any subsequent caller sees count=0 and bails out.
    // This prevents the race condition where 2 verifier cycles both fire the VCC charge.
    if (depositId) {
      const claim = await prisma.accountDeposit.updateMany({
        where: {
          id: depositId,
          cardPaymentStatus: { notIn: ['PENDING', 'DONE', 'FAILED'] as any },
        },
        data: { cardPaymentStatus: 'PENDING', vccCardId: card.id, vccRechargeError: null },
      })
      if (claim.count === 0) {
        console.log(`[VCC-AutoRecharge] ${reason}: ⛔ deposit ${depositId} already has cardPaymentStatus in PENDING/DONE/FAILED — SKIP (race prevented)`)
        return { triggered: false, cardId: card.id, error: 'already claimed — double-charge prevented' }
      }
    }

    console.log(`[VCC-AutoRecharge] ${reason}: recharging card ${card.id} (YW:${card.yeewallexCardId}) with $${amount} (deposit ${depositId || 'n/a'})`)

    // Recharge from wallet (USDT) — Yeewallex defaults to USDT when currency omitted
    const result = await rechargeCard({ cardId: card.yeewallexCardId, amount, currency: 'USDT' })

    // Persist an audit transaction regardless of pass/fail
    const rd = result.data?.data || result.data || {}
    const rechargeId = rd.rechargeId || rd.id || null
    const isOk = !result.error && rd.status !== 400 && rd.status !== 500 && (result.data?.state === 'SUCCESS' || rd.status === 'SUCCESS' || rd.status === 200 || rd.status === 100)

    // yeewallexTxId is @unique. MongoDB treats nulls as equal under unique indexes,
    // so we MUST supply a unique value even when YeewalleX returns no rechargeId.
    // Use a synthetic AUTO:<depositId>:<timestamp> tag so multiple null-ID rows can coexist.
    const syntheticTxId = rechargeId || `AUTO:${depositId || adAccountId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

    await prisma.vccTransaction.create({
      data: {
        cardId: card.id,
        type: 'RECHARGE',
        amount,
        currency: 'USDT',
        status: isOk ? 'SUCCESS' : 'FAILED',
        description: `Auto-recharge from ${adAcctLabel} deposit`,
        yeewallexTxId: syntheticTxId,
        metadata: {
          reason, depositId, adAccountId,
          adAccountAccountId: adAccount?.accountId || null,
          adAccountName: adAccount?.accountName || null,
          adAccountPlatform: adAccount?.platform || null,
          yeewallexResult: result,
        } as any,
      },
    }).catch((err) => console.error(`[VCC-AutoRecharge] failed to persist VccTransaction:`, err.message))

    if (!isOk) {
      console.error(`[VCC-AutoRecharge] ${reason}: Yeewallex recharge FAILED for card ${card.id}: ${result.message || JSON.stringify(rd)}`)
      if (depositId) {
        await prisma.accountDeposit.update({
          where: { id: depositId },
          data: {
            cardPaymentStatus: 'FAILED',
            vccCardId: card.id,
            vccRechargeError: (result.message || 'yeewallex failed').slice(0, 500),
          },
        }).catch(() => {})
      }
      return { triggered: true, cardId: card.id, error: result.message || 'yeewallex failed' }
    }

    // Success: mark deposit as DONE only if it is still PENDING (set by our atomic claim above).
    // If another process already flipped it to DONE, we leave it alone — no overwrite.
    if (depositId) {
      await prisma.accountDeposit.updateMany({
        where: { id: depositId, cardPaymentStatus: 'PENDING' },
        data: {
          cardPaymentStatus: 'DONE',
          cardPaymentDoneAt: new Date(),
          vccCardId: card.id,
          vccRechargeTxId: rechargeId || undefined,
          vccRechargeError: null,
        },
      }).catch(() => {})
    }

    console.log(`[VCC-AutoRecharge] ${reason}: ✅ recharged card ${card.id} with $${amount} (rechargeId=${rechargeId})`)
    return { triggered: true, cardId: card.id }
  } catch (err: any) {
    // Never throw — deposit flow must not be interrupted
    console.error(`[VCC-AutoRecharge] ${reason}: unexpected error:`, err.message)
    return { triggered: false, error: err.message }
  }
}
