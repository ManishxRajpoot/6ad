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
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: '"6AD Platform" <info@6ad.in>',
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

// Email templates
export function getVerificationEmailTemplate(code: string, username: string): { subject: string; html: string } {
  return {
    subject: '6AD - Email Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <!-- Header -->
                <tr>
                  <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #52B788 0%, #40A578 100%); border-radius: 16px 16px 0 0;">
                    <div style="width: 56px; height: 56px; margin: 0 auto 16px; background-color: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 24px; font-weight: bold; color: #ffffff;">6</span>
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Email Verification</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                      Hello <strong>${username}</strong>,
                    </p>
                    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.5;">
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
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                      This is an automated message from 6AD Platform.<br>
                      Please do not reply to this email.
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
}

export function get2FADisabledEmailTemplate(username: string): { subject: string; html: string } {
  return {
    subject: '6AD - Two-Factor Authentication Disabled',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); border-radius: 16px 16px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Security Alert</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                      Hello <strong>${username}</strong>,
                    </p>
                    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.5;">
                      Two-factor authentication has been disabled on your 6AD account. If you did not make this change, please contact support immediately.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                      This is an automated security notification from 6AD Platform.
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
}
