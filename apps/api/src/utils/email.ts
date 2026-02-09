import nodemailer from 'nodemailer'

// Default SMTP configuration from environment variables
const DEFAULT_SMTP = {
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE !== 'false', // default true
  user: process.env.SMTP_USER || 'info@6ad.in',
  pass: process.env.SMTP_PASS || '',
  fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'info@6ad.in',
  fromName: process.env.SMTP_FROM_NAME || 'Six Media'
}

// Log SMTP config on module load (hide password)
console.log('[EMAIL] SMTP Config loaded:', {
  host: DEFAULT_SMTP.host,
  port: DEFAULT_SMTP.port,
  secure: DEFAULT_SMTP.secure,
  user: DEFAULT_SMTP.user,
  fromEmail: DEFAULT_SMTP.fromEmail,
  hasPassword: !!DEFAULT_SMTP.pass
})

// Create default transporter using SMTP from env
const defaultTransporter = nodemailer.createTransport({
  host: DEFAULT_SMTP.host,
  port: DEFAULT_SMTP.port,
  secure: DEFAULT_SMTP.secure,
  auth: {
    user: DEFAULT_SMTP.user,
    pass: DEFAULT_SMTP.pass
  },
  // DKIM alignment: ensure envelope sender matches From header domain
  // This helps SPF/DKIM alignment and prevents spam flagging
  dkim: undefined,  // Will use Hostinger's DKIM if configured in DNS
  pool: true,        // Reuse SMTP connection for better performance
  maxConnections: 3, // Limit concurrent connections
  maxMessages: 50,   // Messages per connection before reconnecting
})

// Verify connection on startup (async to avoid blocking)
;(async () => {
  try {
    await defaultTransporter.verify()
    console.log('[EMAIL] SMTP server is ready to send emails')
    console.log('[EMAIL] SMTP From:', DEFAULT_SMTP.fromEmail)
  } catch (error) {
    console.error('[EMAIL] SMTP connection error:', error)
  }
})()

// SMTP Configuration interface for custom agency SMTP
export interface SmtpConfig {
  host: string
  port: number
  username: string
  password: string
  encryption: 'TLS' | 'SSL' | 'NONE'
  fromEmail: string
  fromName?: string
}

// Create transporter with custom SMTP config
function createCustomTransporter(config: SmtpConfig) {
  // Auto-detect secure mode based on port if encryption setting is mismatched
  // Port 465 always uses implicit SSL/TLS (secure: true)
  // Port 587/25 use STARTTLS (secure: false, then upgrade)
  const isImplicitTLS = config.port === 465
  const useSecure = config.encryption === 'SSL' || isImplicitTLS

  console.log('[SMTP] Creating transporter:', {
    host: config.host,
    port: config.port,
    encryption: config.encryption,
    useSecure,
    isImplicitTLS
  })

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: useSecure,
    auth: {
      user: config.username,
      pass: config.password
    },
    // For port 587, require TLS upgrade (STARTTLS)
    ...(config.port === 587 && !useSecure && { requireTLS: true }),
    // Connection timeout for better error messages
    connectionTimeout: 30000,
    greetingTimeout: 15000,
    socketTimeout: 30000
  })
}

// Test SMTP connection
export async function testSmtpConnection(config: SmtpConfig): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[SMTP] Testing connection to:', config.host, 'port:', config.port)
    const transporter = createCustomTransporter(config)
    await transporter.verify()
    console.log('[SMTP] Connection test successful')
    return { success: true }
  } catch (error: any) {
    console.error('[SMTP] Connection test failed:', error.message)

    // Provide more helpful error messages
    let errorMessage = error.message || 'Connection failed'

    if (error.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to ${config.host}:${config.port}. Server may be blocking the connection or the hostname/port is incorrect.`
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
      errorMessage = `Connection timed out to ${config.host}:${config.port}. The server may be unreachable or the port may be blocked.`
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = `Hostname "${config.host}" not found. Please check the SMTP host address.`
    } else if (error.message.includes('self signed certificate') || error.message.includes('certificate')) {
      errorMessage = `SSL/TLS certificate error. The server certificate may be invalid or self-signed.`
    } else if (error.message.includes('wrong version number') || error.message.includes('SSL routines')) {
      errorMessage = `SSL/TLS protocol error. Try changing the encryption type (SSL for port 465, TLS for port 587).`
    } else if (error.responseCode === 535 || error.message.includes('authentication')) {
      errorMessage = `Authentication failed. Please check your username and password.`
    }

    return { success: false, error: errorMessage }
  }
}

// Send test email with custom SMTP
export async function sendTestEmail(config: SmtpConfig, testEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createCustomTransporter(config)
    const senderName = config.fromName || 'SMTP Test'

    await transporter.sendMail({
      from: `"${senderName}" <${config.fromEmail}>`,
      to: testEmail,
      subject: 'SMTP Configuration Test - Success!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #7C3AED;">SMTP Test Successful!</h2>
          <p>Your SMTP configuration is working correctly.</p>
          <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <p style="margin: 5px 0;"><strong>Host:</strong> ${config.host}</p>
            <p style="margin: 5px 0;"><strong>Port:</strong> ${config.port}</p>
            <p style="margin: 5px 0;"><strong>Encryption:</strong> ${config.encryption}</p>
            <p style="margin: 5px 0;"><strong>From:</strong> ${config.fromEmail}</p>
          </div>
          <p style="margin-top: 15px; color: #6B7280; font-size: 12px;">This is a test email from 6AD Platform.</p>
        </div>
      `
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send test email' }
  }
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  senderName?: string  // Custom sender name for whitelabel agencies
  smtpConfig?: SmtpConfig  // Custom SMTP configuration
}

// Extract base64 images from HTML and convert to CID attachments
// Gmail strips inline base64 images, so we must use CID attachments instead
function extractBase64Images(html: string): { html: string; attachments: Array<{ filename: string; content: Buffer; cid: string; contentType: string }> } {
  const attachments: Array<{ filename: string; content: Buffer; cid: string; contentType: string }> = []
  let counter = 0

  const processedHtml = html.replace(/src="data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([^"]+)"/g, (_match, mimeType, base64Data) => {
    counter++
    const cid = `logo${counter}@6ad.in`
    const ext = mimeType === 'svg+xml' ? 'svg' : mimeType === 'jpeg' ? 'jpg' : mimeType
    attachments.push({
      filename: `logo${counter}.${ext}`,
      content: Buffer.from(base64Data, 'base64'),
      cid,
      contentType: `image/${mimeType}`
    })
    return `src="cid:${cid}"`
  })

  return { html: processedHtml, attachments }
}

// Helper to build SMTP config from agent data
export function buildSmtpConfig(agent: {
  smtpEnabled?: boolean
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUsername?: string | null
  smtpPassword?: string | null
  smtpEncryption?: string | null
  smtpFromEmail?: string | null
  emailSenderNameApproved?: string | null
  username?: string | null
} | null | undefined): SmtpConfig | undefined {
  console.log('[SMTP] Building config from agent:', agent ? {
    smtpEnabled: agent.smtpEnabled,
    smtpHost: agent.smtpHost,
    smtpFromEmail: agent.smtpFromEmail,
    hasPassword: !!agent.smtpPassword
  } : 'null/undefined')

  if (!agent?.smtpEnabled || !agent.smtpHost || !agent.smtpFromEmail) {
    console.log('[SMTP] Returning undefined - missing required fields')
    return undefined
  }

  const config = {
    host: agent.smtpHost,
    port: agent.smtpPort || 587,
    username: agent.smtpUsername || '',
    password: agent.smtpPassword || '',
    encryption: (agent.smtpEncryption as 'TLS' | 'SSL' | 'NONE') || 'TLS',
    fromEmail: agent.smtpFromEmail,
    fromName: agent.emailSenderNameApproved || agent.username || undefined
  }
  console.log('[SMTP] Returning config:', { ...config, password: '***' })
  return config
}

// Generate clean plain text from HTML (better than crude regex strip)
function htmlToPlainText(html: string): string {
  return html
    // Replace <br> tags with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Replace block-level elements with newlines
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, '\t')
    // Replace <a> tags with text + URL
    .replace(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    // Remove all remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#9679;/g, '•')
    .replace(/&#10003;/g, '✓')
    .replace(/&#10005;/g, '✗')
    .replace(/&#9432;/g, 'ℹ')
    // Clean up excessive whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()
}

// Build anti-spam email headers for better deliverability
function getAntiSpamHeaders(fromEmail: string, toEmail: string): Record<string, string> {
  const domain = fromEmail.split('@')[1] || '6ad.in'
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`

  return {
    'Message-ID': messageId,
    'X-Mailer': '6AD Platform',
    'X-Priority': '3',                    // Normal priority (1=high looks spammy)
    'Precedence': 'bulk',                 // Tells filters this is a legitimate bulk/transactional email
    'X-Auto-Response-Suppress': 'All',    // Prevent auto-replies/out-of-office loops
    'Reply-To': fromEmail,                // Explicit reply-to helps deliverability
    'List-Unsubscribe': `<mailto:unsubscribe@${domain}?subject=Unsubscribe>`,  // Required by Gmail/Yahoo since Feb 2024
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',                      // One-click unsubscribe (RFC 8058)
    'MIME-Version': '1.0',
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const senderName = options.senderName || 'Six Media'

    // Convert inline base64 images to CID attachments (Gmail strips base64 images)
    const { html: processedHtml, attachments } = extractBase64Images(options.html)

    // Generate proper plain text version (not just crude HTML strip)
    const plainText = options.text || htmlToPlainText(options.html)

    // Use custom SMTP if provided, otherwise use default
    if (options.smtpConfig) {
      const customTransporter = createCustomTransporter(options.smtpConfig)
      const fromName = options.smtpConfig.fromName || senderName
      const fromEmail = options.smtpConfig.fromEmail
      const headers = getAntiSpamHeaders(fromEmail, options.to)

      const info = await customTransporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        replyTo: fromEmail,
        subject: options.subject,
        html: processedHtml,
        text: plainText,
        headers,
        ...(attachments.length > 0 && { attachments })
      })

      console.log('Email sent via custom SMTP:', info.messageId, attachments.length > 0 ? `(${attachments.length} embedded images)` : '')
      return true
    }

    // Use default SMTP
    const fromName = options.senderName || DEFAULT_SMTP.fromName
    const fromEmail = DEFAULT_SMTP.fromEmail
    const headers = getAntiSpamHeaders(fromEmail, options.to)

    const info = await defaultTransporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      replyTo: fromEmail,
      subject: options.subject,
      html: processedHtml,
      text: plainText,
      headers,
      ...(attachments.length > 0 && { attachments })
    })

    console.log('Email sent:', info.messageId, 'to:', options.to, attachments.length > 0 ? `(${attachments.length} embedded images)` : '')
    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

// Six Media Logo SVG (inline for email) - Twisted Ribbon Infinity design matching app sidebar
const SIX_MEDIA_LOGO_SVG = `
<svg viewBox="0 0 48 28" width="48" height="28" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="emailRibbonGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366F1"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
    <linearGradient id="emailRibbonGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#EC4899"/>
    </linearGradient>
  </defs>
  <path d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14" fill="url(#emailRibbonGrad1)"/>
  <path d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14" fill="url(#emailRibbonGrad2)"/>
  <ellipse cx="24" cy="14" rx="4" ry="5" fill="white" opacity="0.15"/>
</svg>
`

// White version of the ribbon logo for use on colored gradient headers
const SIX_MEDIA_LOGO_WHITE_SVG = `
<svg viewBox="0 0 48 28" width="44" height="26" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14" fill="white" opacity="0.9"/>
  <path d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14" fill="white" opacity="0.7"/>
  <ellipse cx="24" cy="14" rx="4" ry="5" fill="white" opacity="0.15"/>
</svg>
`

// Get logo HTML - uses agent logo if available, otherwise Six Media logo
function getLogoHtml(agentLogo?: string | null, agentBrandName?: string | null): string {
  // Only use agent logo if it's a valid base64 image or URL (not just text like "Logo")
  if (agentLogo && (agentLogo.startsWith('data:image') || agentLogo.startsWith('http'))) {
    return `<img src="${agentLogo}" alt="Logo" style="height: 40px; max-width: 180px; object-fit: contain;" />`
  }
  // If agent has brand name but no logo, show brand name text with modern styling
  if (agentBrandName) {
    return `
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <span style="font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">${agentBrandName}</span>
          </td>
        </tr>
      </table>
    `
  }
  // Default Six Media logo - Clean modern design
  return `
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right: 12px; vertical-align: middle;">${SIX_MEDIA_LOGO_SVG}</td>
        <td style="vertical-align: middle;">
          <span style="font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">Six Media</span>
          <br/>
          <span style="font-size: 10px; font-weight: 600; letter-spacing: 1.5px; color: #9CA3AF; text-transform: uppercase;">Advertising</span>
        </td>
      </tr>
    </table>
  `
}

// Status badge colors - Modern pill design
const STATUS_COLORS = {
  pending: { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D', icon: '&#9679;' },
  approved: { bg: '#DCFCE7', text: '#166534', border: '#86EFAC', icon: '&#10003;' },
  rejected: { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA', icon: '&#10005;' },
  info: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD', icon: '&#9432;' }
}

// Base email template wrapper - Professional design (no gradients)
interface BaseTemplateOptions {
  title: string
  subtitle?: string
  headerColor?: 'purple' | 'green' | 'red' | 'amber'
  agentLogo?: string | null
  agentBrandName?: string | null
  content: string
  footerText?: string
}

function getBaseEmailTemplate(options: BaseTemplateOptions): string {
  const { title, subtitle, headerColor = 'purple', agentLogo, agentBrandName, content, footerText } = options

  // Use agent brand name in footer if available
  const platformName = agentBrandName || 'Six Media'

  // Gradient backgrounds for different status types
  const gradients = {
    purple: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #EC4899 100%)',
    green: 'linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)',
    red: 'linear-gradient(135deg, #DC2626 0%, #EF4444 50%, #F87171 100%)',
    amber: 'linear-gradient(135deg, #D97706 0%, #F59E0B 50%, #FBBF24 100%)'
  }

  // Fallback solid colors for email clients that don't support gradients
  const solidColors = {
    purple: '#7C3AED',
    green: '#059669',
    red: '#DC2626',
    amber: '#D97706'
  }

  const gradient = gradients[headerColor]
  const solidColor = solidColors[headerColor]

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <!-- Main Container -->
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

              <!-- Header with gradient -->
              <tr>
                <td style="background: ${gradient}; background-color: ${solidColor}; padding: 24px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            ${agentLogo && (agentLogo.startsWith('data:image') || agentLogo.startsWith('http')) ? `
                            <!-- Agent Logo Image -->
                            <td style="padding-right: 12px; vertical-align: middle;">
                              <img src="${agentLogo}" alt="${platformName}" style="height: 44px; max-width: 120px; object-fit: contain; border-radius: 8px;" />
                            </td>
                            <td style="vertical-align: middle;">
                              <span style="font-size: 18px; font-weight: 700; color: #ffffff;">${platformName}</span>
                              <br/>
                              <span style="font-size: 12px; color: rgba(255,255,255,0.85);">Advertising Platform</span>
                            </td>
                            ` : `
                            <!-- Default Logo - Twisted Ribbon -->
                            <td style="padding-right: 12px; vertical-align: middle;">
                              ${agentBrandName ? `
                              <div style="width: 44px; height: 44px; background-color: rgba(255,255,255,0.25); border-radius: 10px; text-align: center; line-height: 44px;">
                                <span style="color: #ffffff; font-size: 20px; font-weight: 700;">${agentBrandName.charAt(0).toUpperCase()}</span>
                              </div>
                              ` : SIX_MEDIA_LOGO_WHITE_SVG}
                            </td>
                            <td style="vertical-align: middle;">
                              <span style="font-size: 18px; font-weight: 700; color: #ffffff;">${platformName}</span>
                              <br/>
                              <span style="font-size: 12px; color: rgba(255,255,255,0.85);">Advertising Platform</span>
                            </td>
                            `}
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px;">
                  <!-- Title -->
                  <h1 style="margin: 0 0 20px; color: #111827; font-size: 22px; font-weight: 700;">${title}</h1>

                  ${content}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 28px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px;">
                          © 2026 ${platformName}. All rights reserved.
                        </p>
                        <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                          ${footerText || `You received this email because you have an account with ${platformName}.`}
                        </p>
                      </td>
                    </tr>
                  </table>
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

// Helper to create Excel-style table row with modern styling
function createTableRow(label: string, value: string, isCode = false, isLast = false): string {
  return `
    <tr>
      <td style="padding: 14px 20px; ${!isLast ? 'border-bottom: 1px solid #f3f4f6;' : ''} color: #6b7280; font-size: 13px; font-weight: 500; width: 40%;">
        ${label}
      </td>
      <td style="padding: 14px 20px; ${!isLast ? 'border-bottom: 1px solid #f3f4f6;' : ''} color: #111827; font-size: 14px; font-weight: 600; ${isCode ? 'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;' : ''}">
        ${isCode ? `<span style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 6px 12px; border-radius: 6px; font-size: 12px; border: 1px solid #e2e8f0; color: #374151;">${value}</span>` : value}
      </td>
    </tr>
  `
}

// Helper to create Excel-style table with header - Modern design
function createExcelTable(rows: Array<{ label: string; value: string; isCode?: boolean }>, headerColor = '#f9fafb'): string {
  // Determine header text color based on background
  const isLightHeader = ['#f9fafb', '#f3f4f6', '#FEF3C7'].includes(headerColor)
  const headerTextColor = isLightHeader ? '#374151' : '#374151'

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
      <thead>
        <tr style="background: ${headerColor};">
          <th style="padding: 14px 20px; text-align: left; font-size: 11px; font-weight: 700; color: ${headerTextColor}; border-bottom: 2px solid rgba(0,0,0,0.06); text-transform: uppercase; letter-spacing: 0.8px; width: 40%;">Field</th>
          <th style="padding: 14px 20px; text-align: left; font-size: 11px; font-weight: 700; color: ${headerTextColor}; border-bottom: 2px solid rgba(0,0,0,0.06); text-transform: uppercase; letter-spacing: 0.8px;">Value</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, index) => createTableRow(row.label, row.value, row.isCode, index === rows.length - 1)).join('')}
      </tbody>
    </table>
  `
}

// Legacy helper for backward compatibility
function createInfoRow(label: string, value: string, isCode = false): string {
  return createTableRow(label, value, isCode, false)
}

// Helper to create status badge - Modern pill design with icon
function createStatusBadge(status: 'pending' | 'approved' | 'rejected'): string {
  const colors = STATUS_COLORS[status]
  const labels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }
  const icons = { pending: '&#8987;', approved: '&#10003;', rejected: '&#10005;' }
  return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: ${colors.bg}; color: ${colors.text}; font-size: 12px; font-weight: 600; border-radius: 100px; border: 1px solid ${colors.border};"><span style="font-size: 11px;">${icons[status]}</span>${labels[status]}</span>`
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
  agentBrandName?: string | null
}

export function getAdAccountSubmittedTemplate(data: AdAccountEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Application ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Status', value: createStatusBadge('pending') },
    { label: 'Submitted', value: new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }) }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your ad account opening request has been submitted successfully. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Ad Account Request Submitted - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Submitted',
      subtitle: 'Ad Account Opening',
      headerColor: 'purple',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

export function getAdAccountApprovedTemplate(data: AdAccountEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Application ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    ...(data.accountId ? [{ label: 'Account ID', value: data.accountId, isCode: true }] : []),
    ...(data.accountName ? [{ label: 'Account Name', value: data.accountName }] : []),
    { label: 'Status', value: createStatusBadge('approved') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We are pleased to inform you that your request has been processed successfully. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #065f46; font-size: 13px;"><strong>Remarks:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Congratulations ${data.username} your Ad Account Approved - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Approved',
      subtitle: 'Ad Account Opening',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

// Agent notification for ad account approval
export function getAgentAdAccountApprovedNotificationTemplate(data: AdAccountEmailData & { userEmail?: string }): { subject: string; html: string } {
  const tableRows = [
    { label: 'User', value: data.username },
    ...(data.userEmail ? [{ label: 'User Email', value: data.userEmail }] : []),
    { label: 'Application ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    ...(data.accountId ? [{ label: 'Account ID', value: data.accountId, isCode: true }] : []),
    ...(data.accountName ? [{ label: 'Account Name', value: data.accountName }] : []),
    { label: 'Status', value: createStatusBadge('approved') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear Agent,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We are pleased to inform you that a user's ad account request has been approved. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #065f46; font-size: 13px;"><strong>Remarks:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Congratulations ${data.username} your Ad Account Approved - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'User Ad Account Approved',
      subtitle: 'Agent Notification',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

export function getAdAccountRejectedTemplate(data: AdAccountEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Application ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Status', value: createStatusBadge('rejected') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We regret to inform you that your request has been rejected. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Ad Account Request Rejected - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Rejected',
      subtitle: 'Ad Account Opening',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

// Agent notification for ad account rejection
export function getAgentAdAccountRejectedNotificationTemplate(data: AdAccountEmailData & { userEmail?: string }): { subject: string; html: string } {
  const tableRows = [
    { label: 'User', value: data.username },
    ...(data.userEmail ? [{ label: 'User Email', value: data.userEmail }] : []),
    { label: 'Application ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Status', value: createStatusBadge('rejected') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear Agent,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We regret to inform you that a user's ad account request has been rejected. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Ad Account Request Rejected - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'User Ad Account Rejected',
      subtitle: 'Agent Notification',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
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
  agentBrandName?: string | null
}

export function getWalletDepositSubmittedTemplate(data: WalletDepositEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'Amount', value: `$${data.amount.toLocaleString()}` },
    ...(data.paymentMethod ? [{ label: 'Payment Method', value: data.paymentMethod }] : []),
    ...(data.txHash ? [{ label: 'Transaction Hash', value: data.txHash.slice(0, 20) + '...', isCode: true }] : []),
    { label: 'Status', value: createStatusBadge('pending') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your wallet deposit request has been submitted successfully. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `${data.username} submitted wallet $${data.amount.toLocaleString()}`,
    html: getBaseEmailTemplate({
      title: 'Deposit Submitted',
      subtitle: 'Wallet Top-up',
      headerColor: 'purple',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

export function getWalletDepositApprovedTemplate(data: WalletDepositEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'Amount Credited', value: `$${data.amount.toLocaleString()}` },
    ...(data.newBalance !== undefined ? [{ label: 'New Balance', value: `$${data.newBalance.toLocaleString()}` }] : []),
    { label: 'Status', value: createStatusBadge('approved') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We are pleased to inform you that your deposit has been processed successfully. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Congrats! Your deposit of $${data.amount.toLocaleString()} is approved`,
    html: getBaseEmailTemplate({
      title: 'Deposit Approved',
      subtitle: 'Wallet Top-up',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

// Agent notification for user deposit approval
export function getAgentDepositApprovedNotificationTemplate(data: WalletDepositEmailData & { userEmail?: string }): { subject: string; html: string } {
  const tableRows = [
    { label: 'User', value: data.username },
    ...(data.userEmail ? [{ label: 'User Email', value: data.userEmail }] : []),
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'Amount Credited', value: `$${data.amount.toLocaleString()}` },
    ...(data.newBalance !== undefined ? [{ label: 'New Balance', value: `$${data.newBalance.toLocaleString()}` }] : []),
    { label: 'Status', value: createStatusBadge('approved') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear Agent,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We are pleased to inform you that a user deposit has been processed successfully. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Congrats! ${data.username}'s deposit of $${data.amount.toLocaleString()} is approved`,
    html: getBaseEmailTemplate({
      title: 'User Deposit Approved',
      subtitle: 'Agent Notification',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

export function getWalletDepositRejectedTemplate(data: WalletDepositEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'Amount', value: `$${data.amount.toLocaleString()}` },
    { label: 'Status', value: createStatusBadge('rejected') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We regret to inform you that your deposit request has been rejected. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `$${data.amount.toLocaleString()} Wallet Deposit Rejected - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Deposit Rejected',
      subtitle: 'Wallet Top-up',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
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
  agentBrandName?: string | null
}

export function getAccountRechargeSubmittedTemplate(data: AccountRechargeEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Account ID', value: data.accountId, isCode: true },
    { label: 'Recharge Amount', value: `$${data.amount.toLocaleString()}` },
    { label: 'Commission', value: `$${data.commission.toLocaleString()}` },
    { label: 'Total Deducted', value: `$${data.totalCost.toLocaleString()}` },
    { label: 'Status', value: createStatusBadge('pending') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your ad account recharge request has been submitted successfully. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Account Recharge Submitted - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Recharge Submitted',
      subtitle: 'Ad Account Top-up',
      headerColor: 'purple',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

export function getAccountRechargeApprovedTemplate(data: AccountRechargeEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Account ID', value: data.accountId, isCode: true },
    { label: 'Amount Added', value: `$${data.amount.toLocaleString()}` },
    ...(data.newBalance !== undefined ? [{ label: 'Account Balance', value: `$${data.newBalance.toLocaleString()}` }] : []),
    { label: 'Status', value: createStatusBadge('approved') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We are pleased to inform you that your recharge has been processed successfully. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Account Recharge Approved - $${data.amount}`,
    html: getBaseEmailTemplate({
      title: 'Recharge Approved',
      subtitle: 'Ad Account Top-up',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

export function getAccountRechargeRejectedTemplate(data: AccountRechargeEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Account ID', value: data.accountId, isCode: true },
    { label: 'Amount Refunded', value: `$${data.totalCost.toLocaleString()}` },
    { label: 'Status', value: createStatusBadge('rejected') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We regret to inform you that your recharge request has been rejected. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #065f46; font-size: 13px;"><strong>Refund:</strong> $${data.totalCost.toLocaleString()} has been credited back to your wallet.</p>
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Account Recharge Rejected - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Recharge Rejected',
      subtitle: 'Ad Account Top-up',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
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
  agentBrandName?: string | null
}

export function getBMShareSubmittedTemplate(data: BMShareEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Ad Account ID', value: data.adAccountId, isCode: true },
    { label: 'BM ID', value: data.bmId, isCode: true },
    { label: 'Status', value: createStatusBadge('pending') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your Business Manager share request has been submitted successfully. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `BM Share Request Submitted - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Submitted',
      subtitle: 'Business Manager Share',
      headerColor: 'purple',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

export function getBMShareApprovedTemplate(data: BMShareEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Ad Account ID', value: data.adAccountId, isCode: true },
    { label: 'BM ID', value: data.bmId, isCode: true },
    { label: 'Status', value: createStatusBadge('approved') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We are pleased to inform you that your request has been processed successfully. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #065f46; font-size: 13px;"><strong>Note:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `BM Share Approved - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Approved',
      subtitle: 'Business Manager Share',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

export function getBMShareRejectedTemplate(data: BMShareEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Ad Account ID', value: data.adAccountId, isCode: true },
    { label: 'BM ID', value: data.bmId, isCode: true },
    { label: 'Status', value: createStatusBadge('rejected') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We regret to inform you that your request has been rejected. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `BM Share Rejected - ${data.applyId}`,
    html: getBaseEmailTemplate({
      title: 'Request Rejected',
      subtitle: 'Business Manager Share',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

// =====================================================
// ADMIN/AGENT NOTIFICATION TEMPLATES
// =====================================================

interface AdminNotificationData {
  type: 'ad_account' | 'wallet_deposit' | 'account_recharge' | 'bm_share' | 'account_refund'
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
    bm_share: 'New BM Share Request',
    account_refund: 'New Account Refund Request'
  }

  const tableRows = [
    { label: 'Request Type', value: typeLabels[data.type] },
    { label: 'Reference ID', value: data.applyId, isCode: true },
    { label: 'User', value: data.username },
    { label: 'Email', value: data.userEmail },
    ...(data.platform ? [{ label: 'Platform', value: data.platform }] : []),
    ...(data.amount ? [{ label: 'Amount', value: `$${data.amount.toLocaleString()}` }] : []),
    ...(data.details ? [{ label: 'Details', value: data.details }] : []),
    { label: 'Status', value: createStatusBadge('pending') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear Admin,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      A new request requires your attention. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      Please log in to the admin panel to review and process this request.
    </p>
  `

  // Build subject based on type
  let subject = `[Action Required] ${typeLabels[data.type]}`
  if (data.type === 'wallet_deposit' && data.amount) {
    subject = `${data.username} submitted $${data.amount.toLocaleString()} deposit`
  } else if (data.type === 'account_recharge' && data.amount) {
    subject = `${data.username} requested $${data.amount.toLocaleString()} recharge`
  } else if (data.type === 'ad_account') {
    subject = `${data.username} requested new ad account${data.platform ? ` (${data.platform})` : ''}`
  } else if (data.type === 'bm_share') {
    subject = `${data.username} requested BM share${data.platform ? ` (${data.platform})` : ''}`
  }

  return {
    subject,
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
export function getVerificationEmailTemplate(code: string, username: string, agentLogo?: string | null, agentBrandName?: string | null): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Use the verification code below to verify your email address. This code will expire in 10 minutes.
    </p>

    <!-- Code Box -->
    <div style="background-color: #f9fafb; border: 2px dashed #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
      <p style="margin: 0; color: #111827; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">${code}</p>
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  const brandName = agentBrandName || 'Six Media'

  return {
    subject: `${code} is your ${brandName} verification code`,
    html: getBaseEmailTemplate({
      title: 'Email Verification',
      subtitle: 'Verify your email address',
      headerColor: 'purple',
      agentLogo,
      agentBrandName,
      content
    })
  }
}

export function get2FADisabledEmailTemplate(username: string, agentLogo?: string | null, agentBrandName?: string | null): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Two-factor authentication has been disabled on your account.
    </p>

    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;">
        <strong>Warning:</strong> If you did not make this change, please contact support immediately and secure your account.
      </p>
    </div>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: 'Security Alert - Two-Factor Authentication Disabled',
    html: getBaseEmailTemplate({
      title: 'Security Alert',
      subtitle: '2FA has been disabled',
      headerColor: 'red',
      agentLogo,
      agentBrandName,
      content
    })
  }
}

// =====================================================
// WELCOME & PASSWORD RESET EMAIL TEMPLATES
// =====================================================

interface WelcomeEmailData {
  username: string
  email: string
  passwordResetLink: string
  agentLogo?: string | null
  agentBrandName?: string | null
}

export function getWelcomeEmailTemplate(data: WelcomeEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Username', value: data.username },
    { label: 'Email', value: data.email },
    { label: 'Account Created', value: new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }) }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Welcome to ${data.agentBrandName || 'Six Media'}! Your account has been created successfully. Please find your account details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    <div style="background: #fef3c7; border-left: 4px solid #F59E0B; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #92400e; font-size: 13px;">
        <strong>Important:</strong> For security reasons, please set a strong password (minimum 8 characters) using the button below. This link will expire after first use.
      </p>
    </div>

    <!-- Password Reset Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.passwordResetLink}" style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #EC4899 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.25);">
        Set Your Password
      </a>
    </div>

    <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.5;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 0 0 24px; color: #7C3AED; font-size: 12px; word-break: break-all; background: #f9fafb; padding: 12px; border-radius: 6px;">
      ${data.passwordResetLink}
    </p>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Welcome to ${data.agentBrandName || 'Six Media'} - Set Your Password`,
    html: getBaseEmailTemplate({
      title: 'Welcome!',
      subtitle: 'Your account is ready',
      headerColor: 'purple',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

interface PasswordResetEmailData {
  username: string
  passwordResetLink: string
  agentLogo?: string | null
  agentBrandName?: string | null
}

export function getPasswordResetEmailTemplate(data: PasswordResetEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We received a request to reset your password. Click the button below to set a new password.
    </p>

    <div style="background: #fef3c7; border-left: 4px solid #F59E0B; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #92400e; font-size: 13px;">
        <strong>Note:</strong> This link will expire after first use. Please set a strong password (minimum 8 characters).
      </p>
    </div>

    <!-- Password Reset Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.passwordResetLink}" style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #EC4899 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.25);">
        Reset Password
      </a>
    </div>

    <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.5;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 0 0 24px; color: #7C3AED; font-size: 12px; word-break: break-all; background: #f9fafb; padding: 12px; border-radius: 6px;">
      ${data.passwordResetLink}
    </p>

    <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you didn't request this password reset, please ignore this email or contact support if you have concerns.
    </p>

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Reset your ${data.agentBrandName || 'Six Media'} password`,
    html: getBaseEmailTemplate({
      title: 'Reset Password',
      subtitle: 'Security Request',
      headerColor: 'amber',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

// =====================================================
// ACCOUNT REFUND EMAIL TEMPLATES
// =====================================================

interface AccountRefundEmailData {
  username: string
  refundId: string
  amount: number
  platform: string
  accountId: string
  reason?: string
  adminRemarks?: string
  newBalance?: number
  agentLogo?: string | null
  agentBrandName?: string | null
}

// User: Refund request submitted
export function getAccountRefundSubmittedTemplate(data: AccountRefundEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Refund ID', value: data.refundId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Account ID', value: data.accountId, isCode: true },
    { label: 'Refund Amount', value: `$${data.amount.toLocaleString()}` },
    { label: 'Status', value: createStatusBadge('pending') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Your refund request has been submitted successfully and is pending review. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#FEF3C7')}
    </div>

    ${data.reason ? `
    <div style="background: #f9fafb; border-left: 4px solid #6B7280; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #374151; font-size: 13px;"><strong>Reason:</strong> ${data.reason}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      We will notify you once your refund request has been processed. If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Refund Request Submitted - ${data.refundId}`,
    html: getBaseEmailTemplate({
      title: 'Refund Request Submitted',
      subtitle: 'Pending Review',
      headerColor: 'amber',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

// User: Refund approved
export function getAccountRefundApprovedTemplate(data: AccountRefundEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Refund ID', value: data.refundId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Account ID', value: data.accountId, isCode: true },
    { label: 'Refund Amount', value: `$${data.amount.toLocaleString()}` },
    ...(data.newBalance !== undefined ? [{ label: 'New Wallet Balance', value: `$${data.newBalance.toLocaleString()}` }] : []),
    { label: 'Status', value: createStatusBadge('approved') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Great news! Your refund request has been approved. The amount has been credited to your wallet.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#D1FAE5')}
    </div>

    <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #065f46; font-size: 13px;"><strong>💰 $${data.amount.toLocaleString()}</strong> has been added to your dashboard wallet balance.</p>
    </div>

    ${data.adminRemarks ? `
    <div style="background: #f9fafb; border-left: 4px solid #6B7280; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #374151; font-size: 13px;"><strong>Remarks:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Congratulations ${data.username} your Refund Request Approved - ${data.refundId}`,
    html: getBaseEmailTemplate({
      title: 'Refund Approved',
      subtitle: 'Amount Credited',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

// User: Refund rejected
export function getAccountRefundRejectedTemplate(data: AccountRefundEmailData): { subject: string; html: string } {
  const tableRows = [
    { label: 'Refund ID', value: data.refundId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Account ID', value: data.accountId, isCode: true },
    { label: 'Refund Amount', value: `$${data.amount.toLocaleString()}` },
    { label: 'Status', value: createStatusBadge('rejected') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.username}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      We regret to inform you that your refund request has been rejected. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#FEE2E2')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions or believe this was an error, please contact our support team.
    </p>
  `

  return {
    subject: `Refund Request Rejected - ${data.refundId}`,
    html: getBaseEmailTemplate({
      title: 'Refund Rejected',
      subtitle: 'Request Declined',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

// Agent: Refund approved notification
export function getAgentRefundApprovedNotificationTemplate(data: AccountRefundEmailData & { userEmail?: string }): { subject: string; html: string } {
  const tableRows = [
    { label: 'User', value: data.username },
    ...(data.userEmail ? [{ label: 'User Email', value: data.userEmail }] : []),
    { label: 'Refund ID', value: data.refundId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Account ID', value: data.accountId, isCode: true },
    { label: 'Refund Amount', value: `$${data.amount.toLocaleString()}` },
    { label: 'Status', value: createStatusBadge('approved') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear Agent,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      A user's refund request has been approved. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #065f46; font-size: 13px;"><strong>Remarks:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Congratulations ${data.username} your Refund Request Approved - ${data.refundId}`,
    html: getBaseEmailTemplate({
      title: 'User Refund Approved',
      subtitle: 'Agent Notification',
      headerColor: 'green',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}

// Agent: Refund rejected notification
export function getAgentRefundRejectedNotificationTemplate(data: AccountRefundEmailData & { userEmail?: string }): { subject: string; html: string } {
  const tableRows = [
    { label: 'User', value: data.username },
    ...(data.userEmail ? [{ label: 'User Email', value: data.userEmail }] : []),
    { label: 'Refund ID', value: data.refundId, isCode: true },
    { label: 'Platform', value: data.platform },
    { label: 'Account ID', value: data.accountId, isCode: true },
    { label: 'Refund Amount', value: `$${data.amount.toLocaleString()}` },
    { label: 'Status', value: createStatusBadge('rejected') }
  ]

  const content = `
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
      Dear Agent,
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
      A user's refund request has been rejected. Please find the details below.
    </p>

    <div style="margin-bottom: 24px;">
      ${createExcelTable(tableRows, '#f9fafb')}
    </div>

    ${data.adminRemarks ? `
    <div style="background: #fef2f2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${data.adminRemarks}</p>
    </div>
    ` : ''}

    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
      If you have any questions, please contact our support team.
    </p>
  `

  return {
    subject: `Refund Request Rejected - ${data.refundId}`,
    html: getBaseEmailTemplate({
      title: 'User Refund Rejected',
      subtitle: 'Agent Notification',
      headerColor: 'red',
      agentLogo: data.agentLogo,
      agentBrandName: data.agentBrandName,
      content
    })
  }
}
