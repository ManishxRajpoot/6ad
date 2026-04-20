import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken } from '../middleware/auth'
import {
  getAccountInfo, getCardBins, addCardholder, openCard, getCardOpenTask,
  activateCard, getCardKeyInfo, rechargeCard, getRechargeStatus,
  withdrawCard, freezeCard, unfreezeCard, cancelCard, getCards,
  getCardDetail, getTransactions, getCardholders, CARD_BINS,
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

    // Sync cards from Yeewallex
    let cardsSynced = 0
    let cardsUpdated = 0
    try {
      for (let page = 1; page <= 10; page++) {
        const cardsResult = await getCards({ pageNo: page, pageSize: 50 })
        console.log(`[Yeewallex Sync] Cards page ${page} raw keys:`, Object.keys(cardsResult || {}), 'data keys:', Object.keys(cardsResult?.data || {}))
        // Try multiple response shapes
        const remoteCards = cardsResult.data?.data || cardsResult.data?.list || cardsResult.data?.records || (Array.isArray(cardsResult.data) ? cardsResult.data : [])
        console.log(`[Yeewallex Sync] Found ${remoteCards.length} remote cards on page ${page}`)
        if (remoteCards.length === 0) break

        for (const rc of remoteCards) {
          const ywCardId = rc.cardId || rc.id
          if (!ywCardId) continue

          const statusMap: Record<string, string> = { '100': 'ACTIVE', '200': 'FROZEN', '300': 'CANCELLED', '400': 'INACTIVE' }
          const cardStatus = statusMap[String(rc.status)] || 'ACTIVE'
          const maskedNumber = rc.cardNumber || null

          const existing = await prisma.vccCard.findFirst({ where: { yeewallexCardId: ywCardId } })
          if (existing) {
            // Update status and balance
            await prisma.vccCard.update({
              where: { id: existing.id },
              data: {
                status: cardStatus as any,
                balance: rc.balance != null ? parseFloat(String(rc.balance)) : existing.balance,
                ...(maskedNumber && !existing.cardNumber ? { cardNumber: maskedNumber } : {}),
              },
            })
            cardsUpdated++
          } else {
            // Find cardholder
            const holder = rc.customerId ? await prisma.vccCardholder.findFirst({ where: { yeewallexId: String(rc.customerId) } }) : null
            if (holder) {
              await prisma.vccCard.create({
                data: {
                  yeewallexCardId: ywCardId,
                  cardBinId: rc.sectionId || rc.cardBinId || 'unknown',
                  cardNumber: maskedNumber,
                  status: cardStatus as any,
                  currency: rc.currency || 'USD',
                  balance: rc.balance != null ? parseFloat(String(rc.balance)) : 0,
                  cardholderId: holder.id,
                },
              })
              cardsSynced++
            }
          }
        }
      }
    } catch (cardErr: any) {
      console.error('[Yeewallex Sync] Card sync error:', cardErr.message)
    }

    return c.json({
      success: true,
      message: `Synced ${synced.cardholders} new cardholders, ${cardsSynced} new cards, ${cardsUpdated} cards updated.`,
      synced: { ...synced, cardsSynced, cardsUpdated },
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
  return c.json(result.data)
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

  // Save card to DB (PENDING until task completes)
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
})

// GET /cards — List all cards
yeewallex.get('/cards', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const status = c.req.query('status')

  const where: any = {}
  if (status) where.status = status

  const [cards, total] = await Promise.all([
    prisma.vccCard.findMany({
      where, skip: (page - 1) * limit, take: limit,
      include: {
        cardholder: { select: { firstName: true, lastName: true, yeewallexId: true } },
        assignedUser: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vccCard.count({ where }),
  ])

  // Auto-fetch card numbers for cards missing them (fire and forget)
  const missingNumbers = cards.filter(c => !c.cardNumber && c.yeewallexCardId && c.status !== 'PENDING')
  if (missingNumbers.length > 0) {
    Promise.all(missingNumbers.map(async (card) => {
      try {
        const result = await getCardKeyInfo(card.yeewallexCardId!)
        if (result.data?.cardNo) {
          const cn = result.data.cardNo
          const masked = cn.length > 10 ? cn.substring(0, 6) + '******' + cn.substring(cn.length - 4) : cn
          await prisma.vccCard.update({ where: { id: card.id }, data: { cardNumber: masked } })
          card.cardNumber = masked
        }
      } catch {}
    })).catch(() => {})
  }

  return c.json({ cards, total, page, limit })
})

// GET /cards/:id — Card detail
yeewallex.get('/cards/:id', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Admin only' }, 403)
  const card = await prisma.vccCard.findUnique({
    where: { id: c.req.param('id') },
    include: {
      cardholder: true,
      assignedUser: { select: { id: true, username: true, email: true } },
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
    include: { card: { select: { label: true, yeewallexCardId: true, currency: true } } },
  })

  return c.json({ transactions })
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

export default yeewallex
