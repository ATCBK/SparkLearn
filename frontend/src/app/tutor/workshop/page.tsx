'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, TutorRole, WorkshopHubEvent } from '@/lib/api'
import {
  ArrowLeft,
  Check,
  Database,
  FileText,
  Paperclip,
  Plus,
  Puzzle,
  Send,
  Sparkles,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export default function WorkshopPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<TutorRole[]>([])
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
  const [input, setInput] = useState('')
  const [topic, setTopic] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [hubMessages, setHubMessages] = useState<WorkshopHubEvent[]>([])
  const [conclusion, setConclusion] = useState<{ core: string; actions: string[]; followUps: string[] } | null>(null)
  const [assistantDraft, setAssistantDraft] = useState('')
  const [started, setStarted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getTutorRoles().then((data) => {
      setRoles(data)
      setSelectedRoleIds(data.slice(0, 4).map((r) => r.id))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [hubMessages])

  function toggleRole(roleId: number) {
    setSelectedRoleIds((prev) => {
      if (prev.includes(roleId)) {
        return prev.filter((id) => id !== roleId)
      }
      if (prev.length >= 6) return prev
      return [...prev, roleId]
    })
  }

  async function startDiscussion() {
    const question = input.trim()
    if (!question || streaming || selectedRoleIds.length === 0) return

    setTopic(question)
    setInput('')
    setStarted(true)
    setStreaming(true)
    setHubMessages([])
    setConclusion(null)
    setAssistantDraft('')

    try {
      // 先创建一个会话
      const conv = await api.createTutorConversation({ title: question.slice(0, 20), roleId: selectedRoleIds[0] })

      let fullContent = ''
      await api.sendMessage(
        question,
        {
          conversationId: conv.id,
          roleId: selectedRoleIds[0],
          workshopEnabled: true,
          workshopRoleIds: selectedRoleIds,
        },
        {
          onText: (chunk) => {
            fullContent += chunk
            setAssistantDraft((prev) => prev + chunk)
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
          onWorkshopPhase: () => {},
        },
      )

      if (fullContent.trim()) {
        setConclusion(parseWorkshopConclusion(fullContent))
      }
    } catch { /* ignore */ }
    setStreaming(false)
  }

  return (
    <div className="h-screen flex bg-[#f5f7fa]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ═══ 左侧导航栏 ═══ */}
      <nav className="w-[200px] shrink-0 bg-[#f0f4ff] border-r border-[#e2e8f0] flex flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="p-3 border-b border-[#e2e8f0]"><div className="flex items-center gap-2.5"><img src="/sparklearn-logo-official.png" alt="" className="h-8 w-8 object-contain" /><div><div className="text-xs font-bold text-[#1e293b]">学而思 SparkLearn</div><div className="text-[10px] text-[#94a3b8]">个性化学习闭环</div></div></div></div>
        <div className="p-3">
          <button onClick={() => router.push('/tutor')} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> 新建对话
          </button>
        </div>
        <div className="px-3 space-y-0.5 flex-1">
          <button onClick={() => router.push('/tutor')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Sparkles className="w-4 h-4" /> 学习空间
          </button>
          <button onClick={() => router.push('/tutor/roles')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <UserCog className="w-4 h-4" /> 角色工坊
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-medium shadow-sm">
            <Users className="w-4 h-4" /> 研讨会
          </div>
          <div className="my-3 border-t border-[#e2e8f0]" />
          <button onClick={() => router.push('/tutor/knowledge')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Database className="w-4 h-4" /> 知识库
          </button>
          <button onClick={() => router.push('/tutor/mcp-store')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Puzzle className="w-4 h-4" /> MCP 插件商店
          </button>
          <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Paperclip className="w-4 h-4" /> 我的文件
          </button>
        </div>
        <div className="p-3 border-t border-[#e2e8f0] space-y-2">
          <button onClick={() => router.push('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回主平台
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-xs font-bold text-white">李</div>
            <div><p className="text-sm font-medium text-[#1e293b]">李明</p><p className="text-[11px] text-[#94a3b8]">学习平台</p></div>
          </div>
        </div>
      </nav>

      {/* ═══ 角色选择栏 ═══ */}
      <div className="w-[280px] shrink-0 bg-white border-r border-[#eef1f5] flex flex-col">
        <div className="p-4 border-b border-[#eef1f5]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1e293b]">选择参与角色 ({selectedRoleIds.length}/6)</h2>
            <button onClick={() => router.push('/tutor/roles')} className="text-xs text-[#2563eb] hover:underline">+ 添加角色</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {roles.map((role) => {
            const selected = selectedRoleIds.includes(role.id)
            return (
              <div
                key={role.id}
                onClick={() => toggleRole(role.id)}
                className={cn('px-4 py-3 border-b border-[#f5f7fa] cursor-pointer transition-colors flex items-center gap-3', selected ? 'bg-[#eff6ff]' : 'hover:bg-[#f8fafc]')}
              >
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#64748b] to-[#94a3b8] flex items-center justify-center text-white text-sm font-bold">
                  {role.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1e293b] truncate">{role.name}</p>
                  <p className="text-xs text-[#94a3b8] truncate">{role.persona || '未设置描述'}</p>
                </div>
                <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors', selected ? 'bg-[#2563eb] border-[#2563eb]' : 'border-[#e2e8f0]')}>
                  {selected && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            )
          })}
        </div>
        <div className="p-3 border-t border-[#eef1f5]">
          <button onClick={() => router.push('/tutor/roles')} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#e2e8f0] text-xs text-[#475569] hover:bg-[#f8fafc] transition-colors">
            <UserCog className="w-3.5 h-3.5" /> 管理角色库
          </button>
        </div>
      </div>

      {/* ═══ 主讨论区 ═══ */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
        {/* 顶部标题栏 */}
        <div className="px-6 py-3 border-b border-[#eef1f5] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1e293b]">研讨会 / 多智能体协同讨论</h2>
          </div>
          <div className="flex items-center gap-2">
            {started && (
              <>
                <button className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs text-[#475569] hover:bg-[#f8fafc]">导出结论</button>
                <button onClick={() => { setStarted(false); setHubMessages([]); setConclusion(null); setTopic('') }} className="px-3 py-1.5 rounded-lg border border-red-100 text-xs text-red-500 hover:bg-red-50">结束研讨</button>
              </>
            )}
          </div>
        </div>

        {/* 讨论内容 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {!started ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="max-w-[500px] w-full text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] shadow-lg mb-4"><Users className="w-8 h-8 text-white" /></div>
                <h2 className="text-xl font-semibold text-[#1e293b] mb-2">多智能体研讨会</h2>
                <p className="text-sm text-[#64748b] mb-6">选择参与角色，发起一个问题，多个 AI 导师将围绕问题展开协同讨论。</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {/* 用户发起的问题 */}
              <div className="flex justify-end mb-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl rounded-tr-sm bg-[#eff6ff] px-4 py-2.5 max-w-[500px]">
                    <p className="text-[15px] text-[#1e293b]">{topic}</p>
                  </div>
                  <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-[11px] font-bold text-white">李</div>
                </div>
              </div>

              {/* 多角色讨论 */}
              {hubMessages.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-[#94a3b8] mb-3 text-center">多角色讨论中...</p>
                  <div className="space-y-3">
                    {hubMessages.map((evt, idx) => {
                      const role = roles.find((r) => r.name === evt.agentName)
                      return (
                        <div key={`${evt.agentId}-${idx}`} className="flex items-start gap-3">
                          <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-[#64748b] to-[#94a3b8] flex items-center justify-center text-white text-[11px] font-bold">
                            {evt.agentName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-[#1e293b]">{evt.agentName}</span>
                              <span className="text-[11px] text-[#94a3b8]">{new Date(evt.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-[15px] leading-[1.8] text-[#475569] whitespace-pre-wrap">{evt.content}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {streaming && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '0ms' }}></span>
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '150ms' }}></span>
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-xs text-[#94a3b8]">讨论进行中...</span>
                </div>
              )}
              {assistantDraft && (
                <div className="mt-4 border-t border-[#eef1f5] pt-4">
                  <p className="text-xs text-[#94a3b8] mb-3 text-center">最终结论（流式输出）</p>
                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                    <p className="text-[15px] leading-[1.8] text-[#475569] whitespace-pre-wrap">{assistantDraft}</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 底部输入 */}
        <div className="shrink-0 px-6 pb-4 pt-2">
          <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm px-4 py-3">
            <div className="flex items-center gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void startDiscussion() } }}
                placeholder={started ? '继续追问或补充信息...' : '输入研讨主题，发起讨论...'}
                rows={1}
                className="flex-1 resize-none border-0 bg-transparent text-[15px] text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none min-h-[24px] max-h-[80px]"
              />
              <button
                onClick={() => void startDiscussion()}
                disabled={!input.trim() || streaming || selectedRoleIds.length === 0}
                className="w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center hover:bg-[#1d4ed8] disabled:opacity-30 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 右侧结论面板 ═══ */}
      <aside className="w-[300px] shrink-0 border-l border-[#eef1f5] bg-white overflow-y-auto p-5 space-y-5 max-[1200px]:hidden">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1e293b]">研讨会结论</h3>
          {conclusion && <button className="text-xs text-[#2563eb] hover:underline">实时汇总</button>}
        </div>

        {!conclusion && !started && (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-[#e2e8f0] mx-auto mb-3" />
            <p className="text-sm text-[#94a3b8]">发起讨论后，结论将在这里实时汇总</p>
          </div>
        )}

        {streaming && !conclusion && (
          <div className="text-center py-8">
            <div className="flex gap-1.5 justify-center mb-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#2563eb]" style={{ animationDelay: '0ms' }}></span>
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#2563eb]" style={{ animationDelay: '150ms' }}></span>
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#2563eb]" style={{ animationDelay: '300ms' }}></span>
            </div>
            <p className="text-sm text-[#94a3b8]">正在汇总讨论结论...</p>
          </div>
        )}

        {conclusion && (
          <div className="space-y-5">
            {/* 核心结论 */}
            <section>
              <h4 className="text-xs font-semibold text-[#1e293b] mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-[#2563eb] text-white text-[10px] flex items-center justify-center font-bold">01</span>
                核心结论
              </h4>
              <div className="space-y-2">
                {conclusion.core.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed text-[#475569] pl-7">• {line}</p>
                ))}
              </div>
            </section>

            {/* 行动清单 */}
            {conclusion.actions.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-[#1e293b] mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#2563eb] text-white text-[10px] flex items-center justify-center font-bold">02</span>
                  行动清单
                </h4>
                <div className="space-y-1.5">
                  {conclusion.actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2 pl-7">
                      <div className="w-4 h-4 mt-0.5 shrink-0 rounded border-2 border-[#2563eb] bg-[#2563eb] flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                      <p className="text-sm text-[#475569]">{action}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 后续建议 */}
            {conclusion.followUps.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-[#1e293b] mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#2563eb] text-white text-[10px] flex items-center justify-center font-bold">03</span>
                  后续建议
                </h4>
                <div className="space-y-1.5">
                  {conclusion.followUps.map((q, i) => (
                    <p key={i} className="text-sm text-[#475569] pl-7">• {q}</p>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

function parseWorkshopConclusion(fullContent: string): { core: string; actions: string[]; followUps: string[] } {
  const lines = fullContent.split('\n').map(x => x.trim()).filter(Boolean)
  const actions: string[] = []
  const followUps: string[] = []
  const coreLines: string[] = []
  let section: 'core' | 'actions' | 'followups' = 'core'

  for (const line of lines) {
    if (/核心结论|结论/i.test(line)) { section = 'core'; continue }
    if (/行动清单|分步行动|行动建议/i.test(line)) { section = 'actions'; continue }
    if (/追问|可追问|后续问题|后续建议/i.test(line)) { section = 'followups'; continue }
    const clean = line.replace(/^[\d\-\*\.\)\(、\s]+/, '').trim()
    if (!clean) continue
    if (section === 'actions') actions.push(clean)
    else if (section === 'followups') followUps.push(clean)
    else coreLines.push(clean)
  }

  const core = coreLines.join('\n').trim()
  if (core || actions.length || followUps.length) return { core, actions, followUps }
  return { core: fullContent.trim(), actions: [], followUps: [] }
}
