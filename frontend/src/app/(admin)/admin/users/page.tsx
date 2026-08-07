'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, KeyRound, Search, ShieldCheck, UserPlus, UsersRound, X } from 'lucide-react'
import { api, type AdminUser } from '@/lib/api'
import { Bar, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

const filters = [
  { label: '全部', value: 'all' },
  { label: '学生', value: 'student' },
  { label: '管理员', value: 'admin' },
  { label: '已冻结', value: 'frozen' },
] as const

const adminRoles = [
  { label: '学生', value: '' },
  { label: '教师管理员', value: 'teacher_admin' },
  { label: '运营管理员', value: 'ops_admin' },
  { label: '超级管理员', value: 'super_admin' },
] as const

export default function AdminUsersPage() {
  const [accounts, setAccounts] = useState<AdminUser[]>([])
  const [stats, setStats] = useState({ total: 0, admins: 0, frozen: 0, students: 0 })
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [draft, setDraft] = useState({ name: '', phone: '', major: '', admin_role: '' })

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getAdminUsers({ q: keyword, role: filter })
      setAccounts(data.items)
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : '用户列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [filter, keyword])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const roleDistribution = useMemo(() => {
    const total = Math.max(accounts.length, 1)
    const teachers = accounts.filter((item) => item.admin_role === 'teacher_admin').length
    const admins = accounts.filter((item) => item.admin_role).length
    const students = accounts.filter((item) => !item.admin_role).length
    return [
      { label: '学生', value: Math.round((students / total) * 100), count: students },
      { label: '教师管理员', value: Math.round((teachers / total) * 100), count: teachers },
      { label: '管理员', value: Math.round((admins / total) * 100), count: admins },
    ]
  }, [accounts])

  async function addAccount() {
    if (!draft.name.trim()) {
      setMessage('请先填写账号姓名')
      return
    }
    setError('')
    try {
      await api.createAdminUser({
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        major: draft.major.trim(),
        admin_role: draft.admin_role,
      })
      setShowCreate(false)
      setDraft({ name: '', phone: '', major: '', admin_role: '' })
      setMessage('账号已创建，并写入真实用户表')
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建账号失败')
    }
  }

  async function batchAuthorize() {
    const ids = accounts.map((item) => item.user_id)
    if (ids.length === 0) return
    setError('')
    try {
      const result = await api.batchAuthorizeAdminUsers({ user_ids: ids, admin_role: 'teacher_admin', permission_score: 90 })
      setMessage(`已为当前筛选的 ${result.updated} 个账号写入教师管理员权限`)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量授权失败')
    }
  }

  async function toggleStatus(target: AdminUser) {
    setBusyId(target.user_id)
    setError('')
    const nextStatus = target.account_status === 'active' ? 'frozen' : 'active'
    try {
      await api.updateAdminUser(target.user_id, { account_status: nextStatus })
      setMessage(`${target.name} 已${nextStatus === 'frozen' ? '冻结' : '启用'}，平台登录与接口访问会立即受影响`)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新账号状态失败')
    } finally {
      setBusyId('')
    }
  }

  async function changeRole(target: AdminUser, adminRole: string) {
    setBusyId(target.user_id)
    setError('')
    try {
      await api.updateAdminUser(target.user_id, { admin_role: adminRole, permission_score: adminRole ? Math.max(target.permission_score, 90) : 60 })
      setMessage(`${target.name} 的权限已更新`)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新权限失败')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="平台管理 / 用户与权限"
        title="用户与权限"
        description="直接管理真实用户表中的账号状态、管理员角色和权限完整度。"
        actions={<ProtoButton onClick={() => setShowCreate(true)}><UserPlus className="h-4 w-4" />新增账号</ProtoButton>}
        chips={[
          { value: String(stats.total), label: '总账号', icon: <UsersRound className="h-4 w-4" />, tone: 'blue' },
          { value: String(stats.admins), label: '管理员', icon: <ShieldCheck className="h-4 w-4" />, tone: 'purple' },
          { value: String(stats.frozen), label: '冻结账号', icon: <KeyRound className="h-4 w-4" />, tone: 'orange' },
        ]}
      />

      <div className="space-y-5">
        <ProtoCard>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索姓名、手机号、邮箱或项目" className="h-9 w-full rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] pl-9 pr-3 text-sm outline-none focus:border-[#2563eb]" />
            </div>
            {filters.map((item) => (
              <button key={item.value} onClick={() => setFilter(item.value)} className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${filter === item.value ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627b] hover:bg-[#e5e7eb]'}`}>
                {item.label}
              </button>
            ))}
            <ProtoButton onClick={() => void loadUsers()} variant="secondary">刷新</ProtoButton>
          </div>
          {message && <div className="mt-3 rounded-[8px] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#2563eb]">{message}</div>}
          {error && <div className="mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</div>}
        </ProtoCard>

        {showCreate && (
          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">新增真实账号</h2>
              <button onClick={() => setShowCreate(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[#64748b] hover:bg-[#f3f4f6]"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-5 gap-3 max-[1100px]:grid-cols-1">
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="姓名" className="h-10 rounded-[8px] border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#2563eb]" />
              <input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="手机号，可为空" className="h-10 rounded-[8px] border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#2563eb]" />
              <input value={draft.major} onChange={(event) => setDraft({ ...draft, major: event.target.value })} placeholder="项目/专业" className="h-10 rounded-[8px] border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#2563eb]" />
              <select value={draft.admin_role} onChange={(event) => setDraft({ ...draft, admin_role: event.target.value })} className="h-10 rounded-[8px] border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#2563eb]">
                {adminRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <ProtoButton onClick={() => void addAccount()}>确认创建</ProtoButton>
            </div>
          </ProtoCard>
        )}

        <div className="grid grid-cols-[0.72fr_1.28fr] gap-5 max-[1100px]:grid-cols-1">
          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">角色分布</h2>
              <Pill tone="blue">真实 RBAC</Pill>
            </div>
            <div className="space-y-4">
              {roleDistribution.map((item) => (
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
              <ProtoButton onClick={() => void batchAuthorize()} variant="secondary">批量授权</ProtoButton>
            </div>
            {loading ? (
              <SoftCard className="text-sm text-[#64748b]">正在加载真实账号...</SoftCard>
            ) : (
              <div className="space-y-2">
                {accounts.map((item) => (
                  <SoftCard key={item.user_id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 bg-white max-[900px]:grid-cols-[auto_1fr]">
                    <div className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white ${item.account_status === 'frozen' ? 'bg-[#94a3b8]' : 'bg-[#2563eb]'}`}>{item.name.slice(0, 1)}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm text-[#0f172a]">{item.name}</b>
                        <Pill tone={item.account_status === 'frozen' ? 'orange' : 'green'}>{item.status_label}</Pill>
                        <span className="text-xs text-[#94a3b8]">最近登录：{item.last_login_at || '暂无'}</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-[#64748b]">{item.role_label} · {item.major || item.email || item.phone || item.user_id}</div>
                    </div>
                    <select disabled={busyId === item.user_id} value={item.admin_role} onChange={(event) => void changeRole(item, event.target.value)} className="h-9 rounded-[8px] border border-[#e5e7eb] px-2 text-xs font-bold text-[#52627b] outline-none max-[900px]:hidden">
                      {adminRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                    <div className="w-[150px] max-[900px]:hidden">
                      <div className="mb-1 flex justify-between text-[11px] text-[#64748b]"><span>权限完整度</span><span>{item.permission_score}%</span></div>
                      <Bar value={item.permission_score} tone={item.permission_score < 50 ? 'orange' : 'blue'} />
                    </div>
                    <ProtoButton disabled={busyId === item.user_id} onClick={() => void toggleStatus(item)} variant="tertiary">{item.account_status === 'active' ? '冻结' : '启用'}</ProtoButton>
                  </SoftCard>
                ))}
              </div>
            )}
          </ProtoCard>
        </div>

        <ProtoCard>
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#16a34a]" />
            <h2 className="text-[18px] font-bold text-[#0f172a]">权限策略状态</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
            {['管理员接口强制鉴权', '冻结账号阻断登录与接口访问', '权限变更写入审计日志'].map((item) => (
              <SoftCard key={item} className="bg-[#f8fafc] text-sm font-bold text-[#334155]">{item}</SoftCard>
            ))}
          </div>
        </ProtoCard>
      </div>
    </div>
  )
}
