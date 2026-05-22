'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Search } from 'lucide-react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

interface Student {
  id: string; name: string; avatar: string
  major: string; grade: string; current_stage: string
  risk_level: string; quiz_accuracy: number
  total_hours: number; streak_days: number
  task_completion: number; last_active: string
  weak_points: string[]
}

const RISK_LABEL: Record<string, string> = { danger: '高风险', warning: '预警', normal: '正常' }
const RISK_TONE: Record<string, 'red' | 'orange' | 'green'> = { danger: 'red', warning: 'orange', normal: 'green' }
const STAGES = ['全部', '基础语法', '函数与模块', '面向对象', '文件处理', '高级特性']

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState('全部')
  const [filterStage, setFilterStage] = useState('全部')

  useEffect(() => {
    fetch(`${API}/api/teacher/students`)
      .then(r => r.json())
      .then(r => { if (r.success) setStudents(r.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name.includes(search)
    const matchRisk = filterRisk === '全部' || s.risk_level === filterRisk
    const matchStage = filterStage === '全部' || s.current_stage === filterStage
    return matchSearch && matchRisk && matchStage
  })

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 学生管理"
        title="学生管理"
        description="查看所有学生的学习状态、掌握度和风险情况，点击学生卡片进入详情。"
        chips={[
          { value: `${students.length}人`, label: '全班学生', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'blue' },
          { value: `${students.filter(s => s.risk_level !== 'normal').length}人`, label: '需关注', icon: <AlertTriangle className="h-4 w-4" />, tone: 'orange' },
        ]}
      />

      {/* 筛选栏 */}
      <ProtoCard className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索学生姓名..."
              className="h-9 w-full rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] pl-9 pr-3 text-sm outline-none focus:border-[#2563eb]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6b7280]">风险：</span>
            {['全部', 'danger', 'warning', 'normal'].map(v => (
              <button
                key={v}
                onClick={() => setFilterRisk(v)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${filterRisk === v ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627b] hover:bg-[#e5e7eb]'}`}
              >
                {v === '全部' ? '全部' : RISK_LABEL[v]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6b7280]">阶段：</span>
            {STAGES.map(v => (
              <button
                key={v}
                onClick={() => setFilterStage(v)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${filterStage === v ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627b] hover:bg-[#e5e7eb]'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </ProtoCard>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
          {filtered.map(stu => (
            <ProtoCard key={stu.id} className="flex flex-col gap-4">
              {/* 头部 */}
              <div className="flex items-center gap-3">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold text-white ${stu.risk_level === 'danger' ? 'bg-[#dc2626]' : stu.risk_level === 'warning' ? 'bg-[#f59e0b]' : 'bg-[#2563eb]'}`}>
                  {stu.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <b className="text-sm text-[#111827]">{stu.name}</b>
                    <Pill tone={RISK_TONE[stu.risk_level]}>{RISK_LABEL[stu.risk_level]}</Pill>
                  </div>
                  <span className="text-xs text-[#6b7280]">{stu.major} · {stu.grade}</span>
                </div>
              </div>

              {/* 当前阶段 */}
              <SoftCard className="flex items-center justify-between">
                <span className="text-xs text-[#6b7280]">当前阶段</span>
                <Pill tone="blue">{stu.current_stage}</Pill>
              </SoftCard>

              {/* 指标 */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[8px] bg-[#f9fafb] p-2">
                  <b className="block text-base text-[#2563eb]">{Math.round(stu.quiz_accuracy * 100)}%</b>
                  <span className="text-[10px] text-[#6b7280]">正确率</span>
                </div>
                <div className="rounded-[8px] bg-[#f9fafb] p-2">
                  <b className="block text-base text-[#059669]">{stu.streak_days}天</b>
                  <span className="text-[10px] text-[#6b7280]">连续学习</span>
                </div>
                <div className="rounded-[8px] bg-[#f9fafb] p-2">
                  <b className="block text-base text-[#d97706]">{stu.total_hours}h</b>
                  <span className="text-[10px] text-[#6b7280]">总时长</span>
                </div>
              </div>

              {/* 任务完成率进度条 */}
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-[#6b7280]">任务完成率</span>
                  <span className="font-bold text-[#111827]">{Math.round(stu.task_completion * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e8eff8]">
                  <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${stu.task_completion * 100}%` }} />
                </div>
              </div>

              <ProtoButton href={`/teacher/students/${stu.id}`} variant="secondary" className="w-full">
                查看详情
              </ProtoButton>
            </ProtoCard>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 py-16 text-center text-sm text-[#6b7280]">没有符合条件的学生</div>
          )}
        </div>
      )}
    </div>
  )
}
