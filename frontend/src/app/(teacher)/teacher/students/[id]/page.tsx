'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, Bot, CheckCircle2, Clock, Flame } from 'lucide-react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

interface StudentDetail {
  id: string; name: string; avatar: string
  major: string; grade: string; current_stage: string
  knowledge_level: string; risk_level: string
  weak_points: string[]; learning_preference: string[]
  daily_time: number; streak_days: number
  quiz_accuracy: number; total_hours: number
  task_completion: number; last_active: string
  mastery: Record<string, number>
}

const KP_NAMES: Record<string, string> = {
  '1.1':'变量与数据类型','1.2':'表达式与运算符','1.3':'条件分支',
  '1.4':'循环与控制','1.5':'列表与字典',
  '2.1':'函数定义与调用','2.2':'作用域与闭包','2.3':'模块与包','2.4':'常用标准库',
  '3.1':'类与对象','3.2':'封装与属性','3.3':'继承与多态','3.4':'OOP建模实战',
  '4.1':'文件读写','4.2':'异常处理','4.3':'JSON与持久化','4.4':'日志与调试',
  '5.1':'装饰器','5.2':'生成器与迭代器','5.3':'列表推导式','5.4':'异步编程入门',
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [diagnosis, setDiagnosis] = useState('')
  const [diagLoading, setDiagLoading] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/teacher/students/${id}`)
      .then(r => r.json())
      .then(r => { if (r.success) setStudent(r.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const runDiagnosis = async () => {
    setDiagLoading(true); setDiagnosis('')
    try {
      const r = await fetch(`${API}/api/teacher/ai/diagnose`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: id }),
      })
      const j = await r.json()
      if (j.success) setDiagnosis(j.data.diagnosis)
    } catch { setDiagnosis('诊断失败') }
    setDiagLoading(false)
  }

  if (loading) return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
    </div>
  )
  if (!student) return <div className="py-20 text-center text-sm text-[#6b7280]">未找到该学生</div>

  const riskColor = student.risk_level === 'danger' ? 'bg-[#dc2626]' : student.risk_level === 'warning' ? 'bg-[#f59e0b]' : 'bg-[#2563eb]'
  const masteryEntries = Object.entries(student.mastery).sort((a, b) => a[0].localeCompare(b[0]))
  const weakEntries = masteryEntries.filter(([, v]) => v < 0.6).sort((a, b) => a[1] - b[1])

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 学生管理 / 学生详情"
        title={`${student.name} 的学习画像`}
        chips={[
          { value: student.current_stage, label: '当前阶段', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'blue' },
          { value: `${Math.round(student.quiz_accuracy * 100)}%`, label: '正确率', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'green' },
          { value: `${student.streak_days}天`, label: '连续学习', icon: <Flame className="h-4 w-4" />, tone: student.streak_days > 7 ? 'green' : 'orange' },
        ]}
      />

      <div className="grid grid-cols-[300px_1fr] gap-5 max-[960px]:grid-cols-1">
        <div className="space-y-4">
          <ProtoCard className="text-center">
            <div className={`mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full text-2xl font-bold text-white ${riskColor}`}>{student.avatar}</div>
            <h2 className="text-lg font-bold text-[#111827]">{student.name}</h2>
            <p className="text-sm text-[#6b7280]">{student.major} · {student.grade}</p>
            <div className="mt-3 flex justify-center">
              <Pill tone={student.risk_level === 'danger' ? 'red' : student.risk_level === 'warning' ? 'orange' : 'green'}>
                {student.risk_level === 'danger' ? '高风险' : student.risk_level === 'warning' ? '预警' : '正常'}
              </Pill>
            </div>
          </ProtoCard>

          <ProtoCard>
            <h3 className="mb-3 text-sm font-bold text-[#111827]">学习画像</h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-[#6b7280]">知识水平</span><span className="font-bold">{student.knowledge_level}</span></div>
              <div className="flex justify-between"><span className="text-[#6b7280]">每日计划</span><span className="font-bold">{student.daily_time}分钟</span></div>
              <div className="flex justify-between"><span className="text-[#6b7280]">最近活跃</span><span className="font-bold">{student.last_active}</span></div>
              <div><span className="text-[#6b7280]">学习偏好</span>
                <div className="mt-1 flex flex-wrap gap-1">{student.learning_preference.map(p => <Pill key={p} tone="blue">{p}</Pill>)}</div>
              </div>
              <div><span className="text-[#6b7280]">薄弱点</span>
                <div className="mt-1 flex flex-wrap gap-1">{student.weak_points.map(p => <Pill key={p} tone="orange">{p}</Pill>)}</div>
              </div>
            </div>
          </ProtoCard>

          <ProtoCard>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#7c3aed]" />
                <h3 className="text-sm font-bold text-[#111827]">AI 诊断</h3>
              </div>
              <ProtoButton onClick={runDiagnosis} disabled={diagLoading} variant="secondary">
                {diagLoading ? '分析中...' : '诊断'}
              </ProtoButton>
            </div>
            <div className="min-h-[60px] rounded-[8px] bg-[#f9fafb] p-3 text-xs leading-6 text-[#374151]">
              {diagLoading ? '分析中...' : diagnosis || <span className="text-[#9ca3af]">点击诊断获取建议</span>}
            </div>
          </ProtoCard>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-4 overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-white shadow-md max-[700px]:grid-cols-2">
            {[
              { value: `${Math.round(student.quiz_accuracy*100)}%`, label: '正确率', color: 'bg-[#eff6ff] text-[#2563eb]', icon: <CheckCircle2 className="h-5 w-5" /> },
              { value: `${student.total_hours}h`, label: '学习时长', color: 'bg-[#fff7ed] text-[#d97706]', icon: <Clock className="h-5 w-5" /> },
              { value: `${student.streak_days}天`, label: '连续天数', color: 'bg-[#ecfdf5] text-[#059669]', icon: <Flame className="h-5 w-5" /> },
              { value: `${Math.round(student.task_completion*100)}%`, label: '完成率', color: 'bg-[#f3efff] text-[#7c3aed]', icon: <AlertTriangle className="h-5 w-5" /> },
            ].map((item, idx) => (
              <div key={item.label} className={`flex items-center gap-3 p-4 ${idx !== 3 ? 'border-r border-[#eef2f7]' : ''}`}>
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${item.color}`}>{item.icon}</div>
                <div><b className="block text-lg text-[#111827]">{item.value}</b><span className="text-xs text-[#6b7280]">{item.label}</span></div>
              </div>
            ))}
          </div>

          {weakEntries.length > 0 && (
            <ProtoCard>
              <h3 className="mb-3 text-sm font-bold text-[#111827]">⚠ 薄弱知识点</h3>
              <div className="space-y-2">
                {weakEntries.slice(0, 8).map(([kpId, score]) => (
                  <div key={kpId} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs text-[#6b7280]">{KP_NAMES[kpId] ?? kpId}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-[#e8eff8] h-2">
                      <div className={`h-full rounded-full ${score < 0.4 ? 'bg-[#dc2626]' : 'bg-[#f59e0b]'}`} style={{ width: `${score*100}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs font-bold">{Math.round(score*100)}%</span>
                  </div>
                ))}
              </div>
            </ProtoCard>
          )}

          <ProtoCard>
            <h3 className="mb-3 text-sm font-bold text-[#111827]">全部知识点掌握度</h3>
            <div className="space-y-1.5">
              {masteryEntries.map(([kpId, score]) => (
                <div key={kpId} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-[#6b7280]">{KP_NAMES[kpId] ?? kpId}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-[#e8eff8] h-1.5">
                    <div className={`h-full rounded-full ${score >= 0.8 ? 'bg-[#059669]' : score >= 0.5 ? 'bg-[#2563eb]' : 'bg-[#dc2626]'}`} style={{ width: `${score*100}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs font-bold">{Math.round(score*100)}%</span>
                </div>
              ))}
            </div>
          </ProtoCard>
        </div>
      </div>
    </div>
  )
}
