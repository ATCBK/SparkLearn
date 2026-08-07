'use client'

import { useEffect, useMemo, useState } from 'react'
import { BellRing, Database, LockKeyhole, Save, ServerCog, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { api } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

const groups = [
  { id: 'account_security', title: '账号安全', desc: '管理员登录、密码策略、二次校验', icon: <LockKeyhole className="h-5 w-5" /> },
  { id: 'data_backup', title: '数据备份', desc: '学习记录、资源索引、用户画像快照', icon: <Database className="h-5 w-5" /> },
  { id: 'service_monitor', title: '服务监控', desc: '后端 API、AI 任务队列、资源生成器', icon: <ServerCog className="h-5 w-5" /> },
  { id: 'notification_policy', title: '通知策略', desc: '教师通知、系统告警、风险学生提醒', icon: <BellRing className="h-5 w-5" /> },
]

const policies = [
  { id: 'enabled', label: '启用策略' },
  { id: 'audit', label: '记录变更日志' },
  { id: 'notify', label: '异常时通知管理员' },
]

export default function AdminSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.getAdminSettings()
      .then((data) => {
        if (!cancelled) setValues(data.settings)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '系统设置加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activeCount = useMemo(() => Object.entries(values).filter(([key, value]) => key.endsWith('.enabled') && value === 'true').length, [values])

  function toggle(key: string) {
    setValues((current) => ({ ...current, [key]: current[key] === 'true' ? 'false' : 'true' }))
    setMessage('')
  }

  async function saveSettings() {
    setSaving(true)
    setError('')
    try {
      const result = await api.saveAdminSettings(values)
      setValues(result.settings)
      setMessage('配置已保存到后端 admin_settings，并写入审计日志')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="平台管理 / 系统设置"
        title="系统设置"
        description="集中维护平台安全、备份、通知与服务阈值，配置保存后对真实管理策略生效。"
        actions={<ProtoButton disabled={saving || loading} onClick={() => void saveSettings()}><Save className="h-4 w-4" />保存配置</ProtoButton>}
        chips={[
          { value: `${activeCount}/${groups.length}`, label: '启用策略', icon: <SlidersHorizontal className="h-4 w-4" />, tone: 'blue' },
          { value: `${values.audit_retention_days || '180'} 天`, label: '日志留存', icon: <ShieldCheck className="h-4 w-4" />, tone: 'green' },
        ]}
      />

      {message && <div className="mb-5 rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm font-bold text-[#2563eb]">{message}</div>}
      {error && <div className="mb-5 rounded-[10px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}
      {loading && <ProtoCard className="mb-5 text-sm font-bold text-[#64748b]">正在加载后端配置...</ProtoCard>}

      <ProtoCard className="mb-5">
        <div className="grid grid-cols-[1fr_180px] items-center gap-3 max-[700px]:grid-cols-1">
          <div>
            <h2 className="text-[18px] font-bold text-[#0f172a]">审计日志留存</h2>
            <p className="mt-1 text-sm text-[#64748b]">该值写入后端设置表，供审计与运维策略读取。</p>
          </div>
          <input
            value={values.audit_retention_days || '180'}
            onChange={(event) => setValues((current) => ({ ...current, audit_retention_days: event.target.value.replace(/\D/g, '').slice(0, 4) || '0' }))}
            className="h-10 rounded-[8px] border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#2563eb]"
          />
        </div>
      </ProtoCard>

      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        {groups.map((item) => (
          <ProtoCard key={item.id}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eaf2ff] text-[#2563eb]">{item.icon}</div>
                <div>
                  <h2 className="text-[18px] font-bold text-[#0f172a]">{item.title}</h2>
                  <p className="mt-1 text-sm text-[#64748b]">{item.desc}</p>
                </div>
              </div>
              <Pill tone={values[`${item.id}.enabled`] === 'true' ? 'green' : 'orange'}>{values[`${item.id}.enabled`] === 'true' ? '已启用' : '已停用'}</Pill>
            </div>
            <div className="space-y-2">
              {policies.map((policy) => {
                const key = `${item.id}.${policy.id}`
                const enabled = values[key] === 'true'
                return (
                  <SoftCard key={policy.id} className="flex items-center justify-between bg-white">
                    <span className="text-sm font-bold text-[#334155]">{policy.label}</span>
                    <button onClick={() => toggle(key)} className={`h-5 w-9 rounded-full p-0.5 transition-colors ${enabled ? 'bg-[#2563eb]' : 'bg-[#cbd5e1]'}`} aria-pressed={enabled}>
                      <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </SoftCard>
                )
              })}
            </div>
          </ProtoCard>
        ))}
      </div>
    </div>
  )
}
