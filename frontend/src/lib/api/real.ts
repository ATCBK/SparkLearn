/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Task, Resource, StudentProfile, Message, QuizQuestion,
  DashboardStats, MasteryRecord, ReportData, Recommendation,
  LearningPath, VideoInfo, ContributionDay, TutorRole, TutorRoleGenerationPayload, TutorConversation, TutorFile, PathNodeAdvice, PathAdjustResult, WorkshopHubEvent, ProfileUpdatePayload, KnowledgeFile, KnowledgeStats, TaskCreatePayload,
  ConfidenceInfo, CitationItem, SearchResultItem,
  PathPlanningData, PathPlanningSuggestion, PathPlanningResource, PathNodeSuggestionsResp, ForumPost, ForumComment, ForumAttachment, ForumModerationList, ForumResourceImportResult, TeacherRecipient, TeacherMaterialFile, TeacherBroadcast, TeacherSubject, McpService, McpServicePayload,
  ProfileHistoryResp, ProfileAnalysisResp,
  CodeEvaluatePayload, CodeEvaluateResult, ResourceQualityResult,
  A2UIEnvelope, A2UISurfaceState, AGUIEvent,
} from './types'
import { getToken } from '../auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

type ApiResp<T> = { success: boolean; data: T; error?: string; detail?: unknown }
type SseEvent = { type: string; payload: Record<string, unknown> }

function applyA2UIEnvelope(surfaces: A2UISurfaceState[], envelope: A2UIEnvelope): A2UISurfaceState[] {
  if ('createSurface' in envelope) {
    const surface = envelope.createSurface
    if (!surface.surfaceId || !surface.catalogId) return surfaces
    const existing = surfaces.find((item) => item.surfaceId === surface.surfaceId)
    if (existing) {
      return surfaces.map((item) => item.surfaceId === surface.surfaceId ? {
        ...item,
        catalogId: surface.catalogId,
        title: surface.title,
      } : item)
    }
    return [
      ...surfaces,
      {
        surfaceId: surface.surfaceId,
        catalogId: surface.catalogId,
        title: surface.title,
        dataModel: {},
        components: [],
      },
    ]
  }
  if ('updateDataModel' in envelope) {
    const update = envelope.updateDataModel
    return surfaces.map((item) => item.surfaceId === update.surfaceId ? {
      ...item,
      dataModel: update.value,
    } : item)
  }
  if ('updateComponents' in envelope) {
    const update = envelope.updateComponents
    return surfaces.map((item) => item.surfaceId === update.surfaceId ? {
      ...item,
      components: update.components,
    } : item)
  }
  return surfaces
}

function buildA2UISurfaces(events: unknown): A2UISurfaceState[] {
  if (!Array.isArray(events)) return []
  return events.reduce<A2UISurfaceState[]>((surfaces, event) => {
    if (!event || typeof event !== 'object') return surfaces
    return applyA2UIEnvelope(surfaces, event as A2UIEnvelope)
  }, [])
}

function _authHeaders(): Record<string, string> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const method = (init?.method || 'GET').toUpperCase()
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ..._authHeaders(), ...(init?.headers || {}) },
    })
    const json = await res.json() as ApiResp<T>
    if (!res.ok || !json.success) {
      throw new Error(formatApiError(json, method, path, res.status))
    }
    return json.data
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(`无法连接到服务器 (${API_BASE})。请确保后端服务已启动。`)
    }
    throw error
  }
}

function formatApiError<T>(json: ApiResp<T>, method: string, path: string, status: number): string {
  const detail = Array.isArray(json.detail)
    ? json.detail.map((item) => typeof item === 'object' && item !== null && 'msg' in item ? String((item as { msg: unknown }).msg) : String(item)).join('；')
    : typeof json.detail === 'string'
      ? json.detail
      : ''
  const baseMessage = json.error || detail || `请求失败：${status}`
  return `${baseMessage} [${method} ${path} -> ${status}]`
}

async function readSSE(
  path: string,
  body: Record<string, unknown>,
  onEvent?: (evt: SseEvent) => void,
) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.body) throw new Error('流式响应体为空')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events: SseEvent[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() || ''
    for (const c of chunks) {
      const line = c.split('\n').find(l => l.startsWith('data: '))
      if (!line) continue
      const evt = JSON.parse(line.slice(6)) as SseEvent
      events.push(evt)
      onEvent?.(evt)
    }
  }
  return events
}

function toResource(raw: any): Resource {
  const rawVideoUrl = raw.videoUrl || raw.video_url || ''
  const rawAudioUrl = raw.audioUrl || raw.audio_url || ''
  const rawSubtitleUrl = raw.subtitleUrl || raw.subtitle_url || ''
  const rawTimelineUrl = raw.timelineUrl || raw.timeline_url || ''
  const rawSceneUrl = raw.sceneUrl || raw.scene_url || ''
  const rawAnalysis = raw.analysis && typeof raw.analysis === 'object' ? raw.analysis : {}
  return {
    id: raw.id,
    title: raw.title,
    type: raw.type,
    status: raw.status,
    createdAt: raw.createdAt || raw.created_at,
    updatedAt: raw.updatedAt || raw.updated_at,
    content: raw.content,
    sourceUrl: raw.sourceUrl || raw.source_url,
    sourceType: raw.sourceType || raw.source_type,
    fileId: raw.fileId || raw.file_id,
    analysis: raw.analysis && typeof raw.analysis === 'object' ? {
      summary: String(rawAnalysis.summary || ''),
      key_points: Array.isArray(rawAnalysis.key_points) ? rawAnalysis.key_points.map((x: unknown) => String(x)) : [],
      audience: String(rawAnalysis.audience || ''),
      learning_method: String(rawAnalysis.learning_method || ''),
      lecture_script: String(rawAnalysis.lecture_script || ''),
    } : undefined,
    videoUrl: rawVideoUrl ? `${API_BASE}${rawVideoUrl}` : undefined,
    audioUrl: rawAudioUrl ? `${API_BASE}${rawAudioUrl}` : undefined,
    subtitleUrl: rawSubtitleUrl ? `${API_BASE}${rawSubtitleUrl}` : undefined,
    timelineUrl: rawTimelineUrl ? `${API_BASE}${rawTimelineUrl}` : undefined,
    sceneUrl: rawSceneUrl ? `${API_BASE}${rawSceneUrl}` : undefined,
    shareUrl: raw.shareUrl || raw.share_url,
    duration: raw.duration,
    provider: raw.provider,
    ttsProvider: raw.ttsProvider || raw.tts_provider,
    hasMp4: raw.hasMp4 ?? raw.has_mp4,
    muxStatus: raw.muxStatus || raw.mux_status,
    muxMessage: raw.muxMessage || raw.mux_message,
    docmeeId: raw.docmeeId || raw.docmee_id,
    progress: raw.progress,
  }
}

function sortResourcesByLatest(resources: Resource[]): Resource[] {
  return [...resources].sort((a, b) => {
    const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (timeDiff !== 0) return timeDiff
    return String(b.id).localeCompare(String(a.id))
  })
}

// ─── Auth API ──────────────────────────────────────────────────────────────

export async function sendSmsCode(phone: string, purpose: 'login' | 'register'): Promise<void> {
  await fetchJson('/api/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone, purpose }),
  })
}

export async function checkPhoneRegistered(phone: string): Promise<{ registered: boolean }> {
  return fetchJson(`/api/auth/check-phone/${phone}`)
}

export async function smsLogin(phone: string, code: string): Promise<{ token: string; user: { id?: string; user_id?: string; name: string; phone: string; is_demo?: boolean } }> {
  return fetchJson('/api/auth/sms/login', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
}

export async function passwordLogin(phone: string, password: string): Promise<{ token: string; user: { id?: string; user_id?: string; name: string; phone: string; is_demo?: boolean } }> {
  return fetchJson('/api/auth/password/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  })
}

export async function smsRegister(phone: string, code: string, name: string | undefined, password: string): Promise<{ token: string; user: { id?: string; user_id?: string; name: string; phone: string; is_demo?: boolean } }> {
  return fetchJson('/api/auth/sms/register', {
    method: 'POST',
    body: JSON.stringify({ phone, code, name, password }),
  })
}

// ─── Tasks API ─────────────────────────────────────────────────────────────

export async function getTodayTasks(): Promise<Task[]> {
  return fetchJson('/api/tasks/today')
}

export async function createTask(payload: TaskCreatePayload): Promise<Task> {
  return fetchJson('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      type: payload.type || 'practice',
      duration: payload.duration ?? 15,
    }),
  })
}

export async function completeTask(taskId: string): Promise<void> {
  await fetchJson(`/api/tasks/${taskId}/complete`, { method: 'PUT', body: JSON.stringify({ status: 'completed' }) })
}

export async function updateTaskStatus(taskId: string, status: Task['status']): Promise<Task> {
  return fetchJson(`/api/tasks/${taskId}/complete`, { method: 'PUT', body: JSON.stringify({ status }) })
}

export async function deleteTask(taskId: string): Promise<void> {
  await fetchJson(`/api/tasks/${taskId}`, { method: 'DELETE' })
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const stats = await fetchJson<any>('/api/dashboard/stats')
  return {
    totalHours: stats.total_hours,
    taskCompletionRate: stats.task_completion_rate,
    quizAccuracy: stats.quiz_accuracy,
    streakDays: stats.streak_days,
  }
}

export async function getRecentResources(): Promise<Resource[]> {
  const resources = await fetchJson<any[]>('/api/resources')
  return sortResourcesByLatest(resources.map(toResource)).slice(0, 3)
}

export async function getMasteryData(): Promise<MasteryRecord[]> {
  const mastery = await fetchJson<any[]>('/api/mastery')
  return mastery.map(m => ({
    knowledgePointId: m.knowledge_point_id,
    knowledgePointName: m.knowledge_point_name,
    score: m.score,
    chapter: m.chapter,
  }))
}

export async function getProfile(): Promise<StudentProfile> {
  const p = await fetchJson<any>('/api/profile')
  return {
    id: p.user_id,
    name: String(p.name || '张同学'),
    email: String(p.email || 'student@sparklearn.ai'),
    major: String(p.major || ''),
    grade: String(p.grade || '大二'),
    goals: p.goal,
    knowledgeLevel: p.knowledge_level,
    weakPoints: p.weak_points,
    learningPreference: p.learning_preference,
    cognitiveStyle: p.cognitive_style,
    dailyTime: p.daily_time,
    practicalAbility: p.practical_ability,
    currentStage: p.current_stage || '',
  }
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<void> {
  const body: Record<string, unknown> = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.email !== undefined) body.email = payload.email
  if (payload.major !== undefined) body.major = payload.major
  if (payload.grade !== undefined) body.grade = payload.grade
  if (payload.goals !== undefined) body.goal = payload.goals
  if (payload.knowledgeLevel !== undefined) body.knowledge_level = payload.knowledgeLevel
  if (payload.weakPoints !== undefined) body.weak_points = payload.weakPoints
  if (payload.learningPreference !== undefined) body.learning_preference = payload.learningPreference
  if (payload.cognitiveStyle !== undefined) body.cognitive_style = payload.cognitiveStyle
  if (payload.dailyTime !== undefined) body.daily_time = payload.dailyTime
  if (payload.practicalAbility !== undefined) body.practical_ability = payload.practicalAbility
  if (payload.currentStage !== undefined) body.current_stage = payload.currentStage

  await fetchJson('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function getProfileHistory(): Promise<ProfileHistoryResp> {
  return fetchJson('/api/profile/history')
}

export async function analyzeProfileHistory(): Promise<ProfileAnalysisResp> {
  return fetchJson('/api/profile/history/analyze', { method: 'POST', body: JSON.stringify({}) })
}

export async function getResources(): Promise<Resource[]> {
  const resources = await fetchJson<any[]>('/api/resources')
  return sortResourcesByLatest(resources.map(toResource))
}

export async function getResource(resourceId: string): Promise<Resource> {
  const resource = await fetchJson<any>(`/api/resources/${resourceId}`)
  return toResource(resource)
}

export async function deleteResource(resourceId: string): Promise<void> {
  await fetchJson(`/api/resources/${resourceId}`, { method: 'DELETE' })
}

export async function getResourcePreview(resourceId: string): Promise<{ url: string | null; available: boolean }> {
  const data = await fetchJson<{ url: string | null; available: boolean }>(`/api/resources/${resourceId}/preview`)
  return {
    url: data?.url ?? null,
    available: Boolean(data?.available),
  }
}

export async function downloadResource(resourceId: string): Promise<void> {
  const primary = `${API_BASE}/api/resources/${resourceId}/download/pdf?t=${Date.now()}`
  const fallback = `${API_BASE}/api/resources/${resourceId}/download?t=${Date.now()}`

  let res = await fetch(primary)
  if (res.status === 404) {
    res = await fetch(fallback)
  }
  if (!res.ok) {
    const raw = await res.text()
    throw new Error(raw || `下载失败：${res.status}`)
  }

  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') || ''
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/)
  const encodedName = match?.[1] || ''
  const plainName = match?.[2] || ''
  const filename = encodedName ? decodeURIComponent(encodedName) : (plainName || `resource-${resourceId}.pdf`)

  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadResourceSource(resourceId: string): Promise<void> {
  const url = `${API_BASE}/api/resources/${resourceId}/download/source?t=${Date.now()}`
  const res = await fetch(url)
  if (!res.ok) {
    const raw = await res.text()
    throw new Error(raw || `源文件下载失败：${res.status}`)
  }
  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') || ''
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/)
  const encodedName = match?.[1] || ''
  const plainName = match?.[2] || ''
  const filename = encodedName ? decodeURIComponent(encodedName) : (plainName || `resource-${resourceId}`)

  const obj = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = obj
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(obj)
}

export async function generateResource(
  type: Resource['type'],
  prompt: string,
  knowledgeFileIds: number[] = [],
  videoOptions?: {
    durationSec?: number
    targetLevel?: string
    styleId?: string
    voice?: string
    voiceProvider?: string
    voiceSpeed?: number
    voicePitch?: number
    voiceVolume?: number
    onEvent?: (evt: { type: string; payload: Record<string, unknown> }) => void
  },
): Promise<Resource> {
  // 视频类型走专用生成管线
  if (type === 'video') {
    return generateVideo(prompt, videoOptions)
  }

  const events = await readSSE('/api/resources/generate', { type, prompt, knowledge_file_ids: knowledgeFileIds })
  let done: { type: string; payload: Record<string, unknown> } | undefined
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'done') {
      done = events[i]
      break
    }
  }
  const resource = done?.payload?.resource ? done.payload.resource as any : null
  if (resource) return toResource(resource)
  return {
    id: `gen-${Date.now()}`,
    title: prompt.slice(0, 20) || '新生成资源',
    type,
    status: 'generating',
    createdAt: new Date().toISOString(),
    progress: 0,
  }
}

export async function evaluateCodeResource(resourceId: string, payload: CodeEvaluatePayload): Promise<CodeEvaluateResult> {
  const data = await fetchJson<any>(`/api/resources/code/evaluate/${resourceId}`, {
    method: 'POST',
    body: JSON.stringify({
      question: payload.question,
      hint: payload.hint || '',
      student_code: payload.studentCode,
    }),
  })
  return {
    correct: Boolean(data.correct),
    result: String(data.result || (data.correct ? '正确' : '错误')),
    reason: String(data.reason || ''),
  }
}

export async function evaluateResourceQuality(resourceId: string): Promise<ResourceQualityResult> {
  const data = await fetchJson<any>(`/api/resources/${resourceId}/quality-evaluate`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return {
    label: String(data.label || '可补充'),
    summary: String(data.summary || ''),
    advice: String(data.advice || ''),
    dimensions: Array.isArray(data.dimensions)
      ? data.dimensions.map((item: any) => ({
          key: item.key,
          label: String(item.label || ''),
          score: Number(item.score || 0),
          level: item.level === 'high' || item.level === 'low' ? item.level : 'medium',
          detail: String(item.detail || ''),
        }))
      : [],
  }
}

export async function sendMessage(
  content: string,
  options?: {
    conversationId?: number
    roleId?: number
    fileIds?: number[]
    mode?: string
    workshopEnabled?: boolean
    workshopRoleIds?: number[]
    openMode?: boolean
    webSearch?: boolean
    mcpEnabled?: boolean
    model?: string
    pageContext?: Record<string, unknown>
  },
  handlers?: {
    onText?: (chunk: string) => void
    onError?: (error: { code?: number; message?: string; sid?: string }) => void
    onHub?: (evt: WorkshopHubEvent) => void
    onWorkshopPhase?: (evt: { phase: string; round?: number; status: string }) => void
    onConfidence?: (confidence: ConfidenceInfo) => void
    onCitations?: (citations: CitationItem[]) => void
    onTrustMeta?: (trustMeta: Record<string, unknown>) => void
    onMcpCall?: (call: { serviceId: string; serviceName: string; toolName: string; status: string; ok: boolean; error: string; args?: Record<string, unknown>; resultPreview?: string; resultContext?: string }) => void
    onSearchResults?: (results: SearchResultItem[]) => void
    onA2UI?: (envelope: A2UIEnvelope) => void
    onAGUI?: (event: AGUIEvent) => void
    onDone?: () => void
  },
): Promise<Message> {
  let lastError: string | undefined
  let latestConfidence: ConfidenceInfo | undefined
  let latestCitations: CitationItem[] | undefined
  let latestTrustMeta: Record<string, unknown> | undefined
  const latestA2UIEvents: A2UIEnvelope[] = []
  const latestAGUIEvents: AGUIEvent[] = []
  let a2uiUiOnly = false
  let doneMessage: Record<string, unknown> | undefined
  const events = await readSSE('/api/tutor/chat', {
    message: content,
    mode: options?.mode || 'knowledge_qa',
    conversation_id: options?.conversationId,
    role_id: options?.roleId,
    file_ids: options?.fileIds || [],
    workshop_enabled: Boolean(options?.workshopEnabled),
    workshop_role_ids: options?.workshopRoleIds || [],
    open_mode: Boolean(options?.openMode),
    web_search: Boolean(options?.webSearch),
    mcp_enabled: Boolean(options?.mcpEnabled),
    model: options?.model || '',
    page_context: options?.pageContext || undefined,
  }, (evt) => {
    if (evt.type === 'text') {
      const chunk = String(evt.payload.content || '')
      if (chunk) handlers?.onText?.(chunk)
      return
    }
    if (evt.type === 'error') {
      const err = {
        code: Number(evt.payload.code ?? 0),
        message: String(evt.payload.message || '模型服务异常'),
        sid: String(evt.payload.sid || ''),
      }
      lastError = err.message
      handlers?.onError?.(err)
      return
    }
    if (evt.type === 'hub') {
      handlers?.onHub?.({
        phase: String(evt.payload.phase || 'discussion'),
        round: Number(evt.payload.round || 0),
        agentId: String(evt.payload.agent_id || ''),
        agentName: String(evt.payload.agent_name || '导师'),
        agentKind: String(evt.payload.agent_kind || 'system'),
        content: String(evt.payload.content || ''),
        timestamp: String(evt.payload.timestamp || new Date().toISOString()),
        delta: Boolean(evt.payload.delta),
      })
      return
    }
    if (evt.type === 'workshop_phase') {
      handlers?.onWorkshopPhase?.({
        phase: String(evt.payload.phase || 'discussion'),
        round: evt.payload.round !== undefined ? Number(evt.payload.round) : undefined,
        status: String(evt.payload.status || ''),
      })
      return
    }
    if (evt.type === 'confidence') {
      const confidence: ConfidenceInfo = {
        score: Number(evt.payload.score ?? 0),
        level: String(evt.payload.level || 'low'),
        color: String(evt.payload.color || 'red'),
        label: String(evt.payload.label || 'Low confidence'),
        message: String(evt.payload.message || ''),
        reasonCodes: Array.isArray(evt.payload.reason_codes) ? evt.payload.reason_codes.map((x) => String(x)) : [],
      }
      latestConfidence = confidence
      handlers?.onConfidence?.(confidence)
      return
    }
    if (evt.type === 'citations') {
      const itemsRaw = Array.isArray(evt.payload.items) ? evt.payload.items : []
      const citations: CitationItem[] = itemsRaw.map((x: any) => ({
        id: String(x.id || ''),
        label: String(x.label || ''),
        sourceType: String(x.source_type || ''),
        snippet: String(x.snippet || ''),
        score: x.score !== undefined ? Number(x.score) : undefined,
      }))
      latestCitations = citations
      handlers?.onCitations?.(citations)
      return
    }
    if (evt.type === 'trust_meta') {
      latestTrustMeta = evt.payload
      handlers?.onTrustMeta?.(evt.payload)
      return
    }
    if (evt.type === 'mcp_call') {
      handlers?.onMcpCall?.({
        serviceId: String(evt.payload.service_id || ''),
        serviceName: String(evt.payload.service_name || ''),
        toolName: String(evt.payload.tool_name || ''),
        status: String(evt.payload.status || 'running'),
        ok: Boolean(evt.payload.ok),
        error: String(evt.payload.error || ''),
        args: evt.payload.args && typeof evt.payload.args === 'object' && !Array.isArray(evt.payload.args)
          ? evt.payload.args as Record<string, unknown>
          : undefined,
        resultPreview: String(evt.payload.result_preview || ''),
        resultContext: String(evt.payload.result_context || ''),
      })
      return
    }
    if (evt.type === 'search_results') {
      const items: SearchResultItem[] = Array.isArray(evt.payload.items)
        ? evt.payload.items.map((x: any) => ({
            title: String(x.title || ''),
            url: String(x.url || ''),
            content: String(x.content || ''),
            score: Number(x.score || 0),
          }))
        : []
      handlers?.onSearchResults?.(items)
      return
    }
    if (evt.type === 'a2ui') {
      const envelope = evt.payload as A2UIEnvelope
      latestA2UIEvents.push(envelope)
      handlers?.onA2UI?.(envelope)
      return
    }
    if (evt.type === 'agui') {
      const event = evt.payload as unknown as AGUIEvent
      latestAGUIEvents.push(event)
      handlers?.onAGUI?.(event)
      return
    }
    if (evt.type === 'done') {
      doneMessage = evt.payload.message && typeof evt.payload.message === 'object'
        ? evt.payload.message as Record<string, unknown>
        : undefined
      if (Array.isArray(evt.payload.a2ui_events)) {
        latestA2UIEvents.splice(0, latestA2UIEvents.length, ...(evt.payload.a2ui_events as A2UIEnvelope[]))
      }
      if (Array.isArray(evt.payload.agui_events)) {
        latestAGUIEvents.splice(0, latestAGUIEvents.length, ...(evt.payload.agui_events as AGUIEvent[]))
      }
      a2uiUiOnly = Boolean(evt.payload.a2ui_ui_only || doneMessage?.a2ui_ui_only)
      handlers?.onDone?.()
    }
  })
  const text = events.filter(e => e.type === 'text').map(e => String(e.payload.content || '')).join('')
  if (!text && lastError) throw new Error(lastError)
  return {
    id: doneMessage?.id !== undefined ? String(doneMessage.id) : `m-${Date.now()}`,
    role: 'assistant',
    content: text || (a2uiUiOnly ? '' : '我已收到你的问题，我们继续一起拆解。'),
    timestamp: String(doneMessage?.timestamp || new Date().toISOString()),
    conversationId: doneMessage?.conversation_id !== undefined ? Number(doneMessage.conversation_id) : options?.conversationId,
    confidence: latestConfidence,
    citations: latestCitations,
    trustMeta: latestTrustMeta,
    a2uiSurfaces: buildA2UISurfaces(latestA2UIEvents),
    a2uiUiOnly,
    aguiEvents: latestAGUIEvents,
  }
}

export async function getChatHistory(conversationId?: number): Promise<Message[]> {
  const query = conversationId ? `?limit=200&conversation_id=${conversationId}` : '?limit=200'
  const data = await fetchJson<any[]>(`/api/tutor/history${query}`)
  return data.map(m => ({
    id: String(m.id),
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    conversationId: m.conversation_id,
    fileNames: Array.isArray(m.file_names) ? m.file_names : [],
    confidence: m.confidence && typeof m.confidence === 'object' ? {
      score: Number(m.confidence.score ?? 0),
      level: String(m.confidence.level || 'low'),
      color: String(m.confidence.color || 'red'),
      label: String(m.confidence.label || 'Low confidence'),
      message: String(m.confidence.message || ''),
      reasonCodes: Array.isArray(m.confidence.reason_codes) ? m.confidence.reason_codes.map((x: unknown) => String(x)) : [],
    } : undefined,
    citations: Array.isArray(m.citations) ? m.citations.map((x: any) => ({
      id: String(x.id || ''),
      label: String(x.label || ''),
      sourceType: String(x.source_type || ''),
      snippet: String(x.snippet || ''),
      score: x.score !== undefined ? Number(x.score) : undefined,
    })) : [],
    trustMeta: m.trust_meta && typeof m.trust_meta === 'object' ? m.trust_meta : undefined,
    mcpCalls: Array.isArray(m.mcp_calls) ? m.mcp_calls : [],
    searchResults: Array.isArray(m.search_results)
      ? m.search_results.map((x: any) => ({
          title: String(x.title || ''),
          url: String(x.url || ''),
          content: String(x.content || ''),
          score: Number(x.score || 0),
        }))
      : [],
    a2uiSurfaces: buildA2UISurfaces(m.a2ui_events),
    a2uiUiOnly: Boolean(m.a2ui_ui_only),
    aguiEvents: Array.isArray(m.agui_events) ? m.agui_events as AGUIEvent[] : [],
  }))
}

export async function getTutorRoles(): Promise<TutorRole[]> {
  const data = await fetchJson<any[]>('/api/tutor/roles')
  return data.map(r => ({
    id: Number(r.id),
    name: String(r.name || ''),
    persona: String(r.persona || ''),
    background: String(r.background || ''),
    styleGuide: String(r.style_guide || ''),
    rules: String(r.rules || ''),
    enabled: Boolean(r.enabled),
  }))
}

export async function createTutorRole(payload: {
  name: string
  persona?: string
  background?: string
  styleGuide?: string
  rules?: string
}): Promise<TutorRole> {
  const r = await fetchJson<any>('/api/tutor/roles', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      persona: payload.persona || '',
      background: payload.background || '',
      style_guide: payload.styleGuide || '',
      rules: payload.rules || '',
    }),
  })
  return {
    id: Number(r.id),
    name: String(r.name || ''),
    persona: String(r.persona || ''),
    background: String(r.background || ''),
    styleGuide: String(r.style_guide || ''),
    rules: String(r.rules || ''),
    enabled: Boolean(r.enabled),
  }
}

export async function createTutorRoleFromQuestion(payload: TutorRoleGenerationPayload): Promise<TutorRole> {
  const r = await fetchJson<any>('/api/tutor/roles/generate-from-question', {
    method: 'POST',
    body: JSON.stringify({ question: payload.question }),
  })
  return {
    id: Number(r.id),
    name: String(r.name || ''),
    persona: String(r.persona || ''),
    background: String(r.background || ''),
    styleGuide: String(r.style_guide || ''),
    rules: String(r.rules || ''),
    enabled: Boolean(r.enabled),
  }
}

export async function updateTutorRole(roleId: number, payload: Partial<Omit<TutorRole, 'id'>>): Promise<TutorRole> {
  const r = await fetchJson<any>(`/api/tutor/roles/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: payload.name,
      persona: payload.persona,
      background: payload.background,
      style_guide: payload.styleGuide,
      rules: payload.rules,
      enabled: payload.enabled,
    }),
  })
  return {
    id: Number(r.id),
    name: String(r.name || ''),
    persona: String(r.persona || ''),
    background: String(r.background || ''),
    styleGuide: String(r.style_guide || ''),
    rules: String(r.rules || ''),
    enabled: Boolean(r.enabled),
  }
}

export async function deleteTutorRole(roleId: number): Promise<void> {
  await fetchJson(`/api/tutor/roles/${roleId}`, { method: 'DELETE' })
}

export async function optimizeRolePrompt(field: string, content: string, roleName: string): Promise<string> {
  const data = await fetchJson<{ optimized: string }>('/api/tutor/roles/optimize-prompt', {
    method: 'POST',
    body: JSON.stringify({ field, content, role_name: roleName }),
  })
  return data.optimized
}

export async function getTutorConversations(): Promise<TutorConversation[]> {
  const data = await fetchJson<any[]>('/api/tutor/conversations')
  return data.map(c => ({
    id: Number(c.id),
    roleId: c.role_id == null ? null : Number(c.role_id),
    title: String(c.title || ''),
    createdAt: String(c.created_at || ''),
    updatedAt: String(c.updated_at || ''),
    messageCount: Number(c.message_count || 0),
  }))
}

export async function createTutorConversation(payload: { title?: string; roleId?: number }): Promise<TutorConversation> {
  const c = await fetchJson<any>('/api/tutor/conversations', {
    method: 'POST',
    body: JSON.stringify({ title: payload.title || '新对话', role_id: payload.roleId }),
  })
  return {
    id: Number(c.id),
    roleId: c.role_id == null ? null : Number(c.role_id),
    title: String(c.title || ''),
    createdAt: String(c.created_at || ''),
    updatedAt: String(c.updated_at || ''),
    messageCount: Number(c.message_count || 0),
  }
}

export async function updateTutorConversation(
  conversationId: number,
  payload: { title?: string; roleId?: number },
): Promise<TutorConversation> {
  const c = await fetchJson<any>(`/api/tutor/conversations/${conversationId}`, {
    method: 'PUT',
    body: JSON.stringify({ title: payload.title, role_id: payload.roleId }),
  })
  return {
    id: Number(c.id),
    roleId: c.role_id == null ? null : Number(c.role_id),
    title: String(c.title || ''),
    createdAt: String(c.created_at || ''),
    updatedAt: String(c.updated_at || ''),
    messageCount: Number(c.message_count || 0),
  }
}

export async function deleteTutorConversation(conversationId: number): Promise<void> {
  await fetchJson(`/api/tutor/conversations/${conversationId}`, { method: 'DELETE' })
}

export async function deleteTutorMessage(messageId: string | number): Promise<void> {
  await fetchJson(`/api/tutor/messages/${messageId}`, { method: 'DELETE' })
}

export async function uploadTutorFiles(files: File[]): Promise<TutorFile[]> {
  const form = new FormData()
  files.forEach(file => form.append('files', file))
  const res = await fetch(`${API_BASE}/api/tutor/files`, { method: 'POST', body: form })
  const json = await res.json() as ApiResp<any[]>
  if (!res.ok || !json.success) throw new Error(json.error || `上传失败：${res.status}`)
  return (json.data || []).map(toTutorFile)
}

export async function getTutorFiles(): Promise<TutorFile[]> {
  const data = await fetchJson<any[]>('/api/tutor/files')
  return (data || []).map(toTutorFile)
}

export async function getTutorFile(fileId: number): Promise<TutorFile> {
  const data = await fetchJson<any>(`/api/tutor/files/${fileId}`)
  return toTutorFile(data)
}

function toTutorFile(f: any): TutorFile {
  return {
    id: Number(f.id),
    filename: String(f.filename || ''),
    mimeType: String(f.mime_type || ''),
    sizeBytes: Number(f.size_bytes || 0),
    sourceType: String(f.source_type || 'upload'),
    sourceUrl: String(f.source_url || ''),
    status: String(f.status || 'ready'),
    analysis: f.analysis && typeof f.analysis === 'object' ? {
      summary: String(f.analysis.summary || ''),
      key_points: Array.isArray(f.analysis.key_points) ? f.analysis.key_points.map((x: unknown) => String(x)) : [],
      audience: String(f.analysis.audience || ''),
      learning_method: String(f.analysis.learning_method || ''),
      lecture_script: String(f.analysis.lecture_script || ''),
    } : {},
    content: f.content !== undefined ? String(f.content || '') : undefined,
    createdAt: String(f.created_at || ''),
    updatedAt: String(f.updated_at || ''),
  }
}

export async function deleteTutorFile(fileId: number): Promise<void> {
  await fetchJson(`/api/tutor/files/${fileId}`, { method: 'DELETE' })
}

export async function getQuizQuestions(chapter: string, count: number = 8): Promise<QuizQuestion[]> {
  const data = await fetchJson<any[]>(`/api/quiz?chapter=${encodeURIComponent(chapter)}&count=${Math.min(50, Math.max(1, count))}`)
  return data.map(q => ({
    id: q.id,
    type: q.type,
    content: q.content,
    options: q.options,
    // real判题由后端submit接口完成；这里保留字段给页面渲染逻辑
    correctAnswer: q.correct_answer ?? '',
    explanation: q.explanation ?? '',
  }))
}

export async function submitQuizAnswer(quizId: string, answer: string | string[]): Promise<{
  correct: boolean
  correctAnswer: string | string[]
  explanation: string
  judgeMode?: string
}> {
  const data = await fetchJson<any>('/api/quiz/submit', {
    method: 'POST',
    body: JSON.stringify({ quiz_id: quizId, answer }),
  })
  return {
    correct: Boolean(data.correct),
    correctAnswer: data.correct_answer as string | string[],
    explanation: String(data.explanation || ''),
    judgeMode: data.judge_mode ? String(data.judge_mode) : undefined,
  }
}

export async function getWrongQuizItems(): Promise<Array<{
  quizId: string
  content: string
  question?: Record<string, unknown>
  userAnswer: string | string[] | null
  correctAnswer: string | string[] | null
  count: number
}>> {
  const data = await fetchJson<any[]>('/api/quiz/wrong')
  return data.map((i) => ({
    quizId: String(i.quiz_id || ''),
    content: String(i.content || ''),
    question: i.question,
    userAnswer: i.user_answer ?? null,
    correctAnswer: i.correct_answer ?? null,
    count: Number(i.count || 0),
  }))
}

export async function deleteWrongQuizItem(quizId: string): Promise<void> {
  await fetchJson(`/api/quiz/wrong/${quizId}`, { method: 'DELETE' })
}

export async function getQuizFavorites(): Promise<Array<{
  quizId: string
  question?: Record<string, unknown>
  createdAt: string
}>> {
  const data = await fetchJson<any[]>('/api/quiz/favorites')
  return data.map((i) => ({
    quizId: String(i.quiz_id || ''),
    question: i.question,
    createdAt: String(i.created_at || ''),
  }))
}

export async function setQuizFavorite(quizId: string, favorite: boolean): Promise<void> {
  await fetchJson('/api/quiz/favorites', {
    method: 'POST',
    body: JSON.stringify({ quiz_id: quizId, favorite }),
  })
}

export async function getQuizRecords(): Promise<any[]> {
  return fetchJson('/api/quiz/records')
}

export async function getQuizRecordsStats(): Promise<{
  total: number
  correct: number
  wrong: number
  accuracy: number
}> {
  return fetchJson('/api/quiz/records/stats')
}

export async function deleteQuizRecord(quizId: string): Promise<void> {
  await fetchJson(`/api/quiz/records/${quizId}`, { method: 'DELETE' })
}

export async function getReport(period: 'week' | 'day' | 'month' = 'week'): Promise<ReportData> {
  const r = await fetchJson<any>(`/api/evaluation/report?period=${period}`)
  return {
    period: r.period,
    stats: {
      totalHours: r.stats.total_hours,
      taskCompletionRate: r.stats.task_completion_rate,
      quizAccuracy: r.stats.quiz_accuracy,
      streakDays: r.stats.streak_days,
    },
    dailyHours: r.daily_hours,
    timeDistribution: r.time_distribution,
    weakPoints: r.weak_points,
    aiSummary: r.ai_summary,
  }
}

function toKnowledgeFile(raw: any): KnowledgeFile {
  return {
    id: Number(raw.id),
    subjectId: Number(raw.subject_id || 0),
    subjectName: String(raw.subject_name || ''),
    filename: String(raw.filename || ''),
    mimeType: String(raw.mime_type || ''),
    sizeBytes: Number(raw.size_bytes || 0),
    status: raw.status || 'pending',
    tags: Array.isArray(raw.tags) ? raw.tags.map((x: any) => String(x)) : [],
    summary: String(raw.summary || ''),
    chunkCount: Number(raw.chunk_count || 0),
    referenceCount: Number(raw.reference_count || 0),
    createdAt: String(raw.created_at || ''),
    updatedAt: String(raw.updated_at || ''),
  }
}

export async function getKnowledgeFiles(params?: { status?: string; search?: string; subjectId?: number }): Promise<KnowledgeFile[]> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.search) query.set('search', params.search)
  if (params?.subjectId) query.set('subject_id', String(params.subjectId))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const data = await fetchJson<any[]>(`/api/knowledge/files${suffix}`)
  return data.map(toKnowledgeFile)
}

export async function uploadKnowledgeFiles(files: File[], subjectId?: number): Promise<KnowledgeFile[]> {
  const form = new FormData()
  files.forEach(file => form.append('files', file))
  const suffix = subjectId ? `?subject_id=${subjectId}` : ''
  const res = await fetch(`${API_BASE}/api/knowledge/files${suffix}`, { method: 'POST', body: form })
  const json = await res.json() as ApiResp<any[]>
  if (!res.ok || !json.success) throw new Error(json.error || `上传失败：${res.status}`)
  return (json.data || []).map(toKnowledgeFile)
}

export async function indexKnowledgeFile(fileId: number): Promise<KnowledgeFile> {
  const data = await fetchJson<any>(`/api/knowledge/files/${fileId}/index`, { method: 'PUT' })
  return toKnowledgeFile(data)
}

export async function deleteKnowledgeFile(fileId: number): Promise<void> {
  await fetchJson(`/api/knowledge/files/${fileId}`, { method: 'DELETE' })
}

export async function getKnowledgeStats(): Promise<KnowledgeStats> {
  return fetchJson('/api/knowledge/stats')
}

export async function getKnowledgeChunks(fileId: number): Promise<Array<{ id: number; content: string; chunkIndex: number }>> {
  const data = await fetchJson<any[]>(`/api/knowledge/chunks?file_id=${fileId}`)
  return data.map(item => ({ id: Number(item.id), content: String(item.content || ''), chunkIndex: Number(item.chunk_index || 0) }))
}

export async function getRecommendations(): Promise<Recommendation[]> {
  const data = await fetchJson<any[]>('/api/resources/recommendations/list')
  return data.map(rec => ({ ...rec, resource: toResource(rec.resource) }))
}

export async function getLearningPath(): Promise<LearningPath> {
  const p = await fetchJson<any>('/api/learning-path')
  return {
    currentStage: p.current_stage,
    stages: p.stages,
    knowledgeTree: p.knowledge_tree,
    knowledgeGraph: p.knowledge_graph
      ? {
          nodes: (p.knowledge_graph.nodes || []).map((n: any) => ({
            id: String(n.id),
            name: String(n.name),
            stage: String(n.stage),
            mastery: Number(n.mastery ?? 0),
            status: n.status,
            prerequisites: Array.isArray(n.prerequisites) ? n.prerequisites.map((x: any) => String(x)) : [],
            learningContents: Array.isArray(n.learning_contents) ? n.learning_contents.map((x: any) => String(x)) : [],
            recommendedResourceTypes: Array.isArray(n.recommended_resource_types)
              ? n.recommended_resource_types.map((x: any) => String(x))
              : [],
          })),
          edges: (p.knowledge_graph.edges || []).map((e: any) => ({
            source: String(e.source),
            target: String(e.target),
          })),
        }
      : undefined,
  }
}

export async function adjustLearningPath(reason: string): Promise<PathAdjustResult> {
  const data = await fetchJson<any>('/api/learning-path/adjust', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
  return {
    previousStage: String(data.previous_stage || ''),
    currentStage: String(data.current_stage || ''),
  }
}

export async function getLearningPathNodeAdvice(nodeId: string): Promise<PathNodeAdvice> {
  const data = await fetchJson<any>('/api/learning-path/node-advice', {
    method: 'POST',
    body: JSON.stringify({ node_id: nodeId }),
  })
  return {
    nodeId: String(data.node_id || nodeId),
    nodeName: String(data.node_name || ''),
    mastery: Number(data.mastery ?? 0),
    suggestion: String(data.suggestion || ''),
    plainExplanation: String(data.plain_explanation || ''),
    nextActions: Array.isArray(data.next_actions) ? data.next_actions.map((x: any) => String(x)) : [],
    learningContents: Array.isArray(data.learning_contents) ? data.learning_contents.map((x: any) => String(x)) : [],
    recommendedResources: Array.isArray(data.recommended_resources)
      ? data.recommended_resources.map((x: any) => String(x))
      : [],
  }
}

function toPathPlanning(raw: any): PathPlanningData {
  const suggestions: PathPlanningSuggestion[] = Array.isArray(raw?.suggestions)
    ? raw.suggestions.map((s: any, idx: number) => ({
        id: Number(s?.id ?? idx + 1),
        text: String(s?.text ?? ''),
        desc: String(s?.desc ?? ''),
      }))
    : []
  const resources: PathPlanningResource[] = Array.isArray(raw?.resources)
    ? raw.resources.map((r: any, idx: number) => ({
        id: Number(r?.id ?? idx + 1),
        title: String(r?.title ?? ''),
        tag: String(r?.tag ?? ''),
        link: r?.link ? String(r.link) : undefined,
      }))
    : []
  return {
    pathId: String(raw?.path_id ?? ''),
    target: String(raw?.target ?? ''),
    suggestions,
    resources,
    phases: Array.isArray(raw?.phases) ? raw.phases : undefined,
    createdAt: String(raw?.created_at ?? ''),
  }
}

export async function generatePathPlanning(target: string): Promise<PathPlanningData> {
  const data = await fetchJson<any>('/api/path-planning/generate', {
    method: 'POST',
    body: JSON.stringify({ target }),
  })
  return toPathPlanning(data)
}

export async function getPathPlanningHistory(): Promise<PathPlanningData[]> {
  const data = await fetchJson<any[]>('/api/path-planning/history')
  return (Array.isArray(data) ? data : []).map(toPathPlanning)
}

export async function savePathPlanning(req: {
  pathId: string
  target: string
  phases: Array<{ id: number; title: string; description?: string; nodes: Array<{ id: string; title: string; source: string }> }>
}): Promise<{ saved: boolean; pathId: string }> {
  return fetchJson('/api/path-planning/save', {
    method: 'POST',
    body: JSON.stringify({
      path_id: req.pathId,
      target: req.target,
      phases: req.phases,
    }),
  })
}

export async function getPathNodeSuggestions(req: {
  nodeTitle: string
  nodeGoal: string
  nodeStatus: string
  phaseTitle: string
  target: string
}): Promise<PathNodeSuggestionsResp> {
  const data = await fetchJson<any>('/api/path-planning/node-suggestions', {
    method: 'POST',
    body: JSON.stringify({
      node_title: req.nodeTitle,
      node_goal: req.nodeGoal,
      node_status: req.nodeStatus,
      phase_title: req.phaseTitle,
      target: req.target,
    }),
  })
  return {
    nodeTitle: String(data.node_title || ''),
    nodeGoal: String(data.node_goal || ''),
    phaseTitle: String(data.phase_title || ''),
    status: String(data.status || ''),
    suggestions: Array.isArray(data.suggestions)
      ? data.suggestions.map((s: any, idx: number) => ({
          id: Number(s?.id ?? idx + 1),
          text: String(s?.text ?? ''),
          desc: String(s?.desc ?? ''),
        }))
      : [],
    resources: Array.isArray(data.resources)
      ? data.resources.map((r: any, idx: number) => ({
          id: Number(r?.id ?? idx + 1),
          title: String(r?.title ?? ''),
          tag: String(r?.tag ?? ''),
          link: r?.link ? String(r.link) : undefined,
        }))
      : [],
  }
}

export async function getVideos(): Promise<VideoInfo[]> {
  let data: any[]
  try {
    data = await fetchJson<any[]>('/api/video/resources')
  } catch {
    // fallback to legacy endpoint
    data = await fetchJson<any[]>('/api/videos')
  }
  return data.map(v => {
    const rawUrl = v.url || v.video_url || ''
    const rawAudio = v.audio_url || v.audioUrl || ''
    const rawSubtitle = v.subtitle_url || v.subtitleUrl || ''
    const rawScene = v.scene_url || v.sceneUrl || ''
    const rawVoice = typeof v.voice === 'string' ? v.voice : String(v.voice?.voice || '')
    return {
      id: v.id || v.resource_id,
      title: v.title,
      url: rawUrl ? `${API_BASE}${rawUrl}` : '',
      audioUrl: rawAudio ? `${API_BASE}${rawAudio}` : undefined,
      subtitleUrl: rawSubtitle ? `${API_BASE}${rawSubtitle}` : undefined,
      sceneUrl: rawScene ? `${API_BASE}${rawScene}` : undefined,
      shareUrl: v.share_url || v.shareUrl,
      duration: v.duration || 0,
      createdAt: v.created_at || v.createdAt || '',
      hasMp4: Boolean(rawUrl && (v.has_mp4 || v.hasMp4)),
      provider: v.provider,
      ttsProvider: v.tts_provider || v.ttsProvider,
      voiceProvider: v.voice_provider || v.voiceProvider,
      voice: rawVoice,
      muxMessage: v.mux_message || v.muxMessage,
    }
  })
}

export async function getDailyQuote(): Promise<string> {
  const data = await fetchJson<any>('/api/daily-quote')
  return data.quote
}

export async function getContributionData(): Promise<ContributionDay[]> {
  return fetchJson('/api/contribution')
}

export async function getForumPosts(params?: {
  tab?: 'latest' | 'hot' | 'recommended'
  q?: string
  tag?: string
  page?: number
  pageSize?: number
}): Promise<{ items: ForumPost[]; page: number; page_size: number }> {
  const query = new URLSearchParams()
  if (params?.tab) query.set('tab', params.tab)
  if (params?.q) query.set('q', params.q)
  if (params?.tag) query.set('tag', params.tag)
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('page_size', String(params.pageSize))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return fetchJson(`/api/forum/posts${suffix}`)
}

export async function createForumPost(payload: { title: string; content: string; tags?: string[] }): Promise<ForumPost> {
  return fetchJson('/api/forum/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getForumPostDetail(postId: number): Promise<{ post: ForumPost; attachments: ForumAttachment[] }> {
  return fetchJson(`/api/forum/posts/${postId}`)
}

export async function importForumResource(
  postId: number,
  payload: { mode: 'post' | 'attachments' | 'all'; attachment_ids?: number[] },
): Promise<ForumResourceImportResult> {
  return fetchJson(`/api/forum/posts/${postId}/import-resource`, {
    method: 'POST',
    body: JSON.stringify({ mode: payload.mode, attachment_ids: payload.attachment_ids || [] }),
  })
}

export async function deleteForumPost(postId: number): Promise<void> {
  await fetchJson(`/api/forum/posts/${postId}`, { method: 'DELETE' })
}

export async function getAdminForumPosts(params?: {
  status?: 'all' | ForumPost['status']
  q?: string
  page?: number
  pageSize?: number
}): Promise<ForumModerationList> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.q) query.set('q', params.q)
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('page_size', String(params.pageSize))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return fetchJson(`/api/forum/admin/posts${suffix}`)
}

export async function updateAdminForumPostStatus(
  postId: number,
  status: ForumPost['status'],
  reason: string = '',
): Promise<{ post: ForumPost; reason: string }> {
  return fetchJson(`/api/forum/admin/posts/${postId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  })
}

export async function getForumComments(postId: number): Promise<ForumComment[]> {
  return fetchJson(`/api/forum/posts/${postId}/comments`)
}

export async function createForumComment(postId: number, content: string): Promise<ForumComment> {
  return fetchJson(`/api/forum/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function toggleForumLike(postId: number): Promise<{ liked: boolean; like_count: number }> {
  return fetchJson(`/api/forum/posts/${postId}/like`, { method: 'POST' })
}

export async function toggleForumFavorite(postId: number): Promise<{ favorited: boolean; favorite_count: number }> {
  return fetchJson(`/api/forum/posts/${postId}/favorite`, { method: 'POST' })
}

export async function uploadForumAttachments(postId: number, files: File[]): Promise<ForumAttachment[]> {
  const form = new FormData()
  files.forEach(file => form.append('files', file))
  const path = `/api/forum/posts/${postId}/attachments`
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form })
  const json = await res.json() as ApiResp<ForumAttachment[]>
  if (!res.ok || !json.success) throw new Error(formatApiError(json, 'POST', path, res.status))
  return json.data || []
}

export async function getMyLikedPosts(page: number = 1, pageSize: number = 20): Promise<{ items: ForumPost[]; page: number; page_size: number }> {
  return fetchJson(`/api/forum/my/likes?page=${page}&page_size=${pageSize}`)
}

export async function getMyForumHistory(page: number = 1, pageSize: number = 20): Promise<{ items: (ForumPost & { viewed_at?: string })[]; page: number; page_size: number }> {
  return fetchJson(`/api/forum/my/history?page=${page}&page_size=${pageSize}`)
}

export async function getMyForumComments(page: number = 1, pageSize: number = 20): Promise<{ items: Array<{ id: number; post_id: number; post_title: string; content: string; created_at: string }>; page: number; page_size: number }> {
  return fetchJson(`/api/forum/my/comments?page=${page}&page_size=${pageSize}`)
}

export async function getTeacherRecipients(): Promise<TeacherRecipient[]> {
  return fetchJson('/api/teacher/broadcast/recipients')
}

export async function uploadTeacherMaterials(files: File[]): Promise<TeacherMaterialFile[]> {
  const form = new FormData()
  files.forEach(file => form.append('files', file))
  const res = await fetch(`${API_BASE}/api/teacher/broadcast/materials`, { method: 'POST', body: form })
  const json = await res.json() as ApiResp<TeacherMaterialFile[]>
  if (!res.ok || !json.success) throw new Error(json.error || `上传失败: ${res.status}`)
  return json.data || []
}

export async function getTeacherMaterials(): Promise<TeacherMaterialFile[]> {
  return fetchJson('/api/teacher/broadcast/materials')
}

export async function createTeacherBroadcast(payload: {
  title: string
  content: string
  target_type: 'all' | 'specific'
  student_ids: string[]
  material_file_ids: number[]
}): Promise<TeacherBroadcast> {
  return fetchJson('/api/teacher/broadcasts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getTeacherBroadcasts(): Promise<TeacherBroadcast[]> {
  return fetchJson('/api/teacher/broadcasts')
}

export async function getTeacherSubjects(enabledOnly = false): Promise<TeacherSubject[]> {
  return fetchJson(`/api/teacher/subjects${enabledOnly ? '?enabled_only=true' : ''}`)
}

export async function createTeacherSubject(payload: {
  name: string
  code?: string
  description?: string
  enabled?: boolean
}): Promise<TeacherSubject> {
  return fetchJson('/api/teacher/subjects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTeacherSubject(subjectId: number, payload: {
  name: string
  code?: string
  description?: string
  enabled?: boolean
}): Promise<TeacherSubject> {
  return fetchJson(`/api/teacher/subjects/${subjectId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteTeacherSubject(subjectId: number): Promise<void> {
  await fetchJson(`/api/teacher/subjects/${subjectId}`, { method: 'DELETE' })
}

export async function importTeacherSubjects(items: Array<{
  name: string
  code?: string
  description?: string
  enabled?: boolean
}>): Promise<{ created_count: number; skipped_count: number; created: string[]; skipped: string[] }> {
  return fetchJson('/api/teacher/subjects/import', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}








export async function deleteVideoResource(videoId: string): Promise<void> {
  await fetchJson(`/api/video/resources/${videoId}`, { method: 'DELETE' })
}

export async function downloadVideoArtifact(videoId: string, type: 'mp4' | 'audio' | 'srt'): Promise<void> {
  const url = `${API_BASE}/api/video/resources/${videoId}/download/${type}?t=${Date.now()}`
  const res = await fetch(url)
  if (!res.ok) return
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = window.URL.createObjectURL(blob)
  a.download = `video-${videoId}.${type === 'audio' ? 'mp3' : type}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(a.href)
}

export async function polishVideoPrompt(
  prompt: string,
  durationSec: number = 90,
  targetLevel: string = 'beginner',
  styleId: string = 'apple-minimal',
  voice: string = '',
): Promise<{
  polishId: string
  title: string
  polishedPrompt: string
  scriptOutline: Array<{ segment_id: string; title: string; narration: string; visual_hint: string; duration_ms?: number }>
  estimatedDurationSec: number
  voice: string
  styleId: string
  styleName: string
}> {
  const data = await fetchJson<any>('/api/video/polish', {
    method: 'POST',
    body: JSON.stringify({ prompt, duration_sec: durationSec, target_level: targetLevel, style_id: styleId, voice }),
  })
  return {
    polishId: data.polish_id,
    title: data.title,
    polishedPrompt: data.polished_prompt,
    scriptOutline: data.script_outline || [],
    estimatedDurationSec: data.estimated_duration_sec || durationSec,
    voice: data.voice || '',
    styleId: data.style_id || styleId,
    styleName: data.style_name || styleId,
  }
}

export async function generateVideo(
  prompt: string,
  options?: {
    durationSec?: number
    targetLevel?: string
    styleId?: string
    voice?: string
    voiceProvider?: string
    voiceSpeed?: number
    voicePitch?: number
    voiceVolume?: number
    onEvent?: (evt: { type: string; payload: Record<string, unknown> }) => void
  },
): Promise<Resource> {
  const durationSec = options?.durationSec ?? 90
  const targetLevel = options?.targetLevel ?? 'beginner'
  const styleId = options?.styleId ?? 'apple-minimal'
  const voice = options?.voice ?? ''
  const voiceProvider = options?.voiceProvider ?? 'cosyvoice'
  const voiceSpeed = options?.voiceSpeed
  const voicePitch = options?.voicePitch
  const voiceVolume = options?.voiceVolume
  const onEvent = options?.onEvent

  // Step 1: Polish the prompt into a script
  const polish = await polishVideoPrompt(prompt, durationSec, targetLevel, styleId, voice)

  // Step 2: Create a video generation job
  const job = await fetchJson<any>('/api/video/jobs', {
    method: 'POST',
    body: JSON.stringify({
      polish_id: polish.polishId,
      prompt: polish.polishedPrompt,
      title: polish.title,
      script_outline: polish.scriptOutline,
      video_provider: 'html_ppt',
      style_id: styleId,
      target_level: targetLevel,
      duration_sec: durationSec,
      voice: {
        provider: voiceProvider,
        ...(voice ? { voice } : {}),
        ...(voiceSpeed !== undefined ? { speed: voiceSpeed } : {}),
        ...(voicePitch !== undefined ? { pitch: voicePitch } : {}),
        ...(voiceVolume !== undefined ? { volume: voiceVolume } : {}),
      },
    }),
  })

  const resourceId = job.resource_id

  // Step 3: Stream job events
  if (job.events_url) {
    try {
      const eventsUrl = `${API_BASE}${job.events_url}`
      const res = await fetch(eventsUrl)
      if (res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split('\n\n')
          buffer = chunks.pop() || ''
          for (const c of chunks) {
            const line = c.split('\n').find(l => l.startsWith('data: '))
            if (!line) continue
            try {
              const evt = JSON.parse(line.slice(6))
              onEvent?.(evt)
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch { /* SSE stream failed, video may still be generating */ }
  }

  // Step 4: Fetch the final resource
  try {
    const resource = await fetchJson<any>(`/api/video/resources/${resourceId}`)
    return toResource({ ...resource, type: 'video' })
  } catch {
    return {
      id: resourceId || `video-${Date.now()}`,
      title: polish.title || prompt.slice(0, 20),
      type: 'video',
      status: 'generating',
      createdAt: new Date().toISOString(),
    }
  }
}

export async function getVideoStyles(): Promise<Array<{ id: string; name: string; description: string; accent_color: string; bg_gradient: string; tone: string }>> {
  return fetchJson('/api/video/styles')
}

// ─── Agent Pet API ─────────────────────────────────────────────────────────────

import type {
  AgentPet, AgentTask, AgentTaskList, AdoptPetPayload, CreateAgentTaskPayload, BookmarkPayload,
} from './types'

export async function getAgentPet(): Promise<AgentPet | null> {
  return fetchJson('/api/agent/pet')
}

export async function adoptAgentPet(payload: AdoptPetPayload): Promise<AgentPet> {
  return fetchJson('/api/agent/pet', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAgentPet(payload: { personality?: string; name?: string }): Promise<AgentPet> {
  return fetchJson('/api/agent/pet', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function createAgentTask(payload: CreateAgentTaskPayload): Promise<{ task_id: string; task_type: string; status: string; created_at: string }> {
  return fetchJson('/api/agent/task', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getAgentTask(taskId: string): Promise<AgentTask> {
  return fetchJson(`/api/agent/task/${taskId}`)
}

export async function getAgentTasks(page: number = 1, pageSize: number = 20): Promise<AgentTaskList> {
  return fetchJson(`/api/agent/tasks?page=${page}&page_size=${pageSize}`)
}

export async function submitAgentFeedback(taskId: string, feedback: 'useful' | 'not_useful'): Promise<void> {
  await fetchJson(`/api/agent/task/${taskId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ feedback }),
  })
}

export async function bookmarkAgentResult(payload: BookmarkPayload): Promise<{ title: string; tags: string[]; url: string }> {
  return fetchJson('/api/agent/bookmark', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getAgentRecommendations(): Promise<{ items: Array<{ title: string; summary: string; url: string; reason: string }>; date: string }> {
  return fetchJson('/api/agent/recommendations')
}

// ─── Voice TTS API ─────────────────────────────────────────────────────────────

export async function synthesizeSpeech(text: string, options?: { voice?: string; speed?: number; volume?: number; pitch?: number }): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/voice/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: options?.voice || '',
      speed: options?.speed ?? 50,
      volume: options?.volume ?? 60,
      pitch: options?.pitch ?? 50,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '语音合成失败' }))
    throw new Error(err.error || `语音合成失败：${res.status}`)
  }
  return res.blob()
}

export async function getTtsStatus(): Promise<{ provider: string; configured: boolean; default_voice: string; text_limit: number }> {
  return fetchJson('/api/voice/tts/status')
}

export async function getMcpServices(scope: 'all' | 'system' | 'user' = 'all'): Promise<McpService[]> {
  const data = await fetchJson<{ items: McpService[] }>(`/api/mcp/services?scope=${scope}`)
  return data.items || []
}

export async function createMcpService(payload: McpServicePayload): Promise<McpService> {
  return fetchJson('/api/mcp/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateMcpService(serviceId: string, payload: McpServicePayload): Promise<McpService> {
  try {
    return await fetchJson(`/api/mcp/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('Method Not Allowed') && !message.includes('405')) {
      throw error
    }
    return fetchJson(`/api/mcp/services/${serviceId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }
}

export async function deleteMcpService(serviceId: string): Promise<void> {
  await fetchJson(`/api/mcp/services/${serviceId}`, { method: 'DELETE' })
}

export async function testMcpService(serviceId: string): Promise<{ ok: boolean; status: string; duration_ms: number; tool_count: number; error: string }> {
  return fetchJson(`/api/mcp/services/${serviceId}/test`, { method: 'POST' })
}

export async function toggleMcpService(serviceId: string, enabled: boolean): Promise<McpService> {
  return fetchJson(`/api/mcp/services/${serviceId}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

export async function getMcpTools(serviceId: string): Promise<Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>> {
  const data = await fetchJson<{ items: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> }>(`/api/mcp/services/${serviceId}/tools`)
  return data.items || []
}

export async function callMcpTool(serviceId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  return fetchJson(`/api/mcp/services/${serviceId}/call`, {
    method: 'POST',
    body: JSON.stringify({ tool_name: toolName, args }),
  })
}

// ─── Digital Human API ─────────────────────────────────────────────────────────

export async function loadMemory(videoId: string): Promise<{
  memory_id: string
  video_id: string
  video_title: string
  greeting: string
}> {
  const data = await fetchJson<any>('/api/num-person/memory/load', {
    method: 'POST',
    body: JSON.stringify({ video_id: videoId }),
  })
  return {
    memory_id: data.memory_id,
    video_id: videoId,
    video_title: data.video_title || '',
    greeting: data.greeting || '你好！我是你的数字人学习助手，有什么可以帮你的吗？',
  }
}

export async function deleteMemory(memoryId: string): Promise<void> {
  await fetchJson(`/api/num-person/memory/${memoryId}`, { method: 'DELETE' })
}

export async function chatWithDigitalHuman(
  memoryId: string,
  message: string,
  history: Array<{ role: string; content: string }>,
  onEvent?: (evt: SseEvent) => void,
): Promise<string> {
  const events = await readSSE('/api/num-person/chat', {
    memory_id: memoryId,
    message,
    history,
  }, onEvent)
  return events
    .filter(e => e.type === 'text')
    .map(e => String(e.payload.content || ''))
    .join('')
}
