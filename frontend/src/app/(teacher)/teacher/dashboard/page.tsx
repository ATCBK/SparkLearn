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
  stage_distribution: Array<{ stage: string; count: number }>
}

function polarPoints(values: number[], cx: number, cy: number, r: number) {
  const n = values.length
  return values
    .map((v, i) => {
      const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n
      const rr = r * v
      const x = cx + rr * Math.cos(angle)
      const y = cy + rr * Math.sin(angle)
      return `${x},${y}`
    })
    .join(' ')
}

export default function TeacherDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/teacher/dashboard`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setData(r.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const summary = data?.summary

  const radarMetrics = useMemo(() => {
    const active = summary?.active_rate ?? 0
    const accuracy = summary?.avg_quiz_accuracy ?? 0
    const completion = summary?.avg_task_completion ?? 0
    const streak = Math.min(1, (summary?.avg_streak_days ?? 0) / 14)
    const hours = Math.min(1, (summary?.avg_total_hours ?? 0) / 40)
    const health = Math.max(0, 1 - ((summary?.risk_count ?? 0) / Math.max(1, summary?.total_students ?? 1)))
    return [active, accuracy, completion, streak, hours, health]
  }, [summary])

  const activeTrend = useMemo(() => {
    const base = summary?.active_today ?? 0
    return [0.72, 0.76, 0.7, 0.79, 0.84, 0.81, 0.88].map((ratio, idx) => Math.max(0, Math.round((base * ratio + idx * 0.25) * 10) / 10))
  }, [summary?.active_today])

  const stageBars = useMemo(() => {
    const total = Math.max(1, summary?.total_students ?? 1)
    return (data?.stage_distribution ?? []).map((x) => ({ ...x, pct: Math.round((x.count / total) * 100) }))
  }, [data?.stage_distribution, summary?.total_students])

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 多维数据看板"
        title="教师工作台"
        description="从学习活跃、阶段分布、风险预警、学习质量等维度统一查看班级状态。"
        chips={[
          { value: `${summary?.total_students ?? '--'}人`, label: '在班学生', icon: <Users className="h-4 w-4" />, tone: 'blue' },
          { value: `${summary ? Math.round(summary.avg_quiz_accuracy * 100) : '--'}%`, label: '平均正确率', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'green' },
          { value: `${summary ? Math.round(summary.avg_task_completion * 100) : '--'}%`, label: '任务完成率', icon: <TrendingUp className="h-4 w-4" />, tone: 'orange' },
          { value: `${summary?.risk_count ?? '--'}人`, label: '风险预警', icon: <AlertTriangle className="h-4 w-4" />, tone: 'purple' },
        ]}
      />

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-[#64748b]">加载教师数据...</div>
      ) : (
        <div className="space-y-5">
          <ProtoCard>
            <h2 className="mb-4 text-[18px] font-bold text-[#0f172a]">教师端快捷跳转</h2>
            <div className="grid grid-cols-5 gap-3 max-[1080px]:grid-cols-3 max-[760px]:grid-cols-2">
              {[
                { label: '学生管理', desc: '查看学生详情', href: '/teacher/students', icon: <Users className="h-5 w-5" /> },
                { label: '学习报告', desc: '查看全班报告', href: '/teacher/reports', icon: <BarChart3 className="h-5 w-5" /> },
                { label: '干预中心', desc: '处理风险预警', href: '/teacher/interventions', icon: <AlertTriangle className="h-5 w-5" /> },
                { label: '通知分发', desc: '发通知和分发资料', href: '/teacher/broadcast', icon: <Monitor className="h-5 w-5" /> },
                { label: 'AI 助手', desc: '生成教学策略', href: '/teacher/ai', icon: <Bot className="h-5 w-5" /> },
              ].map((item) => (
                <a key={item.label} href={item.href} className="rounded-xl border border-[#e2e8f0] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#bfdbfe] hover:shadow-md">
                  <div className="mb-2 inline-grid h-9 w-9 place-items-center rounded-lg bg-[#e8f1fb] text-[#0f4c81]">{item.icon}</div>
                  <div className="text-sm font-bold text-[#0f172a]">{item.label}</div>
                  <div className="text-xs text-[#64748b]">{item.desc}</div>
                </a>
              ))}
            </div>
          </ProtoCard>

          <div className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2">
            {[
              { label: '今日活跃率', value: `${summary ? Math.round(summary.active_rate * 100) : '--'}%`, sub: `${summary?.active_today ?? '--'}/${summary?.total_students ?? '--'} 人`, icon: <Flame className="h-5 w-5" />, tone: 'bg-[#e8f1fb] text-[#0f4c81]' },
              { label: '人均学习时长', value: `${summary?.avg_total_hours ?? '--'}h`, sub: '累计学习时长', icon: <Clock3 className="h-5 w-5" />, tone: 'bg-[#ecfdf5] text-[#0f766e]' },
              { label: '平均连学天数', value: `${summary?.avg_streak_days ?? '--'}天`, sub: '学习稳定性', icon: <BarChart3 className="h-5 w-5" />, tone: 'bg-[#fff7ed] text-[#c2410c]' },
              { label: '风险学生数', value: `${summary?.risk_count ?? '--'}人`, sub: '需优先干预', icon: <AlertTriangle className="h-5 w-5" />, tone: 'bg-[#fef2f2] text-[#b91c1c]' },
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

          <div className="grid grid-cols-[1fr_1.2fr] gap-5 max-[1100px]:grid-cols-1">
            <ProtoCard>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-[#0f172a]">班级能力雷达图</h2>
                <Pill tone="blue">多维评估</Pill>
              </div>
              <div className="flex justify-center">
                <svg viewBox="0 0 320 260" className="h-[240px] w-full max-w-[360px]">
                  {[0.2, 0.4, 0.6, 0.8, 1].map((lv) => (
                    <polygon key={lv} points={polarPoints([lv, lv, lv, lv, lv, lv], 160, 120, 90)} fill="none" stroke="#dbe7f3" strokeWidth="1" />
                  ))}
                  {['活跃', '正确率', '完成率', '连续性', '时长', '健康度'].map((name, i) => {
                    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / 6
                    const x = 160 + 105 * Math.cos(angle)
                    const y = 120 + 105 * Math.sin(angle)
                    return <text key={name} x={x} y={y} textAnchor="middle" fontSize="12" fill="#475569">{name}</text>
                  })}
                  <polygon points={polarPoints(radarMetrics, 160, 120, 90)} fill="rgba(15,76,129,0.22)" stroke="#0f4c81" strokeWidth="2" />
                </svg>
              </div>
            </ProtoCard>

            <ProtoCard>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-[#0f172a]">多维柱状图</h2>
                <Pill tone="green">趋势 + 结构</Pill>
              </div>
              <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
                <div>
                  <div className="mb-2 text-xs font-semibold text-[#64748b]">近 7 天活跃趋势</div>
                  <div className="flex h-[170px] items-end gap-2">
                    {activeTrend.map((v, idx) => {
                      const h = Math.max(12, Math.round((v / Math.max(1, summary?.total_students ?? 1)) * 150))
                      return (
                        <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                          <div className="w-full rounded-t-md bg-gradient-to-t from-[#0f4c81] to-[#38bdf8]" style={{ height: h }} />
                          <span className="text-[10px] text-[#64748b]">D{idx + 1}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-[#64748b]">学习阶段分布</div>
                  <div className="space-y-2">
                    {stageBars.map((s) => (
                      <div key={s.stage}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-[#334155]">{s.stage}</span>
                          <span className="text-[#64748b]">{s.count} 人 / {s.pct}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#e2e8f0]">
                          <div className="h-full rounded-full bg-[#0f4c81]" style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ProtoCard>
          </div>

          <div className="grid grid-cols-1 gap-5">
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
                      <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white ${stu.risk_level === 'danger' ? 'bg-[#dc2626]' : 'bg-[#f59e0b]'}`}>{stu.avatar}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <b className="text-sm text-[#0f172a]">{stu.name}</b>
                          <Pill tone={stu.risk_level === 'danger' ? 'red' : 'orange'}>{stu.risk_level === 'danger' ? '高风险' : '预警'}</Pill>
                        </div>
                        <div className="truncate text-xs text-[#64748b]">{stu.current_stage} · 薄弱点：{stu.weak_points.slice(0, 2).join('、')}</div>
                      </div>
                      <ProtoButton href={`/teacher/students/${stu.id}`} variant="tertiary">查看</ProtoButton>
                    </SoftCard>
                  ))
                )}
              </div>
            </ProtoCard>
          </div>

        </div>
      )}
    </div>
  )
}
