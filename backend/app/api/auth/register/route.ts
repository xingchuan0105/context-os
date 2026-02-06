import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { db } from '@/lib/db/schema';
import { RegisterSchema } from '@/lib/auth/validation';
import { success, conflict, badRequest, withErrorHandler } from '@/lib/api/errors';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  // 使用 Zod 验证输入
  const validationResult = RegisterSchema.safeParse(body);
  if (!validationResult.success) {
    return badRequest('输入验证失败', validationResult.error.issues);
  }

  const { email, password, full_name } = validationResult.data;

  // 检查用户是否已存在
  const existingUser = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email);

  if (existingUser) {
    return conflict('该邮箱已被注册');
  }

  // 创建新用户
  const userId = uuidv4();
  const passwordHash = await hashPassword(password);

  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name)
     VALUES (?, ?, ?, ?)`
  ).run(userId, email, passwordHash, full_name || null);

  // 获取创建的用户
  const user = db
    .prepare('SELECT id, email, full_name, avatar_url FROM users WHERE id = ?')
    .get(userId) as { id: string; email: string; full_name: string | null; avatar_url: string | null };

  // 创建会话
  await createSession(user);

  return success({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
    },
  });
});
