import { Input, ScrollView, Text, Video, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import AppHeader from '../../components/AppHeader'
import AppIcon from '../../components/AppIcon'
import AppTabBar from '../../components/AppTabBar'
import MarkdownMessage from '../../components/MarkdownMessage'
import { joinApiUrl } from '../../services/apiClient'
import { createConversation, createVideoJob, getRoles, requestTutorStream, requestVideoJobEvents, uploadTutorFile } from '../../services/tutorApi'
import type { Citation, ConfidenceLevel, McpCall, ToolProcessStep, TutorMessage, TutorRole, TutorStreamEvent, WorkshopPhase } from '../../types/tutor'
import { buildAskAiPrompt } from '../../utils/format'
import { consumeAskAiContext, getTutorDraft, setTutorDraft } from '../../utils/storage'
import './index.scss'

const defaultMessages: TutorMessage[] = []

const quickQuestions = [
  {
    title: '帮我梳理这章最重要的 3 个知识点',
    question: '帮我梳理这章最重要的 3 个知识点，并用适合复习的方式讲清楚。',
  },
  {
    title: '根据我现在的情况推荐今天先学什么',
    question: '根据我现在的学习情况，推荐我今天应该先学什么，并说明原因。',
  },
  {
    title: '把这个知识点讲到我能马上做题',
    question: '把这个知识点讲到我能马上做题，先讲思路，再给例题。',
  },
  {
    title: '给我 3 个最容易混淆的考点提醒',
    question: '给我 3 个最容易混淆的考点提醒，并告诉我怎么避免做错。',
  },
]

const modelOptions = ['Lite', 'Pro', 'Deep']

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`
}

function normalizeConfidence(event: TutorStreamEvent): ConfidenceLevel {
  const payload = event.payload as Record<string, unknown> | undefined
  const raw = String(payload?.level || payload?.confidence || payload?.label || '').toLowerCase()
  if (raw.includes('medium') || raw.includes('中')) return 'medium'
  if (raw.includes('low') || raw.includes('低')) return 'low'
  return 'high'
}

function appendMessageUpdate(messageId: string, updater: (message: TutorMessage) => TutorMessage) {
  return (messages: TutorMessage[]) => messages.map((message) => (message.id === messageId ? updater(message) : message))
}

function appendToolStep(messageId: string, step: ToolProcessStep) {
  return appendMessageUpdate(messageId, (message) => {
    const current = message.toolSteps || []
    const next = current.some((item) => item.id === step.id)
      ? current.map((item) => (item.id === step.id ? { ...item, ...step } : item))
      : [...current, step]
    return { ...message, toolSteps: next }
  })
}

function mcpStatusLabel(status: string) {
  if (status === 'discovering') return '正在发现工具'
  if (status === 'running') return '正在调用工具'
  if (status === 'done') return '工具已返回'
  if (status === 'error') return '工具调用失败'
  return '工具处理中'
}

function workshopPhaseLabel(payload: WorkshopPhase | undefined) {
  const phase = String(payload?.phase || '')
  const status = String((payload as Record<string, unknown> | undefined)?.status || '')
  const phaseLabel = phase === 'profile_analysis' ? '画像分析' : phase === 'discussion' ? '多智能体研讨' : phase === 'synthesis' ? '综合结论' : '智能体协作'
  return `${phaseLabel}${status === 'done' ? '完成' : '进行中'}`
}

function isToolProcessCollapsed(message: TutorMessage) {
  const steps = message.toolSteps || []
  return steps.length > 0 && !message.streaming && !steps.some((step) => step.status === 'running')
}

function toolProcessSummary(message: TutorMessage) {
  const steps = message.toolSteps || []
  if (steps.some((step) => step.status === 'error')) return '执行过程已收起，包含失败步骤'
  return `执行过程已完成，共 ${steps.length} 步`
}

function normalizeMcpCall(payload: Record<string, unknown> | undefined): McpCall {
  const resultContext = String(payload?.result_context || '')
  const resultPreview = String(payload?.result_preview || '')
  const resultText = extractMcpText(payload?.result || payload?.content || payload?.text || payload?.result_text || payload?.error)
  const summary = resultPreview || resultContext.split(/\r?\n/).find((line) => line.trim()) || resultText
  return {
    tool: String(payload?.tool || payload?.tool_name || ''),
    name: String(payload?.name || payload?.service_name || ''),
    status: String(payload?.status || ''),
    summary: String(payload?.summary || summary || ''),
    result: String(resultText || resultContext || resultPreview || ''),
  }
}

function extractMcpText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          return String(record.text || record.content || '')
        }
        return String(item || '')
      })
      .filter(Boolean)
      .join('\n')
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return extractMcpText(record.content || record.result || record.text || record.message || '')
  }
  return String(value || '')
}

function compactText(text: string, max = 140) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

function normalizeApiUrl(value: unknown) {
  const raw = String(value || '')
  return raw ? joinApiUrl(raw) : ''
}

function normalizeVideoResource(payload: Record<string, unknown> | undefined) {
  return {
    id: String(payload?.id || payload?.resource_id || ''),
    title: String(payload?.title || 'AI 视频'),
    status: String(payload?.status || ''),
    duration: Number(payload?.duration || 0) || 0,
    durationMs: Number(payload?.duration_ms || 0) || 0,
    createdAt: String(payload?.created_at || ''),
    videoUrl: normalizeApiUrl(payload?.video_url),
    audioUrl: normalizeApiUrl(payload?.audio_url),
    subtitleUrl: normalizeApiUrl(payload?.subtitle_url),
    timelineUrl: normalizeApiUrl(payload?.timeline_url),
    sceneUrl: normalizeApiUrl(payload?.scene_url),
    shareUrl: normalizeApiUrl(payload?.share_url),
    resolution: String(payload?.resolution || ''),
    fps: Number(payload?.fps || 0) || 0,
    provider: String(payload?.provider || ''),
    contentSource: String(payload?.content_source || ''),
    ttsProvider: String(payload?.tts_provider || ''),
    voiceProvider: String(payload?.voice_provider || ''),
    voice: String(payload?.voice || ''),
    hasMp4: Boolean(payload?.has_mp4),
    slides: Number(payload?.slides || 0) || 0,
    audioStatus: String(payload?.audio_status || ''),
    audioMessage: String(payload?.audio_message || ''),
    frameStatus: String(payload?.frame_status || ''),
    frameMessage: String(payload?.frame_message || ''),
    muxStatus: String(payload?.mux_status || ''),
    muxMessage: String(payload?.mux_message || ''),
    progress: Number(payload?.progress || 0) || 0,
    message: String(payload?.message || ''),
  }
}

function videoStatusLabel(status?: string) {
  if (!status) return '生成中'
  if (status === 'completed') return '已生成'
  if (status === 'failed') return '生成失败'
  return '生成中'
}

export default function TutorPage() {
  const initialDraft = useMemo(() => getTutorDraft(), [])
  const [roles, setRoles] = useState<TutorRole[]>([])
  const [currentRoleId, setCurrentRoleId] = useState<number | undefined>()
  const [conversationId, setConversationId] = useState<number | undefined>()
  const [messages, setMessages] = useState<TutorMessage[]>(defaultMessages)
  const [question, setQuestion] = useState('')
  const [modelName, setModelName] = useState(initialDraft?.modelName || 'Lite')
  const [workshopEnabled, setWorkshopEnabled] = useState(initialDraft?.workshopEnabled || false)
  const [mcpEnabled, setMcpEnabled] = useState(initialDraft?.mcpEnabled || false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(Boolean(initialDraft?.webSearchEnabled))
  const [imageModeEnabled, setImageModeEnabled] = useState(Boolean(initialDraft?.imageModeEnabled))
  const [videoModeEnabled, setVideoModeEnabled] = useState(Boolean(initialDraft?.videoModeEnabled))
  const [trustModeEnabled, setTrustModeEnabled] = useState(initialDraft?.trustModeEnabled !== false)
  const [streaming, setStreaming] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [fileIds, setFileIds] = useState<number[]>([])
  const [recording, setRecording] = useState(false)
  const [, setExpandedMessageId] = useState('welcome')
  const pendingAskAi = useRef(false)

  const currentRole = useMemo(() => roles.find((role) => role.id === currentRoleId), [roles, currentRoleId])
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  const multimodalModeIcon = videoModeEnabled ? 'video' : 'image'
  const multimodalModeLabel = videoModeEnabled ? '视频生成模式' : '图片生成模式'
  const multimodalModeHint = videoModeEnabled ? '发送后会生成可直接播放的教学视频。' : '发送后会生成图片内容。'

  useEffect(() => {
    if (!initialDraft) return
    setConversationId(initialDraft.conversationId)
    setCurrentRoleId(initialDraft.currentRoleId)
    setMessages(initialDraft.messages.length ? initialDraft.messages : defaultMessages)
    setQuestion(initialDraft.question)
    setModelName(initialDraft.modelName || 'Lite')
    setWorkshopEnabled(initialDraft.workshopEnabled)
    setMcpEnabled(initialDraft.mcpEnabled)
    setWebSearchEnabled(Boolean(initialDraft.webSearchEnabled))
    setImageModeEnabled(Boolean(initialDraft.imageModeEnabled))
    setVideoModeEnabled(Boolean(initialDraft.videoModeEnabled))
    setTrustModeEnabled(initialDraft.trustModeEnabled !== false)
    setFileIds(initialDraft.fileIds)
  }, [initialDraft])

  useEffect(() => {
    getRoles()
      .then((items) => {
        const safeItems = Array.isArray(items) ? items : []
        setRoles(safeItems)
        if (!initialDraft?.currentRoleId && safeItems[0]?.id) {
          setCurrentRoleId(safeItems[0].id)
        }
      })
      .catch(() => {
        setRoles([])
      })

    const askAiContext = consumeAskAiContext()
    if (askAiContext && !pendingAskAi.current) {
      pendingAskAi.current = true
      setQuestion(buildAskAiPrompt(askAiContext))
    }
  }, [initialDraft?.currentRoleId])

  useEffect(() => {
    setTutorDraft({
      conversationId,
      currentRoleId,
      messages,
      question,
      modelName,
      workshopEnabled,
      mcpEnabled,
      webSearchEnabled,
      imageModeEnabled,
      videoModeEnabled,
      trustModeEnabled,
      fileIds,
    })
  }, [conversationId, currentRoleId, fileIds, imageModeEnabled, mcpEnabled, messages, modelName, question, trustModeEnabled, videoModeEnabled, webSearchEnabled, workshopEnabled])

  const patchAssistant = (messageId: string, event: TutorStreamEvent) => {
    if (event.type === 'text') {
      const payload = event.payload as Record<string, unknown> | undefined
      const content = String(payload?.content || '')
      if (!content) return
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, content: `${message.content}${content}` })))
      return
    }

    if (event.type === 'search_results') {
      const payload = event.payload as { items?: unknown[] } | undefined
      const count = Array.isArray(payload?.items) ? payload.items.length : 0
      setMessages(appendToolStep(messageId, {
        id: 'web-search',
        label: '联网搜索完成',
        detail: count ? `找到 ${count} 条网页结果` : '已尝试联网搜索',
        status: 'done',
      }))
      return
    }

    if (event.type === 'confidence') {
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, confidence: normalizeConfidence(event) })))
      setMessages(appendToolStep(messageId, {
        id: 'confidence',
        label: '可信度分析完成',
        detail: `当前回答可信度：${normalizeConfidence(event) === 'high' ? '高' : normalizeConfidence(event) === 'medium' ? '中' : '低'}`,
        status: 'done',
      }))
      return
    }

    if (event.type === 'citations' || event.type === 'sources') {
      const payload = event.payload as { items?: Citation[] } | Citation[] | undefined
      const items = Array.isArray(payload) ? payload : payload?.items || []
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, citations: items })))
      if (items.length) {
        setMessages(appendToolStep(messageId, {
          id: event.type === 'sources' ? 'file-sources' : 'citations',
          label: event.type === 'sources' ? '已读取资料来源' : '已整理引用来源',
          detail: `找到 ${items.length} 条可参考来源`,
          status: 'done',
        }))
      }
      return
    }

    if (event.type === 'workshop_phase' || event.type === 'hub') {
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, workshop: [...(message.workshop || []), event.payload as WorkshopPhase] })))
      const payload = event.payload as WorkshopPhase | undefined
      if (event.type === 'workshop_phase') {
        const status = String((payload as Record<string, unknown> | undefined)?.status || '')
        setMessages(appendToolStep(messageId, {
          id: `workshop-${payload?.phase || 'phase'}-${(payload as Record<string, unknown> | undefined)?.round || 0}`,
          label: workshopPhaseLabel(payload),
          detail: status === 'done' ? '该阶段结果已进入回答上下文' : '智能体正在协作分析',
          status: status === 'done' ? 'done' : 'running',
        }))
      }
      return
    }

    if (event.type === 'mcp_call') {
      const payload = event.payload as Record<string, unknown> | undefined
      const call = normalizeMcpCall(payload)
      const toolName = String(payload?.tool_name || call.tool || 'MCP 工具')
      const status = String(payload?.status || call.status || 'running')
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, mcpCalls: [...(message.mcpCalls || []), call] })))
      setMessages(appendToolStep(messageId, {
        id: `mcp-${String(payload?.service_id || call.name || 'service')}-${toolName}`,
        label: mcpStatusLabel(status),
        detail: `${String(payload?.service_name || call.name || 'MCP 服务')} · ${toolName}`,
        status: status === 'error' ? 'error' : status === 'done' ? 'done' : 'running',
      }))
      return
    }

    if (event.type === 'trust_meta') {
      const payload = event.payload as { mcp_calls?: McpCall[] } | undefined
      const calls = payload?.mcp_calls
      if (Array.isArray(calls)) {
        setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, mcpCalls: calls.map((item) => normalizeMcpCall(item as unknown as Record<string, unknown>)) })))
      }
      setMessages(appendToolStep(messageId, {
        id: 'trust-meta',
        label: '可信回答校验完成',
        detail: Array.isArray(calls) && calls.length ? `纳入 ${calls.length} 个工具结果` : '已完成回答依据检查',
        status: 'done',
      }))
      return
    }

    if (event.type === 'error') {
      const payload = event.payload as { message?: string; detail?: string } | undefined
      const error = payload?.message || payload?.detail || 'AI 输出中断'
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, error, streaming: false })))
      setMessages(appendToolStep(messageId, {
        id: 'error',
        label: '回答生成中断',
        detail: error,
        status: 'error',
      }))
    }
  }

  const ensureConversation = async () => {
    if (conversationId) return conversationId
    try {
      const conversation = await createConversation('小程序 AI 助学', currentRoleId)
      if (conversation?.id) {
        setConversationId(conversation.id)
        return conversation.id
      }
    } catch {
      // Keep fallback behavior.
    }
    return undefined
  }

  const handleSendLegacy = async () => {
    const text = question.trim()
    if (!text || streaming) return

    const userMessage: TutorMessage = { id: nextId('user'), role: 'user', content: text }
    const assistantId = nextId('assistant')
    const assistantMessage: TutorMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
      confidence: 'high',
      citations: [],
      workshop: [],
      mcpCalls: [],
      toolSteps: [
        {
          id: 'submitted',
          label: '已接收问题',
          detail: '正在组织回答上下文',
          status: 'done',
        },
        {
          id: 'thinking',
          label: '正在生成回答',
          detail: modelName ? `当前模型：${modelName}` : 'AI 助学导师正在思考',
          status: 'running',
        },
      ],
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setExpandedMessageId(assistantId)
    setQuestion('')
    setStreaming(true)

    try {
      const activeConversationId = await ensureConversation()
      await requestTutorStream({
        message: text,
        conversationId: activeConversationId,
        roleId: currentRoleId,
        fileIds,
        workshopEnabled,
        mcpEnabled,
        pageContext: {
          modes: {
            model: modelName,
            web_search: webSearchEnabled,
            image_mode: imageModeEnabled,
            trust_mode: trustModeEnabled,
          },
          attachments: {
            image_count: images.length,
            note: images.length ? '图片已附加到本次提问。' : undefined,
          },
        },
        onEvent: (event) => patchAssistant(assistantId, event),
      })
      setMessages(appendMessageUpdate(assistantId, (message) => ({ ...message, streaming: false })))
      setMessages(appendToolStep(assistantId, {
        id: 'thinking',
        label: '回答生成完成',
        detail: '已整理为可阅读回复',
        status: 'done',
      }))
      setImages([])
      setFileIds([])
    } catch (err) {
      const error = err instanceof Error ? err.message : 'AI 连接失败'
      setMessages(appendMessageUpdate(assistantId, (message) => ({ ...message, streaming: false, error })))
      Taro.showToast({ title: '发送失败', icon: 'none' })
    } finally {
      setStreaming(false)
    }
  }

  const handleRoleSelect = () => {
    if (!roles.length) {
      Taro.showToast({ title: '暂无可选角色', icon: 'none' })
      return
    }
    Taro.showActionSheet({
      itemList: roles.slice(0, 6).map((role) => role.name || `角色 ${role.id}`),
      success: (res) => {
        const role = roles[res.tapIndex]
        if (role) setCurrentRoleId(role.id)
      },
    })
  }

  const handleModelSelect = () => {
    Taro.showActionSheet({
      itemList: modelOptions,
      success: (res) => {
        const model = modelOptions[res.tapIndex]
        if (model) setModelName(model)
      },
    })
  }

  const setMultimodalMode = (mode: 'image' | 'video' | null) => {
    setImageModeEnabled(mode === 'image')
    setVideoModeEnabled(mode === 'video')
    setImages([])
    setFileIds([])
  }

  const toggleVideoMode = () => {
    if (videoModeEnabled) {
      setMultimodalMode(null)
      return
    }
    setMultimodalMode('video')
  }

  const handleMultimodalModeSelect = () => {
    const itemList = ['关闭多模态', '图片模式', '视频模式']
    const currentIndex = videoModeEnabled ? 2 : imageModeEnabled ? 1 : 0
    Taro.showActionSheet({
      itemList,
      success: (res) => {
        const nextIndex = res.tapIndex
        if (nextIndex === currentIndex) return
        if (nextIndex === 1) {
          setMultimodalMode('image')
          return
        }
        if (nextIndex === 2) {
          setMultimodalMode('video')
          return
        }
        setMultimodalMode(null)
      },
    })
  }

  const patchVideoAssistant = (messageId: string, event: { type: string; payload?: any }) => {
    if (event.type === 'progress') {
      const payload = event.payload || {}
      const progress = Number(payload.progress || 0) || 0
      const statusText = String(payload.message || '视频生成中...')
      setMessages(appendToolStep(messageId, {
        id: 'video-task',
        label: '视频生成中',
        detail: `${statusText}${progress ? ` · ${Math.round(progress)}%` : ''}`,
        status: 'running',
      }))
      setMessages(appendMessageUpdate(messageId, (message) => ({
        ...message,
        content: statusText,
        videoResource: {
          ...(message.videoResource || { id: messageId, title: statusText }),
          id: String(payload.resource_id || message.videoResource?.id || messageId),
          title: message.videoResource?.title || statusText,
          status: 'processing',
          progress,
          message: statusText,
        },
      })))
      return
    }

    if (event.type === 'artifact') {
      const payload = event.payload || {}
      setMessages(appendToolStep(messageId, {
        id: `video-artifact-${String(payload.kind || 'asset')}`,
        label: '视频产物已生成',
        detail: String(payload.kind || '预览资源已返回'),
        status: 'done',
      }))
      setMessages(appendMessageUpdate(messageId, (message) => ({
        ...message,
        videoResource: {
          ...(message.videoResource || { id: messageId, title: message.content || 'AI 视频' }),
          id: String(payload.resource_id || message.videoResource?.id || messageId),
          timelineUrl: String(payload.url || message.videoResource?.timelineUrl || ''),
        },
      })))
      return
    }

    if (event.type === 'done') {
      const payload = event.payload || {}
      const resource = normalizeVideoResource(payload.resource as Record<string, unknown> | undefined)
      setMessages(appendToolStep(messageId, {
        id: 'video-task',
        label: '视频生成完成',
        detail: resource.videoUrl ? '已生成可播放视频' : '已生成视频预览资源',
        status: 'done',
      }))
      setMessages(appendMessageUpdate(messageId, (message) => ({
        ...message,
        content: message.content || resource.title || '视频生成完成',
        streaming: false,
        videoResource: {
          ...resource,
          status: resource.status || 'completed',
        },
      })))
    }
  }

  const handleNewConversation = async () => {
    if (streaming) return
    setMessages(defaultMessages)
    setQuestion('')
    setImages([])
    setFileIds([])
    setImageModeEnabled(false)
    setVideoModeEnabled(false)
    setExpandedMessageId('welcome')
    try {
      const conversation = await createConversation('新的学习对话', currentRoleId)
      setConversationId(conversation?.id)
      Taro.showToast({ title: '已新建对话', icon: 'success' })
    } catch {
      setConversationId(undefined)
      Taro.showToast({ title: '已清空当前对话', icon: 'none' })
    }
  }

  const handleVoice = () => {
    try {
      const recorder = Taro.getRecorderManager()
      if (recording) {
        recorder.stop()
        setRecording(false)
        return
      }
      recorder.onStop(() => {
        setRecording(false)
        setQuestion((value) => value || '请把刚才的语音转成文字后继续发送。')
        Taro.showToast({ title: '录音已完成', icon: 'none' })
      })
      recorder.start({ duration: 60000, format: 'mp3' })
      setRecording(true)
      Taro.showToast({ title: '开始录音', icon: 'none' })
    } catch {
      Taro.showToast({ title: '当前环境暂不支持录音', icon: 'none' })
    }
  }

  const handleImage = () => {
    setImageModeEnabled((value) => !value)
    if (videoModeEnabled) {
      setVideoModeEnabled(false)
    }
  }

  const handleFile = async () => {
    let loadingShown = false
    try {
      const res = await Taro.chooseMessageFile({ count: 3, type: 'file' })
      Taro.showLoading({ title: '上传中' })
      loadingShown = true
      const uploaded = await Promise.all(res.tempFiles.map((file) => uploadTutorFile(file.path, file.name)))
      const ids = uploaded.map((item) => Number(item.file_id || item.id)).filter((id) => Number.isFinite(id))
      setFileIds((prev) => [...prev, ...ids])
      Taro.showToast({ title: ids.length ? '文件已加入' : '上传完成', icon: 'none' })
    } catch {
      Taro.showToast({ title: '文件上传失败', icon: 'none' })
    } finally {
      if (loadingShown) Taro.hideLoading()
    }
  }

  const handleSendWithText = async (rawText: string) => {
    const text = rawText.trim()
    if (!text || streaming) return

    const userMessage: TutorMessage = { id: nextId('user'), role: 'user', content: text }
    const assistantId = nextId('assistant')
    const assistantMessage: TutorMessage = {
      id: assistantId,
      role: 'assistant',
      content: videoModeEnabled ? '正在生成视频...' : '',
      streaming: true,
      confidence: 'high',
      citations: [],
      workshop: [],
      mcpCalls: [],
      toolSteps: [
        {
          id: 'submitted',
          label: '已接收问题',
          detail: videoModeEnabled ? '正在准备视频生成任务' : '正在组织回答上下文',
          status: 'done',
        },
        {
          id: videoModeEnabled ? 'video-task' : 'thinking',
          label: videoModeEnabled ? '正在创建视频任务' : '正在生成回答',
          detail: videoModeEnabled ? '脚本、画面和语音会依次生成' : `当前模型：${modelName}`,
          status: 'running',
        },
      ],
      ...(videoModeEnabled
        ? {
            videoResource: {
              id: assistantId,
              title: text,
              status: 'queued',
              progress: 0,
              message: '正在创建视频任务',
            },
          }
        : {}),
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setExpandedMessageId(assistantId)
    setQuestion('')
    setStreaming(true)

    try {
      const activeConversationId = await ensureConversation()
      if (videoModeEnabled) {
        Taro.showLoading({ title: '正在生成视频' })
        const videoJob = await createVideoJob({
          prompt: text,
          title: text.slice(0, 40),
          duration_sec: 90,
          style_id: 'apple-minimal',
          target_level: 'beginner',
          video_provider: 'html_ppt',
          output: {},
        })
        await requestVideoJobEvents(videoJob.events_url, (event) => patchVideoAssistant(assistantId, event))
        setMessages(appendMessageUpdate(assistantId, (message) => ({
          ...message,
          streaming: false,
          content: message.content || '视频生成完成',
        })))
        setMessages(appendToolStep(assistantId, {
          id: 'video-task',
          label: '视频生成完成',
          detail: '视频结果已返回到当前对话',
          status: 'done',
        }))
        setImages([])
        setFileIds([])
        Taro.showToast({ title: '视频已生成', icon: 'success' })
      } else {
        await requestTutorStream({
          message: text,
          conversationId: activeConversationId,
          roleId: currentRoleId,
          fileIds,
          mode: imageModeEnabled ? 'image_gen' : 'knowledge_qa',
          openMode: imageModeEnabled,
          workshopEnabled,
          mcpEnabled,
          webSearch: webSearchEnabled,
          model: modelName,
          pageContext: {
            page: '/miniapp/tutor',
            modes: {
              model: modelName,
              web_search: webSearchEnabled,
              image_mode: imageModeEnabled,
              trust_mode: trustModeEnabled,
            },
            attachments: {
              image_count: images.length,
              note: images.length ? '图片已附加到本次提问。' : undefined,
            },
          },
          onEvent: (event) => patchAssistant(assistantId, event),
        })
        setMessages(appendMessageUpdate(assistantId, (message) => ({ ...message, streaming: false })))
        setMessages(appendToolStep(assistantId, {
          id: 'thinking',
          label: '回答生成完成',
          detail: '已整理为可阅读回复',
          status: 'done',
        }))
        setImages([])
        setFileIds([])
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'AI 连接失败'
      setMessages(appendMessageUpdate(assistantId, (message) => ({ ...message, streaming: false, error })))
      setMessages(appendToolStep(assistantId, {
        id: videoModeEnabled ? 'video-task' : 'thinking',
        label: videoModeEnabled ? '视频生成失败' : '回答生成失败',
        detail: error,
        status: 'error',
      }))
      Taro.showToast({ title: videoModeEnabled ? '视频生成失败' : '发送失败', icon: 'none' })
    } finally {
      if (videoModeEnabled) {
        Taro.hideLoading()
      }
      setStreaming(false)
    }
  }

  const handleSend = async () => {
    await handleSendWithText(question)
  }

  const handleQuickQuestionAsk = async (text: string) => {
    await handleSendWithText(text)
  }

  const copyVideoLink = async (message: TutorMessage) => {
    const resource = message.videoResource
    const link = resource?.shareUrl || resource?.sceneUrl || resource?.timelineUrl || resource?.videoUrl || ''
    if (!link) {
      Taro.showToast({ title: '暂无可复制链接', icon: 'none' })
      return
    }
    try {
      await Taro.setClipboardData({ data: link })
      Taro.showToast({ title: '链接已复制', icon: 'success' })
    } catch {
      Taro.showToast({ title: '复制失败', icon: 'none' })
    }
  }

  return (
    <View className='app-page tutor-page'>
      <AppHeader title='AI助学'>
        <View className='role-pill' hoverClass='tap-active' onClick={handleRoleSelect}>
          <View className='status-dot status-dot--violet' />
          <Text>{currentRole?.name || '默认导师'}</Text>
        </View>
        <View className='icon-button' hoverClass='tap-active' onClick={handleNewConversation}>
          <AppIcon name='plus' className='header-action-icon' />
        </View>
      </AppHeader>

      <ScrollView scrollY enhanced showScrollbar={false} className='tutor-scroll' scrollIntoView={lastAssistant?.id}>
        {messages.length === 0 ? (
          <View className='quick-start'>
            <View className='quick-start__icon'>
              <AppIcon name='sparkles' className='quick-start__icon-inner' />
            </View>
            <Text className='quick-start__title'>有什么我能帮你的吗？</Text>
            <Text className='quick-start__subtitle'>直接提问，或点一个快捷问题马上开始。</Text>
            <View className='quick-question-grid'>
              {quickQuestions.map((item) => (
                <View key={item.title} className='quick-question' hoverClass='tap-active' onClick={() => handleQuickQuestionAsk(item.question)}>
                  <Text className='quick-question__title'>{item.title}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View className='message-stack'>
            {messages.map((message) => (
              message.role === 'user' ? (
                <View key={message.id} id={message.id} className='message-row message-row--user'>
                  <View className='message-bubble message-bubble--user'>
                    <Text>{message.content}</Text>
                  </View>
                </View>
              ) : (
                <View key={message.id} id={message.id} className='assistant-message'>
                  <View className='assistant-avatar'>
                    <AppIcon name='bot' className='assistant-avatar__icon' />
                  </View>
                  <View className='assistant-message__body'>
                    <View className='message-bubble message-bubble--assistant'>
                      <MarkdownMessage content={message.content || (message.streaming ? '正在思考...' : '暂无内容')} />
                      {message.error ? <Text className='assistant-message__error'>{message.error}</Text> : null}
                    </View>
                    {message.toolSteps?.length ? (
                      <View className={`tool-process ${isToolProcessCollapsed(message) ? 'tool-process--collapsed' : ''}`}>
                        <View className='tool-process__head'>
                          <Text className='tool-process__title'>{isToolProcessCollapsed(message) ? '智能体执行完成' : '智能体实时过程'}</Text>
                          <Text className='tool-process__count'>{isToolProcessCollapsed(message) ? '已收起' : `${message.toolSteps.length} 步`}</Text>
                        </View>
                        {isToolProcessCollapsed(message) ? <Text className='tool-process__summary'>{toolProcessSummary(message)}</Text> : null}
                        {message.toolSteps.map((step) => (
                          <View key={step.id} className={`tool-process__item tool-process__item--${step.status}`}>
                            <View className='tool-process__dot' />
                            <View className='tool-process__content'>
                              <Text className='tool-process__label'>{step.label}</Text>
                              {step.detail ? <Text className='tool-process__detail'>{step.detail}</Text> : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {message.mcpCalls?.length ? (
                      <View className='mcp-result-list'>
                        {message.mcpCalls.filter((call) => call.tool !== 'tools/list').map((call, index) => {
                          const result = call.result || call.summary || call.status || ''
                          return (
                            <View key={`${call.tool || call.name || 'mcp'}-${index}`} className='mcp-result-card'>
                              <View className='mcp-result-card__head'>
                                <Text className='mcp-result-card__title'>{call.name || call.tool || 'MCP 工具'}</Text>
                                <Text className={`mcp-result-card__status ${call.status === 'error' ? 'is-error' : ''}`}>
                                  {call.status === 'done' ? '已返回' : call.status === 'error' ? '失败' : '调用中'}
                                </Text>
                              </View>
                              {result ? <Text className='mcp-result-card__body'>{compactText(result, 220)}</Text> : null}
                            </View>
                          )
                        })}
                      </View>
                    ) : null}
                    {message.videoResource ? (
                      <View className='video-result-card'>
                        <View className='video-result-card__head'>
                          <View>
                            <Text className='video-result-card__title'>{message.videoResource.title || 'AI 视频'}</Text>
                            <Text className='video-result-card__subtitle'>
                              {message.videoResource.provider || '视频生成'} · {videoStatusLabel(message.videoResource.status)}
                            </Text>
                          </View>
                          <Text className='video-result-card__status'>{Math.round(message.videoResource.progress || 0)}%</Text>
                        </View>

                        <View className='video-result-card__preview'>
                          {message.videoResource.videoUrl && message.videoResource.hasMp4 !== false ? (
                            <Video
                              className='video-result-card__video'
                              src={message.videoResource.videoUrl}
                              controls
                              showPlayBtn
                              showFullscreenBtn
                            />
                          ) : (
                            <View className='video-result-card__preview-empty'>
                              <Text>{message.videoResource.sceneUrl ? '预览页已生成，但当前小程序环境不支持直接嵌入。' : '视频正在准备中，生成完成后会自动显示预览。'}</Text>
                            </View>
                          )}
                        </View>

                        <Text className='video-result-card__footer'>
                          {message.videoResource.message || '视频任务已创建，稍后会自动回传结果。'}
                        </Text>
                        {(message.videoResource.shareUrl || message.videoResource.sceneUrl || message.videoResource.timelineUrl) ? (
                          <View className='video-result-card__actions'>
                            <View className='video-result-card__action' hoverClass='tap-active' onClick={() => copyVideoLink(message)}>
                              <Text>复制预览链接</Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              )
            ))}
          </View>
        )}
      </ScrollView>

      <View className='composer'>
        {(imageModeEnabled || videoModeEnabled) ? (
          <View className={`multimodal-preview-banner ${videoModeEnabled ? 'multimodal-preview-banner--video' : 'multimodal-preview-banner--image'}`}>
            <View className='multimodal-preview-banner__icon'>
              <AppIcon name={multimodalModeIcon} className='multimodal-preview-banner__icon-inner' />
            </View>
            <View className='multimodal-preview-banner__body'>
              <Text className='multimodal-preview-banner__title'>{multimodalModeLabel}</Text>
              <Text className='multimodal-preview-banner__text'>{multimodalModeHint}</Text>
            </View>
          </View>
        ) : null}

        <ScrollView scrollX enhanced showScrollbar={false} className='composer-options'>
          <View className='option-strip'>
            <View className='option-chip option-chip--model' hoverClass='tap-active' onClick={handleModelSelect}>
              <AppIcon name='sparkles' className='option-chip__icon' />
              <Text>{modelName}</Text>
            </View>
            <View className={`option-chip ${webSearchEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setWebSearchEnabled((value) => !value)}>
              <AppIcon name='globe' className='option-chip__icon' />
              <Text>联网搜索</Text>
            </View>
            <View className={`option-chip option-chip--video ${videoModeEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={toggleVideoMode}>
              <AppIcon name='video' className='option-chip__icon' />
              <Text>视频生成</Text>
            </View>
            <View className={`option-chip ${mcpEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setMcpEnabled((value) => !value)}>
              <AppIcon name='cpu' className='option-chip__icon' />
              <Text>MCP模式</Text>
            </View>
            <View className={`option-chip ${workshopEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setWorkshopEnabled((value) => !value)}>
              <AppIcon name='users' className='option-chip__icon' />
              <Text>研讨会模式</Text>
            </View>
            <View className={`option-chip ${imageModeEnabled || images.length ? 'is-on' : ''}`} hoverClass='tap-active' onClick={handleImage}>
              <AppIcon name='image' className='option-chip__icon' />
              <Text>图片模式</Text>
            </View>
            <View className={`option-chip ${trustModeEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setTrustModeEnabled((value) => !value)}>
              <AppIcon name='shield' className='option-chip__icon' />
              <Text>可信模式</Text>
            </View>
          </View>
        </ScrollView>

        <View className='composer-main'>
          <Input
            className='question-input'
            value={question}
            placeholder='发送消息或按住说话...'
            placeholderClass='question-input__placeholder'
            disabled={streaming}
            onInput={(event) => setQuestion(event.detail.value)}
            confirmType='send'
            onConfirm={handleSend}
          />
          <View className='composer-action composer-action--add' hoverClass='tap-active' onClick={handleFile}>
            <AppIcon name='folder' className='composer-action__icon' />
          </View>
          <View className={`composer-action composer-action--voice ${recording ? 'is-on' : ''}`} hoverClass='tap-active' onClick={handleVoice}>
            <AppIcon name='mic' className='composer-action__icon' />
          </View>
          <View className={`composer-action composer-action--send ${streaming || !question.trim() ? 'is-disabled' : ''}`} hoverClass='tap-active' onClick={handleSend}>
            <AppIcon name='send' className='composer-action__icon composer-action__icon--light' />
          </View>
        </View>
      </View>

      <AppTabBar current='tutor' />
    </View>
  )
}
