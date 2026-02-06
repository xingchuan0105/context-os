import { NextRequest } from 'next/server';
import { hashPassword } from '@/lib/auth/password';
import { db } from '@/lib/db/schema';
import { ResetPasswordSchema } from '@/lib/auth/validation';
import { badRequest, success, withErrorHandler, ValidationError } from '@/lib/api/errors';

/**
 * POST /api/auth/reset-password
 * Reset password using a valid token
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  // Validate input
  const validationResult = ResetPasswordSchema.safeParse(body);
  if (!validationResult.success) {
    return badRequest('输入验证失败', validationResult.error.issues);
  }

  const { token, password } = validationResult.data;

  // Check if token exists and is not expired
  const user = db
    .prepare(`
      SELECT id, email, reset_token_expires_at
      FROM users
      WHERE reset_token = ?
    `)
    .get(token) as { id: string; email: string; reset_token_expires_at: string } | undefined;

  if (!user) {
    throw new ValidationError('无效或已过期的重置链接');
  }

  // Check if token is expired
  const expiresAt = new Date(user.reset_token_expires_at);
  if (expiresAt < new Date()) {
    throw new ValidationError('重置链接已过期，请重新申请');
  }

  // Hash new password
  const passwordHash = await hashPassword(password);

  // Update password and clear reset token
  db.prepare(
    `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?`
  ).run(passwordHash, user.id);

  return success({
    message: '密码重置成功，请使用新密码登录'
  });
});
