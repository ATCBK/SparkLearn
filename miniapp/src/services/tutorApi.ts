import Taro from '@tarojs/taro'
import { joinApiUrl, request } from './apiClient'
import type { TutorConversation, TutorRole, TutorStreamEvent, VideoJobEvent, VideoResource } from '../types/tutor'
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

export type VideoJobRequest = {
  prompt: string
  title?: string
  script_outline?: Array<Record<string, unknown>>
  content_source?: string
  ai_provider?: string
  ai_model?: string
  video_provider?: string
  style_id?: string
  target_level?: string
  duration_sec?: number
  voice?: Record<string, unknown>
  output?: Record<string, unknown>
}

export type VideoJobResponse = {
  job_id: string
  resource_id: string
  status: string
  events_url: string
}

function normalizeVideoResource(payload: Record<string, unknown> | undefined): VideoResource {
  const data = payload || {}
  return {
    id: String(data.id || data.resource_id || ''),
    title: String(data.title || 'AI 视频'),
    status: String(data.status || ''),
    duration: Number(data.duration || 0) || 0,
    durationMs: Number(data.duration_ms || 0) || 0,
    createdAt: String(data.created_at || ''),
    videoUrl: String(data.video_url || ''),
    audioUrl: String(data.audio_url || ''),
    subtitleUrl: String(data.subtitle_url || ''),
    timelineUrl: String(data.timeline_url || ''),
    sceneUrl: String(data.scene_url || ''),
    shareUrl: String(data.share_url || ''),
    resolution: String(data.resolution || ''),
    fps: Number(data.fps || 0) || 0,
    provider: String(data.provider || ''),
    contentSource: String(data.content_source || ''),
    ttsProvider: String(data.tts_provider || ''),
    voiceProvider: String(data.voice_provider || ''),
    voice: String(data.voice || ''),
    hasMp4: Boolean(data.has_mp4),
    slides: Number(data.slides || 0) || 0,
    audioStatus: String(data.audio_status || ''),
    audioMessage: String(data.audio_message || ''),
    frameStatus: String(data.frame_status || ''),
    frameMessage: String(data.frame_message || ''),
    muxStatus: String(data.mux_status || ''),
    muxMessage: String(data.mux_message || ''),
    progress: Number(data.progress || 0) || 0,
    message: String(data.message || ''),
  }
}

export function createVideoJob(data: VideoJobRequest) {
  return request<VideoJobResponse>({
    url: '/api/video/jobs',
    method: 'POST',
    data,
  })
}

export async function getVideoResource(resourceId: string) {
  const payload = await request<Record<string, unknown>>({
    url: `/api/video/resources/${resourceId}`,
  })
  return normalizeVideoResource(payload)
}

export function requestVideoJobEvents(
  eventsUrl: string,
  onEvent: (event: VideoJobEvent) => void,
) {
  const token = getToken()
  let pending = ''
  let receivedChunk = false

  return new Promise<void>((resolve, reject) => {
    const task = Taro.request({
      url: joinApiUrl(eventsUrl),
      method: 'GET',
      enableChunked: true,
      responseType: 'arraybuffer',
      header: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`视频任务请求失败：${res.statusCode}`))
          return
        }

        if (!receivedChunk && res.data) {
          const text = typeof res.data === 'string' ? res.data : decodeArrayBuffer(res.data as ArrayBuffer)
          const parsed = parseSseChunk(`${pending}${text}\n\n`) as { events: VideoJobEvent[] }
          parsed.events.forEach((event) => {
            if (event.type === 'error') {
              reject(new Error(String(event.payload?.message || '视频生成失败')))
              return
            }
            onEvent(event)
            if (event.type === 'done') {
              resolve()
            }
          })
        }
      },
      fail: () => reject(new Error(`无法连接视频事件服务：${joinApiUrl(eventsUrl)}`)),
    }) as any

    if (task?.onChunkReceived) {
      task.onChunkReceived((res: { data: ArrayBuffer }) => {
        receivedChunk = true
        const text = decodeArrayBuffer(res.data)
        const parsed = parseSseChunk(`${pending}${text}`) as { events: VideoJobEvent[]; rest: string }
        pending = parsed.rest
        parsed.events.forEach((event) => {
          if (event.type === 'error') {
            reject(new Error(String(event.payload?.message || '视频生成失败')))
            return
          }
          onEvent(event)
          if (event.type === 'done') {
            resolve()
          }
        })
      })
    }
  })
}

type StreamOptions = {
  message: string
  conversationId?: number
  roleId?: number
  fileIds?: number[]
  mode?: string
  openMode?: boolean
  workshopEnabled: boolean
  mcpEnabled: boolean
  webSearch?: boolean
  model?: string
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
        mode: options.mode || 'knowledge_qa',
        conversation_id: options.conversationId,
        role_id: options.roleId,
        file_ids: options.fileIds || [],
        page_context: options.pageContext,
        workshop_enabled: options.workshopEnabled,
        workshop_role_ids: [],
        open_mode: Boolean(options.openMode),
        web_search: Boolean(options.webSearch),
        mcp_enabled: options.mcpEnabled,
        model: options.model || '',
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
