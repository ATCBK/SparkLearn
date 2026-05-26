/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Task, Resource, StudentProfile, Message, QuizQuestion,
  DashboardStats, MasteryRecord, ReportData, Recommendation,
  LearningPath, VideoInfo, ContributionDay, TutorRole, TutorConversation, TutorFile, PathNodeAdvice, PathAdjustResult, WorkshopHubEvent, ProfileUpdatePayload, KnowledgeFile, KnowledgeStats, TaskCreatePayload,
  PathPlanningData, PathPlanningSuggestion, PathPlanningResource, PathNodeSuggestionsResp, ForumPost, ForumComment, ForumAttachment, TeacherRecipient, TeacherMaterialFile, TeacherBroadcast, McpService, McpServicePayload,
} from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

type ApiResp<T> = { success: boolean; data: T; error?: string }
type SseEvent = { type: string; payload: Record<string, unknown> }

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    const json = await res.json() as ApiResp<T>
    if (!res.ok || !json.success) throw new Error(json.error || `请求失败：${res.status}`)
    return json.data
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(`无法连接到服务器 (${API_BASE})。请确保后端服务已启动。`)
    }
    throw error
  }
}

async function readSSE(
  path: string,
  body: Record<string, unknown>,
  onEvent?: (evt: SseEvent) => void,
) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  return {
    id: raw.id,
    title: raw.title,
    type: raw.type,
    status: raw.status,
    createdAt: raw.createdAt || raw.created_at,
    content: raw.content,
    sourceUrl: raw.sourceUrl || raw.source_url,
    videoUrl: raw.videoUrl || raw.video_url,
    docmeeId: raw.docmeeId || raw.docmee_id,
    progress: raw.progress,
  }
}

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
  return resources.slice(0, 3).map(toResource)
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
    major: String(p.major || '计算机科学'),
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

export async function getResources(): Promise<Resource[]> {
  const resources = await fetchJson<any[]>('/api/resources')
  return resources.map(toResource)
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

export async function generateResource(type: Resource['type'], prompt: string, knowledgeFileIds: number[] = []): Promise<Resource> {
  // 视频类型走专用生成管线
  if (type === 'video') {
    return generateVideo(prompt)
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

export async function sendMessage(
  content: string,
  options?: {
    conversationId?: number
    roleId?: number
    fileIds?: number[]
    mode?: string
    workshopEnabled?: boolean
    workshopRoleIds?: number[]
    pageContext?: Record<string, unknown>
  },
  handlers?: {
    onText?: (chunk: string) => void
    onError?: (error: { code?: number; message?: string; sid?: string }) => void
    onHub?: (evt: WorkshopHubEvent) => void
    onWorkshopPhase?: (evt: { phase: string; round?: number; status: string }) => void
    onDone?: () => void
  },
): Promise<Message> {
  let lastError: string | undefined
  const events = await readSSE('/api/tutor/chat', {
    message: content,
    mode: options?.mode || 'knowledge_qa',
    conversation_id: options?.conversationId,
    role_id: options?.roleId,
    file_ids: options?.fileIds || [],
    workshop_enabled: Boolean(options?.workshopEnabled),
    workshop_role_ids: options?.workshopRoleIds || [],
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
    if (evt.type === 'done') handlers?.onDone?.()
  })
  const text = events.filter(e => e.type === 'text').map(e => String(e.payload.content || '')).join('')
  if (!text && lastError) throw new Error(lastError)
  return {
    id: `m-${Date.now()}`,
    role: 'assistant',
    content: text || '我已收到你的问题，我们继续一起拆解。',
    timestamp: new Date().toISOString(),
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
  return (json.data || []).map(f => ({
    id: Number(f.id),
    filename: String(f.filename || ''),
    mimeType: String(f.mime_type || ''),
    sizeBytes: Number(f.size_bytes || 0),
  }))
}

export async function getTutorFiles(): Promise<TutorFile[]> {
  const data = await fetchJson<any[]>('/api/tutor/files')
  return (data || []).map(f => ({
    id: Number(f.id),
    filename: String(f.filename || ''),
    mimeType: String(f.mime_type || ''),
    sizeBytes: Number(f.size_bytes || 0),
  }))
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

export async function getKnowledgeFiles(params?: { status?: string; search?: string }): Promise<KnowledgeFile[]> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.search) query.set('search', params.search)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const data = await fetchJson<any[]>(`/api/knowledge/files${suffix}`)
  return data.map(toKnowledgeFile)
}

export async function uploadKnowledgeFiles(files: File[]): Promise<KnowledgeFile[]> {
  const form = new FormData()
  files.forEach(file => form.append('files', file))
  const res = await fetch(`${API_BASE}/api/knowledge/files`, { method: 'POST', body: form })
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

export async function deleteForumPost(postId: number): Promise<void> {
  await fetchJson(`/api/forum/posts/${postId}`, { method: 'DELETE' })
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
  const res = await fetch(`${API_BASE}/api/forum/posts/${postId}/attachments`, { method: 'POST', body: form })
  const json = await res.json() as ApiResp<ForumAttachment[]>
  if (!res.ok || !json.success) throw new Error(json.error || `上传失败: ${res.status}`)
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

export async function polishVideoPrompt(prompt: string, durationSec: number = 90): Promise<{
  polishId: string
  title: string
  polishedPrompt: string
  scriptOutline: Array<{ segment_id: string; title: string; narration: string; visual_hint: string; duration_ms?: number }>
  estimatedDurationSec: number
  voice: string
}> {
  const data = await fetchJson<any>('/api/video/polish', {
    method: 'POST',
    body: JSON.stringify({ prompt, duration_sec: durationSec }),
  })
  return {
    polishId: data.polish_id,
    title: data.title,
    polishedPrompt: data.polished_prompt,
    scriptOutline: data.script_outline || [],
    estimatedDurationSec: data.estimated_duration_sec || durationSec,
    voice: data.voice || '',
  }
}

export async function generateVideo(
  prompt: string,
  onEvent?: (evt: { type: string; payload: Record<string, unknown> }) => void,
): Promise<Resource> {
  // Step 1: Polish the prompt into a script
  const polish = await polishVideoPrompt(prompt)

  // Step 2: Create a video generation job
  const job = await fetchJson<any>('/api/video/jobs', {
    method: 'POST',
    body: JSON.stringify({
      polish_id: polish.polishId,
      prompt: polish.polishedPrompt,
      title: polish.title,
      script_outline: polish.scriptOutline,
      video_provider: 'html_ppt',
    }),
  })

  const jobId = job.job_id
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
  return fetchJson(`/api/mcp/services/${serviceId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
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
