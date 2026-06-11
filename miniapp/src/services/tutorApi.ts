import Taro from '@tarojs/taro'
import { joinApiUrl, request } from './apiClient'
import type { TutorConversation, TutorRole, TutorStreamEvent } from '../types/tutor'
import { getToken } from '../utils/storage'
import { decodeArrayBuffer, parseSseChunk } from '../utils/sseParser'

export function getRoles() {
  return request<TutorRole[]>({ url: '/api/tutor/roles' })
}

export function getConversations() {
  return request<TutorConversation[]>({ url: '/api/tutor/conversations' })
}

export function createConversation(title = '新的学习对话', roleId?: number) {
  return request<TutorConversation>({
    url: '/api/tutor/conversations',
    method: 'POST',
    data: { title, role_id: roleId }
  })
}

export function uploadTutorFile(filePath: string, name?: string) {
  const token = getToken()
  return new Promise<{ file_id?: number; id?: number }>((resolve, reject) => {
    Taro.uploadFile({
      url: joinApiUrl('/api/tutor/files'),
      filePath,
      name: 'file',
      formData: { filename: name || '学习资料' },
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const payload = JSON.parse(res.data || '{}')
          if (payload.ok === false) {
            reject(new Error(payload.error || payload.message || '文件上传失败'))
            return
          }
          resolve(payload.data || payload)
        } catch {
          reject(new Error('文件上传结果解析失败'))
        }
      },
      fail: () => reject(new Error('文件上传失败'))
    })
  })
}

type StreamOptions = {
  message: string
  conversationId?: number
  roleId?: number
  fileIds?: number[]
  workshopEnabled: boolean
  mcpEnabled: boolean
  pageContext?: Record<string, unknown>
  onEvent: (event: TutorStreamEvent) => void
}

export function requestTutorStream(options: StreamOptions) {
  const token = getToken()
  let pending = ''
  let receivedChunk = false

  return new Promise<void>((resolve, reject) => {
    const task = Taro.request({
      url: joinApiUrl('/api/tutor/chat'),
      method: 'POST',
      enableChunked: true,
      responseType: 'arraybuffer',
      data: {
        message: options.message,
        mode: 'knowledge_qa',
        conversation_id: options.conversationId,
        role_id: options.roleId,
        file_ids: options.fileIds || [],
        page_context: options.pageContext,
        workshop_enabled: options.workshopEnabled,
        workshop_role_ids: [],
        mcp_enabled: options.mcpEnabled
      },
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`AI 请求失败（${res.statusCode}）`))
          return
        }

        if (!receivedChunk && res.data) {
          const text = typeof res.data === 'string' ? res.data : decodeArrayBuffer(res.data as ArrayBuffer)
          const parsed = parseSseChunk(`${pending}${text}\n\n`)
          parsed.events.forEach(options.onEvent)
        }

        resolve()
      },
      fail: () => reject(new Error(`无法连接后端服务：${joinApiUrl('/api/tutor/chat')}`))
    }) as any

    if (task?.onChunkReceived) {
      task.onChunkReceived((res) => {
        receivedChunk = true
        const text = decodeArrayBuffer(res.data)
        const parsed = parseSseChunk(`${pending}${text}`)
        pending = parsed.rest
        parsed.events.forEach(options.onEvent)
      })
    }
  })
}
