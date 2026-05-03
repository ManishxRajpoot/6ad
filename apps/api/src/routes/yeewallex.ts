import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken } from '../middleware/auth'
import {
  getAccountInfo, getCardBins, addCardholder, openCard, getCardOpenTask,
  activateCard, getCardKeyInfo, rechargeCard, getRechargeStatus,
  withdrawCard, freezeCard, unfreezeCard, cancelCard, refundCardBalance, getCards,
  getCardDetail, getTransactions, getCardholders, CARD_BINS, rawRequest,
} from '../lib/yeewallex.js'

const yeewallex = new Hono()

// Helper: check admin role
function isAdmin(c: any): boolean {
  return c.get('userRole') === 'ADMIN'
}

// ============================================================
// WEBHOOK (unauthenticated — called by Yeewallex servers)
// ============================================================

yeewallex.post('/webhook', async (c) => {
  try {
    const body = await c.req.json()
    console.log('[Yeewallex Webhook] Received:', JSON.stringify(body).slice(0, 500))

    const eventType = body.type || body.event || body.notifyType || 'unknown'

    // Store raw event
    await prisma.cmsAnalytics.create({
      data: {
        event: `yeewallex_webhook_${eventType}`,
        metadata: body,
        ip: c.req.header('x-forwarded-for') || 'unknown',
        userAgent: c.req.header('user-agent') || '',
      },
    })

    // Process event: update VCC models
    const cardId = body.cardId || body.card_id
    if (cardId) {
      const card = await prisma.vccCard.findFirst({ where: { yeewallexCardId: cardId } })

      if (card) {
        // Update card balance if provided
        if (body.balance !== undefined) {
          await prisma.vccCard.update({ where: { id: card.id }, data: { balance: parseFloat(body.balance) } })
        }

        // Update card status if provided
        if (body.cardStatus || body.status) {
          const statusMap: Record<string, string> = {
            'ACTIVE': 'ACTIVE', 'INACTIVE': 'INACTIVE', 'FROZEN': 'FROZEN',
            'CANCELLED': 'CANCELLED', 'CLOSED': 'CANCELLED',
          }
          const newStatus = statusMap[(body.cardStatus || body.status)] as any
          if (newStatus) {
            await prisma.vccCard.update({ where: { id: card.id }, data: { status: newStatus } })
          }
        }

        // Create transaction record if it's a transaction event
        if (eventType.toLowerCase().includes('transaction') || body.transactionId) {
          const txId = body.transactionId || body.transaction_id || `wh_${Date.now()}`
          const existing = await prisma.vccTransaction.findFirst({ where: { yeewallexTxId: txId } })
          if (!existing) {
            await prisma.vccTransaction.create({
              data: {
                yeewallexTxId: txId,
                type: body.transactionType === 'REFUND' ? 'REFUND' : 'PURCHASE',
                amount: parseFloat(body.amount || '0'),
                currency: body.currency || 'USD',
                status: 'SUCCESS',
                merchantName: body.merchantName || body.merchant_name || null,
                merchantCategory: body.mcc || null,
                merchantCountry: body.merchantCountry || null,
                description: body.description || null,
                metadata: body,
                cardId: card.id,
              },
            })
          }
        }
      }
    }

    return c.json({ success: true, message: 'Webhook received' }, 200)
  } catch (error) {
    console.error('[Yeewallex Webhook] Error:', error)
    return c.json({ success: true, message: 'Webhook received' }, 200)
  }
})

yeewallex.get('/webhook', (c) => {
  return c.json({ status: 'ok', service: 'yeewallex-webhook', timestamp: new Date().toISOString() })
})

// ============================================================
// ALL ROUTES BELOW REQUIRE AUTHENTICATION
// ============================================================
yeewallex.use('/*', verifyToken)

// ============================================================
// ADMIN ROUTES
// ============================================================

// POST /probe — Admin-only: probe arbitrary Yeewallex endpoint via signed request.
// Body: { method: 'GET'|'POST', path: '/rest/v1.0/vcc/...', params?: object }
yeewallex.post('/probe', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const { method, path, params } = await c.req.json()
  if (!method || !path) return c.json({ error: 'method + path required' }, 400)
  const result = await rawRequest(method as any, path, params || {})
  return c.json(result)
})

// POST /sync — Pull cardholders from Yeewallex API into local DB
yeewallex.post('/sync', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)

  let synced = { cardholders: 0 }

  try {
    // Fetch cardholders from Yeewallex
    const holdersResult = await getCardholders()
    if (holdersResult.error) return c.json({ error: `Failed: ${holdersResult.message}` }, 400)

    const remoteHolders = holdersResult.data?.data || []

    for (const rh of remoteHolders) {
      const yhId = String(rh.id)
      const existing = await prisma.vccCardholder.findFirst({ where: { yeewallexId: yhId } })
      if (existing) continue

      await prisma.vccCardholder.create({
        data: {
          yeewallexId: yhId,
          firstName: rh.firstName || 'Unknown',
          lastName: rh.lastName || '',
          email: rh.email || null,
          phone: rh.phone || null,
        },
      })
      synced.cardholders++
    }

    const statusMap: Record<string, string> = {
      '100': 'ACTIVE', '200': 'FROZEN', '300': 'CANCELLED', '400': 'INACTIVE',
      'normal': 'ACTIVE', 'freeze': 'FROZEN', 'cancel': 'CANCELLED',
      'NORMAL': 'ACTIVE', 'FREEZE': 'FROZEN', 'CANCELED': 'CANCELLED', 'CANCEL': 'CANCELLED',
    }

    let cardsSynced = 0        // new DB rows created from remote discoveries
    let cardsUpdated = 0       // existing DB rows refreshed with live data
    let cardsPromoted = 0      // PENDING → ACTIVE (task completed)
    const discoveredCardIds = new Set<string>()

    try {
      // 1) PROMOTE pending cards whose YeewalleX task finished (taskId → cardId)
      const pendingCards = await prisma.vccCard.findMany({
        where: { AND: [{ yeewallexCardId: null }, { taskId: { not: null } }] },
        select: { id: true, taskId: true },
      })
      for (const card of pendingCards) {
        try {
          const task = await getCardOpenTask(card.taskId!)
          const rd = task.data?.data || task.data || {}
          const taskStatus = rd.status || rd.taskStatus
          const cardList = rd.cardList || rd.card_list || []
          const firstCard = cardList[0] || {}
          const issuedCardId = firstCard.cardId || rd.cardId || rd.card_id
          if (issuedCardId && (taskStatus === 'SUCCESS' || taskStatus === 'COMPLETED' || taskStatus === 200 || taskStatus === 100)) {
            const cn = firstCard.cardNumber || null
            const masked = cn && cn.length > 10 && !cn.includes('*') ? cn.substring(0, 6) + '******' + cn.substring(cn.length - 4) : cn
            await prisma.vccCard.update({
              where: { id: card.id },
              data: { yeewallexCardId: issuedCardId, status: 'ACTIVE', ...(masked ? { cardNumber: masked } : {}) },
            })
            cardsPromoted++
          } else if (taskStatus === 'FAILED' || taskStatus === 'FAIL') {
            await prisma.vccCard.update({ where: { id: card.id }, data: { status: 'FAILED' as any } }).catch(() => {})
          }
        } catch (e: any) {
          console.log(`[Yeewallex Sync] Task promote failed for ${card.taskId}: ${e.message}`)
        }
      }

      // 2) DISCOVER remote cardIds via /vcc/user-cards (paginated — walk until we get <size records)
      //    YeewalleX's docs-advertised /vcc/cards returns 99001002; /vcc/user-cards is the real endpoint.
      const remoteCardsByYwId = new Map<string, any>()
      try {
        for (let page = 1; page <= 10; page++) {
          const listResult = await getCards({ page, size: 50 })
          const records = listResult.data?.data?.records || []
          for (const rc of records) {
            const ywId = rc.cardId || rc.id
            if (ywId) {
              remoteCardsByYwId.set(ywId, rc)
              discoveredCardIds.add(ywId)
            }
          }
          if (records.length < 50) break
        }
        console.log(`[Yeewallex Sync] /vcc/user-cards discovered ${discoveredCardIds.size} cardIds`)
      } catch (e: any) {
        console.log(`[Yeewallex Sync] user-cards list failed: ${e.message}`)
      }

      // Also harvest cardIds from transactions as a secondary safety net.
      try {
        const txResult = await getTransactions({ page: 1, size: 200 })
        const txs = txResult.data?.data?.list || txResult.data?.data?.records || txResult.data?.list || txResult.data?.records || (Array.isArray(txResult.data?.data) ? txResult.data.data : []) || []
        for (const tx of txs) {
          const ywId = tx.cardId || tx.card_id
          if (ywId) discoveredCardIds.add(ywId)
        }
        console.log(`[Yeewallex Sync] After transactions harvest: ${discoveredCardIds.size} cardIds`)
      } catch (e: any) {
        console.log(`[Yeewallex Sync] Transactions harvest failed: ${e.message}`)
      }

      // 3) BACK-FILL any discovered cardId not in our DB.
      // VccCard.taskId is @unique and MongoDB treats every null as equal, so a second
      // orphan row with null taskId triggers P2002. Give orphans a synthetic unique
      // placeholder ("ORPHAN:<cardId>") to satisfy the constraint, and clean up any
      // pre-existing rows that are already holding the null slot.
      const nullTaskRows = await prisma.vccCard.findMany({
        where: { AND: [{ taskId: null }, { yeewallexCardId: { not: null } }] },
        select: { id: true, yeewallexCardId: true },
      })
      for (const row of nullTaskRows) {
        await prisma.vccCard.update({
          where: { id: row.id },
          data: { taskId: `ORPHAN:${row.yeewallexCardId}` },
        }).catch(err => console.log(`[Yeewallex Sync] Failed to unblock null taskId for ${row.yeewallexCardId}: ${err.message}`))
      }

      const existingYwIds = new Set(
        (await prisma.vccCard.findMany({ where: { yeewallexCardId: { not: null } }, select: { yeewallexCardId: true } }))
          .map(c => c.yeewallexCardId!)
      )
      const allHolders = await prisma.vccCardholder.findMany({ select: { id: true, yeewallexId: true } })
      const holderByYwId = new Map(allHolders.map(h => [h.yeewallexId, h.id]))
      const fallbackHolderId = allHolders[0]?.id || null

      for (const ywId of discoveredCardIds) {
        if (existingYwIds.has(ywId)) continue
        try {
          // Prefer the record from the list (cheaper); fall back to a per-card detail fetch.
          let rd: any = remoteCardsByYwId.get(ywId)
          if (!rd) {
            const detail = await getCardDetail(ywId)
            if (detail.error || !detail.data) continue
            rd = detail.data?.data || detail.data || {}
          }
          const rcHolderYwId = rd.cardholder?.id || rd.cardholderId || rd.memberId
          const cardholderId = (rcHolderYwId && holderByYwId.get(String(rcHolderYwId))) || fallbackHolderId
          if (!cardholderId) {
            console.log(`[Yeewallex Sync] Skipping ${ywId} — no cardholder`)
            continue
          }
          const cn = rd.cardNumber
          const masked = cn && cn.length > 10 && !cn.includes('*') ? cn.substring(0, 6) + '******' + cn.substring(cn.length - 4) : cn
          const mappedStatus = (statusMap[String(rd.cardStatus)] || statusMap[String(rd.status)] || 'ACTIVE') as any
          await prisma.vccCard.create({
            data: {
              yeewallexCardId: ywId,
              taskId: `ORPHAN:${ywId}`, // Placeholder to satisfy @unique constraint on nullable taskId
              cardBinId: rd.cardBinId || CARD_BINS.ADS_USD,
              label: rd.alias || null,
              alias: rd.alias || null,
              status: mappedStatus,
              balance: rd.balance != null ? parseFloat(String(rd.balance)) : 0,
              currency: rd.currency || 'USD',
              cardNumber: masked || null,
              cardholderId,
            },
          })
          cardsSynced++
          console.log(`[Yeewallex Sync] Back-filled ${ywId}`)
        } catch (e: any) {
          console.log(`[Yeewallex Sync] Back-fill ${ywId} failed:`, e?.message, e?.code, e?.meta ? JSON.stringify(e.meta) : '', JSON.stringify(e).slice(0, 500))
        }
      }

      // 4) UPDATE every issued DB card with live status/balance/cardNumber.
      //    Prefer data from the already-fetched user-cards list; fall back to per-card detail.
      const issuedCards = await prisma.vccCard.findMany({
        where: { yeewallexCardId: { not: null } },
        select: { id: true, yeewallexCardId: true, cardNumber: true },
      })
      for (const card of issuedCards) {
        try {
          let rd: any = remoteCardsByYwId.get(card.yeewallexCardId!)
          if (!rd) {
            const detail = await getCardDetail(card.yeewallexCardId!)
            if (!detail.data) continue
            rd = detail.data?.data || detail.data || {}
          }
          const cardStatus = statusMap[String(rd.cardStatus)] || statusMap[String(rd.status)] || undefined
          const balance = rd.balance != null ? parseFloat(String(rd.balance)) : undefined
          const cn = rd.cardNumber
          const masked = cn && cn.length > 10 && !cn.includes('*') ? cn.substring(0, 6) + '******' + cn.substring(cn.length - 4) : cn
          await prisma.vccCard.update({
            where: { id: card.id },
            data: {
              ...(cardStatus ? { status: cardStatus as any } : {}),
              ...(balance !== undefined ? { balance } : {}),
              ...(masked && !card.cardNumber ? { cardNumber: masked } : {}),
            },
          })
          cardsUpdated++
        } catch (e: any) {
          console.log(`[Yeewallex Sync] Refresh ${card.yeewallexCardId} failed: ${e.message}`)
        }
      }
    } catch (cardErr: any) {
      console.error('[Yeewallex Sync] Card sync error:', cardErr.message)
    }

    const parts: string[] = []
    if (synced.cardholders) parts.push(`${synced.cardholders} new cardholders`)
    if (cardsPromoted) parts.push(`${cardsPromoted} pending cards activated`)
    if (cardsSynced) parts.push(`${cardsSynced} orphan cards recovered`)
    if (cardsUpdated) parts.push(`${cardsUpdated} cards refreshed`)
    if (!parts.length) parts.push('nothing to update')

    return c.json({
      success: true,
      message: parts.join(', '),
      synced: { ...synced, cardsSynced, cardsUpdated, cardsPromoted, discovered: discoveredCardIds.size },
    })
  } catch (err: any) {
    console.error('[Yeewallex Sync] Error:', err)
    return c.json({ error: err.message || 'Sync failed' }, 500)
  }
})

// GET /account-info — Yeewallex account balance
yeewallex.get('/account-info', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const result = await getAccountInfo()
  if (result.error) return c.json({ error: result.message }, 400)
  // Unwrap the nested YOP response: { data: { wallets, account, ... } } → { wallets, account, ... }
  const inner = result.data?.data || result.data || {}
  return c.json(inner)
})

// GET /card-bins — Available card BINs
yeewallex.get('/card-bins', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const result = await getCardBins()
  if (result.error) return c.json({ error: result.message }, 400)
  return c.json({ bins: result.data, productionBins: CARD_BINS })
})

// ── CARDHOLDERS ──

// POST /cardholders — Create a cardholder
yeewallex.post('/cardholders', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const body = await c.req.json()
  const { firstName, lastName, email, phone, idType, idNumber, userId } = body

  if (!firstName || !lastName) return c.json({ error: 'firstName and lastName required' }, 400)

  // Call Yeewallex API
  const result = await addCardholder({ firstName, lastName, email, phone, idType, idNumber })
  if (result.error) return c.json({ error: result.message, code: result.code }, 400)

  // Save to DB
  const cardholder = await prisma.vccCardholder.create({
    data: {
      yeewallexId: result.data.cardholderId || result.data.id || String(Date.now()),
      firstName, lastName, email, phone, idType, idNumber,
      userId: userId || null,
    },
  })

  return c.json({ cardholder }, 201)
})

// GET /cardholders — List cardholders
yeewallex.get('/cardholders', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  const [cardholders, total] = await Promise.all([
    prisma.vccCardholder.findMany({
      skip: (page - 1) * limit, take: limit,
      include: { user: { select: { id: true, username: true, email: true } }, _count: { select: { cards: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vccCardholder.count(),
  ])

  return c.json({ cardholders, total, page, limit })
})

// GET /cardholders/:id — Cardholder detail
yeewallex.get('/cardholders/:id', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const cardholder = await prisma.vccCardholder.findUnique({
    where: { id: c.req.param('id') },
    include: { user: { select: { id: true, username: true, email: true } }, cards: true },
  })
  if (!cardholder) return c.json({ error: 'Cardholder not found' }, 404)
  return c.json({ cardholder })
})

// ── CARDS ──

// POST /cards — Issue a new card
yeewallex.post('/cards', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const body = await c.req.json()
  const { cardholderId, cardBinId, label, alias, currency, amount } = body

  if (!cardholderId) return c.json({ error: 'cardholderId required' }, 400)

  // Get cardholder from DB
  const cardholder = await prisma.vccCardholder.findUnique({ where: { id: cardholderId } })
  if (!cardholder) return c.json({ error: 'Cardholder not found' }, 404)

  // Call Yeewallex API
  const result = await openCard({
    cardBinId: cardBinId || CARD_BINS.ADS_USD,
    cardholderId: cardholder.yeewallexId,
    currency: currency || 'USD',
    alias: alias || label || '',
    amount,
  })
  if (result.error) return c.json({ error: result.message, code: result.code }, 400)

  // Extract taskId from nested response: result.data may be {data: {taskId: "..."}} or {taskId: "..."}
  const rd = result.data?.data || result.data || {}
  const extractedTaskId = rd.taskId || rd.task_id || result.data?.taskId || null
  const extractedCardId = rd.cardId || rd.card_id || result.data?.cardId || null

  // Save card to DB (PENDING until task completes). If DB save fails, the YeewalleX
  // card still exists — return success with a warning so the next sync can back-fill it.
  try {
    const card = await prisma.vccCard.create({
      data: {
        taskId: extractedTaskId,
        yeewallexCardId: extractedCardId,
        cardBinId: cardBinId || CARD_BINS.ADS_USD,
        label: label || null,
        alias: alias || null,
        status: 'PENDING',
        currency: currency || 'USD',
        cardholderId: cardholder.id,
      },
    })
    return c.json({ card, taskId: extractedTaskId }, 201)
  } catch (dbErr: any) {
    console.error('[Yeewallex createCard] DB save failed, YeewalleX card exists:', {
      error: dbErr.message,
      taskId: extractedTaskId,
      cardId: extractedCardId,
    })
    return c.json({
      card: {
        id: null,
        taskId: extractedTaskId,
        yeewallexCardId: extractedCardId,
        status: 'PENDING',
        cardholderId: cardholder.id,
      },
      taskId: extractedTaskId,
      warning: `Card created on YeewalleX but DB save failed: ${dbErr.message}. Will be recovered on next Sync.`,
    }, 201)
  }
})

// GET /cards — List all cards (DB-sourced, enriched with live data)
// Includes both issued cards (have yeewallexCardId) and pending cards (have taskId only).
// Click the Sync button to pull any YeewalleX cards missing from the DB.
yeewallex.get('/cards', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const statusFilter = c.req.query('status')

  const dbCards = await prisma.vccCard.findMany({
    where: { OR: [{ yeewallexCardId: { not: null } }, { taskId: { not: null } }] },
    orderBy: { createdAt: 'desc' },
    include: {
      cardholder: { select: { firstName: true, lastName: true, yeewallexId: true } },
      assignedUser: { select: { id: true, username: true, email: true } },
      assignedAdAccount: {
        select: { id: true, accountId: true, accountName: true, platform: true, status: true,
          user: { select: { id: true, username: true } } },
      },
    },
  })

  const cardStatusMap: Record<string, string> = {
    'NORMAL': 'ACTIVE', 'FREEZE': 'FROZEN', 'CANCELED': 'CANCELLED', 'CANCEL': 'CANCELLED',
    '100': 'ACTIVE', '200': 'FROZEN', '300': 'CANCELLED', '400': 'INACTIVE',
    'normal': 'ACTIVE', 'freeze': 'FROZEN', 'cancel': 'CANCELLED',
  }

  const allCards = await Promise.all(dbCards.map(async (card) => {
    // PENDING card (only taskId, no yeewallexCardId yet) — try to promote if the task finished
    if (!card.yeewallexCardId && card.taskId) {
      try {
        const task = await getCardOpenTask(card.taskId)
        const rd = task.data?.data || task.data || {}
        const taskStatus = rd.status || rd.taskStatus
        const cardList = rd.cardList || rd.card_list || []
        const firstCard = cardList[0] || {}
        const issuedCardId = firstCard.cardId || rd.cardId || rd.card_id

        if (issuedCardId && (taskStatus === 'SUCCESS' || taskStatus === 'COMPLETED' || taskStatus === 200 || taskStatus === 100)) {
          const cardNum = firstCard.cardNumber || null
          const masked = cardNum && cardNum.length > 10 && !cardNum.includes('*')
            ? cardNum.substring(0, 6) + '******' + cardNum.substring(cardNum.length - 4) : cardNum
          await prisma.vccCard.update({
            where: { id: card.id },
            data: { yeewallexCardId: issuedCardId, status: 'ACTIVE', ...(masked ? { cardNumber: masked } : {}) },
          })
          return { ...card, yeewallexCardId: issuedCardId, status: 'ACTIVE', balance: 0, cardNumber: masked || null, _live: true }
        }
        if (taskStatus === 'FAILED' || taskStatus === 'FAIL') {
          await prisma.vccCard.update({ where: { id: card.id }, data: { status: 'FAILED' as any } }).catch(() => {})
          return { ...card, status: 'FAILED', _live: false }
        }
      } catch (e: any) {
        console.log(`[VCC] Task check failed for ${card.taskId}: ${e.message}`)
      }
      return { ...card, status: 'PENDING', _live: false }
    }

    // Issued card — fetch live detail
    if (card.yeewallexCardId) {
      try {
        const detail = await getCardDetail(card.yeewallexCardId)
        if (detail.error || !detail.data) return { ...card, _live: false }
        const rd = detail.data?.data || detail.data || {}
        const liveStatus = cardStatusMap[rd.cardStatus] || cardStatusMap[String(rd.status)] || card.status
        const cardNum = rd.cardNumber || card.cardNumber
        const masked = cardNum && cardNum.length > 10 && !cardNum.includes('*')
          ? cardNum.substring(0, 6) + '******' + cardNum.substring(cardNum.length - 4) : cardNum
        return {
          ...card,
          status: liveStatus,
          balance: rd.balance != null ? parseFloat(String(rd.balance)) : card.balance,
          cardNumber: masked || card.cardNumber,
          _live: true,
        }
      } catch {
        return { ...card, _live: false }
      }
    }

    return { ...card, _live: false }
  }))

  const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PENDING: 1, FROZEN: 2, INACTIVE: 3, FAILED: 4, CANCELLED: 5 }
  allCards.sort((a: any, b: any) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99))

  const filtered = statusFilter && statusFilter !== 'all' ? allCards.filter((c: any) => c.status === statusFilter) : allCards
  return c.json({ cards: filtered, total: filtered.length, page: 1, limit: filtered.length })
})

// GET /cards/:id — Card detail
yeewallex.get('/cards/:id', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const card = await prisma.vccCard.findUnique({
    where: { id: c.req.param('id') },
    include: {
      cardholder: true,
      assignedUser: { select: { id: true, username: true, email: true } },
      assignedAdAccount: {
        select: { id: true, accountId: true, accountName: true, platform: true, status: true,
          user: { select: { id: true, username: true } } },
      },
      _count: { select: { transactions: true } },
    },
  })
  if (!card) return c.json({ error: 'Card not found' }, 404)
  return c.json({ card })
})

// GET /cards/:id/details — Sensitive card info (AES decrypted, never stored)
yeewallex.get('/cards/:id/details', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found or not yet issued' }, 404)

  const result = await getCardKeyInfo(card.yeewallexCardId)
  if (result.error) return c.json({ error: result.message }, 400)

  // Save masked card number to DB
  if (result.data.cardNo && !card.cardNumber) {
    const cn = result.data.cardNo
    const masked = cn.length > 10 ? cn.substring(0, 6) + '******' + cn.substring(cn.length - 4) : cn
    await prisma.vccCard.update({ where: { id: card.id }, data: { cardNumber: masked } }).catch(() => {})
  }

  return c.json({ cardNo: result.data.cardNo, cvv: result.data.cvv, expireDate: result.data.expireDate })
})

// GET /cards/:id/task-status — Poll card-open task
yeewallex.get('/cards/:id/task-status', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card || !card.taskId) return c.json({ error: 'Card not found or no task' }, 404)

  const result = await getCardOpenTask(card.taskId)
  if (result.error) return c.json({ error: result.message }, 400)

  // Update card if task completed — handle nested response
  // Response: {data: {cardList: [{cardId, cardNumber, ...}], status: 100}}
  const rd = result.data?.data || result.data || {}
  const taskStatus = rd.status || rd.taskStatus || result.data?.status
  const cardList = rd.cardList || rd.card_list || []
  const firstCard = cardList[0] || {}

  if (taskStatus === 'SUCCESS' || taskStatus === 'COMPLETED' || taskStatus === 200 || taskStatus === 100) {
    const cardId = firstCard.cardId || rd.cardId || rd.card_id || result.data?.cardId
    const cardStatus = 'ACTIVE'
    await prisma.vccCard.update({
      where: { id: card.id },
      data: {
        yeewallexCardId: cardId || null,
        status: cardStatus as any,
      },
    })
  } else if (taskStatus === 'FAILED') {
    await prisma.vccCard.update({ where: { id: card.id }, data: { status: 'FAILED' } })
  }

  return c.json({ taskStatus, data: result.data })
})

// POST /cards/:id/activate
yeewallex.post('/cards/:id/activate', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found' }, 404)

  const result = await activateCard(card.yeewallexCardId)
  if (result.error) return c.json({ error: result.message }, 400)

  await prisma.vccCard.update({ where: { id: card.id }, data: { status: 'ACTIVE' } })
  return c.json({ success: true })
})

// POST /cards/:id/freeze
yeewallex.post('/cards/:id/freeze', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found' }, 404)

  const result = await freezeCard(card.yeewallexCardId)
  if (result.error) return c.json({ error: result.message }, 400)

  await prisma.vccCard.update({ where: { id: card.id }, data: { status: 'FROZEN' } })
  return c.json({ success: true })
})

// POST /cards/:id/unfreeze
yeewallex.post('/cards/:id/unfreeze', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found' }, 404)

  const result = await unfreezeCard(card.yeewallexCardId)
  if (result.error) return c.json({ error: result.message }, 400)

  await prisma.vccCard.update({ where: { id: card.id }, data: { status: 'ACTIVE' } })
  return c.json({ success: true })
})

// POST /cards/:id/cancel
yeewallex.post('/cards/:id/cancel', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found' }, 404)

  const result = await cancelCard(card.yeewallexCardId)
  if (result.error) return c.json({ error: result.message }, 400)

  await prisma.vccCard.update({ where: { id: card.id }, data: { status: 'CANCELLED' } })
  return c.json({ success: true })
})

// POST /cards/:id/refund — Partial balance refund (amount returned to USDT wallet, card stays active)
yeewallex.post('/cards/:id/refund', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const amount = Number(body?.amount)
  if (!amount || amount <= 0) return c.json({ error: 'Invalid amount' }, 400)

  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found' }, 404)

  const result = await refundCardBalance({ cardId: card.yeewallexCardId, amount })
  const rd = result.data?.data || result.data || {}
  const refundId = rd.refundId || rd.rechargeId || rd.id || null
  // Yeewallex may return state=SUCCESS but result.status=400/500 — treat as failure
  const innerStatus = rd.status
  const isOk = !result.error && (result.data?.state === 'SUCCESS' || innerStatus === 'SUCCESS' || innerStatus === 200 || innerStatus === 100)
    && innerStatus !== 400 && innerStatus !== 500

  // Log audit row for BOTH success and failure (yeewallexTxId @unique requires non-null value)
  const syntheticRefundId = refundId || `REFUND:${card.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
  await prisma.vccTransaction.create({
    data: {
      cardId: card.id,
      type: 'REFUND',
      amount,
      currency: 'USDT',
      status: isOk ? 'SUCCESS' : 'FAILED',
      description: isOk
        ? `Admin partial balance refund — $${amount} back to USDT wallet`
        : `Refund failed — $${amount} · ${rd.message || result.message || 'unknown error'}`,
      yeewallexTxId: syntheticRefundId,
      metadata: { amount, refundId, ok: isOk, yeewallexResult: result } as any,
    },
  }).catch((err) => console.error('[Refund] failed to persist VccTransaction:', err.message))

  if (!isOk) {
    return c.json({ error: rd.message || result.message || 'Refund failed', code: result.code, details: rd }, 400)
  }

  return c.json({ success: true, amount, refundId, data: rd })
})

// POST /cards/:id/assign — Assign card to a user
yeewallex.post('/cards/:id/assign', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const { userId } = await c.req.json()
  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card) return c.json({ error: 'Card not found' }, 404)

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return c.json({ error: 'User not found' }, 404)
  }

  await prisma.vccCard.update({ where: { id: card.id }, data: { assignedUserId: userId || null } })
  return c.json({ success: true })
})

// GET /ad-accounts — list all ad accounts for assign picker (admin only)
yeewallex.get('/ad-accounts', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const q = c.req.query('q')?.trim() || ''
  const adAccounts = await prisma.adAccount.findMany({
    where: q ? {
      OR: [
        { accountId: { contains: q, mode: 'insensitive' } },
        { accountName: { contains: q, mode: 'insensitive' } },
        { licenseName: { contains: q, mode: 'insensitive' } },
      ],
    } : undefined,
    select: {
      id: true, accountId: true, accountName: true, licenseName: true,
      platform: true, status: true, currency: true, balance: true,
      user: { select: { id: true, username: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  return c.json({ adAccounts })
})

// POST /cards/:id/assign-ad-account — Assign card to an ad account
yeewallex.post('/cards/:id/assign-ad-account', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const { adAccountId } = await c.req.json()
  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card) return c.json({ error: 'Card not found' }, 404)

  if (adAccountId) {
    const adAccount = await prisma.adAccount.findUnique({ where: { id: adAccountId } })
    if (!adAccount) return c.json({ error: 'Ad account not found' }, 404)
  }

  await prisma.vccCard.update({ where: { id: card.id }, data: { assignedAdAccountId: adAccountId || null } })
  return c.json({ success: true })
})

// POST /cards/:id/recharge — Top up card
yeewallex.post('/cards/:id/recharge', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found' }, 404)

  const { amount, currency } = await c.req.json()
  if (!amount || amount <= 0) return c.json({ error: 'Invalid amount' }, 400)

  const result = await rechargeCard({ cardId: card.yeewallexCardId, amount, currency })
  if (result.error) return c.json({ error: result.message }, 400)

  // Handle nested response
  const rd = result.data?.data || result.data || {}
  const rechargeStatus = rd.status || result.data?.status
  // Check both top-level state and nested status — Yeewallex may return HTTP 200 but status 400 in body
  const isSuccess = (result.data?.state === 'SUCCESS' || rechargeStatus === 'SUCCESS' || rechargeStatus === 200 || rechargeStatus === 100) && rechargeStatus !== 400 && rechargeStatus !== 500

  // Create transaction record
  const tx = await prisma.vccTransaction.create({
    data: {
      yeewallexTxId: rd.rechargeId || rd.id || result.data?.rechargeId || `rc_${Date.now()}`,
      type: 'RECHARGE',
      amount,
      currency: currency || 'USD',
      status: isSuccess ? 'SUCCESS' : 'PENDING',
      description: `Recharge $${amount}`,
      cardId: card.id,
    },
  })

  // Update card balance — for BIN 44135977 recharge is synchronous
  const newBalance = rd.balance ?? rd.cardBalance ?? result.data?.balance
  const maskedCardNumber = rd.cardNumber || result.data?.cardNumber || null
  if (newBalance !== undefined && newBalance !== null) {
    await prisma.vccCard.update({
      where: { id: card.id },
      data: { balance: parseFloat(String(newBalance)), totalRecharge: { increment: amount }, ...(maskedCardNumber && { cardNumber: maskedCardNumber }) },
    })
  } else if (isSuccess) {
    // If no balance returned but success, increment locally
    await prisma.vccCard.update({
      where: { id: card.id },
      data: { balance: { increment: amount }, totalRecharge: { increment: amount }, ...(maskedCardNumber && { cardNumber: maskedCardNumber }) },
    })
  }

  return c.json({ transaction: tx, rechargeData: result.data })
})

// POST /cards/:id/withdraw — Withdraw from card
yeewallex.post('/cards/:id/withdraw', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const card = await prisma.vccCard.findUnique({ where: { id: c.req.param('id') } })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found' }, 404)

  const { amount, currency } = await c.req.json()
  if (!amount || amount <= 0) return c.json({ error: 'Invalid amount' }, 400)

  const result = await withdrawCard({ cardId: card.yeewallexCardId, amount, currency })
  if (result.error) return c.json({ error: result.message }, 400)

  await prisma.vccTransaction.create({
    data: {
      yeewallexTxId: result.data.withdrawId || result.data.id || `wd_${Date.now()}`,
      type: 'WITHDRAWAL',
      amount,
      currency: currency || 'USD',
      status: result.data.status === 'SUCCESS' ? 'SUCCESS' : 'PENDING',
      description: `Withdraw $${amount}`,
      cardId: card.id,
    },
  })

  if (result.data.balance !== undefined) {
    await prisma.vccCard.update({ where: { id: card.id }, data: { balance: parseFloat(result.data.balance) } })
  }

  return c.json({ success: true, data: result.data })
})

// GET /recharge-history — Local DB recharge/refund/fee records (admin)
yeewallex.get('/recharge-history', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)

  const transactions = await prisma.vccTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { card: { select: { label: true, yeewallexCardId: true, cardNumber: true, currency: true } } },
  })

  // Enrich with deposit info: yeewallexTxId pattern "AUTO:<depositId>:<ts>:<rand>"
  // Extract depositId, batch-fetch matching AccountDeposits, attach { applyId, createdAt }.
  const depositIds: string[] = []
  for (const t of transactions) {
    const yw = t.yeewallexTxId || ''
    if (yw.startsWith('AUTO:')) {
      const id = yw.split(':')[1]
      if (id && /^[a-f0-9]{24}$/i.test(id)) depositIds.push(id)
    }
  }
  const depositMap: Record<string, { applyId: string | null; createdAt: Date; amount: number }> = {}
  if (depositIds.length > 0) {
    const deposits = await prisma.accountDeposit.findMany({
      where: { id: { in: Array.from(new Set(depositIds)) } },
      select: { id: true, applyId: true, createdAt: true, amount: true },
    })
    for (const d of deposits) depositMap[d.id] = { applyId: d.applyId, createdAt: d.createdAt, amount: d.amount }
  }

  const enriched = transactions.map(t => {
    const yw = t.yeewallexTxId || ''
    let deposit: { applyId: string | null; createdAt: Date; amount: number } | null = null
    if (yw.startsWith('AUTO:')) {
      const id = yw.split(':')[1]
      if (id && depositMap[id]) deposit = depositMap[id]
    }
    return { ...t, deposit }
  })

  return c.json({ transactions: enriched })
})

// GET /transactions — List all transactions from Yeewallex API (admin)
yeewallex.get('/transactions', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const page = parseInt(c.req.query('page') || '1')
  const size = parseInt(c.req.query('size') || '50')
  const cardId = c.req.query('cardId')
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')

  const result = await getTransactions({ page, size, cardId: cardId || undefined, startDate: startDate || undefined, endDate: endDate || undefined })
  if (result.error) return c.json({ error: result.message }, 400)

  const rd = result.data?.data || result.data || {}
  const records = rd.records || rd.list || rd.items || []
  const total = parseInt(rd.total || '0')

  return c.json({ transactions: records, total, page, size })
})

// ============================================================
// USER ROUTES (any authenticated user — sees only assigned cards)
// ============================================================

// GET /my/cards — User's assigned cards
yeewallex.get('/my/cards', async (c) => {
  const userId = c.get('userId') as string
  const cards = await prisma.vccCard.findMany({
    where: { assignedUserId: userId },
    include: { cardholder: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ cards })
})

// GET /my/cards/:id — User's card detail
yeewallex.get('/my/cards/:id', async (c) => {
  const userId = c.get('userId') as string
  const card = await prisma.vccCard.findFirst({
    where: { id: c.req.param('id'), assignedUserId: userId },
    include: {
      cardholder: { select: { firstName: true, lastName: true } },
      _count: { select: { transactions: true } },
    },
  })
  if (!card) return c.json({ error: 'Card not found' }, 404)
  return c.json({ card })
})

// GET /my/cards/:id/details — User's card sensitive info
yeewallex.get('/my/cards/:id/details', async (c) => {
  const userId = c.get('userId') as string
  const card = await prisma.vccCard.findFirst({
    where: { id: c.req.param('id'), assignedUserId: userId },
  })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found' }, 404)

  const result = await getCardKeyInfo(card.yeewallexCardId)
  if (result.error) return c.json({ error: result.message }, 400)

  return c.json({ cardNo: result.data.cardNo, cvv: result.data.cvv, expireDate: result.data.expireDate })
})

// GET /my/transactions — User's card transactions
yeewallex.get('/my/transactions', async (c) => {
  const userId = c.get('userId') as string
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  // Get user's card IDs
  const userCards = await prisma.vccCard.findMany({
    where: { assignedUserId: userId },
    select: { id: true },
  })
  const cardIds = userCards.map(c => c.id)

  if (cardIds.length === 0) return c.json({ transactions: [], total: 0, page, limit })

  const [transactions, total] = await Promise.all([
    prisma.vccTransaction.findMany({
      where: { cardId: { in: cardIds } },
      skip: (page - 1) * limit, take: limit,
      include: { card: { select: { label: true, currency: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vccTransaction.count({ where: { cardId: { in: cardIds } } }),
  ])

  return c.json({ transactions, total, page, limit })
})

// ─── USER: Self-service card actions (issue, recharge, withdraw) ───────────

// Helper: ensure user has vccAccess flag on
async function requireVccAccess(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { vccAccess: true, walletBalance: true } })
  if (!u || !u.vccAccess) return null
  return u
}

// POST /my/cards/issue — User self-issues a card (admin must have at least one cardholder)
yeewallex.post('/my/cards/issue', async (c) => {
  const userId = c.get('userId') as string
  const u = await requireVccAccess(userId)
  if (!u) return c.json({ error: 'VCC access not granted. Contact admin.' }, 403)

  const { label, alias } = await c.req.json().catch(() => ({}))

  // Pick any available cardholder (admin pre-created)
  const holders = await prisma.vccCardholder.findMany({ take: 1, orderBy: { createdAt: 'asc' } })
  if (holders.length === 0) {
    return c.json({ error: 'No cardholders available. Contact admin to set one up.' }, 400)
  }
  const holder = holders[0]

  const result = await openCard({
    cardBinId: CARD_BINS.ADS_USD,
    cardholderId: holder.yeewallexId,
    currency: 'USD',
    alias: alias || label || '',
  })
  if (result.error) return c.json({ error: result.message }, 400)

  const rd = result.data?.data || result.data || {}
  const taskId = rd.taskId || rd.task_id || null
  const ywCardId = rd.cardId || rd.card_id || null

  const card = await prisma.vccCard.create({
    data: {
      taskId, yeewallexCardId: ywCardId,
      cardBinId: CARD_BINS.ADS_USD,
      label: label || null, alias: alias || null,
      status: 'PENDING', currency: 'USD',
      cardholderId: holder.id,
      assignedUserId: userId,
    },
  })
  return c.json({ card }, 201)
})

// POST /my/cards/:id/recharge — Move funds from user wallet → card
yeewallex.post('/my/cards/:id/recharge', async (c) => {
  const userId = c.get('userId') as string
  const u = await requireVccAccess(userId)
  if (!u) return c.json({ error: 'VCC access not granted' }, 403)

  const { amount } = await c.req.json()
  const amt = Number(amount)
  if (!amt || amt <= 0) return c.json({ error: 'Invalid amount' }, 400)
  if (Number(u.walletBalance) < amt) return c.json({ error: 'Insufficient wallet balance' }, 400)

  const card = await prisma.vccCard.findFirst({
    where: { id: c.req.param('id'), assignedUserId: userId },
  })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found' }, 404)

  // Deduct from wallet first (refund on failure)
  await prisma.user.update({ where: { id: userId }, data: { walletBalance: { decrement: amt } } })

  const result = await rechargeCard({ cardId: card.yeewallexCardId, amount: amt, currency: 'USD' })
  if (result.error) {
    await prisma.user.update({ where: { id: userId }, data: { walletBalance: { increment: amt } } })
    return c.json({ error: result.message }, 400)
  }

  const rd = result.data?.data || result.data || {}
  const status = rd.status || result.data?.status
  const isSuccess = (result.data?.state === 'SUCCESS' || status === 'SUCCESS' || status === 200 || status === 100) && status !== 400 && status !== 500

  const tx = await prisma.vccTransaction.create({
    data: {
      yeewallexTxId: rd.rechargeId || rd.id || `rc_${Date.now()}`,
      type: 'RECHARGE', amount: amt, currency: 'USD',
      status: isSuccess ? 'SUCCESS' : 'PENDING',
      description: `User wallet recharge $${amt}`,
      cardId: card.id,
    },
  })

  const newBalance = rd.balance ?? rd.cardBalance ?? result.data?.balance
  if (newBalance !== undefined && newBalance !== null) {
    await prisma.vccCard.update({
      where: { id: card.id },
      data: { balance: parseFloat(String(newBalance)), totalRecharge: { increment: amt } },
    })
  } else if (isSuccess) {
    await prisma.vccCard.update({
      where: { id: card.id },
      data: { balance: { increment: amt }, totalRecharge: { increment: amt } },
    })
  }

  return c.json({ transaction: tx, success: isSuccess })
})

// POST /my/cards/:id/withdraw — Move funds from card → user wallet
yeewallex.post('/my/cards/:id/withdraw', async (c) => {
  const userId = c.get('userId') as string
  const u = await requireVccAccess(userId)
  if (!u) return c.json({ error: 'VCC access not granted' }, 403)

  const { amount } = await c.req.json()
  const amt = Number(amount)
  if (!amt || amt <= 0) return c.json({ error: 'Invalid amount' }, 400)

  const card = await prisma.vccCard.findFirst({
    where: { id: c.req.param('id'), assignedUserId: userId },
  })
  if (!card || !card.yeewallexCardId) return c.json({ error: 'Card not found' }, 404)
  if (Number(card.balance) < amt) return c.json({ error: 'Insufficient card balance' }, 400)

  const result = await withdrawCard({ cardId: card.yeewallexCardId, amount: amt, currency: 'USD' })
  if (result.error) return c.json({ error: result.message }, 400)

  await prisma.vccTransaction.create({
    data: {
      yeewallexTxId: result.data?.withdrawId || result.data?.id || `wd_${Date.now()}`,
      type: 'WITHDRAWAL', amount: amt, currency: 'USD',
      status: result.data?.status === 'SUCCESS' ? 'SUCCESS' : 'PENDING',
      description: `User wallet withdraw $${amt}`,
      cardId: card.id,
    },
  })

  // Credit user wallet
  await prisma.user.update({ where: { id: userId }, data: { walletBalance: { increment: amt } } })

  // Update card balance
  if (result.data?.balance !== undefined) {
    await prisma.vccCard.update({ where: { id: card.id }, data: { balance: parseFloat(String(result.data.balance)) } })
  } else {
    await prisma.vccCard.update({ where: { id: card.id }, data: { balance: { decrement: amt } } })
  }

  return c.json({ success: true })
})

// ─── ADMIN: VCC User Access Management ──────────────────────────────────────
// List users with their vccAccess flag
yeewallex.get('/users', async (c) => {
  const role = c.get('userRole')
  if (role !== 'ADMIN' && role !== 'AGENT') return c.json({ error: 'Unauthorized' }, 403)

  const userId = c.get('userId')
  const { search } = c.req.query()
  const where: any = { role: 'USER' }
  if (role === 'AGENT') where.agentId = userId
  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { realName: { contains: search, mode: 'insensitive' } },
    ]
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, username: true, email: true, realName: true, vccAccess: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })
  return c.json({ users })
})

// Toggle vccAccess for a user
yeewallex.patch('/users/:id/access', async (c) => {
  const role = c.get('userRole')
  if (role !== 'ADMIN' && role !== 'AGENT') return c.json({ error: 'Unauthorized' }, 403)

  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const vccAccess = !!body.vccAccess

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, agentId: true, role: true } })
  if (!target || target.role !== 'USER') return c.json({ error: 'User not found' }, 404)
  if (role === 'AGENT' && target.agentId !== c.get('userId')) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { vccAccess },
    select: { id: true, username: true, vccAccess: true },
  })
  return c.json({ user: updated })
})

export default yeewallex
