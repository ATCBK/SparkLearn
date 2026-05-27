'use client'
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, Clock } from 'lucide-react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

interface RiskStudent {
  id: string; name: string; avatar: string
  risk_level: string; current_stage: string
  weak_points: string[]; streak_days: number; last_active: string
}

type InterventionStatus = 'pending' | 'done' | 'ignored'

interface InterventionRecord {
  studentId: string
  status: InterventionStatus
  diagnosis: string
  diagLoading: boolean
  note: string
}

export default function TeacherInterventionsPage() {
  const [riskStudents, setRiskStudents] = useState<RiskStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<Record<string, InterventionRecord>>({})

  useEffect(() => {
    fetch(`${API}/api/teacher/dashboard`)
      .then(r => r.json())
      .then(r => {
        if (r.success) {
          const risks: RiskStudent[] = r.data.risk_students
          setRiskStudents(risks)
          const init: Record<string, InterventionRecord> = {}
          risks.forEach(s => {
            init[s.id] = { studentId: s.id, status: 'pending', diagnosis: '', diagLoading: false, note: '' }
          })
          setRecords(init)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const runDiagnosis = async (studentId: string) => {
    setRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], diagLoading: true, diagnosis: '' } }))
    try {
      const r = await fetch(`${API}/api/teacher/ai/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      })
      const j = await r.json()
      setRecords(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], diagLoading: false, diagnosis: j.success ? j.data.diagnosis : '诊断失败' }
      }))
    } catch {
      setRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], diagLoading: false, diagnosis: '网络错误，请重试' } }))
    }
  }

  const setStatus = (studentId: string, status: InterventionStatus) => {
    setRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
  }

  const danger = riskStudents.filter(s => s.risk_level === 'danger')
  const warning = riskStudents.filter(s => s.risk_level === 'warning')
  const doneCount = Object.values(records).filter(r => r.status === 'done').length

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 干预中心"
        title="干预中心"
        description="AI 自动识别需要关注的学生，生成个性化干预建议，记录处理状态。"
        chips={[
          { value: `${danger.length}人`, label: '高风险', icon: <AlertTriangle className="h-4 w-4" />, tone: 'red' },
          { value: `${warning.length}人`, label: '预警', icon: <Clock className="h-4 w-4" />, tone: 'orange' },
          { value: `${doneCount}人`, label: '已处理', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'green' },
        ]}
      />

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
        </div>
      ) : riskStudents.length === 0 ? (
        <ProtoCard className="py-16 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-sm font-bold text-[#111827]">暂无风险学生</p>
          <p className="mt-1 text-xs text-[#6b7280]">班级整体状态良好，继续保持</p>
        </ProtoCard>
      ) : (
        <div className="space-y-6">
          {/* 高风险 */}
          {danger.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#dc2626]" />
                <h2 className="text-sm font-bold text-[#dc2626]">高风险学生（{danger.length}人）</h2>
              </div>
              <div className="space-y-3">
                {danger.map(stu => <InterventionCard key={stu.id} student={stu} record={records[stu.id]} onDiagnose={runDiagnosis} onStatus={setStatus} />)}
              </div>
            </div>
          )}

          {/* 预警 */}
          {warning.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                <h2 className="text-sm font-bold text-[#f59e0b]">预警学生（{warning.length}人）</h2>
              </div>
              <div className="space-y-3">
                {warning.map(stu => <InterventionCard key={stu.id} student={stu} record={records[stu.id]} onDiagnose={runDiagnosis} onStatus={setStatus} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InterventionCard({
  student, record, onDiagnose, onStatus,
}: {
  student: RiskStudent
  record: InterventionRecord | undefined
  onDiagnose: (id: string) => void
  onStatus: (id: string, s: InterventionStatus) => void
}) {
  const isDanger = student.risk_level === 'danger'
  const status = record?.status ?? 'pending'

  return (
    <ProtoCard className={`border-l-4 ${isDanger ? 'border-l-[#dc2626]' : 'border-l-[#f59e0b]'}`}>
      <div className="flex items-start gap-4">
        {/* 头像 */}
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold text-white ${isDanger ? 'bg-[#dc2626]' : 'bg-[#f59e0b]'}`}>
          {student.avatar}
        </div>

        <div className="flex-1 min-w-0">
          {/* 基本信息 */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <b className="text-sm text-[#111827]">{student.name}</b>
            <Pill tone={isDanger ? 'red' : 'orange'}>{isDanger ? '高风险' : '预警'}</Pill>
            <Pill tone="blue">{student.current_stage}</Pill>
            {status === 'done' && <Pill tone="green">已处理</Pill>}
            {status === 'ignored' && <Pill tone="neutral">已忽略</Pill>}
          </div>

          <div className="mb-3 flex flex-wrap gap-3 text-xs text-[#6b7280]">
            <span>薄弱点：{student.weak_points.slice(0, 3).join('、')}</span>
            <span>连续学习：{student.streak_days === 0 ? '已断签' : `${student.streak_days}天`}</span>
            <span>最近活跃：{student.last_active}</span>
          </div>

          {/* AI 诊断区 */}
          <div className="rounded-[8px] bg-[#f9fafb] border border-[#eef2f7] p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#7c3aed]">
                <Bot className="h-3.5 w-3.5" />
                AI 干预建议
              </div>
              <ProtoButton
                onClick={() => onDiagnose(student.id)}
                disabled={record?.diagLoading}
                variant="ghost"
              >
                {record?.diagLoading ? '分析中...' : record?.diagnosis ? '重新生成' : '生成建议'}
              </ProtoButton>
            </div>
            <p className="text-xs leading-6 text-[#374151]">
              {record?.diagLoading ? (
                <span className="flex items-center gap-2 text-[#6b7280]">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
                  AI 正在分析...
                </span>
              ) : record?.diagnosis || <span className="text-[#9ca3af]">点击"生成建议"获取 AI 干预方案</span>}
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <ProtoButton href={`/teacher/students/${student.id}`} variant="secondary">
              查看详情
            </ProtoButton>
            {status !== 'done' && (
              <ProtoButton onClick={() => onStatus(student.id, 'done')} variant="primary">
                标记已处理
              </ProtoButton>
            )}
            {status === 'pending' && (
              <ProtoButton onClick={() => onStatus(student.id, 'ignored')} variant="tertiary">
                暂时忽略
              </ProtoButton>
            )}
            {status !== 'pending' && (
              <ProtoButton onClick={() => onStatus(student.id, 'pending')} variant="tertiary">
                重置状态
              </ProtoButton>
            )}
          </div>
        </div>
      </div>
    </ProtoCard>
  )
}
