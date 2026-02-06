import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable must be set in production');
    }
    // 开发环境使用固定密钥用于测试，生产环境必须设置环境变量
    console.warn('⚠️  Using default JWT secret for development only. Set JWT_SECRET environment variable.');
    return 'dev-secret-key-do-not-use-in-production';
  })()
);

const JWT_ALGORITHM = 'HS256';

export interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * 签发JWT Token
 */
export async function signToken(payload: JWTPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime('7d') // 7天过期
    .sign(JWT_SECRET);

  return token;
}

/**
 * 验证JWT Token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * 从请求中提取Token
 */
export function getTokenFromRequest(request: Request): string | null {
  // 1. 尝试从Cookie中获取
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (authCookie) {
      return authCookie.split('=')[1];
    }
  }

  // 2. 尝试从Authorization header获取
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}
