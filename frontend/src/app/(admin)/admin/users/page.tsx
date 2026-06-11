'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, KeyRound, Search, ShieldCheck, UserPlus, UsersRound, X } from 'lucide-react'
import { Bar, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

type Account = {
  name: string
  role: '学生' | '教师' | '教师管理员' | '运营管理员'
  tenant: string
  status: '启用' | '冻结'
  last: string
  auth: number
}

const initialAccounts: Account[] = [
  { name: '林老师', role: '教师管理员', tenant: 'Python 基础训练营', status: '启用', last: '10 分钟前', auth: 92 },
  { name: '陈助教', role: '教师', tenant: 'AI 应用开发营', status: '启用', last: '36 分钟前', auth: 76 },
  { name: '平台运营', role: '运营管理员', tenant: '全平台', status: '启用', last: '1 小时前', auth: 88 },
  { name: '测试账号 A', role: '学生', tenant: '校园创新实验班', status: '冻结', last: '3 天前', auth: 34 },
]

const filters = ['全部', '学生', '教师', '管理员', '已冻结'] as const

export default function AdminUsersPage() {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]>('全部')
  const [showCreate, setShowCreate] = useState(false)
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState({ name: '', role: '学生' as Account['role'], tenant: 'Python 基础训练营' })

  const filtered = useMemo(() => {
    return accounts.filter((item) => {
      const text = `${item.name}${item.role}${item.tenant}`
      const matchKeyword = !keyword.trim() || text.includes(keyword.trim())
      const matchFilter =
        filter === '全部' ||
        (filter === '管理员' && item.role.includes('管理员')) ||
        (filter === '已冻结' && item.status === '冻结') ||
        item.role === filter
      return matchKeyword && matchFilter
    })
  }, [accounts, filter, keyword])

  const addAccount = () => {
    if (!draft.name.trim()) {
      setMessage('请先填写账号姓名')
      return
    }
    setAccounts((list) => [
      { name: draft.name.trim(), role: draft.role, tenant: draft.tenant.trim() || '默认项目', status: '启用', last: '刚刚', auth: 60 },
      ...list,
    ])
    setShowCreate(false)
    setDraft({ name: '', role: '学生', tenant: 'Python 基础训练营' })
    setMessage('账号已创建，并进入默认权限策略')
  }

  const batchAuthorize = () => {
    const names = new Set(filtered.map((item) => item.name))
    setAccounts((list) => list.map((item) => (names.has(item.name) ? { ...item, auth: Math.max(item.auth, 90) } : item)))
    setMessage(`已为当前筛选的 ${filtered.length} 个账号补齐基础权限`)
  }

  const toggleStatus = (target: Account) => {
    setAccounts((list) => list.map((item) => (item.name === target.name ? { ...item, status: item.status === '启用' ? '冻结' : '启用' } : item)))
    setMessage(`${target.name} 已${target.status === '启用' ? '冻结' : '启用'}`)
  }

  return (
    <div>
      <PageHead
        eyebrow="平台管理 / 用户与权限"
        title="用户与权限"
        description="管理学生、教师、运营管理员等账号，统一查看角色范围、登录状态与权限完整度。"
        actions={<ProtoButton onClick={() => setShowCreate(true)}><UserPlus className="h-4 w-4" />新增账号</ProtoButton>}
        chips={[
          { value: String(accounts.length), label: '总账号', icon: <UsersRound className="h-4 w-4" />, tone: 'blue' },
          { value: String(accounts.filter((item) => item.role.includes('管理员')).length), label: '管理员', icon: <ShieldCheck className="h-4 w-4" />, tone: 'purple' },
          { value: String(accounts.filter((item) => item.status === '冻结').length), label: '冻结账号', icon: <KeyRound className="h-4 w-4" />, tone: 'orange' },
        ]}
      />

      <div className="space-y-5">
        <ProtoCard>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索姓名、角色或所属项目"
                className="h-9 w-full rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] pl-9 pr-3 text-sm outline-none focus:border-[#2563eb]"
              />
            </div>
            {filters.map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  filter === item ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627b] hover:bg-[#e5e7eb]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {message && <div className="mt-3 rounded-[8px] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#2563eb]">{message}</div>}
        </ProtoCard>

        {showCreate && (
          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">新增账号</h2>
              <button onClick={() => setShowCreate(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[#64748b] hover:bg-[#f3f4f6]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-1">
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="姓名" className="h-10 rounded-[8px] border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#2563eb]" />
              <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Account['role'] })} className="h-10 rounded-[8px] border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#2563eb]">
                <option value="学生">学生</option>
                <option value="教师">教师</option>
                <option value="教师管理员">教师管理员</option>
                <option value="运营管理员">运营管理员</option>
              </select>
              <input value={draft.tenant} onChange={(event) => setDraft({ ...draft, tenant: event.target.value })} placeholder="所属项目" className="h-10 rounded-[8px] border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#2563eb]" />
              <ProtoButton onClick={addAccount}>确认创建</ProtoButton>
            </div>
          </ProtoCard>
        )}

        <div className="grid grid-cols-[0.72fr_1.28fr] gap-5 max-[1100px]:grid-cols-1">
          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">角色分布</h2>
              <Pill tone="blue">RBAC</Pill>
            </div>
            <div className="space-y-4">
              {[
                { label: '学生', value: Math.round((accounts.filter((item) => item.role === '学生').length / accounts.length) * 100), count: accounts.filter((item) => item.role === '学生').length },
                { label: '教师', value: Math.round((accounts.filter((item) => item.role.includes('教师')).length / accounts.length) * 100), count: accounts.filter((item) => item.role.includes('教师')).length },
                { label: '管理员', value: Math.round((accounts.filter((item) => item.role.includes('管理员')).length / accounts.length) * 100), count: accounts.filter((item) => item.role.includes('管理员')).length },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-[#52627b]">{item.label}</span>
                    <span className="text-[#2563eb]">{item.count} 个</span>
                  </div>
                  <Bar value={item.value} />
                </div>
              ))}
            </div>
          </ProtoCard>

          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">账号列表</h2>
              <ProtoButton onClick={batchAuthorize} variant="secondary">批量授权</ProtoButton>
            </div>
            <div className="space-y-2">
              {filtered.map((item) => (
                <SoftCard key={item.name} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 bg-white max-[760px]:grid-cols-[auto_1fr]">
                  <div className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white ${item.status === '冻结' ? 'bg-[#94a3b8]' : 'bg-[#2563eb]'}`}>
                    {item.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-sm text-[#0f172a]">{item.name}</b>
                      <Pill tone={item.status === '冻结' ? 'orange' : 'green'}>{item.status}</Pill>
                      <span className="text-xs text-[#94a3b8]">最近登录：{item.last}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-[#64748b]">{item.role} · {item.tenant}</div>
                  </div>
                  <div className="w-[170px] max-[760px]:hidden">
                    <div className="mb-1 flex justify-between text-[11px] text-[#64748b]">
                      <span>权限完整度</span>
                      <span>{item.auth}%</span>
                    </div>
                    <Bar value={item.auth} tone={item.auth < 50 ? 'orange' : 'blue'} />
                  </div>
                  <ProtoButton onClick={() => toggleStatus(item)} variant="tertiary">{item.status === '启用' ? '冻结' : '启用'}</ProtoButton>
                </SoftCard>
              ))}
            </div>
          </ProtoCard>
        </div>

        <ProtoCard>
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#16a34a]" />
            <h2 className="text-[18px] font-bold text-[#0f172a]">权限策略建议</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
            {['开启管理员二次校验', '冻结 30 天未登录测试账号', '为教师端细分班级数据范围'].map((item) => (
              <SoftCard key={item} className="bg-[#f8fafc] text-sm font-bold text-[#334155]">{item}</SoftCard>
            ))}
          </div>
        </ProtoCard>
      </div>
    </div>
  )
}
