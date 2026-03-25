/**
 * Recharge Audit Log
 *
 * Logs every recharge action for forensic investigation.
 * Fire-and-forget — never blocks the main flow.
 */

import { prisma } from '../lib/prisma.js'

export async function logRechargeAudit(data: {
  depositId: string
  adAccountId: string
  action: string
  actor: string
  previousCap?: number | null
  targetCap?: number | null
  actualCap?: number | null
  amount?: number | null
  error?: string | null
}): Promise<void> {
  try {
    await prisma.rechargeAuditLog.create({
      data: {
        depositId: data.depositId,
        adAccountId: data.adAccountId,
        action: data.action,
        actor: data.actor,
        previousCap: data.previousCap ?? undefined,
        targetCap: data.targetCap ?? undefined,
        actualCap: data.actualCap ?? undefined,
        amount: data.amount ?? undefined,
        error: data.error ?? undefined,
      },
    })
  } catch (err: any) {
    console.error(`[RechargeAudit] Failed to log ${data.action}: ${err.message}`)
  }
}
