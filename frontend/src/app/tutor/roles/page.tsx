'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, StudentProfile, TutorRole } from '@/lib/api'
import {
  ArrowLeft,
  Check,
  Database,
  FileText,
  Paperclip,
  Plus,
  Puzzle,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const SYSTEM_AGENTS = [
  { id: 'profile-agent', name: '画像分析师', desc: '分析学习者基础与薄弱点，给出个性化建议' },
  { id: 'clarifier', name: '提问优化师', desc: '重构问题使其更清晰，明确目标与约束' },
  { id: 'subject-tutor', name: '学科导师', desc: '给出专业解释与解题路径，强调准确性' },
  { id: 'challenger', name: '质疑者', desc: '发现漏洞与边界条件，提出修正建议' },
  { id: 'coach', name: '行动教练', desc: '将讨论转化为可执行学习动作' },
]

type RoleDraft = {
  name: string
  persona: string
  background: string
  styleGuide: string
  rules: string
}

type TutorQuestionAnalysis = {
  subjectLabel: string
  intentLabel: string
  archetype: string
  stage: string
  goals: string
  weakPoints: string
  preference: string
}

const EMPTY_DRAFT: RoleDraft = { name: '', persona: '', background: '', styleGuide: '', rules: '' }
const PENDING_ROLE_ID_KEY = 'sparklearn_pending_tutor_role_id'

export default function RolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<TutorRole[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState<RoleDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [activeTab, setActiveTab] = useState<'persona' | 'background' | 'style' | 'rules'>('persona')
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [quickCreateQuestion, setQuickCreateQuestion] = useState('')
  const [quickCreateLoading, setQuickCreateLoading] = useState(false)
  const [quickCreateError, setQuickCreateError] = useState('')

  const selectedRole = roles.find((r) => r.id === selectedId) || null

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.getTutorRoles()
        setRoles(data)
        if (data.length > 0) {
          const first = data[0]
          setSelectedId(first.id)
          setDraft({
            name: first.name,
            persona: first.persona,
            background: first.background,
            styleGuide: first.styleGuide,
            rules: first.rules,
          })
          setIsNew(false)
        }
      } catch { /* ignore */ }
    })()
  }, [])

  function selectRole(role: TutorRole) {
    setSelectedId(role.id)
    setDraft({
      name: role.name,
      persona: role.persona,
      background: role.background,
      styleGuide: role.styleGuide,
      rules: role.rules,
    })
    setIsNew(false)
  }

  function startCreate() {
    setSelectedId(null)
    setDraft(EMPTY_DRAFT)
    setIsNew(true)
  }

  async function handleSave() {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      if (isNew) {
        const created = await api.createTutorRole({
          name: draft.name,
          persona: draft.persona,
          background: draft.background,
          styleGuide: draft.styleGuide,
          rules: draft.rules,
        })
        setRoles((prev) => [created, ...prev])
        setSelectedId(created.id)
        setIsNew(false)
      } else if (selectedId) {
        const updated = await api.updateTutorRole(selectedId, {
          name: draft.name,
          persona: draft.persona,
          background: draft.background,
          styleGuide: draft.styleGuide,
          rules: draft.rules,
        })
        setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleQuickGenerate() {
    const question = quickCreateQuestion.trim()
    if (!question) return
    setQuickCreateLoading(true)
    setQuickCreateError('')
    try {
      let created
      try {
        created = await api.createTutorRoleFromQuestion({ question })
      } catch {
        const profile = await api.getProfile().catch(() => null)
        const fallback = buildLocalTutorRole(question, profile)
        created = await api.createTutorRole(fallback)
      }
      setRoles((prev) => [created, ...prev])
      setSelectedId(created.id)
      setDraft({
        name: created.name,
        persona: created.persona,
        background: created.background,
        styleGuide: created.styleGuide,
        rules: created.rules,
      })
      setIsNew(false)
      setQuickCreateOpen(false)
      setQuickCreateQuestion('')
      localStorage.setItem(PENDING_ROLE_ID_KEY, String(created.id))
      router.push('/tutor')
    } catch (error) {
      setQuickCreateError(error instanceof Error ? error.message : '生成失败，请重试')
    }
    setQuickCreateLoading(false)
  }

  function buildLocalTutorRole(question: string, profile: StudentProfile | null) {
    const analysis = analyzeTutorQuestion(question, profile)
    const pool = buildLocalRoleDimensionPool(analysis)
    return {
      name: pool.name,
      persona: `角色身份：${pool.roleIdentity}\n服务场景：${pool.serviceScenarios}`,
      background: `专属工作流：${pool.workflow}`,
      styleGuide: `输出格式：${pool.outputFormat}`,
      rules: `禁止事项：${pool.prohibitions}\n\n示例对话（2-3 轮短示例）：\n${pool.sampleDialogue}`,
    }
  }

  function buildLocalRoleDimensionPool(analysis: TutorQuestionAnalysis) {
    return {
      name: deriveLocalTutorName(analysis),
      roleIdentity: `你是${analysis.subjectLabel}领域的${analysis.archetype}导师，核心任务是围绕${analysis.intentLabel}展开，结合学习目标“${analysis.goals}”与薄弱点“${analysis.weakPoints}”提供具体、可执行的带学支持。`,
      serviceScenarios: `适配${analysis.stage}阶段的学习者，重点覆盖与${analysis.subjectLabel}相关的概念理解、题目讲解、错题复盘、学习规划或陪练训练等场景，并根据学习偏好“${analysis.preference}”调整节奏。`,
      workflow: '1. 先判断用户问题属于哪类场景；2. 再结合学习画像选择讲解深度；3. 先给结论和方向，再拆步骤；4. 如果有题目，优先拆题再示范；5. 最后补一个最小练习或自检点。',
      outputFormat: '固定按“先结论、再步骤、再示例、最后检查点”的顺序输出；每一步保持短句、明确、可执行；必要时用项目符号分段，避免长段堆叠。',
      prohibitions: '不要直接复述用户原句；不要把用户输入当作角色设定文本；不要一上来只给最终答案；不要空泛鼓励或泛化建议；不要忽略学习画像中的目标、薄弱点和偏好。',
      sampleDialogue: '用户：我想补函数。\n导师：先判断你卡在定义、图像还是性质，再从最容易补的点开始。\n用户：我总是看不懂题目。\n导师：那我们先拆题干，标出已知条件和求解目标，再做一步最小练习。',
    }
  }

  function analyzeTutorQuestion(question: string, profile: StudentProfile | null): TutorQuestionAnalysis {
    const text = question.trim()
    const keywords = ['高中数学', '数学', '函数', '英语', '物理', '化学', '生物', '语文', '历史', '地理', '编程', '代码', '算法', '作文', '竞赛', '面试', '考研', '考公']
    const found = keywords.filter((kw) => text.includes(kw))
    let subjectLabel = '通用学习'
    if (found.length > 0) {
      subjectLabel = found[0]
      if (found[0] === '高中数学' && found.includes('函数')) subjectLabel = '高中数学函数'
      else if (found.length >= 2) subjectLabel = `${found[0]}${found[1]}`
    }

    let intentLabel = '学习辅导'
    if (text.includes('补') && subjectLabel !== '通用学习') intentLabel = '提分强化'
    else if (['补基础', '提分', '冲刺', '备考', '刷题', '复习', '提纲', '串讲'].some((kw) => text.includes(kw))) intentLabel = '提分强化'
    else if (['作业', '不会', '讲解', '思路', '解题', '题目'].some((kw) => text.includes(kw))) intentLabel = '讲解答疑'
    else if (['错题', '纠错', '改错', '反思', '漏洞'].some((kw) => text.includes(kw))) intentLabel = '纠错复盘'
    else if (['规划', '计划', '路线', '安排'].some((kw) => text.includes(kw))) intentLabel = '学习规划'
    else if (['练习', '陪练', '训练', '训练营'].some((kw) => text.includes(kw))) intentLabel = '陪练训练'
    else if (['方法', '技巧', '模板', '框架'].some((kw) => text.includes(kw))) intentLabel = '方法拆解'

    let archetype = '讲解型'
    if (['提分强化', '纠错复盘', '讲解答疑'].includes(intentLabel)) archetype = '提分型'
    else if (intentLabel === '学习规划') archetype = '规划型'
    else if (intentLabel === '陪练训练') archetype = '陪练型'
    else if (intentLabel === '方法拆解') archetype = '拆解型'

    const goals = profile?.goals?.slice(0, 2).filter(Boolean).join('、') || '当前学习目标'
    const weakPoints = profile?.weakPoints?.slice(0, 3).filter(Boolean).join('、') || '当前薄弱点'
    const preference = profile?.learningPreference?.slice(0, 3).filter(Boolean).join('、') || '循序渐进'
    const stage = profile?.currentStage || '当前阶段'
    return { subjectLabel, intentLabel, archetype, stage, goals, weakPoints, preference }
  }

  function deriveLocalTutorName(analysis: TutorQuestionAnalysis) {
    if (analysis.subjectLabel === '通用学习') {
      return analysis.intentLabel === '学习辅导' ? '个性化导师' : `${analysis.intentLabel}导师`
    }
    if (analysis.intentLabel === '学习辅导') return `${analysis.subjectLabel}导师`
    return `${analysis.subjectLabel}${analysis.intentLabel}导师`.slice(0, 16)
  }

  async function handleDelete(roleId: number) {
    try {
      await api.deleteTutorRole(roleId)
      const next = roles.filter((r) => r.id !== roleId)
      setRoles(next)
      if (selectedId === roleId) {
        if (next.length > 0) selectRole(next[0])
        else { setSelectedId(null); setDraft(EMPTY_DRAFT) }
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="flex h-screen bg-[#f5f7fa] max-[760px]:block max-[760px]:h-auto max-[760px]:min-h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ═══ 左侧导航栏 ═══ */}
      <nav className="flex w-[200px] shrink-0 flex-col border-r border-[#e2e8f0] bg-[#f0f4ff] max-[760px]:hidden">
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
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-medium shadow-sm">
            <UserCog className="w-4 h-4" /> 角色工坊
          </div>
          <button onClick={() => router.push('/tutor/workshop')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Users className="w-4 h-4" /> 研讨会
          </button>
          <div className="my-3 border-t border-[#e2e8f0]" />
          <button onClick={() => router.push('/tutor/knowledge')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Database className="w-4 h-4" /> 知识库
          </button>
          <button onClick={() => router.push('/tutor/mcp-store')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Puzzle className="w-4 h-4" /> MCP 插件商店
          </button>
          <button onClick={() => router.push('/tutor/skills')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Sparkles className="w-4 h-4" /> Skills 商店
          </button>
          <button onClick={() => router.push('/tutor/files')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
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

      {/* ═══ 角色列表栏 ═══ */}
      <div className="flex w-[280px] shrink-0 flex-col border-r border-[#eef1f5] bg-white max-[760px]:w-full max-[760px]:border-b max-[760px]:border-r-0">
        <div className="p-4 border-b border-[#eef1f5]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#1e293b]">角色工坊</h2>
            <button onClick={startCreate} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#2563eb] hover:bg-[#eff6ff] transition-colors">
              <Plus className="w-3.5 h-3.5" /> 新建角色
            </button>
          </div>
          <div className="flex items-center gap-2 h-9 rounded-lg bg-[#f5f7fa] px-3">
            <Search className="w-4 h-4 text-[#94a3b8]" />
            <input type="text" placeholder="搜索角色" className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#94a3b8]" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto max-[760px]:max-h-[42vh]">
          {/* 系统内置智能体 */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">系统智能体</p>
          </div>
          {SYSTEM_AGENTS.map((agent) => (
            <div
              key={agent.id}
              className="px-4 py-2.5 border-b border-[#f5f7fa] cursor-default"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-white text-[11px] font-bold">
                  {agent.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1e293b] truncate">{agent.name}</p>
                  <p className="text-xs text-[#94a3b8] truncate">{agent.desc}</p>
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#eff6ff] text-[#2563eb]">系统内置</span>
                </div>
              </div>
            </div>
          ))}

          {/* 用户角色 */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">我的角色 ({roles.length})</p>
          </div>
          {roles.map((role) => (
            <div
              key={role.id}
              onClick={() => selectRole(role)}
              className={cn(
                'px-4 py-3 border-b border-[#f5f7fa] cursor-pointer transition-colors',
                selectedId === role.id ? 'bg-[#eff6ff] border-l-2 border-l-[#2563eb]' : 'hover:bg-[#f8fafc]',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#64748b] to-[#94a3b8] flex items-center justify-center text-white text-sm font-bold">
                  {role.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-sm font-medium truncate', selectedId === role.id ? 'text-[#2563eb]' : 'text-[#1e293b]')}>{role.name}</p>
                    {selectedId === role.id && <Check className="w-4 h-4 text-[#2563eb] shrink-0" />}
                  </div>
                  <p className="text-xs text-[#94a3b8] truncate mt-0.5">{role.persona || '未设置描述'}</p>
                  <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#059669]">已启用</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 主编辑区 ═══ */}
      <main className="flex min-h-0 flex-1 overflow-hidden max-[760px]:block max-[760px]:overflow-visible">
        {/* 中间详情编辑 */}
        <div className="flex-1 overflow-y-auto p-6 max-[760px]:overflow-visible max-[760px]:p-4">
          {(selectedRole || isNew) ? (
            <>
              {/* 角色头部信息 */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-white text-xl font-bold shadow-md">
                    {draft.name.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-semibold text-[#1e293b]">{draft.name || '新角色'}</h1>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#059669]">已启用</span>
                    </div>
                    <p className="text-sm text-[#64748b] mt-0.5 max-w-[400px]">{draft.persona ? draft.persona.slice(0, 60) : '设置角色的核心能力和教学风格'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-sm text-[#64748b] hover:bg-[#f8fafc] transition-colors">预览角色</button>
                  <button
                    onClick={() => setQuickCreateOpen(true)}
                    className="px-3 py-2 rounded-xl border border-[#dbe4f0] bg-white text-sm text-[#2563eb] hover:bg-[#eff6ff] transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" /> 一句话创建
                  </button>
                  <button onClick={handleSave} disabled={saving || !draft.name.trim()} className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-40 transition-colors flex items-center gap-1.5">
                    <Save className="w-4 h-4" /> 保存
                  </button>
                </div>
              </div>

              {/* Tab 导航 */}
              <div className="flex items-center gap-0 border-b border-[#eef1f5] mb-6">
                {[
                  { key: 'persona', label: 'Persona' },
                  { key: 'background', label: '背景设定' },
                  { key: 'style', label: '风格设定' },
                  { key: 'rules', label: '角色规则' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={cn(
                      'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
                      activeTab === tab.key
                        ? 'border-[#2563eb] text-[#2563eb]'
                        : 'border-transparent text-[#64748b] hover:text-[#1e293b]',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 表单内容 - 参考讯飞星火布局 */}
              <div className="space-y-6">
                {activeTab === 'persona' && (
                  <>
                    {/* 基础信息 */}
                    <section>
                      <h3 className="text-sm font-semibold text-[#1e293b] mb-4">基础信息</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-[100px_1fr] items-start gap-3">
                          <label className="text-sm text-[#475569] pt-2.5">角色名称 *</label>
                          <div>
                            <input
                              className="w-full h-10 border border-[#e2e8f0] rounded-lg px-3 text-sm focus:border-[#2563eb] focus:outline-none transition-colors"
                              placeholder="例如：数学导师-严谨型"
                              value={draft.name}
                              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                            />
                            <p className="text-[11px] text-[#94a3b8] mt-1 text-right">{draft.name.length}/30</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] items-start gap-3">
                          <label className="text-sm text-[#475569] pt-2.5">角色简介 *</label>
                          <div>
                            <textarea
                              className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-sm min-h-[80px] focus:border-[#2563eb] focus:outline-none transition-colors resize-none"
                              placeholder="擅长数学思维教学、逻辑推演、循循善诱，帮助学生构建扎实的数学能力。"
                              value={draft.persona.split('\n')[0] || ''}
                              onChange={(e) => setDraft((p) => ({ ...p, persona: e.target.value + (p.persona.includes('\n') ? '\n' + p.persona.split('\n').slice(1).join('\n') : '') }))}
                            />
                            <p className="text-[11px] text-[#94a3b8] mt-1 text-right">{(draft.persona.split('\n')[0] || '').length}/100</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* 头像 */}
                    <section>
                      <h3 className="text-sm font-semibold text-[#1e293b] mb-4">头像</h3>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#64748b] to-[#94a3b8] flex items-center justify-center text-white text-2xl font-bold">
                          {draft.name.charAt(0) || '?'}
                        </div>
                        <div>
                          <button className="text-sm text-[#2563eb] hover:underline">更换头像</button>
                          <p className="text-[11px] text-[#94a3b8] mt-1">支持 JPG/PNG，建议尺寸 512x512px</p>
                        </div>
                      </div>
                    </section>

                    {/* Persona 设定 */}
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-[#1e293b]">Persona（角色设定）</h3>
                        <button
                          onClick={async () => {
                            try {
                              const optimized = await api.optimizeRolePrompt('persona', draft.persona, draft.name)
                              if (optimized) setDraft((p) => ({ ...p, persona: optimized }))
                            } catch { /* ignore */ }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#60a5fa] text-xs font-medium text-white hover:opacity-90 transition-opacity"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> AI 优化
                        </button>
                      </div>
                      <textarea
                        className="w-full border border-[#e2e8f0] rounded-lg px-4 py-3 text-sm min-h-[180px] focus:border-[#2563eb] focus:outline-none transition-colors resize-none leading-relaxed"
                        placeholder="你是一位严谨细致的数学导师，擅长将复杂的数学概念拆解为清晰易懂的步骤。你注重逻辑推理与思维训练，鼓励学生独立思考，帮助他们建立扎实的数学基础。&#10;&#10;你耐心、专业，善于用启发式问引导学生发现问题的本质，并通过实比和可视化的方式降低理解门槛。&#10;&#10;你的教学目标是：帮助学生真正理解数学原理，提升解题能力与数学思维。"
                        value={draft.persona}
                        onChange={(e) => setDraft((p) => ({ ...p, persona: e.target.value }))}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-wrap gap-1.5">
                          {['插入示例', '身份定位', '能力特长', '教学目标', '性格特点', '+ 自定义'].map((tag) => (
                            <button key={tag} className="px-2.5 py-1 rounded-md bg-[#f1f5f9] text-[11px] text-[#475569] hover:bg-[#e2e8f0] transition-colors">{tag}</button>
                          ))}
                        </div>
                        <p className="text-[11px] text-[#94a3b8]">{draft.persona.length}/1000</p>
                      </div>
                    </section>
                  </>
                )}

                {activeTab === 'background' && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-[#1e293b]">背景设定</h3>
                      <button onClick={async () => { try { const o = await api.optimizeRolePrompt('background', draft.background, draft.name); if (o) setDraft((p) => ({ ...p, background: o })) } catch {} }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#60a5fa] text-xs font-medium text-white hover:opacity-90 transition-opacity"><Sparkles className="w-3.5 h-3.5" /> AI 优化</button>
                    </div>
                    <p className="text-xs text-[#94a3b8] mb-3">定义角色的适用人群、教学场景和知识边界。</p>
                    <textarea
                      className="w-full border border-[#e2e8f0] rounded-lg px-4 py-3 text-sm min-h-[240px] focus:border-[#2563eb] focus:outline-none transition-colors resize-none leading-relaxed"
                      placeholder="适用人群：高中及大学数学学习者&#10;教学场景：课后辅导、考前复习、难题讲解&#10;知识边界：高等数学、线性代数、概率统计"
                      value={draft.background}
                      onChange={(e) => setDraft((p) => ({ ...p, background: e.target.value }))}
                    />
                  </section>
                )}

                {activeTab === 'style' && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-[#1e293b]">风格设定</h3>
                      <button onClick={async () => { try { const o = await api.optimizeRolePrompt('style_guide', draft.styleGuide, draft.name); if (o) setDraft((p) => ({ ...p, styleGuide: o })) } catch {} }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#60a5fa] text-xs font-medium text-white hover:opacity-90 transition-opacity"><Sparkles className="w-3.5 h-3.5" /> AI 优化</button>
                    </div>
                    <p className="text-xs text-[#94a3b8] mb-3">定义角色的回答风格、结构偏好和语气要求。</p>
                    <textarea
                      className="w-full border border-[#e2e8f0] rounded-lg px-4 py-3 text-sm min-h-[240px] focus:border-[#2563eb] focus:outline-none transition-colors resize-none leading-relaxed"
                      placeholder="回答风格：先给出结论，再展开推导过程&#10;结构偏好：分步骤讲解，每步标注关键公式&#10;语气要求：严谨但不生硬，适当使用鼓励性语言"
                      value={draft.styleGuide}
                      onChange={(e) => setDraft((p) => ({ ...p, styleGuide: e.target.value }))}
                    />
                  </section>
                )}

                {activeTab === 'rules' && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-[#1e293b]">角色规则</h3>
                      <button onClick={async () => { try { const o = await api.optimizeRolePrompt('rules', draft.rules, draft.name); if (o) setDraft((p) => ({ ...p, rules: o })) } catch {} }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#60a5fa] text-xs font-medium text-white hover:opacity-90 transition-opacity"><Sparkles className="w-3.5 h-3.5" /> AI 优化</button>
                    </div>
                    <p className="text-xs text-[#94a3b8] mb-3">定义角色的行为约束，明确不可做和必须做的事项。</p>
                    <textarea
                      className="w-full border border-[#e2e8f0] rounded-lg px-4 py-3 text-sm min-h-[240px] focus:border-[#2563eb] focus:outline-none transition-colors resize-none leading-relaxed"
                      placeholder="必须做：&#10;- 每道题给出完整的解题步骤&#10;- 指出学生的错误并解释原因&#10;&#10;不可做：&#10;- 不直接给答案，要引导思考&#10;- 不使用超出学生水平的术语"
                      value={draft.rules}
                      onChange={(e) => setDraft((p) => ({ ...p, rules: e.target.value }))}
                    />
                  </section>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <UserCog className="w-12 h-12 text-[#e2e8f0] mx-auto mb-3" />
                <p className="text-sm text-[#94a3b8]">选择一个角色或创建新角色</p>
              </div>
            </div>
          )}
        </div>

        {/* 右侧管理面板 */}
        {(selectedRole || isNew) && (
          <aside className="w-[280px] shrink-0 border-l border-[#eef1f5] bg-white overflow-y-auto p-5 space-y-6 max-[1200px]:hidden">
            <section>
              <h3 className="text-sm font-semibold text-[#1e293b] mb-3">角色管理</h3>
              <div className="grid grid-cols-2 gap-2">
                <button className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#eef1f5] text-xs text-[#475569] hover:bg-[#f8fafc] transition-colors">
                  <Sparkles className="w-3.5 h-3.5" /> 复制角色
                </button>
                <button className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#eef1f5] text-xs text-[#475569] hover:bg-[#f8fafc] transition-colors">
                  <FileText className="w-3.5 h-3.5" /> 导出角色
                </button>
                {!isNew && selectedId && (
                  <button onClick={() => handleDelete(selectedId)} className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-100 text-xs text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> 删除角色
                  </button>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[#1e293b] mb-3">状态设置</h3>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8fafc] border border-[#eef1f5]">
                <span className="text-sm text-[#475569]">启用状态</span>
                <div className="w-10 h-6 rounded-full bg-[#2563eb] relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-sm" />
                </div>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-2">启用后，角色可被选择并用于对话。</p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[#1e293b] mb-3">当前对话使用</h3>
              <div className="flex items-center justify-between">
                <button className="px-3 py-2 rounded-lg bg-[#eff6ff] text-xs font-medium text-[#2563eb] hover:bg-[#dbeafe] transition-colors">
                  切换为当前角色
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[#1e293b] mb-3">角色标签</h3>
              <div className="flex flex-wrap gap-1.5">
                {['数学', '导师专精', '逻辑思维', '严谨教学'].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-full bg-[#f1f5f9] text-[11px] text-[#475569]">{tag}</span>
                ))}
                <button className="px-2.5 py-1 rounded-full border border-dashed border-[#e2e8f0] text-[11px] text-[#94a3b8] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">+ 添加标签</button>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[#1e293b] mb-3">角色分组</h3>
              <select className="w-full h-9 border border-[#e2e8f0] rounded-lg px-3 text-sm text-[#475569] focus:border-[#2563eb] focus:outline-none">
                <option>学科导师</option>
                <option>通用助手</option>
                <option>考试辅导</option>
              </select>
            </section>
          </aside>
        )}
      </main>

      {quickCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-[640px] rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-[#eef1f5] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1e293b]">一句话创建个性化导师</h3>
                <p className="mt-1 text-sm text-[#64748b]">输入你的问题，我会结合学习画像直接生成并启用这个导师。</p>
              </div>
              <button
                onClick={() => setQuickCreateOpen(false)}
                className="rounded-full p-2 text-[#94a3b8] hover:bg-[#f8fafc] hover:text-[#1e293b] transition-colors"
                aria-label="关闭弹窗"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              <label className="mb-2 block text-sm font-medium text-[#334155]">一句话描述你的需求</label>
              <textarea
                value={quickCreateQuestion}
                onChange={(e) => setQuickCreateQuestion(e.target.value)}
                className="min-h-[160px] w-full resize-none rounded-2xl border border-[#dbe4f0] px-4 py-3 text-sm leading-6 text-[#0f172a] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#2563eb]"
                placeholder="例如：我需要一个能结合我薄弱点、适合高中数学函数题、讲解清楚但不直接给答案的导师"
              />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-[#94a3b8]">系统会结合你当前的学习画像自动生成导师设定。</p>
                  {quickCreateError && <p className="text-xs text-red-500">{quickCreateError}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuickCreateOpen(false)}
                    className="rounded-xl border border-[#e2e8f0] px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#f8fafc] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void handleQuickGenerate()}
                    disabled={quickCreateLoading || !quickCreateQuestion.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#60a5fa] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {quickCreateLoading ? '正在生成...' : '生成并启用'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
