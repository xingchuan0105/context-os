import crypto from 'crypto';

// 密码哈希算法配置 - 遵循 OWASP 2023 建议
const ALGORITHM = 'sha256';
const ITERATIONS = 600000; // OWASP 2023 推荐用于 PBKDF2-SHA256
const KEY_LENGTH = 64;
const SALT_LENGTH = 32;

/**
 * 生成随机盐值
 */
function generateSalt(): string {
  return crypto.randomBytes(SALT_LENGTH).toString('hex');
}

/**
 * 异步 PBKDF2 哈希
 */
function pbkdf2Async(
  password: string,
  salt: string,
  iterations: number,
  keyLength: number,
  algorithm: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keyLength, algorithm, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * 使用PBKDF2哈希密码（异步版本，防止阻塞事件循环）
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await pbkdf2Async(
    password,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    ALGORITHM
  );

  return `${salt}:${hash.toString('hex')}`;
}

/**
 * 验证密码（异步版本）
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const [salt, hash] = hashedPassword.split(':');
    if (!salt || !hash) return false;

    const verifyHash = await pbkdf2Async(
      password,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      ALGORITHM
    );

    return hash === verifyHash.toString('hex');
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}
