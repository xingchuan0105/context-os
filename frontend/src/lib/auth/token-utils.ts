/**
 * 统一的 Token 工具函数
 * 解决 Token 提取逻辑重复的问题
 */

const AUTH_STORAGE_KEY = 'auth-storage';

/**
 * 从 localStorage 获取认证 token
 * @returns token 字符串或 null
 */
export function getAuthToken(): string | null {
  // SSR 环境检查
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const authStorage = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!authStorage) {
      return null;
    }

    const parsed = JSON.parse(authStorage);
    const token = parsed?.state?.token;

    return token || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/**
 * 检查用户是否已登录
 * @returns 是否已登录
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * 设置认证 token
 * @param token token 字符串
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const authStorage = localStorage.getItem(AUTH_STORAGE_KEY);
    let parsed = authStorage ? JSON.parse(authStorage) : { state: {} };

    parsed.state = {
      ...parsed.state,
      token,
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.error('Failed to set auth token:', error);
  }
}

/**
 * 清除认证 token
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const authStorage = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!authStorage) {
      return;
    }

    const parsed = JSON.parse(authStorage);
    if (parsed.state) {
      delete parsed.state.token;
    }

    if (Object.keys(parsed.state || {}).length === 0) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch (error) {
    console.error('Failed to clear auth token:', error);
  }
}
