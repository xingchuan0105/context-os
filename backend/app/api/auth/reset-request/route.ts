import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db/schema';
import { ResetRequestSchema } from '@/lib/auth/validation';
import { success, badRequest, withErrorHandler } from '@/lib/api/errors';
import { sendPasswordResetEmail, isEmailConfigured } from '@/lib/email/smtp';

/**
 * POST /api/auth/reset-request
 * Request a password reset email
 *
 * Security: Always returns success to prevent email enumeration
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  // Validate input
  const validationResult = ResetRequestSchema.safeParse(body);
  if (!validationResult.success) {
    return badRequest('输入验证失败', validationResult.error.issues);
  }

  const { email } = validationResult.data;

  // Check if user exists
  const user = db
    .prepare('SELECT id, email FROM users WHERE email = ?')
    .get(email) as { id: string; email: string } | undefined;

  // Always return success to prevent email enumeration
  // But only actually send email if user exists and SMTP is configured
  if (user && isEmailConfigured()) {
    // Generate reset token
    const resetToken = uuidv4() + uuidv4().replace(/-/g, ''); // Long random token
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token in database
    db.prepare(
      `UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?`
    ).run(resetToken, expiresAt.toISOString(), user.id);

    // Generate reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    // Send email
    try {
      await sendPasswordResetEmail(user.email, resetLink);
    } catch (error) {
      console.error('[Reset Request] Failed to send email:', error);
      // Still return success to prevent enumeration
    }
  }

  return success({
    message: '如果该邮箱已注册，您将收到一封包含重置链接的邮件'
  });
});
