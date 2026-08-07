'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileText,
  Library,
  Map,
  MessageCircle,
  NotebookPen,
  PenTool,
  Route,
  Sparkles,
  Target,
  UserRound,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  getGuideUserId,
  hasSeenNewUserGuide,
  markNewUserGuideSeen,
  NEW_USER_GUIDE_STEP_IDS,
  readNewUserGuideProgress,
  writeNewUserGuideProgress,
} from './newUserGuideStorage'

export type NewUserGuidePanelHandle = {
  open: () => void
}

type CompletionMode = 'click' | 'input'

type GuideStep = {
  id: string
  route: string
  title: string
  description: string
  target: string
  fallbackTarget?: string
  actionLabel: string
  completionMode?: CompletionMode
  sampleInput?: string
  icon: React.ReactNode
  accent: string
}

type SpotlightRect = {
  left: number
  top: number
  width: number
  height: number
}

type TooltipPosition = {
  left: number
  top: number
  placement: 'above' | 'below'
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'home',
    route: '/',
    title: '从工作台开始你的学习闭环',
    description: '这里汇总今日任务、资源推荐和学习状态。引导会带你真实走完整个平台，不只是在这里看介绍。',
    target: 'guide-replay',
    fallbackTarget: 'profile-entry',
    actionLabel: '认识工作台',
    icon: <Sparkles className="h-4 w-4" />,
    accent: 'from-[#2563eb] to-[#38bdf8]',
  },
  {
    id: 'profile',
    route: '/onboarding',
    title: '先完成学习画像',
    description: '填写目标、基础、薄弱点和学习偏好。后面的路径、资源、练习都会基于画像个性化生成。',
    target: 'onboarding-primary-action',
    fallbackTarget: 'profile-entry',
    actionLabel: '去完善画像',
    icon: <UserRound className="h-4 w-4" />,
    accent: 'from-[#2563eb] to-[#60a5fa]',
  },
  {
    id: 'profile-view',
    route: '/profile',
    title: '查看画像如何沉淀',
    description: '这里展示你的目标、偏好、薄弱点和学习历史。后续练习和报告会继续反哺这里。',
    target: 'profile-overview',
    fallbackTarget: 'profile-nav',
    actionLabel: '查看画像',
    icon: <UserRound className="h-4 w-4" />,
    accent: 'from-[#0f766e] to-[#2dd4bf]',
  },
  {
    id: 'path',
    route: '/path',
    title: '查看个性化学习路径',
    description: '路径会把大目标拆成阶段、知识点和任务。你可以点击节点看下一步该做什么。',
    target: 'path-workspace',
    fallbackTarget: 'path-nav',
    actionLabel: '进入路径',
    icon: <Map className="h-4 w-4" />,
    accent: 'from-[#059669] to-[#34d399]',
  },
  {
    id: 'path-node',
    route: '/path',
    title: '点开一个路径节点',
    description: '节点详情会说明学习目标、预计时间和后续动作。真实点击节点后，这一步就算完成。',
    target: 'path-node-list',
    fallbackTarget: 'path-workspace',
    actionLabel: '查看节点',
    icon: <Route className="h-4 w-4" />,
    accent: 'from-[#16a34a] to-[#86efac]',
  },
  {
    id: 'resource',
    route: '/generate',
    title: '根据当前卡点生成资源',
    description: '资源中心可以生成文档、课件、测验、阅读、代码练习或视频。输入一个主题也可以推进这一步。',
    target: 'resource-prompt',
    fallbackTarget: 'resource-nav',
    actionLabel: '生成资源',
    completionMode: 'input',
    sampleInput: '生成一份 Python 闭包入门讲义',
    icon: <FileText className="h-4 w-4" />,
    accent: 'from-[#ea580c] to-[#fbbf24]',
  },
  {
    id: 'resource-note',
    route: '/generate',
    title: '资源中心里可以随手记笔记',
    description: '看资源时不要只浏览。点击记笔记，把关键概念沉淀下来，后续 Tutor 也能参考你的个性化笔记。',
    target: 'resource-note-button',
    fallbackTarget: 'learning-notes-open',
    actionLabel: '试试记笔记',
    icon: <NotebookPen className="h-4 w-4" />,
    accent: 'from-[#7c3aed] to-[#c084fc]',
  },
  {
    id: 'knowledge',
    route: '/knowledge',
    title: '把资料沉淀到知识库',
    description: '知识库用来管理上传资料和知识文件。资源生成、问答和学习伙伴都可以围绕这些资料继续工作。',
    target: 'knowledge-workspace',
    fallbackTarget: 'knowledge-nav',
    actionLabel: '进入知识库',
    icon: <Library className="h-4 w-4" />,
    accent: 'from-[#0891b2] to-[#22d3ee]',
  },
  {
    id: 'agent',
    route: '/agent',
    title: '体验 AI 学习伙伴',
    description: '学习伙伴会长期陪伴你的目标，帮助做资料检索、内容摘要、概念对比和任务建议。',
    target: 'agent-workspace',
    fallbackTarget: 'tutor-nav',
    actionLabel: '进入学习伙伴',
    icon: <Bot className="h-4 w-4" />,
    accent: 'from-[#7c3aed] to-[#a78bfa]',
  },
  {
    id: 'practice',
    route: '/practice',
    title: '用练习验证是否掌握',
    description: '练习评测把“看过了”变成可评估、可复盘的数据。进入练习区后可以继续下一步。',
    target: 'practice-workspace',
    fallbackTarget: 'practice-nav',
    actionLabel: '开始练习',
    icon: <BookOpen className="h-4 w-4" />,
    accent: 'from-[#2563eb] to-[#818cf8]',
  },
  {
    id: 'practice-records',
    route: '/practice/records',
    title: '练习记录会沉淀学习证据',
    description: '错题和练习记录会进入后续报告，帮助系统知道你真正掌握了什么。',
    target: 'practice-records-workspace',
    fallbackTarget: 'practice-nav',
    actionLabel: '查看记录',
    icon: <PenTool className="h-4 w-4" />,
    accent: 'from-[#475569] to-[#94a3b8]',
  },
  {
    id: 'report',
    route: '/report',
    title: '看报告并反推下一步',
    description: '学习报告会总结薄弱点、任务状态和下一步建议。它会把结果反向写回学习画像。',
    target: 'report-workspace',
    fallbackTarget: 'report-nav',
    actionLabel: '查看报告',
    icon: <Target className="h-4 w-4" />,
    accent: 'from-[#dc2626] to-[#fb7185]',
  },
  {
    id: 'info-stream',
    route: '/info-stream',
    title: '学习发现提供外部视野',
    description: '这里展示推荐内容、信息流和拓展材料，让学习不只停留在当前任务。',
    target: 'info-stream-workspace',
    fallbackTarget: 'info-stream-nav',
    actionLabel: '进入学习发现',
    icon: <Compass className="h-4 w-4" />,
    accent: 'from-[#0f766e] to-[#14b8a6]',
  },
  {
    id: 'plaza',
    route: '/plaza',
    title: '最后看学习广场',
    description: '广场是社区资源、经验分享和问答区。先完成个人学习闭环，再来这里看他人的学习经验。',
    target: 'plaza-workspace',
    fallbackTarget: 'plaza-entry',
    actionLabel: '进入广场',
    icon: <Users className="h-4 w-4" />,
    accent: 'from-[#9333ea] to-[#ec4899]',
  },
  {
    id: 'ai-sprite',
    route: '/',
    title: '让 AI 精灵展示本机能力',
    description: 'AI 精灵不只是聊天入口。你可以让它看看本机有哪些 Python 学习与运行能力，再进入学习空间。',
    target: 'ai-assistant-trigger',
    actionLabel: '打开 AI 精灵',
    completionMode: 'click',
    sampleInput: '帮我看看本机有哪些 Python 学习/运行能力，并告诉我可以怎么开始练习。',
    icon: <MessageCircle className="h-4 w-4" />,
    accent: 'from-[#06b6d4] to-[#8b5cf6]',
  },
  {
    id: 'ai-learning-space',
    route: '/',
    title: '从 AI 精灵进入学习空间',
    description: '打开精灵后，点击“学习空间”。它会用过场动画把你带到 Tutor 的深度学习空间。',
    target: 'ai-learning-space-button',
    actionLabel: '进入学习空间',
    icon: <Sparkles className="h-4 w-4" />,
    accent: 'from-[#7c3aed] to-[#ec4899]',
  },
  {
    id: 'tutor-role',
    route: '/tutor',
    title: '一句话创建一个智能体',
    description: '在学习空间里，你可以用一句话创建自己的学习智能体，例如 Python 闭包学习教练。',
    target: 'tutor-role-create',
    fallbackTarget: 'tutor-input',
    actionLabel: '创建智能体',
    completionMode: 'input',
    sampleInput: '创建一个 Python 闭包学习教练，帮我用例子和练习掌握闭包。',
    icon: <Wand2 className="h-4 w-4" />,
    accent: 'from-[#2563eb] to-[#7c3aed]',
  },
  {
    id: 'tutor-chat',
    route: '/tutor',
    title: '体验 Tutor 的深度辅导',
    description: '向 Tutor 输入一个真实学习问题，体验对话、追问、解释代码、出题和多工具辅助。',
    target: 'tutor-input',
    actionLabel: '问 Tutor',
    completionMode: 'input',
    sampleInput: '我正在学习 Python 闭包，请用生活例子解释，并给我一道练习题。',
    icon: <MessageCircle className="h-4 w-4" />,
    accent: 'from-[#1d4ed8] to-[#60a5fa]',
  },
  {
    id: 'workshop',
    route: '/tutor/workshop',
    title: '多智能体研讨会展示',
    description: '研讨会会让多个 AI 导师围绕同一问题协同讨论，并实时汇总结论。你可以输入一个主题体验。',
    target: 'workshop-input',
    fallbackTarget: 'workshop-workspace',
    actionLabel: '发起研讨',
    completionMode: 'input',
    sampleInput: 'Python 闭包为什么适合做装饰器？请多位导师从原理、代码和练习角度讨论。',
    icon: <Users className="h-4 w-4" />,
    accent: 'from-[#4f46e5] to-[#a855f7]',
  },
  {
    id: 'finish',
    route: '/',
    title: '完成 SparkLearn 平台导览',
    description: '你已经走过画像、路径、资源、笔记、知识库、学习伙伴、练习、报告、广场、AI 精灵、智能体、Tutor 和研讨会。',
    target: 'guide-replay',
    fallbackTarget: 'profile-entry',
    actionLabel: '完成导览',
    icon: <Sparkles className="h-4 w-4" />,
    accent: 'from-[#111827] to-[#475569]',
  },
]

function hasLoginSession() {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(window.localStorage.getItem('sparklearn_token'))
  } catch {
    return false
  }
}

function guideStepKey(userId: string) {
  return `sparklearn_new_user_guide_step:${userId || 'anonymous'}`
}

function normalizeRoute(pathname: string) {
  if (pathname !== '/' && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

function routeMatches(pathname: string, route: string) {
  const current = normalizeRoute(pathname)
  const expected = normalizeRoute(route)
  if (expected === '/') return current === '/'
  return current === expected
}

function getStoredStepIndex(userId: string) {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(guideStepKey(userId))
  const parsed = raw ? Number(raw) : 0
  return Number.isFinite(parsed) ? Math.max(0, Math.min(GUIDE_STEPS.length - 1, parsed)) : 0
}

function storeStepIndex(userId: string, index: number) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(guideStepKey(userId), String(Math.max(0, Math.min(GUIDE_STEPS.length - 1, index))))
}

function findGuideTarget(step: GuideStep) {
  if (typeof document === 'undefined') return null
  return (
    document.querySelector<HTMLElement>(`[data-guide-target="${step.target}"]`) ||
    (step.fallbackTarget ? document.querySelector<HTMLElement>(`[data-guide-target="${step.fallbackTarget}"]`) : null)
  )
}

function getRectForStep(step: GuideStep): SpotlightRect {
  const target = findGuideTarget(step)
  if (!target) {
    return {
      left: Math.max(16, window.innerWidth / 2 - 205),
      top: Math.max(96, window.innerHeight / 2 - 84),
      width: Math.min(410, window.innerWidth - 32),
      height: 92,
    }
  }

  target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  const rect = target.getBoundingClientRect()
  const pad = 10
  return {
    left: Math.max(10, rect.left - pad),
    top: Math.max(10, rect.top - pad),
    width: Math.min(window.innerWidth - 20, rect.width + pad * 2),
    height: Math.min(window.innerHeight - 20, rect.height + pad * 2),
  }
}

function getTooltipPosition(rect: SpotlightRect): TooltipPosition {
  const tooltipWidth = Math.min(430, window.innerWidth - 32)
  const tooltipHeight = window.innerWidth < 560 ? 390 : 350
  const spaceBelow = window.innerHeight - rect.top - rect.height
  const canFitBelow = spaceBelow > tooltipHeight + 40
  const placement = canFitBelow || rect.top < tooltipHeight + 32 ? 'below' : 'above'
  const preferredTop = placement === 'below' ? rect.top + rect.height + 34 : rect.top - tooltipHeight - 24
  const top = Math.min(Math.max(16, preferredTop), Math.max(16, window.innerHeight - tooltipHeight - 16))
  const left = Math.min(Math.max(16, rect.left), window.innerWidth - tooltipWidth - 16)

  return { left, top, placement }
}

export const NewUserGuidePanel = forwardRef<NewUserGuidePanelHandle>(function NewUserGuidePanel(_, ref) {
  const router = useRouter()
  const pathname = usePathname()
  const [welcomeVisible, setWelcomeVisible] = useState(false)
  const [tourVisible, setTourVisible] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [userId, setUserId] = useState('anonymous')
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null)

  const currentStep = GUIDE_STEPS[currentIndex]
  const onExpectedRoute = currentStep ? routeMatches(pathname, currentStep.route) : false
  const progress = Math.round(((currentIndex + 1) / GUIDE_STEPS.length) * 100)

  const syncUserGuideState = useCallback((forceOpen = false) => {
    if (!hasLoginSession()) {
      setWelcomeVisible(false)
      setTourVisible(false)
      return
    }

    const nextUserId = getGuideUserId()
    const storedIndex = getStoredStepIndex(nextUserId)
    setUserId(nextUserId)
    setCompletedIds(readNewUserGuideProgress(nextUserId))
    setCurrentIndex(storedIndex)
    if (forceOpen) {
      setWelcomeVisible(true)
      setTourVisible(false)
      return
    }
    if (!hasSeenNewUserGuide(nextUserId)) {
      setWelcomeVisible(storedIndex === 0)
      setTourVisible(storedIndex > 0)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => syncUserGuideState(false), 80)
    return () => window.clearTimeout(timer)
  }, [syncUserGuideState])

  useImperativeHandle(ref, () => ({
    open: () => syncUserGuideState(true),
  }), [syncUserGuideState])

  useEffect(() => {
    const openGuide = () => syncUserGuideState(true)
    window.addEventListener('open-new-user-guide', openGuide)
    return () => window.removeEventListener('open-new-user-guide', openGuide)
  }, [syncUserGuideState])

  const updateSpotlight = useCallback(() => {
    if (!tourVisible || !currentStep || !onExpectedRoute) {
      setSpotlightRect(null)
      setTooltipPosition(null)
      return
    }
    const rect = getRectForStep(currentStep)
    setSpotlightRect(rect)
    setTooltipPosition(getTooltipPosition(rect))
  }, [currentStep, onExpectedRoute, tourVisible])

  useEffect(() => {
    if (!tourVisible) return
    const firstPass = window.setTimeout(updateSpotlight, 80)
    const secondPass = window.setTimeout(updateSpotlight, 420)
    window.addEventListener('resize', updateSpotlight)
    window.addEventListener('scroll', updateSpotlight, true)
    return () => {
      window.clearTimeout(firstPass)
      window.clearTimeout(secondPass)
      window.removeEventListener('resize', updateSpotlight)
      window.removeEventListener('scroll', updateSpotlight, true)
    }
  }, [pathname, tourVisible, updateSpotlight])

  const persistProgress = useCallback((nextIds: string[]) => {
    setCompletedIds(nextIds)
    writeNewUserGuideProgress(nextIds, userId)
  }, [userId])

  const setStep = useCallback((index: number) => {
    const next = Math.max(0, Math.min(GUIDE_STEPS.length - 1, index))
    setCurrentIndex(next)
    storeStepIndex(userId, next)
  }, [userId])

  function startTour() {
    setWelcomeVisible(false)
    setTourVisible(true)
    setStep(getStoredStepIndex(userId))
  }

  const closeGuide = useCallback((markSeen = false) => {
    if (markSeen) markNewUserGuideSeen(userId)
    setWelcomeVisible(false)
    setTourVisible(false)
  }, [userId])

  const completeGuide = useCallback(() => {
    persistProgress(NEW_USER_GUIDE_STEP_IDS)
    markNewUserGuideSeen(userId)
    closeGuide(false)
  }, [closeGuide, persistProgress, userId])

  const advanceStep = useCallback((fromRealAction = false) => {
    if (!currentStep) return
    persistProgress(Array.from(new Set([...completedIds, currentStep.id])))
    if (currentIndex >= GUIDE_STEPS.length - 1) {
      completeGuide()
      return
    }
    setStep(currentIndex + 1)
    if (fromRealAction) {
      window.setTimeout(() => {
        const next = GUIDE_STEPS[currentIndex + 1]
        if (next && !routeMatches(window.location.pathname, next.route)) {
          router.push(next.route)
        }
      }, 120)
    }
  }, [completedIds, completeGuide, currentIndex, currentStep, persistProgress, router, setStep])

  useEffect(() => {
    if (!tourVisible || !currentStep || !onExpectedRoute) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const matched = target?.closest(`[data-guide-target="${currentStep.target}"]`)
      const fallbackMatched = currentStep.fallbackTarget ? target?.closest(`[data-guide-target="${currentStep.fallbackTarget}"]`) : null
      if (matched || fallbackMatched) {
        window.setTimeout(() => advanceStep(true), 180)
      }
    }

    const handleInput = (event: Event) => {
      if (currentStep.completionMode !== 'input') return
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null
      const matched = target?.closest(`[data-guide-target="${currentStep.target}"]`)
      if (matched && target && 'value' in target && target.value.trim().length >= 6) {
        window.setTimeout(() => advanceStep(false), 500)
      }
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('input', handleInput, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('input', handleInput, true)
    }
  }, [advanceStep, currentStep, onExpectedRoute, tourVisible])

  function goToStepAction() {
    if (!currentStep) return
    if (!routeMatches(pathname, currentStep.route)) {
      router.push(currentStep.route)
      return
    }
    if (currentStep.id === 'ai-sprite') {
      window.dispatchEvent(new CustomEvent('open-ai-assistant', { detail: { prompt: currentStep.sampleInput } }))
      return
    }
    const target = findGuideTarget(currentStep)
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      if (currentStep.sampleInput && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        target.focus()
        const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set
        valueSetter?.call(target, currentStep.sampleInput)
        target.dispatchEvent(new Event('input', { bubbles: true }))
      } else {
        target.focus()
      }
    }
  }

  const welcomeFlow = useMemo(() => ['画像', '路径', '资源', '笔记', '练习', '报告', '广场', '精灵', '智能体', '研讨会'], [])

  return (
    <>
      {welcomeVisible ? (
        <div
          data-testid="new-user-guide-panel"
          className="fixed inset-0 z-[90] grid place-items-center bg-[#0f172a]/68 px-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="首次用户体验引导"
        >
          <section className="w-full max-w-[620px] overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,.36)]">
            <div className="relative bg-[radial-gradient(circle_at_18%_8%,#dbeafe,transparent_34%),linear-gradient(135deg,#ffffff,#f8fbff)] px-7 pb-6 pt-7 max-[560px]:px-5">
              <button
                type="button"
                onClick={() => closeGuide(true)}
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#64748b] transition-colors hover:bg-white hover:text-[#111827]"
                aria-label="关闭引导"
                title="关闭引导"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white px-3 py-1.5 text-xs font-extrabold text-[#2563eb] shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                平台级新手任务流
              </div>
              <h2 className="mt-4 max-w-[520px] text-[27px] font-black leading-tight text-[#111827] max-[560px]:text-[23px]">
                跟着 SparkLearn 跑完整个平台
              </h2>
              <p className="mt-3 max-w-[540px] text-sm leading-7 text-[#52627b]">
                这不是功能介绍页。我们会带你跨页面体验画像、路径、资源、笔记、知识库、学习伙伴、练习、报告、广场、AI 精灵、智能体、Tutor 和多智能体研讨会。
              </p>
              <div className="mt-5 grid grid-cols-5 gap-2 max-[560px]:grid-cols-2">
                {welcomeFlow.map((item, index) => (
                  <div key={item} className="relative">
                    <div className="grid min-h-11 place-items-center rounded-xl border border-[#dbeafe] bg-white text-xs font-black text-[#2563eb] shadow-sm">
                      {item}
                    </div>
                    {index < welcomeFlow.length - 1 ? (
                      <ArrowRight className="absolute -right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#93c5fd] max-[560px]:hidden" />
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={startTour}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(37,99,235,.24)] transition-colors hover:bg-[#1d4ed8]"
                >
                  开始体验
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => closeGuide(true)}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[#cbd5e1] bg-white px-5 text-sm font-black text-[#475569] transition-colors hover:bg-[#f8fafc]"
                >
                  稍后再说
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {tourVisible && currentStep ? (
        <div
          data-testid="new-user-guide-panel"
          className="fixed inset-0 z-[90] pointer-events-none"
          aria-label="平台级步骤引导"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-transparent pointer-events-auto"
            aria-label="引导遮罩"
            onClick={() => undefined}
          />
          {onExpectedRoute && spotlightRect && tooltipPosition ? (
            <>
              <div
                className="absolute rounded-[16px] border-[3px] border-[#60a5fa] shadow-[0_0_0_9999px_rgba(15,23,42,.66),0_0_0_8px_rgba(96,165,250,.20),0_22px_70px_rgba(37,99,235,.42)] transition-all duration-300"
                style={spotlightRect}
              >
                <div className="absolute -inset-2 rounded-[20px] border border-[#bfdbfe] opacity-80 animate-ping" />
              </div>
              <svg
                className="absolute text-[#60a5fa] drop-shadow-[0_10px_18px_rgba(15,23,42,.28)] transition-all duration-300"
                width="86"
                height="86"
                viewBox="0 0 86 86"
                aria-hidden="true"
                style={{
                  left: Math.min(spotlightRect.left + spotlightRect.width / 2 - 20, window.innerWidth - 100),
                  top: tooltipPosition.placement === 'below' ? spotlightRect.top + spotlightRect.height + 2 : spotlightRect.top - 88,
                  transform: tooltipPosition.placement === 'below' ? 'rotate(0deg)' : 'rotate(180deg)',
                }}
              >
                <path d="M14 20 C36 26 50 38 60 62" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                <path d="M48 58 L62 66 L66 50" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          ) : (
            <div className="absolute inset-0 bg-[#0f172a]/66" />
          )}

          <section
            className={cn(
              'absolute w-[min(430px,calc(100vw-32px))] rounded-[18px] border border-white/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,.34)] pointer-events-auto transition-all duration-300',
              onExpectedRoute && tooltipPosition && "before:absolute before:left-8 before:h-5 before:w-5 before:rotate-45 before:bg-white before:content-['']",
              onExpectedRoute && tooltipPosition?.placement === 'below' && 'before:-top-2',
              onExpectedRoute && tooltipPosition?.placement === 'above' && 'before:-bottom-2',
            )}
            style={onExpectedRoute && tooltipPosition ? { left: tooltipPosition.left, top: tooltipPosition.top } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="relative">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs font-black text-[#2563eb]">
                  <span className={cn('grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br text-white', currentStep.accent)}>
                    {currentStep.icon}
                  </span>
                  第 {currentIndex + 1} / {GUIDE_STEPS.length} 步
                </div>
                <button
                  type="button"
                  onClick={() => closeGuide(true)}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#94a3b8] transition-colors hover:bg-[#f1f5f9] hover:text-[#111827]"
                  aria-label="关闭引导"
                  title="关闭引导"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="text-[20px] font-black leading-7 text-[#111827]">{currentStep.title}</h2>
              <p className="mt-2 text-sm leading-7 text-[#52627b]">{currentStep.description}</p>
              {currentStep.sampleInput ? (
                <div className="mt-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#475569]">
                  示例输入：{currentStep.sampleInput}
                </div>
              ) : null}
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-300', currentStep.accent)} style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => closeGuide(true)}
                  className="text-sm font-black text-[#64748b] transition-colors hover:text-[#111827]"
                >
                  跳过引导
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3 text-sm font-black text-[#475569] transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一步
                  </button>
                  <button
                    type="button"
                    onClick={() => advanceStep(true)}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-4 text-sm font-black text-white transition-colors hover:bg-[#020617]"
                  >
                    {currentIndex >= GUIDE_STEPS.length - 1 ? '完成引导' : '下一步'}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={goToStepAction}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#eff6ff] px-4 text-sm font-black text-[#2563eb] transition-colors hover:bg-[#dbeafe]"
              >
                {onExpectedRoute ? currentStep.actionLabel : `前往${currentStep.route}`}
                <Compass className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
})
