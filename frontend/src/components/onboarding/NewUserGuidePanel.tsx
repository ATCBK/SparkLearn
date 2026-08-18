'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Map,
  MessageCircle,
  PenTool,
  Sparkles,
  Target,
  UserRound,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  clearNewUserGuideActive,
  getGuideUserId,
  hasSeenNewUserGuide,
  isNewUserGuideActive,
  markNewUserGuideActive,
  markNewUserGuideSeen,
  readNewUserGuideProgress,
  writeNewUserGuideProgress,
} from './newUserGuideStorage'

export type NewUserGuidePanelHandle = {
  open: () => void
}

type CompletionMode = 'click' | 'input'

type GuideInsight = {
  scene: string
  problem: string
  method: string
}

type GuideStep = {
  id: string
  route: string
  title: string
  description: string
  insight: GuideInsight
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
    title: '先知道今天从哪开始',
    description: '小星同学想学 Python，却总是在“找资料、看一半、又换资料”之间打转。工作台先把今天该做的事收拢到一个入口。',
    insight: {
      scene: '学生知道自己想提升，却很难判断今天先做哪一步。',
      problem: '如果一上来只是给资料，学生仍然要自己判断方向、难度和顺序。',
      method: '工作台先组织学习动作，再把画像、路径、资源、练习和报告连成一条线。',
    },
    target: 'home-workspace',
    fallbackTarget: 'path-entry',
    actionLabel: '查看当前任务',
    icon: <Sparkles className="h-4 w-4" />,
    accent: 'from-[#2563eb] to-[#38bdf8]',
  },
  {
    id: 'profile',
    route: '/profile',
    title: '把“我是谁”变成学习依据',
    description: '在继续学习前，小星同学先把目标、基础、薄弱点和偏好交代清楚。平台先理解人，再安排内容。',
    insight: {
      scene: '同样学习 Python，有人刚入门，有人只卡在函数进阶。',
      problem: '没有画像，AI 只能给通用建议，很难说明“为什么适合这个学生”。',
      method: '把目标、薄弱点、偏好和学习记录沉淀为画像，作为后续推荐和生成的依据。',
    },
    target: 'profile-overview',
    fallbackTarget: 'profile-entry',
    actionLabel: '查看画像',
    icon: <UserRound className="h-4 w-4" />,
    accent: 'from-[#2563eb] to-[#60a5fa]',
  },
  {
    id: 'path',
    route: '/path',
    title: '把大目标拆成能走的节点',
    description: '平台把“学会 Python 函数进阶”拆成几个节点。小星同学不再面对一个大而空的目标。',
    insight: {
      scene: '学生有学习目标，却不知道合理顺序。',
      problem: '只给资源不能解决方向问题，学生看完一份材料仍然不知道下一步。',
      method: '根据画像生成阶段、知识点和任务节点，让资源、Tutor 和练习都围绕当前节点展开。',
    },
    target: 'path-workspace',
    fallbackTarget: 'path-nav',
    actionLabel: '查看路径',
    icon: <Map className="h-4 w-4" />,
    accent: 'from-[#059669] to-[#34d399]',
  },
  {
    id: 'records',
    route: '/practice/records',
    title: '让学习过程有迹可循',
    description: '小星同学能回看自己学过什么、问过什么、哪里仍然薄弱。学习过程不再散落在不同工具里。',
    insight: {
      scene: '学生在视频、笔记、AI 对话和练习之间来回切换。',
      problem: '过程一旦断掉，下一次推荐就只能重新开始猜。',
      method: '把学习行为、问答、练习和节点状态沉淀为连续证据，支撑后续推荐。',
    },
    target: 'practice-records-workspace',
    fallbackTarget: 'practice-nav',
    actionLabel: '查看记录',
    icon: <PenTool className="h-4 w-4" />,
    accent: 'from-[#475569] to-[#94a3b8]',
  },
  {
    id: 'resource',
    route: '/generate',
    title: '围绕当前卡点生成材料',
    description: '资源不是泛泛生成，而是围绕当前节点生成。难度、例子和练习方式都贴合小星同学的画像。',
    insight: {
      scene: '网上资料很多，但难度、风格和例子未必适合当前学生。',
      problem: '学生花时间筛资料，却仍不确定哪一份能解决眼前问题。',
      method: '用画像、路径节点和学习记录约束生成内容，让资源服务这一轮学习。',
    },
    target: 'resource-prompt',
    fallbackTarget: 'resource-entry',
    actionLabel: '生成资源',
    completionMode: 'input',
    sampleInput: '生成一份适合高一学生的 Python 闭包讲义，解释为什么内部函数能记住外层变量，并给 2 道小练习。',
    icon: <FileText className="h-4 w-4" />,
    accent: 'from-[#ea580c] to-[#fbbf24]',
  },
  {
    id: 'tutor',
    route: '/tutor',
    title: '追问能接上前面的学习',
    description: '小星同学看完资源后继续追问。Tutor 带着画像、路径和资料上下文解释，不需要从头介绍背景。',
    insight: {
      scene: '学生向 AI 提问时，经常要重新说明自己是谁、学到哪一步。',
      problem: '孤立问答很难延续学习过程，也难以给出真正贴合学生的解释。',
      method: 'Tutor 读取画像、路径、资源和记录，让对话成为学习闭环的一部分。',
    },
    target: 'tutor-input',
    fallbackTarget: 'tutor-nav',
    actionLabel: '问 Tutor',
    completionMode: 'input',
    sampleInput: '我还是不理解闭包为什么能记住外层变量，请用生活例子和代码解释。',
    icon: <MessageCircle className="h-4 w-4" />,
    accent: 'from-[#1d4ed8] to-[#60a5fa]',
  },
  {
    id: 'practice',
    route: '/practice',
    title: '看懂之后，要验证会不会做',
    description: '小星同学通过练习验证自己是否真的掌握闭包，而不是停留在“好像听懂了”。',
    insight: {
      scene: '学生听讲时觉得懂了，真正写代码时才发现不会。',
      problem: '没有评测，平台无法判断学生是否掌握，也无法给出有效反馈。',
      method: '把练习结果、错因和节点状态沉淀为学习证据，驱动下一步建议。',
    },
    target: 'practice-workspace',
    fallbackTarget: 'practice-nav',
    actionLabel: '进入练习',
    icon: <BookOpen className="h-4 w-4" />,
    accent: 'from-[#2563eb] to-[#818cf8]',
  },
  {
    id: 'report',
    route: '/report',
    title: '学完以后，知道下一步怎么改',
    description: '报告总结小星同学这一轮学习效果，并把薄弱点回流到画像，生成下一步建议。',
    insight: {
      scene: '很多学习产品学完就结束，学生仍然不知道下一步怎么调整。',
      problem: '反馈不回流，下一次推荐仍然像从零开始。',
      method: '报告把评测结果、错因和建议写回画像，让下一轮路径和资源更准确。',
    },
    target: 'report-workspace',
    fallbackTarget: 'report-nav',
    actionLabel: '查看报告',
    icon: <Target className="h-4 w-4" />,
    accent: 'from-[#dc2626] to-[#fb7185]',
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

function isStableGuideUserId(userId: string) {
  return userId.trim().length > 0 && userId !== 'anonymous'
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

function getStoredStepIndex(userId: string, steps: GuideStep[] = GUIDE_STEPS) {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(guideStepKey(userId))
  if (!raw) return 0

  const legacyIndex = Number(raw)
  const storedStepId = Number.isFinite(legacyIndex) ? GUIDE_STEPS[legacyIndex]?.id : raw
  const nextIndex = steps.findIndex(step => step.id === storedStepId)
  return nextIndex >= 0 ? nextIndex : 0
}

function storeStepId(userId: string, stepId: string) {
  if (typeof window === 'undefined') return
  if (!isStableGuideUserId(userId)) return
  window.localStorage.setItem(guideStepKey(userId), stepId)
}

function findGuideTarget(step: GuideStep) {
  if (typeof document === 'undefined') return null
  return (
    document.querySelector<HTMLElement>(`[data-guide-target="${step.target}"]`) ||
    (step.fallbackTarget ? document.querySelector<HTMLElement>(`[data-guide-target="${step.fallbackTarget}"]`) : null)
  )
}

function getRectForStep(step: GuideStep): SpotlightRect | null {
  const target = findGuideTarget(step)
  if (!target) {
    return null
  }

  target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' })
  const rect = target.getBoundingClientRect()
  if (!target.getClientRects().length || rect.width <= 0 || rect.height <= 0) {
    return null
  }
  const left = Math.max(8, rect.left)
  const top = Math.max(8, rect.top)
  const right = Math.min(window.innerWidth - 8, rect.right)
  const bottom = Math.min(window.innerHeight - 8, rect.bottom)

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

function waitForGuideTarget(step: GuideStep, onReady: () => void) {
  if (typeof document === 'undefined') return () => {}
  let done = false
  let frame = 0
  let fallbackTimer = 0

  const complete = () => {
    if (done) return
    if (!findGuideTarget(step)) return
    done = true
    observer.disconnect()
    window.clearTimeout(fallbackTimer)
    onReady()
  }

  const observer = new MutationObserver(() => {
    frame = window.requestAnimationFrame(complete)
  })

  frame = window.requestAnimationFrame(complete)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true })
  fallbackTimer = window.setTimeout(() => {
    if (done) return
    done = true
    observer.disconnect()
    onReady()
  }, 650)

  return () => {
    done = true
    observer.disconnect()
    window.cancelAnimationFrame(frame)
    window.clearTimeout(fallbackTimer)
  }
}

function getTooltipPosition(rect: SpotlightRect): TooltipPosition {
  const tooltipWidth = Math.min(420, window.innerWidth - 32)
  const tooltipHeight = window.innerWidth < 560 ? 380 : 360
  const spaceBelow = window.innerHeight - rect.top - rect.height
  const canFitBelow = spaceBelow > tooltipHeight + 28
  const placement = canFitBelow || rect.top < tooltipHeight + 32 ? 'below' : 'above'
  const preferredTop = placement === 'below' ? rect.top + rect.height + 28 : rect.top - tooltipHeight - 18
  const top = Math.min(Math.max(16, preferredTop), Math.max(16, window.innerHeight - tooltipHeight - 16))
  const targetCenter = rect.left + rect.width / 2
  const left = Math.min(Math.max(16, targetCenter - tooltipWidth / 2), window.innerWidth - tooltipWidth - 16)

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
  const [showInsight, setShowInsight] = useState(false)

  const guideSteps = useMemo(() => GUIDE_STEPS, [])
  const currentStep = guideSteps[currentIndex]
  const onExpectedRoute = currentStep ? routeMatches(pathname, currentStep.route) : false
  const progress = Math.round(((currentIndex + 1) / guideSteps.length) * 100)

  const syncUserGuideState = useCallback(async (forceOpen = false) => {
    if (!hasLoginSession()) {
      setWelcomeVisible(false)
      setTourVisible(false)
      return
    }

    const nextUserId = getGuideUserId()
    if (!isStableGuideUserId(nextUserId)) {
      if (forceOpen) {
        setUserId(nextUserId)
        setCompletedIds([])
        setCurrentIndex(0)
        setWelcomeVisible(true)
        setTourVisible(false)
        return
      }
      setWelcomeVisible(false)
      setTourVisible(false)
      return
    }

    const storedIndex = getStoredStepIndex(nextUserId, GUIDE_STEPS)
    setUserId(nextUserId)
    setCompletedIds(readNewUserGuideProgress(nextUserId))
    setCurrentIndex(storedIndex)
    const guideActive = isNewUserGuideActive(nextUserId)
    if (forceOpen) {
      setWelcomeVisible(true)
      setTourVisible(false)
      return
    }
    if (guideActive) {
      setWelcomeVisible(false)
      setTourVisible(true)
      return
    }
    if (!hasSeenNewUserGuide(nextUserId)) {
      const autoOpenOnHome = normalizeRoute(window.location.pathname) === '/'
      setWelcomeVisible(autoOpenOnHome && storedIndex === 0)
      setTourVisible(false)
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

  useEffect(() => {
    const routes = Array.from(new Set(GUIDE_STEPS.map(step => step.route).filter(route => route !== pathname)))
    routes.forEach(route => {
      router.prefetch(route)
    })
  }, [pathname, router])

  const updateSpotlight = useCallback(() => {
    if (!tourVisible || !currentStep || !onExpectedRoute) {
      setSpotlightRect(null)
      setTooltipPosition(null)
      return
    }
    const rect = getRectForStep(currentStep)
    if (!rect) {
      setSpotlightRect(null)
      setTooltipPosition(null)
      return
    }
    setSpotlightRect(rect)
    setTooltipPosition(getTooltipPosition(rect))
  }, [currentStep, onExpectedRoute, tourVisible])

  useEffect(() => {
    if (!tourVisible || !currentStep || onExpectedRoute) return
    const timer = window.setTimeout(() => {
      router.push(currentStep.route)
    }, 60)
    return () => window.clearTimeout(timer)
  }, [currentStep, onExpectedRoute, router, tourVisible])

  useEffect(() => {
    if (!tourVisible) return
    const frame = window.requestAnimationFrame(updateSpotlight)
    const disconnect = currentStep && onExpectedRoute ? waitForGuideTarget(currentStep, updateSpotlight) : () => {}
    window.addEventListener('resize', updateSpotlight)
    window.addEventListener('scroll', updateSpotlight, true)
    return () => {
      window.cancelAnimationFrame(frame)
      disconnect()
      window.removeEventListener('resize', updateSpotlight)
      window.removeEventListener('scroll', updateSpotlight, true)
    }
  }, [currentStep, onExpectedRoute, pathname, tourVisible, updateSpotlight])

  const persistProgress = useCallback((nextIds: string[]) => {
    setCompletedIds(nextIds)
    writeNewUserGuideProgress(nextIds, userId)
  }, [userId])

  const setStep = useCallback((index: number) => {
    const next = Math.max(0, Math.min(guideSteps.length - 1, index))
    setCurrentIndex(next)
    setShowInsight(false)
    const nextStep = guideSteps[next]
    if (nextStep) storeStepId(userId, nextStep.id)
  }, [guideSteps, userId])

  function startTour() {
    markNewUserGuideActive(userId)
    setWelcomeVisible(false)
    setTourVisible(true)
    setStep(0)
  }

  const closeGuide = useCallback((markSeen = false) => {
    if (markSeen) markNewUserGuideSeen(userId)
    clearNewUserGuideActive(userId)
    setWelcomeVisible(false)
    setTourVisible(false)
    setShowInsight(false)
  }, [userId])

  const completeGuide = useCallback(() => {
    persistProgress(guideSteps.map(step => step.id))
    markNewUserGuideSeen(userId)
    closeGuide(false)
  }, [closeGuide, guideSteps, persistProgress, userId])

  const advanceStep = useCallback(() => {
    if (!currentStep) return
    markNewUserGuideActive(userId)
    persistProgress(Array.from(new Set([...completedIds, currentStep.id])))
    if (currentIndex >= guideSteps.length - 1) {
      completeGuide()
      return
    }
    setStep(currentIndex + 1)
  }, [completedIds, completeGuide, currentIndex, currentStep, guideSteps.length, persistProgress, setStep, userId])

  useEffect(() => {
    if (!tourVisible || !currentStep || !onExpectedRoute) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const matched = target?.closest(`[data-guide-target="${currentStep.target}"]`)
      const fallbackMatched = currentStep.fallbackTarget ? target?.closest(`[data-guide-target="${currentStep.fallbackTarget}"]`) : null
      if (matched || fallbackMatched) {
        window.setTimeout(() => advanceStep(), 120)
      }
    }

    const handleInput = (event: Event) => {
      if (currentStep.completionMode !== 'input') return
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null
      const matched = target?.closest(`[data-guide-target="${currentStep.target}"]`)
      if (matched && target && 'value' in target && target.value.trim().length >= 6) {
        window.setTimeout(() => advanceStep(), 260)
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

  const welcomeFlow = useMemo(() => ['工作台', '画像', '路径', '记录', '资源', 'Tutor', '练习', '报告'], [])

  return (
    <>
      {welcomeVisible ? (
        <div
          data-testid="new-user-guide-panel"
          className="fixed inset-0 z-[90] grid place-items-center bg-[#162033]/64 px-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-label="首次用户体验引导"
        >
          <section className="relative w-full max-w-[620px] overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_30px_100px_rgba(15,23,42,.34)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(219,234,254,.92),transparent_30%),radial-gradient(circle_at_92%_24%,rgba(191,219,254,.58),transparent_26%),linear-gradient(135deg,#ffffff,#f8fbff_55%,#eef6ff)]" />
            <div className="pointer-events-none absolute -right-10 top-12 h-40 w-40 rounded-full border border-[#dbeafe]" />
            <div className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-[#dbeafe]/35 blur-2xl" />
            <div className="relative px-7 pb-6 pt-7 max-[560px]:px-5">
              <button
                type="button"
                onClick={() => closeGuide(true)}
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#64748b] transition-colors hover:bg-white/80 hover:text-[#111827]"
                aria-label="关闭引导"
                title="关闭引导"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white/90 px-3 py-1.5 text-xs font-extrabold text-[#2563eb] shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                平台级新手任务流
              </div>
              <h2 className="mt-4 max-w-[520px] text-[27px] font-black leading-tight text-[#111827] max-[560px]:text-[23px]">
                跟着 SparkLearn 跑完整个平台
              </h2>
              <p className="mt-3 max-w-[540px] text-sm leading-7 text-[#52627b]">
                这不是功能介绍页。我们会带你在真实页面中依次体验工作台、画像、路径、记录、资源、Tutor、练习和报告。
              </p>
              <div className="mt-5 grid grid-cols-5 gap-2 max-[560px]:grid-cols-2">
                {welcomeFlow.map((item, index) => (
                  <div key={item} className="relative">
                    <div className="grid min-h-11 place-items-center rounded-[12px] border border-[#dbeafe] bg-white/90 px-2 text-center text-xs font-black text-[#2563eb] shadow-[0_8px_18px_rgba(37,99,235,.08)]">
                      {item}
                    </div>
                    {index < welcomeFlow.length - 1 && index !== 4 ? (
                      <ArrowRight className="absolute -right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#93c5fd] max-[560px]:hidden" />
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={startTour}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[#2563eb] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(37,99,235,.26)] transition-colors hover:bg-[#1d4ed8]"
                >
                  开始体验
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => closeGuide(true)}
                  className="inline-flex h-11 items-center justify-center rounded-[12px] border border-[#cbd5e1] bg-white/88 px-5 text-sm font-black text-[#475569] transition-colors hover:bg-white"
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
          {onExpectedRoute && spotlightRect && tooltipPosition ? (
            <>
              <div
                className="absolute rounded-[14px] border-[3px] border-[#60a5fa] bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,.62),0_0_0_7px_rgba(96,165,250,.18),0_18px_52px_rgba(37,99,235,.34)]"
                style={spotlightRect}
              />
              <svg
                className="absolute text-[#60a5fa] drop-shadow-[0_10px_18px_rgba(15,23,42,.28)]"
                width="78"
                height="78"
                viewBox="0 0 86 86"
                aria-hidden="true"
                style={{
                  left: Math.min(Math.max(18, spotlightRect.left + spotlightRect.width / 2 - 20), window.innerWidth - 96),
                  top: tooltipPosition.placement === 'below' ? spotlightRect.top + spotlightRect.height + 1 : spotlightRect.top - 80,
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
              'absolute max-h-[calc(100dvh-32px)] w-[min(430px,calc(100vw-32px))] overflow-y-auto rounded-[18px] border border-white/90 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,.34)] pointer-events-auto',
              onExpectedRoute && tooltipPosition && "before:absolute before:left-8 before:h-5 before:w-5 before:rotate-45 before:bg-white before:content-['']",
              onExpectedRoute && tooltipPosition?.placement === 'below' && 'before:-top-2',
              onExpectedRoute && tooltipPosition?.placement === 'above' && 'before:-bottom-2',
            )}
            style={onExpectedRoute && tooltipPosition ? { left: tooltipPosition.left, top: tooltipPosition.top } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="relative">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#eff6ff] py-1 pl-1 pr-3 text-xs font-black text-[#2563eb]">
                  <span className={cn('grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br text-white shadow-sm', currentStep.accent)}>
                    {currentStep.icon}
                  </span>
                  第 {currentIndex + 1} / {guideSteps.length} 步
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowInsight(value => !value)}
                    aria-pressed={showInsight}
                    className={cn(
                      'inline-flex h-8 items-center justify-center rounded-full border px-3 text-xs font-black transition-colors',
                      showInsight
                        ? 'border-[#111827] bg-[#111827] text-white hover:bg-[#020617]'
                        : 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb] hover:bg-[#dbeafe]',
                    )}
                  >
                    {showInsight ? '回到任务' : '背后的思路'}
                  </button>
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
              </div>
              <h2 className="text-[22px] font-black leading-8 text-[#111827]">{currentStep.title}</h2>
              {showInsight ? (
                <div className="mt-3 grid gap-2.5">
                  {[
                    ['情境', currentStep.insight.scene],
                    ['卡点', currentStep.insight.problem],
                    ['处理', currentStep.insight.method],
                  ].map(([label, text], index) => (
                    <div key={label} className="rounded-[14px] border border-[#dbeafe] bg-[linear-gradient(135deg,#f8fbff,#eef6ff)] p-3">
                      <div className="mb-1.5 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#2563eb] shadow-sm">
                        {index + 1}. {label}
                      </div>
                      <p className="text-sm leading-6 text-[#334155]">{text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm leading-7 text-[#52627b]">{currentStep.description}</p>
              )}
              {currentStep.sampleInput ? (
                <div className="mt-3 rounded-[12px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#475569]">
                  示例输入：{currentStep.sampleInput}
                </div>
              ) : null}
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                <div className={cn('h-full rounded-full bg-gradient-to-r', currentStep.accent)} style={{ width: `${progress}%` }} />
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
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[12px] border border-[#cbd5e1] bg-white px-3 text-sm font-black text-[#475569] transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一步
                  </button>
                  <button
                    type="button"
                    onClick={() => advanceStep()}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-[#111827] px-4 text-sm font-black text-white transition-colors hover:bg-[#020617]"
                  >
                    {currentIndex >= guideSteps.length - 1 ? '完成引导' : '下一步'}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {!onExpectedRoute ? (
                <button
                  type="button"
                  onClick={goToStepAction}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[12px] bg-[#eff6ff] px-4 text-sm font-black text-[#2563eb] transition-colors hover:bg-[#dbeafe]"
                >
                  前往当前页面
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
})
