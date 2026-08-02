'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileText,
  Flag,
  Map,
  Sparkles,
  UserRound,
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

type GuideStep = {
  id: string
  title: string
  detail: string
  highlight: string
  action: string
  href: string
  icon: React.ReactNode
  tone: string
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'profile',
    title: '先建立学习画像',
    detail: '系统会用目标、基础、薄弱点和偏好，决定后续路径、资源和练习难度。',
    highlight: '让 AI 先认识你，而不是直接给通用答案。',
    action: '完善画像',
    href: '/onboarding',
    icon: <UserRound className="h-4 w-4" />,
    tone: 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]',
  },
  {
    id: 'path',
    title: '生成你的个性化学习路径',
    detail: '把大目标拆成阶段、知识点和可执行任务，降低新手不知道从哪开始的问题。',
    highlight: '从目标到步骤，形成可跟进的学习路线。',
    action: '查看路径',
    href: '/path',
    icon: <Map className="h-4 w-4" />,
    tone: 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]',
  },
  {
    id: 'resource',
    title: '按当前卡点生成学习资源',
    detail: '围绕路径节点生成文档、课件、视频、测验或网页资料，让资料围着你当前问题转。',
    highlight: '不是堆资料，而是按学习阶段生产材料。',
    action: '生成资源',
    href: '/generate',
    icon: <FileText className="h-4 w-4" />,
    tone: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
  },
  {
    id: 'tutor',
    title: '让 AI 导师带你拆问题',
    detail: '在学习主工作台里提问、上传材料、选择技能或角色，系统会结合画像和上下文回答。',
    highlight: '支持可信模式、联网搜索、多模态和 MCP 工具扩展。',
    action: '进入导师',
    href: '/tutor',
    icon: <Bot className="h-4 w-4" />,
    tone: 'bg-[#f5f3ff] text-[#7c3aed] border-[#ddd6fe]',
  },
  {
    id: 'practice',
    title: '用练习验证是不是真懂了',
    detail: '通过练习、错题和评测结果，把“看过了”变成“掌握了”。',
    highlight: '把学习结果变成可评估数据。',
    action: '开始练习',
    href: '/practice',
    icon: <BookOpen className="h-4 w-4" />,
    tone: 'bg-[#ecfeff] text-[#0e7490] border-[#a5f3fc]',
  },
  {
    id: 'report',
    title: '查看学习报告和薄弱点',
    detail: '系统汇总任务、资源、练习和画像变化，告诉你下一轮该补哪里。',
    highlight: '从结果反推下一步，而不是只记录学习时长。',
    action: '查看报告',
    href: '/report',
    icon: <BarChart3 className="h-4 w-4" />,
    tone: 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]',
  },
  {
    id: 'profile-update',
    title: '让画像随学习结果更新',
    detail: '你的练习表现、学习记录和阶段变化会反哺画像，让后续推荐越来越贴合。',
    highlight: '形成持续迭代的个性化学习系统。',
    action: '查看画像',
    href: '/profile',
    icon: <Flag className="h-4 w-4" />,
    tone: 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1]',
  },
]

export const NewUserGuidePanel = forwardRef<NewUserGuidePanelHandle>(function NewUserGuidePanel(_, ref) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [userId, setUserId] = useState('anonymous')

  useEffect(() => {
    queueMicrotask(() => {
      const nextUserId = getGuideUserId()
      setUserId(nextUserId)
      setCompletedIds(readNewUserGuideProgress(nextUserId))
      setVisible(!hasSeenNewUserGuide(nextUserId))
    })
  }, [])

  useImperativeHandle(ref, () => ({
    open: () => {
      const nextUserId = getGuideUserId()
      setUserId(nextUserId)
      setCompletedIds(readNewUserGuideProgress(nextUserId))
      setVisible(true)
    },
  }))

  const completedCount = completedIds.length
  const progress = Math.round((completedCount / GUIDE_STEPS.length) * 100)

  const nextStep = useMemo(
    () => GUIDE_STEPS.find((step) => !completedIds.includes(step.id)) || GUIDE_STEPS[0],
    [completedIds],
  )

  function persistProgress(nextIds: string[]) {
    setCompletedIds(nextIds)
    writeNewUserGuideProgress(nextIds, userId)
    if (nextIds.length >= NEW_USER_GUIDE_STEP_IDS.length) {
      markNewUserGuideSeen(userId)
    }
  }

  function openStep(step: GuideStep) {
    const nextIds = Array.from(new Set([...completedIds, step.id]))
    persistProgress(nextIds)
    router.push(step.href)
  }

  function skipGuide() {
    markNewUserGuideSeen(userId)
    setVisible(false)
  }

  function completeGuide() {
    persistProgress(NEW_USER_GUIDE_STEP_IDS)
    markNewUserGuideSeen(userId)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <section
      data-testid="new-user-guide-panel"
      className="mb-5 overflow-hidden rounded-[12px] border border-[#dbeafe] bg-white shadow-md"
      aria-label="新手学习链路引导"
    >
      <div className="grid grid-cols-[minmax(0,.78fr)_minmax(320px,1fr)] gap-0 max-[980px]:grid-cols-1">
        <div className="border-r border-[#e5edf8] bg-[#f8fbff] p-5 max-[980px]:border-r-0 max-[980px]:border-b max-[760px]:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white px-3 py-1 text-xs font-bold text-[#2563eb]">
              <Sparkles className="h-3.5 w-3.5" />
              首次学习引导
            </div>
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#64748b] hover:bg-white hover:text-[#1f2937]"
              aria-label="稍后再看"
              title="稍后再看"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="mt-4 text-[22px] font-extrabold leading-8 text-[#111827] max-[760px]:text-[20px] max-[760px]:leading-7">
            从一次画像开始，跑完你的个性化学习闭环
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#52627b]">
            SparkLearn 会根据你的目标、基础和薄弱点，规划路径、生成资源、陪你互动练习，并把结果回写到学习画像里。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {['多智能体协作', '个性化路径', '资源自动生成', '练习与报告闭环'].map((tag) => (
              <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#475569] ring-1 ring-[#e2e8f0]">
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#64748b]">
              <span>引导进度</span>
              <span>{completedCount}/{GUIDE_STEPS.length}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
              <div className="h-full rounded-full bg-[#2563eb] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 max-[760px]:mt-4">
            <button
              type="button"
              onClick={() => openStep(nextStep)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 text-sm font-bold text-white hover:bg-[#1d4ed8]"
            >
              开始下一步
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={completeGuide}
              className="inline-flex h-10 items-center rounded-lg border border-[#cbd5e1] bg-white px-4 text-sm font-bold text-[#334155] hover:bg-[#f8fafc]"
            >
              全部标记已了解
            </button>
            <button
              type="button"
              onClick={skipGuide}
              className="inline-flex h-10 items-center rounded-lg px-2 text-sm font-bold text-[#64748b] hover:text-[#1f2937]"
            >
              跳过引导
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 max-[760px]:grid-cols-1 max-[760px]:gap-2.5 max-[760px]:p-3">
          {GUIDE_STEPS.map((step, index) => {
            const done = completedIds.includes(step.id)
            return (
              <article
                key={step.id}
                className={cn(
                  'flex min-w-0 flex-col rounded-[10px] border p-3 transition-colors max-[760px]:p-2.5',
                  done ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#e2e8f0] bg-white hover:border-[#bfdbfe]',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg border', step.tone)}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-[#94a3b8]">第 {index + 1} 步</div>
                    <h3 className="mt-0.5 text-sm font-extrabold leading-5 text-[#111827]">{step.title}</h3>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#52627b] max-[760px]:mt-2">{step.detail}</p>
                <p className="mt-2 rounded-lg bg-[#f8fafc] px-2.5 py-2 text-[12px] leading-5 text-[#334155] max-[760px]:py-1.5">
                  {step.highlight}
                </p>
                <button
                  type="button"
                  onClick={() => openStep(step)}
                  className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 text-sm font-bold text-[#2563eb] hover:bg-[#dbeafe]"
                >
                  {step.action}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
})
