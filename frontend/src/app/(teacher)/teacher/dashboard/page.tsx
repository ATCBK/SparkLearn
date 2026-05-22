'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, BarChart3, Bot, CheckCircle2,
  Clock, Flame, Monitor, Sparkles, Users,
} from 'lucide-react'
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
    id: string; name: string; avatar: string
    risk_level: string; current_stage: string
    weak_points: string[]; streak_days: number; last_active: string
  }>
  students: Array<{
    id: string; name: string; avatar: string
    current_stage: string; risk_level: string
    quiz_accuracy: number; streak_days: number
  }>
  stage_distribution: Array<{ stage: string; count: number }>
}

export default function TeacherDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiReport, setAiReport] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/teacher/dashboard`)
      .then(r => r.json())
      .then(r => { if (r.success) setData(r.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const genReport = async () => {
    setAiLoading(true)
    setAiReport('')
    try {
      const r = await fetch(`${API}/api/teacher/ai/daily-report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const j = await r.json()
      if (j.success) setAiReport(j.data.report)
    } catch { setAiReport('生成失败，请确认后端服务已启动。') }
    setAiLoading(false)
  }

  const s = data?.summary

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 今日概览"
        title="班级学习工作台"
        description="实时掌握班级学习动态，快速发现需要关注的学生，AI 辅助生成教学建议。"
        chips={[
          { value: `${s?.total_students ?? '--'}人`, label: '在班学生', icon: <Users className="h-4 w-4" />, tone: 'blue' },
          { value: `${s ? Math.round(s.avg_quiz_accuracy * 100) : '--'}%`, label: '平均正确率', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'green' },
          { value: `${s?.risk_count ?? '--'}人`, label: '风险预警', icon: <AlertTriangle className="h-4 w-4" />, tone: 'orange' },
          { value: `${s?.active_today ?? '--'}人`, label: '今日活跃', icon: <Flame className="h-4 w-4" />, tone: 'purple' },
        ]}
      />

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
            <span className="text-sm text-[#6b7280]">加载班级数据...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 核心指标条 */}
          <div className="grid grid-cols-4 overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-white shadow-md max-[760px]:grid-cols-2">
            {[
              { value: `${s ? Math.round(s.active_rate * 100) : '--'}%`, label: '今日活跃率', desc: `${s?.active_today ?? '--'}/${s?.total_students ?? '--'} 人`, color: 'bg-[#eff6ff] text-[#2563eb]', icon: <Flame className="h-5 w-5" /> },
              { value: `${s ? Math.round(s.avg_quiz_accuracy * 100) : '--'}%`, label: '平均答题正确率', desc: '全班综合表现', color: 'bg-[#ecfdf5] text-[#059669]', icon: <CheckCircle2 className="h-5 w-5" /> },
              { value: `${s?.avg_total_hours ?? '--'}h`, label: '人均学习时长', desc: '累计总时长', color: 'bg-[#fff7ed] text-[#d97706]', icon: <Clock className="h-5 w-5" /> },
              { value: `${s ? Math.round(s.avg_task_completion * 100) : '--'}%`, label: '任务完成率', desc: '全班均值', color: 'bg-[#f3efff] text-[#7c3aed]', icon: <BarChart3 className="h-5 w-5" /> },
            ].map((item, idx) => (
              <div key={item.label} className={`flex items-center gap-3 p-4 ${idx !== 3 ? 'border-r border-[#eef2f7]' : ''}`}>
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${item.color}`}>{item.icon}</div>
                <div>
                  <b className="block text-[20px] text-[#111827]">{item.value}</b>
                  <span className="block text-xs leading-5 text-[#6b7280]">{item.label}<br />{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_.9fr] gap-5 max-[960px]:grid-cols-1">
            {/* 风险预警 */}
            <ProtoCard>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#fef2f2] text-[#dc2626]">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <h2 className="text-[18px] font-bold text-[#111827]">风险预警学生</h2>
                </div>
                <Pill tone="red">{data?.risk_students.length ?? 0} 人需关注</Pill>
              </div>
              <div className="mt-4 space-y-2">
                {data?.risk_students.length === 0 && (
                  <SoftCard className="text-sm text-[#6b7280]">🎉 暂无风险学生，班级状态良好</SoftCard>
                )}
                {data?.risk_students.map(stu => (
                  <SoftCard key={stu.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-white">
                    <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white ${stu.risk_level === 'danger' ? 'bg-[#dc2626]' : 'bg-[#f59e0b]'}`}>
                      {stu.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <b className="text-sm text-[#111827]">{stu.name}</b>
                        <Pill tone={stu.risk_level === 'danger' ? 'red' : 'orange'}>
                          {stu.risk_level === 'danger' ? '高风险' : '预警'}
                        </Pill>
                      </div>
                      <span className="text-xs text-[#6b7280]">
                        {stu.current_stage} · 薄弱：{stu.weak_points.slice(0, 2).join('、')} · {stu.streak_days === 0 ? '已断签' : `连续${stu.streak_days}天`}
                      </span>
                    </div>
                    <ProtoButton href={`/teacher/students/${stu.id}`} variant="tertiary">查看</ProtoButton>
                  </SoftCard>
                ))}
              </div>
              <ProtoButton href="/teacher/interventions" variant="secondary" className="mt-4 w-full">进入干预中心</ProtoButton>
            </ProtoCard>

            {/* AI 日报 */}
            <ProtoCard>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#fff7ed] text-[#d97706]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h2 className="text-[18px] font-bold text-[#111827]">AI 班级日报</h2>
                </div>
                <ProtoButton onClick={genReport} disabled={aiLoading} variant="secondary">
                  {aiLoading ? '生成中...' : '生成日报'}
                </ProtoButton>
              </div>
              <div className="mt-4 min-h-[120px] rounded-[10px] border border-[#eef2f7] bg-[#f9fafb] p-4 text-sm leading-7 text-[#374151]">
                {aiLoading ? (
                  <div className="flex items-center gap-2 text-[#6b7280]">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent" />
                    AI 正在分析班级数据...
                  </div>
                ) : aiReport || (
                  <span className="text-[#9ca3af]">点击"生成日报"，AI 将根据今日班级数据生成学习情况摘要和教学建议。</span>
                )}
              </div>

              {/* 阶段分布 */}
              <div className="mt-4">
                <div className="mb-2 text-xs font-bold text-[#6b7280]">学习阶段分布</div>
                <div className="space-y-1.5">
                  {data?.stage_distribution.map(item => (
                    <div key={item.stage} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-xs text-[#6b7280]">{item.stage}</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-[#e8eff8] h-2">
                        <div
                          className="h-full rounded-full bg-[#2563eb] transition-all"
                          style={{ width: `${(item.count / (s?.total_students || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-bold text-[#111827]">{item.count}人</span>
                    </div>
                  ))}
                </div>
              </div>
            </ProtoCard>
          </div>

          {/* 快捷入口 */}
          <ProtoCard>
            <h2 className="mb-4 text-[18px] font-bold text-[#111827]">快捷入口</h2>
            <div className="grid grid-cols-4 gap-3 max-[760px]:grid-cols-2">
              {[
                { label: '学生管理', desc: '查看所有学生详情', href: '/teacher/students', icon: <Users className="h-6 w-6" />, color: 'bg-[#eff6ff] text-[#2563eb]' },
                { label: 'AI 教学助手', desc: '智能教学问答', href: '/teacher/ai', icon: <Bot className="h-6 w-6" />, color: 'bg-[#f3efff] text-[#7c3aed]' },
                { label: '干预中心', desc: '处理风险学生', href: '/teacher/interventions', icon: <AlertTriangle className="h-6 w-6" />, color: 'bg-[#fef2f2] text-[#dc2626]' },
                { label: '教师大屏', desc: '投影展示模式', href: '/screen/index.html', icon: <Monitor className="h-6 w-6" />, color: 'bg-[#ecfdf5] text-[#059669]', external: true },
              ].map(item => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  className="flex flex-col items-center gap-3 rounded-[12px] border border-[#eef2f7] bg-[#f9fafb] p-5 text-center transition-all hover:border-[#bfdbfe] hover:bg-white hover:shadow-md"
                >
                  <div className={`grid h-12 w-12 place-items-center rounded-xl ${item.color}`}>{item.icon}</div>
                  <div>
                    <b className="block text-sm text-[#111827]">{item.label}</b>
                    <span className="mt-0.5 block text-xs text-[#6b7280]">{item.desc}</span>
                  </div>
                </a>
              ))}
            </div>
          </ProtoCard>
        </div>
      )}
    </div>
  )
}
