'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, Download, Filter, ShieldAlert } from 'lucide-react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

type AuditLevel = 'all' | 'info' | 'warning' | 'danger' | 'success'

const logs = [
  { time: '09:42:18', actor: '平台运营', action: '调整教师权限', target: 'Python 基础训练营 / 林老师', level: 'info' as const },
  { time: '09:21:03', actor: '系统', action: '知识库索引同步失败', target: 'Python 进阶知识库.xlsx', level: 'warning' as const },
  { time: '08:55:44', actor: '未知来源', action: '连续登录失败', target: 'admin', level: 'danger' as const },
  { time: '08:12:30', actor: '陈助教', action: '导出班级报告', target: 'AI 应用开发营', level: 'info' as const },
  { time: '07:48:10', actor: '系统', action: '资源生成队列恢复', target: 'resource-worker-02', level: 'success' as const },
]

export default function AdminAuditPage() {
  const [filterOpen, setFilterOpen] = useState(false)
  const [level, setLevel] = useState<AuditLevel>('all')
  const [message, setMessage] = useState('')

  const filtered = useMemo(() => logs.filter((item) => level === 'all' || item.level === level), [level])

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sparklearn-audit-${level}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage(`已导出 ${filtered.length} 条审计日志`)
  }

  return (
    <div>
      <PageHead
        eyebrow="平台管理 / 审计日志"
        title="审计日志"
        description="记录平台关键操作、异常登录、服务告警与数据导出行为，支持管理员追踪问题来源。"
        actions={
          <>
            <ProtoButton onClick={() => setFilterOpen((value) => !value)} variant="secondary"><Filter className="h-4 w-4" />筛选</ProtoButton>
            <ProtoButton onClick={exportLogs}><Download className="h-4 w-4" />导出日志</ProtoButton>
          </>
        }
        chips={[
          { value: String(logs.length), label: '今日日志', icon: <ClipboardList className="h-4 w-4" />, tone: 'blue' },
          { value: String(logs.filter((item) => item.level === 'danger').length), label: '安全风险', icon: <ShieldAlert className="h-4 w-4" />, tone: 'red' },
          { value: String(logs.filter((item) => item.level === 'warning').length), label: '服务告警', icon: <AlertTriangle className="h-4 w-4" />, tone: 'orange' },
        ]}
      />

      <div className="grid grid-cols-[1fr_320px] gap-5 max-[1100px]:grid-cols-1">
        <div className="space-y-5">
          {filterOpen && (
            <ProtoCard>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: '全部', value: 'all' },
                  { label: '普通', value: 'info' },
                  { label: '告警', value: 'warning' },
                  { label: '风险', value: 'danger' },
                  { label: '恢复', value: 'success' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setLevel(item.value as AuditLevel)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${
                      level === item.value ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627b] hover:bg-[#e5e7eb]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {message && <div className="mt-3 rounded-[8px] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#2563eb]">{message}</div>}
            </ProtoCard>
          )}

          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">实时事件流</h2>
              <Pill tone="blue">{filtered.length} 条</Pill>
            </div>
            <div className="space-y-2">
              {filtered.map((item) => {
                const tone = item.level === 'danger' ? 'red' : item.level === 'warning' ? 'orange' : item.level === 'success' ? 'green' : 'blue'
                return (
                  <SoftCard key={`${item.time}-${item.action}`} className="grid grid-cols-[86px_1fr_auto] items-center gap-3 bg-white max-[760px]:grid-cols-1">
                    <span className="text-xs font-bold text-[#64748b]">{item.time}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm text-[#0f172a]">{item.action}</b>
                        <Pill tone={tone}>{item.actor}</Pill>
                      </div>
                      <div className="mt-1 truncate text-xs text-[#64748b]">{item.target}</div>
                    </div>
                    <ProtoButton onClick={() => setMessage(`已定位事件：${item.action}`)} variant="tertiary">详情</ProtoButton>
                  </SoftCard>
                )
              })}
            </div>
          </ProtoCard>
        </div>

        <div className="space-y-5">
          <ProtoCard>
            <h2 className="mb-4 text-[18px] font-bold text-[#0f172a]">风险摘要</h2>
            <div className="space-y-3">
              {[
                { label: '异地登录失败', value: '2 次', tone: 'red' as const },
                { label: '数据导出', value: '5 次', tone: 'orange' as const },
                { label: '权限变更', value: '8 次', tone: 'blue' as const },
              ].map((item) => (
                <SoftCard key={item.label} className="flex items-center justify-between bg-white">
                  <span className="text-sm font-bold text-[#334155]">{item.label}</span>
                  <Pill tone={item.tone}>{item.value}</Pill>
                </SoftCard>
              ))}
            </div>
          </ProtoCard>

          <ProtoCard>
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#16a34a]" />
              <h2 className="text-[18px] font-bold text-[#0f172a]">审计策略</h2>
            </div>
            <p className="text-sm leading-7 text-[#64748b]">当前保留 180 天操作记录，管理员、教师导出、权限变更、登录失败均已纳入审计范围。</p>
          </ProtoCard>
        </div>
      </div>
    </div>
  )
}
