'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, Download, Filter, ShieldAlert } from 'lucide-react'
import { api, type AdminAuditLog } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

type AuditLevel = 'all' | AdminAuditLog['level']

function levelTone(level: AdminAuditLog['level']): 'blue' | 'orange' | 'red' | 'green' {
  if (level === 'danger') return 'red'
  if (level === 'warning') return 'orange'
  if (level === 'success') return 'green'
  return 'blue'
}

export default function AdminAuditPage() {
  const [filterOpen, setFilterOpen] = useState(false)
  const [level, setLevel] = useState<AuditLevel>('all')
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [stats, setStats] = useState({ info: 0, warning: 0, danger: 0, success: 0 })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getAdminAudit(level)
      setLogs(data.items)
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : '审计日志加载失败')
    } finally {
      setLoading(false)
    }
  }, [level])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const riskCount = useMemo(() => stats.danger + stats.warning, [stats])

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sparklearn-audit-${level}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage(`已导出 ${logs.length} 条审计日志`)
  }

  return (
    <div>
      <PageHead
        eyebrow="平台管理 / 审计日志"
        title="审计日志"
        description="记录真实管理员登录、用户权限变更、账号冻结、系统设置和内容审核操作。"
        actions={<><ProtoButton onClick={() => setFilterOpen((value) => !value)} variant="secondary"><Filter className="h-4 w-4" />筛选</ProtoButton><ProtoButton onClick={exportLogs}><Download className="h-4 w-4" />导出日志</ProtoButton></>}
        chips={[
          { value: String(logs.length), label: '当前日志', icon: <ClipboardList className="h-4 w-4" />, tone: 'blue' },
          { value: String(stats.danger), label: '安全风险', icon: <ShieldAlert className="h-4 w-4" />, tone: 'red' },
          { value: String(stats.warning), label: '服务告警', icon: <AlertTriangle className="h-4 w-4" />, tone: 'orange' },
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
                  { label: '成功', value: 'success' },
                ].map((item) => (
                  <button key={item.value} onClick={() => setLevel(item.value as AuditLevel)} className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${level === item.value ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627b] hover:bg-[#e5e7eb]'}`}>{item.label}</button>
                ))}
                <ProtoButton onClick={() => void loadLogs()} variant="secondary">刷新</ProtoButton>
              </div>
              {message && <div className="mt-3 rounded-[8px] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#2563eb]">{message}</div>}
              {error && <div className="mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</div>}
            </ProtoCard>
          )}

          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">实时事件流</h2>
              <Pill tone="blue">{logs.length} 条</Pill>
            </div>
            {loading ? (
              <SoftCard className="text-sm text-[#64748b]">正在加载真实审计日志...</SoftCard>
            ) : logs.length === 0 ? (
              <SoftCard className="text-sm text-[#64748b]">当前筛选条件下暂无审计日志。</SoftCard>
            ) : (
              <div className="space-y-2">
                {logs.map((item) => (
                  <SoftCard key={item.id} className="grid grid-cols-[170px_1fr_auto] items-center gap-3 bg-white max-[760px]:grid-cols-1">
                    <span className="text-xs font-bold text-[#64748b]">{item.created_at}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm text-[#0f172a]">{item.action}</b>
                        <Pill tone={levelTone(item.level)}>{item.actor}</Pill>
                      </div>
                      <div className="mt-1 truncate text-xs text-[#64748b]">{item.target_label || item.target}</div>
                    </div>
                    <ProtoButton onClick={() => setMessage(`已定位事件：${item.action}`)} variant="tertiary">详情</ProtoButton>
                  </SoftCard>
                ))}
              </div>
            )}
          </ProtoCard>
        </div>

        <div className="space-y-5">
          <ProtoCard>
            <h2 className="mb-4 text-[18px] font-bold text-[#0f172a]">风险摘要</h2>
            <div className="space-y-3">
              {[
                { label: '风险事件', value: `${stats.danger} 次`, tone: 'red' as const },
                { label: '告警事件', value: `${stats.warning} 次`, tone: 'orange' as const },
                { label: '成功操作', value: `${stats.success} 次`, tone: 'green' as const },
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
            <p className="text-sm leading-7 text-[#64748b]">当前风险事件 {riskCount} 条。管理员登录、用户冻结、批量授权、系统设置、帖子审核均写入后端审计表。</p>
          </ProtoCard>
        </div>
      </div>
    </div>
  )
}
