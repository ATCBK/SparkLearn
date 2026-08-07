'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Cpu, Database, GraduationCap, ShieldCheck, UsersRound } from 'lucide-react'
import { api, type AdminDashboard } from '@/lib/api'
import { Bar, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

function riskTone(level: string): 'orange' | 'red' | 'green' | 'blue' {
  if (level === 'danger') return 'red'
  if (level === 'success') return 'green'
  if (level === 'warning') return 'orange'
  return 'blue'
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.getAdminDashboard()
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '管理总览加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cards = data?.cards || {}
  const risks = data?.risks || []
  const services = data?.services || []
  const tenants = data?.tenants || []

  return (
    <div>
      <PageHead
        eyebrow="平台管理 / 运行总览"
        title="管理工作台"
        description="统一查看平台真实用户、知识库、Tutor 对话、审核队列与安全事件。"
        actions={<Link href="/admin/audit" className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-white px-3.5 text-small font-bold text-blue ring-1 ring-[#bfdbfe] transition-colors hover:bg-blue-light">查看运营日志</Link>}
        chips={[
          { value: String(cards.total_users ?? 0), label: '注册用户', icon: <UsersRound className="h-4 w-4" />, tone: 'blue' },
          { value: String(cards.teacher_count ?? 0), label: '教师账号', icon: <GraduationCap className="h-4 w-4" />, tone: 'green' },
          { value: String(cards.knowledge_files ?? 0), label: '知识库文档', icon: <Database className="h-4 w-4" />, tone: 'cyan' },
          { value: String(risks.length), label: '待处理告警', icon: <AlertTriangle className="h-4 w-4" />, tone: 'orange' },
        ]}
      />

      {error && <div className="mb-5 rounded-[10px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}
      {loading && <ProtoCard className="mb-5 text-sm font-bold text-[#64748b]">正在加载真实平台数据...</ProtoCard>}

      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2">
          {[
            { label: '真实注册用户', value: cards.total_users ?? 0, sub: `冻结 ${cards.frozen_users ?? 0} 个`, icon: <Activity className="h-5 w-5" />, tone: 'bg-[#eaf2ff] text-[#2563eb]' },
            { label: 'Tutor 对话', value: cards.tutor_conversations ?? 0, sub: '来自 tutor_conversations', icon: <Cpu className="h-5 w-5" />, tone: 'bg-[#ecfdf5] text-[#059669]' },
            { label: '知识库文档', value: cards.knowledge_files ?? 0, sub: `已索引 ${cards.indexed_knowledge_files ?? 0}`, icon: <Database className="h-5 w-5" />, tone: 'bg-[#fff7ed] text-[#d97706]' },
            { label: '安全事件', value: cards.audit_logs_today ?? 0, sub: `待审帖子 ${cards.pending_posts ?? 0}`, icon: <ShieldCheck className="h-5 w-5" />, tone: 'bg-[#f3efff] text-[#7c3aed]' },
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

        <div className="grid grid-cols-[1.1fr_0.9fr] gap-5 max-[1100px]:grid-cols-1">
          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">核心服务状态</h2>
              <Pill tone="green">真实巡检</Pill>
            </div>
            <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
              {services.map((item) => (
                <SoftCard key={item.name} className="bg-white">
                  <div className="mb-3 flex items-center justify-between">
                    <b className="text-sm text-[#0f172a]">{item.name}</b>
                    <Pill tone={item.health >= 90 ? 'green' : item.health >= 75 ? 'orange' : 'red'}>{item.status}</Pill>
                  </div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[#64748b]">健康度</span>
                    <span className="font-bold text-[#111827]">{item.health}%</span>
                  </div>
                  <Bar value={item.health} tone={item.health >= 90 ? 'green' : 'orange'} />
                </SoftCard>
              ))}
            </div>
          </ProtoCard>

          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">待处理告警</h2>
              <ProtoButton href="/admin/audit" variant="tertiary">查看日志</ProtoButton>
            </div>
            <div className="space-y-2">
              {risks.length === 0 ? (
                <SoftCard className="bg-white text-sm font-bold text-[#16a34a]">暂无待处理风险</SoftCard>
              ) : risks.map((risk) => (
                <SoftCard key={risk.label} className="grid grid-cols-[auto_1fr] items-start gap-3 bg-white">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#fff7ed] text-[#d97706]">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <Pill tone={riskTone(risk.level)}>{risk.type}</Pill>
                    <div className="mt-2 text-sm font-bold text-[#0f172a]">{risk.label}</div>
                  </div>
                </SoftCard>
              ))}
            </div>
          </ProtoCard>
        </div>

        <ProtoCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#0f172a]">真实用户分组概览</h2>
            <ProtoButton href="/admin/users" variant="secondary">管理账号</ProtoButton>
          </div>
          <div className="overflow-hidden rounded-[10px] border border-[#eef2f7]">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#f8fafc] text-left text-xs text-[#64748b]">
                <tr><th className="px-4 py-3 font-bold">项目/专业</th><th className="px-4 py-3 font-bold">学生数</th><th className="px-4 py-3 font-bold">教师管理员</th><th className="px-4 py-3 font-bold">运行健康度</th><th className="px-4 py-3 font-bold">状态</th></tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f7] bg-white">
                {tenants.map((item) => (
                  <tr key={item.name}>
                    <td className="px-4 py-3 font-bold text-[#0f172a]">{item.name}</td>
                    <td className="px-4 py-3 text-[#52627b]">{item.students}</td>
                    <td className="px-4 py-3 text-[#52627b]">{item.teachers}</td>
                    <td className="px-4 py-3"><div className="flex max-w-[220px] items-center gap-3"><div className="flex-1"><Bar value={item.health} /></div><span className="text-xs font-bold text-[#2563eb]">{item.health}%</span></div></td>
                    <td className="px-4 py-3"><Pill tone={item.health >= 80 ? 'green' : 'orange'}><CheckCircle2 className="h-3.5 w-3.5" />{item.health >= 80 ? '正常' : '需关注'}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ProtoCard>
      </div>
    </div>
  )
}
