'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Target,
  BookOpen,
  Lightbulb,
  Clock,
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
  Bot,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'

/* ── 类型 ─────────────────────────────────────────── */

interface CardOption {
  icon: React.ReactNode
  label: string
  desc: string
  color?: string // 'blue' | 'purple' | 'green' | 'orange'
}

interface StepData {
  key: string
  title: string
  question: string
  cards?: CardOption[]
  tags?: string[]
}

/* ── 步骤数据 ──────────────────────────────────────── */

const STEPS: StepData[] = [
  {
    key: 'goal',
    title: '学习目标',
    question: '你想达成什么样的学习目标？',
    cards: [
      { icon: <BarChart3 size={24} />, label: '期末提分', desc: '高效备考冲刺', color: 'blue' },
      { icon: <Zap size={24} />, label: '竞赛准备', desc: '算法竞赛训练', color: 'purple' },
      { icon: <Gamepad2 size={24} />, label: '兴趣探索', desc: '发现编程乐趣', color: 'green' },
      { icon: <Briefcase size={24} />, label: '求职准备', desc: '面试刷题进阶', color: 'orange' },
    ],
  },
  {
    key: 'level',
    title: '编程基础',
    question: '你的编程基础如何？',
    cards: [
      { icon: <Lightbulb size={24} />, label: '零基础', desc: '从未接触编程', color: 'blue' },
      { icon: <FileText size={24} />, label: '有一些基础', desc: '了解基本概念', color: 'purple' },
      { icon: <Code size={24} />, label: '基础较好', desc: '能独立写项目', color: 'green' },
      { icon: <GraduationCap size={24} />, label: '有编程经验', desc: '熟练掌握语言', color: 'orange' },
    ],
  },
  {
    key: 'weak',
    title: '薄弱环节',
    question: '哪些方面需要加强？',
    tags: ['数据结构', '算法设计', '语法基础', '调试能力', '代码规范', '项目实战', '复杂度分析', '面向对象'],
  },
  {
    key: 'preference',
    title: '学习偏好',
    question: '你喜欢怎样的学习方式？',
    cards: [
      { icon: <Eye size={24} />, label: '视觉型', desc: '图表动画理解', color: 'blue' },
      { icon: <Headphones size={24} />, label: '听觉型', desc: '视频讲解为主', color: 'purple' },
      { icon: <PenTool size={24} />, label: '实践型', desc: '动手编码练习', color: 'green' },
      { icon: <BookOpen size={24} />, label: '阅读型', desc: '文档教材学习', color: 'orange' },
    ],
  },
  {
    key: 'time',
    title: '学习时间',
    question: '每天能投入多少时间学习？',
    cards: [
      { icon: <Clock size={24} />, label: '30分钟以内', desc: '碎片时间学习', color: 'blue' },
      { icon: <Clock size={24} />, label: '30-60分钟', desc: '每天一小段', color: 'purple' },
      { icon: <Clock size={24} />, label: '1-2小时', desc: '专注学习时段', color: 'green' },
      { icon: <Clock size={24} />, label: '2小时以上', desc: '深度沉浸学习', color: 'orange' },
    ],
  },
]

/* ── 辅助函数 ───────────────────────────────────────── */

const getColorClasses = (color?: string, isActive?: boolean) => {
  switch (color) {
    case 'blue':
      return {
        icon: isActive ? 'bg-blue text-white' : 'bg-blue/10 text-blue',
        card: isActive ? 'border-blue bg-blue/5' : 'border-transparent bg-blue/[0.03] hover:bg-blue/[0.06] hover:border-blue/20'
      }
    case 'purple':
      return {
        icon: isActive ? 'bg-purple text-white' : 'bg-purple/10 text-purple',
        card: isActive ? 'border-purple bg-purple/5' : 'border-transparent bg-purple/[0.03] hover:bg-purple/[0.06] hover:border-purple/20'
      }
    case 'green':
      return {
        icon: isActive ? 'bg-success text-white' : 'bg-success/10 text-success',
        card: isActive ? 'border-success bg-success/5' : 'border-transparent bg-success/[0.03] hover:bg-success/[0.06] hover:border-success/20'
      }
    case 'orange':
      return {
        icon: isActive ? 'bg-warning text-white' : 'bg-warning/10 text-warning',
        card: isActive ? 'border-warning bg-warning/5' : 'border-transparent bg-warning/[0.03] hover:bg-warning/[0.06] hover:border-warning/20'
      }
    default:
      return {
        icon: isActive ? 'bg-blue text-white' : 'bg-bg-hover text-ink-secondary',
        card: isActive ? 'border-blue bg-blue/5' : 'border-transparent bg-bg-hover hover:border-blue/20'
      }
  }
}

/* ── 主组件 ─────────────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState<Record<number, string[]>>({})
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    setIsTyping(true)
    const t = setTimeout(() => setIsTyping(false), 800)
    return () => clearTimeout(t)
  }, [step])

  const current = STEPS[step]
  const selected = selections[step] || []
  const canNext = step === STEPS.length - 1 || selected.length > 0

  function toggle(opt: string) {
    setSelections(prev => {
      const arr = prev[step] || []
      // 这里可以根据业务逻辑决定是否多选，目前默认单选（符合图片样式）
      // 如果需要多选，取消下面这行的注释
      // const newArr = arr.includes(opt) ? arr.filter(o => o !== opt) : [...arr, opt]
      const newArr = [opt]
      return {
        ...prev,
        [step]: newArr,
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#f8faff] flex flex-col items-center py-12 px-6 relative overflow-hidden"
      style={{
        backgroundImage: 'url(/on_backboard.png)',
        backgroundSize: '100% 100%',       // 保持比例铺满，多余部分裁剪
        backgroundPosition: 'center',  // 始终居中
        backgroundRepeat: 'no-repeat'
      }}>
      {/* 背景装饰 */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-2 h-2 bg-blue/20 rounded-full" />
        <div className="absolute top-[25%] right-[12%] w-1.5 h-1.5 bg-blue/10 rounded-full" />
        <div className="absolute top-[40%] left-[5%] grid grid-cols-4 gap-4 opacity-20">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 bg-ink-tertiary rounded-full" />
          ))}
        </div>
      </div>

      <div className="w-full max-w-[1000px] flex flex-col items-center relative z-10">
        
        {/* ═══ 步骤指示器 ═══ */}
        <div className="flex items-center justify-center mb-12 w-full max-w-2xl">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                  i < step ? "bg-blue/10 text-blue" : i === step ? "bg-blue text-white shadow-lg shadow-blue/25 scale-110" : "bg-bg-hover text-ink-disabled"
                )}>
                  {i < step ? <CheckCircle2 size={16} /> : i + 1}
                </div>
                <span className={cn(
                  "text-[11px] font-medium transition-colors duration-300",
                  i <= step ? "text-blue" : "text-ink-disabled"
                )}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "w-16 h-[2px] mx-2 -mt-6 transition-colors duration-500",
                  i < step ? "bg-blue" : "bg-bg-hover"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* ═══ 主内容卡片 ═══ */}
        <div className="bg-white rounded-[32px] shadow-xl shadow-blue/5 w-full overflow-hidden flex flex-col min-h-[580px] border border-blue/5">
          
          <div className="p-10 flex flex-col h-full">
            {/* AI 引导与插画区域 */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex-1">
                {/* AI 气泡 */}
                <div className="flex gap-4 items-start mb-6 animate-fade-in-up">
                  <div className="w-12 h-12 rounded-2xl bg-blue/5 flex items-center justify-center flex-shrink-0 border border-blue/10">
                    <Bot className="text-blue" size={28} />
                  </div>
                  <div className="bg-bg-hover rounded-2xl rounded-tl-none p-4 max-w-[420px] relative">
                    <div className="absolute top-0 left-[-8px] w-0 h-0 border-t-[8px] border-t-bg-hover border-l-[8px] border-l-transparent" />
                    <p className="text-body text-ink font-medium leading-relaxed">
                      你好！我是 <span className="text-blue font-bold">SparkAI</span><br/>
                      为了帮你定制最合适的学习路径，我们先从你的学习目标开始吧 ✨
                    </p>
                  </div>
                </div>

                {/* 标题 */}
                <div className="animate-fade-in-up delay-1">
                  <h1 className="text-2xl font-bold text-ink mb-2">{current.question}</h1>
                  <p className="text-small text-ink-secondary">选择一个最符合你当前需求的目标，我们将为你量身定制学习计划</p>
                </div>
              </div>

              {/* 右侧插画 (全页面固定展示) */}
              <div className="hidden md:block animate-scale-in delay-2">
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <div className="absolute inset-0 bg-blue/5 rounded-full blur-3xl" />
                  <div className="relative bg-white p-6 rounded-3xl shadow-lg border border-blue/5 transform hover:rotate-2 transition-transform">
                    <Target size={80} className="text-blue opacity-80" strokeWidth={1.5} />
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-success rounded-full flex items-center justify-center text-white shadow-lg">
                      <CheckCircle2 size={18} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 选项区域 */}
            <div className="flex-1 flex flex-col">
              {current.cards && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {current.cards.map((card, idx) => {
                    const isActive = selected.includes(card.label)
                    const styles = getColorClasses(card.color, isActive)
                    return (
                      <button
                        key={card.label}
                        onClick={() => toggle(card.label)}
                        className={cn(
                          "group flex items-center p-5 rounded-2xl border-2 transition-all duration-300 animate-fade-in-up",
                          styles.card,
                          isActive && "shadow-md shadow-blue/5",
                          `delay-${idx + 3}`
                        )}
                      >
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110",
                          styles.icon
                        )}>
                          {card.icon}
                        </div>
                        <div className="ml-5 text-left flex-1">
                          <h3 className={cn(
                            "text-base font-bold transition-colors",
                            isActive ? "text-blue" : "text-ink"
                          )}>{card.label}</h3>
                          <p className="text-xs text-ink-secondary mt-1">{card.desc}</p>
                        </div>
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                          isActive ? "bg-blue text-white" : "bg-white text-blue opacity-0 group-hover:opacity-100 shadow-sm"
                        )}>
                          <ChevronRight size={18} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* 标签云 (薄弱环节) */}
              {current.tags && (
                <div className="animate-fade-in-up delay-3">
                  <div className="text-sm font-bold text-ink mb-4">选择需要加强的方向（可多选）</div>
                  <div className="flex flex-wrap gap-3">
                    {current.tags.map((tag, idx) => {
                      const isActive = selected.includes(tag)
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            setSelections(prev => {
                              const arr = prev[step] || []
                              const newArr = arr.includes(tag) ? arr.filter(o => o !== tag) : [...arr, tag]
                              return { ...prev, [step]: newArr }
                            })
                          }}
                          className={cn(
                            "px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border animate-scale-in",
                            isActive 
                              ? "bg-blue border-blue text-white shadow-lg shadow-blue/20" 
                              : "bg-bg-hover border-transparent text-ink-secondary hover:border-blue/30 hover:bg-white",
                            `delay-${idx % 8}`
                          )}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 摘要 (最后一步) */}
              {step === STEPS.length - 1 && (
                <div className="bg-bg-hover rounded-2xl p-6 animate-fade-in-up delay-3">
                  <div className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
                    <ShieldCheck className="text-success" size={20} />
                    以下是为你构建的学习画像：
                  </div>
                  <div className="space-y-4">
                    {STEPS.map((s, i) => (
                      <div key={s.key} className="flex items-start gap-4">
                        <span className="text-xs font-bold text-ink-tertiary w-16 pt-1 uppercase tracking-wider">
                          {s.title}
                        </span>
                        <div className="flex gap-2 flex-wrap">
                          {(selections[i] || []).length > 0
                            ? selections[i].map(sel => (
                                <span key={sel} className="px-3 py-1 bg-blue/10 text-blue rounded-full text-[11px] font-bold">
                                  {sel}
                                </span>
                              ))
                            : <span className="text-xs text-ink-disabled italic">未选择</span>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ 底部导航与页脚 ═══ */}
        <div className="w-full mt-10 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-8">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => step > 0 && setStep(step - 1)}
              disabled={step === 0}
              className="px-6 rounded-2xl font-bold"
            >
              <ArrowLeft size={20} />
              上一步
            </Button>

            {/* 页脚提示 */}
            <div className="hidden sm:flex items-center gap-2 text-ink-tertiary text-xs font-medium">
              <div className="w-4 h-4 rounded-full bg-blue/10 flex items-center justify-center">
                <ShieldCheck size={10} className="text-blue" />
              </div>
              仅需 5 步，定制你的专属学习路径
            </div>

            <Button
              size="lg"
              onClick={() => {
                if (step < STEPS.length - 1) setStep(step + 1)
                else router.push('/')
              }}
              disabled={!canNext}
              className="px-8 rounded-full font-bold shadow-lg shadow-blue/25"
            >
              {step === STEPS.length - 1 ? '开启学习之旅' : '下一步'}
              <ArrowRight size={20} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
