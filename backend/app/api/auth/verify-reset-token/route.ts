import { NextRequest } from 'next/server';
import { db } from '@/lib/db/schema';
import { VerifyResetTokenSchema } from '@/lib/auth/validation';
import { badRequest, success, withErrorHandler, NotFoundError } from '@/lib/api/errors';

/**
 * POST /api/auth/verify-reset-token
 * Verify if a reset token is valid
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  // Validate input
  const validationResult = VerifyResetTokenSchema.safeParse(body);
  if (!validationResult.success) {
    return badRequest('输入验证失败', validationResult.error.issues);
  }

  const { token } = validationResult.data;

  // Check if token exists and is not expired
  const user = db
    .prepare(`
      SELECT id, email, reset_token_expires_at
      FROM users
      WHERE reset_token = ?
    `)
    .get(token) as { id: string; email: string; reset_token_expires_at: string } | undefined;

  if (!user) {
    return success({ valid: false, message: '无效的重置链接' });
  }

  // Check if token is expired
  const expiresAt = new Date(user.reset_token_expires_at);
  if (expiresAt < new Date()) {
    return success({ valid: false, message: '重置链接已过期，请重新申请' });
  }

  // Token is valid, return user email (masked for privacy)
  const emailParts = user.email.split('@');
  const maskedEmail = `${emailParts[0]?.substring(0, 2)}***@${emailParts[1]}`;

  return success({
    valid: true,
    email: user.email,
    maskedEmail
  });
});
