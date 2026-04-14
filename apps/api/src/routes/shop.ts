import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '../middleware/auth'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import { verifyTransaction } from '../services/crypto/blockchain-verifier.js'
import nodemailer from 'nodemailer'
import { getShopOrderDeliveryTemplate, getBaseEmailTemplate } from '../utils/email.js'

const prisma = new PrismaClient()

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'cms'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''
const shop = new Hono()

// Shop delivery email SMTP (vip@ads360.ai on Hostinger)
const shopMailer = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: {
    user: 'vip@ads360.ai',
    pass: 'Bigindia@555',
  },
})

// ============= PUBLIC ROUTES =============

// GET /categories — list active categories
shop.get('/categories', async (c) => {
  const categories = await prisma.shopCategory.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  })
  return c.json({ categories })
})

// GET /products — list products with filters
shop.get('/products', async (c) => {
  const { category, platform, search, featured, limit = '50', page = '1' } = c.req.query()
  const take = Math.min(parseInt(limit), 100)
  const skip = (parseInt(page) - 1) * take

  const where: any = { isActive: true }
  if (category) where.category = { slug: category }
  if (platform) where.platform = platform
  if (featured === 'true') where.isFeatured = true
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [products, total] = await Promise.all([
    prisma.shopProduct.findMany({
      where,
      include: { category: { select: { name: true, slug: true, order: true } } },
      orderBy: [{ category: { order: 'asc' } }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
      take,
      skip,
    }),
    prisma.shopProduct.count({ where }),
  ])

  return c.json({ products, total, page: parseInt(page), pages: Math.ceil(total / take) })
})

// GET /products/:slug — single product
shop.get('/products/:slug', async (c) => {
  const slug = c.req.param('slug')
  const product = await prisma.shopProduct.findUnique({
    where: { slug },
    include: { category: { select: { name: true, slug: true } } },
  })
  if (!product || !product.isActive) return c.json({ error: 'Product not found' }, 404)
  return c.json({ product })
})

// POST /orders — create order
shop.post('/orders', async (c) => {
  try {
    const data = await c.req.json()
    const { email, telegramUsername, items, paymentMethod, txHash } = data

    if (!email || !items?.length || !paymentMethod) {
      return c.json({ error: 'Missing required fields: email, items, paymentMethod' }, 400)
    }

    // Validate items and calculate total
    let totalAmount = 0
    const orderItems: { productId: string; quantity: number; price: number }[] = []

    for (const item of items) {
      const product = await prisma.shopProduct.findUnique({ where: { id: item.productId } })
      if (!product || !product.isActive) {
        return c.json({ error: `Product not found: ${item.productId}` }, 400)
      }
      if (product.stock !== -1 && product.stock < (item.quantity || 1)) {
        return c.json({ error: `Insufficient stock for: ${product.title}` }, 400)
      }
      const qty = item.quantity || 1
      totalAmount += product.price * qty
      orderItems.push({ productId: product.id, quantity: qty, price: product.price })
    }

    // Generate order number: ADS360{YYYYMMDD}{7 random digits}
    const date = new Date()
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const rand = String(Math.floor(1000000 + Math.random() * 9000000))
    const orderNumber = `ADS360${dateStr}${rand}`

    // Determine wallet address — read from shop-settings (separate from 6AD system wallets)
    const shopSettings = await prisma.cmsSection.findUnique({ where: { sectionKey: 'shop-settings' } }).catch(() => null)
    const shopData = (shopSettings?.data as any) || {}
    let walletAddress = ''
    if (paymentMethod === 'USDT_TRC20') {
      walletAddress = shopData.trc20WalletAddress || process.env.USDT_TRC20_WALLET || 'WALLET_NOT_SET'
    } else if (paymentMethod === 'USDT_BEP20') {
      walletAddress = shopData.bep20WalletAddress || process.env.USDT_BEP20_WALLET || 'WALLET_NOT_SET'
    } else {
      walletAddress = shopData.upiId || process.env.UPI_ID || 'UPI_NOT_SET'
    }

    const order = await prisma.shopOrder.create({
      data: {
        orderNumber,
        email,
        telegramUsername: telegramUsername || null,
        totalAmount,
        paymentMethod,
        txHash: txHash || null,
        walletAddress,
        status: txHash ? 'PAID' : 'PENDING',
        items: {
          create: orderItems,
        },
      },
      include: { items: { include: { product: { select: { title: true, slug: true } } } } },
    })

    // Reduce stock for items with limited stock
    for (const item of orderItems) {
      const product = await prisma.shopProduct.findUnique({ where: { id: item.productId } })
      if (product && product.stock > 0) {
        await prisma.shopProduct.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
      }
    }

    return c.json({ order, walletAddress })
  } catch (e: any) {
    console.error('Shop order error:', e)
    return c.json({ error: 'Failed to create order' }, 500)
  }
})

// GET /orders/:id — check order status (by order number or ID) + auto-scan blockchain
shop.get('/orders/:id', async (c) => {
  const id = c.req.param('id')
  const order = await prisma.shopOrder.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: { items: { include: { product: { select: { title: true, slug: true, images: true } } } } },
  })
  if (!order) return c.json({ error: 'Order not found' }, 404)

  // If order is PENDING and has a wallet address, scan blockchain for payment
  if (order.status === 'PENDING' && order.walletAddress && order.paymentMethod !== 'UPI') {
    const isRecent = Date.now() - new Date(order.createdAt).getTime() < 30 * 60 * 1000 // within 30 min
    if (isRecent) {
      const scan = order.paymentMethod === 'USDT_BEP20'
        ? await scanBscForPayment(order.walletAddress, order.totalAmount)
        : await scanTronForPayment(order.walletAddress, order.totalAmount)

      if (scan.found && scan.txHash) {
        // CRITICAL: Check if this txHash is already used by another order
        const existingOrder = await prisma.shopOrder.findFirst({
          where: { txHash: scan.txHash, id: { not: order.id } },
        })
        if (existingOrder) {
          console.log(`[ShopScanner] txHash ${scan.txHash} already used by order ${existingOrder.orderNumber} — skipping`)
          // Don't match this transaction, it belongs to another order
        } else {
          // Payment found and not used by another order — claim it
          const updated = await prisma.shopOrder.update({
            where: { id: order.id },
            data: { txHash: scan.txHash, status: 'PAID', notes: `Auto-detected: ${scan.amount} USDT` },
            include: { items: { include: { product: { select: { title: true, slug: true, images: true } } } } },
          })
          console.log(`[ShopScanner] Payment auto-detected for order ${order.orderNumber}: ${scan.txHash}`)

          // Send confirmation email to customer
          const itemNames = updated.items.map((i: any) => i.product?.title || 'Unknown').join(', ')
          const custItems = updated.items.map((i: any) =>
            `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; font-size: 14px;">${i.product?.title || 'Product'}</td><td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 14px; text-align: center;">${i.quantity}</td><td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; font-size: 14px; text-align: right;">$${i.price.toFixed(2)}</td></tr>`
          ).join('')
          shopMailer.sendMail({
            from: '"ADS360 Shop" <vip@ads360.ai>',
            to: updated.email,
            subject: `Order Confirmed - ${updated.orderNumber} | ADS360`,
            html: getBaseEmailTemplate({
              title: 'Order Confirmed',
              subtitle: updated.orderNumber,
              headerColor: 'purple',
              agentBrandName: 'ADS360',
              footerText: 'You received this email because you placed an order on ADS360.',
              content: `
                <p style="margin: 0 0 16px; color: #374151; font-size: 15px;">Hi there,</p>
                <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">Thank you for your payment! We've received it and our team is preparing your delivery.</p>
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                  <p style="margin: 0 0 4px; color: #0369a1; font-size: 13px; font-weight: 600;">ESTIMATED DELIVERY TIME</p>
                  <p style="margin: 0; color: #0c4a6e; font-size: 24px; font-weight: 700;">Within 3 Hours</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                  <thead><tr style="background: #f9fafb;"><th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Product</th><th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Qty</th><th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Price</th></tr></thead>
                  <tbody>${custItems}<tr style="background: #f9fafb;"><td colspan="2" style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #374151;">Total</td><td style="padding: 10px 12px; text-align: right; font-size: 14px; font-weight: 700; color: #059669;">$${updated.totalAmount.toFixed(2)}</td></tr></tbody>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
                  <tr style="background: #f9fafb;"><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600;">Order #</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; font-weight: 700; font-family: monospace;">${updated.orderNumber}</td></tr>
                  <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Status</td><td style="padding: 10px 14px; font-size: 14px; border-top: 1px solid #f3f4f6;"><span style="background: #FEF3C7; color: #B45309; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">Preparing</span></td></tr>
                </table>
                <p style="margin: 0; color: #6b7280; font-size: 13px;">Your order details will be delivered to this email once ready.</p>
              `,
            }),
          }).catch(err => console.error('[Shop] Auto-detect customer email error:', err))

          // Notify admins
          const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, email: true } })
          if (admins.length > 0) {
            await prisma.notification.createMany({
              data: admins.map(a => ({ userId: a.id, type: 'SYSTEM' as const, title: `Payment Detected - #${updated.orderNumber}`, message: `Auto-detected $${updated.totalAmount.toFixed(2)} from ${updated.email} — ${itemNames}` })),
            }).catch(() => {})
            const adminEmails = admins.map(a => a.email).filter(Boolean)
            if (adminEmails.length > 0) {
              shopMailer.sendMail({
                from: '"ADS360 Shop" <vip@ads360.ai>',
                to: adminEmails.join(','),
                subject: `Payment Detected - Order #${updated.orderNumber} — $${updated.totalAmount.toFixed(2)}`,
                html: getBaseEmailTemplate({
                  title: 'Payment Auto-Detected',
                  subtitle: updated.orderNumber,
                  headerColor: 'amber',
                  agentBrandName: 'ADS360',
                  footerText: 'ADS360 Shop — Admin Notification',
                  content: `
                    <p style="margin: 0 0 16px; color: #374151; font-size: 15px;">Payment automatically detected on blockchain!</p>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                      <tr style="background: #f9fafb;"><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600;">Order #</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; font-weight: 700; font-family: monospace;">${updated.orderNumber}</td></tr>
                      <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Email</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; border-top: 1px solid #f3f4f6;">${updated.email}</td></tr>
                      <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Amount</td><td style="padding: 10px 14px; font-size: 16px; color: #059669; font-weight: 700; border-top: 1px solid #f3f4f6;">$${updated.totalAmount.toFixed(2)}</td></tr>
                      <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Items</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; border-top: 1px solid #f3f4f6;">${itemNames}</td></tr>
                      <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">TxHash</td><td style="padding: 10px 14px; font-size: 12px; color: #374151; font-family: monospace; border-top: 1px solid #f3f4f6;">${scan.txHash}</td></tr>
                    </table>
                    <p style="margin: 0; color: #6b7280; font-size: 13px;">Go to admin panel to deliver this order.</p>
                  `,
                }),
              }).catch(err => console.error('[Shop] Auto-detect admin email error:', err))
            }
          }

          return c.json({ order: updated })
        }
      }
    }
  }

  return c.json({ order })
})

// PATCH /orders/:id/txhash — submit txHash and auto-verify on blockchain
shop.patch('/orders/:id/txhash', async (c) => {
  const id = c.req.param('id')
  const { txHash } = await c.req.json()
  if (!txHash) return c.json({ error: 'txHash required' }, 400)

  const order = await prisma.shopOrder.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
  })
  if (!order) return c.json({ error: 'Order not found' }, 404)
  if (order.status !== 'PENDING') return c.json({ error: 'Order already processed' }, 400)

  // CRITICAL: Check if txHash already used by another order
  const duplicateTx = await prisma.shopOrder.findFirst({ where: { txHash, id: { not: order.id } } })
  if (duplicateTx) return c.json({ error: 'This transaction hash has already been used for another order' }, 400)

  // Save txHash immediately as PAID (payment submitted)
  let updated = await prisma.shopOrder.update({
    where: { id: order.id },
    data: { txHash, status: 'PAID' },
  })

  // Auto-verify on blockchain for USDT payments (not UPI)
  if (order.paymentMethod !== 'UPI') {
    const network = order.paymentMethod === 'USDT_TRC20' ? 'TRON_TRC20' : 'BSC_BEP20'

    // Get wallet address from shop-settings (separate from 6AD system)
    const walletAddress = order.walletAddress

    if (walletAddress) {
      // Start background verification — don't block the response
      verifyTransaction(network as 'TRON_TRC20' | 'BSC_BEP20', txHash, walletAddress)
        .then(async (result) => {
          if (result.valid && result.amount && result.amount >= order.totalAmount * 0.99) {
            // Verified — auto-deliver
            await prisma.shopOrder.update({
              where: { id: order.id },
              data: { status: 'DELIVERED', notes: `Auto-verified: ${result.amount} USDT, ${result.confirmations} confirmations` },
            })
            console.log(`[ShopVerifier] Order ${order.orderNumber} auto-verified and delivered: $${result.amount}`)
          } else if (result.valid && result.amount && result.amount < order.totalAmount * 0.99) {
            // Underpaid
            await prisma.shopOrder.update({
              where: { id: order.id },
              data: { notes: `Underpaid: received $${result.amount}, expected $${order.totalAmount}` },
            })
            console.log(`[ShopVerifier] Order ${order.orderNumber} underpaid: $${result.amount} < $${order.totalAmount}`)
          } else {
            console.log(`[ShopVerifier] Order ${order.orderNumber} verification pending — will retry in background`)
            // Queue for retry — check again after 30s
            setTimeout(async () => {
              try {
                const retry = await verifyTransaction(network as 'TRON_TRC20' | 'BSC_BEP20', txHash, walletAddress)
                if (retry.valid && retry.amount && retry.amount >= order.totalAmount * 0.99) {
                  await prisma.shopOrder.update({
                    where: { id: order.id },
                    data: { status: 'DELIVERED', notes: `Auto-verified (retry): ${retry.amount} USDT` },
                  })
                  console.log(`[ShopVerifier] Order ${order.orderNumber} auto-verified on retry`)
                }
              } catch (e) { console.error('[ShopVerifier] Retry failed:', e) }
            }, 30000)
          }
        })
        .catch((e) => {
          console.error(`[ShopVerifier] Verification error for ${order.orderNumber}:`, e)
        })
    }
  }

  // === Send emails AFTER payment is submitted ===
  // Fetch order with items for email
  const fullOrder = await prisma.shopOrder.findUnique({
    where: { id: order.id },
    include: { items: { include: { product: { select: { title: true } } } } },
  })
  if (fullOrder) {
    const itemNames = fullOrder.items.map((i: any) => i.product?.title || 'Unknown').join(', ')

    // 1. Send confirmation email to customer
    const customerItems = fullOrder.items.map((i: any) =>
      `<tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; font-size: 14px;">${i.product?.title || 'Product'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 14px; text-align: center;">${i.quantity}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; font-size: 14px; text-align: right;">$${i.price.toFixed(2)}</td>
      </tr>`
    ).join('')

    shopMailer.sendMail({
      from: '"ADS360 Shop" <vip@ads360.ai>',
      to: fullOrder.email,
      subject: `Order Confirmed - ${fullOrder.orderNumber} | ADS360`,
      html: getBaseEmailTemplate({
        title: 'Order Confirmed',
        subtitle: fullOrder.orderNumber,
        headerColor: 'purple',
        agentBrandName: 'ADS360',
        footerText: 'You received this email because you placed an order on ADS360.',
        content: `
          <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">Hi there,</p>
          <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
            Thank you for your payment! We've received it and our team is preparing your delivery.
          </p>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
            <p style="margin: 0 0 4px; color: #0369a1; font-size: 13px; font-weight: 600;">ESTIMATED DELIVERY TIME</p>
            <p style="margin: 0; color: #0c4a6e; font-size: 24px; font-weight: 700;">Within 3 Hours</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <thead><tr style="background: #f9fafb;">
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Product</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Qty</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Price</th>
            </tr></thead>
            <tbody>
              ${customerItems}
              <tr style="background: #f9fafb;">
                <td colspan="2" style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #374151;">Total</td>
                <td style="padding: 10px 12px; text-align: right; font-size: 14px; font-weight: 700; color: #059669;">$${fullOrder.totalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <tr style="background: #f9fafb;"><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600;">Order #</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; font-weight: 700; font-family: monospace;">${fullOrder.orderNumber}</td></tr>
            <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Payment</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; border-top: 1px solid #f3f4f6;">${fullOrder.paymentMethod.replace('_', ' ')}</td></tr>
            <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Status</td><td style="padding: 10px 14px; font-size: 14px; border-top: 1px solid #f3f4f6;"><span style="background: #FEF3C7; color: #B45309; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">Preparing</span></td></tr>
          </table>
          <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
            Your order details will be delivered to this email once ready. If you have any questions, feel free to reach out via Telegram.
          </p>
        `,
      }),
    }).catch(err => console.error('[Shop] Customer confirmation email error:', err))

    // 2. Notify all admins (in-app + email)
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, email: true } })
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          type: 'SYSTEM' as const,
          title: `New Paid Order #${fullOrder.orderNumber}`,
          message: `Payment received from ${fullOrder.email} — $${fullOrder.totalAmount.toFixed(2)} — ${itemNames}`,
        })),
      }).catch(() => {})

      const adminEmails = admins.map(a => a.email).filter(Boolean)
      if (adminEmails.length > 0) {
        shopMailer.sendMail({
          from: '"ADS360 Shop" <vip@ads360.ai>',
          to: adminEmails.join(','),
          subject: `Payment Received - Order #${fullOrder.orderNumber} — $${fullOrder.totalAmount.toFixed(2)}`,
          html: getBaseEmailTemplate({
            title: 'Payment Received',
            subtitle: fullOrder.orderNumber,
            headerColor: 'amber',
            agentBrandName: 'ADS360',
            footerText: 'ADS360 Shop — Admin Notification',
            content: `
              <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">A customer has submitted payment!</p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <tr style="background: #f9fafb;"><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600;">Order #</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; font-weight: 700; font-family: monospace;">${fullOrder.orderNumber}</td></tr>
                <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Email</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; border-top: 1px solid #f3f4f6;">${fullOrder.email}</td></tr>
                ${fullOrder.telegramUsername ? `<tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Telegram</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; border-top: 1px solid #f3f4f6;">@${fullOrder.telegramUsername}</td></tr>` : ''}
                <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Amount</td><td style="padding: 10px 14px; font-size: 16px; color: #059669; font-weight: 700; border-top: 1px solid #f3f4f6;">$${fullOrder.totalAmount.toFixed(2)}</td></tr>
                <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Payment</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; border-top: 1px solid #f3f4f6;">${fullOrder.paymentMethod}</td></tr>
                <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Items</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; border-top: 1px solid #f3f4f6;">${itemNames}</td></tr>
                <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">TxHash</td><td style="padding: 10px 14px; font-size: 12px; color: #374151; font-family: monospace; border-top: 1px solid #f3f4f6;">${txHash}</td></tr>
              </table>
              <p style="margin: 0; color: #6b7280; font-size: 13px;">Go to admin panel to deliver this order.</p>
            `,
          }),
        }).catch(err => console.error('[Shop] Admin notification email error:', err))
      }
    }
  }

  return c.json({ order: updated, autoVerification: order.paymentMethod !== 'UPI' ? 'in_progress' : 'manual' })
})

// Scan BSC wallet for recent USDT transfers using ANKR
async function scanBscForPayment(walletAddress: string, expectedAmount: number): Promise<{ found: boolean; txHash?: string; amount?: number }> {
  try {
    // Use ANKR's getTokenTransfers to find recent USDT incoming transfers
    const res = await fetch('https://rpc.ankr.com/multichain/c9ecbfee193038ca70ec5ff9c485ae3e39ae51fa6246a0fa4abdba1fe9aba5a4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'ankr_getTokenTransfers',
        params: {
          blockchain: 'bsc',
          address: [walletAddress],
          pageSize: 10,
          descOrder: true,
        },
        id: 1,
      }),
    })
    const data = await res.json()
    const transfers = data.result?.transfers || []
    for (const tx of transfers) {
      // Only USDT contract
      if (tx.contractAddress?.toLowerCase() !== '0x55d398326f99059ff775485246999027b3197955') continue
      const amount = parseFloat(tx.value || '0')
      const age = Date.now() / 1000 - (tx.timestamp || 0)
      // Match: right amount (within 1%), recent (30 min), sent TO our wallet
      if (amount >= expectedAmount * 0.99 && age < 1800 && tx.toAddress?.toLowerCase() === walletAddress.toLowerCase()) {
        return { found: true, txHash: tx.transactionHash, amount }
      }
    }
  } catch (e) { console.error('[ShopScanner] BSC scan error:', e) }
  return { found: false }
}

// Scan TRON wallet for recent USDT transfers
async function scanTronForPayment(walletAddress: string, expectedAmount: number): Promise<{ found: boolean; txHash?: string; amount?: number }> {
  try {
    const res = await fetch(`https://api.trongrid.io/v1/accounts/${walletAddress}/transactions/trc20?limit=10&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`, {
      headers: { 'TRON-PRO-API-KEY': '256e8004-6cc9-40d4-b535-2bd40a04ff5a' }
    })
    const data = await res.json()
    if (data.data && Array.isArray(data.data)) {
      for (const tx of data.data) {
        const amount = parseFloat(tx.value) / 1e6
        const age = Date.now() - tx.block_timestamp
        if (amount >= expectedAmount * 0.99 && age < 1800000 && tx.to === walletAddress) {
          return { found: true, txHash: tx.transaction_id, amount }
        }
      }
    }
  } catch (e) { console.error('[ShopScanner] TRON scan error:', e) }
  return { found: false }
}

// PATCH /orders/:id/upi-proof — submit UPI payment screenshot (stays PROCESSING until admin approves)
shop.patch('/orders/:id/upi-proof', async (c) => {
  const id = c.req.param('id')
  const { screenshotUrl } = await c.req.json()
  if (!screenshotUrl) return c.json({ error: 'Screenshot URL required' }, 400)

  const order = await prisma.shopOrder.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
  })
  if (!order) return c.json({ error: 'Order not found' }, 404)

  const updated = await prisma.shopOrder.update({
    where: { id: order.id },
    data: { txHash: `UPI_SCREENSHOT:${screenshotUrl}`, status: 'PROCESSING', notes: `UPI screenshot: ${screenshotUrl}` },
    include: { items: { include: { product: { select: { title: true } } } } },
  })

  // Send confirmation to customer + notify admins (same as txHash flow)
  const itemNames = updated.items.map((i: any) => i.product?.title || 'Unknown').join(', ')
  shopMailer.sendMail({
    from: '"ADS360 Shop" <vip@ads360.ai>',
    to: updated.email,
    subject: `Order Confirmed - ${updated.orderNumber} | ADS360`,
    html: getBaseEmailTemplate({
      title: 'Order Confirmed',
      subtitle: updated.orderNumber,
      headerColor: 'purple',
      agentBrandName: 'ADS360',
      footerText: 'You received this email because you placed an order on ADS360.',
      content: `
        <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">Hi there,</p>
        <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
          Thank you for your payment! We've received it and our team is preparing your delivery.
        </p>
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0 0 4px; color: #0369a1; font-size: 13px; font-weight: 600;">ESTIMATED DELIVERY TIME</p>
          <p style="margin: 0; color: #0c4a6e; font-size: 24px; font-weight: 700;">Within 3 Hours</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <tr style="background: #f9fafb;"><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600;">Order #</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; font-weight: 700; font-family: monospace;">${updated.orderNumber}</td></tr>
          <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Amount</td><td style="padding: 10px 14px; font-size: 16px; color: #059669; font-weight: 700; border-top: 1px solid #f3f4f6;">$${updated.totalAmount.toFixed(2)}</td></tr>
          <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Status</td><td style="padding: 10px 14px; font-size: 14px; border-top: 1px solid #f3f4f6;"><span style="background: #FEF3C7; color: #B45309; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">Preparing</span></td></tr>
        </table>
        <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">Your order details will be delivered to this email once ready.</p>
      `,
    }),
  }).catch(err => console.error('[Shop] UPI customer email error:', err))

  // Notify admins
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, email: true } })
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map(admin => ({
        userId: admin.id,
        type: 'SYSTEM' as const,
        title: `UPI Payment - Order #${updated.orderNumber}`,
        message: `UPI payment from ${updated.email} — $${updated.totalAmount.toFixed(2)} — ${itemNames}`,
      })),
    }).catch(() => {})
    const adminEmails = admins.map(a => a.email).filter(Boolean)
    if (adminEmails.length > 0) {
      shopMailer.sendMail({
        from: '"ADS360 Shop" <vip@ads360.ai>',
        to: adminEmails.join(','),
        subject: `UPI Payment - Order #${updated.orderNumber} — $${updated.totalAmount.toFixed(2)}`,
        html: getBaseEmailTemplate({
          title: 'UPI Payment Received',
          subtitle: updated.orderNumber,
          headerColor: 'amber',
          agentBrandName: 'ADS360',
          footerText: 'ADS360 Shop — Admin Notification',
          content: `
            <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">A customer submitted UPI payment proof!</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <tr style="background: #f9fafb;"><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600;">Order #</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; font-weight: 700; font-family: monospace;">${updated.orderNumber}</td></tr>
              <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Email</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; border-top: 1px solid #f3f4f6;">${updated.email}</td></tr>
              <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Amount</td><td style="padding: 10px 14px; font-size: 16px; color: #059669; font-weight: 700; border-top: 1px solid #f3f4f6;">$${updated.totalAmount.toFixed(2)}</td></tr>
              <tr><td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: 600; border-top: 1px solid #f3f4f6;">Items</td><td style="padding: 10px 14px; font-size: 14px; color: #374151; border-top: 1px solid #f3f4f6;">${itemNames}</td></tr>
            </table>
            <p style="margin: 0; color: #6b7280; font-size: 13px;">Go to admin panel to verify and deliver this order.</p>
          `,
        }),
      }).catch(err => console.error('[Shop] UPI admin email error:', err))
    }
  }

  return c.json({ order: updated })
})

// ============= UPLOAD =============

// POST /upload-proof — public upload for UPI payment screenshots (no auth required)
shop.post('/upload-proof', async (c) => {
  try {
    const body = await c.req.parseBody({ all: true })
    const file = body['file']
    console.log('[Upload-proof] Body keys:', Object.keys(body), 'File type:', typeof file, 'Is File:', file instanceof File)
    if (!file || typeof file === 'string') return c.json({ error: 'No file provided' }, 400)

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length > 5 * 1024 * 1024) return c.json({ error: 'File too large (max 5MB)' }, 400)

    const ext = file.name?.split('.').pop()?.toLowerCase() || 'png'
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return c.json({ error: 'Only images allowed' }, 400)

    const hash = crypto.randomBytes(6).toString('hex')
    const key = `shop/upi-proofs/${hash}-${Date.now()}.${ext}`

    await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: file.type || `image/${ext}` }))
    return c.json({ url: `${R2_PUBLIC_URL}/${key}` })
  } catch (e: any) {
    console.error('Upload proof error:', e)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// POST /upload — upload image to R2 (admin only)
shop.post('/upload', verifyToken, async (c) => {
  try {
    const body = await c.req.parseBody()
    const file = body['file']
    if (!file || typeof file === 'string') return c.json({ error: 'No file provided' }, 400)

    const folder = (body['folder'] as string) || 'shop'
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name?.split('.').pop()?.toLowerCase() || 'png'
    const contentType = file.type || `image/${ext}`
    const hash = crypto.randomBytes(6).toString('hex')
    const key = `${folder}/${hash}-${Date.now()}.${ext}`

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }))

    const url = `${R2_PUBLIC_URL}/${key}`
    return c.json({ url, key })
  } catch (e: any) {
    console.error('Upload error:', e)
    return c.json({ error: 'Upload failed: ' + e.message }, 500)
  }
})

// ============= ADMIN ROUTES =============

// GET /admin/products — list all products
shop.get('/admin/products', verifyToken, async (c) => {
  const products = await prisma.shopProduct.findMany({
    include: { category: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ products })
})

// POST /admin/products — create product
shop.post('/admin/products', verifyToken, async (c) => {
  try {
    const data = await c.req.json()
    const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const product = await prisma.shopProduct.create({
      data: {
        title: data.title,
        slug,
        description: data.description || '',
        shortDesc: data.shortDesc || null,
        price: parseFloat(data.price),
        comparePrice: data.comparePrice ? parseFloat(data.comparePrice) : null,
        images: data.images || [],
        stock: data.stock !== undefined ? parseInt(data.stock) : -1,
        isActive: data.isActive !== false,
        isFeatured: data.isFeatured || false,
        platform: data.platform || 'OTHER',
        features: data.features || [],
        specs: data.specs || null,
        categoryId: data.categoryId,
      },
    })
    return c.json({ product })
  } catch (e: any) {
    if (e?.code === 'P2002') return c.json({ error: 'Slug already exists' }, 400)
    console.error('Create product error:', e)
    return c.json({ error: 'Failed to create product' }, 500)
  }
})

// PUT /admin/products/:id — update product
shop.put('/admin/products/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')
    const data = await c.req.json()
    const product = await prisma.shopProduct.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.slug && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.shortDesc !== undefined && { shortDesc: data.shortDesc }),
        ...(data.price !== undefined && { price: parseFloat(data.price) }),
        ...(data.comparePrice !== undefined && { comparePrice: data.comparePrice ? parseFloat(data.comparePrice) : null }),
        ...(data.images !== undefined && { images: data.images }),
        ...(data.stock !== undefined && { stock: parseInt(data.stock) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
        ...(data.platform && { platform: data.platform }),
        ...(data.features !== undefined && { features: data.features }),
        ...(data.specs !== undefined && { specs: data.specs }),
        ...(data.categoryId && { categoryId: data.categoryId }),
      },
    })
    return c.json({ product })
  } catch (e) {
    return c.json({ error: 'Failed to update product' }, 500)
  }
})

// DELETE /admin/products/:id — delete product
shop.delete('/admin/products/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')
    // Delete linked order items first to avoid foreign key constraint
    await prisma.shopOrderItem.deleteMany({ where: { productId: id } })
    await prisma.shopProduct.delete({ where: { id } })
    return c.json({ success: true })
  } catch (e: any) {
    console.error('[Shop] Delete product error:', e.message)
    return c.json({ error: 'Failed to delete product' }, 500)
  }
})

// GET /admin/categories — list all categories
shop.get('/admin/categories', verifyToken, async (c) => {
  const categories = await prisma.shopCategory.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { products: true } } },
  })
  return c.json({ categories })
})

// POST /admin/categories — create category
shop.post('/admin/categories', verifyToken, async (c) => {
  try {
    const data = await c.req.json()
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const category = await prisma.shopCategory.create({
      data: {
        name: data.name,
        slug,
        icon: data.icon || null,
        image: data.image || null,
        order: data.order || 0,
        isActive: data.isActive !== false,
      },
    })
    return c.json({ category })
  } catch (e: any) {
    if (e?.code === 'P2002') return c.json({ error: 'Slug already exists' }, 400)
    return c.json({ error: 'Failed to create category' }, 500)
  }
})

// PUT /admin/categories/:id — update category
shop.put('/admin/categories/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')
    const data = await c.req.json()
    const category = await prisma.shopCategory.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        ...(data.icon !== undefined && { icon: data.icon || null }),
        ...(data.image !== undefined && { image: data.image || null }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
    return c.json({ category })
  } catch (e) {
    return c.json({ error: 'Failed to update category' }, 500)
  }
})

// DELETE /admin/categories/:id — delete category
shop.delete('/admin/categories/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')
    const hasProducts = await prisma.shopProduct.count({ where: { categoryId: id } })
    if (hasProducts > 0) return c.json({ error: 'Cannot delete category with products' }, 400)
    await prisma.shopCategory.delete({ where: { id } })
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to delete category' }, 500)
  }
})

// GET /admin/orders — list all orders
shop.get('/admin/orders', verifyToken, async (c) => {
  const { status, limit = '50', page = '1' } = c.req.query()
  const take = Math.min(parseInt(limit), 100)
  const skip = (parseInt(page) - 1) * take

  const where: any = {}
  if (status) where.status = status

  const [orders, total] = await Promise.all([
    prisma.shopOrder.findMany({
      where,
      include: { items: { include: { product: { select: { title: true, slug: true } } } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.shopOrder.count({ where }),
  ])

  return c.json({ orders, total, page: parseInt(page), pages: Math.ceil(total / take) })
})

// PUT /admin/orders/:id — update order status
shop.put('/admin/orders/:id', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')
    const data = await c.req.json()
    const order = await prisma.shopOrder.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.txHash && { txHash: data.txHash }),
      },
      include: { items: { include: { product: { select: { title: true } } } } },
    })
    return c.json({ order })
  } catch (e) {
    return c.json({ error: 'Failed to update order' }, 500)
  }
})

// POST /admin/orders/:id/deliver — deliver order with content + send email
shop.post('/admin/orders/:id/deliver', verifyToken, async (c) => {
  try {
    const id = c.req.param('id')
    const { deliveryContent } = await c.req.json()
    if (!deliveryContent?.trim()) return c.json({ error: 'Delivery content is required' }, 400)

    const order = await prisma.shopOrder.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { title: true } } } } },
    })
    if (!order) return c.json({ error: 'Order not found' }, 404)
    if (!order.email) return c.json({ error: 'Order has no email address' }, 400)

    // Update order status to DELIVERED and save delivery content
    const updated = await prisma.shopOrder.update({
      where: { id },
      data: { status: 'DELIVERED', notes: deliveryContent },
      include: { items: { include: { product: { select: { title: true } } } } },
    })

    // Build email template
    const items = order.items.map((i: any) => ({
      title: i.product?.title || 'Product',
      quantity: i.quantity,
      price: i.price,
    }))
    const { subject, html } = getShopOrderDeliveryTemplate({
      orderNumber: order.orderNumber,
      email: order.email,
      items,
      totalAmount: order.totalAmount,
      deliveryContent: deliveryContent.trim(),
    })

    // Send delivery email via shop SMTP
    await shopMailer.sendMail({
      from: '"ADS360 Shop" <vip@ads360.ai>',
      to: order.email,
      subject,
      html,
    })

    console.log(`[Shop] Delivery email sent to ${order.email} for order ${order.orderNumber}`)
    return c.json({ order: updated, emailSent: true })
  } catch (e: any) {
    console.error('[Shop] Deliver error:', e)
    return c.json({ error: 'Failed to deliver: ' + e.message }, 500)
  }
})

// GET /admin/stats — shop stats
shop.get('/admin/stats', verifyToken, async (c) => {
  const [totalProducts, activeProducts, totalOrders, pendingOrders, totalRevenue] = await Promise.all([
    prisma.shopProduct.count(),
    prisma.shopProduct.count({ where: { isActive: true } }),
    prisma.shopOrder.count(),
    prisma.shopOrder.count({ where: { status: { in: ['PENDING', 'PAID'] } } }),
    prisma.shopOrder.aggregate({ where: { status: { in: ['PAID', 'DELIVERED'] } }, _sum: { totalAmount: true } }),
  ])

  return c.json({
    totalProducts,
    activeProducts,
    totalOrders,
    pendingOrders,
    totalRevenue: totalRevenue._sum.totalAmount || 0,
  })
})

// GET /admin/settings — get shop wallet settings (separate from 6AD system)
shop.get('/admin/settings', verifyToken, async (c) => {
  const shopSettings = await prisma.cmsSection.findUnique({ where: { sectionKey: 'shop-settings' } }).catch(() => null)
  const d = (shopSettings?.data as any) || {}
  return c.json({
    trc20WalletAddress: d.trc20WalletAddress || '',
    bep20WalletAddress: d.bep20WalletAddress || '',
    upiId: d.upiId || '',
  })
})

// PUT /admin/settings — update shop wallet settings (stored in shop-settings, NOT cryptoWalletConfig)
shop.put('/admin/settings', verifyToken, async (c) => {
  const { trc20WalletAddress, bep20WalletAddress, upiId } = await c.req.json()
  try {
    const existing = await prisma.cmsSection.findUnique({ where: { sectionKey: 'shop-settings' } }).catch(() => null)
    const currentData = (existing?.data as any) || {}
    const updatedData = { ...currentData }
    if (trc20WalletAddress !== undefined) updatedData.trc20WalletAddress = trc20WalletAddress
    if (bep20WalletAddress !== undefined) updatedData.bep20WalletAddress = bep20WalletAddress
    if (upiId !== undefined) updatedData.upiId = upiId
    await prisma.cmsSection.upsert({
      where: { sectionKey: 'shop-settings' },
      update: { data: updatedData },
      create: { sectionKey: 'shop-settings', data: updatedData },
    })
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: 'Failed to update settings: ' + e.message }, 500)
  }
})

export default shop
