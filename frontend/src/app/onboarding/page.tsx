'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'
import { CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const STEPS = [
  { title: '课程与目标', question: '你想学习什么课程？你的学习目标是什么？' },
  { title: '基础与薄弱点', question: '你的编程基础如何？哪些方面需要加强？' },
  { title: '学习偏好', question: '你喜欢怎样的学习方式？' },
  { title: '时间与实操', question: '每天能学多久？动手能力怎么样？' },
  { title: '确认画像', question: '以下是为你构建的学习画像，确认无误后即可开始学习！' },
]

const OPTIONS: Record<number, string[]> = {
  0: ['期末提分', '竞赛准备', '兴趣探索', '求职准备'],
  1: ['零基础', '有一些基础', '基础较好', '有编程经验'],
  2: ['视觉型', '听觉型', '实践型', '阅读型'],
  3: ['30分钟以内', '30-60分钟', '1-2小时', '2小时以上'],
}

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [selections, setSelections] = useState<Record<number, string[]>>({})
  const [isTyping, setIsTyping] = useState(true)

  // Simulate AI typing delay
  useState(() => {
    setTimeout(() => setIsTyping(false), 1500)
  })

  function toggleSelection(step: number, option: string) {
    setSelections(prev => {
      const current = prev[step] || []
      return {
        ...prev,
        [step]: current.includes(option)
          ? current.filter(o => o !== option)
          : [...current, option],
      }
    })
  }

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
      setIsTyping(true)
      setTimeout(() => setIsTyping(false), 1500)
    } else {
      // Complete onboarding
      router.push('/')
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const step = STEPS[currentStep]
  const selected = selections[currentStep] || []
  const canProceed = currentStep === STEPS.length - 1 || selected.length > 0

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-small font-medium transition-colors',
                i < currentStep && 'bg-success text-white',
                i === currentStep && 'bg-blue text-white',
                i > currentStep && 'bg-bg-hover text-ink-disabled',
              )}>
                {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'w-8 h-0.5 rounded-full',
                  i < currentStep ? 'bg-success' : 'bg-bg-hover',
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-h1 text-ink">{step.title}</h1>
        </div>

        {/* Chat Area */}
        <Card className="p-8">
          {/* AI Message */}
          <div className="flex gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center shrink-0">
              <span className="text-white text-micro font-bold">AI</span>
            </div>
            <div className="bg-bg-hover rounded-[12px] px-4 py-3 max-w-md">
              {isTyping ? (
                <TypewriterLoader />
              ) : (
                <p className="text-body text-ink">{step.question}</p>
              )}
            </div>
          </div>

          {/* Options (for steps 0-3) */}
          {currentStep < 4 && !isTyping && (
            <div className="flex flex-wrap gap-3 ml-11">
              {OPTIONS[currentStep]?.map(opt => (
                <button
                  key={opt}
                  onClick={() => toggleSelection(currentStep, opt)}
                  className={cn(
                    'px-4 py-2.5 rounded-[12px] border text-small font-medium transition-all',
                    selected.includes(opt)
                      ? 'border-blue bg-blue-light text-blue'
                      : 'border-black/[0.08] bg-bg-card text-ink-secondary hover:border-blue/30',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Summary (for step 4) */}
          {currentStep === 4 && !isTyping && (
            <div className="ml-11 space-y-3">
              {STEPS.slice(0, 4).map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-small text-ink-secondary w-24">{s.title}</span>
                  <div className="flex gap-1 flex-wrap">
                    {(selections[i] || []).map(sel => (
                      <Badge key={sel} variant="info">{sel}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0}>
            <ArrowLeft className="w-4 h-4" />
            上一步
          </Button>
          <Button onClick={handleNext} disabled={!canProceed}>
            {currentStep === STEPS.length - 1 ? '开始学习' : '下一步'}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
