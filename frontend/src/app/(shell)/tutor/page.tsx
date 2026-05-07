'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
    if ((!textValue && pendingFiles.length === 0) || streaming || !currentConversationId) return

    const userInput = textValue || '（空文本）'
    const msgUid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const userMsg: Message = {
      id: `u-${msgUid}`,
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
      conversationId: currentConversationId,
      fileNames: pendingFiles.map((f) => f.filename),
    }

    const assistantId = `a-${msgUid}`
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString(), conversationId: currentConversationId },
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
          conversationId: currentConversationId,
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
      await refreshConversations(currentConversationId)
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
      <div className="h-screen bg-bg-card overflow-hidden flex">
        <aside
          className={cn(
            'h-full transition-all duration-300 ease-out overflow-hidden border-r border-black/[0.06]',
            panelCollapsed ? 'w-[56px]' : 'w-[360px]',
          )}
        >
          <div className="h-full flex flex-col">
            <div className="px-3 py-3 border-b border-black/[0.06] flex items-center justify-between">
              {!panelCollapsed && <p className="text-sm font-semibold">工作台</p>}
              <button
                className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center text-ink-secondary"
                onClick={() => setPanelCollapsed((v) => !v)}
                title={panelCollapsed ? '展开会话栏' : '收起会话栏'}
              >
                {panelCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </div>

            {!panelCollapsed && (
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                <section className="rounded-[12px] border border-black/[0.08] bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="w-4 h-4 text-blue" />
                      <h3 className="text-sm font-semibold">会话管理</h3>
                    </div>
                    <Button size="sm" onClick={handleCreateConversation}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <p className="text-xs text-ink-tertiary mb-2">共 {conversations.length} 个会话</p>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          'rounded-[10px] border px-3 py-2 cursor-pointer',
                          currentConversationId === conv.id
                            ? 'border-blue bg-blue/5'
                            : 'border-black/[0.08] hover:bg-bg-hover',
                        )}
                        onClick={() => {
                          void switchConversation(conv)
                        }}
                      >
                        {renamingConversationId === conv.id ? (
                          <div className="flex gap-1">
                            <input
                              className="flex-1 border border-black/[0.12] rounded px-2 py-1 text-sm"
                              value={renameTitle}
                              onChange={(e) => setRenameTitle(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              className="text-xs px-2 rounded border border-black/[0.12]"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleRenameConversation(conv.id)
                              }}
                            >
                              保存
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm truncate">{conv.title}</p>
                            <div className="flex items-center gap-1">
                              <button
                                className="text-ink-secondary hover:text-ink"
                                title="重命名会话"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setRenamingConversationId(conv.id)
                                  setRenameTitle(conv.title)
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                className="text-ink-secondary hover:text-danger"
                                title="删除会话"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleDeleteConversation(conv.id)
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-ink-tertiary mt-1">#{conv.id} · {conv.messageCount} 条消息</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[12px] border border-black/[0.08] bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-blue" />
                      <h3 className="text-sm font-semibold">角色管理</h3>
                    </div>
                    <Button size="sm" onClick={openCreateRoleModal}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className={cn(
                          'rounded-[10px] border px-3 py-2',
                          currentRoleId === role.id ? 'border-blue bg-blue/5' : 'border-black/[0.08] bg-white',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button className="text-left flex-1 min-w-0" onClick={() => void handleRoleChange(role.id)}>
                            <p className="text-sm font-medium truncate">{role.name}</p>
                            <p className="text-xs text-ink-tertiary truncate">{role.persona || '未设置角色描述'}</p>
                          </button>
                          <div className="flex items-center gap-1">
                            <button className="text-ink-secondary hover:text-ink" onClick={() => openEditRoleModal(role)} title="编辑角色">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button className="text-ink-secondary hover:text-danger" onClick={() => void handleDeleteRole(role.id)} title="删除角色">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 p-4 flex flex-col min-h-0 relative overflow-hidden">
          <div className="mb-3">
            <h1 className="text-h2 text-ink">智能辅导</h1>
            <p className="text-small text-ink-secondary mt-1">
              {currentConversation ? `${currentConversation.title} · 会话 #${currentConversation.id}` : '请先创建会话'}
              {currentRole ? ` · 角色: ${currentRole.name}` : ''}
            </p>
            {actionError && <p className="text-xs text-danger mt-1">{actionError}</p>}
            <div className="mt-3 rounded-[12px] border border-black/[0.08] bg-white px-3 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors',
                    workshopEnabled
                      ? 'bg-blue text-white border-blue'
                      : 'bg-bg-hover text-ink-secondary border-black/[0.08] hover:text-ink',
                  )}
                  onClick={() => setWorkshopEnabled((v) => !v)}
                >
                  <Users className="w-4 h-4" />
                  研讨会模式
                </button>
                <p className="text-xs text-ink-tertiary">开启后将启用多智能体协同讨论，并实时展示 MsgHub 发言。</p>
              </div>

              {workshopEnabled && (
                <div className="mt-3">
                  <p className="text-xs text-ink-secondary mb-2">参会智能体（包含你创建的导师角色）</p>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => {
                      const selected = workshopRoleIds.includes(role.id)
                      return (
                        <button
                          key={`workshop-role-${role.id}`}
                          className={cn(
                            'px-3 py-1.5 rounded-full border text-xs transition-colors',
                            selected
                              ? 'bg-blue/10 border-blue text-blue'
                              : 'bg-white border-black/[0.12] text-ink-secondary hover:text-ink',
                          )}
                          onClick={() => toggleWorkshopRole(role.id)}
                        >
                          {role.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {!hasInteracted ? (
              <div className="h-full flex flex-col items-center justify-center px-6">
                <div className="pointer-events-none absolute inset-0 opacity-70">
                  <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-blue/10 blur-3xl" />
                  <div className="absolute -bottom-32 right-0 w-[420px] h-[420px] rounded-full bg-teal/10 blur-3xl" />
                </div>

                <div className="relative z-10 max-w-[860px] w-full text-center">
                  <div className="inline-flex items-center justify-center w-[108px] h-[108px] rounded-full bg-white shadow-lg border border-blue/20 mb-5">
                    <Bot className="w-14 h-14 text-blue" />
                  </div>
                  <h2 className="text-[68px] leading-none font-semibold tracking-tight text-ink mb-4">今天学点啥？</h2>
                  <p className="text-ink-secondary text-[18px] mb-8">我可以讲题、拆解知识点、总结文档，还能根据你的角色风格回答问题。</p>

                  <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                    <button className="px-4 py-2 rounded-full border border-black/[0.08] bg-white hover:bg-bg-hover text-sm" onClick={() => applySuggestion('帮我讲解二分查找并给一个例题')}>
                      讲题
                    </button>
                    <button className="px-4 py-2 rounded-full border border-black/[0.08] bg-white hover:bg-bg-hover text-sm" onClick={() => applySuggestion('给我出3道Python基础选择题并附答案')}>
                      出题
                    </button>
                    <button className="px-4 py-2 rounded-full border border-black/[0.08] bg-white hover:bg-bg-hover text-sm" onClick={() => applySuggestion('请根据我上传的资料做一个要点总结')}>
                      文档总结
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {workshopEnabled && (
                  <div className="rounded-[14px] border border-black/[0.08] bg-white p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">MsgHub 研讨会</p>
                      <p className="text-xs text-ink-tertiary">
                        {workshopPhase
                          ? `阶段: ${workshopPhase.phase}${workshopPhase.round ? ` · 第${workshopPhase.round}轮` : ''} · ${workshopPhase.status}`
                          : '等待开始'}
                      </p>
                    </div>
                    <div key={`hub-run-${workshopRunId}`} className="mt-2 max-h-[220px] overflow-y-auto space-y-2 pr-1">
                      {hubMessages.length === 0 && (
                        <p className="text-xs text-ink-tertiary">发送问题后，将在这里实时显示多智能体讨论过程。</p>
                      )}
                      {hubMessages.map((evt, idx) => (
                        <div key={`${evt.agentId}-${evt.timestamp}-${idx}`} className="rounded-[10px] border border-black/[0.06] bg-bg-card px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-ink">
                              {evt.agentName} · {evt.phase}{evt.round > 0 ? ` R${evt.round}` : ''}
                            </p>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', evt.agentKind === 'custom' ? 'text-teal border-teal/30 bg-teal/10' : 'text-blue border-blue/30 bg-blue/10')}>
                              {evt.agentKind === 'custom' ? '自定义' : '系统'}
                            </span>
                          </div>
                          <p className="text-xs text-ink-secondary mt-1 whitespace-pre-wrap">{evt.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => {
                  const shouldHideStreamingPlaceholder = streaming && msg.role === 'assistant' && !msg.content.trim()
                  if (shouldHideStreamingPlaceholder) return null
                  const summary = msg.role === 'assistant' ? parseWorkshopSummary(msg.content) : null
                  return (
                    <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[78%] rounded-[14px] px-4 py-3',
                        msg.role === 'user' ? 'bg-blue text-white' : 'bg-white shadow-sm border border-black/[0.06]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {msg.role === 'assistant' ? (
                            summary ? (
                              <div className="space-y-3">
                                {summary.optimizedQuestion && (
                                  <div>
                                    <p className="text-xs text-ink-tertiary mb-1">优化后问题</p>
                                    <p className="text-body whitespace-pre-wrap">{summary.optimizedQuestion}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs text-ink-tertiary mb-1">核心结论</p>
                                  <p className="text-body whitespace-pre-wrap">{summary.coreConclusion || '暂无'}</p>
                                </div>
                                {summary.steps.length > 0 && (
                                  <div>
                                    <p className="text-xs text-ink-tertiary mb-1">分步行动清单</p>
                                    <div className="space-y-1">
                                      {summary.steps.map((step, idx) => (
                                        <p key={`${msg.id}-step-${idx}`} className="text-body whitespace-pre-wrap">
                                          {idx + 1}. {step}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {summary.followUps.length > 0 && (
                                  <div>
                                    <p className="text-xs text-ink-tertiary mb-2">可追问问题（点击直接发送）</p>
                                    <div className="grid gap-2">
                                      {summary.followUps.map((q, idx) => (
                                        <button
                                          key={`${msg.id}-follow-${idx}`}
                                          className="w-full text-left text-sm px-3 py-2 rounded-[10px] border border-black/[0.08] bg-bg-card text-ink hover:border-blue/30 hover:bg-blue/5 hover:text-blue transition-colors"
                                          onClick={() => {
                                            void handleSend(q)
                                          }}
                                          disabled={streaming || !currentConversationId}
                                        >
                                          {q}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="prose prose-sm max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                              </div>
                            )
                          ) : (
                            <p className="text-body whitespace-pre-wrap">{msg.content}</p>
                          )}

                          {msg.fileNames && msg.fileNames.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {msg.fileNames.map((name) => (
                                <span
                                  key={`${msg.id}-${name}`}
                                  className={cn(
                                    'text-xs px-2 py-1 rounded border',
                                    msg.role === 'user' ? 'bg-white/20 border-white/30' : 'bg-bg-hover border-black/[0.08]',
                                  )}
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {!streaming && (
                          <button
                            className={cn(msg.role === 'user' ? 'text-white/70 hover:text-white' : 'text-ink-tertiary hover:text-danger')}
                            onClick={() => {
                              void handleDeleteMessage(msg.id)
                            }}
                            title="删除该条消息"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })}

                {streaming && messages[messages.length - 1]?.content === '' && (
                  <div className="flex justify-start">
                    <div className="bg-white shadow-sm border border-black/[0.06] rounded-[14px] px-4 py-3">
                      <TypewriterLoader />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="mt-3 bg-white rounded-[14px] border border-black/[0.08] p-3 flex flex-col gap-2">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((file) => (
                  <span key={file.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-bg-hover border border-black/[0.08]">
                    <FileText className="w-3 h-3" />
                    {file.filename}
                    <button onClick={() => removePendingFile(file.id)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder="输入你的问题，或上传资料后提问..."
                rows={1}
                className="flex-1 resize-none border-0 bg-transparent text-body text-ink placeholder:text-ink-disabled focus:outline-none min-h-[24px] max-h-[120px]"
              />

              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => void handlePickFiles(e.target.files)} />

              <button
                className="w-9 h-9 rounded-full bg-bg-hover flex items-center justify-center text-ink-secondary hover:text-ink transition-colors"
                onClick={() => fileInputRef.current?.click()}
                title="上传文件"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button className="w-9 h-9 rounded-full bg-bg-hover flex items-center justify-center text-ink-secondary hover:text-ink transition-colors" title="语音输入（预留）">
                <Mic className="w-4 h-4" />
              </button>

              <Button onClick={() => void handleSend()} disabled={(!input.trim() && pendingFiles.length === 0) || streaming || !currentConversationId} size="sm">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </main>
      </div>

      {roleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4" onClick={() => setRoleModalOpen(false)}>
          <div className="w-full max-w-[620px] bg-white rounded-[16px] border border-black/[0.08] shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-h3 font-semibold">{roleModalMode === 'create' ? '创建角色' : '编辑角色'}</h3>
              <button className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center" onClick={() => setRoleModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-ink-secondary">角色名称</label>
              <input
                className="w-full border border-black/[0.12] rounded-[10px] px-3 py-2 text-sm"
                placeholder="例如：严谨算法导师"
                value={roleDraft.name}
                onChange={(e) => setRoleDraft((prev) => ({ ...prev, name: e.target.value }))}
              />

              <label className="text-xs text-ink-secondary">Persona</label>
              <textarea
                className="w-full border border-black/[0.12] rounded-[10px] px-3 py-2 text-sm min-h-[62px]"
                placeholder="角色个性与能力定位"
                value={roleDraft.persona}
                onChange={(e) => setRoleDraft((prev) => ({ ...prev, persona: e.target.value }))}
              />

              <label className="text-xs text-ink-secondary">背景设定</label>
              <textarea
                className="w-full border border-black/[0.12] rounded-[10px] px-3 py-2 text-sm min-h-[62px]"
                placeholder="适用人群、场景、边界"
                value={roleDraft.background}
                onChange={(e) => setRoleDraft((prev) => ({ ...prev, background: e.target.value }))}
              />

              <label className="text-xs text-ink-secondary">风格指南</label>
              <textarea
                className="w-full border border-black/[0.12] rounded-[10px] px-3 py-2 text-sm min-h-[62px]"
                placeholder="回答风格、结构偏好"
                value={roleDraft.styleGuide}
                onChange={(e) => setRoleDraft((prev) => ({ ...prev, styleGuide: e.target.value }))}
              />

              <label className="text-xs text-ink-secondary">规则约束</label>
              <textarea
                className="w-full border border-black/[0.12] rounded-[10px] px-3 py-2 text-sm min-h-[62px]"
                placeholder="不可做什么，必须做什么"
                value={roleDraft.rules}
                onChange={(e) => setRoleDraft((prev) => ({ ...prev, rules: e.target.value }))}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRoleModalOpen(false)}>
                取消
              </Button>
              <Button onClick={() => void handleSaveRoleFromModal()} disabled={savingRole || !roleDraft.name.trim()}>
                <Save className="w-4 h-4" />
                保存角色
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
