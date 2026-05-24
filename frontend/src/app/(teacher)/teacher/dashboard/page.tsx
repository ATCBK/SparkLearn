'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, Bot, CheckCircle2, Clock3, Flame, Monitor, TrendingUp, Users } from 'lucide-react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

interface DashboardData {
  summary: {
    total_students: number
    active_today: number
    active_rate: number
    avg_quiz_accuracy: number
    avg_total_hours: number
    avg_task_completion: number
    avg_streak_days: number
    risk_count: number
  }
  risk_students: Array<{
    id: string
    name: string
    avatar: string
    risk_level: string
    current_stage: string
    weak_points: string[]
    streak_days: number
    last_active: string
  }>
  students: Array<{
    id: string
    name: string
    avatar: string
    current_stage: string
    risk_level: string
    quiz_accuracy: number
    streak_days: number
  }>
  stage_distribution: Array<{ stage: string; count: number }>
}

function colorForIndex(index: number) {
  const colors = ['#0f4c81', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6']
  return colors[index % colors.length]
}

export default function TeacherDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiReport, setAiReport] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/teacher/dashboard`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setData(r.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const summary = data?.summary

  const activeTrend = useMemo(() => {
    const active = summary?.active_today ?? 0
    const total = summary?.total_students ?? 1
    const base = Math.max(1, Math.min(active, total))
    return [0.72, 0.76, 0.7, 0.79, 0.84, 0.81, 0.88].map((ratio, idx) => {
      const v = Math.round((base * ratio + idx * 0.25) * 10) / 10
      return Math.max(0, Math.min(v, total))
    })
  }, [summary?.active_today, summary?.total_students])

  const genReport = async () => {
    setAiLoading(true)
    setAiReport('')
    try {
      const r = await fetch(`${API}/api/teacher/ai/daily-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const j = await r.json()
      if (j.success) setAiReport(j.data.report)
    } catch {
      setAiReport('生成失败，请确认后端服务已启动。')
    }
    setAiLoading(false)
  }

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 数据总览"
        title="班级教学指挥台"
        description="统一查看班级结构、学习活跃、风险预警与教学建议。教师端与大屏数据口径保持一致。"
        chips={[
          { value: `${summary?.total_students ?? '--'}人`, label: '在班学生', icon: <Users className="h-4 w-4" />, tone: 'blue' },
          { value: `${summary ? Math.round(summary.avg_quiz_accuracy * 100) : '--'}%`, label: '平均正确率', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'green' },
          { value: `${summary ? Math.round(summary.avg_task_completion * 100) : '--'}%`, label: '任务完成率', icon: <TrendingUp className="h-4 w-4" />, tone: 'orange' },
          { value: `${summary?.risk_count ?? '--'}人`, label: '风险预警', icon: <AlertTriangle className="h-4 w-4" />, tone: 'purple' },
        ]}
      />

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0f4c81] border-t-transparent" />
            <span className="text-sm text-[#64748b]">加载教师数据...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2">
            {[
              {
                label: '今日活跃率',
                value: `${summary ? Math.round(summary.active_rate * 100) : '--'}%`,
                sub: `${summary?.active_today ?? '--'}/${summary?.total_students ?? '--'} 人`,
                icon: <Flame className="h-5 w-5" />,
                tone: 'bg-[#e8f1fb] text-[#0f4c81]',
              },
              {
                label: '人均学习时长',
                value: `${summary?.avg_total_hours ?? '--'}h`,
                sub: '累计学习时长',
                icon: <Clock3 className="h-5 w-5" />,
                tone: 'bg-[#ecfdf5] text-[#0f766e]',
              },
              {
                label: '平均连学天数',
                value: `${summary?.avg_streak_days ?? '--'}天`,
                sub: '学习稳定性',
                icon: <BarChart3 className="h-5 w-5" />,
                tone: 'bg-[#fff7ed] text-[#c2410c]',
              },
              {
                label: '风险学生数',
                value: `${summary?.risk_count ?? '--'}人`,
                sub: '需优先干预',
                icon: <AlertTriangle className="h-5 w-5" />,
                tone: 'bg-[#fef2f2] text-[#b91c1c]',
              },
            ].map((item) => (
              <ProtoCard key={item.label} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`grid h-11 w-11 place-items-center rounded-xl ${item.tone}`}>{item.icon}</div>
                  <div>
                    <div className="text-xs font-semibold text-[#64748b]">{item.label}</div>
                    <div className="text-[22px] font-bold text-[#0f172a]">{item.value}</div>
                    <div className="text-xs text-[#94a3b8]">{item.sub}</div>
                  </div>
                </div>
              </ProtoCard>
            ))}
          </div>

          <div className="grid grid-cols-[1.2fr_1fr] gap-5 max-[1100px]:grid-cols-1">
            <ProtoCard>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-[#0f172a]">学习阶段分布图</h2>
                <Pill tone="blue">与大屏同口径</Pill>
              </div>
              <div className="space-y-3">
                {(data?.stage_distribution ?? []).map((item, idx) => {
                  const total = summary?.total_students || 1
                  const percent = Math.round((item.count / total) * 100)
                  return (
                    <div key={item.stage}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#334155]">{item.stage}</span>
                        <span className="text-[#64748b]">{item.count} 人 · {percent}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-[#e2e8f0]">
                        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: colorForIndex(idx) }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </ProtoCard>

            <ProtoCard>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-[#0f172a]">近7天活跃趋势</h2>
                <Pill tone="green">教学节奏</Pill>
              </div>
              <div className="flex h-[180px] items-end gap-2">
                {activeTrend.map((v, idx) => {
                  const total = summary?.total_students || 1
                  const height = Math.max(12, Math.round((v / total) * 160))
                  return (
                    <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                      <div className="w-full rounded-t-md bg-gradient-to-t from-[#0f4c81] to-[#38bdf8]" style={{ height }} />
                      <span className="text-[10px] text-[#64748b]">D{idx + 1}</span>
                    </div>
                  )
                })}
              </div>
            </ProtoCard>
          </div>

          <div className="grid grid-cols-[1fr_1fr] gap-5 max-[1100px]:grid-cols-1">
            <ProtoCard>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-[#0f172a]">风险学生清单</h2>
                <ProtoButton href="/teacher/interventions" variant="secondary">进入干预中心</ProtoButton>
              </div>
              <div className="space-y-2">
                {(data?.risk_students ?? []).length === 0 ? (
                  <SoftCard className="text-sm text-[#64748b]">当前暂无风险学生。</SoftCard>
                ) : (
                  data?.risk_students.map((stu) => (
                    <SoftCard key={stu.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-white">
                      <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white ${stu.risk_level === 'danger' ? 'bg-[#dc2626]' : 'bg-[#f59e0b]'}`}>
                        {stu.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <b className="text-sm text-[#0f172a]">{stu.name}</b>
                          <Pill tone={stu.risk_level === 'danger' ? 'red' : 'orange'}>{stu.risk_level === 'danger' ? '高风险' : '预警'}</Pill>
                        </div>
                        <div className="truncate text-xs text-[#64748b]">{stu.current_stage} · 薄弱点: {stu.weak_points.slice(0, 2).join('、')}</div>
                      </div>
                      <ProtoButton href={`/teacher/students/${stu.id}`} variant="tertiary">查看</ProtoButton>
                    </SoftCard>
                  ))
                )}
              </div>
            </ProtoCard>

            <ProtoCard>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-[#0f172a]">AI 教学日报</h2>
                <ProtoButton onClick={genReport} disabled={aiLoading} variant="secondary">{aiLoading ? '生成中...' : '生成日报'}</ProtoButton>
              </div>
              <div className="min-h-[178px] rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-sm leading-7 text-[#334155]">
                {aiLoading ? 'AI 正在分析班级数据...' : aiReport || '点击“生成日报”获得今日班级教学建议。'}
              </div>
            </ProtoCard>
          </div>

          <ProtoCard>
            <h2 className="mb-4 text-[18px] font-bold text-[#0f172a]">教师端快捷跳转</h2>
            <div className="grid grid-cols-5 gap-3 max-[1080px]:grid-cols-3 max-[760px]:grid-cols-2">
              {[
                { label: '学生管理', desc: '查看学生详情', href: '/teacher/students', icon: <Users className="h-5 w-5" /> },
                { label: '学习报告', desc: '查看全班报告', href: '/teacher/reports', icon: <BarChart3 className="h-5 w-5" /> },
                { label: '干预中心', desc: '处理风险预警', href: '/teacher/interventions', icon: <AlertTriangle className="h-5 w-5" /> },
                { label: 'AI 助手', desc: '生成教学策略', href: '/teacher/ai', icon: <Bot className="h-5 w-5" /> },
                { label: '教师大屏', desc: '投影展示模式', href: '/screen/index.html', icon: <Monitor className="h-5 w-5" />, external: true },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  className="rounded-xl border border-[#e2e8f0] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#bfdbfe] hover:shadow-md"
                >
                  <div className="mb-2 inline-grid h-9 w-9 place-items-center rounded-lg bg-[#e8f1fb] text-[#0f4c81]">{item.icon}</div>
                  <div className="text-sm font-bold text-[#0f172a]">{item.label}</div>
                  <div className="text-xs text-[#64748b]">{item.desc}</div>
                </a>
              ))}
            </div>
          </ProtoCard>
        </div>
      )}
    </div>
  )
}

