'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, CitationItem, ConfidenceInfo, Message, TutorConversation, TutorFile, TutorRole, WorkshopHubEvent } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'
import {
  Bot,
  FileText,
  MessageSquareText,
  Mic,
  MicOff,
  Paperclip,
  Pause,
  Pencil,
  Plus,
  Puzzle,
  Save,
  Send,
  Trash2,
  UserCog,
  Volume2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  ArrowLeft,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
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

type RoleModalMode = 'create' | 'edit'

type WorkshopSummary = {
  optimizedQuestion: string
  coreConclusion: string
  steps: string[]
  followUps: string[]
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
  const followRaw = full.slice(headIdx.f + '可追问问题'.length).replace(/^\(\d+条\)/, '').replace(/^[:：\-\s]+/, '').trim()

  const splitToItems = (raw: string) => {
    if (!raw) return []
    const byLine = raw.split('\n').map((x) => x.trim()).filter(Boolean)
    if (byLine.length > 1) {
      return byLine
        .map((x) => x.replace(/^[\-\*\d]+\s*[\.\)\、]?\s*/, '').trim())
        .filter(Boolean)
    }
    const oneLine = byLine[0] || raw.trim()
    return oneLine
      .split(/\s+(?=[a-zA-Z]\.)|\s+(?=\d+[\.\)\、])/g)
      .map((x) => x.replace(/^[\-\*\dA-Za-z]+\s*[\.\)\、]?\s*/, '').trim())
      .filter(Boolean)
  }

  const steps = splitToItems(stepsRaw)
  const followUps = splitToItems(followRaw)

  if (!optimizedQuestion && !coreConclusion && steps.length === 0 && followUps.length === 0) return null
  return { optimizedQuestion, coreConclusion, steps, followUps }
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

  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [workshopEnabled, setWorkshopEnabled] = useState(false)
  const [workshopRoleIds, setWorkshopRoleIds] = useState<number[]>([])
  const [hubMessages, setHubMessages] = useState<WorkshopHubEvent[]>([])
  const [workshopPhase, setWorkshopPhase] = useState<{ phase: string; round?: number; status: string } | null>(null)
  const [workshopRunId, setWorkshopRunId] = useState(0)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [roleModalMode, setRoleModalMode] = useState<RoleModalMode>('create')
  const [roleEditingId, setRoleEditingId] = useState<number | null>(null)
  const [roleDraft, setRoleDraft] = useState<RoleDraft>(EMPTY_ROLE_DRAFT)
  const [savingRole, setSavingRole] = useState(false)
  const [trustPanelOpenByMsg, setTrustPanelOpenByMsg] = useState<Record<string, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // TTS playback
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null)
  const [ttsLoading, setTtsLoading] = useState<string | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsBlobUrlRef = useRef<string | null>(null)

  // Voice input
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<any>(null)
  const voiceBaseRef = useRef<string>('')

  const playTts = useCallback(async (msgId: string, text: string) => {
    if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null }
    if (ttsBlobUrlRef.current) { URL.revokeObjectURL(ttsBlobUrlRef.current); ttsBlobUrlRef.current = null }
    if (playingMsgId === msgId) { setPlayingMsgId(null); return }
    setTtsLoading(msgId)
    try {
      const blob = await api.synthesizeSpeech(text.replace(/[#*`>\-|[\]()]/g, '').slice(0, 2000))
      const url = URL.createObjectURL(blob)
      ttsBlobUrlRef.current = url
      const audio = new Audio(url)
      ttsAudioRef.current = audio
      audio.addEventListener('ended', () => setPlayingMsgId(null))
      await audio.play()
      setPlayingMsgId(msgId)
    } catch { /* TTS failed */ }
    finally { setTtsLoading(null) }
  }, [playingMsgId])

  const toggleVoiceInput = useCallback(() => {
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('当前浏览器不支持语音识别，请使用 Chrome。'); return }
    const recognition = new SR()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    voiceBaseRef.current = input
    recognition.onresult = (event: any) => {
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

  const hasInteracted = messages.length > 0

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
        setMessages(history)
      } else {
        setMessages([])
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

      if (selectedConversation) {
        const history = await api.getChatHistory(selectedConversation.id)
        setMessages(history)
      } else {
        setMessages([])
      }

      hydrateRoleDraft(roleData.find((r) => r.id === selectedRoleId) || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWorkspace()
  }, [])

  useEffect(() => {
    // 使用 requestAnimationFrame 确保 DOM 已更新后再滚动
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [messages])

  useEffect(() => {
    if (!currentRoleId) return
    setWorkshopRoleIds((prev) => (prev.length > 0 ? prev : [currentRoleId]))
  }, [currentRoleId])

  async function switchConversation(conversation: TutorConversation) {
    try {
      setActionError(null)
      setCurrentConversationId(conversation.id)
      setHubMessages([])
      setWorkshopPhase(null)
      setPendingFiles([])
      const history = await api.getChatHistory(conversation.id)
      setMessages(history)

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

  function openCreateRoleModal() {
    setRoleModalMode('create')
    setRoleEditingId(null)
    setRoleDraft(EMPTY_ROLE_DRAFT)
    setRoleModalOpen(true)
  }

  function openEditRoleModal(role: TutorRole) {
    setRoleModalMode('edit')
    setRoleEditingId(role.id)
    hydrateRoleDraft(role)
    setRoleModalOpen(true)
  }

  async function handleDeleteRole(roleId: number) {
    try {
      setActionError(null)
      await api.deleteTutorRole(roleId)
      const refreshedRoles = await api.getTutorRoles()
      setRoles(refreshedRoles)
      const nextRole = refreshedRoles[0] || null
      setCurrentRoleId(nextRole?.id ?? null)
      await refreshConversations(currentConversationId)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除角色失败，请检查后端服务')
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

  function removePendingFile(fileId: number) {
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  function toggleWorkshopRole(roleId: number) {
    setWorkshopRoleIds((prev) => {
      if (prev.includes(roleId)) {
        const next = prev.filter((id) => id !== roleId)
        if (next.length > 0) return next
        return [roleId]
      }
      return [...prev, roleId]
    })
  }

  async function handleDeleteMessage(messageId: string) {
    try {
      setActionError(null)
      await api.deleteTutorMessage(messageId)
      if (!currentConversationId) return
      const history = await api.getChatHistory(currentConversationId)
      setMessages(history)
      await refreshConversations(currentConversationId)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除消息失败，请检查后端服务')
    }
  }

  async function handleSend(sendText?: string) {
    const textValue = (sendText ?? input).trim()
    if ((!textValue && pendingFiles.length === 0) || streaming) return

    // 如果没有当前会话，自动创建一个
    let convId = currentConversationId
    if (!convId) {
      try {
        const created = await api.createTutorConversation({ title: textValue.slice(0, 20) || '新对话', roleId: currentRoleId || undefined })
        setConversations((prev) => [created, ...prev])
        setCurrentConversationId(created.id)
        convId = created.id
      } catch {
        setActionError('创建会话失败')
        return
      }
    }

    const userInput = textValue || '（空文本）'
    const msgUid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const userMsg: Message = {
      id: `u-${msgUid}`,
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
      conversationId: convId,
      fileNames: pendingFiles.map((f) => f.filename),
    }

    const assistantId = `a-${msgUid}`
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString(), conversationId: convId },
    ])

    setInput('')
    setStreaming(true)
    setHubMessages([])
    setWorkshopPhase(workshopEnabled ? { phase: 'profile_analysis', status: 'running' } : null)
    setWorkshopRunId((v) => v + 1)

    try {
      setActionError(null)
      await api.sendMessage(
        userInput,
        {
          conversationId: convId,
          roleId: currentRoleId || undefined,
          fileIds: pendingFiles.map((f) => f.id),
          workshopEnabled,
          workshopRoleIds,
        },
        {
          onText: (chunk) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `${m.content}${chunk}` } : m)))
          },
          onConfidence: (confidence: ConfidenceInfo) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, confidence } : m)))
          },
          onCitations: (citations: CitationItem[]) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, citations } : m)))
          },
          onTrustMeta: (trustMeta: Record<string, unknown>) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, trustMeta } : m)))
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
      setPendingFiles([])
      await refreshConversations(convId)
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: '抱歉，模型服务暂时不可用，请稍后重试。' } : m)))
      setActionError(e instanceof Error ? e.message : '发送失败，请检查后端服务')
    } finally {
      setStreaming(false)
    }
  }

  function applySuggestion(text: string) {
    setInput(text)
  }

  function toggleTrustPanel(messageId: string) {
    setTrustPanelOpenByMsg((prev) => ({ ...prev, [messageId]: !prev[messageId] }))
  }

  if (loading) {
    return null
  }

  if (error) {
    return <ErrorState type="server" onRetry={loadWorkspace} />
  }


  return (
    <>
      <div className="h-screen flex bg-[#f5f7fa]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {/* ═══ 左侧导航栏（浅色） ═══ */}
        <nav className="w-[200px] shrink-0 bg-[#f0f4ff] border-r border-[#e2e8f0] flex flex-col">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="p-3 border-b border-[#e2e8f0]"><div className="flex items-center gap-2.5"><img src="/sparklearn-logo-official.png" alt="" className="h-8 w-8 object-contain" /><div><div className="text-xs font-bold text-[#1e293b]">学而思 SparkLearn</div><div className="text-[10px] text-[#94a3b8]">个性化学习闭环</div></div></div></div>
          {/* 新建对话按钮 */}
          <div className="p-3">
            <button onClick={() => void handleCreateConversation()} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> 新建对话
            </button>
          </div>

          {/* 导航菜单 */}
          <div className="px-3 space-y-0.5 flex-1">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-medium shadow-sm">
              <Sparkles className="w-4 h-4" /> 学习空间
            </div>
            <button onClick={() => router.push('/tutor/roles')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
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
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
              <Paperclip className="w-4 h-4" /> 我的文件
            </button>
          </div>

          {/* 底部 */}
          <div className="p-3 border-t border-[#e2e8f0] space-y-2">
            <button onClick={() => router.push('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> 返回主平台
            </button>
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-xs font-bold text-white">李</div>
              <div>
                <p className="text-sm font-medium text-[#1e293b]">李明</p>
                <p className="text-[11px] text-[#94a3b8]">学习平台</p>
              </div>
            </div>
          </div>
        </nav>

        {/* ═══ 中间对话列表栏 ═══ */}
        <div className="w-[280px] shrink-0 bg-white border-r border-[#eef1f5] flex flex-col">
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
              <div className="flex items-center gap-1 overflow-x-auto">
                {roles.map((role) => (
                  <button key={role.id} onClick={() => void handleRoleChange(role.id)} className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors', currentRoleId === role.id ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]')}>
                    {role.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 对话列表 */}
          <div className="flex-1 min-h-0 overflow-y-auto">
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
        </div>

        {/* ═══ 主对话区 ═══ */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
          {actionError && <div className="px-6 pt-3"><p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{actionError}</p></div>}

          {/* 对话标题栏 */}
          {currentConversation && (
            <div className="px-6 py-3 border-b border-[#eef1f5] flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1e293b]">{currentConversation.title}</h2>
              <p className="text-xs text-[#94a3b8]">{currentRole ? currentRole.name : ''}</p>
            </div>
          )}

          {/* 消息区域 */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {!hasInteracted ? (
              <div className="h-full flex flex-col items-center justify-center px-6">
                <div className="max-w-[560px] w-full text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] shadow-lg mb-4"><Sparkles className="w-8 h-8 text-white" /></div>
                  <h2 className="text-2xl font-semibold text-[#1e293b] mb-2">有什么可以帮你的？</h2>
                  <p className="text-[#64748b] text-sm mb-6">和 AI 对话，问任何学习问题</p>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-6 max-w-[800px] mx-auto w-full">
                {workshopEnabled && hubMessages.length > 0 && (<div className="rounded-xl border border-[#e2e8f0] bg-[#fafafa] p-3 mb-4"><div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-[#1e293b]">研讨会</p></div><div key={`hub-${workshopRunId}`} className="max-h-[180px] overflow-y-auto space-y-2">{hubMessages.map((evt, idx) => (<div key={`${evt.agentId}-${idx}`} className="rounded-lg bg-white border border-[#eef2f7] px-3 py-2"><p className="text-xs font-medium text-[#475569]">{evt.agentName}</p><p className="text-xs text-[#64748b] mt-1 whitespace-pre-wrap">{evt.content}</p></div>))}</div></div>)}

                {messages.map((msg) => {
                  if (streaming && msg.role === 'assistant' && !msg.content.trim()) return null
                  const summary = msg.role === 'assistant' ? parseWorkshopSummary(msg.content) : null
                  return (
                    <div key={msg.id}>
                      {msg.role === 'user' ? (
                        <div className="flex justify-end mb-4">
                          <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-[#eff6ff] px-4 py-2.5">
                            <p className="text-[15px] leading-[1.8] text-[#1e293b] whitespace-pre-wrap">{msg.content}</p>
                            {msg.fileNames && msg.fileNames.length > 0 && (<div className="mt-2 flex flex-wrap gap-1.5">{msg.fileNames.map((name) => <span key={name} className="text-xs px-2 py-0.5 rounded border border-[#e2e8f0] bg-white">{name}</span>)}</div>)}
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 mb-6">
                          <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center mt-1"><Sparkles className="w-4 h-4 text-white" /></div>
                          <div className="flex-1 min-w-0">
                            {summary ? (
                              <div className="space-y-4">
                                {summary.coreConclusion && <div><p className="text-xs font-medium text-[#94a3b8] mb-1.5">核心结论</p><p className="text-[15px] leading-[1.8] text-[#1e293b] whitespace-pre-wrap">{summary.coreConclusion}</p></div>}
                                {summary.steps.length > 0 && <div><p className="text-xs font-medium text-[#94a3b8] mb-1.5">行动清单</p><div className="space-y-1">{summary.steps.map((s, i) => <p key={i} className="text-[15px] leading-[1.8] text-[#1e293b]">{i+1}. {s}</p>)}</div></div>}
                                {summary.followUps.length > 0 && <div><p className="text-xs font-medium text-[#94a3b8] mb-2">追问</p><div className="flex flex-wrap gap-2">{summary.followUps.map((q, i) => <button key={i} className="text-[13px] px-3 py-1.5 rounded-full border border-[#e2e8f0] text-[#475569] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors" onClick={() => void handleSend(q)} disabled={streaming}>{q}</button>)}</div></div>}
                              </div>
                            ) : (
                              <div className="prose prose-base max-w-none text-[#1e293b] prose-p:leading-[1.8] prose-p:my-3 prose-p:text-[15px] prose-headings:text-[#1e293b] prose-headings:font-semibold prose-code:text-[#e11d48] prose-code:bg-[#f5f5f5] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] prose-pre:rounded-xl prose-pre:text-[13px] prose-li:text-[15px] prose-li:leading-[1.8]">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                              </div>
                            )}
                            {/* TTS 播报按钮 */}
                            {(msg.confidence || (msg.citations && msg.citations.length > 0)) && (
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
                            <button
                              onClick={() => void playTts(msg.id, msg.content)}
                              disabled={ttsLoading === msg.id}
                              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-[#94a3b8] hover:text-[#2563eb] hover:bg-[#eff6ff] transition-colors disabled:opacity-50"
                              title="语音播报"
                            >
                              {ttsLoading === msg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : playingMsgId === msg.id ? <Pause className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                              <span>{playingMsgId === msg.id ? '暂停' : '播放'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {streaming && messages[messages.length - 1]?.content === '' && (<div className="flex gap-3 mb-6"><div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div><div className="flex gap-1.5 pt-3"><span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '0ms' }}></span><span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '150ms' }}></span><span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '300ms' }}></span></div></div>)}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* 底部输入区 */}
          <div className="shrink-0 px-6 pb-4 pt-2">
            <div className="max-w-[800px] mx-auto">
              {pendingFiles.length > 0 && (<div className="flex flex-wrap gap-2 mb-2">{pendingFiles.map((f) => (<span key={f.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#f8fafc] border border-[#e2e8f0]"><FileText className="w-3 h-3" />{f.filename}<button onClick={() => removePendingFile(f.id)}><X className="w-3 h-3" /></button></span>))}</div>)}
              <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm px-4 py-3">
                <div className="flex items-center gap-3">
                  <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }} placeholder="和 AI 对话，问任何学习问题..." rows={1} className="flex-1 resize-none border-0 bg-transparent text-[15px] text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none min-h-[24px] max-h-[120px]" />
                  <button onClick={toggleVoiceInput} className={cn('w-10 h-10 rounded-full flex items-center justify-center transition-colors', recording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1e293b]')} title={recording ? '停止录音' : '语音输入'}>{recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>
                  <button onClick={() => void handleSend()} disabled={(!input.trim() && pendingFiles.length === 0) || streaming} className="w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center hover:bg-[#1d4ed8] disabled:opacity-30 transition-colors"><Send className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#f1f5f9]">
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => void handlePickFiles(e.target.files)} />
                  <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f8fafc] transition-colors"><Paperclip className="w-3.5 h-3.5" /> 上传文件</button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f8fafc] transition-colors" onClick={() => applySuggestion('帮我讲解这道题')}><Sparkles className="w-3.5 h-3.5" /> 讲题</button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f8fafc] transition-colors" onClick={() => applySuggestion('给我出几道练习题')}><FileText className="w-3.5 h-3.5" /> 出题</button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f8fafc] transition-colors" onClick={() => applySuggestion('请总结这份文档的要点')}><FileText className="w-3.5 h-3.5" /> 文档总结</button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ═══ 右侧面板 ═══ */}
        <aside className="w-[280px] shrink-0 bg-white border-l border-[#eef1f5] overflow-y-auto p-4 space-y-5 max-[1200px]:hidden">
          {/* 快捷功能 */}
          <section>
            <h3 className="text-sm font-semibold text-[#1e293b] mb-3">快捷功能</h3>
            <div className="space-y-2">
              <button onClick={() => applySuggestion('帮我讲解二分查找并给一个例题')} className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#eef1f5] hover:border-[#93c5fd] hover:bg-[#f8fafc] transition-colors text-left">
                <div className="w-9 h-9 rounded-lg bg-[#eff6ff] flex items-center justify-center"><Sparkles className="w-4 h-4 text-[#2563eb]" /></div>
                <div><p className="text-sm font-medium text-[#1e293b]">讲题</p><p className="text-[11px] text-[#94a3b8]">上传题目，AI 详细讲解</p></div>
              </button>
              <button onClick={() => applySuggestion('给我出3道Python基础选择题并附答案')} className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#eef1f5] hover:border-[#93c5fd] hover:bg-[#f8fafc] transition-colors text-left">
                <div className="w-9 h-9 rounded-lg bg-[#fef3c7] flex items-center justify-center"><FileText className="w-4 h-4 text-[#d97706]" /></div>
                <div><p className="text-sm font-medium text-[#1e293b]">出题</p><p className="text-[11px] text-[#94a3b8]">根据知识点生成题目</p></div>
              </button>
              <button onClick={() => applySuggestion('请根据我上传的资料做一个要点总结')} className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#eef1f5] hover:border-[#93c5fd] hover:bg-[#f8fafc] transition-colors text-left">
                <div className="w-9 h-9 rounded-lg bg-[#ecfdf5] flex items-center justify-center"><FileText className="w-4 h-4 text-[#059669]" /></div>
                <div><p className="text-sm font-medium text-[#1e293b]">文档总结</p><p className="text-[11px] text-[#94a3b8]">上传文档，AI 归纳要点</p></div>
              </button>
            </div>
          </section>

          {/* 文件上传 */}
          <section>
            <h3 className="text-sm font-semibold text-[#1e293b] mb-3">文件上传</h3>
            <div className="rounded-xl border-2 border-dashed border-[#e2e8f0] p-4 text-center hover:border-[#93c5fd] transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="w-6 h-6 text-[#94a3b8] mx-auto mb-2" />
              <p className="text-xs text-[#64748b]">点击或拖拽文件到这里上传</p>
              <p className="text-[11px] text-[#94a3b8] mt-1">支持 PDF、Word、PPT、图片等</p>
            </div>
          </section>

          {/* 最近上传 */}
          {pendingFiles.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[#1e293b] mb-3">最近上传</h3>
              <div className="space-y-2">
                {pendingFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#f8fafc] border border-[#eef1f5]">
                    <FileText className="w-4 h-4 text-[#2563eb] shrink-0" />
                    <span className="text-xs text-[#475569] truncate flex-1">{f.filename}</span>
                    <button onClick={() => removePendingFile(f.id)} className="text-[#94a3b8] hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

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
              <div><label className="text-xs text-[#64748b] mb-1 block">背景设定</label><textarea className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm min-h-[60px] focus:border-[#2563eb] focus:outline-none" placeholder="适用人群、场景" value={roleDraft.background} onChange={(e) => setRoleDraft((p) => ({ ...p, background: e.target.value }))} /></div>
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
    </>
  )
}
