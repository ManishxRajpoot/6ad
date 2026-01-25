import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { verifyToken, requireAdmin } from '../middleware/auth.js'

const prisma = new PrismaClient()
const app = new Hono()

// Get all payment methods (public - for users to see available methods)
app.get('/', async (c) => {
  try {
    const showAll = c.req.query('all') === 'true'

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: showAll ? {} : { isEnabled: true },
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    return c.json({ paymentMethods })
  } catch (error) {
    console.error('Failed to fetch payment methods:', error)
    return c.json({ error: 'Failed to fetch payment methods' }, 500)
  }
})

// Get single payment method
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id }
    })

    if (!paymentMethod) {
      return c.json({ error: 'Payment method not found' }, 404)
    }

    return c.json({ paymentMethod })
  } catch (error) {
    console.error('Failed to fetch payment method:', error)
    return c.json({ error: 'Failed to fetch payment method' }, 500)
  }
})

// Create payment method (admin only)
app.post('/', verifyToken, requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const { name, description, icon, isEnabled, isDefault, sortOrder } = body

    if (!name || !name.trim()) {
      return c.json({ error: 'Payment method name is required' }, 400)
    }

    // If this is being set as default, unset other defaults
    if (isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || '💳',
        isEnabled: isEnabled !== false,
        isDefault: isDefault || false,
        sortOrder: sortOrder || 0
      }
    })

    return c.json({ paymentMethod, message: 'Payment method created successfully' }, 201)
  } catch (error) {
    console.error('Failed to create payment method:', error)
    return c.json({ error: 'Failed to create payment method' }, 500)
  }
})

// Update payment method (admin only)
app.patch('/:id', verifyToken, requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { name, description, icon, isEnabled, isDefault, sortOrder } = body

    const existing = await prisma.paymentMethod.findUnique({
      where: { id }
    })

    if (!existing) {
      return c.json({ error: 'Payment method not found' }, 404)
    }

    // If this is being set as default, unset other defaults
    if (isDefault && !existing.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (icon !== undefined) updateData.icon = icon
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled
    if (isDefault !== undefined) updateData.isDefault = isDefault
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder

    const paymentMethod = await prisma.paymentMethod.update({
      where: { id },
      data: updateData
    })

    return c.json({ paymentMethod, message: 'Payment method updated successfully' })
  } catch (error) {
    console.error('Failed to update payment method:', error)
    return c.json({ error: 'Failed to update payment method' }, 500)
  }
})

// Delete payment method (admin only)
app.delete('/:id', verifyToken, requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')

    const existing = await prisma.paymentMethod.findUnique({
      where: { id }
    })

    if (!existing) {
      return c.json({ error: 'Payment method not found' }, 404)
    }

    await prisma.paymentMethod.delete({
      where: { id }
    })

    return c.json({ message: 'Payment method deleted successfully' })
  } catch (error) {
    console.error('Failed to delete payment method:', error)
    return c.json({ error: 'Failed to delete payment method' }, 500)
  }
})

// Bulk update order (admin only)
app.post('/reorder', verifyToken, requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const { orders } = body // Array of { id, sortOrder }

    if (!Array.isArray(orders)) {
      return c.json({ error: 'Orders array is required' }, 400)
    }

    await Promise.all(
      orders.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
        prisma.paymentMethod.update({
          where: { id },
          data: { sortOrder }
        })
      )
    )

    return c.json({ message: 'Payment methods reordered successfully' })
  } catch (error) {
    console.error('Failed to reorder payment methods:', error)
    return c.json({ error: 'Failed to reorder payment methods' }, 500)
  }
})

export default app
