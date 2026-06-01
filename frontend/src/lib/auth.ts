/**
 * 前端认证工具
 * 管理 JWT token 的存储、读取和验证
 */

const TOKEN_KEY = 'sparklearn_token';
const USER_KEY = 'sparklearn_user';

export interface AuthUser {
  user_id: string;
  name: string;
  phone: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  // 检查 token 是否过期
  if (isTokenExpired()) {
    // token 已过期，清除登录状态
    removeToken();
    return false;
  }
  return true;
}

/**
 * 检查 token 是否过期（基于 JWT payload 的 exp 字段）
 */
export function isTokenExpired(): boolean {
  const token = getToken();
  if (!token) return true;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // 转为毫秒
    return Date.now() >= exp;
  } catch {
    return true;
  }
}

/**
 * 登出并跳转到登录页
 */
export function logout(): void {
  removeToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/auth';
  }
}
