'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Database,
  FileText,
  Link2,
  Lock,
  Paperclip,
  Plus,
  Puzzle,
  Settings,
  Shield,
  Sparkles,
  UserCog,
  Users,
} from 'lucide-react'
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

const CONF_ITEMS: Record<TabKey, { label: string; icon: ReactNode }> = {
  auth: { label: '认证', icon: <Shield className="h-4 w-4" /> },
  headers: { label: '请求头', icon: <FileText className="h-4 w-4" /> },
  config: { label: '配置', icon: <Settings className="h-4 w-4" /> },
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

  const loadServices = useCallback(async () => {
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
  }, [activeServiceId])

  useEffect(() => {
    void loadServices()
  }, [loadServices])

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
    <div className="h-screen flex bg-[#f5f7fa]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <nav className="w-[200px] shrink-0 bg-[#f0f4ff] border-r border-[#e2e8f0] flex flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="p-3 border-b border-[#e2e8f0]"><div className="flex items-center gap-2.5"><img src="/sparklearn-logo-official.png" alt="" className="h-8 w-8 object-contain" /><div><div className="text-xs font-bold text-[#1e293b]">学而思 SparkLearn</div><div className="text-[10px] text-[#94a3b8]">个性化学习闭环</div></div></div></div>
        <div className="p-3">
          <button onClick={() => router.push('/tutor')} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> 新建对话
          </button>
        </div>
        <div className="px-3 space-y-0.5 flex-1">
          <button onClick={() => router.push('/tutor')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Sparkles className="w-4 h-4" /> 学习空间
          </button>
          <button onClick={() => router.push('/tutor/roles')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <UserCog className="w-4 h-4" /> 角色工坊
          </button>
          <button onClick={() => router.push('/tutor/workshop')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Users className="w-4 h-4" /> 研讨会
          </button>
          <div className="my-3 border-t border-[#e2e8f0]" />
          <button onClick={() => router.push('/tutor/knowledge')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Database className="w-4 h-4" /> 知识库
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-medium shadow-sm">
            <Puzzle className="w-4 h-4" /> MCP 插件商店
          </div>
          <button onClick={() => router.push('/tutor/files')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Paperclip className="w-4 h-4" /> 我的文件
          </button>
        </div>
        <div className="p-3 border-t border-[#e2e8f0] space-y-2">
          <button onClick={() => router.push('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回主平台
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-xs font-bold text-white">梁</div>
            <div><p className="text-sm font-medium text-[#1e293b]">梁明</p><p className="text-[11px] text-[#94a3b8]">学习平台</p></div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1460px] px-6 py-5">
            <div className="grid min-w-0 grid-cols-[320px_minmax(680px,1fr)_280px] gap-5 max-[1520px]:grid-cols-[320px_minmax(0,1fr)] max-[1200px]:grid-cols-1">
              <section className="rounded-2xl border border-[#e7ebf4] bg-white shadow-[0_10px_30px_rgba(31,41,55,0.04)] min-h-0 flex flex-col">
                <div className="p-5 border-b border-[#edf1f7]">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-[#111827]">MCP 服务</h2>
                    <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs text-[#3a63db] font-semibold">{stats.total} 个</span>
                  </div>
                  <p className="text-sm text-[#9aa4b7] mt-2">{services.length ? `在线 ${stats.online} 个，点击服务可编辑。` : '暂无 MCP 服务，先在右侧创建一个。'}</p>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-3 space-y-2">
                  {loading ? <p className="text-sm text-[#64748b] px-2">加载中...</p> : null}
                  {services.map((service) => {
                    const active = activeServiceId === service.id
                    return (
                      <button
                        key={service.id}
                        onClick={() => loadServiceToForm(service)}
                        className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-[#6f84f6] bg-[#f3f7ff]' : 'border-[#e8edf7] bg-white hover:border-[#ccd8ff]'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-medium text-[#0f172a]">{service.name}</div>
                          {service.last_status === 'online' ? <CheckCircle2 className="h-4 w-4 text-[#22c55e]" /> : <Circle className="h-4 w-4 text-[#a0aec0]" />}
                        </div>
                        <p className="text-xs text-[#7b869c] mt-1">{service.transport.toUpperCase()} · {service.enabled ? '已启用' : '未启用'}</p>
                        {service.last_error ? <p className="text-xs text-[#ef4444] mt-1 truncate">{service.last_error}</p> : null}
                        <div className="mt-3 flex items-center gap-2 text-[11px]">
                          <span onClick={(e) => { e.stopPropagation(); void testService(service.id) }} className="rounded-md bg-[#eaf0ff] px-2 py-1 text-[#3153db]">测试</span>
                          <span onClick={(e) => { e.stopPropagation(); void toggleService(service) }} className="rounded-md bg-[#ebfdf2] px-2 py-1 text-[#1a8f4a]">{service.enabled ? '停用' : '启用'}</span>
                          <span onClick={(e) => { e.stopPropagation(); void removeService(service) }} className="rounded-md bg-[#fff1f2] px-2 py-1 text-[#dc2626]">删除</span>
                          {busyId === service.id ? <span className="text-[#8792ab]">处理中...</span> : null}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-[#e7ebf4] bg-white shadow-[0_10px_30px_rgba(31,41,55,0.04)] min-h-0 flex flex-col overflow-hidden">
                <form id="mcp-service-form" onSubmit={submitForm} className="min-h-0 flex-1 overflow-auto p-6 pb-24">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="text-xs text-[#8d99ae] mb-2">MCP 服务管理 / 添加 MCP 服务 ({form.transport.toUpperCase()})</p>
                      <h1 className="text-3xl font-semibold text-[#111827]">添加 MCP 服务 ({form.transport.toUpperCase()})</h1>
                      <p className="text-sm text-[#7d889f] mt-2">通过 HTTP 协议连接外部 MCP 服务器</p>
                    </div>
                    <button type="button" onClick={() => router.push('/tutor/mcp-store/docs')} className="text-sm text-[#2563eb] whitespace-nowrap">查看文档</button>
                  </div>

                  <div className="mt-6 space-y-4">
                    <StepField index={1} title="服务端点 URL" required>
                      <input
                        value={form.endpoint || ''}
                        onChange={(e) => setForm((p) => ({ ...p, endpoint: e.target.value }))}
                        placeholder="https://example.com/mcp"
                        className="h-10 w-full rounded-lg border border-[#ced7ea] bg-white px-3 text-sm outline-none focus:border-[#5d78f5]"
                        required={form.transport === 'http'}
                      />
                      <p className="mt-2 text-xs text-[#8b96ab] inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> 支持 http:// 或 https:// 协议</p>
                    </StepField>

                    <StepField index={2} title="名称和图标" required>
                      <div className="grid grid-cols-[1fr_72px] gap-3">
                        <input
                          value={form.name || ''}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="例如：我的 MCP 服务"
                          className="h-10 w-full rounded-lg border border-[#ced7ea] bg-white px-3 text-sm outline-none focus:border-[#5d78f5]"
                          required
                        />
                        <button type="button" className="h-10 rounded-lg bg-gradient-to-r from-[#4c6bff] to-[#7055f8] text-white inline-flex items-center justify-center"><Link2 className="h-4 w-4" /></button>
                      </div>
                    </StepField>

                    <StepField index={3} title="服务器标识符" required>
                      <input
                        value={form.description || ''}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                        placeholder="例如：sparklearn-mcp-server"
                        className="h-10 w-full rounded-lg border border-[#ced7ea] bg-white px-3 text-sm outline-none focus:border-[#5d78f5]"
                      />
                      <p className="mt-2 text-xs text-[#8b96ab]">这是客户端连接到该服务时使用的唯一标识，请确保和服务端配置一致</p>
                    </StepField>
                  </div>

                  <div className="mt-6 border-b border-[#e8edf7] grid grid-cols-3">
                    {(Object.keys(CONF_ITEMS) as TabKey[]).map((key) => {
                      const active = activeTab === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveTab(key)}
                          className={`h-11 text-sm inline-flex items-center justify-center gap-1.5 border-b-2 ${active ? 'border-[#3563f6] text-[#2e56d6] font-semibold' : 'border-transparent text-[#7b869c]'}`}
                        >
                          {CONF_ITEMS[key].icon}
                          {CONF_ITEMS[key].label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="pt-4">
                    {activeTab === 'auth' ? (
                      <div className="rounded-xl border border-[#e8edf7] bg-[#fafcff] p-4 space-y-4">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-[#1e293b]">
                          <input type="checkbox" className="h-4 w-4 rounded border-[#c9d3ea]" defaultChecked />
                          使用动态客户端注册
                          <span className="rounded bg-[#e6eeff] px-1.5 py-0.5 text-[10px] text-[#3459db]">推荐</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3 max-[1280px]:grid-cols-1">
                          <PlainField label="客户端 ID"><input className="h-10 w-full rounded-lg border border-[#d5ddef] bg-white px-3 text-sm" placeholder="输入客户端 ID" /></PlainField>
                          <PlainField label="客户端密钥"><input className="h-10 w-full rounded-lg border border-[#d5ddef] bg-white px-3 text-sm" placeholder="输入客户端密钥" /></PlainField>
                        </div>
                      </div>
                    ) : null}

                    {activeTab === 'headers' ? (
                      <div className="rounded-xl border border-[#e8edf7] bg-[#fafcff] p-4 space-y-3">
                        <PlainField label="传输类型">
                          <select value={form.transport} onChange={(e) => setForm((p) => ({ ...p, transport: e.target.value as 'http' | 'stdio' }))} className="h-10 w-full rounded-lg border border-[#d5ddef] bg-white px-3 text-sm">
                            <option value="http">HTTP</option>
                            <option value="stdio">STDIO</option>
                          </select>
                        </PlainField>
                        <p className="text-xs text-[#8b96ab]">请求头参数将跟随后端字段扩展，目前用于结构占位。</p>
                      </div>
                    ) : null}

                    {activeTab === 'config' ? (
                      <div className="rounded-xl border border-[#e8edf7] bg-[#fafcff] p-4 space-y-3">
                        <PlainField label="Command（stdio）"><input value={form.command || ''} onChange={(e) => setForm((p) => ({ ...p, command: e.target.value }))} className="h-10 w-full rounded-lg border border-[#d5ddef] bg-white px-3 text-sm" /></PlainField>
                        <PlainField label="Args（JSON 数组）"><textarea value={JSON.stringify(form.args_json || [])} onChange={(e) => setForm((p) => ({ ...p, args_json: parseArray(e.target.value) }))} className="min-h-[90px] w-full rounded-lg border border-[#d5ddef] bg-white px-3 py-2 text-sm" /></PlainField>
                        <PlainField label="Env（JSON 对象）"><textarea value={JSON.stringify(form.env_json || {})} onChange={(e) => setForm((p) => ({ ...p, env_json: parseObject(e.target.value) }))} className="min-h-[90px] w-full rounded-lg border border-[#d5ddef] bg-white px-3 py-2 text-sm" /></PlainField>
                      </div>
                    ) : null}
                  </div>

                  {error ? <p className="mt-4 rounded-xl bg-[#fff1f2] p-3 text-sm text-[#dc2626]">{error}</p> : null}
                  {feedback ? <p className="mt-4 rounded-xl bg-[#ecfdf3] p-3 text-sm text-[#15803d]">{feedback}</p> : null}
                </form>

                <div className="shrink-0 border-t border-[#e8edf7] bg-white px-6 py-4 flex justify-end gap-3">
                  <button type="button" onClick={resetForm} className="h-10 rounded-lg border border-[#d4dced] px-4 text-sm text-[#475569]">取消</button>
                  <button type="submit" form="mcp-service-form" className="h-10 rounded-lg bg-gradient-to-r from-[#2f63f8] to-[#7a53f6] px-4 text-sm font-medium text-white inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4" /> 保存并测试连接
                  </button>
                </div>
              </section>

              <aside className="rounded-2xl border border-[#e7ebf4] bg-white shadow-[0_10px_30px_rgba(31,41,55,0.04)] p-4 space-y-4 max-[1520px]:col-span-2 max-[1200px]:col-span-1">
                <section className="rounded-xl border border-[#ecf0f8] bg-[#f8faff] p-4">
                  <h3 className="text-base font-semibold">了解 MCP ({form.transport.toUpperCase()})</h3>
                  <p className="text-xs text-[#7d889f] mt-2">MCP (Model Context Protocol) 是一种标准协议，用于 AI 应用与外部服务通信。</p>
                  <div className="mt-3 space-y-2">
                    <InfoRow icon={<FileText className="h-4 w-4 text-[#4f6bf6]" />} title="HTTP 协议" desc="基于 RESTful API，通过 HTTPS 进行通信" />
                    <InfoRow icon={<Shield className="h-4 w-4 text-[#4f6bf6]" />} title="安全认证" desc="支持动态客户端注册和 Bearer Token" />
                    <InfoRow icon={<Settings className="h-4 w-4 text-[#4f6bf6]" />} title="灵活配置" desc="可自定义请求头和超时配置选项" />
                  </div>
                </section>

                <section className="rounded-xl border border-[#ecf0f8] bg-[#f8faff] p-4">
                  <h4 className="text-[#2f63f8] font-semibold text-sm">小贴士</h4>
                  <p className="text-xs text-[#7d889f] mt-2">添加服务后，建议先测试连接确保配置正确。</p>
                </section>
              </aside>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function StepField({ index, title, required, children }: { index: number; title: string; required?: boolean; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e8edf7] px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-3">
          <span className="h-7 w-7 rounded-full bg-[#3b66f6] text-white text-xs font-semibold inline-flex items-center justify-center">{index}</span>
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        {required ? <span className="rounded bg-[#dbfce7] px-2 py-0.5 text-xs text-[#16a34a]">必填</span> : null}
      </div>
      {children}
    </section>
  )
}

function PlainField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-[#334155] mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function InfoRow({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg bg-white border border-[#e9eef8] p-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="text-sm font-medium text-[#1f2937]">{title}</p>
          <p className="text-xs text-[#7d889f] mt-1">{desc}</p>
        </div>
      </div>
    </div>
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
