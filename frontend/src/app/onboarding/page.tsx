'use client'
/* eslint-disable react-hooks/set-state-in-effect */

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
} from 'lucide-react'

/* ── 类型 ─────────────────────────────────────────── */

interface CardOption {
  icon: React.ReactNode
  label: string
  desc: string
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
      { icon: <BarChart3 size={22} />, label: '期末提分', desc: '高效备考冲刺' },
      { icon: <Zap size={22} />, label: '竞赛准备', desc: '算法竞赛训练' },
      { icon: <Gamepad2 size={22} />, label: '兴趣探索', desc: '发现编程乐趣' },
      { icon: <Briefcase size={22} />, label: '求职准备', desc: '面试刷题进阶' },
    ],
  },
  {
    key: 'level',
    title: '编程基础',
    question: '你的编程基础如何？',
    cards: [
      { icon: <Lightbulb size={22} />, label: '零基础', desc: '从未接触编程' },
      { icon: <FileText size={22} />, label: '有一些基础', desc: '了解基本概念' },
      { icon: <Code size={22} />, label: '基础较好', desc: '能独立写项目' },
      { icon: <GraduationCap size={22} />, label: '有编程经验', desc: '熟练掌握语言' },
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
      { icon: <Eye size={22} />, label: '视觉型', desc: '图表动画理解' },
      { icon: <Headphones size={22} />, label: '听觉型', desc: '视频讲解为主' },
      { icon: <PenTool size={22} />, label: '实践型', desc: '动手编码练习' },
      { icon: <BookOpen size={22} />, label: '阅读型', desc: '文档教材学习' },
    ],
  },
  {
    key: 'time',
    title: '学习时间',
    question: '每天能投入多少时间学习？',
    cards: [
      { icon: <Clock size={22} />, label: '30分钟以内', desc: '碎片时间学习' },
      { icon: <Clock size={22} />, label: '30-60分钟', desc: '每天一小段' },
      { icon: <Clock size={22} />, label: '1-2小时', desc: '专注学习时段' },
      { icon: <Clock size={22} />, label: '2小时以上', desc: '深度沉浸学习' },
    ],
  },
]

/* ── 主组件 ─────────────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState<Record<number, string[]>>({})
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    setIsTyping(true)
    const t = setTimeout(() => setIsTyping(false), 1000)
    return () => clearTimeout(t)
  }, [step])

  const current = STEPS[step]
  const selected = selections[step] || []
  const canNext = step === STEPS.length - 1 || selected.length > 0

  function toggle(opt: string) {
    setSelections(prev => {
      const arr = prev[step] || []
      return {
        ...prev,
        [step]: arr.includes(opt) ? arr.filter(o => o !== opt) : [...arr, opt],
      }
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fbfbfd',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* ═══ 步骤指示器 ═══ */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 40,
        }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {/* 圆圈 */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  color: i <= step ? '#fff' : '#aeaeb2',
                  background: i < step ? '#34c759' : i === step ? '#0071e3' : '#f5f5f7',
                  boxShadow: i === step ? '0 2px 12px rgba(0,113,227,0.25)' : 'none',
                  transition: 'all 0.3s',
                }}>
                  {i < step ? <CheckCircle2 size={16} /> : i + 1}
                </div>
                {/* 标签 */}
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: i < step ? '#34c759' : i === step ? '#0071e3' : '#aeaeb2',
                  whiteSpace: 'nowrap',
                }}>
                  {s.title}
                </span>
              </div>
              {/* 连接线 */}
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 48,
                  height: 2,
                  borderRadius: 1,
                  background: i < step ? '#34c759' : '#f5f5f7',
                  margin: '0 4px',
                  marginBottom: 22,
                  transition: 'background 0.3s',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* ═══ 主内容卡片 ═══ */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>

          {/* AI 气泡 */}
          <div style={{ padding: '32px 32px 16px' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#0071e3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>AI</span>
              </div>
              <div style={{
                background: '#f5f5f7',
                borderRadius: 12,
                padding: '12px 16px',
                maxWidth: 400,
              }}>
                {isTyping ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#aeaeb2', animation: 'pulse 1.2s infinite' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#aeaeb2', animation: 'pulse 1.2s 0.2s infinite' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#aeaeb2', animation: 'pulse 1.2s 0.4s infinite' }} />
                  </div>
                ) : (
                  <p style={{ fontSize: 15, color: '#1d1d1f', margin: 0, lineHeight: 1.5 }}>{current.question}</p>
                )}
              </div>
            </div>
          </div>

          {/* 选项区域 */}
          {!isTyping && (
            <div style={{ flex: 1, padding: '8px 32px 32px', display: 'flex', flexDirection: 'column' }}>

              {/* ── 卡片网格 ── */}
              {current.cards && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginBottom: 24,
                }}>
                  {current.cards.map(card => {
                    const isActive = selected.includes(card.label)
                    return (
                      <button
                        key={card.label}
                        onClick={() => toggle(card.label)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          padding: '24px 16px',
                          borderRadius: 16,
                          border: isActive ? '2px solid #0071e3' : '2px solid rgba(0,0,0,0.06)',
                          background: isActive ? 'rgba(0,113,227,0.08)' : '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 10,
                          background: isActive ? '#0071e3' : '#f5f5f7',
                          color: isActive ? '#fff' : '#6e6e73',
                          transition: 'all 0.2s',
                        }}>
                          {card.icon}
                        </div>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: isActive ? '#0071e3' : '#1d1d1f',
                          marginBottom: 2,
                        }}>
                          {card.label}
                        </span>
                        <span style={{
                          fontSize: 11,
                          color: isActive ? 'rgba(0,113,227,0.6)' : '#aeaeb2',
                        }}>
                          {card.desc}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* ── 标签云 ── */}
              {current.tags && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f', marginBottom: 12 }}>
                    选择需要加强的方向（可多选）
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {current.tags.map(tag => {
                      const isActive = selected.includes(tag)
                      return (
                        <button
                          key={tag}
                          onClick={() => toggle(tag)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 100,
                            fontSize: 14,
                            fontWeight: 500,
                            border: 'none',
                            cursor: 'pointer',
                            background: isActive ? '#0071e3' : '#f5f5f7',
                            color: isActive ? '#fff' : '#6e6e73',
                            transition: 'all 0.2s',
                          }}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── 摘要（最后一步） ── */}
              {step === STEPS.length - 1 && !isTyping && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f', marginBottom: 16 }}>
                    以下是为你构建的学习画像：
                  </div>
                  {STEPS.map((s, i) => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 14, color: '#6e6e73', width: 72, flexShrink: 0, paddingTop: 2 }}>
                        {s.title}
                      </span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(selections[i] || []).length > 0
                          ? selections[i].map(sel => (
                              <span key={sel} style={{
                                padding: '4px 12px',
                                borderRadius: 100,
                                fontSize: 11,
                                fontWeight: 500,
                                background: 'rgba(0,113,227,0.08)',
                                color: '#0071e3',
                              }}>{sel}</span>
                            ))
                          : <span style={{ fontSize: 14, color: '#aeaeb2' }}>未选择</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── 占位，推按钮到底部 ── */}
              <div style={{ flex: 1 }} />
            </div>
          )}
        </div>

        {/* ═══ 导航按钮 ═══ */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 24,
        }}>
          <button
            onClick={() => step > 0 && setStep(step - 1)}
            disabled={step === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'transparent',
              fontSize: 15,
              fontWeight: 500,
              color: step === 0 ? '#aeaeb2' : '#6e6e73',
              cursor: step === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <ArrowLeft size={16} />
            上一步
          </button>
          <button
            onClick={() => {
              if (step < STEPS.length - 1) setStep(step + 1)
              else router.push('/')
            }}
            disabled={!canNext}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              borderRadius: 12,
              border: 'none',
              background: canNext ? '#0071e3' : '#f5f5f7',
              color: canNext ? '#fff' : '#aeaeb2',
              fontSize: 15,
              fontWeight: 500,
              cursor: canNext ? 'pointer' : 'not-allowed',
              boxShadow: canNext ? '0 2px 8px rgba(0,113,227,0.04)' : 'none',
            }}
          >
            {step === STEPS.length - 1 ? '开始学习' : '下一步'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* 打字动画 keyframes */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
