'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  ClipboardList,
  Database,
  FileText,
  Lightbulb,
  MessageSquareText,
  PanelRight,
  PauseCircle,
  PlayCircle,
  Plus,
  Puzzle,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  UserCog,
  Users,
} from 'lucide-react'
import { api, TutorRole, WorkshopHubEvent } from '@/lib/api'
import { cn } from '@/lib/utils/cn'
import { TutorUserBadge } from '@/components/tutor/TutorUserBadge'
import { useCurrentUserDisplay } from '@/hooks/useCurrentUserDisplay'
import { NewUserGuidePanel } from '@/components/onboarding/NewUserGuidePanel'

type TimelineTone = 'profile' | 'tool' | 'risk' | 'action' | 'synthesis' | 'default'

type TimelineEvent = WorkshopHubEvent & {
  id: string
  summary: string
  phaseLabel: string
  tone: TimelineTone
}

type BoardState = {
  consensus: string[]
  evidence: string[]
  risks: string[]
  actions: string[]
  followUps: string[]
}

type ViewMode = 'classic' | 'town'

type TownNodeStatus = 'waiting' | 'running' | 'done'

type TownNode = {
  id: string
  title: string
  agentName: string
  duty: string
  phase: string
  tone: TimelineTone
  x: string
  y: string
  status: TownNodeStatus
  latestEvent?: TimelineEvent
}

const SYSTEM_AGENTS = [
  { id: 'profile-agent', name: '画像分析师', duty: '读取学习画像', icon: Database },
  { id: 'researcher', name: '资料研究员', duty: '检索资料与证据', icon: Search },
  { id: 'challenger', name: '质疑者', duty: '指出风险和漏洞', icon: ShieldAlert },
  { id: 'coach', name: '行动教练', duty: '转化为学习动作', icon: ClipboardList },
]

const TOWN_NODE_DEFS = [
  {
    id: 'profile-agent',
    title: '画像塔',
    agentName: '画像分析师',
    duty: '读取学习画像、薄弱点和学习偏好',
    phase: 'profile_analysis',
    tone: 'profile' as TimelineTone,
    x: '14%',
    y: '18%',
  },
  {
    id: 'clarifier',
    title: '问题改写站',
    agentName: '提问优化师',
    duty: '补全目标、约束和上下文缺口',
    phase: 'discussion',
    tone: 'default' as TimelineTone,
    x: '34%',
    y: '31%',
  },
  {
    id: 'subject-tutor',
    title: '学科研究所',
    agentName: '学科导师',
    duty: '给出专业解释与解题路径',
    phase: 'discussion',
    tone: 'tool' as TimelineTone,
    x: '57%',
    y: '19%',
  },
  {
    id: 'challenger',
    title: '质疑审计局',
    agentName: '质疑者',
    duty: '发现漏洞、边界条件和易错点',
    phase: 'discussion',
    tone: 'risk' as TimelineTone,
    x: '72%',
    y: '43%',
  },
  {
    id: 'coach',
    title: '行动工坊',
    agentName: '行动教练',
    duty: '把讨论转化为可执行学习动作',
    phase: 'discussion',
    tone: 'action' as TimelineTone,
    x: '38%',
    y: '62%',
  },
  {
    id: 'final-answer-agent',
    title: '中央广场',
    agentName: '最终回答智能体',
    duty: '汇总各方观点并生成最终答复',
    phase: 'synthesis',
    tone: 'synthesis' as TimelineTone,
    x: '64%',
    y: '67%',
  },
]

export default function WorkshopPage() {
  const router = useRouter()
  const currentUser = useCurrentUserDisplay()
  const [roles, setRoles] = useState<TutorRole[]>([])
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
  const [input, setInput] = useState('')
  const [topic, setTopic] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [started, setStarted] = useState(false)
  const [hubMessages, setHubMessages] = useState<WorkshopHubEvent[]>([])
  const [assistantDraft, setAssistantDraft] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [phaseLabel, setPhaseLabel] = useState('等待发起')
  const [viewMode, setViewMode] = useState<ViewMode>('classic')
  const [selectedTownNodeId, setSelectedTownNodeId] = useState('profile-agent')
  const timelineEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getTutorRoles()
      .then((data) => {
        setRoles(data)
        setSelectedRoleIds(data.slice(0, 4).map((role) => role.id))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [hubMessages])

  const selectedRoles = useMemo(
    () => roles.filter((role) => selectedRoleIds.includes(role.id)),
    [roles, selectedRoleIds],
  )

  const timelineEvents = useMemo(
    () => hubMessages.map((event, index) => toTimelineEvent(event, index)),
    [hubMessages],
  )

  const board = useMemo(
    () => buildBoardState(timelineEvents, assistantDraft),
    [timelineEvents, assistantDraft],
  )

  const townNodes = useMemo(
    () => buildTownNodes(timelineEvents, started, streaming),
    [timelineEvents, started, streaming],
  )

  const selectedTownNode = useMemo(
    () => townNodes.find((node) => node.id === selectedTownNodeId) || townNodes[0],
    [selectedTownNodeId, townNodes],
  )

  function toggleRole(roleId: number) {
    setSelectedRoleIds((prev) => {
      if (prev.includes(roleId)) return prev.filter((id) => id !== roleId)
      if (prev.length >= 6) return prev
      return [...prev, roleId]
    })
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
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
    setAssistantDraft('')
    setExpandedIds(new Set())
    setPhaseLabel('画像分析')
    setSelectedTownNodeId('profile-agent')

    try {
      const conv = await api.createTutorConversation({
        title: question.slice(0, 20),
        roleId: selectedRoleIds[0],
      })

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
            setAssistantDraft((prev) => prev + chunk)
          },
          onHub: (evt) => {
            setHubMessages((prev) => mergeHubEvent(prev, evt))
            if (TOWN_NODE_DEFS.some((node) => node.id === evt.agentId)) {
              setSelectedTownNodeId(evt.agentId)
            }
          },
          onWorkshopPhase: (evt) => {
            setPhaseLabel(formatPhaseLabel(evt.phase, evt.round, evt.status))
          },
        },
      )
    } catch {
      setHubMessages((prev) => [
        ...prev,
        {
          phase: 'synthesis',
          round: 0,
          agentId: 'system-error',
          agentName: '研讨会系统',
          agentKind: 'system',
          content: '研讨会启动失败，请稍后重试。',
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setStreaming(false)
      setPhaseLabel('研讨完成')
    }
  }

  return (
    <div
      data-guide-target="workshop-workspace"
      className="flex h-screen bg-[#eef3f8] text-[#172033] max-[860px]:block max-[860px]:h-auto max-[860px]:min-h-screen"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif' }}
    >
      <nav className="flex w-[200px] shrink-0 flex-col border-r border-[#dbe4ee] bg-[#f4f7fb] max-[860px]:hidden">
        <div className="border-b border-[#dbe4ee] p-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sparklearn-logo-official.png" alt="" className="h-8 w-8 object-contain" />
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-[#1f2a37]">SparkLearn</div>
              <div className="text-[10px] text-[#7a8aa0]">多智能体学习闭环</div>
            </div>
          </div>
        </div>
        <div className="p-3">
          <button onClick={() => router.push('/tutor')} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2365d8] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1d55b9]">
            <Plus className="h-4 w-4" /> 新建对话
          </button>
        </div>
        <div className="flex-1 space-y-0.5 px-3">
          <NavItem icon={Sparkles} label="学习空间" onClick={() => router.push('/tutor')} />
          <NavItem icon={UserCog} label="角色工坊" onClick={() => router.push('/tutor/roles')} />
          <div className="flex items-center gap-2.5 rounded-lg bg-[#2365d8] px-3 py-2.5 text-sm font-medium text-white shadow-sm">
            <Users className="h-4 w-4" /> 研讨会
          </div>
          <div className="my-3 border-t border-[#dbe4ee]" />
          <NavItem icon={Database} label="知识库" onClick={() => router.push('/tutor/knowledge')} />
          <NavItem icon={Puzzle} label="MCP 插件商店" onClick={() => router.push('/tutor/mcp-store')} />
          <NavItem icon={Sparkles} label="Skills 商店" onClick={() => router.push('/tutor/skills')} />
          <NavItem icon={FileText} label="我的文件" onClick={() => router.push('/tutor/files')} />
        </div>
        <div className="space-y-2 border-t border-[#dbe4ee] p-3">
          <NavItem icon={ArrowLeft} label="返回主平台" onClick={() => router.push('/')} />
          <TutorUserBadge />
        </div>
      </nav>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-[#dbe4ee] bg-white px-5 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-[#172033]">多智能体研讨会</h1>
            <p className="mt-0.5 truncate text-xs text-[#6b7b90]">动态发言、工具查证、质疑修订和共享白板</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 rounded-lg border border-[#dbe4ee] bg-[#f7fafc] p-0.5">
              <button
                type="button"
                data-testid="view-mode-classic"
                onClick={() => setViewMode('classic')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'classic' ? 'bg-white text-[#2365d8] shadow-sm' : 'text-[#617089] hover:text-[#172033]',
                )}
              >
                研讨会
              </button>
              <button
                type="button"
                data-testid="view-mode-town"
                onClick={() => setViewMode('town')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'town' ? 'bg-white text-[#2365d8] shadow-sm' : 'text-[#617089] hover:text-[#172033]',
                )}
              >
                赛博小镇
              </button>
            </div>
            <span className="hidden rounded-full border border-[#dbe4ee] bg-[#f7fafc] px-3 py-1.5 text-xs text-[#617089] sm:inline-flex">
              当前阶段：{phaseLabel}
            </span>
            {started && (
              <button
                onClick={() => {
                  setStarted(false)
                  setTopic('')
                  setHubMessages([])
                  setAssistantDraft('')
                  setExpandedIds(new Set())
                  setPhaseLabel('等待发起')
                  setSelectedTownNodeId('profile-agent')
                }}
                className="rounded-lg border border-[#f0c4c8] px-3 py-1.5 text-xs text-[#bd3c45] transition-colors hover:bg-[#fff1f2]"
              >
                结束研讨
              </button>
            )}
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px] gap-0 overflow-hidden max-[1180px]:grid-cols-[230px_minmax(0,1fr)] max-[860px]:block max-[860px]:overflow-visible">
          <aside className="min-h-0 overflow-y-auto border-r border-[#dbe4ee] bg-white max-[860px]:border-b max-[860px]:border-r-0">
            <RoleRail
              roles={roles}
              selectedRoleIds={selectedRoleIds}
              selectedRoles={selectedRoles}
              timelineEvents={timelineEvents}
              streaming={streaming}
              onToggleRole={toggleRole}
              onManageRoles={() => router.push('/tutor/roles')}
            />
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden bg-[#f7fafc]">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {!started ? (
                viewMode === 'town' ? (
                  <div className="mx-auto max-w-[920px] space-y-4">
                    <CyberTownVerse
                      nodes={townNodes}
                      selectedNode={selectedTownNode}
                      phaseLabel={phaseLabel}
                      started={started}
                      streaming={streaming}
                      onSelectNode={setSelectedTownNodeId}
                    />
                    <EmptyWorkshop selectedCount={selectedRoleIds.length} />
                  </div>
                ) : (
                  <EmptyWorkshop selectedCount={selectedRoleIds.length} />
                )
              ) : (
                <div className={cn('mx-auto space-y-4', viewMode === 'town' ? 'max-w-[920px]' : 'max-w-[820px]')}>
                  {viewMode === 'town' && (
                    <CyberTownVerse
                      nodes={townNodes}
                      selectedNode={selectedTownNode}
                      phaseLabel={phaseLabel}
                      started={started}
                      streaming={streaming}
                      onSelectNode={setSelectedTownNodeId}
                    />
                  )}

                  <div className="flex justify-end">
                    <div className="flex max-w-[650px] items-start gap-2">
                      <div className="rounded-2xl rounded-tr-sm bg-[#e8f1ff] px-4 py-2.5 text-[15px] leading-relaxed text-[#172033]">
                        {topic}
                      </div>
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2365d8] text-xs font-bold text-white">
                        {currentUser.nameChar}
                      </div>
                    </div>
                  </div>

                  <div data-testid="workshop-timeline" className="rounded-xl border border-[#dbe4ee] bg-white">
                    <div className="flex items-center justify-between border-b border-[#dbe4ee] px-4 py-3">
                      <div>
                        <h2 className="text-sm font-semibold text-[#172033]">研讨时间线</h2>
                        <p className="mt-0.5 text-xs text-[#6b7b90]">默认显示每次发言摘要，展开可查看完整内容</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#6b7b90]">
                        {streaming ? <PlayCircle className="h-4 w-4 text-[#12865f]" /> : <PauseCircle className="h-4 w-4" />}
                        {streaming ? '实时生成中' : '当前静止'}
                      </div>
                    </div>

                    {timelineEvents.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-[#7a8aa0]">
                        {streaming ? '智能体正在独立观察，稍后会把关键观点写入时间线。' : '还没有研讨事件。'}
                      </div>
                    ) : (
                      <div className="divide-y divide-[#edf1f5]">
                        {timelineEvents.map((event) => (
                          <TimelineCard
                            key={event.id}
                            event={event}
                            expanded={expandedIds.has(event.id)}
                            onToggle={() => toggleExpanded(event.id)}
                          />
                        ))}
                        <div ref={timelineEndRef} />
                      </div>
                    )}
                  </div>

                  {assistantDraft && (
                    <section className="rounded-xl border border-[#dbe4ee] bg-white px-4 py-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#172033]">
                        <PanelRight className="h-4 w-4 text-[#2365d8]" /> 最终综合
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-7 text-[#44546a]">{assistantDraft}</p>
                    </section>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-[#dbe4ee] bg-white px-5 py-4">
              <div className="mx-auto flex max-w-[820px] items-end gap-3 rounded-2xl border border-[#dbe4ee] bg-white px-4 py-3 shadow-sm">
                <textarea
                  data-testid="workshop-input"
                  data-guide-target="workshop-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void startDiscussion()
                    }
                  }}
                  placeholder={started ? '继续追问或补充研讨约束...' : '输入研讨主题，例如：帮我 7 天补齐 Python 函数薄弱点'}
                  rows={1}
                  className="min-h-[26px] max-h-[96px] flex-1 resize-none border-0 bg-transparent text-[15px] text-[#172033] placeholder:text-[#8a98aa] focus:outline-none"
                />
                <button
                  data-testid="workshop-submit"
                  onClick={() => void startDiscussion()}
                  disabled={!input.trim() || streaming || selectedRoleIds.length === 0}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2365d8] text-white transition-colors hover:bg-[#1d55b9] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="发起研讨"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto border-l border-[#dbe4ee] bg-white max-[1180px]:hidden">
            <SharedBoard board={board} started={started} streaming={streaming} />
          </aside>
        </section>
      </main>

      <NewUserGuidePanel />
    </div>
  )
}

function NavItem({ icon: Icon, label, onClick }: { icon: typeof Sparkles; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-[#526176] transition-colors hover:bg-white hover:text-[#172033]">
      <Icon className="h-4 w-4" /> {label}
    </button>
  )
}

function RoleRail({
  roles,
  selectedRoleIds,
  selectedRoles,
  timelineEvents,
  streaming,
  onToggleRole,
  onManageRoles,
}: {
  roles: TutorRole[]
  selectedRoleIds: number[]
  selectedRoles: TutorRole[]
  timelineEvents: TimelineEvent[]
  streaming: boolean
  onToggleRole: (roleId: number) => void
  onManageRoles: () => void
}) {
  return (
    <div>
      <div className="border-b border-[#edf1f5] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#172033]">参与智能体</h2>
          <span className="text-xs text-[#7a8aa0]">{selectedRoleIds.length}/6</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-[#7a8aa0]">每个智能体有自己的节奏，状态会随时间线变化。</p>
      </div>

      <div className="border-b border-[#edf1f5]">
        {SYSTEM_AGENTS.map((agent) => (
          <AgentStatusRow
            key={agent.id}
            name={agent.name}
            duty={agent.duty}
            status={deriveSystemAgentStatus(agent.id, timelineEvents, streaming)}
            Icon={agent.icon}
            selected
          />
        ))}
      </div>

      <div className="max-h-[38vh] overflow-y-auto">
        {roles.map((role) => {
          const selected = selectedRoleIds.includes(role.id)
          return (
            <button
              key={role.id}
              onClick={() => onToggleRole(role.id)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-[#f1f4f7] px-4 py-3 text-left transition-colors',
                selected ? 'bg-[#eef6ff]' : 'hover:bg-[#f8fafc]',
              )}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e6edf5] text-sm font-semibold text-[#334155]">
                {role.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#172033]">{role.name}</p>
                <p className="mt-0.5 truncate text-xs text-[#7a8aa0]">{role.persona || '自定义导师'}</p>
              </div>
              <div className={cn('grid h-5 w-5 shrink-0 place-items-center rounded border-2', selected ? 'border-[#2365d8] bg-[#2365d8]' : 'border-[#dbe4ee]')}>
                {selected && <Check className="h-3 w-3 text-white" />}
              </div>
            </button>
          )
        })}
      </div>

      <div className="p-3">
        <button onClick={onManageRoles} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#dbe4ee] px-3 py-2 text-xs text-[#526176] transition-colors hover:bg-[#f8fafc]">
          <UserCog className="h-3.5 w-3.5" /> 管理角色库
        </button>
      </div>

      {selectedRoles.length > 0 && (
        <div className="border-t border-[#edf1f5] p-4">
          <h3 className="mb-2 text-xs font-semibold text-[#172033]">本次自定义导师</h3>
          <div className="space-y-2">
            {selectedRoles.slice(0, 4).map((role) => (
              <div key={role.id} className="rounded-lg bg-[#f7fafc] px-3 py-2">
                <p className="truncate text-xs font-medium text-[#172033]">{role.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-[#7a8aa0]">{role.persona || '参与观点补充'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AgentStatusRow({
  name,
  duty,
  status,
  Icon,
  selected,
}: {
  name: string
  duty: string
  status: string
  Icon: typeof Search
  selected: boolean
}) {
  return (
    <div className={cn('grid grid-cols-[36px_1fr_auto] items-center gap-2 px-4 py-3', selected && 'bg-white')}>
      <div className="grid h-9 w-9 place-items-center rounded-full border border-[#dbe4ee] bg-[#f7fafc] text-[#2365d8]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#172033]">{name}</p>
        <p className="mt-0.5 truncate text-xs text-[#7a8aa0]">{duty}</p>
      </div>
      <span className="rounded-full border border-[#dbe4ee] bg-[#f8fafc] px-2 py-1 text-[11px] text-[#617089]">{status}</span>
    </div>
  )
}

function EmptyWorkshop({ selectedCount }: { selectedCount: number }) {
  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <div className="max-w-[560px] text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#2365d8] text-white shadow-lg">
          <Users className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-semibold text-[#172033]">发起一场多智能体研讨</h2>
        <p className="mt-3 text-sm leading-7 text-[#65758a]">
          已选择 {selectedCount} 个参与角色。输入主题后，系统会把智能体的观察、查证、质疑、修订和总结展示成时间线。
        </p>
      </div>
    </div>
  )
}

function CyberTownVerse({
  nodes,
  selectedNode,
  phaseLabel,
  started,
  streaming,
  onSelectNode,
}: {
  nodes: TownNode[]
  selectedNode: TownNode
  phaseLabel: string
  started: boolean
  streaming: boolean
  onSelectNode: (nodeId: string) => void
}) {
  return (
    <section
      data-testid="cyber-town-verse"
      className="overflow-hidden rounded-xl border border-[#cfdbe8] bg-[#f8fbff] shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe4ee] bg-white px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#172033]">AgentVerse 赛博小镇</h2>
          <p className="mt-0.5 text-xs leading-5 text-[#6b7b90]">
            以环境模拟方式观察多个智能体协同，底层仍使用当前 Workshop 事件流。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#dbe4ee] bg-[#f7fafc] px-3 py-1.5 text-xs text-[#617089]">
          {streaming ? <PlayCircle className="h-4 w-4 text-[#12865f]" /> : <PauseCircle className="h-4 w-4" />}
          {started ? phaseLabel : '小镇待机'}
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative min-h-[410px] overflow-hidden rounded-xl border border-[#dbe4ee] bg-[#eaf3fb]">
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(30deg,rgba(35,101,216,0.10)_1px,transparent_1px),linear-gradient(150deg,rgba(35,101,216,0.10)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="absolute left-[10%] top-[56%] h-20 w-[76%] -rotate-[7deg] rounded-full bg-[#d7e8f7]" />
          <div className="absolute left-[25%] top-[14%] h-[68%] w-20 rotate-[31deg] rounded-full bg-[#d7e8f7]" />
          <div className="absolute bottom-4 left-4 rounded-lg border border-white/70 bg-white/75 px-3 py-2 text-[11px] text-[#617089] shadow-sm">
            pixel simulation layer · observe / inspect / replay
          </div>
          {nodes.map((node) => (
            <TownBuilding
              key={node.id}
              node={node}
              selected={selectedNode.id === node.id}
              onClick={() => onSelectNode(node.id)}
            />
          ))}
        </div>

        <TownInspector node={selectedNode} />
      </div>
    </section>
  )
}

function TownBuilding({ node, selected, onClick }: { node: TownNode; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={`town-building-${node.id}`}
      onClick={onClick}
      className="absolute w-[132px] -translate-x-1/2 -translate-y-1/2 text-left outline-none"
      style={{ left: node.x, top: node.y }}
    >
      <div className={cn(
        'relative mx-auto h-16 w-20 transition-transform',
        selected && '-translate-y-1',
        node.status === 'running' && 'animate-pulse',
      )}>
        <div className={cn('absolute left-4 top-0 h-12 w-12 border-2 shadow-sm', townRoofClass(node.tone, node.status))} />
        <div className={cn('absolute bottom-0 left-1 h-11 w-[72px] border-2 shadow-sm', townWallClass(node.status))}>
          <span className={cn('absolute left-2 top-2 h-2 w-2 rounded-sm', townLightClass(node.status))} />
          <span className={cn('absolute right-2 top-2 h-2 w-2 rounded-sm', townLightClass(node.status))} />
          <span className="absolute bottom-0 left-[29px] h-5 w-3 rounded-t-sm bg-[#526176]" />
        </div>
        <div className={cn('absolute -right-1 bottom-0 h-5 w-5 rounded-full border-2 border-white shadow-sm', townResidentClass(node.status))} />
      </div>
      <div className={cn(
        'mt-2 rounded-lg border bg-white/90 px-2.5 py-2 text-center shadow-sm backdrop-blur',
        selected ? 'border-[#2365d8]' : 'border-white',
      )}>
        <p className="truncate text-xs font-semibold text-[#172033]">{node.title}</p>
        <p className="mt-0.5 text-[10px] text-[#617089]">{townStatusLabel(node.status)}</p>
      </div>
    </button>
  )
}

function TownInspector({ node }: { node: TownNode }) {
  return (
    <aside data-testid="town-inspector" className="rounded-xl border border-[#dbe4ee] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a8aa0]">Agent Inspector</p>
          <h3 className="mt-1 text-base font-semibold text-[#172033]">{node.title}</h3>
          <p className="mt-0.5 text-xs text-[#617089]">{node.agentName}</p>
        </div>
        <span className={cn('rounded-full px-2 py-1 text-[11px] font-medium', townStatusPillClass(node.status))}>
          {townStatusLabel(node.status)}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <TownInspectorRow label="职责" value={node.duty} />
        <TownInspectorRow label="阶段" value={formatPhaseLabel(node.latestEvent?.phase || node.phase, node.latestEvent?.round, node.status === 'running' ? 'running' : 'done')} />
        <TownInspectorRow label="轮次" value={node.latestEvent ? `第 ${node.latestEvent.round} 轮` : '等待发起'} />
        <div>
          <p className="text-[11px] font-semibold text-[#7a8aa0]">最近事件</p>
          <p className="mt-1 rounded-lg border border-[#e4ebf2] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#44546a]">
            {node.latestEvent?.content || '暂无事件，建筑处于待命状态。'}
          </p>
        </div>
      </div>
    </aside>
  )
}

function TownInspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#7a8aa0]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#44546a]">{value}</p>
    </div>
  )
}

function TimelineCard({ event, expanded, onToggle }: { event: TimelineEvent; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-testid={`timeline-card-${event.agentId}-${event.round}`}
      onClick={onToggle}
      className="grid w-full grid-cols-[88px_34px_1fr] gap-3 px-4 py-4 text-left transition-colors hover:bg-[#f8fafc] max-[640px]:grid-cols-[34px_1fr]"
      aria-expanded={expanded}
    >
      <div className="pt-1 text-xs text-[#7a8aa0] max-[640px]:hidden">
        {formatTime(event.timestamp)}
      </div>
      <div className={cn('grid h-8 w-8 place-items-center rounded-full border', toneClass(event.tone))}>
        {renderToneIcon(event.tone)}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#172033]">{event.agentName}</span>
          <span className="rounded-full border border-[#dbe4ee] bg-white px-2 py-0.5 text-[11px] text-[#617089]">{event.phaseLabel}</span>
          <span className="rounded-full bg-[#edf4ff] px-2 py-0.5 text-[11px] text-[#2365d8]">{labelForTone(event.tone)}</span>
          <ChevronDown className={cn('ml-auto h-4 w-4 text-[#8a98aa] transition-transform', expanded && 'rotate-180')} />
        </div>
        <p className="mt-2 text-sm leading-6 text-[#44546a]">{event.summary}</p>
        {expanded && (
          <div className="mt-3 rounded-lg border border-[#dbe4ee] bg-[#f7fafc] px-3 py-2">
            <p className="whitespace-pre-wrap text-sm leading-7 text-[#172033]">{event.content}</p>
          </div>
        )}
      </div>
    </button>
  )
}

function SharedBoard({ board, started, streaming }: { board: BoardState; started: boolean; streaming: boolean }) {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#172033]">共享白板</h2>
        <span className="rounded-full border border-[#dbe4ee] bg-[#f7fafc] px-2 py-1 text-[11px] text-[#617089]">
          {streaming ? '实时沉淀' : started ? '已沉淀' : '待开始'}
        </span>
      </div>
      {!started ? (
        <div className="rounded-xl border border-dashed border-[#dbe4ee] px-4 py-8 text-center text-sm leading-6 text-[#7a8aa0]">
          发起研讨后，这里会同步沉淀共识、证据、风险和行动项。
        </div>
      ) : (
        <div className="space-y-4">
          <BoardSection icon={Lightbulb} title="共识" items={board.consensus} empty="等待主持人收束共识" />
          <BoardSection icon={Search} title="证据" items={board.evidence} empty="等待资料或工具结果" />
          <BoardSection icon={ShieldAlert} title="风险" items={board.risks} empty="暂无明确风险" />
          <BoardSection icon={ClipboardList} title="行动项" items={board.actions} empty="等待行动教练整理" />
          <BoardSection icon={MessageSquareText} title="可追问" items={board.followUps} empty="最终总结后生成" />
        </div>
      )}
    </div>
  )
}

function BoardSection({ icon: Icon, title, items, empty }: { icon: typeof Search; title: string; items: string[]; empty: string }) {
  return (
    <section className="rounded-xl border border-[#dbe4ee] bg-[#f8fafc]">
      <div className="flex items-center gap-2 border-b border-[#e4ebf2] px-3 py-2 text-xs font-semibold text-[#172033]">
        <Icon className="h-3.5 w-3.5 text-[#2365d8]" /> {title}
      </div>
      <div className="space-y-2 px-3 py-3">
        {items.length > 0 ? items.slice(0, 4).map((item, index) => (
          <p key={`${title}-${index}`} className="text-xs leading-5 text-[#526176]">{item}</p>
        )) : (
          <p className="text-xs leading-5 text-[#8a98aa]">{empty}</p>
        )}
      </div>
    </section>
  )
}

function mergeHubEvent(prev: WorkshopHubEvent[], evt: WorkshopHubEvent) {
  const idx = prev.findIndex((item) => (
    item.agentId === evt.agentId
    && item.round === evt.round
    && item.phase === evt.phase
  ))
  if (idx < 0) return [...prev, evt]
  const next = [...prev]
  next[idx] = {
    ...next[idx],
    ...evt,
    content: evt.content,
    timestamp: evt.timestamp,
    delta: evt.delta,
  }
  return next
}

function toTimelineEvent(event: WorkshopHubEvent, index: number): TimelineEvent {
  return {
    ...event,
    id: `${event.agentId}-${event.round}-${index}`,
    summary: summarizeContent(event.content),
    phaseLabel: formatPhaseLabel(event.phase, event.round, 'done'),
    tone: inferTone(event),
  }
}

function summarizeContent(content: string) {
  const text = normalizeText(content)
  const firstSentence = text.split(/(?<=[。！？!?])\s*/)[0] || text
  const source = firstSentence.length >= 18 ? firstSentence : text
  return source.length > 72 ? `${source.slice(0, 72)}...` : source
}

function normalizeText(content: string) {
  return (content || '').replace(/\s+/g, ' ').trim()
}

function inferTone(event: WorkshopHubEvent): TimelineTone {
  const text = `${event.agentId} ${event.agentName} ${event.content}`.toLowerCase()
  if (event.phase === 'profile_analysis') return 'profile'
  if (event.phase === 'synthesis' || event.agentId.includes('final')) return 'synthesis'
  if (/搜索|检索|资料|证据|工具|mcp|web|引用|查证/.test(text)) return 'tool'
  if (/质疑|风险|漏洞|误导|边界|不足|缺少/.test(text)) return 'risk'
  if (/行动|计划|任务|练习|下一步|执行|安排/.test(text)) return 'action'
  return 'default'
}

function renderToneIcon(tone: TimelineTone) {
  if (tone === 'profile') return <Database className="h-4 w-4" />
  if (tone === 'tool') return <Search className="h-4 w-4" />
  if (tone === 'risk') return <ShieldAlert className="h-4 w-4" />
  if (tone === 'action') return <ClipboardList className="h-4 w-4" />
  if (tone === 'synthesis') return <Sparkles className="h-4 w-4" />
  return <Bot className="h-4 w-4" />
}

function labelForTone(tone: TimelineTone) {
  if (tone === 'profile') return '画像'
  if (tone === 'tool') return '查证'
  if (tone === 'risk') return '质疑'
  if (tone === 'action') return '行动'
  if (tone === 'synthesis') return '综合'
  return '发言'
}

function toneClass(tone: TimelineTone) {
  if (tone === 'tool') return 'border-[#b8cdf2] bg-[#edf4ff] text-[#2365d8]'
  if (tone === 'risk') return 'border-[#f0c4c8] bg-[#fff1f2] text-[#bd3c45]'
  if (tone === 'action') return 'border-[#b7e2d0] bg-[#ecfdf5] text-[#12865f]'
  if (tone === 'synthesis') return 'border-[#d8cdf8] bg-[#f4f0ff] text-[#5a4fcf]'
  if (tone === 'profile') return 'border-[#cbd8e5] bg-[#f7fafc] text-[#526176]'
  return 'border-[#dbe4ee] bg-white text-[#526176]'
}

function buildTownNodes(events: TimelineEvent[], started: boolean, streaming: boolean): TownNode[] {
  return TOWN_NODE_DEFS.map((definition) => {
    const latestEvent = [...events].reverse().find((event) => event.agentId === definition.id)
    return {
      ...definition,
      latestEvent,
      status: deriveTownNodeStatus(latestEvent, started, streaming),
    }
  })
}

function deriveTownNodeStatus(latestEvent: TimelineEvent | undefined, started: boolean, streaming: boolean): TownNodeStatus {
  if (!started) return 'waiting'
  if (latestEvent?.delta) return 'running'
  if (latestEvent) return 'done'
  return streaming ? 'waiting' : 'waiting'
}

function townStatusLabel(status: TownNodeStatus) {
  if (status === 'running') return '运行中'
  if (status === 'done') return '已完成'
  return '等待中'
}

function townRoofClass(tone: TimelineTone, status: TownNodeStatus) {
  const active = status === 'running' || status === 'done'
  if (tone === 'risk') return active ? 'border-[#f0a3ad] bg-[#ffccd5]' : 'border-[#cfd8e3] bg-[#e9eef5]'
  if (tone === 'action') return active ? 'border-[#7bcfa8] bg-[#b9f2d4]' : 'border-[#cfd8e3] bg-[#e9eef5]'
  if (tone === 'synthesis') return active ? 'border-[#b9a8f5] bg-[#dcd3ff]' : 'border-[#cfd8e3] bg-[#e9eef5]'
  if (tone === 'tool') return active ? 'border-[#8eb4ef] bg-[#cfe0ff]' : 'border-[#cfd8e3] bg-[#e9eef5]'
  return active ? 'border-[#95bddc] bg-[#d3eaff]' : 'border-[#cfd8e3] bg-[#e9eef5]'
}

function townWallClass(status: TownNodeStatus) {
  if (status === 'running') return 'border-[#2365d8] bg-[#ffffff]'
  if (status === 'done') return 'border-[#8ccdb0] bg-[#ffffff]'
  return 'border-[#cfd8e3] bg-[#ffffff]'
}

function townLightClass(status: TownNodeStatus) {
  if (status === 'running') return 'bg-[#4f8cff] shadow-[0_0_12px_rgba(79,140,255,0.8)]'
  if (status === 'done') return 'bg-[#32c17b] shadow-[0_0_10px_rgba(50,193,123,0.55)]'
  return 'bg-[#cbd5e1]'
}

function townResidentClass(status: TownNodeStatus) {
  if (status === 'running') return 'bg-[#2365d8]'
  if (status === 'done') return 'bg-[#12865f]'
  return 'bg-[#94a3b8]'
}

function townStatusPillClass(status: TownNodeStatus) {
  if (status === 'running') return 'bg-[#edf4ff] text-[#2365d8]'
  if (status === 'done') return 'bg-[#ecfdf5] text-[#12865f]'
  return 'bg-[#f1f5f9] text-[#617089]'
}

function formatPhaseLabel(phase: string, round?: number, status?: string) {
  const suffix = status === 'running' ? '中' : ''
  if (phase === 'profile_analysis') return `画像分析${suffix}`
  if (phase === 'synthesis') return `综合总结${suffix}`
  if (phase === 'discussion') return round ? `第 ${round} 轮研讨${suffix}` : `研讨${suffix}`
  return phase || '研讨'
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function deriveSystemAgentStatus(agentId: string, events: TimelineEvent[], streaming: boolean) {
  const latest = [...events].reverse().find((event) => event.agentId === agentId || event.tone === roleTone(agentId))
  if (!streaming && latest) return '已发言'
  if (latest?.tone === 'tool') return '查证中'
  if (latest?.tone === 'risk') return '质疑中'
  if (latest?.tone === 'synthesis') return '总结中'
  if (streaming) return latest ? '发言中' : '观察中'
  return '等待中'
}

function roleTone(agentId: string): TimelineTone {
  if (agentId === 'profile-agent') return 'profile'
  if (agentId === 'researcher') return 'tool'
  if (agentId === 'challenger') return 'risk'
  if (agentId === 'coach') return 'action'
  return 'default'
}

function buildBoardState(events: TimelineEvent[], finalText: string): BoardState {
  const parsed = parseWorkshopConclusion(finalText)
  const evidence = events.filter((event) => event.tone === 'tool').map((event) => event.summary)
  const risks = events.filter((event) => event.tone === 'risk').map((event) => event.summary)
  const actionsFromEvents = events.filter((event) => event.tone === 'action').map((event) => event.summary)
  const consensusFromEvents = events
    .filter((event) => event.tone === 'synthesis' || event.phase === 'profile_analysis')
    .map((event) => event.summary)

  return {
    consensus: uniqueItems([...consensusFromEvents, ...splitLines(parsed.core)]),
    evidence: uniqueItems(evidence),
    risks: uniqueItems(risks),
    actions: uniqueItems([...actionsFromEvents, ...parsed.actions]),
    followUps: uniqueItems(parsed.followUps),
  }
}

function splitLines(text: string) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean)
}

function uniqueItems(items: string[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const normalized = item.replace(/\s+/g, '')
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function parseWorkshopConclusion(fullContent: string): { core: string; actions: string[]; followUps: string[] } {
  const lines = fullContent.split('\n').map((line) => line.trim()).filter(Boolean)
  const actions: string[] = []
  const followUps: string[] = []
  const coreLines: string[] = []
  let section: 'core' | 'actions' | 'followups' = 'core'

  for (const line of lines) {
    if (/核心结论|结论|共识/i.test(line)) {
      section = 'core'
      continue
    }
    if (/行动清单|行动建议|下一步|任务/i.test(line)) {
      section = 'actions'
      continue
    }
    if (/可追问|追问|后续问题|后续建议/i.test(line)) {
      section = 'followups'
      continue
    }
    const clean = line.replace(/^[\d\-*.)、\s]+/, '').trim()
    if (!clean) continue
    if (section === 'actions') actions.push(clean)
    else if (section === 'followups') followUps.push(clean)
    else coreLines.push(clean)
  }

  return { core: coreLines.join('\n').trim(), actions, followUps }
}
