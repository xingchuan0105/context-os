import { cookies } from 'next/headers';
import { verifyToken, signToken, type JWTPayload } from './jwt';
import { db } from '../db/schema';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

/**
 * 获取当前登录用户
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return null;
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return null;
    }

    // 从数据库获取用户信息
    const user = db
      .prepare('SELECT id, email, full_name, avatar_url FROM users WHERE id = ?')
      .get(payload.userId) as User | undefined;

    return user || null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * 创建会话（设置Cookie）
 */
export async function createSession(user: User): Promise<void> {
  const token = await signToken({
    userId: user.id,
    email: user.email,
  });

  const secureCookie = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE !== 'false'
    : process.env.NODE_ENV === 'production';

  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7天
    path: '/',
  });
}

/**
 * 删除会话
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
}
