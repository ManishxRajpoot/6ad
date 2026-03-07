import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken, verifyAdmin } from '../middleware/auth'
import { sendEmail, buildSmtpConfig, getBaseEmailTemplate } from '../utils/email'

const emails = new Hono()

// POST /emails/send - Send email to specific users
emails.post('/send', verifyToken, verifyAdmin, async (c) => {
  try {
    const adminId = c.get('userId')
    const { userIds, subject, body } = await c.req.json()

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return c.json({ error: 'userIds (array) is required' }, 400)
    }
    if (!subject?.trim() || !body?.trim()) {
      return c.json({ error: 'subject and body are required' }, 400)
    }

    // Fetch users with their agent info (SMTP + branding)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, role: 'USER' },
      select: {
        id: true,
        email: true,
        username: true,
        agent: {
          select: {
            id: true,
            username: true,
            smtpEnabled: true,
            smtpHost: true,
            smtpPort: true,
            smtpUsername: true,
            smtpPassword: true,
            smtpEncryption: true,
            smtpFromEmail: true,
            emailSenderNameApproved: true,
            emailLogo: true,
            brandName: true,
          }
        }
      }
    })

    if (users.length === 0) {
      return c.json({ error: 'No valid users found' }, 404)
    }

    let sent = 0
    let failed = 0
    const logs: any[] = []

    for (const user of users) {
      const smtpConfig = buildSmtpConfig(user.agent)
      const senderName = user.agent?.emailSenderNameApproved || user.agent?.brandName || (user.agent?.smtpEnabled ? user.agent?.username : undefined) || undefined

      // Build branded HTML
      const html = getBaseEmailTemplate({
        title: subject,
        headerColor: 'purple',
        agentLogo: user.agent?.emailLogo || null,
        agentBrandName: user.agent?.brandName || user.agent?.emailSenderNameApproved || (user.agent?.smtpEnabled ? user.agent?.username : null) || null,
        content: `
          <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
            Dear <strong>${user.username}</strong>,
          </p>
          <div style="color: #374151; font-size: 14px; line-height: 1.7;">
            ${body.replace(/\n/g, '<br/>')}
          </div>
        `
      })

      try {
        const success = await sendEmail({
          to: user.email,
          subject,
          html,
          senderName,
          smtpConfig,
        })

        if (success) {
          sent++
          logs.push({
            sentBy: adminId,
            recipientEmail: user.email,
            recipientUserId: user.id,
            recipientName: user.username,
            agentId: user.agent?.id || null,
            agentName: user.agent?.username || null,
            smtpUsed: smtpConfig ? 'agent' : 'default',
            subject,
            body,
            status: 'SENT',
          })
        } else {
          failed++
          logs.push({
            sentBy: adminId,
            recipientEmail: user.email,
            recipientUserId: user.id,
            recipientName: user.username,
            agentId: user.agent?.id || null,
            agentName: user.agent?.username || null,
            smtpUsed: smtpConfig ? 'agent' : 'default',
            subject,
            body,
            status: 'FAILED',
            error: 'sendEmail returned false',
          })
        }
      } catch (err: any) {
        failed++
        logs.push({
          sentBy: adminId,
          recipientEmail: user.email,
          recipientUserId: user.id,
          recipientName: user.username,
          agentId: user.agent?.id || null,
          agentName: user.agent?.username || null,
          smtpUsed: smtpConfig ? 'agent' : 'default',
          subject,
          body,
          status: 'FAILED',
          error: err.message || 'Unknown error',
        })
      }
    }

    // Bulk-insert logs
    if (logs.length > 0) {
      await prisma.emailLog.createMany({ data: logs })
    }

    return c.json({ sent, failed, total: users.length })
  } catch (error: any) {
    console.error('Email send error:', error)
    return c.json({ error: 'Failed to send emails' }, 500)
  }
})

// POST /emails/send-all - Send email to all users
emails.post('/send-all', verifyToken, verifyAdmin, async (c) => {
  try {
    const adminId = c.get('userId')
    const { subject, body } = await c.req.json()

    if (!subject?.trim() || !body?.trim()) {
      return c.json({ error: 'subject and body are required' }, 400)
    }

    // Fetch all users with agent info
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      select: {
        id: true,
        email: true,
        username: true,
        agent: {
          select: {
            id: true,
            username: true,
            smtpEnabled: true,
            smtpHost: true,
            smtpPort: true,
            smtpUsername: true,
            smtpPassword: true,
            smtpEncryption: true,
            smtpFromEmail: true,
            emailSenderNameApproved: true,
            emailLogo: true,
            brandName: true,
          }
        }
      }
    })

    if (users.length === 0) {
      return c.json({ error: 'No users found' }, 404)
    }

    let sent = 0
    let failed = 0
    const logs: any[] = []

    for (const user of users) {
      const smtpConfig = buildSmtpConfig(user.agent)
      const senderName = user.agent?.emailSenderNameApproved || user.agent?.brandName || (user.agent?.smtpEnabled ? user.agent?.username : undefined) || undefined

      const html = getBaseEmailTemplate({
        title: subject,
        headerColor: 'purple',
        agentLogo: user.agent?.emailLogo || null,
        agentBrandName: user.agent?.brandName || user.agent?.emailSenderNameApproved || (user.agent?.smtpEnabled ? user.agent?.username : null) || null,
        content: `
          <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
            Dear <strong>${user.username}</strong>,
          </p>
          <div style="color: #374151; font-size: 14px; line-height: 1.7;">
            ${body.replace(/\n/g, '<br/>')}
          </div>
        `
      })

      try {
        const success = await sendEmail({
          to: user.email,
          subject,
          html,
          senderName,
          smtpConfig,
        })

        if (success) {
          sent++
          logs.push({
            sentBy: adminId,
            recipientEmail: user.email,
            recipientUserId: user.id,
            recipientName: user.username,
            agentId: user.agent?.id || null,
            agentName: user.agent?.username || null,
            smtpUsed: smtpConfig ? 'agent' : 'default',
            subject,
            body,
            status: 'SENT',
          })
        } else {
          failed++
          logs.push({
            sentBy: adminId,
            recipientEmail: user.email,
            recipientUserId: user.id,
            recipientName: user.username,
            agentId: user.agent?.id || null,
            agentName: user.agent?.username || null,
            smtpUsed: smtpConfig ? 'agent' : 'default',
            subject,
            body,
            status: 'FAILED',
            error: 'sendEmail returned false',
          })
        }
      } catch (err: any) {
        failed++
        logs.push({
          sentBy: adminId,
          recipientEmail: user.email,
          recipientUserId: user.id,
          recipientName: user.username,
          agentId: user.agent?.id || null,
          agentName: user.agent?.username || null,
          smtpUsed: smtpConfig ? 'agent' : 'default',
          subject,
          body,
          status: 'FAILED',
          error: err.message || 'Unknown error',
        })
      }
    }

    // Bulk-insert logs
    if (logs.length > 0) {
      await prisma.emailLog.createMany({ data: logs })
    }

    return c.json({ sent, failed, total: users.length })
  } catch (error: any) {
    console.error('Email send-all error:', error)
    return c.json({ error: 'Failed to send emails' }, 500)
  }
})

// POST /emails/send-agent - Send email to all users of a specific agent
emails.post('/send-agent', verifyToken, verifyAdmin, async (c) => {
  try {
    const adminId = c.get('userId')
    const { agentId, subject, body } = await c.req.json()

    if (!agentId?.trim()) {
      return c.json({ error: 'agentId is required' }, 400)
    }
    if (!subject?.trim() || !body?.trim()) {
      return c.json({ error: 'subject and body are required' }, 400)
    }

    // Verify agent exists
    const agent = await prisma.user.findFirst({
      where: { id: agentId, role: 'AGENT' },
      select: { id: true, username: true },
    })
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Fetch all users under this agent with agent info (SMTP + branding)
    const users = await prisma.user.findMany({
      where: { agentId, role: 'USER' },
      select: {
        id: true,
        email: true,
        username: true,
        agent: {
          select: {
            id: true,
            username: true,
            smtpEnabled: true,
            smtpHost: true,
            smtpPort: true,
            smtpUsername: true,
            smtpPassword: true,
            smtpEncryption: true,
            smtpFromEmail: true,
            emailSenderNameApproved: true,
            emailLogo: true,
            brandName: true,
          }
        }
      }
    })

    if (users.length === 0) {
      return c.json({ error: `No users found under agent "${agent.username}"` }, 404)
    }

    let sent = 0
    let failed = 0
    const logs: any[] = []

    for (const user of users) {
      const smtpConfig = buildSmtpConfig(user.agent)
      const senderName = user.agent?.emailSenderNameApproved || user.agent?.brandName || (user.agent?.smtpEnabled ? user.agent?.username : undefined) || undefined

      const html = getBaseEmailTemplate({
        title: subject,
        headerColor: 'purple',
        agentLogo: user.agent?.emailLogo || null,
        agentBrandName: user.agent?.brandName || user.agent?.emailSenderNameApproved || (user.agent?.smtpEnabled ? user.agent?.username : null) || null,
        content: `
          <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
            Dear <strong>${user.username}</strong>,
          </p>
          <div style="color: #374151; font-size: 14px; line-height: 1.7;">
            ${body.replace(/\n/g, '<br/>')}
          </div>
        `
      })

      try {
        const success = await sendEmail({
          to: user.email,
          subject,
          html,
          senderName,
          smtpConfig,
        })

        if (success) {
          sent++
          logs.push({
            sentBy: adminId,
            recipientEmail: user.email,
            recipientUserId: user.id,
            recipientName: user.username,
            agentId: user.agent?.id || null,
            agentName: user.agent?.username || null,
            smtpUsed: smtpConfig ? 'agent' : 'default',
            subject,
            body,
            status: 'SENT',
          })
        } else {
          failed++
          logs.push({
            sentBy: adminId,
            recipientEmail: user.email,
            recipientUserId: user.id,
            recipientName: user.username,
            agentId: user.agent?.id || null,
            agentName: user.agent?.username || null,
            smtpUsed: smtpConfig ? 'agent' : 'default',
            subject,
            body,
            status: 'FAILED',
            error: 'sendEmail returned false',
          })
        }
      } catch (err: any) {
        failed++
        logs.push({
          sentBy: adminId,
          recipientEmail: user.email,
          recipientUserId: user.id,
          recipientName: user.username,
          agentId: user.agent?.id || null,
          agentName: user.agent?.username || null,
          smtpUsed: smtpConfig ? 'agent' : 'default',
          subject,
          body,
          status: 'FAILED',
          error: err.message || 'Unknown error',
        })
      }
    }

    // Bulk-insert logs
    if (logs.length > 0) {
      await prisma.emailLog.createMany({ data: logs })
    }

    return c.json({ sent, failed, total: users.length })
  } catch (error: any) {
    console.error('Email send-agent error:', error)
    return c.json({ error: 'Failed to send emails' }, 500)
  }
})

// GET /emails/logs - Get email send history
emails.get('/logs', verifyToken, verifyAdmin, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '50')
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailLog.count(),
    ])

    return c.json({ logs, total, page, pages: Math.ceil(total / limit) })
  } catch (error: any) {
    console.error('Email logs error:', error)
    return c.json({ error: 'Failed to fetch email logs' }, 500)
  }
})

export default emails
