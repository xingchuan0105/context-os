/**
 * SMTP Email Service for sending password reset emails
 * Supports generic SMTP configuration (163, QQ, Gmail, etc.)
 */

import nodemailer from 'nodemailer';

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Get SMTP configuration from environment variables
 */
function getSMTPConfig(): SMTPConfig {
  const host = process.env.SMTP_HOST || 'smtp.163.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE !== 'false'; // Default to true for port 465
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || `"Context-OS" <${user}>`;

  return { host, port, secure, user, pass, from };
}

/**
 * Create nodemailer transporter
 * Lazy-loaded to allow for missing SMTP config in development
 */
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const config = getSMTPConfig();

    if (!config.user || !config.pass) {
      throw new Error('SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS environment variables.');
    }

    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return transporter;
}

/**
 * Send a password reset email
 *
 * @param to - Recipient email address
 * @param resetLink - Password reset link (contains token)
 * @returns Promise that resolves when email is sent
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string
): Promise<void> {
  const config = getSMTPConfig();

  // Check if SMTP is configured
  if (!config.user || !config.pass) {
    console.warn('[Email] SMTP not configured, skipping email send');
    console.warn('[Email] Reset link (would be sent by email):', resetLink);
    return;
  }

  const transporter = getTransporter();

  const mailOptions = {
    from: config.from,
    to: to,
    subject: '重置您的 Context-OS 密码',
    text: `
您好，

我们收到了重置您 Context-OS 账户密码的请求。

请点击以下链接重置您的密码（链接有效期为 1 小时）：

${resetLink}

如果您没有请求重置密码，请忽略此邮件。

此邮件由系统自动发送，请勿直接回复。
    `.trim(),
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
          .button { display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 20px; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Context-OS 密码重置</h2>
          </div>
          <div class="content">
            <p>您好，</p>
            <p>我们收到了重置您 Context-OS 账户密码的请求。</p>
            <p>请点击下面的按钮重置您的密码：</p>
            <p><a href="${resetLink}" class="button">重置密码</a></p>
            <p>或者复制以下链接到浏览器地址栏：</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${resetLink}</p>
            <p style="color: #999; font-size: 14px;">此链接有效期为 1 小时。</p>
          </div>
          <div class="footer">
            <p>如果您没有请求重置密码，请忽略此邮件。</p>
            <p>此邮件由系统自动发送，请勿直接回复。</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Password reset email sent:', info.messageId);
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  const config = getSMTPConfig();
  return !!(config.user && config.pass);
}
