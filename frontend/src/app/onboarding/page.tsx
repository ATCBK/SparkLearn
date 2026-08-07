 'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Lightbulb,
  Code,
  GraduationCap,
  Briefcase,
  Gamepad2,
  Eye,
  Headphones,
  PenTool,
  FileText,
  Zap,
  BarChart3,
  Sparkles,
  Brain,
  Calculator,
  FlaskConical,
  Languages,
  TerminalSquare,
} from 'lucide-react'
import { getToken, getUser, setUser, syncStudyBuddyProfile } from '@/lib/auth'
import { api, type StudentProfile } from '@/lib/api'
import { getTeacherSubjects } from '@/lib/api/real'
import { NewUserGuidePanel } from '@/components/onboarding/NewUserGuidePanel'

/* ── 类型 ─────────────────────────────────────────── */

interface CardOption {
  icon: React.ReactNode
  label: string
  desc: string
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'teal' | 'pink'
}

interface StepData {
  key: string
  title: string
  greeting: string
  question: string
  cards?: CardOption[]
  tags?: string[]
  multiSelect?: boolean
}

/* ── 步骤数据 ──────────────────────────────────────── */

const DEFAULT_SUBJECTS = ['Python', 'Java', 'C/C++', 'JavaScript', 'Go', '数据结构与算法', '人工智能']

const STEPS: StepData[] = [
  {
    key: 'name',
    title: '你的名字',
    greeting: '欢迎来到 SparkLearn。\n先告诉我怎么称呼你，这个名字会同步到个人中心和学习空间。',
    question: '你叫什么名字？',
  },
  {
    key: 'grade',
    title: '当前年级',
    greeting: '收到。接下来确认一下你现在的学习阶段，这会影响推荐节奏和任务难度。',
    question: '你现在是大几？',
    tags: ['大一', '大二', '大三', '大四', '研究生', '其他'],
    multiSelect: false,
  },
  {
    key: 'major',
    title: '学科方向',
    greeting: '你好，我是小星同学。\n为了让后续资源和学习路径更贴合你的学习场景，我们先选择本次学习的学科方向。',
    question: '你想学习哪个学科？',
    tags: DEFAULT_SUBJECTS,
    multiSelect: false,
  },
  {
    key: 'goal',
    title: '学习目标',
    greeting: '你好！我是小星同学 ✨\n为了为你制定最合适的学习计划，\n我们先来聊聊你的学习目标吧~',
    question: '你希望达成什么样的学习目标呢？',
    cards: [
      { icon: <BarChart3 size={20} />, label: '掌握核心技能', desc: '系统学习，打好基础', color: 'blue' },
      { icon: <Briefcase size={20} />, label: '准备找工作', desc: '提升竞争力，拿到offer', color: 'purple' },
      { icon: <Zap size={20} />, label: '项目实战能力', desc: '能独立完成项目', color: 'orange' },
      { icon: <Gamepad2 size={20} />, label: '兴趣探索', desc: '先了解，再深入', color: 'green' },
    ],
  },
  {
    key: 'level',
    title: '学习基础',
    greeting: '了解了！接下来了解一下你的学习基础，\n这样可以更好地为你安排内容 😊',
    question: '你目前的基础水平是？',
    cards: [
      { icon: <Lightbulb size={20} />, label: '零基础', desc: '刚开始接触', color: 'orange' },
      { icon: <FileText size={20} />, label: '入门阶段', desc: '学过一些基础内容', color: 'blue' },
      { icon: <Code size={20} />, label: '有一定基础', desc: '能完成基础练习', color: 'green' },
      { icon: <GraduationCap size={20} />, label: '基础较好', desc: '能独立解决常见问题', color: 'purple' },
    ],
  },
  {
    key: 'weak',
    title: '薄弱环节',
    greeting: '明白！知道了你的基础情况 👍\n接下来，我们来找出你觉得需要重点加强的方向，\n你觉得自己哪些方面需要加强？',
    question: '选择你想重点提升的方向（可多选）',
    tags: ['基础概念', '核心方法', '题目应用', '综合实践', '学习方法', '其他方面'],
    multiSelect: true,
  },
  {
    key: 'preference',
    title: '学习偏好',
    greeting: '了解！每个人的学习方式都不同 📚\n你更喜欢哪种学习方式呢？',
    question: '你更喜欢哪种学习方式？',
    cards: [
      { icon: <Eye size={20} />, label: '视频教程，直观看懂', desc: '', color: 'purple' },
      { icon: <BookOpen size={20} />, label: '文档阅读，深入理解', desc: '', color: 'blue' },
      { icon: <PenTool size={20} />, label: '动手实践，边学边做', desc: '', color: 'green' },
      { icon: <Headphones size={20} />, label: '互动交流，共同进步', desc: '', color: 'orange' },
    ],
    multiSelect: true,
  },
  {
    key: 'time',
    title: '学习时间',
    greeting: '最后一个问题啦！🎉\n了解你的时间安排，帮你制定合理的计划，\n你每周大概有多少时间学习？',
    question: '你每天大概能投入多少时间学习？',
    tags: ['5小时以下', '5-10小时', '10-20小时', '20小时以上'],
    multiSelect: false,
  },
]

/* ── 消息类型 ─────────────────────────────────────── */

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  type: 'text' | 'options' | 'selection'
}

function subjectTone(tag: string, index: number) {
  const presets = [
    {
      icon: <TerminalSquare size={18} />,
      bg: 'from-[#eff6ff] to-[#dbeafe]',
      text: 'text-[#1d4ed8]',
      ring: 'ring-[#bfdbfe]',
      active: 'from-[#2563eb] to-[#0f63d9]',
      shadow: 'shadow-blue-200/70',
    },
    {
      icon: <Calculator size={18} />,
      bg: 'from-[#ecfdf5] to-[#d1fae5]',
      text: 'text-[#047857]',
      ring: 'ring-[#a7f3d0]',
      active: 'from-[#059669] to-[#047857]',
      shadow: 'shadow-emerald-200/70',
    },
    {
      icon: <Languages size={18} />,
      bg: 'from-[#fff7ed] to-[#ffedd5]',
      text: 'text-[#c2410c]',
      ring: 'ring-[#fed7aa]',
      active: 'from-[#f97316] to-[#c2410c]',
      shadow: 'shadow-orange-200/70',
    },
    {
      icon: <FlaskConical size={18} />,
      bg: 'from-[#ecfeff] to-[#cffafe]',
      text: 'text-[#0e7490]',
      ring: 'ring-[#a5f3fc]',
      active: 'from-[#0891b2] to-[#0e7490]',
      shadow: 'shadow-cyan-200/70',
    },
    {
      icon: <Brain size={18} />,
      bg: 'from-[#f5f3ff] to-[#ede9fe]',
      text: 'text-[#6d28d9]',
      ring: 'ring-[#ddd6fe]',
      active: 'from-[#7c3aed] to-[#5b21b6]',
      shadow: 'shadow-violet-200/70',
    },
  ]
  if (tag.includes('Java') || tag.includes('Go')) return presets[1]
  if (tag.includes('C/') || tag.includes('C++')) return presets[2]
  if (tag.includes('数据结构') || tag.includes('算法')) return presets[3]
  if (tag.includes('智能') || tag.includes('AI') || tag.includes('机器学习')) return presets[4]
  return presets[index % presets.length]
}

/* ── 主组件 ─────────────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState<Record<number, string[]>>({})
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [subjectOptions, setSubjectOptions] = useState<string[]>(DEFAULT_SUBJECTS)
  const [profileChecking, setProfileChecking] = useState(true)
  const [existingProfile, setExistingProfile] = useState<StudentProfile | null>(null)
  const [forceRecapture, setForceRecapture] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const finishingRef = useRef(false)

  const steps = useMemo(
    () => STEPS.map((item) => (item.key === 'major' ? { ...item, tags: subjectOptions } : item)),
    [subjectOptions],
  )

  function resetOnboardingFlow() {
    finishingRef.current = false
    const pendingSubject = localStorage.getItem('sparklearn_pending_subject')
    const majorIndex = steps.findIndex(item => item.key === 'major')
    setMessages([])
    setSelections(pendingSubject && majorIndex >= 0 ? { [majorIndex]: [pendingSubject] } : {})
    setStep(0)
    setShowOptions(false)
    setIsTyping(false)
    window.setTimeout(() => startStep(0), 50)
  }

  // 初始化第一步的消息
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('sparklearn_token')) {
      router.replace('/auth')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const profile = await api.getProfile()
        if (!cancelled && hasMeaningfulProfile(profile) && localStorage.getItem('sparklearn_profile_needs_recapture') !== 'true') {
          setExistingProfile(profile)
          setProfileChecking(false)
          return
        }
      } catch {
        // 没有画像时进入正常采集流程。
      }
      if (!cancelled) {
        setProfileChecking(false)
        resetOnboardingFlow()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const subjects = await getTeacherSubjects(true)
        const names = subjects.map((item) => item.name).filter(Boolean)
        if (!cancelled && names.length > 0) {
          setSubjectOptions(names)
          const pendingSubject = localStorage.getItem('sparklearn_pending_subject')
          if (pendingSubject && names.includes(pendingSubject)) {
            const majorIndex = steps.findIndex(item => item.key === 'major')
            if (majorIndex >= 0) setSelections((prev) => ({ ...prev, [majorIndex]: [pendingSubject] }))
          }
        }
      } catch {
        // 演示环境后端未启动时，保留默认学科选项。
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showOptions])

  function startStep(stepIndex: number) {
    const stepData = steps[stepIndex]
    setIsTyping(true)
    setShowOptions(false)

    setTimeout(() => {
      setMessages(prev => {
        // 防止重复添加同一步骤的 greeting
        if (prev.some(m => m.id.startsWith(`greeting-${stepIndex}-`))) return prev
        return [
          ...prev,
          {
            id: `greeting-${stepIndex}-${Date.now()}`,
            role: 'assistant',
            content: stepData.greeting,
            type: 'text',
          },
        ]
      })
      setIsTyping(false)

      // 短暂延迟后显示选项
      setTimeout(() => {
        setShowOptions(true)
      }, 400)
    }, 800)
  }

  function toggle(opt: string) {
    const current = steps[step]
    setSelections(prev => {
      const arr = prev[step] || []
      if (current.multiSelect || current.tags) {
        // 多选模式（tags 默认多选，除非 multiSelect 明确为 false）
        if (current.multiSelect === false) {
          return { ...prev, [step]: arr.includes(opt) ? [] : [opt] }
        }
        return {
          ...prev,
          [step]: arr.includes(opt) ? arr.filter(o => o !== opt) : [...arr, opt],
        }
      }
      // 单选模式
      return { ...prev, [step]: [opt] }
    })
  }

  function confirmSelection() {
    const selected = selections[step] || []
    if (selected.length === 0) return

    // 添加用户选择消息
    setMessages(prev => [
      ...prev,
      {
        id: `user-${step}-${Date.now()}`,
        role: 'user',
        content: selected.join('、'),
        type: 'selection',
      },
    ])
    setShowOptions(false)

    // 进入下一步
    if (step < steps.length - 1) {
      const nextStep = step + 1
      setStep(nextStep)
      setTimeout(() => startStep(nextStep), 300)
    } else {
      // 完成建档
      finishOnboarding()
    }
  }

  function handleSendMessage() {
    const text = inputValue.trim()
    if (!text) return

    setMessages(prev => [
      ...prev,
      { id: `input-${Date.now()}`, role: 'user', content: text, type: 'text' },
    ])
    setInputValue('')

    // 将用户输入作为当前步骤的选择
    setSelections(prev => ({
      ...prev,
      [step]: [text],
    }))
    setShowOptions(false)

    // 进入下一步
    if (step < steps.length - 1) {
      const nextStep = step + 1
      setStep(nextStep)
      setTimeout(() => startStep(nextStep), 300)
    } else {
      finishOnboarding()
    }
  }

  async function finishOnboarding() {
    if (finishingRef.current) return
    finishingRef.current = true
    setIsTyping(true)
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: `finish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: '太棒了！我已经了解你的学习情况了 🎊\n正在为你生成个性化学习方案...',
          type: 'text',
        },
      ])
      setIsTyping(false)

      // 提交数据并跳转
      submitOnboarding()
    }, 800)
  }

  async function submitOnboarding() {
    try {
      const byKey = (key: string) => selections[steps.findIndex(item => item.key === key)] || []
      const name = byKey('name')[0] || ''
      const grade = byKey('grade')[0] || ''
      const body = {
        name,
        grade,
        major: byKey('major'),
        goal: byKey('goal'),
        level: byKey('level'),
        weak: byKey('weak'),
        preference: byKey('preference'),
        time: byKey('time'),
      }
      await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'}/api/profile/onboarding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          },
          body: JSON.stringify(body),
        }
      )
      if (name) {
        const currentUser = getUser()
        if (currentUser) {
          setUser({ ...currentUser, name })
          window.dispatchEvent(new Event('sparklearn:user-updated'))
        }
      }
      await syncStudyBuddyProfile('onboarding')
    } catch {
      // 即使提交失败也跳转
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sparklearn_profile_needs_recapture')
      const collectedAt = new Date().toISOString()
      try {
        const rawUser = localStorage.getItem('sparklearn_user')
        const user = rawUser ? JSON.parse(rawUser) : null
        const userId = String(user?.user_id || user?.id || '')
        if (userId) {
          localStorage.setItem(`sparklearn_profile_collected_at:${userId}`, collectedAt)
        }
      } catch {
        // Ignore malformed local user data; the server profile remains the source of truth.
      }
    }
    setTimeout(() => router.push('/'), 1500)
  }

  const selected = selections[step] || []
  const current = steps[step]

  if (profileChecking) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8fafc] px-4">
        <div className="rounded-2xl border border-[#e2e8f0] bg-white px-6 py-5 text-sm font-semibold text-[#475569] shadow-sm">
          正在检查你的学习画像...
        </div>
      </div>
    )
  }

  if (existingProfile && !forceRecapture) {
    return (
      <>
        <div className="grid min-h-screen place-items-center bg-[#f8fafc] px-4">
          <section className="w-full max-w-[520px] rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
            <div className="inline-flex rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-bold text-[#2563eb]">已完成学习画像</div>
            <h1 className="mt-4 text-2xl font-black text-[#111827]">{existingProfile.name || '同学'}，你的画像已经建立</h1>
            <p className="mt-3 text-sm leading-7 text-[#52627b]">
              当前记录：{existingProfile.grade || '未填写年级'} · {existingProfile.major || '未选择方向'}。新手引导不会再要求你重复建档。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => router.push('/')} className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white">返回工作台</button>
              <button type="button" onClick={() => router.push('/profile')} className="rounded-xl border border-[#cbd5e1] px-4 py-2.5 text-sm font-bold text-[#475569]">查看个人中心</button>
              <button
                type="button"
                onClick={() => {
                  setExistingProfile(null)
                  setForceRecapture(true)
                  resetOnboardingFlow()
                }}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#64748b] hover:bg-[#f1f5f9]"
              >
                重新采集
              </button>
            </div>
          </section>
        </div>
        <NewUserGuidePanel />
      </>
    )
  }

  return (
    <>
    <div className="flex min-h-screen flex-col items-center px-4 py-8" style={{ backgroundImage: 'url(/ui-images/onboarding-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      {/* ═══ 顶部步骤指示器 ═══ */}
      <div className="mb-6 flex items-center justify-center gap-0">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-all ${
                  i < step
                    ? 'bg-[#34c759] text-white'
                    : i === step
                      ? 'bg-[#2563eb] text-white shadow-md shadow-blue-200'
                      : 'bg-[#e2e8f0] text-[#94a3b8]'
                }`}
              >
                {i < step ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${
                  i < step ? 'text-[#34c759]' : i === step ? 'text-[#2563eb]' : 'text-[#94a3b8]'
                }`}
              >
                {s.title}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-3 mb-5 h-[2px] w-12 rounded-full transition-colors ${
                  i < step ? 'bg-[#34c759]' : 'bg-[#e2e8f0]'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ═══ 主卡片容器 ═══ */}
      <div className="w-full max-w-[680px] h-[calc(100vh-160px)] rounded-2xl border border-[#e8ecf2] bg-white shadow-lg shadow-black/[0.03] flex flex-col overflow-hidden">
        {/* 对话内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <MessageBubble key={`${msg.id}-${idx}`} message={msg} />
          ))}

          {/* 打字指示器 */}
          {isTyping && (
            <div className="flex items-start gap-3">
              <SpriteAvatar />
              <div className="rounded-2xl rounded-tl-sm bg-[#f8fafc] px-4 py-3 border border-[#eef2f7]">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* 选项区域 */}
          {showOptions && !isTyping && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* 卡片选项 */}
              {current.cards && (
                <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
                  {current.cards.map((card) => {
                    const isActive = selected.includes(card.label)
                    const colorMap: Record<string, { bg: string; activeBg: string; text: string }> = {
                      blue: { bg: 'bg-[#eff6ff]', activeBg: 'bg-[#2563eb]', text: 'text-[#2563eb]' },
                      purple: { bg: 'bg-[#f3efff]', activeBg: 'bg-[#7c3aed]', text: 'text-[#7c3aed]' },
                      green: { bg: 'bg-[#ecfdf5]', activeBg: 'bg-[#059669]', text: 'text-[#059669]' },
                      orange: { bg: 'bg-[#fff7ed]', activeBg: 'bg-[#d97706]', text: 'text-[#d97706]' },
                    }
                    const c = colorMap[card.color || 'blue'] || colorMap.blue
                    return (
                      <button
                        key={card.label}
                        onClick={() => toggle(card.label)}
                        className={`group flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 text-center transition-all ${
                          isActive
                            ? 'border-[#2563eb] bg-[#eff6ff] shadow-sm'
                            : 'border-[#eef2f7] bg-white hover:border-[#93c5fd] hover:bg-[#f8fafc]'
                        }`}
                      >
                        <div
                          className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
                            isActive ? `${c.activeBg} text-white` : `${c.bg} ${c.text}`
                          }`}
                        >
                          {card.icon}
                        </div>
                        <div className={`text-sm font-semibold ${isActive ? 'text-[#2563eb]' : 'text-[#1e293b]'}`}>
                          {card.label}
                        </div>
                        {card.desc && (
                          <div className={`text-xs ${isActive ? 'text-[#60a5fa]' : 'text-[#94a3b8]'}`}>
                            {card.desc}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* 标签选项 */}
              {current.tags && (
                <div className={current.key === 'major' ? 'grid grid-cols-5 gap-3 max-[720px]:grid-cols-3 max-[520px]:grid-cols-2' : 'flex flex-wrap gap-2'}>
                  {current.tags.map((tag) => {
                    const isActive = selected.includes(tag)
                    const tone = subjectTone(tag, current.tags?.indexOf(tag) ?? 0)
                    if (current.key === 'major') {
                      return (
                        <button
                          key={tag}
                          onClick={() => toggle(tag)}
                          className={`group relative min-h-[82px] overflow-hidden rounded-2xl border px-3 py-3 text-left transition-all duration-200 ${
                            isActive
                              ? `border-transparent bg-gradient-to-br ${tone.active} text-white shadow-lg ${tone.shadow}`
                              : `border-white bg-gradient-to-br ${tone.bg} ${tone.text} shadow-sm ring-1 ${tone.ring} hover:-translate-y-0.5 hover:shadow-md`
                          }`}
                        >
                          <span className={`absolute -right-4 -top-4 h-14 w-14 rounded-full ${isActive ? 'bg-white/15' : 'bg-white/50'}`} />
                          <span className="relative flex h-full flex-col justify-between gap-2">
                            <span className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-white/75'}`}>
                              {tone.icon}
                            </span>
                            <span className="block truncate text-[15px] font-extrabold leading-tight">{tag}</span>
                          </span>
                        </button>
                      )
                    }
                    return (
                      <button
                        key={tag}
                        onClick={() => toggle(tag)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                          isActive
                            ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'
                            : 'border-[#e2e8f0] bg-white text-[#475569] hover:border-[#93c5fd] hover:bg-[#f8fafc]'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 底部操作栏 - 卡片内部底部 */}
        <div className="shrink-0 border-t border-[#eef2f7] px-6 py-4 space-y-3">
          {/* 输入框 */}
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={current.key === 'name' ? '输入你的名字，例如：林同学' : '你可以直接输入你的想法...'}
              className="h-11 w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] pl-4 pr-12 text-sm outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg bg-[#2563eb] text-white transition-opacity disabled:opacity-30"
              aria-label="发送"
            >
              <Send size={15} />
            </button>
          </div>

          {/* 导航按钮 */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (step > 0) {
                  const prevStep = step - 1
                  setStep(prevStep)
                  setShowOptions(true)
                }
              }}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition-colors hover:text-[#2563eb] disabled:opacity-30"
            >
              <ArrowLeft size={15} />
              上一步
            </button>

            <button
              onClick={confirmSelection}
              data-guide-target="onboarding-primary-action"
              disabled={selected.length === 0}
              className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                selected.length > 0
                  ? 'bg-[#2563eb] text-white shadow-sm hover:bg-[#1d4ed8]'
                  : 'bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed'
              }`}
            >
              {step === steps.length - 1 ? '完成建档' : '下一步'}
              {step === steps.length - 1 ? <Sparkles size={15} /> : <ArrowRight size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
    <NewUserGuidePanel />
    </>
  )
}

function hasMeaningfulProfile(profile: StudentProfile | null) {
  if (!profile) return false
  const hasIdentity = Boolean(profile.name?.trim() && profile.grade?.trim())
  const hasLearningData = Boolean(
    profile.major?.trim() ||
    profile.goals?.some(item => item.trim()) ||
    profile.knowledgeLevel?.trim() ||
    profile.weakPoints?.some(item => item.trim()) ||
    profile.learningPreference?.some(item => item.trim()),
  )
  return hasIdentity && hasLearningData
}

/* ── 精灵头像组件 ─── */

function SpriteAvatar() {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] shadow-md shadow-blue-200">
      <Sparkles size={16} className="text-white" />
    </div>
  )
}

/* ── 消息气泡组件 ─── */

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'assistant') {
    return (
      <div className="flex items-start gap-3">
        <SpriteAvatar />
        <div className="max-w-[520px] rounded-2xl rounded-tl-sm border border-[#eef2f7] bg-[#f8fafc] px-5 py-4 shadow-sm">
          <p className="whitespace-pre-line text-sm leading-7 text-[#1e293b]">
            {message.content}
          </p>
        </div>
      </div>
    )
  }

  // 用户消息
  return (
    <div className="flex justify-end">
      <div className="max-w-[360px] rounded-2xl rounded-tr-sm bg-[#2563eb] px-4 py-3 shadow-sm">
        <p className="text-sm leading-relaxed text-white">
          {message.content}
        </p>
      </div>
    </div>
  )
}
