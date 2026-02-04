import nodemailer from 'nodemailer'

// Create reusable transporter using Hostinger SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true, // use SSL
  auth: {
    user: 'info@6ad.in',
    pass: 'Bigindia@555'
  }
})

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection error:', error)
  } else {
    console.log('SMTP server is ready to send emails')
  }
})

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  senderName?: string  // Custom sender name for whitelabel agencies
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const senderName = options.senderName || 'Six Media'
    const info = await transporter.sendMail({
      from: `"${senderName}" <info@6ad.in>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, '')
    })

    console.log('Email sent:', info.messageId)
    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

// Six Media Logo SVG (inline for email)
const SIX_MEDIA_LOGO_SVG = `
<svg viewBox="0 0 48 28" width="48" height="28" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366F1"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
    <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#EC4899"/>
    </linearGradient>
  </defs>
  <path d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14" fill="url(#g1)"/>
  <path d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14" fill="url(#g2)"/>
  <ellipse cx="24" cy="14" rx="4" ry="5" fill="white" opacity="0.15"/>
</svg>
`

// Get logo HTML - uses agent logo if available, otherwise Six Media logo
function getLogoHtml(agentLogo?: string | null): string {
  if (agentLogo) {
    return `<img src="${agentLogo}" alt="Logo" style="height: 40px; max-width: 180px; object-fit: contain;" />`
  }
  return `
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right: 10px;">${SIX_MEDIA_LOGO_SVG}</td>
        <td>
          <span style="font-size: 18px; font-weight: 700; background: linear-gradient(to right, #6366F1, #8B5CF6, #EC4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">SIXMEDIA</span>
          <br/>
          <span style="font-size: 9px; font-weight: 600; letter-spacing: 2px; color: #9CA3AF;">ADVERTISING</span>
        </td>
      </tr>
    </table>
  `
}

// Status badge colors
const STATUS_COLORS = {
  pending: { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' },
  approved: { bg: '#D1FAE5', text: '#059669', border: '#6EE7B7' },
  rejected: { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
  info: { bg: '#DBEAFE', text: '#2563EB', border: '#93C5FD' }
}

// Base email template wrapper
interface BaseTemplateOptions {
  title: string
  subtitle?: string
  headerColor?: 'purple' | 'green' | 'red' | 'amber'
  agentLogo?: string | null
  content: string
  footerText?: string
}

function getBaseEmailTemplate(options: BaseTemplateOptions): string {
  const { title, subtitle, headerColor = 'purple', agentLogo, content, footerText } = options

  const gradients = {
    purple: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)',
    green: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    red: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    amber: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
              <!-- Header -->
              <tr>
                <td style="padding: 28px 32px 24px; background: ${gradients[headerColor]}; border-radius: 16px 16px 0 0;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>${getLogoHtml(agentLogo)}</td>
                    </tr>
                    <tr>
                      <td style="padding-top: 20px;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">${title}</h1>
                        ${subtitle ? `<p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">${subtitle}</p>` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 32px;">
                  ${content}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 32px; background-color: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center; line-height: 1.6;">
                    ${footerText || 'This is an automated message from Six Media Platform.<br>Please do not reply to this email.'}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// Helper to create info row
function createInfoRow(label: string, value: string, isCode = false): string {
  return `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="color: #6b7280; font-size: 13px;">${label}</span>
      </td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
        <span style="color: #111827; font-size: 14px; font-weight: 600; ${isCode ? 'font-family: monospace; background: #f3f4f6; padding: 2px 8px; border-radius: 4px;' : ''}">${value}</span>
      </td>
    </tr>
  `
}

// Helper to create status badge
function createStatusBadge(status: 'pending' | 'approved' | 'rejected'): string {
  const colors = STATUS_COLORS[status]
  const labels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }
  return `<span style="display: inline-block; padding: 4px 12px; background: ${colors.bg}; color: ${colors.text}; font-size: 12px; font-weight: 600; border-radius: 20px; border: 1px solid ${colors.border};">${labels[status]}</span>`
}

// =====================================================
// AD ACCOUNT EMAIL TEMPLATES
// =====================================================

interface AdAccountEmailData {
  username: string
  applyId: string
  platform: string
  accountName?: string
  accountId?: string
  adminRemarks?: string
  agentLogo?: string | null
}

export function getAdAccountSubmittedTemplate(data: AdAccountEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your ad account opening request has been submitted successfully. Our team will review your request and get back to you shortly.
    </p>

    <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Application ID', data.applyId, true)}
        ${createInfoRow('Platform', data.platform)}
        ${createInfoRow('Status', createStatusBadge('pending'))}
        ${createInfoRow('Submitted', new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }))}
      </table>
    </div>

    <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
      You will receive an email notification once your request is processed.
    </p>
  `

  return {
    subject: `Ad Account Request Submitted - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Submitted',
      subtitle: 'Ad Account Opening',
      headerColor: 'purple',
      agentLogo: data.agentLogo,
      content
    })
  }
}

export function getAdAccountApprovedTemplate(data: AdAccountEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Great news! Your ad account request has been <strong style="color: #059669;">approved</strong>. Your account is now ready to use.
    </p>

    <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.08) 100%); border: 1px solid #D1FAE5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Application ID', data.applyId, true)}
        ${createInfoRow('Platform', data.platform)}
        ${data.accountId ? createInfoRow('Account ID', data.accountId, true) : ''}
        ${data.accountName ? createInfoRow('Account Name', data.accountName) : ''}
        ${createInfoRow('Status', createStatusBadge('approved'))}
      </table>
    </div>

    ${data.adminRemarks ? `
    <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #065f46; font-size: 13px;"><strong>Remarks:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
      You can now start using your ad account. Log in to your dashboard to manage your campaigns.
    </p>
  `

  return {
    subject: `Ad Account Approved - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Approved',
      subtitle: 'Ad Account Opening',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      content
    })
  }
}

export function getAdAccountRejectedTemplate(data: AdAccountEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We regret to inform you that your ad account request has been <strong style="color: #DC2626;">rejected</strong>.
    </p>

    <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.08) 100%); border: 1px solid #FEE2E2; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Application ID', data.applyId, true)}
        ${createInfoRow('Platform', data.platform)}
        ${createInfoRow('Status', createStatusBadge('rejected'))}
      </table>
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have questions, please contact support for more information.
    </p>
  `

  return {
    subject: `Ad Account Request Rejected - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Rejected',
      subtitle: 'Ad Account Opening',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      content
    })
  }
}

// =====================================================
// WALLET DEPOSIT EMAIL TEMPLATES
// =====================================================

interface WalletDepositEmailData {
  username: string
  applyId: string
  amount: number
  paymentMethod?: string
  txHash?: string
  adminRemarks?: string
  newBalance?: number
  agentLogo?: string | null
}

export function getWalletDepositSubmittedTemplate(data: WalletDepositEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your wallet deposit request has been submitted successfully. Our team will verify your payment and credit your account.
    </p>

    <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Reference ID', data.applyId, true)}
        ${createInfoRow('Amount', `$${data.amount.toLocaleString()}`)}
        ${data.paymentMethod ? createInfoRow('Payment Method', data.paymentMethod) : ''}
        ${data.txHash ? createInfoRow('Transaction Hash', data.txHash.slice(0, 20) + '...') : ''}
        ${createInfoRow('Status', createStatusBadge('pending'))}
      </table>
    </div>

    <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
      You will receive a confirmation email once your deposit is processed.
    </p>
  `

  return {
    subject: `Wallet Deposit Submitted - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Deposit Submitted',
      subtitle: 'Wallet Top-up',
      headerColor: 'purple',
      agentLogo: data.agentLogo,
      content
    })
  }
}

export function getWalletDepositApprovedTemplate(data: WalletDepositEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your wallet deposit has been <strong style="color: #059669;">approved</strong> and credited to your account.
    </p>

    <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.08) 100%); border: 1px solid #D1FAE5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Reference ID', data.applyId, true)}
        ${createInfoRow('Amount Credited', `$${data.amount.toLocaleString()}`)}
        ${data.newBalance !== undefined ? createInfoRow('New Balance', `$${data.newBalance.toLocaleString()}`) : ''}
        ${createInfoRow('Status', createStatusBadge('approved'))}
      </table>
    </div>

    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
      Your funds are now available for use. Thank you for your deposit!
    </p>
  `

  return {
    subject: `Wallet Deposit Approved - $${data.amount}`,
    html: getBaseEmailTemplate({
      title: 'Deposit Approved',
      subtitle: 'Wallet Top-up',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      content
    })
  }
}

export function getWalletDepositRejectedTemplate(data: WalletDepositEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your wallet deposit request has been <strong style="color: #DC2626;">rejected</strong>.
    </p>

    <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.08) 100%); border: 1px solid #FEE2E2; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Reference ID', data.applyId, true)}
        ${createInfoRow('Amount', `$${data.amount.toLocaleString()}`)}
        ${createInfoRow('Status', createStatusBadge('rejected'))}
      </table>
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      Please contact support if you believe this is an error.
    </p>
  `

  return {
    subject: `Wallet Deposit Rejected - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Deposit Rejected',
      subtitle: 'Wallet Top-up',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      content
    })
  }
}

// =====================================================
// ACCOUNT RECHARGE EMAIL TEMPLATES
// =====================================================

interface AccountRechargeEmailData {
  username: string
  applyId: string
  amount: number
  commission: number
  totalCost: number
  platform: string
  accountId: string
  accountName?: string
  newBalance?: number
  adminRemarks?: string
  agentLogo?: string | null
}

export function getAccountRechargeSubmittedTemplate(data: AccountRechargeEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your ad account recharge request has been submitted. The amount has been deducted from your wallet and is pending processing.
    </p>

    <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Reference ID', data.applyId, true)}
        ${createInfoRow('Platform', data.platform)}
        ${createInfoRow('Account ID', data.accountId, true)}
        ${createInfoRow('Recharge Amount', `$${data.amount.toLocaleString()}`)}
        ${createInfoRow('Commission', `$${data.commission.toLocaleString()}`)}
        ${createInfoRow('Total Deducted', `$${data.totalCost.toLocaleString()}`)}
        ${createInfoRow('Status', createStatusBadge('pending'))}
      </table>
    </div>

    <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
      You will receive a confirmation once your recharge is processed.
    </p>
  `

  return {
    subject: `Account Recharge Submitted - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Recharge Submitted',
      subtitle: 'Ad Account Top-up',
      headerColor: 'purple',
      agentLogo: data.agentLogo,
      content
    })
  }
}

export function getAccountRechargeApprovedTemplate(data: AccountRechargeEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your ad account recharge has been <strong style="color: #059669;">approved</strong> and processed successfully.
    </p>

    <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.08) 100%); border: 1px solid #D1FAE5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Reference ID', data.applyId, true)}
        ${createInfoRow('Platform', data.platform)}
        ${createInfoRow('Account ID', data.accountId, true)}
        ${createInfoRow('Amount Added', `$${data.amount.toLocaleString()}`)}
        ${data.newBalance !== undefined ? createInfoRow('Account Balance', `$${data.newBalance.toLocaleString()}`) : ''}
        ${createInfoRow('Status', createStatusBadge('approved'))}
      </table>
    </div>

    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
      Your ad account has been topped up and is ready for use.
    </p>
  `

  return {
    subject: `Account Recharge Approved - $${data.amount}`,
    html: getBaseEmailTemplate({
      title: 'Recharge Approved',
      subtitle: 'Ad Account Top-up',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      content
    })
  }
}

export function getAccountRechargeRejectedTemplate(data: AccountRechargeEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your ad account recharge request has been <strong style="color: #DC2626;">rejected</strong>. The amount has been refunded to your wallet.
    </p>

    <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.08) 100%); border: 1px solid #FEE2E2; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Reference ID', data.applyId, true)}
        ${createInfoRow('Platform', data.platform)}
        ${createInfoRow('Account ID', data.accountId, true)}
        ${createInfoRow('Amount Refunded', `$${data.totalCost.toLocaleString()}`)}
        ${createInfoRow('Status', createStatusBadge('rejected'))}
      </table>
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #065f46; font-size: 13px;"><strong>Refund:</strong> $${data.totalCost.toLocaleString()} has been credited back to your wallet.</p>
    </div>
  `

  return {
    subject: `Account Recharge Rejected - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Recharge Rejected',
      subtitle: 'Ad Account Top-up',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      content
    })
  }
}

// =====================================================
// BM SHARE EMAIL TEMPLATES
// =====================================================

interface BMShareEmailData {
  username: string
  applyId: string
  platform: string
  adAccountId: string
  bmId: string
  adminRemarks?: string
  agentLogo?: string | null
}

export function getBMShareSubmittedTemplate(data: BMShareEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your Business Manager share request has been submitted successfully.
    </p>

    <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Reference ID', data.applyId, true)}
        ${createInfoRow('Platform', data.platform)}
        ${createInfoRow('Ad Account ID', data.adAccountId, true)}
        ${createInfoRow('BM ID', data.bmId, true)}
        ${createInfoRow('Status', createStatusBadge('pending'))}
      </table>
    </div>

    <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
      You will receive a notification once your request is processed.
    </p>
  `

  return {
    subject: `BM Share Request Submitted - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Submitted',
      subtitle: 'Business Manager Share',
      headerColor: 'purple',
      agentLogo: data.agentLogo,
      content
    })
  }
}

export function getBMShareApprovedTemplate(data: BMShareEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your Business Manager share request has been <strong style="color: #059669;">approved</strong>.
    </p>

    <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.08) 100%); border: 1px solid #D1FAE5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Reference ID', data.applyId, true)}
        ${createInfoRow('Platform', data.platform)}
        ${createInfoRow('Ad Account ID', data.adAccountId, true)}
        ${createInfoRow('BM ID', data.bmId, true)}
        ${createInfoRow('Status', createStatusBadge('approved'))}
      </table>
    </div>

    ${data.adminRemarks ? `
    <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #065f46; font-size: 13px;"><strong>Note:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
      Your ad account has been shared to the Business Manager successfully.
    </p>
  `

  return {
    subject: `BM Share Approved - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Approved',
      subtitle: 'Business Manager Share',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      content
    })
  }
}

export function getBMShareRejectedTemplate(data: BMShareEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your Business Manager share request has been <strong style="color: #DC2626;">rejected</strong>.
    </p>

    <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.08) 100%); border: 1px solid #FEE2E2; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Reference ID', data.applyId, true)}
        ${createInfoRow('Platform', data.platform)}
        ${createInfoRow('Ad Account ID', data.adAccountId, true)}
        ${createInfoRow('BM ID', data.bmId, true)}
        ${createInfoRow('Status', createStatusBadge('rejected'))}
      </table>
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      Please verify your BM ID and try again, or contact support for assistance.
    </p>
  `

  return {
    subject: `BM Share Rejected - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Rejected',
      subtitle: 'Business Manager Share',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      content
    })
  }
}

// =====================================================
// ADMIN/AGENT NOTIFICATION TEMPLATES
// =====================================================

interface AdminNotificationData {
  type: 'ad_account' | 'wallet_deposit' | 'account_recharge' | 'bm_share'
  applyId: string
  username: string
  userEmail: string
  amount?: number
  platform?: string
  details?: string
}

export function getAdminNotificationTemplate(data: AdminNotificationData): { subject: string; html: string } {
  const typeLabels = {
    ad_account: 'New Ad Account Request',
    wallet_deposit: 'New Wallet Deposit',
    account_recharge: 'New Account Recharge',
    bm_share: 'New BM Share Request'
  }

  const content = `
    <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
      A new request requires your attention.
    </p>

    <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%); border: 1px solid #E0E7FF; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${createInfoRow('Request Type', typeLabels[data.type])}
        ${createInfoRow('Reference ID', data.applyId, true)}
        ${createInfoRow('User', data.username)}
        ${createInfoRow('Email', data.userEmail)}
        ${data.platform ? createInfoRow('Platform', data.platform) : ''}
        ${data.amount ? createInfoRow('Amount', `$${data.amount.toLocaleString()}`) : ''}
        ${data.details ? createInfoRow('Details', data.details) : ''}
        ${createInfoRow('Status', createStatusBadge('pending'))}
      </table>
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      Please log in to the admin panel to review and process this request.
    </p>
  `

  return {
    subject: `[Action Required] ${typeLabels[data.type]} - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: typeLabels[data.type],
      subtitle: `From: ${data.username}`,
      headerColor: 'amber',
      content
    })
  }
}

// =====================================================
// EXISTING TEMPLATES (UPDATED DESIGN)
// =====================================================

// Email templates (updated to new design)
export function getVerificationEmailTemplate(code: string, username: string, agentLogo?: string | null): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Use the verification code below to verify your email address. This code will expire in 10 minutes.
    </p>

    <!-- Code Box -->
    <div style="background-color: #f9fafb; border: 2px dashed #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
      <p style="margin: 0; color: #111827; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">${code}</p>
    </div>

    <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
      If you didn't request this verification, please ignore this email or contact support if you have concerns.
    </p>
  `

  return {
    subject: 'Email Verification Code',
    html: getBaseEmailTemplate({
      title: 'Email Verification',
      subtitle: 'Verify your email address',
      headerColor: 'green',
      agentLogo,
      content
    })
  }
}

export function get2FADisabledEmailTemplate(username: string, agentLogo?: string | null): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Hello <strong>${username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Two-factor authentication has been <strong style="color: #DC2626;">disabled</strong> on your account.
    </p>

    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;">
        <strong>Warning:</strong> If you did not make this change, please contact support immediately and secure your account.
      </p>
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      We recommend re-enabling two-factor authentication to keep your account secure.
    </p>
  `

  return {
    subject: 'Security Alert - Two-Factor Authentication Disabled',
    html: getBaseEmailTemplate({
      title: 'Security Alert',
      subtitle: '2FA has been disabled',
      headerColor: 'red',
      agentLogo,
      content
    })
  }
}
