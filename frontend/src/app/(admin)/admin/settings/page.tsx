'use client'

import { useState } from 'react'
import { BellRing, Database, LockKeyhole, Save, ServerCog, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

const settings = [
  { title: '账号安全', desc: '管理员登录、密码策略、二次校验', icon: <LockKeyhole className="h-5 w-5" />, status: '已启用' },
  { title: '数据备份', desc: '学习记录、资源索引、用户画像快照', icon: <Database className="h-5 w-5" />, status: '每日 02:00' },
  { title: '服务监控', desc: '后端 API、AI 任务队列、资源生成器', icon: <ServerCog className="h-5 w-5" />, status: '在线' },
  { title: '通知策略', desc: '教师通知、系统告警、风险学生提醒', icon: <BellRing className="h-5 w-5" />, status: '正常' },
]

const policies = ['启用策略', '记录变更日志', '异常时通知管理员']

export default function AdminSettingsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {}
    settings.forEach((setting) => policies.forEach((policy) => { next[`${setting.title}-${policy}`] = true }))
    return next
  })
  const [message, setMessage] = useState('')

  const toggle = (key: string) => {
    setEnabled((map) => ({ ...map, [key]: !map[key] }))
    setMessage('')
  }

  const activeCount = Object.values(enabled).filter(Boolean).length

  return (
    <div>
      <PageHead
        eyebrow="平台管理 / 系统设置"
        title="系统设置"
        description="集中维护平台安全、备份、通知与服务阈值，保证教学端、学生端和大屏数据稳定运行。"
        actions={<ProtoButton onClick={() => setMessage('配置已保存到当前管理会话')}><Save className="h-4 w-4" />保存配置</ProtoButton>}
        chips={[
          { value: `${activeCount}/${settings.length * policies.length}`, label: '启用项', icon: <SlidersHorizontal className="h-4 w-4" />, tone: 'blue' },
          { value: '180 天', label: '日志留存', icon: <ShieldCheck className="h-4 w-4" />, tone: 'green' },
        ]}
      />

      {message && <div className="mb-5 rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm font-bold text-[#2563eb]">{message}</div>}

      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        {settings.map((item) => (
          <ProtoCard key={item.title}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eaf2ff] text-[#2563eb]">{item.icon}</div>
                <div>
                  <h2 className="text-[18px] font-bold text-[#0f172a]">{item.title}</h2>
                  <p className="mt-1 text-sm text-[#64748b]">{item.desc}</p>
                </div>
              </div>
              <Pill tone="green">{item.status}</Pill>
            </div>
            <div className="space-y-2">
              {policies.map((label) => {
                const key = `${item.title}-${label}`
                return (
                  <SoftCard key={label} className="flex items-center justify-between bg-white">
                    <span className="text-sm font-bold text-[#334155]">{label}</span>
                    <button
                      onClick={() => toggle(key)}
                      className={`h-5 w-9 rounded-full p-0.5 transition-colors ${enabled[key] ? 'bg-[#2563eb]' : 'bg-[#cbd5e1]'}`}
                      aria-pressed={enabled[key]}
                    >
                      <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${enabled[key] ? 'translate-x-4' : 'translate-x-0'}`} />
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
