'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, Message, TutorConversation, TutorFile, TutorRole, WorkshopHubEvent } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'
import {
  Bot,
  FileText,
  MessageSquareText,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  UserCog,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  ArrowLeft,
  Sparkles,
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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
          onHub: (evt) => {
            setHubMessages((prev) => [...prev, evt])
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <TypewriterLoader text="正在加载导师工作台..." />
      </div>
    )
  }

  if (error) {
    return <ErrorState type="server" onRetry={loadWorkspace} />
  }

  return (
    <>
      <div className="h-screen bg-[#f7f8fa] overflow-hidden flex">
        {/* Left sidebar */}
        <aside className={cn('h-full bg-white border-r border-[#eef1f5] transition-all duration-300 ease-out overflow-hidden flex flex-col', panelCollapsed ? 'w-[56px]' : 'w-[240px]')}>
          <div className="px-3 py-3 border-b border-[#eef1f5] flex items-center justify-between">
            {!panelCollapsed && (
              <button onClick={() => router.push('/')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f1f5f9] text-sm font-medium text-[#1e293b] hover:bg-[#e2e8f0] transition-colors">
                <ArrowLeft className="w-4 h-4" />
                返回主页
              </button>
            )}
            <button className="w-8 h-8 rounded-lg hover:bg-[#f1f5f9] flex items-center justify-center text-[#64748b]" onClick={() => setPanelCollapsed((v) => !v)}>
              {panelCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
          {!panelCollapsed && (
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4">
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">角色</h3>
                  <button onClick={openCreateRoleModal} className="w-6 h-6 rounded-md hover:bg-[#f1f5f9] flex items-center justify-center text-[#64748b]"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                <div className="space-y-1">
                  {roles.map((role) => (
                    <div key={role.id} className={cn('group flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-colors', currentRoleId === role.id ? 'bg-[#eff6ff] text-[#2563eb]' : 'hover:bg-[#f8fafc] text-[#475569]')} onClick={() => void handleRoleChange(role.id)}>
                      <div className="flex items-center gap-2 min-w-0"><UserCog className="w-3.5 h-3.5 shrink-0" /><span className="text-sm truncate">{role.name}</span></div>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-white" onClick={(e) => { e.stopPropagation(); openEditRoleModal(role) }}><Pencil className="w-3 h-3" /></button>
                        <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-white text-red-500" onClick={(e) => { e.stopPropagation(); void handleDeleteRole(role.id) }}><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">历史记录</h3>
                  <button onClick={() => void handleCreateConversation()} className="w-6 h-6 rounded-md hover:bg-[#f1f5f9] flex items-center justify-center text-[#64748b]"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <div key={conv.id} className={cn('group flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-colors', currentConversationId === conv.id ? 'bg-[#eff6ff] text-[#2563eb]' : 'hover:bg-[#f8fafc] text-[#475569]')} onClick={() => void switchConversation(conv)}>
                      {renamingConversationId === conv.id ? (
                        <div className="flex gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                          <input className="flex-1 min-w-0 border border-[#e2e8f0] rounded px-2 py-0.5 text-xs" value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleRenameConversation(conv.id) }} autoFocus />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0"><MessageSquareText className="w-3.5 h-3.5 shrink-0" /><span className="text-sm truncate">{conv.title}</span></div>
                          <div className="hidden group-hover:flex items-center gap-0.5">
                            <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-white" onClick={(e) => { e.stopPropagation(); setRenamingConversationId(conv.id); setRenameTitle(conv.title) }}><Pencil className="w-3 h-3" /></button>
                            <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-white text-red-500" onClick={(e) => { e.stopPropagation(); void handleDeleteConversation(conv.id) }}><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {actionError && <div className="px-6 pt-3"><p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{actionError}</p></div>}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {!hasInteracted ? (
              <div className="h-full flex flex-col items-center justify-center px-6">
                <div className="relative z-10 max-w-[640px] w-full text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] shadow-lg mb-5"><Sparkles className="w-10 h-10 text-white" /></div>
                  <h2 className="text-[42px] leading-tight font-semibold tracking-tight text-[#1e293b] mb-3">学习空间</h2>
                  <p className="text-[#64748b] text-base mb-8">讲题、拆解知识点、总结文档，根据角色风格回答问题。</p>
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                    <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#e2e8f0] bg-white hover:border-[#93c5fd] text-sm text-[#475569]" onClick={() => applySuggestion('帮我讲解二分查找并给一个例题')}><Sparkles className="w-4 h-4" /> 讲题</button>
                    <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#e2e8f0] bg-white hover:border-[#93c5fd] text-sm text-[#475569]" onClick={() => applySuggestion('给我出3道Python基础选择题并附答案')}><FileText className="w-4 h-4" /> 出题</button>
                    <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#e2e8f0] bg-white hover:border-[#93c5fd] text-sm text-[#475569]" onClick={() => fileInputRef.current?.click()}><Paperclip className="w-4 h-4" /> 上传文件</button>
                    <button className={cn('inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm', workshopEnabled ? 'bg-[#2563eb] text-white border-[#2563eb]' : 'border-[#e2e8f0] bg-white text-[#475569]')} onClick={() => setWorkshopEnabled((v) => !v)}><Users className="w-4 h-4" /> 研讨会</button>
                  </div>
                  <div className="mx-auto max-w-[560px] rounded-2xl border border-[#e2e8f0] bg-white shadow-sm p-4">
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }} placeholder="请输入，Enter键发送，Shift+Enter换行" rows={3} className="w-full resize-none border-0 bg-transparent text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none" />
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f1f5f9]">
                      <div className="flex items-center gap-2">
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => void handlePickFiles(e.target.files)} />
                        <button className="w-8 h-8 rounded-lg hover:bg-[#f1f5f9] flex items-center justify-center text-[#94a3b8]" onClick={() => fileInputRef.current?.click()}><Paperclip className="w-4 h-4" /></button>
                      </div>
                      <button onClick={() => void handleSend()} disabled={(!input.trim() && pendingFiles.length === 0) || streaming} className="h-9 px-5 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-40 transition-colors">发送</button>
                    </div>
                  </div>
                  {workshopEnabled && (<div className="mt-4 mx-auto max-w-[560px] text-left"><p className="text-xs text-[#94a3b8] mb-2">参会智能体</p><div className="flex flex-wrap gap-2">{roles.map((role) => { const sel = workshopRoleIds.includes(role.id); return (<button key={`ws-${role.id}`} className={cn('px-3 py-1.5 rounded-full border text-xs', sel ? 'bg-[#eff6ff] border-[#2563eb] text-[#2563eb]' : 'bg-white border-[#e2e8f0] text-[#64748b]')} onClick={() => toggleWorkshopRole(role.id)}>{role.name}</button>) })}</div></div>)}
                </div>
              </div>
            ) : (
              <div className="px-6 py-4 space-y-4 max-w-[860px] mx-auto w-full">
                {workshopEnabled && hubMessages.length > 0 && (<div className="rounded-xl border border-[#e2e8f0] bg-white p-3"><div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold">研讨会</p><p className="text-xs text-[#94a3b8]">{workshopPhase ? `${workshopPhase.phase}` : ''}</p></div><div key={`hub-${workshopRunId}`} className="max-h-[180px] overflow-y-auto space-y-2">{hubMessages.map((evt, idx) => (<div key={`${evt.agentId}-${idx}`} className="rounded-lg bg-[#f8fafc] border border-[#eef2f7] px-3 py-2"><p className="text-xs font-medium">{evt.agentName}</p><p className="text-xs text-[#64748b] mt-1 whitespace-pre-wrap">{evt.content}</p></div>))}</div></div>)}
                {messages.map((msg) => {
                  if (streaming && msg.role === 'assistant' && !msg.content.trim()) return null
                  const summary = msg.role === 'assistant' ? parseWorkshopSummary(msg.content) : null
                  return (
                    <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('group max-w-[75%] rounded-2xl px-4 py-3', msg.role === 'user' ? 'bg-[#2563eb] text-white' : 'bg-white border border-[#eef2f7] shadow-sm')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {msg.role === 'assistant' ? (summary ? (<div className="space-y-3">{summary.coreConclusion && <div><p className="text-xs text-[#94a3b8] mb-1">核心结论</p><p className="text-sm whitespace-pre-wrap">{summary.coreConclusion}</p></div>}{summary.steps.length > 0 && <div><p className="text-xs text-[#94a3b8] mb-1">行动清单</p>{summary.steps.map((s, i) => <p key={i} className="text-sm">{i+1}. {s}</p>)}</div>}{summary.followUps.length > 0 && <div><p className="text-xs text-[#94a3b8] mb-2">追问</p><div className="grid gap-1.5">{summary.followUps.map((q, i) => <button key={i} className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[#e2e8f0] hover:border-[#93c5fd]" onClick={() => void handleSend(q)} disabled={streaming}>{q}</button>)}</div></div>}</div>) : (<div className="prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>)) : (<p className="text-sm whitespace-pre-wrap">{msg.content}</p>)}
                            {msg.fileNames && msg.fileNames.length > 0 && (<div className="mt-2 flex flex-wrap gap-1.5">{msg.fileNames.map((name) => <span key={name} className="text-xs px-2 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc]">{name}</span>)}</div>)}
                          </div>
                          {!streaming && (<button className="shrink-0 opacity-0 group-hover:opacity-100 text-[#94a3b8] hover:text-red-500" onClick={() => void handleDeleteMessage(msg.id)}><X className="w-3.5 h-3.5" /></button>)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {streaming && messages[messages.length - 1]?.content === '' && (<div className="flex justify-start"><div className="bg-white border border-[#eef2f7] shadow-sm rounded-2xl px-4 py-3"><div className="flex gap-1.5"><span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '0ms' }}></span><span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '150ms' }}></span><span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '300ms' }}></span></div></div></div>)}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          {hasInteracted && (
            <div className="shrink-0 px-6 pb-4 pt-2 max-w-[860px] mx-auto w-full">
              <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm p-3">
                {pendingFiles.length > 0 && (<div className="flex flex-wrap gap-2 mb-2">{pendingFiles.map((f) => (<span key={f.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#f8fafc] border border-[#e2e8f0]"><FileText className="w-3 h-3" />{f.filename}<button onClick={() => removePendingFile(f.id)}><X className="w-3 h-3" /></button></span>))}</div>)}
                <div className="flex items-end gap-2">
                  <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }} placeholder="继续提问..." rows={1} className="flex-1 resize-none border-0 bg-transparent text-sm placeholder:text-[#94a3b8] focus:outline-none min-h-[24px] max-h-[120px]" />
                  <button className="w-8 h-8 rounded-lg hover:bg-[#f1f5f9] flex items-center justify-center text-[#94a3b8]" onClick={() => fileInputRef.current?.click()}><Paperclip className="w-4 h-4" /></button>
                  <button onClick={() => void handleSend()} disabled={(!input.trim() && pendingFiles.length === 0) || streaming} className="w-9 h-9 rounded-xl bg-[#2563eb] text-white flex items-center justify-center hover:bg-[#1d4ed8] disabled:opacity-40"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

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
