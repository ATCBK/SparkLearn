import Taro from '@tarojs/taro'
import type { ApiResponse } from '../types/api'
import { getToken } from '../utils/storage'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const LOCAL_API_FALLBACKS = ['http://localhost:8000', 'http://127.0.0.1:8000']

declare const __API_BASE_URL__: string

export const API_BASE_URL = __API_BASE_URL__ || DEFAULT_API_BASE_URL

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  data?: unknown
  header?: Record<string, string>
  skipAuth?: boolean
}

function buildUrl(path: string, baseUrl = API_BASE_URL) {
  if (/^https?:\/\//.test(path)) {
    return path
  }
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

function getRequestBaseUrls(path: string) {
  if (/^https?:\/\//.test(path)) {
    return [API_BASE_URL]
  }

  const bases = [API_BASE_URL]
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(API_BASE_URL)) {
    LOCAL_API_FALLBACKS.forEach((base) => {
      if (!bases.includes(base)) {
        bases.push(base)
      }
    })
  }
  return bases
}

function getErrMsg(err: unknown) {
  return String((err as any)?.errMsg || (err instanceof Error ? err.message : '')).trim()
}

function isNetworkError(errMsg: string) {
  return errMsg.includes('fail') || errMsg.includes('Failed to fetch') || errMsg.includes('timeout')
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const token = getToken()
  const header: Record<string, string> = {
    'content-type': 'application/json',
    ...options.header
  }

  if (token && !options.skipAuth) {
    header.Authorization = `Bearer ${token}`
  }

  let response: Taro.request.SuccessCallbackResult<any> | undefined
  let lastErrMsg = ''
  const baseUrls = getRequestBaseUrls(options.url)

  for (const baseUrl of baseUrls) {
    try {
      response = await Taro.request<any>({
        url: buildUrl(options.url, baseUrl),
        method: options.method || 'GET',
        data: options.data as any,
        header,
        timeout: 45000
      })
      break
    } catch (err) {
      lastErrMsg = getErrMsg(err)
      if (!isNetworkError(lastErrMsg)) {
        throw new Error(lastErrMsg || '网络请求失败')
      }
    }
  }

  if (!response) {
    const detail = lastErrMsg ? `（${lastErrMsg}）` : ''
    throw new Error(`无法连接后端服务：${API_BASE_URL}${detail}`)
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`请求失败（${response.statusCode}）`)
  }

  const payload = response.data as ApiResponse<T> | T
  if (payload && typeof payload === 'object' && 'ok' in payload) {
    const wrapped = payload as ApiResponse<T>
    if (wrapped.ok === false) {
      throw new Error(wrapped.error || wrapped.message || '接口返回失败')
    }
    return wrapped.data as T
  }
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const wrapped = payload as { success: boolean; data?: T; error?: string; message?: string }
    if (wrapped.success === false) {
      throw new Error(wrapped.error || wrapped.message || '接口返回失败')
    }
    return wrapped.data as T
  }

  return payload as T
}

export function joinApiUrl(path: string) {
  return buildUrl(path)
}
