'use client'

import { useEffect, useMemo, useRef, useState, useCallback, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { api, A2UIEnvelope, A2UISurfaceState, AGUIEvent, CitationItem, ConfidenceInfo, Message, Resource, SearchResultItem, StudentProfile, TutorConversation, TutorFile, TutorRole, WorkshopHubEvent } from '@/lib/api'
import { ErrorState } from '@/components/ui/ErrorState'
import { A2UITaskCards, type A2UITaskAction, type A2UITaskCard } from '@/components/a2ui/A2UITaskCards'
import { AgentTimeline } from '@/components/agui/AgentTimeline'
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Clapperboard,
  FileText,
  Globe,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  Paperclip,
  Pause,
  Pencil,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserCog,
  Volume2,
  X,
  ArrowLeft,
  Image as ImageIcon,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { getToken, userScopedStorageKey } from '@/lib/auth'
import { addCustomSkill, getSkillById, LEARNING_SKILLS, markdownToSkill, readCustomSkills, selectedSkillStorageKey, type LearningSkill } from '@/lib/skills'
import { matchPersonalizedNotes, readLearningNotes, tokenizeLearningText, type LearningNote } from '@/lib/learningNotes'
import { TutorUserBadge } from '@/components/tutor/TutorUserBadge'
import { NewUserGuidePanel } from '@/components/onboarding/NewUserGuidePanel'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type RoleDraft = {
  name: string
  persona: string
  background: string
  styleGuide: string
  rules: string
}

const EMPTY_ROLE_DRAFT: RoleDraft = {
  name: '',
  persona: '',
  background: '',
  styleGuide: '',
  rules: '',
}
const PENDING_ROLE_ID_KEY = 'sparklearn_pending_tutor_role_id'
const A2UI_AUTH_GUARDED_HREFS = ['/knowledge', '/practice', '/video', '/generate', '/path', '/report']

function pendingRoleIdStorageKey() {
  return userScopedStorageKey(PENDING_ROLE_ID_KEY)
}

type RoleModalMode = 'create' | 'edit'

type WorkshopSummary = {
  optimizedQuestion: string
  coreConclusion: string
  steps: string[]
  followUps: string[]
}

type McpCallView = {
  serviceId: string
  serviceName: string
  toolName: string
  status: string
  ok: boolean
  error?: string
  args?: Record<string, unknown>
  resultPreview?: string
  resultContext?: string
}

type MatchedGeneratedResource = {
  resource: Resource
  score: number
  keywords: string[]
}

const RESOURCE_RECOMMENDATION_TERMS = [
  '推荐',
  '资源',
  '资料',
  '内容',
  '复习',
  '预习',
  '学习',
  '课程',
  '任务',
  '练习',
  '课件',
  '文档',
  '视频',
  '测验',
  'resource',
  'recommend',
  'review',
]

const resourceTypeLabel: Record<Resource['type'], string> = {
  document: '文档',
  ppt: '课件',
  mindmap: '思维导图',
  quiz: '测验',
  reading: '阅读',
  code: '代码',
  video: '视频',
  blog: '博客',
  discovery: '学习发现',
  web_material: '网页资料',
}

function applyA2UIEnvelopeToSurfaces(surfaces: A2UISurfaceState[] = [], envelope: A2UIEnvelope): A2UISurfaceState[] {
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

function appendAGUIEvent(events: AGUIEvent[] = [], event: AGUIEvent): AGUIEvent[] {
  return [...events, event]
}

function normalizeMcpCallViews(calls: Array<Record<string, unknown>>): McpCallView[] {
  return calls.map((x) => ({
    serviceId: String(x.service_id || x.serviceId || ''),
    serviceName: String(x.service_name || x.serviceName || x.service_id || x.serviceId || ''),
    toolName: String(x.tool_name || x.toolName || ''),
    status: String(x.status || 'done'),
    ok: x.ok !== undefined ? Boolean(x.ok) : true,
    error: String(x.error || ''),
    args: x.args && typeof x.args === 'object' && !Array.isArray(x.args) ? x.args as Record<string, unknown> : undefined,
    resultPreview: String(x.result_preview || x.resultPreview || ''),
    resultContext: String(x.result_context || x.resultContext || ''),
  })).filter((x) => x.toolName)
}

function mcpCallToAGUIEvents(call: McpCallView, assistantId: string): AGUIEvent[] {
  const toolName = call.toolName || 'unknown_tool'
  const safeToolId = `${call.serviceId || 'mcp'}-${toolName}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  const stepId = toolName === 'tools/list' ? `mcp_discovery_${call.serviceId || 'default'}` : `mcp_tool_${safeToolId}`
  const toolCallId = `${assistantId}-${stepId}`
  const runId = `sparklearn-tutor-${assistantId}`
  const isDiscovery = toolName === 'tools/list'
  const title = isDiscovery ? `发现 MCP 工具：${call.serviceName || 'MCP 服务'}` : `调用 MCP 工具：${toolName}`
  const events: AGUIEvent[] = []

  if (call.status === 'discovering' || call.status === 'running') {
    events.push({
      type: 'StepStarted',
      runId,
      stepId,
      title,
      summary: isDiscovery ? '正在读取服务工具列表' : '正在执行真实 MCP 工具调用',
      timestamp: new Date().toISOString(),
    })
    events.push({
      type: 'ToolCallStart',
      runId,
      stepId,
      toolCallId,
      toolName,
      label: title,
      timestamp: new Date().toISOString(),
    })
    if (call.args && Object.keys(call.args).length > 0) {
      events.push({
        type: 'ToolCallArgs',
        runId,
        stepId,
        toolCallId,
        args: call.args,
        timestamp: new Date().toISOString(),
      })
    }
    return events
  }

  events.push({
    type: 'StepStarted',
    runId,
    stepId,
    title,
    summary: isDiscovery ? '读取 MCP 服务工具列表' : '执行真实 MCP 工具调用',
    timestamp: new Date().toISOString(),
  })
  events.push({
    type: 'ToolCallResult',
    runId,
    stepId,
    toolCallId,
    toolName,
    status: call.status === 'error' || !call.ok ? 'error' : 'done',
    summary: call.error || call.resultPreview || (isDiscovery ? '工具列表读取完成' : '工具调用完成'),
    data: {
      service: call.serviceName,
      tool: toolName,
      status: call.status,
      ok: call.ok,
      error: call.error || '',
      result_preview: call.resultPreview || '',
    },
    timestamp: new Date().toISOString(),
  })
  events.push({
    type: 'StepFinished',
    runId,
    stepId,
    status: call.status === 'error' || !call.ok ? 'error' : 'done',
    summary: call.error || (isDiscovery ? 'MCP 工具发现完成' : 'MCP 工具调用完成'),
    timestamp: new Date().toISOString(),
  })
  return events
}

function appendAGUIEventsToMessage(messageId: string, events: AGUIEvent[], setMessages: Dispatch<SetStateAction<Message[]>>) {
  if (events.length === 0) return
  setMessages((prev) => prev.map((m) => (
    m.id === messageId
      ? { ...m, aguiEvents: events.reduce((items, event) => appendAGUIEvent(items, event), m.aguiEvents || []) }
      : m
  )))
}

function videoEventToAGUIEvents(
  evt: { type: string; payload: Record<string, unknown> },
  assistantId: string,
  prompt: string,
): AGUIEvent[] {
  const runId = `sparklearn-video-${assistantId}`
  const stepId = 'video_generation'
  const toolCallId = `${assistantId}-video-generation`
  const now = new Date().toISOString()
  if (evt.type === 'progress') {
    const stage = String(evt.payload.stage || 'video_generation')
    const progress = Number(evt.payload.progress ?? 0)
    return [
      {
        type: 'StepStarted',
        runId,
        stepId,
        title: '视频生成',
        summary: `正在执行 ${stage}${Number.isFinite(progress) ? ` · ${Math.round(progress)}%` : ''}`,
        timestamp: now,
      },
      {
        type: 'ToolCallStart',
        runId,
        stepId,
        toolCallId,
        toolName: 'video_generator',
        label: '视频生成',
        timestamp: now,
      },
      {
        type: 'ToolCallArgs',
        runId,
        stepId,
        toolCallId,
        args: { prompt },
        timestamp: now,
      },
      {
        type: 'StateDelta',
        runId,
        stepId,
        delta: { stage, progress },
        summary: `进度 ${Number.isFinite(progress) ? Math.round(progress) : 0}%`,
        timestamp: now,
      },
    ]
  }
  if (evt.type === 'artifact') {
    return [
      {
        type: 'ToolCallResult',
        runId,
        stepId,
        toolCallId,
        toolName: 'video_generator',
        status: 'done',
        summary: `已生成 ${String(evt.payload.kind || 'artifact')}`,
        data: { kind: evt.payload.kind || '', url: evt.payload.url || '' },
        timestamp: now,
      },
    ]
  }
  if (evt.type === 'error') {
    return [
      {
        type: 'ToolCallResult',
        runId,
        stepId,
        toolCallId,
        toolName: 'video_generator',
        status: 'error',
        summary: String(evt.payload.message || '视频生成失败'),
        data: { message: evt.payload.message || '' },
        timestamp: now,
      },
      {
        type: 'StepFinished',
        runId,
        stepId,
        status: 'error',
        summary: String(evt.payload.message || '视频生成失败'),
        timestamp: now,
      },
    ]
  }
  return []
}

function buildVideoFinishedAGUIEvents(assistantId: string, resource: Resource): AGUIEvent[] {
  const runId = `sparklearn-video-${assistantId}`
  const stepId = 'video_generation'
  const toolCallId = `${assistantId}-video-generation`
  const now = new Date().toISOString()
  return [
    {
      type: 'ToolCallResult',
      runId,
      stepId,
      toolCallId,
      toolName: 'video_generator',
      status: 'done',
      summary: '视频生成完成',
      data: {
        id: resource.id,
        title: resource.title,
        hasMp4: resource.hasMp4,
        videoUrl: resource.videoUrl || '',
        sceneUrl: resource.sceneUrl || '',
      },
      timestamp: now,
    },
    {
      type: 'StepFinished',
      runId,
      stepId,
      status: 'done',
      summary: '视频生成完成',
      timestamp: now,
    },
    {
      type: 'RunFinished',
      runId,
      status: 'done',
      summary: '视频生成流程完成',
      timestamp: now,
    },
  ]
}

function isResourceRecommendationQuery(text: string) {
  const normalized = text.toLowerCase()
  return RESOURCE_RECOMMENDATION_TERMS.some((term) => normalized.includes(term))
}

function shouldExpectA2UIPanel(text: string) {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false
  return [
    '任务卡',
    '学习任务',
    '学习计划',
    '安排',
    '计划',
    '本周',
    '今日',
    'todo',
    'task',
  ].some((term) => normalized.includes(term))
}

function buildResourceSearchText(resource: Resource) {
  const schemaText = resource.pptSchema
    ? JSON.stringify(resource.pptSchema).slice(0, 600)
    : ''
  return [
    resource.title,
    resourceTypeLabel[resource.type],
    resource.content,
    schemaText,
    resource.provider,
    resource.sourceUrl,
  ].filter(Boolean).join(' ')
}

function matchGeneratedResources(resources: Resource[], query: string, limit = 5): MatchedGeneratedResource[] {
  const completed = resources.filter((resource) => resource.status === 'completed')
  if (completed.length === 0) return []

  const queryTokens = tokenizeLearningText(query)
  const shouldIncludeRecent = isResourceRecommendationQuery(query)

  return completed
    .map((resource) => {
      const resourceText = buildResourceSearchText(resource)
      const normalizedResourceText = resourceText.toLowerCase()
      const resourceTokens = tokenizeLearningText(resourceText)
      const matched = queryTokens.filter((token) => resourceTokens.includes(token) || normalizedResourceText.includes(token))
      const titleBoost = resource.title && query.includes(resource.title) ? 4 : 0
      const typeBoost = query.includes(resourceTypeLabel[resource.type]) ? 2 : 0
      return {
        resource,
        score: matched.length + titleBoost + typeBoost,
        keywords: [...new Set(matched.slice(0, 6))],
      }
    })
    .filter((item) => item.score > 0 || shouldIncludeRecent)
    .sort((a, b) => b.score - a.score || new Date(b.resource.createdAt).getTime() - new Date(a.resource.createdAt).getTime())
    .slice(0, limit)
}

function parseWorkshopSummary(content: string): WorkshopSummary | null {
  const text = (content || '').replace(/\r/g, '').trim()
  if (!text.includes('核心结论') || !text.includes('分步行动清单') || !text.includes('可追问问题')) return null

  const full = text
  const headIdx = {
    q: full.indexOf('优化后问题'),
    c: full.indexOf('核心结论'),
    s: full.indexOf('分步行动清单'),
    f: full.indexOf('可追问问题'),
  }
  if (headIdx.c < 0 || headIdx.s < 0 || headIdx.f < 0) return null

  const getSection = (start: number, end: number, head: string) => {
    if (start < 0 || end <= start) return ''
    const raw = full.slice(start + head.length, end).trim()
    return raw.replace(/^[:：\-\s]+/, '').trim()
  }

  const qEnd = headIdx.c >= 0 ? headIdx.c : headIdx.s
  const optimizedQuestion = headIdx.q >= 0 ? getSection(headIdx.q, qEnd, '优化后问题') : ''
  const coreConclusion = getSection(headIdx.c, headIdx.s, '核心结论')
  const stepsRaw = getSection(headIdx.s, headIdx.f, '分步行动清单')
  const followRaw = full.slice(headIdx.f + '可追问问题'.length).replace(/^\(\d+条\)/, '').replace(/^[:：-\s]+/, '').trim()

  const splitToItems = (raw: string) => {
    if (!raw) return []
    const byLine = raw.split('\n').map((x) => x.trim()).filter(Boolean)
    if (byLine.length > 1) {
      return byLine
        .map((x) => x.replace(/^[\-*\d]+\s*[.)、]?\s*/, '').trim())
        .filter(Boolean)
    }
    const oneLine = byLine[0] || raw.trim()
    return oneLine
      .split(/\s+(?=[a-zA-Z]\.)|\s+(?=\d+[.)、])/g)
      .map((x) => x.replace(/^[\-\*\dA-Za-z]+\s*[\.\)、]?\s*/, '').trim())
      .filter(Boolean)
  }

  const steps = splitToItems(stepsRaw)
  const followUps = splitToItems(followRaw)

  if (!optimizedQuestion && !coreConclusion && steps.length === 0 && followUps.length === 0) return null
  return { optimizedQuestion, coreConclusion, steps, followUps }
}

type ProfileLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

type SpeechRecognitionResultEventLike = {
  results: {
    length: number
    [index: number]: {
      [index: number]: {
        transcript: string
      }
    }
  }
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

function buildProfileSummary(profile: StudentProfile | null) {
  const weakPoints = profile?.weakPoints?.filter(Boolean).slice(0, 3)
  const preferences = profile?.learningPreference?.filter(Boolean).slice(0, 3)
  const goals = profile?.goals?.filter(Boolean).slice(0, 2)
  return {
    name: profile?.name || '学习者',
    stage: profile?.currentStage || profile?.knowledgeLevel || '待分析',
    weakPoints: weakPoints?.length ? weakPoints.join('、') : '暂无明显薄弱点',
    preferences: preferences?.length ? preferences.join('、') : '按当前任务动态适配',
    goals: goals?.length ? goals.join('、') : '根据本次对话动态确认',
    dailyTime: profile?.dailyTime ? `${profile.dailyTime} 分钟/天` : '待确认',
  }
}

function ProfileMessageCard({
  profile,
  status,
}: {
  profile: StudentProfile | null
  status: ProfileLoadStatus
}) {
  const summary = buildProfileSummary(profile)
  const isRunning = ['loading', 'idle', 'running', 'pending', 'discovering'].includes(status)
  const isError = status === 'error'
  const statusText = isRunning ? '执行中' : isError ? '失败' : '完成'
  const detailText = isRunning
    ? '正在准备个性化学习上下文'
    : isError
      ? '暂未同步画像，将按本次问题继续回答'
      : `${summary.name} · ${summary.stage} · ${summary.dailyTime}`

  return (
    <div className="flex gap-3 mb-6">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa]">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        {isRunning && (
          <div className="mb-3 -ml-1">
            <LoadingDotsBubble />
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-[#e0e7f5] bg-[#fafcff] shadow-[0_2px_8px_rgba(37,99,235,0.04)]">
          <div className="flex items-center gap-2 border-b border-[#eef2f8] bg-[#f4f8ff] px-3.5 py-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#e6eeff] text-[#4f6bf6]">
              <Cpu className="h-3 w-3" />
            </div>
            <span className="text-xs font-semibold text-[#1e293b]">学生画像加载</span>
            <span className={cn(
              'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              isRunning && 'bg-[#eef4ff] text-[#4f6bf6]',
              isError && 'bg-rose-50 text-rose-600',
              !isRunning && !isError && 'bg-emerald-50 text-emerald-600',
            )}>
              {isRunning && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4f6bf6]" />}
              {statusText}
            </span>
          </div>
          <div className="px-1">
            <div className={cn('flex items-center gap-3 px-2.5 py-2.5 transition-colors', isRunning && 'bg-[#f8fbff]')}>
              <div className="flex flex-col items-center gap-0.5">
                <div className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full',
                  isRunning && 'bg-[#e6eeff] text-[#4f6bf6]',
                  isError && 'bg-rose-50 text-rose-500',
                  !isRunning && !isError && 'bg-emerald-50 text-emerald-500',
                )}>
                  {isRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isError ? (
                    <X className="h-3 w-3" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-[#1e293b]">
                      {isRunning ? '正在同步学习画像' : isError ? '画像同步未完成' : '学习画像已同步'}
                    </span>
                  </div>
                  <div className={cn('mt-0.5 truncate text-[10px]', isError ? 'text-rose-500' : 'text-[#64748b]')}>
                    {detailText}
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                  isRunning && 'bg-amber-50 text-amber-600',
                  isError && 'bg-rose-50 text-rose-600',
                  !isRunning && !isError && 'bg-emerald-50 text-emerald-600',
                )}>
                  {isRunning && <span className="h-1 w-1 animate-pulse rounded-full bg-amber-500" />}
                  {statusText}
                </span>
              </div>
            </div>
            {!isRunning && !isError && (
              <div className="border-t border-[#eef2f8] px-3 py-2 text-[11px] leading-5 text-[#64748b]">
                <span className="text-[#334155]">薄弱点：</span>{summary.weakPoints}
                <span className="mx-2 text-[#cbd5e1]">/</span>
                <span className="text-[#334155]">偏好：</span>{summary.preferences}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function skillToneClass(tone: LearningSkill['tone']) {
  const tones: Record<LearningSkill['tone'], string> = {
    blue: 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
    green: 'border-[#bbf7d0] bg-[#ecfdf5] text-[#059669]',
    orange: 'border-[#fed7aa] bg-[#fff7ed] text-[#d97706]',
    purple: 'border-[#ddd6fe] bg-[#f5f3ff] text-[#7c3aed]',
    cyan: 'border-[#a5f3fc] bg-[#ecfeff] text-[#0891b2]',
    red: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  }
  return tones[tone]
}

function LoadingDotsBubble({ className = '' }: { className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="h-2 w-2 animate-bounce rounded-full bg-[#cbd5e1]" style={{ animationDelay: '0ms' }} />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[#cbd5e1]" style={{ animationDelay: '140ms' }} />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[#cbd5e1]" style={{ animationDelay: '280ms' }} />
    </div>
  )
}

export default function TutorPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<TutorConversation[]>([])
  const [roles, setRoles] = useState<TutorRole[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null)
  const [currentRoleId, setCurrentRoleId] = useState<number | null>(null)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [pendingFiles, setPendingFiles] = useState<TutorFile[]>([])
  const [renamingConversationId, setRenamingConversationId] = useState<number | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  const [workshopEnabled] = useState(false)
  const [openMode, setOpenMode] = useState(true)
  const [multimodalMode, setMultimodalMode] = useState<'image' | 'video' | null>(null)
  const [multimodalMenuOpen, setMultimodalMenuOpen] = useState(false)
  const [knowledgeReverse, setKnowledgeReverse] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [mcpEnabled, setMcpEnabled] = useState(false)
  const [selectedModel, setSelectedModel] = useState('lite')
  const [videoVoice, setVideoVoice] = useState('')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [workshopRoleIds, setWorkshopRoleIds] = useState<number[]>([])
  const [hubMessages, setHubMessages] = useState<WorkshopHubEvent[]>([])
  const [, setWorkshopPhase] = useState<{ phase: string; round?: number; status: string } | null>(null)
  const [workshopRunId, setWorkshopRunId] = useState(0)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [roleModalMode] = useState<RoleModalMode>('create')
  const [roleEditingId] = useState<number | null>(null)
  const [roleDraft, setRoleDraft] = useState<RoleDraft>(EMPTY_ROLE_DRAFT)
  const [savingRole, setSavingRole] = useState(false)
  const [trustPanelOpenByMsg, setTrustPanelOpenByMsg] = useState<Record<string, boolean>>({})
  const [mcpCallsByMsg, setMcpCallsByMsg] = useState<Record<string, McpCallView[]>>({})
  const [searchResultsByMsg, setSearchResultsByMsg] = useState<Record<string, SearchResultItem[]>>({})
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [profileStatus, setProfileStatus] = useState<ProfileLoadStatus>('idle')
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [skillStoreOpen, setSkillStoreOpen] = useState(false)
  const [skillPickerOpen, setSkillPickerOpen] = useState(false)
  const [skillSearch, setSkillSearch] = useState('')
  const [customSkills, setCustomSkills] = useState<LearningSkill[]>([])
  const [skillImportNotice, setSkillImportNotice] = useState('')
  const [learningNotes, setLearningNotes] = useState<LearningNote[]>([])
  const [generatedResources, setGeneratedResources] = useState<Resource[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const skillImportInputRef = useRef<HTMLInputElement>(null)
  const messageScrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const autoFollowRef = useRef(true)
  const profilePromiseRef = useRef<Promise<StudentProfile | null> | null>(null)
  const [autoFollowMessages, setAutoFollowMessages] = useState(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)

  // TTS playback
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null)
  const [ttsLoading, setTtsLoading] = useState<string | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsBlobUrlRef = useRef<string | null>(null)

  // Voice input
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const voiceBaseRef = useRef<string>('')

  const playTts = useCallback(async (msgId: string, text: string, audioUrl?: string) => {
    if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null }
    if (ttsBlobUrlRef.current) { URL.revokeObjectURL(ttsBlobUrlRef.current); ttsBlobUrlRef.current = null }
    if (playingMsgId === msgId) { setPlayingMsgId(null); return }
    setTtsLoading(msgId)
    try {
      const url = audioUrl || URL.createObjectURL(await api.synthesizeSpeech(text.replace(/[#*`>\-|[\]()]/g, '').slice(0, 2000)))
      if (!audioUrl) {
        ttsBlobUrlRef.current = url
      }
      const audio = new Audio(url)
      audio.preload = 'auto'
      ttsAudioRef.current = audio
      audio.addEventListener('ended', () => setPlayingMsgId(null))
      audio.addEventListener('error', () => setPlayingMsgId(null))
      await audio.play()
      setPlayingMsgId(msgId)
    } catch { /* TTS failed */ }
    finally { setTtsLoading(null) }
  }, [playingMsgId])

  const toggleVoiceInput = useCallback(() => {
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return }
    const speechWindow = window as SpeechRecognitionWindow
    const SR = (speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition) as SpeechRecognitionConstructor | undefined
    if (!SR) { alert('当前浏览器不支持语音识别，请使用 Chrome。'); return }
    const recognition = new SR()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    voiceBaseRef.current = input
    recognition.onresult = (event) => {
      let t = ''
      for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript
      setInput(voiceBaseRef.current ? voiceBaseRef.current + t : t)
    }
    recognition.onend = () => setRecording(false)
    recognition.onerror = () => setRecording(false)
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }, [recording, input])

  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === currentConversationId) || null,
    [conversations, currentConversationId],
  )

  const currentRole = useMemo(
    () => roles.find((r) => r.id === currentRoleId) || null,
    [roles, currentRoleId],
  )

  const skillLibrary = useMemo(() => [...customSkills, ...LEARNING_SKILLS], [customSkills])
  const selectedSkill = useMemo(() => getSkillById(selectedSkillId, skillLibrary), [selectedSkillId, skillLibrary])
  const configuredSkills = useMemo(() => {
    const keyword = skillSearch.trim().toLowerCase()
    if (!keyword) return skillLibrary
    return skillLibrary.filter((skill) => {
      const haystack = `${skill.title} ${skill.shortTitle} ${skill.category} ${skill.summary} ${skill.output}`.toLowerCase()
      return haystack.includes(keyword)
    })
  }, [skillLibrary, skillSearch])
  const hasInteracted = messages.length > 0

  const isMessagesNearBottom = useCallback(() => {
    const scroller = messageScrollRef.current
    if (!scroller) return true
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 96
  }, [])

  const scrollToLatestMessage = useCallback((behavior: ScrollBehavior = 'smooth') => {
    autoFollowRef.current = true
    setAutoFollowMessages(true)
    setShowJumpToLatest(false)
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
    })
  }, [])

  const handleMessagesScroll = useCallback(() => {
    const nearBottom = isMessagesNearBottom()
    autoFollowRef.current = nearBottom
    setAutoFollowMessages(nearBottom)
    setShowJumpToLatest(!nearBottom)
  }, [isMessagesNearBottom])

  useEffect(() => {
    setSelectedSkillId(localStorage.getItem(selectedSkillStorageKey()) || '')
    setCustomSkills(readCustomSkills())
  }, [])

  useEffect(() => {
    const refreshCustomSkills = () => setCustomSkills(readCustomSkills())
    window.addEventListener('sparklearn-custom-skills-updated', refreshCustomSkills)
    window.addEventListener('storage', refreshCustomSkills)
    return () => {
      window.removeEventListener('sparklearn-custom-skills-updated', refreshCustomSkills)
      window.removeEventListener('storage', refreshCustomSkills)
    }
  }, [])

  useEffect(() => {
    const loadNotes = () => setLearningNotes(readLearningNotes())
    const loadNotesWhenVisible = () => {
      if (document.visibilityState === 'visible') loadNotes()
    }
    loadNotes()
    window.addEventListener('learning-notes-updated', loadNotes)
    window.addEventListener('storage', loadNotes)
    window.addEventListener('focus', loadNotes)
    window.addEventListener('pageshow', loadNotes)
    document.addEventListener('visibilitychange', loadNotesWhenVisible)
    return () => {
      window.removeEventListener('learning-notes-updated', loadNotes)
      window.removeEventListener('storage', loadNotes)
      window.removeEventListener('focus', loadNotes)
      window.removeEventListener('pageshow', loadNotes)
      document.removeEventListener('visibilitychange', loadNotesWhenVisible)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.getTtsStatus()
      .then((status) => {
        if (!cancelled) setVideoVoice(String(status.default_voice || ''))
      })
      .catch(() => {
        if (!cancelled) setVideoVoice('')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadGeneratedResources = () => {
      api.getResources()
        .then((resources) => {
          if (!cancelled) setGeneratedResources(resources)
        })
        .catch(() => {
          if (!cancelled) setGeneratedResources((prev) => prev)
        })
    }
    const loadGeneratedResourcesWhenVisible = () => {
      if (document.visibilityState === 'visible') loadGeneratedResources()
    }
    loadGeneratedResources()
    window.addEventListener('focus', loadGeneratedResources)
    window.addEventListener('pageshow', loadGeneratedResources)
    document.addEventListener('visibilitychange', loadGeneratedResourcesWhenVisible)
    return () => {
      cancelled = true
      window.removeEventListener('focus', loadGeneratedResources)
      window.removeEventListener('pageshow', loadGeneratedResources)
      document.removeEventListener('visibilitychange', loadGeneratedResourcesWhenVisible)
    }
  }, [])

  function chooseSkill(skillId: string) {
    const nextId = selectedSkillId === skillId ? '' : skillId
    setSelectedSkillId(nextId)
    setSkillPickerOpen(false)
    if (nextId) {
      localStorage.setItem(selectedSkillStorageKey(), nextId)
    } else {
      localStorage.removeItem(selectedSkillStorageKey())
    }
  }

  function hydrateMessageSidecars(items: Message[]) {
    const nextMcp: Record<string, McpCallView[]> = {}
    const nextSearch: Record<string, SearchResultItem[]> = {}
    for (const msg of items) {
      if (msg.role !== 'assistant') continue
      const calls = Array.isArray(msg.mcpCalls) ? msg.mcpCalls : []
      if (calls.length > 0) {
        nextMcp[msg.id] = normalizeMcpCallViews(calls)
      }
      if (Array.isArray(msg.searchResults) && msg.searchResults.length > 0) {
        nextSearch[msg.id] = msg.searchResults
      }
    }
    setMcpCallsByMsg(nextMcp)
    setSearchResultsByMsg(nextSearch)
  }

  function setHydratedMessages(items: Message[]) {
    autoFollowRef.current = true
    setAutoFollowMessages(true)
    setShowJumpToLatest(false)
    setMessages(items.map((msg) => {
      if (msg.role !== 'assistant' || !Array.isArray(msg.mcpCalls) || msg.mcpCalls.length === 0) return msg
      const mcpEvents = normalizeMcpCallViews(msg.mcpCalls).flatMap((call) => mcpCallToAGUIEvents(call, msg.id))
      if (mcpEvents.length === 0) return msg
      return {
        ...msg,
        aguiEvents: [...(msg.aguiEvents || []), ...mcpEvents],
      }
    }))
    hydrateMessageSidecars(items)
  }

  function hydrateRoleDraft(role: TutorRole | null) {
    if (!role) {
      setRoleDraft(EMPTY_ROLE_DRAFT)
      return
    }
    setRoleDraft({
      name: role.name,
      persona: role.persona,
      background: role.background,
      styleGuide: role.styleGuide,
      rules: role.rules,
    })
  }

  const loadStudentProfile = useCallback(() => {
    if (studentProfile) return Promise.resolve(studentProfile)
    if (profilePromiseRef.current) return profilePromiseRef.current
    setProfileStatus('loading')
    profilePromiseRef.current = api.getProfile()
      .then((profile) => {
        setStudentProfile(profile)
        setProfileStatus('ready')
        return profile
      })
      .catch(() => {
        setProfileStatus('error')
        return null
      })
      .finally(() => {
        profilePromiseRef.current = null
      })
    return profilePromiseRef.current
  }, [studentProfile])

  async function refreshConversations(nextCurrentId?: number | null) {
    const refreshed = await api.getTutorConversations()
    setConversations(refreshed)
    const targetId = nextCurrentId ?? currentConversationId
    if (!targetId) return

    const exists = refreshed.some((c) => c.id === targetId)
    if (!exists) {
      const fallback = refreshed[0] || null
      setCurrentConversationId(fallback?.id ?? null)
      if (fallback) {
        const history = await api.getChatHistory(fallback.id)
        setHydratedMessages(history)
      } else {
        setHydratedMessages([])
      }
    }
  }

  async function loadWorkspace() {
    try {
      setLoading(true)
      setError(null)
      const [roleData, convData] = await Promise.all([api.getTutorRoles(), api.getTutorConversations()])
      setRoles(roleData)
      setConversations(convData)

      const selectedConversation = convData[0] || null
      const selectedRoleId = selectedConversation?.roleId ?? roleData[0]?.id ?? null

      setCurrentConversationId(selectedConversation?.id ?? null)
      setCurrentRoleId(selectedRoleId)
      hydrateRoleDraft(roleData.find((r) => r.id === selectedRoleId) || null)
      setHydratedMessages([])

      if (selectedConversation) {
        try {
          const history = await api.getChatHistory(selectedConversation.id)
          setHydratedMessages(history)
        } catch (e) {
          setActionError(e instanceof Error ? e.message : '加载历史消息失败')
        }
      }

      const pendingRoleId = Number(globalThis.localStorage?.getItem(pendingRoleIdStorageKey()) || 0)
      if (pendingRoleId > 0) {
        globalThis.localStorage?.removeItem(pendingRoleIdStorageKey())
        const pendingRole = roleData.find((role) => role.id === pendingRoleId) || null
        if (pendingRole) {
          if (selectedConversation) {
            const updatedConversation = await api.updateTutorConversation(selectedConversation.id, { roleId: pendingRoleId })
            const refreshedConversations = convData.map((item) => (item.id === updatedConversation.id ? updatedConversation : item))
            setConversations(refreshedConversations)
            setCurrentConversationId(updatedConversation.id)
          } else {
            const createdConversation = await api.createTutorConversation({ title: '新对话', roleId: pendingRoleId })
            setConversations([createdConversation])
            setCurrentConversationId(createdConversation.id)
            setHydratedMessages([])
          }
          setCurrentRoleId(pendingRoleId)
          hydrateRoleDraft(pendingRole)
        }
      }

      setLoading(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWorkspace()
    // 只在首次进入导师页时初始化工作区；依赖当前对话状态会导致切换会话时重复拉取并覆盖本地草稿。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (autoFollowRef.current) {
      scrollToLatestMessage('smooth')
      return
    }
    setShowJumpToLatest(true)
  }, [messages, scrollToLatestMessage])

  useEffect(() => {
    if (!currentRoleId) return
    setWorkshopRoleIds((prev) => (prev.length > 0 ? prev : [currentRoleId]))
  }, [currentRoleId])

  async function switchConversation(conversation: TutorConversation) {
    try {
      setActionError(null)
      setSkillStoreOpen(false)
      setCurrentConversationId(conversation.id)
      setHubMessages([])
      setWorkshopPhase(null)
      setPendingFiles([])
      const history = await api.getChatHistory(conversation.id)
      setHydratedMessages(history)

      if (conversation.roleId) {
        setCurrentRoleId(conversation.roleId)
        hydrateRoleDraft(roles.find((r) => r.id === conversation.roleId) || null)
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '切换会话失败，请检查后端服务')
    }
  }

  async function handleCreateConversation() {
    try {
      setActionError(null)
      setSkillStoreOpen(false)
      const created = await api.createTutorConversation({ title: '新对话', roleId: currentRoleId || undefined })
      setConversations((prev) => [created, ...prev])
      await switchConversation(created)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '创建会话失败，请检查后端服务')
    }
  }

  async function handleDeleteConversation(conversationId: number) {
    try {
      setActionError(null)
      await api.deleteTutorConversation(conversationId)
      await refreshConversations()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除会话失败，请检查后端服务')
    }
  }

  async function handleRenameConversation(conversationId: number) {
    const title = renameTitle.trim()
    if (!title) return
    try {
      setActionError(null)
      await api.updateTutorConversation(conversationId, { title })
      setRenamingConversationId(null)
      setRenameTitle('')
      await refreshConversations(conversationId)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '重命名会话失败，请检查后端服务')
    }
  }

  async function handleRoleChange(roleId: number) {
    try {
      setActionError(null)
      setCurrentRoleId(roleId)
      hydrateRoleDraft(roles.find((r) => r.id === roleId) || null)
      if (currentConversationId) {
        await api.updateTutorConversation(currentConversationId, { roleId })
        await refreshConversations(currentConversationId)
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '切换角色失败，请检查后端服务')
    }
  }

  async function handleSaveRoleFromModal() {
    const name = roleDraft.name.trim()
    if (!name) return
    setSavingRole(true)
    try {
      setActionError(null)
      if (roleModalMode === 'create') {
        const created = await api.createTutorRole({
          name,
          persona: roleDraft.persona,
          background: roleDraft.background,
          styleGuide: roleDraft.styleGuide,
          rules: roleDraft.rules,
        })
        setRoles((prev) => [created, ...prev])
        await handleRoleChange(created.id)
      } else if (roleEditingId) {
        const updated = await api.updateTutorRole(roleEditingId, {
          name,
          persona: roleDraft.persona,
          background: roleDraft.background,
          styleGuide: roleDraft.styleGuide,
          rules: roleDraft.rules,
        })
        setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        if (currentRoleId === updated.id) {
          hydrateRoleDraft(updated)
        }
      }
      setRoleModalOpen(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '保存角色失败，请检查后端服务')
    } finally {
      setSavingRole(false)
    }
  }

  async function handlePickFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    try {
      setActionError(null)
      const uploaded = await api.uploadTutorFiles(Array.from(files))
      setPendingFiles((prev) => [...prev, ...uploaded])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '上传文件失败，请检查后端服务')
    }
  }

  async function handleImportSkillFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    try {
      setActionError(null)
      setSkillImportNotice('')
      const markdownFiles = Array.from(files).filter((file) => /\.md$/i.test(file.name))
      if (markdownFiles.length === 0) {
        setActionError('请选择 Markdown（.md）技能文件')
        return
      }

      let nextSkills = readCustomSkills()
      for (const file of markdownFiles) {
        const content = await file.text()
        if (!content.trim()) continue
        const skill = markdownToSkill(content, file.name)
        nextSkills = addCustomSkill(skill)
      }
      setCustomSkills(nextSkills)
      setSkillImportNotice(`已导入 ${markdownFiles.length} 个技能到技能库`)
      if (skillImportInputRef.current) skillImportInputRef.current.value = ''
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '导入技能失败，请检查 Markdown 文件')
    }
  }

  function removePendingFile(fileId: number) {
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  function handleA2UITaskAction(task: A2UITaskCard, action: A2UITaskAction) {
    if (action.name === 'open_media' && task.media?.href) {
      const needsAuth = A2UI_AUTH_GUARDED_HREFS.some((href) => task.media?.href?.startsWith(href))
      if (needsAuth && !getToken()) {
        setActionError('请先登录后再进入学习资源页，当前学习方案已保留在对话中。')
        return
      }
      router.push(task.media.href)
      return
    }
    const actionText = action.name === 'complete_task'
      ? `我已完成任务「${task.title}」，请帮我复盘下一步。`
      : action.name === 'add_to_path'
        ? `请把任务「${task.title}」加入我的学习路径，并说明应该排在哪一步。`
        : action.name === 'open_media'
          ? `请打开并讲解任务「${task.title}」的多模态资源。`
        : `请继续处理任务「${task.title}」的动作「${action.label}」。`
    void handleSend(actionText)
  }

  async function handleSend(sendText?: string) {
    const textValue = (sendText ?? input).trim()
    if ((!textValue && pendingFiles.length === 0) || streaming) return

    const isImageMode = multimodalMode === 'image'
    const isVideoMode = multimodalMode === 'video'
    const convId = currentConversationId ?? undefined
    const userInput = textValue || '（空文本）'
    const expectA2UIPanel = !isVideoMode && !isImageMode && shouldExpectA2UIPanel(userInput)
    const msgUid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const draftConversationId = convId ?? -Date.now()
    const userMsg: Message = {
      id: `u-${msgUid}`,
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
      conversationId: draftConversationId,
      fileNames: pendingFiles.map((f) => f.filename),
    }

    const assistantId = `a-${msgUid}`
    autoFollowRef.current = true
    setAutoFollowMessages(true)
    setShowJumpToLatest(false)
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: assistantId,
        role: 'assistant',
        content: isVideoMode ? '正在生成视频，请稍候…' : '',
        timestamp: new Date().toISOString(),
        conversationId: draftConversationId,
        streaming: true,
        a2uiUiOnly: expectA2UIPanel,
      },
    ])
    setMcpCallsByMsg((prev) => ({
      ...prev,
      [assistantId]: isVideoMode
        ? []
        : [
            {
              serviceId: 'student-profile',
              serviceName: '学生画像',
              toolName: '读取用户画像',
              status: 'running',
              ok: false,
            },
            ...(mcpEnabled
              ? [{
                  serviceId: 'pending',
                  serviceName: 'MCP',
                  toolName: '等待匹配可用工具',
                  status: 'pending',
                  ok: false,
                }]
              : []),
          ],
    }))
    setSearchResultsByMsg((prev) => ({ ...prev, [assistantId]: [] }))

    setInput('')
    setStreaming(true)
    setHubMessages([])
    setWorkshopPhase(isVideoMode ? null : (workshopEnabled ? { phase: 'profile_analysis', status: 'running' } : null))
    setWorkshopRunId((v) => v + 1)

    let streamTextBuffer = ''
    let streamFlushFrame: number | null = null
    const flushStreamText = () => {
      if (streamFlushFrame !== null) {
        cancelAnimationFrame(streamFlushFrame)
        streamFlushFrame = null
      }
      if (!streamTextBuffer) return
      const nextChunk = streamTextBuffer
      streamTextBuffer = ''
      setMessages((prev) => prev.map((m) => (
        m.id === assistantId ? { ...m, content: `${m.content}${nextChunk}` } : m
      )))
    }
    const queueStreamText = (chunk: string) => {
      streamTextBuffer += chunk
      if (streamFlushFrame !== null) return
      streamFlushFrame = requestAnimationFrame(flushStreamText)
    }
    let receivedMcpCallEvent = false

    try {
      setActionError(null)
      if (isVideoMode) {
        const updateAssistantContent = (content: string) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content } : m)))
        }

        const resource = await api.generateVideo(userInput, {
          durationSec: 90,
          styleId: 'apple-minimal',
          voice: videoVoice,
          onEvent: (evt) => {
            appendAGUIEventsToMessage(assistantId, videoEventToAGUIEvents(evt, assistantId, userInput), setMessages)
            if (evt.type === 'progress') {
              const stage = String(evt.payload.stage || '').replace(/_/g, ' ').trim()
              const progress = Number(evt.payload.progress ?? 0)
              const progressText = Number.isFinite(progress) && progress > 0 ? ` ${Math.round(progress)}%` : ''
              updateAssistantContent(`视频生成中${stage ? ` · ${stage}` : ''}${progressText}`)
              return
            }
            if (evt.type === 'artifact') {
              const kind = String(evt.payload.kind || '')
              if (kind === 'timeline') {
                updateAssistantContent('视频已生成，正在整理播放卡片…')
              }
              return
            }
            if (evt.type === 'error') {
              updateAssistantContent(String(evt.payload.message || '视频生成失败'))
            }
          },
        })
        const readyText = resource.hasMp4
          ? '视频已生成，可以直接在下方播放。'
          : resource.sceneUrl
            ? '视频已生成，可以直接在下方预览。'
            : '视频已生成。'
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId
            ? {
                ...m,
                content: readyText,
                videoResource: resource,
                streaming: false,
                aguiEvents: [
                  ...(m.aguiEvents || []),
                  ...buildVideoFinishedAGUIEvents(assistantId, resource),
                ],
              }
            : m
        )))
        setGeneratedResources((prev) => [resource, ...prev.filter((item) => item.id !== resource.id)])
        setPendingFiles([])
        return
      }

      const activeProfile = await loadStudentProfile()
      setMcpCallsByMsg((prev) => ({
        ...prev,
        [assistantId]: (prev[assistantId] || []).map((call) =>
          call.serviceId === 'student-profile'
            ? {
                ...call,
                status: activeProfile ? 'done' : 'error',
                ok: Boolean(activeProfile),
                error: activeProfile ? '' : '画像读取失败，将按本次问题继续回答',
                args: activeProfile
                  ? {
                      stage: activeProfile.currentStage || activeProfile.knowledgeLevel,
                      weak_points: activeProfile.weakPoints?.slice(0, 2),
                      preference: activeProfile.learningPreference?.slice(0, 2),
                    }
                  : undefined,
              }
            : call,
        ),
      }))
      const matchedNotes = matchPersonalizedNotes(
        learningNotes,
        [userInput, selectedSkill?.title, selectedSkill?.summary, selectedSkill?.prompt].filter(Boolean).join(' '),
        5,
      )
      const defaultNotes = learningNotes
        .filter((note) => note.personalizationEnabled !== false)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5)
        .map((note) => ({ note, score: 0, keywords: ['默认注入'] }))
      const matchedNotesForSend = matchedNotes.length > 0 ? matchedNotes : defaultNotes
      let resourcesForSend = generatedResources
      try {
        resourcesForSend = await api.getResources()
        setGeneratedResources(resourcesForSend)
      } catch {
        resourcesForSend = generatedResources
      }
      const matchedResourcesForSend = matchGeneratedResources(
        resourcesForSend,
        [userInput, selectedSkill?.title, selectedSkill?.summary, selectedSkill?.prompt].filter(Boolean).join(' '),
        5,
      )
      const defaultResources = resourcesForSend
        .filter((resource) => resource.status === 'completed')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((resource) => ({ resource, score: 0, keywords: ['默认注入'] }))
      const resourcesContextForSend = matchedResourcesForSend.length > 0 ? matchedResourcesForSend : defaultResources
      const outboundInput = userInput
      const trustModeForRequest = !isImageMode && !openMode
      const savedMessage = await api.sendMessage(
        outboundInput,
        {
          conversationId: convId,
          roleId: currentRoleId || undefined,
          mode: isImageMode ? 'image_gen' : knowledgeReverse ? 'knowledge_reverse' : 'knowledge_qa',
          fileIds: pendingFiles.map((f) => f.id),
          workshopEnabled,
          workshopRoleIds,
          openMode: isImageMode ? true : openMode,
          webSearch,
          mcpEnabled,
          model: selectedModel,
          pageContext: {
            page: '/tutor',
            selected_skill: selectedSkill ? {
              id: selectedSkill.id,
              title: selectedSkill.title,
              category: selectedSkill.category,
              output: selectedSkill.output,
            } : null,
            student_profile: activeProfile ? {
              name: activeProfile.name,
              major: activeProfile.major,
              grade: activeProfile.grade,
              goals: activeProfile.goals,
              knowledge_level: activeProfile.knowledgeLevel,
              weak_points: activeProfile.weakPoints,
              learning_preference: activeProfile.learningPreference,
              cognitive_style: activeProfile.cognitiveStyle,
              daily_time: activeProfile.dailyTime,
              practical_ability: activeProfile.practicalAbility,
              current_stage: activeProfile.currentStage,
            } : null,
            personalized_notes: matchedNotesForSend.map((item) => ({
              id: item.note.id,
              title: item.note.title,
              source_type: item.note.source.type,
              source_title: item.note.source.title,
              tags: item.note.tags,
              matched_keywords: item.keywords,
              score: item.score,
              excerpt: item.note.content.slice(0, 240),
              updated_at: item.note.updatedAt,
            })),
            generated_resources: resourcesContextForSend.map((item) => ({
              id: item.resource.id,
              title: item.resource.title,
              type: item.resource.type,
              type_label: resourceTypeLabel[item.resource.type],
              matched_keywords: item.keywords,
              score: item.score,
              excerpt: (item.resource.content || buildResourceSearchText(item.resource)).slice(0, 260),
              source_url: item.resource.sourceUrl || null,
              created_at: item.resource.createdAt,
              href: `/generate?view=library&id=${item.resource.id}`,
            })),
          },
        },
        {
          onText: (chunk) => {
            queueStreamText(chunk)
          },
          onConfidence: (confidence: ConfidenceInfo) => {
            if (!trustModeForRequest) return
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, confidence } : m)))
          },
          onCitations: (citations: CitationItem[]) => {
            if (!trustModeForRequest) return
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, citations } : m)))
          },
          onTrustMeta: (trustMeta: Record<string, unknown>) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, trustMeta } : m)))
          },
          onMcpCall: (call) => {
            receivedMcpCallEvent = true
            setMcpCallsByMsg((prev) => {
              const list = prev[assistantId] || []
              const withoutPending = list.filter((x) => x.serviceId !== 'pending')
              const nextCall: McpCallView = {
                serviceId: call.serviceId,
                serviceName: call.serviceName || call.serviceId,
                toolName: call.toolName,
                status: call.status || 'running',
                ok: call.ok,
                error: call.error,
                args: call.args,
                resultPreview: call.resultPreview,
                resultContext: call.resultContext,
              }
              const idx = withoutPending.findIndex((x) => x.serviceId === nextCall.serviceId && x.toolName === nextCall.toolName)
              const next = idx >= 0 ? withoutPending.map((x, i) => (i === idx ? { ...x, ...nextCall } : x)) : [...withoutPending, nextCall]
              return { ...prev, [assistantId]: next }
            })
            const nextCallForTimeline: McpCallView = {
              serviceId: call.serviceId,
              serviceName: call.serviceName || call.serviceId,
              toolName: call.toolName,
              status: call.status || 'running',
              ok: call.ok,
              error: call.error,
              args: call.args,
              resultPreview: call.resultPreview,
              resultContext: call.resultContext,
            }
            const mcpEvents = mcpCallToAGUIEvents(nextCallForTimeline, assistantId)
            if (mcpEvents.length > 0) {
              setMessages((prev) => prev.map((m) => (
                m.id === assistantId
                  ? { ...m, aguiEvents: mcpEvents.reduce((events, event) => appendAGUIEvent(events, event), m.aguiEvents || []) }
                  : m
              )))
            }
          },
          onSearchResults: (results) => {
            setSearchResultsByMsg((prev) => ({ ...prev, [assistantId]: results }))
          },
          onA2UI: (envelope) => {
            setMessages((prev) => prev.map((m) => (
              m.id === assistantId
                ? {
                    ...m,
                    streaming: expectA2UIPanel ? false : m.streaming,
                    a2uiUiOnly: expectA2UIPanel || m.a2uiUiOnly,
                    a2uiSurfaces: applyA2UIEnvelopeToSurfaces(m.a2uiSurfaces, envelope),
                  }
                : m
            )))
          },
          onAGUI: (event) => {
            setMessages((prev) => prev.map((m) => (
              m.id === assistantId
                ? {
                    ...m,
                    aguiEvents: appendAGUIEvent(m.aguiEvents, event),
                  }
                : m
            )))
          },
          onHub: (evt) => {
            setHubMessages((prev) => {
              const isDelta = (evt as unknown as { delta?: boolean }).delta === true
              if (!isDelta) return [...prev, evt]
              const idx = prev.findIndex((x) => x.agentId === evt.agentId && x.round === evt.round)
              if (idx < 0) return [...prev, evt]
              const next = [...prev]
              next[idx] = { ...next[idx], content: evt.content, timestamp: evt.timestamp }
              return next
            })
          },
          onWorkshopPhase: (evt) => {
            setWorkshopPhase(evt)
          },
        },
      )
      flushStreamText()
      if (savedMessage.conversationId && savedMessage.conversationId !== currentConversationId) {
        setCurrentConversationId(savedMessage.conversationId)
      }
      setMessages((prev) => prev.map((m) => (
        m.conversationId === draftConversationId
          ? { ...m, conversationId: savedMessage.conversationId }
          : m
      )))
      if (savedMessage.id && savedMessage.id !== assistantId) {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? {
          ...m,
          id: savedMessage.id,
          conversationId: savedMessage.conversationId,
          streaming: false,
          content: savedMessage.a2uiUiOnly ? '' : (m.content || savedMessage.content),
          a2uiUiOnly: savedMessage.a2uiUiOnly || m.a2uiUiOnly,
          a2uiSurfaces: savedMessage.a2uiSurfaces?.length ? savedMessage.a2uiSurfaces : m.a2uiSurfaces,
          aguiEvents: m.aguiEvents?.length ? m.aguiEvents : savedMessage.aguiEvents,
        } : m)))
        setMcpCallsByMsg((prev) => {
          if (!prev[assistantId]) return prev
          const next = { ...prev, [savedMessage.id]: prev[assistantId] }
          delete next[assistantId]
          return next
        })
        setSearchResultsByMsg((prev) => {
          if (!prev[assistantId]) return prev
          const next = { ...prev, [savedMessage.id]: prev[assistantId] }
          delete next[assistantId]
          return next
        })
      }
      if (mcpEnabled && !receivedMcpCallEvent) {
        const finalAssistantId = savedMessage.id || assistantId
        setMcpCallsByMsg((prev) => {
          const list = prev[finalAssistantId] || prev[assistantId] || []
          const nextList = list.length > 0
            ? list.map((call) => (
                call.serviceId === 'pending'
                  ? {
                      ...call,
                      toolName: '未匹配到可用工具',
                      status: 'done',
                      ok: true,
                    }
                  : call
              ))
            : [{
                serviceId: 'pending',
                serviceName: 'MCP',
                toolName: '未匹配到可用工具',
                status: 'done',
                ok: true,
              }]
          return { ...prev, [finalAssistantId]: nextList }
        })
      }
      setMessages((prev) => prev.map((m) => (
        m.id === (savedMessage.id || assistantId)
          ? {
              ...m,
              streaming: false,
              content: savedMessage.a2uiUiOnly ? '' : (m.content || savedMessage.content),
              a2uiUiOnly: savedMessage.a2uiUiOnly || m.a2uiUiOnly,
              a2uiSurfaces: savedMessage.a2uiSurfaces?.length ? savedMessage.a2uiSurfaces : m.a2uiSurfaces,
              aguiEvents: m.aguiEvents?.length ? m.aguiEvents : savedMessage.aguiEvents,
            }
          : m
      )))
      setPendingFiles([])
      await refreshConversations(savedMessage.conversationId ?? convId ?? null)
    } catch (e) {
      setMessages((prev) => prev.map((m) => (
        m.id === assistantId
          ? { ...m, content: isVideoMode ? '视频生成失败，请稍后重试。' : '抱歉，模型服务暂时不可用，请稍后重试。', streaming: false }
          : m
      )))
      setActionError(e instanceof Error ? e.message : (isVideoMode ? '视频生成失败，请检查后端服务' : '发送失败，请检查后端服务'))
    } finally {
      if (streamFlushFrame !== null) {
        cancelAnimationFrame(streamFlushFrame)
      }
      setStreaming(false)
    }
  }

  function toggleTrustPanel(messageId: string) {
    setTrustPanelOpenByMsg((prev) => ({ ...prev, [messageId]: !prev[messageId] }))
  }

  if (error) {
    return (
      <>
        <ErrorState type="server" onRetry={loadWorkspace} />
        <NewUserGuidePanel />
      </>
    )
  }


  return (
    <>
      <div className="flex h-screen bg-[#f5f7fa] max-[760px]:block max-[760px]:h-auto max-[760px]:min-h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {/* 左侧导航栏 */}
        <nav className="flex w-[200px] shrink-0 flex-col border-r border-[#e2e8f0] bg-[#f0f4ff] max-[760px]:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="p-3 border-b border-[#e2e8f0]"><div className="flex items-center gap-2.5"><img src="/sparklearn-logo-official.png" alt="" className="h-8 w-8 object-contain" /><div><div className="text-xs font-bold text-[#1e293b]">SparkLearn</div><div className="text-[10px] text-[#94a3b8]">个性化学习闭环</div></div></div></div>
          {/* 鏂板缓瀵硅瘽鎸夐挳 */}
          <div className="p-3">
            <button onClick={() => void handleCreateConversation()} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> 新建对话
            </button>
          </div>

          {/* 瀵艰埅鑿滃崟 */}
          <div className="px-3 space-y-0.5 flex-1">
            <button onClick={() => setSkillStoreOpen(false)} className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors', !skillStoreOpen ? 'bg-[#2563eb] text-white font-medium shadow-sm' : 'text-[#475569] hover:bg-white hover:text-[#1e293b]')}>
              <Sparkles className="w-4 h-4" /> 学习空间
            </button>
            <button data-guide-target="tutor-role-create" onClick={() => router.push('/tutor/roles')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
              <UserCog className="w-4 h-4" /> 角色工坊
            </button>
            <button onClick={() => router.push('/tutor/workshop')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-[#475569] hover:bg-white hover:text-[#1e293b] transition-colors">
              <Users className="w-4 h-4" /> 研讨会
            </button>

            <div className="my-3 border-t border-[#e2e8f0]" />

            <button onClick={() => router.push('/tutor/knowledge')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
              <Bot className="w-4 h-4" /> 知识库
            </button>
            <button onClick={() => router.push('/tutor/mcp-store')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
              <Puzzle className="w-4 h-4" /> MCP 插件商店
            </button>
            <button onClick={() => router.push('/tutor/skills')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-[#475569] hover:bg-white hover:text-[#1e293b] transition-colors">
              <Sparkles className="w-4 h-4" /> Skills 商店
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
              <Paperclip className="w-4 h-4" /> 我的文件
            </button>
          </div>

          {/* 搴曢儴 */}
          <div className="p-3 border-t border-[#e2e8f0] space-y-2">
            <button onClick={() => router.push('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> 返回主平台
            </button>
            <TutorUserBadge />
          </div>
        </nav>

        {/* 中间侧栏：列表 / Skills 商店 */}
        <div className={cn('flex shrink-0 flex-col border-r border-[#eef1f5] bg-white transition-[width] duration-300 max-[760px]:w-full max-[760px]:border-b max-[760px]:border-r-0', skillStoreOpen ? 'flex-1 bg-[#fbfcfe]' : 'w-[280px]')}>
          {skillStoreOpen ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-10 py-10 max-[900px]:px-5 max-[760px]:max-h-[70vh]">
              <div className="mx-auto max-w-[980px]">
                <div className="mb-12 flex items-start justify-between gap-8 max-[920px]:flex-col">
                  <div className="pt-10 max-[920px]:pt-2">
                    <h2 className="text-[30px] font-semibold leading-tight text-[#111827]">技能</h2>
                    <p className="mt-2 text-base leading-7 text-[#8a93a3]">当前技能库共 {skillLibrary.length} 个技能。</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3 max-[920px]:w-full max-[920px]:justify-start">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[#8a93a3] hover:bg-white hover:text-[#475569]"
                      title="刷新"
                      onClick={() => setSkillSearch('')}
                    >
                      <RefreshCw className="h-4 w-4" />
                      刷新
                    </button>
                    <div className="flex h-10 w-[280px] items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 shadow-sm max-[520px]:w-full">
                      <Search className="h-4 w-4 text-[#94a3b8]" />
                      <input
                        value={skillSearch}
                        onChange={(e) => setSkillSearch(e.target.value)}
                        placeholder="搜索技能"
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9ca3af]"
                      />
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white shadow-sm shadow-blue-100 hover:bg-[#1d4ed8]"
                      title="新建技能"
                      onClick={() => skillImportInputRef.current?.click()}
                    >
                      <Plus className="h-4 w-4" />
                      新建技能
                    </button>
                    <input
                      ref={skillImportInputRef}
                      type="file"
                      accept=".md,text/markdown,text/plain"
                      multiple
                      className="hidden"
                      onChange={(e) => void handleImportSkillFiles(e.target.files)}
                    />
                  </div>
                </div>

                {skillImportNotice && (
                  <div className="mb-6 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1d4ed8]">
                    {skillImportNotice}
                  </div>
                )}

                <div className="mb-7 text-sm font-semibold text-[#374151]">已配置</div>
                <div className="grid grid-cols-2 gap-x-16 gap-y-8 max-[980px]:grid-cols-1">
                  {configuredSkills.map((skill) => {
                    const active = selectedSkillId === skill.id
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => chooseSkill(skill.id)}
                        className="group flex min-w-0 items-center gap-4 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white"
                      >
                        <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl border', skillToneClass(skill.tone))}>
                          <Puzzle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-[15px] font-semibold text-[#1f2937]">{skill.title}</p>
                          </div>
                          <p className="mt-1 line-clamp-1 text-[14px] leading-5 text-[#8a93a3]">{skill.summary}</p>
                        </div>
                        <CheckCircle2 className={cn('h-5 w-5 shrink-0', active ? 'text-[#2563eb]' : 'text-[#c4cbd5]')} />
                      </button>
                    )
                  })}
                  {configuredSkills.length === 0 && (
                    <div className="col-span-2 rounded-xl border border-dashed border-[#cbd5e1] px-4 py-8 text-center text-sm text-[#64748b]">
                      没有匹配的技能
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 搜索 */}
              <div className="p-3 border-b border-[#eef1f5]">
                <div className="flex items-center gap-2 h-9 rounded-lg bg-[#f5f7fa] px-3">
                  <MessageSquareText className="w-4 h-4 text-[#94a3b8]" />
                  <input type="text" placeholder="搜索对话" className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#94a3b8]" />
                </div>
              </div>

              {/* 角色切换 */}
              {roles.length > 0 && (
                <div className="px-3 py-2 border-b border-[#eef1f5]">
                  <div className="flex max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden">
                    {roles.map((role) => (
                      <button key={role.id} onClick={() => void handleRoleChange(role.id)} className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors', currentRoleId === role.id ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]')}>
                        {role.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 对话列表 */}
              <div className="min-h-0 flex-1 overflow-y-auto max-[760px]:max-h-[42vh]">
                {loading && conversations.length === 0 && (
                  <div className="px-4 py-5 text-center text-xs text-[#94a3b8]">正在加载对话...</div>
                )}
                {conversations.map((conv) => (
                  <div key={conv.id} onClick={() => void switchConversation(conv)} className={cn('group px-4 py-3 border-b border-[#f5f7fa] cursor-pointer transition-colors', currentConversationId === conv.id ? 'bg-[#eff6ff]' : 'hover:bg-[#f8fafc]')}>
                    {renamingConversationId === conv.id ? (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <input className="flex-1 min-w-0 border border-[#e2e8f0] rounded px-2 py-1 text-xs" value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleRenameConversation(conv.id) }} autoFocus />
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn('text-sm font-medium truncate', currentConversationId === conv.id ? 'text-[#2563eb]' : 'text-[#1e293b]')}>{conv.title}</p>
                          <p className="text-xs text-[#94a3b8] mt-0.5">{conv.messageCount} 条消息</p>
                        </div>
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e2e8f0] text-[#94a3b8]" onClick={(e) => { e.stopPropagation(); setRenamingConversationId(conv.id); setRenameTitle(conv.title) }}><Pencil className="w-3 h-3" /></button>
                          <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e2e8f0] text-red-400" onClick={(e) => { e.stopPropagation(); void handleDeleteConversation(conv.id) }}><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 主对话区 */}
        <main className={cn('relative min-h-0 flex-1 flex-col overflow-hidden bg-white max-[760px]:overflow-visible', skillStoreOpen ? 'hidden' : 'flex')}>
          {actionError && <div className="px-6 pt-3"><p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{actionError}</p></div>}

          {/* 瀵硅瘽鏍囬鏍?*/}
          {currentConversation && (
            <div className="flex items-center justify-between gap-3 border-b border-[#eef1f5] px-6 py-3 max-[760px]:px-4">
              <h2 className="min-w-0 break-words text-base font-semibold text-[#1e293b]">{currentConversation.title}</h2>
              <p className="shrink-0 text-xs text-[#94a3b8]">{currentRole ? currentRole.name : ''}</p>
            </div>
          )}

          {/* 娑堟伅鍖哄煙 */}
          <div ref={messageScrollRef} onScroll={handleMessagesScroll} className="flex-1 min-h-0 overflow-y-auto">
            {!hasInteracted ? (
              <div className="h-full flex flex-col items-center justify-center px-6">
                <div className="max-w-[560px] w-full text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] shadow-lg mb-4"><Sparkles className="w-8 h-8 text-white" /></div>
                  <h2 className="text-2xl font-semibold text-[#1e293b] mb-2">有什么可以帮你的？</h2>
                  <p className="text-[#64748b] text-sm mb-6">和 AI 对话，提任何学习问题</p>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-6 max-w-[800px] mx-auto w-full">
                {workshopEnabled && hubMessages.length > 0 && (<div className="rounded-xl border border-[#e2e8f0] bg-[#fafafa] p-3 mb-4"><div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-[#1e293b]">研讨会</p></div><div key={`hub-${workshopRunId}`} className="max-h-[180px] overflow-y-auto space-y-2">{hubMessages.map((evt, idx) => (<div key={`${evt.agentId}-${idx}`} className="rounded-lg bg-white border border-[#eef2f7] px-3 py-2"><p className="text-xs font-medium text-[#475569]">{evt.agentName}</p><p className="text-xs text-[#64748b] mt-1 whitespace-pre-wrap">{evt.content}</p></div>))}</div></div>)}

                {messages.map((msg) => {
                  const isProfileMessage = msg.trustMeta?.kind === 'student_profile'
                  if (isProfileMessage) {
                    const rawStatus = msg.streaming
                      ? 'loading'
                      : String(msg.trustMeta?.status || profileStatus)
                    const status: ProfileLoadStatus = ['idle', 'loading', 'ready', 'error'].includes(rawStatus)
                      ? rawStatus as ProfileLoadStatus
                      : 'ready'
                    return <ProfileMessageCard key={msg.id} profile={studentProfile} status={status} />
                  }
                  const summary = msg.role === 'assistant' ? parseWorkshopSummary(msg.content) : null
                  const showTrustInfo = !openMode
                  const imageDataMatch =
                    msg.role === 'assistant'
                      ? msg.content.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/)
                      : null
                  const msgMcpCalls = msg.role === 'assistant' ? (mcpCallsByMsg[msg.id] || []) : []
                  const visibleMcpCalls = msgMcpCalls.filter((call) => call.serviceId !== 'student-profile')
                  return (
                    <div key={msg.id}>
                      {msg.role === 'user' ? (
                        <div className="mb-4 flex justify-end">
                          <div className="max-w-[70%] max-[760px]:max-w-[92%]">
                            <div className="rounded-2xl rounded-tr-sm bg-[#eff6ff] px-4 py-2.5">
                              <p className="break-words text-[15px] leading-[1.8] text-[#1e293b] whitespace-pre-wrap">{msg.content}</p>
                              {msg.fileNames && msg.fileNames.length > 0 && (<div className="mt-2 flex flex-wrap gap-1.5">{msg.fileNames.map((name) => <span key={name} className="text-xs px-2 py-0.5 rounded border border-[#e2e8f0] bg-white">{name}</span>)}</div>)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 mb-6">
                          <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center mt-1"><Sparkles className="w-4 h-4 text-white" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="pt-1.5">
                              {msg.streaming && !msg.content.trim() && (
                                <div className="mb-2">
                                  <LoadingDotsBubble />
                                </div>
                              )}
                              {summary ? (
                                <div className="space-y-4">
                                  {summary.coreConclusion && <div><p className="text-xs font-medium text-[#94a3b8] mb-1.5">核心结论</p><p className="text-[15px] leading-[1.8] text-[#1e293b] whitespace-pre-wrap">{summary.coreConclusion}</p></div>}
                                  {summary.steps.length > 0 && <div><p className="text-xs font-medium text-[#94a3b8] mb-1.5">行动清单</p><div className="space-y-1">{summary.steps.map((s, i) => <p key={i} className="text-[15px] leading-[1.8] text-[#1e293b]">{i+1}. {s}</p>)}</div></div>}
                                  {summary.followUps.length > 0 && <div><p className="text-xs font-medium text-[#94a3b8] mb-2">追问</p><div className="flex flex-wrap gap-2">{summary.followUps.map((q, i) => <button key={i} className="text-[13px] px-3 py-1.5 rounded-full border border-[#e2e8f0] text-[#475569] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors" onClick={() => void handleSend(q)} disabled={streaming}>{q}</button>)}</div></div>}
                                </div>
                              ) : (
                                <div className="prose prose-base max-w-none text-[#1e293b] prose-p:leading-[1.8] prose-p:my-3 prose-p:text-[15px] prose-headings:text-[#1e293b] prose-headings:font-semibold prose-code:text-[#e11d48] prose-code:bg-[#f5f5f5] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] prose-pre:rounded-xl prose-pre:text-[13px] prose-li:text-[15px] prose-li:leading-[1.8]">
                                  {imageDataMatch ? (
                                    <Image
                                      src={imageDataMatch[0]}
                                      alt="generated image"
                                      width={960}
                                      height={540}
                                      unoptimized
                                      className="max-w-full h-auto rounded-lg border border-[#e2e8f0]"
                                    />
                                  ) : (
                                    <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    urlTransform={(url) => {
                                      const u = String(url || '').trim()
                                      if (u.startsWith('data:image/')) return u
                                      return u
                                    }}
                                    components={{
                                      img: ({ src, alt }) => {
                                        const safeSrc = typeof src === 'string' ? src.trim() : ''
                                        if (!safeSrc) return null
                                        return (
                                          <Image
                                            src={safeSrc}
                                            alt={alt || 'generated image'}
                                            width={960}
                                            height={540}
                                            unoptimized
                                            className="max-w-full h-auto rounded-lg border border-[#e2e8f0]"
                                          />
                                        )
                                      },
                                      a: ({ href, children }) => {
                                        const safeHref = typeof href === 'string' ? href.trim() : ''
                                        if (!safeHref) return <>{children}</>
                                        const childText = typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : String(children ?? '')
                                        if (childText.startsWith('来源')) {
                                          const pillClass = 'inline-flex items-center rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11px] text-[#64748b] no-underline align-middle mx-0.5'
                                          if (safeHref === '#') {
                                            return <span className={pillClass}>{children}</span>
                                          }
                                          return (
                                            <a
                                              href={safeHref}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`${pillClass} hover:bg-[#e2e8f0] hover:text-[#334155] transition-colors`}
                                            >
                                              {children}
                                            </a>
                                          )
                                        }
                                        return (
                                          <a
                                            href={safeHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#2563eb] underline decoration-[#93c5fd] underline-offset-2 hover:text-[#1d4ed8] transition-colors"
                                          >
                                            {children}
                                          </a>
                                        )
                                      },
                                    }}
                                  >
                                    {(() => {
                                      let text = msg.content
                                      const citations = showTrustInfo ? (msg.citations || []) : []
                                      if (citations.length) {
                                        text = text.replace(/\[来源(\d+)\]/g, (_m: string, n: string) => {
                                          const idx = parseInt(n, 10) - 1
                                          const cite = citations[idx]
                                          if (!cite) return _m
                                          const url = cite.id?.startsWith('web:') ? cite.id.replace(/^web:/, '') : '#'
                                          return `[${cite.label || `来源${n}`}](${url})`
                                        })
                                      }
                                      return text
                                    })()}
                                    </ReactMarkdown>
                                  )}
                                </div>
                              )}
                            </div>
                            <A2UITaskCards
                              surfaces={msg.a2uiSurfaces}
                              onAction={handleA2UITaskAction}
                              loading={Boolean(msg.streaming && msg.a2uiUiOnly && !msg.a2uiSurfaces?.length)}
                            />
                            <AgentTimeline
                              events={msg.aguiEvents}
                              loading={Boolean(msg.streaming && msg.a2uiUiOnly && !msg.aguiEvents?.length)}
                            />
                            {msg.videoResource && (
                              <div className="mt-3 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#0b1120] shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
                                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white">视频结果</p>
                                    <p className="truncate text-xs text-slate-300">{msg.videoResource.title}</p>
                                  </div>
                                  <span className={cn(
                                    'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
                                    msg.videoResource.status === 'completed'
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : msg.videoResource.status === 'failed'
                                        ? 'bg-rose-500/15 text-rose-300'
                                        : 'bg-amber-500/15 text-amber-300',
                                  )}>
                                    {msg.videoResource.status === 'completed' ? '已生成' : msg.videoResource.status === 'failed' ? '失败' : '生成中'}
                                  </span>
                                </div>
                                <div className="bg-black">
                                  {msg.videoResource.hasMp4 && msg.videoResource.videoUrl ? (
                                    <video
                                      src={msg.videoResource.videoUrl}
                                      controls
                                      className="block h-auto w-full max-h-[420px] bg-black"
                                    />
                                  ) : msg.videoResource.sceneUrl ? (
                                    <iframe
                                      src={msg.videoResource.sceneUrl}
                                      className="h-[420px] w-full bg-white"
                                      title={`${msg.videoResource.title} 视频预览`}
                                      allowFullScreen
                                    />
                                  ) : (
                                    <div className="px-4 py-5 text-sm text-slate-300">
                                      当前环境没有可直接播放的 MP4，下面保留下载入口。
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2 border-t border-white/10 bg-slate-950 px-4 py-3">
                                  {msg.videoResource.videoUrl && (
                                    <a
                                      href={msg.videoResource.videoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                                    >
                                      打开视频
                                    </a>
                                  )}
                                  {msg.videoResource.audioUrl && (
                                    <a
                                      href={msg.videoResource.audioUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                                    >
                                      下载音频
                                    </a>
                                  )}
                                  {msg.videoResource.subtitleUrl && (
                                    <a
                                      href={msg.videoResource.subtitleUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                                    >
                                      字幕
                                    </a>
                                  )}
                                  {msg.videoResource.timelineUrl && (
                                    <a
                                      href={msg.videoResource.timelineUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                                    >
                                      时间线
                                    </a>
                                  )}
                                  {msg.videoResource.sceneUrl && !msg.videoResource.hasMp4 && (
                                    <a
                                      href={msg.videoResource.sceneUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                                    >
                                      预览页
                                    </a>
                                  )}
                                  {msg.videoResource.shareUrl && (
                                    <a
                                      href={msg.videoResource.shareUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                                    >
                                      分享页
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* TTS 播报按钮 */}
                            {!!msg.content.trim() && (
                              <button
                                onClick={() => void playTts(msg.id, msg.content, msg.videoResource?.audioUrl)}
                                disabled={ttsLoading === msg.id}
                                className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-[#94a3b8] hover:text-[#2563eb] hover:bg-[#eff6ff] transition-colors disabled:opacity-50"
                                title={msg.videoResource?.audioUrl ? '播放视频音频' : '语音播报'}
                              >
                                {ttsLoading === msg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : playingMsgId === msg.id ? <Pause className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                <span>{playingMsgId === msg.id ? '暂停' : '播放'}</span>
                              </button>
                            )}
                            {visibleMcpCalls.length > 0 && (
                              <div className="mt-3 overflow-hidden rounded-xl border border-[#e0e7f5] bg-[#fafcff] shadow-[0_2px_8px_rgba(37,99,235,0.04)]">
                                <div className="flex items-center gap-2 border-b border-[#eef2f8] bg-[#f4f8ff] px-3.5 py-2">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#e6eeff] text-[#4f6bf6]">
                                    <Cpu className="h-3 w-3" />
                                  </div>
                                  <span className="text-xs font-semibold text-[#1e293b]">MCP 工具调用</span>
                                  {streaming && (
                                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-medium text-[#4f6bf6]">
                                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4f6bf6]" />
                                      执行中
                                    </span>
                                  )}
                                </div>
                                <div className="divide-y divide-[#eef2f8] px-1">
                                  {visibleMcpCalls.map((c, i) => {
                                    const isRunning = c.status === 'pending' || c.status === 'running' || c.status === 'discovering'
                                    const isError = c.status === 'error' || (!c.ok && c.status === 'done')
                                    const statusText = c.status === 'pending' ? '等待中' : c.status === 'discovering' ? '发现工具' : isRunning ? '调用中' : isError ? '失败' : '完成'
                                    const argsText = c.args && Object.keys(c.args).length > 0 ? JSON.stringify(c.args) : ''
                                    return (
                                      <div
                                        key={`${c.serviceName}-${c.toolName}-${i}`}
                                        className={`flex items-center gap-3 px-2.5 py-2.5 transition-colors ${isRunning ? 'bg-[#f8fbff]' : ''}`}
                                      >
                                        {/* 时序连接线 */}
                                        <div className="flex flex-col items-center gap-0.5">
                                          <div className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                            isRunning ? 'bg-[#e6eeff] text-[#4f6bf6]' : isError ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                                          }`}>
                                            {isRunning ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : isError ? (
                                              <X className="h-3 w-3" />
                                            ) : (
                                              <CheckCircle2 className="h-3 w-3" />
                                            )}
                                          </div>
                                          {i < visibleMcpCalls.length - 1 && (
                                            <div className="h-3 w-px bg-[#dbe4f0]" />
                                          )}
                                        </div>
                                        {/* 工具信息 */}
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#e4eaf5] bg-white">
                                            <Puzzle className="h-3 w-3 text-[#6b7cba]" />
                                          </div>
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="truncate text-xs font-semibold text-[#1e293b]">{c.toolName}</span>
                                              <span className="shrink-0 text-[10px] text-[#94a3b8]">· {c.serviceName}</span>
                                            </div>
                                            {(argsText || c.error) && (
                                              <div className={cn('mt-0.5 truncate text-[10px]', c.error ? 'text-rose-500' : 'text-[#64748b]')}>
                                                {c.error || `参数 ${argsText}`}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {/* 状态标签 */}
                                        <div className="shrink-0">
                                          {isRunning ? (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                                              <span className="h-1 w-1 animate-pulse rounded-full bg-amber-500" />
                                              {statusText}
                                            </span>
                                          ) : isError ? (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
                                              <X className="h-2.5 w-2.5" />
                                              {statusText}
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                                              <CheckCircle2 className="h-2.5 w-2.5" />
                                              {statusText}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            {!!searchResultsByMsg[msg.id]?.length && (
                              <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Globe className="w-3.5 h-3.5 text-[#2563eb]" />
                                  <span className="text-xs font-medium text-[#334155]">联网搜索结果</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {searchResultsByMsg[msg.id].map((r, i) => (
                                    <a
                                      key={`${r.url}-${i}`}
                                      href={r.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block rounded-md bg-white border border-[#eef2f7] px-2.5 py-1.5 hover:border-[#2563eb] transition-colors"
                                    >
                                      <div className="text-xs font-medium text-[#1e293b] truncate">{r.title}</div>
                                      <div className="text-xs text-[#64748b] truncate mt-0.5">{r.content.slice(0, 100)}</div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            {showTrustInfo && !imageDataMatch && (msg.confidence || (msg.citations && msg.citations.length > 0)) && (
                              <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-white">
                                <button
                                  type="button"
                                  className="w-full flex items-center justify-between px-3 py-2 text-left"
                                  onClick={() => toggleTrustPanel(msg.id)}
                                >
                                  <div className="flex items-center gap-2">
                                    {msg.confidence && (
                                      <span
                                        className={cn(
                                          'inline-block h-2.5 w-2.5 rounded-full',
                                          msg.confidence.color === 'green' && 'bg-emerald-500',
                                          msg.confidence.color === 'yellow' && 'bg-amber-400',
                                          msg.confidence.color === 'red' && 'bg-rose-500',
                                        )}
                                      />
                                    )}
                                    <span className="text-xs font-medium text-[#334155]">置信度与引用来源</span>
                                  </div>
                                  {trustPanelOpenByMsg[msg.id] ? <ChevronDown className="w-4 h-4 text-[#64748b]" /> : <ChevronRight className="w-4 h-4 text-[#64748b]" />}
                                </button>
                                {trustPanelOpenByMsg[msg.id] && (
                                  <div className="px-3 pb-3">
                                    {msg.confidence && (
                                      <div className="rounded-lg bg-[#f8fafc] px-2.5 py-2 border border-[#eef2f7]">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-medium text-[#334155]">{msg.confidence.label}</span>
                                          <span className="text-xs text-[#64748b]">({Math.round((msg.confidence.score || 0) * 100)}%)</span>
                                        </div>
                                        <p className="mt-1 text-xs text-[#64748b]">{msg.confidence.message}</p>
                                      </div>
                                    )}
                                    {msg.citations && msg.citations.length > 0 && (
                                      <div className="mt-2 space-y-2">
                                        {msg.citations.slice(0, 6).map((c) => (
                                          <div key={c.id} className="rounded-lg bg-[#f8fafc] px-2.5 py-2 border border-[#eef2f7]">
                                            <p className="text-xs font-medium text-[#334155]">{c.label}</p>
                                            <p className="mt-1 text-xs text-[#64748b] line-clamp-3">{c.snippet}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {(!msg.citations || msg.citations.length === 0) && (
                                      <p className="mt-2 text-xs text-[#94a3b8]">引用来源：无</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {hasInteracted && showJumpToLatest && (
            <button
              type="button"
              onClick={() => scrollToLatestMessage('smooth')}
              className={cn(
                'absolute bottom-[104px] left-1/2 z-20 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full border border-[#e2e8f0] bg-white/95 text-[#111827] shadow-[0_8px_24px_rgba(15,23,42,0.14)] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-[#cbd5e1] hover:shadow-[0_12px_28px_rgba(15,23,42,0.18)] max-[760px]:bottom-[116px]',
                !autoFollowMessages && 'animate-in fade-in zoom-in-95',
              )}
              title={streaming ? '回到正在生成的位置' : '回到最新消息'}
              aria-label={streaming ? '回到正在生成的位置' : '回到最新消息'}
            >
              <ChevronDown className="h-6 w-6" />
            </button>
          )}

          {/* 搴曢儴杈撳叆鍖?*/}
          <div className="shrink-0 px-6 pb-4 pt-2">
            <div className="max-w-[800px] mx-auto">
              {pendingFiles.length > 0 && (
                <div className="mb-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <p className="mb-2 text-xs font-medium text-[#334155]">已上传文件（本次提问将携带）{pendingFiles.length} 个</p>
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((f) => (
                      <span key={f.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white border border-[#dbe3ef] text-[#334155]">
                        <FileText className="w-3 h-3" />
                        {f.filename}
                        <button onClick={() => removePendingFile(f.id)} className="text-[#94a3b8] hover:text-[#ef4444]"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm px-4 py-3">
                <div className="flex items-center gap-3">
                  <textarea
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto'
                        el.style.height = `${Math.min(el.scrollHeight, 120)}px`
                      }
                    }}
                    data-guide-target="tutor-input"
                    value={input} onChange={(e) => { setInput(e.target.value) }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }} placeholder={multimodalMode === 'video' ? '输入你要生成的视频主题、知识点或讲解要求...' : multimodalMode === 'image' ? '输入你要生成的图片描述、风格或内容要求...' : '和 AI 对话，提任何学习问题...'} rows={1} className="flex-1 resize-none border-0 bg-transparent text-[15px] text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none min-h-[24px] max-h-[120px]" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-full bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1e293b] flex items-center justify-center transition-colors flex-shrink-0 relative" title="上传文档">
                    <Plus className="w-4 h-4" />
                    {pendingFiles.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#2563eb] text-white text-[10px] flex items-center justify-center font-medium">{pendingFiles.length}</span>
                    )}
                  </button>
                  <button onClick={toggleVoiceInput} className={cn('w-10 h-10 rounded-full flex items-center justify-center transition-colors', recording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1e293b]')} title={recording ? '停止录音' : '语音输入'}>{recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>
                  <button onClick={() => void handleSend()} disabled={(!input.trim() && pendingFiles.length === 0) || streaming} className="w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center hover:bg-[#1d4ed8] disabled:opacity-30 transition-colors"><Send className="w-4 h-4" /></button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#f1f5f9] pt-2">
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => void handlePickFiles(e.target.files)} />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelMenuOpen((v) => !v)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                    >
                      {{ lite: 'Lite', x1: 'x1.5', x2: 'x2', 'ds-flash': 'DS Flash', 'ds-pro': 'DS Pro' }[selectedModel] || 'Lite'}
                      <ChevronDown className={cn('w-3 h-3 transition-transform', modelMenuOpen && 'rotate-180')} />
                    </button>
                    {modelMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setModelMenuOpen(false)} />
                        <div className="absolute bottom-full left-0 mb-1 z-20 bg-white rounded-lg border border-[#e2e8f0] shadow-lg py-1 min-w-[140px]">
                          {[
                            { key: 'lite', label: 'Spark Lite' },
                            { key: 'x1', label: 'Spark X1.5' },
                            { key: 'x2', label: 'Spark X2' },
                            { key: 'ds-flash', label: 'DeepSeek V4 Flash' },
                            { key: 'ds-pro', label: 'DeepSeek V4 Pro' },
                          ].map((m) => (
                            <button
                              key={m.key}
                              type="button"
                              onClick={() => { setSelectedModel(m.key); setModelMenuOpen(false) }}
                              className={cn(
                                'w-full text-left px-3 py-1.5 text-xs hover:bg-[#f1f5f9] transition-colors',
                                selectedModel === m.key ? 'text-[#2563eb] font-medium' : 'text-[#334155]',
                              )}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSkillPickerOpen(true)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                      selectedSkill ? 'border-[#7c3aed] bg-[#f5f3ff] text-[#6d28d9]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]',
                    )}
                  >
                    <Puzzle className="w-3.5 h-3.5" />
                    {selectedSkill ? selectedSkill.shortTitle : 'Skills 商店'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebSearch((v) => !v)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                      webSearch ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]',
                    )}
                  >
                    <Globe className="w-3.5 h-3.5" />联网搜索
                  </button>
                  <button
                    type="button"
                    onClick={() => setMcpEnabled((v) => !v)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                      mcpEnabled ? 'border-[#7c3aed] bg-[#f5f3ff] text-[#6d28d9]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]',
                    )}
                  >
                    <Cpu className="w-3.5 h-3.5" />MCP 模式
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKnowledgeReverse((v) => {
                          const next = !v
                          if (next) {
                            setWebSearch(true)
                            setMultimodalMode(null)
                          }
                          return next
                        })
                      }}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                      knowledgeReverse ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]',
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5" />知识逆构
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMultimodalMenuOpen((v) => !v)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                        multimodalMode ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]',
                      )}
                    >
                      {multimodalMode === 'image' ? (
                        <ImageIcon className="w-3.5 h-3.5" />
                      ) : multimodalMode === 'video' ? (
                        <Clapperboard className="w-3.5 h-3.5" />
                      ) : (
                        <Clapperboard className="w-3.5 h-3.5" />
                      )}
                      {multimodalMode === 'image' ? '图片模式' : multimodalMode === 'video' ? '视频模式' : '多模态'}
                      <ChevronDown className={cn('w-3 h-3 transition-transform', multimodalMenuOpen && 'rotate-180')} />
                    </button>
                    {multimodalMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMultimodalMenuOpen(false)} />
                        <div className="absolute bottom-full left-0 mb-1 z-20 min-w-[168px] overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-lg">
                          {([
                            { key: 'image', label: '图片模式', desc: '生成图片内容并在对话中直接展示' },
                            { key: 'video', label: '视频模式', desc: '生成视频并在对话中内联播放' },
                          ] as const).map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => {
                                setMultimodalMode(item.key)
                                setKnowledgeReverse(false)
                                setMultimodalMenuOpen(false)
                              }}
                              className={cn(
                                'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[#f8fafc]',
                                multimodalMode === item.key && 'bg-[#eff6ff]',
                              )}
                            >
                              <span className={cn(
                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                                item.key === 'image' ? 'bg-[#ecfeff] text-[#0f766e]' : 'bg-[#eff6ff] text-[#2563eb]',
                              )}>
                                {item.key === 'image' ? <ImageIcon className="h-3 w-3" /> : <Clapperboard className="h-3 w-3" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-medium text-[#1e293b]">{item.label}</span>
                                <span className="block text-[11px] leading-4 text-[#64748b]">{item.desc}</span>
                              </span>
                            </button>
                          ))}
                          {multimodalMode && (
                            <button
                              type="button"
                              onClick={() => {
                                setMultimodalMode(null)
                                setMultimodalMenuOpen(false)
                              }}
                              className="flex w-full items-center justify-center border-t border-[#eef2f7] px-3 py-2 text-xs text-[#64748b] hover:bg-[#f8fafc]"
                            >
                              关闭多模态
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {multimodalMode !== 'video' && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMode((v) => {
                          const next = !v
                          if (!next) {
                            // 进入可信模式时自动开启联网搜索作为知识来源
                            setWebSearch(true)
                          }
                          return next
                        })
                      }}
                      className={cn(
                        'inline-flex items-center px-3 py-1.5 rounded-lg border text-xs transition-colors',
                        !openMode ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]',
                      )}
                    >
                      可信模式
                    </button>
                  )}
                </div>
                {multimodalMode === 'video' && (
                  <p className="mt-2 text-xs text-[#a16207]">
                    视频模式已开启，发送后会在当前对话中直接生成并内联展示视频结果。
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>

      </div>

      {skillPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" onClick={() => setSkillPickerOpen(false)}>
          <div className="w-full max-w-[640px] rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[#eef1f5] px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">选择技能</h3>
                <p className="mt-1 text-sm text-[#8a93a3]">从技能库中选择一个学习技能用于当前对话。</p>
              </div>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#334155]"
                onClick={() => setSkillPickerOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[58vh] overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                {skillLibrary.map((skill) => {
                  const active = selectedSkillId === skill.id
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => chooseSkill(skill.id)}
                      className={cn(
                        'flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                        active ? 'border-[#2563eb] bg-[#eff6ff]' : 'border-[#e5e7eb] bg-white hover:border-[#bfdbfe] hover:bg-[#f8fbff]',
                      )}
                    >
                      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl border', skillToneClass(skill.tone))}>
                        <Puzzle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#1f2937]">{skill.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-[#8a93a3]">{skill.summary}</p>
                      </div>
                      <CheckCircle2 className={cn('h-5 w-5 shrink-0', active ? 'text-[#2563eb]' : 'text-[#cbd5e1]')} />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#eef1f5] px-5 py-4">
              <button
                type="button"
                className="text-sm font-medium text-[#64748b] hover:text-[#334155]"
                onClick={() => chooseSkill(selectedSkillId)}
                disabled={!selectedSkillId}
              >
                清除选择
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white shadow-sm shadow-blue-100 hover:bg-[#1d4ed8]"
                onClick={() => {
                  setSkillPickerOpen(false)
                  router.push('/tutor/skills')
                }}
              >
                <Sparkles className="h-4 w-4" />
                打开商店
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 角色编辑弹窗 */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setRoleModalOpen(false)}>
          <div className="w-full max-w-[560px] bg-white rounded-2xl shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{roleModalMode === 'create' ? '创建角色' : '编辑角色'}</h3>
              <button className="w-8 h-8 rounded-lg hover:bg-[#f1f5f9] flex items-center justify-center" onClick={() => setRoleModalOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-[#64748b] mb-1 block">角色名称</label><input className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm focus:border-[#2563eb] focus:outline-none" placeholder="例如：严谨算法导师" value={roleDraft.name} onChange={(e) => setRoleDraft((p) => ({ ...p, name: e.target.value }))} /></div>
              <div><label className="text-xs text-[#64748b] mb-1 block">Persona</label><textarea className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm min-h-[60px] focus:border-[#2563eb] focus:outline-none" placeholder="角色个性与能力定位" value={roleDraft.persona} onChange={(e) => setRoleDraft((p) => ({ ...p, persona: e.target.value }))} /></div>
              <div><label className="text-xs text-[#64748b] mb-1 block">背景设定</label><textarea className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm min-h-[60px] focus:border-[#2563eb] focus:outline-none" placeholder="适用人群、教学场景" value={roleDraft.background} onChange={(e) => setRoleDraft((p) => ({ ...p, background: e.target.value }))} /></div>
              <div><label className="text-xs text-[#64748b] mb-1 block">风格指南</label><textarea className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm min-h-[60px] focus:border-[#2563eb] focus:outline-none" placeholder="回答风格、结构偏好" value={roleDraft.styleGuide} onChange={(e) => setRoleDraft((p) => ({ ...p, styleGuide: e.target.value }))} /></div>
              <div><label className="text-xs text-[#64748b] mb-1 block">规则约束</label><textarea className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm min-h-[60px] focus:border-[#2563eb] focus:outline-none" placeholder="不可做什么，必须做什么" value={roleDraft.rules} onChange={(e) => setRoleDraft((p) => ({ ...p, rules: e.target.value }))} /></div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setRoleModalOpen(false)} className="px-4 py-2 rounded-xl border border-[#e2e8f0] text-sm text-[#64748b]">取消</button>
              <button onClick={() => void handleSaveRoleFromModal()} disabled={savingRole || !roleDraft.name.trim()} className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-sm font-semibold disabled:opacity-40">保存</button>
            </div>
          </div>
        </div>
      )}
      <NewUserGuidePanel />
    </>
  )
}
