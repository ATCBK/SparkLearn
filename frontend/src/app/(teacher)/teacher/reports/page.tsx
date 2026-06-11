'use client'

import { useEffect, useState } from 'react'
import { BarChart3, CheckCircle2, Clock, Flame, TrendingUp, Users } from 'lucide-react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

interface DashboardData {
  summary: {
    total_students: number; active_today: number; active_rate: number
    avg_quiz_accuracy: number; avg_total_hours: number
    avg_task_completion: number; avg_streak_days: number; risk_count: number
  }
  stage_distribution: Array<{ stage: string; count: number }>
  stage_mastery: Array<{ stage: string; avg_mastery: number; student_count: number }>
  weak_kps: Array<{ id: string; name: string; avg_mastery: number }>
  students: Array<{
    id: string; name: string; avatar: string; current_stage: string
    risk_level: string; quiz_accuracy: number; total_hours: number
    streak_days: number; task_completion: number
  }>
}

export default function TeacherReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/teacher/dashboard`)
      .then(r => r.json())
      .then(r => { if (r.success) setData(r.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const s = data?.summary

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 学习报告"
        title="班级学习报告"
        description="全班学习数据汇总，包含阶段分布、掌握度分析、薄弱知识点和学生排行。"
        chips={[
          { value: `${s?.total_students ?? '--'}人`, label: '在班学生', icon: <Users className="h-4 w-4" />, tone: 'blue' },
          { value: `${s ? Math.round(s.avg_quiz_accuracy * 100) : '--'}%`, label: '平均正确率', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'green' },
          { value: `${s?.avg_total_hours ?? '--'}h`, label: '人均时长', icon: <Clock className="h-4 w-4" />, tone: 'orange' },
        ]}
      />

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* 核心指标 */}
          <div className="grid grid-cols-4 overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-white shadow-md max-[760px]:grid-cols-2">
            {[
              { value: `${s ? Math.round(s.active_rate * 100) : '--'}%`, label: '今日活跃率', sub: `${s?.active_today}/${s?.total_students} 人`, color: 'bg-[#eff6ff] text-[#2563eb]', icon: <Flame className="h-5 w-5" /> },
              { value: `${s ? Math.round(s.avg_quiz_accuracy * 100) : '--'}%`, label: '平均正确率', sub: '全班综合', color: 'bg-[#ecfdf5] text-[#059669]', icon: <CheckCircle2 className="h-5 w-5" /> },
              { value: `${s ? Math.round(s.avg_task_completion * 100) : '--'}%`, label: '任务完成率', sub: '全班均值', color: 'bg-[#f3efff] text-[#7c3aed]', icon: <TrendingUp className="h-5 w-5" /> },
              { value: `${s?.avg_streak_days ?? '--'}天`, label: '平均连续天数', sub: '学习坚持度', color: 'bg-[#fff7ed] text-[#d97706]', icon: <BarChart3 className="h-5 w-5" /> },
            ].map((item, idx) => (
              <div key={item.label} className={`flex items-center gap-3 p-4 ${idx !== 3 ? 'border-r border-[#eef2f7]' : ''}`}>
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${item.color}`}>{item.icon}</div>
                <div>
                  <b className="block text-[20px] text-[#111827]">{item.value}</b>
                  <span className="block text-xs leading-5 text-[#6b7280]">{item.label}<br />{item.sub}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
            {/* 阶段掌握度 */}
            <ProtoCard>
              <h2 className="mb-4 text-[18px] font-bold text-[#111827]">各阶段平均掌握度</h2>
              <div className="space-y-3">
                {data?.stage_mastery.map(item => (
                  <div key={item.stage}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-bold text-[#374151]">{item.stage}</span>
                      <span className="text-[#6b7280]">{item.student_count}人 · {Math.round(item.avg_mastery * 100)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#e8eff8]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.avg_mastery >= 0.8 ? 'bg-[#059669]'
                          : item.avg_mastery >= 0.5 ? 'bg-[#2563eb]'
                          : 'bg-[#dc2626]'
                        }`}
                        style={{ width: `${item.avg_mastery * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ProtoCard>

            {/* 薄弱知识点 */}
            <ProtoCard>
              <h2 className="mb-4 text-[18px] font-bold text-[#111827]">全班薄弱知识点 TOP8</h2>
              <div className="space-y-2.5">
                {data?.weak_kps.slice(0, 8).map((kp, idx) => (
                  <div key={kp.id} className="flex items-center gap-3">
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold text-white ${idx < 3 ? 'bg-[#dc2626]' : idx < 5 ? 'bg-[#f59e0b]' : 'bg-[#6b7280]'}`}>
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-xs text-[#374151]">{kp.name}</span>
                    <div className="w-24 overflow-hidden rounded-full bg-[#e8eff8] h-1.5">
                      <div
                        className={`h-full rounded-full ${kp.avg_mastery < 0.4 ? 'bg-[#dc2626]' : kp.avg_mastery < 0.6 ? 'bg-[#f59e0b]' : 'bg-[#2563eb]'}`}
                        style={{ width: `${kp.avg_mastery * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-bold text-[#111827]">{Math.round(kp.avg_mastery * 100)}%</span>
                  </div>
                ))}
              </div>
            </ProtoCard>
          </div>

          {/* 学生正确率排行 */}
          <ProtoCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-bold text-[#111827]">学生答题正确率排行</h2>
              <ProtoButton href="/teacher/students" variant="ghost">查看全部 →</ProtoButton>
            </div>
            <div className="space-y-2">
              {data?.students
                .slice()
                .sort((a, b) => b.quiz_accuracy - a.quiz_accuracy)
                .map((stu, idx) => (
                  <SoftCard key={stu.id} className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-3 bg-white">
                    <span className={`grid h-6 w-6 place-items-center rounded text-xs font-bold text-white ${idx === 0 ? 'bg-[#f59e0b]' : idx === 1 ? 'bg-[#6b7280]' : idx === 2 ? 'bg-[#d97706]' : 'bg-[#e5e7eb] text-[#6b7280]'}`}>
                      {idx + 1}
                    </span>
                    <div className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white ${stu.risk_level === 'danger' ? 'bg-[#dc2626]' : stu.risk_level === 'warning' ? 'bg-[#f59e0b]' : 'bg-[#2563eb]'}`}>
                      {stu.avatar}
                    </div>
                    <div className="min-w-0">
                      <b className="block text-sm text-[#111827]">{stu.name}</b>
                      <span className="text-xs text-[#6b7280]">{stu.current_stage} · {stu.streak_days}天连续</span>
                    </div>
                    <div className="w-32 overflow-hidden rounded-full bg-[#e8eff8] h-2">
                      <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${stu.quiz_accuracy * 100}%` }} />
                    </div>
                    <span className="w-12 text-right text-sm font-bold text-[#111827]">{Math.round(stu.quiz_accuracy * 100)}%</span>
                  </SoftCard>
                ))}
            </div>
          </ProtoCard>
        </div>
      )}
    </div>
  )
}
