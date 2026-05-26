'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Circle, Database, Paperclip, Plus, Puzzle, Sparkles, UserCog, Users } from 'lucide-react'
import { api, McpService, McpServicePayload } from '@/lib/api'

type TabKey = 'auth' | 'headers' | 'config'

const EMPTY_FORM: McpServicePayload = {
  name: '',
  description: '',
  transport: 'http',
  endpoint: '',
  command: 'npx',
  args_json: ['-y', '@modelcontextprotocol/server-filesystem', 'D:/Project_building/SparkLearn'],
  env_json: {},
  enabled: false,
  startup_timeout_ms: 60000,
  tool_timeout_ms: 30000,
  long_task_timeout_ms: 120000,
}

export default function TutorMcpStorePage() {
  const router = useRouter()
  const [services, setServices] = useState<McpService[]>([])
  const [form, setForm] = useState<McpServicePayload>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('auth')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  const stats = useMemo(() => {
    const online = services.filter((item) => item.last_status === 'online').length
    return { total: services.length, online }
  }, [services])

  useEffect(() => {
    void loadServices()
  }, [])

  async function loadServices() {
    setLoading(true)
    setError('')
    try {
      const list = await api.getMcpServices('all')
      setServices(list)
      if (!activeServiceId && list[0]) setActiveServiceId(list[0].id)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '加载服务失败')
    } finally {
      setLoading(false)
    }
  }

  function loadServiceToForm(service: McpService) {
    setEditingId(service.id)
    setActiveServiceId(service.id)
    setForm({
      name: service.name,
      description: service.description,
      transport: service.transport,
      endpoint: service.endpoint,
      command: service.command,
      args_json: service.args_json,
      env_json: service.env_json,
      enabled: service.enabled,
      startup_timeout_ms: service.startup_timeout_ms,
      tool_timeout_ms: service.tool_timeout_ms,
      long_task_timeout_ms: service.long_task_timeout_ms,
    })
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setFeedback('')
    setError('')
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setFeedback('')
    try {
      if (editingId) {
        await api.updateMcpService(editingId, form)
        setFeedback('服务配置已更新')
      } else {
        const created = await api.createMcpService(form)
        setActiveServiceId(created.id)
        setEditingId(created.id)
        setFeedback('服务创建成功')
      }
      await loadServices()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '保存失败')
    }
  }

  async function testService(serviceId: string) {
    setBusyId(serviceId)
    setError('')
    setFeedback('')
    try {
      const result = await api.testMcpService(serviceId)
      setFeedback(result.ok ? `连接成功，发现 ${result.tool_count} 个工具` : `连接失败：${result.error}`)
      await loadServices()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '测试失败')
    } finally {
      setBusyId('')
    }
  }

  async function toggleService(service: McpService) {
    setBusyId(service.id)
    setError('')
    try {
      await api.toggleMcpService(service.id, !service.enabled)
      await loadServices()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '切换状态失败')
    } finally {
      setBusyId('')
    }
  }

  async function removeService(service: McpService) {
    if (!confirm(`确认删除 ${service.name} 吗？`)) return
    setBusyId(service.id)
    setError('')
    try {
      await api.deleteMcpService(service.id)
      if (activeServiceId === service.id) {
        setActiveServiceId(null)
        resetForm()
      }
      await loadServices()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '删除失败')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="h-screen flex bg-[#f4f6fb]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <nav className="w-[200px] shrink-0 bg-[#f0f4ff] border-r border-[#e2e8f0] flex flex-col">
        <div className="p-3 border-b border-[#e2e8f0]"><div className="flex items-center gap-2.5"><img src="/sparklearn-logo-official.png" alt="" className="h-8 w-8 object-contain" /><div><div className="text-xs font-bold text-[#1e293b]">学而思 SparkLearn</div><div className="text-[10px] text-[#94a3b8]">个性化学习闭环</div></div></div></div>
        <div className="p-3"><button onClick={() => router.push('/tutor')} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold"><Plus className="w-4 h-4" /> 新建对话</button></div>
        <div className="px-3 space-y-0.5 flex-1">
          <button onClick={() => router.push('/tutor')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white text-sm"><Sparkles className="w-4 h-4" /> 学习空间</button>
          <button onClick={() => router.push('/tutor/roles')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white text-sm"><UserCog className="w-4 h-4" /> 角色工坊</button>
          <button onClick={() => router.push('/tutor/workshop')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white text-sm"><Users className="w-4 h-4" /> 研讨会</button>
          <div className="my-3 border-t border-[#e2e8f0]" />
          <button onClick={() => router.push('/tutor/knowledge')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white text-sm"><Database className="w-4 h-4" /> 知识库</button>
          <button onClick={() => router.push('/tutor/files')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white text-sm"><Paperclip className="w-4 h-4" /> 我的文件</button>
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-medium"><Puzzle className="w-4 h-4" /> MCP 插件商店</div>
        </div>
        <div className="p-3 border-t border-[#e2e8f0]"><button onClick={() => router.push('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white text-sm"><ArrowLeft className="w-4 h-4" /> 返回主平台</button></div>
      </nav>

      <main className="flex-1 p-6 overflow-hidden">
        <div className="h-full grid grid-cols-[360px_1fr] gap-5 max-[1200px]:grid-cols-1">
          <section className="rounded-2xl border border-[#dbe3f0] bg-white shadow-sm flex flex-col min-h-0">
            <div className="px-5 py-4 border-b border-[#eef2f7] flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#111827]">已添加 MCP 服务</h2>
                <p className="text-xs text-[#6b7280] mt-1">共 {stats.total} 个，在线 {stats.online} 个</p>
              </div>
              <button onClick={resetForm} className="text-xs rounded-lg border border-[#d7deea] px-2.5 py-1">新增</button>
            </div>
            <div className="p-3 overflow-y-auto space-y-2">
              {loading ? <p className="text-sm text-[#6b7280] px-2">加载中...</p> : null}
              {!services.length && !loading ? <p className="text-sm text-[#94a3b8] px-2 py-4">暂无 MCP 服务，先在右侧创建一个。</p> : null}
              {services.map((service) => {
                const active = activeServiceId === service.id
                return (
                  <button key={service.id} onClick={() => loadServiceToForm(service)} className={`w-full text-left rounded-xl border px-3 py-3 transition ${active ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[#e5e7eb] bg-white hover:border-[#c7d2fe]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm text-[#111827] truncate">{service.name}</div>
                      <div className="text-xs">{service.last_status === 'online' ? <CheckCircle2 className="w-4 h-4 text-[#16a34a]" /> : <Circle className="w-4 h-4 text-[#9ca3af]" />}</div>
                    </div>
                    <div className="text-xs text-[#64748b] mt-1">{service.transport.toUpperCase()} · {service.enabled ? '已启用' : '未启用'}</div>
                    {service.last_error ? <div className="text-xs text-[#b91c1c] mt-1 truncate">{service.last_error}</div> : null}
                    <div className="mt-3 flex gap-2">
                      <span onClick={(e) => { e.stopPropagation(); void testService(service.id) }} className="text-[11px] px-2 py-1 rounded-md bg-[#eef2ff] text-[#3730a3]">测试</span>
                      <span onClick={(e) => { e.stopPropagation(); void toggleService(service) }} className="text-[11px] px-2 py-1 rounded-md bg-[#ecfdf5] text-[#166534]">{service.enabled ? '停用' : '启用'}</span>
                      <span onClick={(e) => { e.stopPropagation(); void removeService(service) }} className="text-[11px] px-2 py-1 rounded-md bg-[#fef2f2] text-[#991b1b]">删除</span>
                      {busyId === service.id ? <span className="text-[11px] text-[#64748b]">处理中...</span> : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[#dbe3f0] bg-white shadow-sm overflow-y-auto">
            <form onSubmit={submitForm} className="p-7 space-y-5">
              <div className="flex items-center justify-between">
                <h1 className="text-[34px] leading-none font-bold text-[#111827]">添加 MCP 服务 ({form.transport.toUpperCase()})</h1>
                <button type="button" onClick={resetForm} className="text-[#64748b] text-2xl leading-none px-2">×</button>
              </div>

              <Field label="服务端点 URL">
                <input value={form.endpoint || ''} onChange={(e) => setForm((p) => ({ ...p, endpoint: e.target.value }))} placeholder="服务端点 URL" className="w-full h-12 rounded-xl bg-[#f1f4f9] px-4 text-[18px] text-[#334155] outline-none" required={form.transport === 'http'} />
              </Field>

              <div className="grid grid-cols-[1fr_110px] gap-4 items-end">
                <Field label="名称和图标">
                  <input value={form.name || ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="命名你的 MCP 服务" className="w-full h-12 rounded-xl bg-[#f1f4f9] px-4 text-[18px] text-[#334155] outline-none" required />
                </Field>
                <div className="h-12 rounded-2xl bg-[#5b5ee6] text-white flex items-center justify-center"><Puzzle className="w-6 h-6" /></div>
              </div>

              <Field label="服务器标识符">
                <input value={form.description || ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="服务唯一标识，例如 my-mcp-server" className="w-full h-12 rounded-xl bg-[#f1f4f9] px-4 text-[18px] text-[#334155] outline-none" />
                <p className="text-xs text-[#64748b] mt-2">本版本将“标识符”映射到描述字段，后续可扩展为独立字段。</p>
              </Field>

              <div className="rounded-xl bg-[#f1f4f9] p-1 grid grid-cols-3 gap-1">
                {([
                  ['auth', '认证'],
                  ['headers', '请求头'],
                  ['config', '配置'],
                ] as Array<[TabKey, string]>).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setActiveTab(key)} className={`h-11 rounded-lg text-lg font-semibold ${activeTab === key ? 'bg-white text-[#2563eb]' : 'text-[#667085]'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'auth' ? (
                <div className="space-y-4">
                  <label className="flex items-center gap-3 text-[30px] text-[#334155]"><input type="checkbox" className="w-5 h-5" /> 使用动态客户端注册</label>
                  <Field label="客户端 ID"><input className="w-full h-12 rounded-xl bg-[#f1f4f9] px-4 text-[18px]" placeholder="客户端 ID" /></Field>
                  <Field label="客户端密钥"><input className="w-full h-12 rounded-xl bg-[#f1f4f9] px-4 text-[18px]" placeholder="客户端密钥" /></Field>
                </div>
              ) : null}

              {activeTab === 'headers' ? (
                <div className="space-y-4">
                  <Field label="传输类型">
                    <select value={form.transport} onChange={(e) => setForm((p) => ({ ...p, transport: e.target.value as 'http' | 'stdio' }))} className="w-full h-12 rounded-xl bg-[#f1f4f9] px-4 text-[18px]">
                      <option value="http">HTTP</option>
                      <option value="stdio">STDIO</option>
                    </select>
                  </Field>
                  <p className="text-sm text-[#64748b]">请求头字段本版本先保留 UI，后续可接入后端持久化。</p>
                </div>
              ) : null}

              {activeTab === 'config' ? (
                <div className="space-y-4">
                  <Field label="Command（stdio）"><input value={form.command || ''} onChange={(e) => setForm((p) => ({ ...p, command: e.target.value }))} className="w-full h-12 rounded-xl bg-[#f1f4f9] px-4 text-[18px]" /></Field>
                  <Field label="Args（JSON 数组）"><textarea value={JSON.stringify(form.args_json || [])} onChange={(e) => setForm((p) => ({ ...p, args_json: parseArray(e.target.value) }))} className="w-full min-h-[96px] rounded-xl bg-[#f1f4f9] px-4 py-3 text-[16px]" /></Field>
                  <Field label="Env（JSON 对象）"><textarea value={JSON.stringify(form.env_json || {})} onChange={(e) => setForm((p) => ({ ...p, env_json: parseObject(e.target.value) }))} className="w-full min-h-[96px] rounded-xl bg-[#f1f4f9] px-4 py-3 text-[16px]" /></Field>
                </div>
              ) : null}

              {error ? <p className="rounded-lg bg-[#fef2f2] p-3 text-sm text-[#b91c1c]">{error}</p> : null}
              {feedback ? <p className="rounded-lg bg-[#ecfdf5] p-3 text-sm text-[#166534]">{feedback}</p> : null}

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={resetForm} className="h-14 px-8 rounded-2xl border border-[#d6dbe7] text-[32px] text-[#475569]">取消</button>
                <button type="submit" className="h-14 px-10 rounded-2xl bg-[#c9d7fa] text-[32px] text-white font-semibold">{editingId ? '更新并授权' : '添加并授权'}</button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[22px] text-[#334155] mb-2">{label}</span>
      {children}
    </label>
  )
}

function parseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item))
  } catch {
    return []
  }
}

function parseObject(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {}
    return Object.fromEntries(Object.entries(parsed).map(([key, val]) => [key, String(val)]))
  } catch {
    return {}
  }
}
