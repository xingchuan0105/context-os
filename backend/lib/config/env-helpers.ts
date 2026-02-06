/**
 * 环境变量解析工具函数
 * 统一处理环境变量的解析，减少代码重复
 */

/**
 * 从环境变量解析整数，支持默认值
 * @param key 环境变量键名
 * @param defaultValue 默认值
 * @returns 解析后���整数值
 */
export function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 从环境变量解析浮点数，支持默认值
 * @param key 环境变量键名
 * @param defaultValue 默认值
 * @returns 解析后的浮点数值
 */
export function parseFloatEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 从环境变量解析布尔值
 * @param key 环境变量键名
 * @param defaultValue 默认值
 * @returns 解析后的布尔值
 */
export function parseBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]?.toLowerCase();
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return value === 'true' || value === '1' || value === 'yes';
}

// 常用环境变量预配置
export const ENV = {
  // K-Type 相关
  KTYPE_MAX_TOKENS: parseIntEnv('KTYPE_MAX_TOKENS', 500000),
  KTYPE_THRESHOLD: parseIntEnv('KTYPE_THRESHOLD', 900000),
  KTYPE_CHUNK_SIZE: parseIntEnv('KTYPE_CHUNK_SIZE', 500000),
  KTYPE_OVERLAP: parseIntEnv('KTYPE_OVERLAP', 10000),
  KTYPE_MAX_CHARS: parseIntEnv('KTYPE_MAX_CHARS', 990000),

  // 文档处理相关
  DOC_CHUNK_SIZE: parseIntEnv('DOC_CHUNK_SIZE', 2400),
  DOC_CHUNK_OVERLAP: parseIntEnv('DOC_CHUNK_OVERLAP', 300),
  PARENT_CHUNK_SIZE: parseIntEnv('PARENT_CHUNK_SIZE', 1600),

  // 上传限制
  UPLOAD_MAX_BYTES: parseIntEnv('UPLOAD_MAX_BYTES', 50 * 1024 * 1024),
  UPLOAD_CONCURRENCY_LIMIT: parseIntEnv('UPLOAD_CONCURRENCY_LIMIT', 2),
  UPLOAD_RATE_LIMIT_MAX: parseIntEnv('UPLOAD_RATE_LIMIT_MAX', 0),
  UPLOAD_RATE_LIMIT_WINDOW_MS: parseIntEnv('UPLOAD_RATE_LIMIT_WINDOW_MS', 60000),

  // Worker 配置
  WORKER_CONCURRENCY: parseIntEnv('WORKER_CONCURRENCY', 1),
} as const;
