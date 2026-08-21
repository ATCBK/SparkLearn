'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  CheckCircle2,
  Circle,
  Download,
  FileText,
  Lock,
  Settings,
  Shield,
} from 'lucide-react'
import { api, McpService, McpServicePayload } from '@/lib/api'
import { TutorSidebar } from '@/components/tutor/TutorSidebar'

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

function isDemoWeatherService(service: McpService) {
  const text = `${service.name} ${service.description}`.toLowerCase()
  return text.includes('weather') || text.includes('天气')
}

export default function TutorMcpStorePage() {
  const router = useRouter()
  const [services, setServices] = useState<McpService[]>([])
  const [form, setForm] = useState<McpServicePayload>(EMPTY_FORM)
  const [argsJsonText, setArgsJsonText] = useState(() => JSON.stringify(EMPTY_FORM.args_json, null, 2))
  const [envJsonText, setEnvJsonText] = useState(() => JSON.stringify(EMPTY_FORM.env_json, null, 2))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('auth')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [desktopReady] = useState(() => typeof window !== 'undefined' && Boolean(window.sparklearnDesktop))

  const stats = useMemo(() => {
    const online = services.filter((item) => item.last_status === 'online').length
    return { total: services.length, online }
  }, [services])
  const selectedService = useMemo(
    () => services.find((item) => item.id === editingId) || null,
    [editingId, services],
  )
  const selectedIsSystem = selectedService?.source === 'system'

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
    setArgsJsonText(JSON.stringify(service.args_json ?? [], null, 2))
    setEnvJsonText(JSON.stringify(service.env_json ?? {}, null, 2))
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setArgsJsonText(JSON.stringify(EMPTY_FORM.args_json, null, 2))
    setEnvJsonText(JSON.stringify(EMPTY_FORM.env_json, null, 2))
    setEditingId(null)
    setFeedback('')
    setError('')
  }

  function notifyDesktopOnlyStdio() {
    const message = '网页端暂不支持配置本地 stdio MCP。请下载桌面端配置，在 SparkLearn 桌面端中完成本机服务接入。'
    setError('')
    setFeedback(message)
    window.alert(message)
  }

  function normalizeJsonInputs(payload: McpServicePayload): McpServicePayload {
    const next = { ...payload }
    try {
      next.args_json = JSON.parse(argsJsonText)
    } catch {
      throw new Error('args_json 必须是合法 JSON 数组')
    }
    if (!Array.isArray(next.args_json)) {
      throw new Error('args_json 必须是 JSON 数组')
    }

    try {
      next.env_json = JSON.parse(envJsonText)
    } catch {
      throw new Error('env_json 必须是合法 JSON 对象')
    }
    if (!next.env_json || Array.isArray(next.env_json) || typeof next.env_json !== 'object') {
      throw new Error('env_json 必须是 JSON 对象')
    }

    return next
  }

  function downloadDesktopConfig() {
    const payload = {
      app: 'SparkLearn Desktop',
      purpose: 'local-stdio-mcp',
      message: '将该配置导入 SparkLearn 桌面端后，可在本机运行 stdio MCP 服务。',
      service: {
        name: form.name || 'Local stdio MCP',
        description: form.description || 'Local MCP service for SparkLearn Desktop',
        transport: 'stdio',
        command: form.command || 'npx',
        args_json: form.args_json?.length ? form.args_json : ['-y', '@modelcontextprotocol/server-filesystem', 'D:/Project_building/SparkLearn'],
        env_json: form.env_json || {},
        enabled: false,
        startup_timeout_ms: form.startup_timeout_ms ?? 60000,
        tool_timeout_ms: form.tool_timeout_ms ?? 30000,
        long_task_timeout_ms: form.long_task_timeout_ms ?? 120000,
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sparklearn-desktop-stdio-mcp-config.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setFeedback('桌面端 stdio MCP 配置已下载，请在 SparkLearn 桌面端中导入。')
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setFeedback('')
    try {
      if (selectedIsSystem) {
        setFeedback('内置系统 MCP 已安装，可在左侧测试、启用或停用。')
        return
      }
      if (form.transport === 'stdio' && !desktopReady) {
        notifyDesktopOnlyStdio()
        return
      }
      if (form.transport === 'http' && !(form.endpoint || '').trim()) {
        setError('HTTP 服务必须填写服务端点 URL')
        return
      }
      if (form.transport === 'stdio' && !(form.command || '').trim()) {
        setError('stdio 服务必须填写 command')
        return
      }
      const normalized = normalizeJsonInputs(form)
      if (editingId) {
        await api.updateMcpService(editingId, normalized)
        setFeedback('服务配置已更新')
      } else {
        const created = await api.createMcpService(normalized)
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
    if (isDemoWeatherService(service)) {
      setError('')
      setFeedback('天气 MCP 是网页端演示服务，已锁定保留，不会删除。')
      return
    }
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
      <TutorSidebar />

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
                    const demoLocked = isDemoWeatherService(service)
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
                        {service.source === 'system' ? <p className="mt-1 text-xs font-medium text-[#2563eb]">系统内置服务</p> : null}
                        {service.last_error ? <p className="text-xs text-[#ef4444] mt-1 truncate">{service.last_error}</p> : null}
                        <div className="mt-3 flex items-center gap-2 text-[11px]">
                          <span onClick={(e) => { e.stopPropagation(); void testService(service.id) }} className="rounded-md bg-[#eaf0ff] px-2 py-1 text-[#3153db]">测试</span>
                          <span onClick={(e) => { e.stopPropagation(); void toggleService(service) }} className="rounded-md bg-[#ebfdf2] px-2 py-1 text-[#1a8f4a]">{service.enabled ? '停用' : '启用'}</span>
                          <span
                            onClick={(e) => { e.stopPropagation(); void removeService(service) }}
                            className={`rounded-md px-2 py-1 ${demoLocked ? 'bg-[#fff7ed] text-[#92400e]' : 'bg-[#fff1f2] text-[#dc2626]'}`}
                            title={demoLocked ? '演示服务已锁定保留' : '删除服务'}
                          >
                            {demoLocked ? '已锁定' : '删除'}
                          </span>
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
                      <p className="text-xs text-[#8d99ae] mb-2">MCP 服务管理 / 添加 MCP 服务</p>
                      <h1 className="text-3xl font-semibold text-[#111827]">
                        {selectedIsSystem ? '内置 MCP 服务' : '添加 MCP 服务'}（{form.transport === 'http' ? '远程 HTTP' : '本地 stdio'}）
                      </h1>
                      <p className="text-sm text-[#7d889f] mt-2">
                        {selectedIsSystem ? '系统内置服务已安装，可直接测试和启用。' : form.transport === 'http' ? 'HTTP 只需要 URL/认证/请求头' : 'stdio 只需要 command/args/env'}
                      </p>
                    </div>
                    <button type="button" onClick={() => router.push('/tutor/mcp-store/docs')} className="text-sm text-[#2563eb] whitespace-nowrap">查看文档</button>
                  </div>

                  <div className="mt-6 space-y-4">
                    <StepField index={1} title="连接方式" required>
                      <div className="grid grid-cols-2 gap-3 max-[1280px]:grid-cols-1">
                        <button type="button" onClick={() => setForm((p) => ({ ...p, transport: 'http' }))} className={`h-10 rounded-lg border text-sm ${form.transport === 'http' ? 'border-[#5d78f5] bg-[#eef3ff] text-[#1e40af]' : 'border-[#ced7ea] bg-white text-[#334155]'}`}>远程 HTTP MCP</button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!desktopReady) {
                              notifyDesktopOnlyStdio()
                              return
                            }
                            setForm((p) => ({ ...p, transport: 'stdio' }))
                          }}
                          className={`relative h-10 rounded-lg border text-sm transition ${form.transport === 'stdio' ? 'border-[#f59e0b] bg-[#fff7ed] text-[#92400e]' : 'border-[#d8dee9] bg-white text-[#334155]'} ${desktopReady ? 'hover:border-[#f59e0b] hover:bg-[#fff7ed] hover:text-[#92400e]' : 'bg-[#f8fafc] text-[#64748b]'}`}
                          title={desktopReady ? '在桌面端配置本地 stdio MCP' : '本地 stdio MCP 需要在桌面端配置'}
                        >
                          <span className="inline-flex items-center justify-center gap-1.5">
                            {!desktopReady ? <Lock className="h-3.5 w-3.5" /> : null}
                            本地 stdio MCP
                          </span>
                        </button>
                      </div>
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#8b96ab]">
                        {!desktopReady ? <Lock className="h-3.5 w-3.5 text-[#d97706]" /> : null}
                        {desktopReady ? '当前为桌面端，可直接配置本地 stdio MCP。' : '浏览器版仅支持远程 HTTP MCP。本地 stdio 需要 SparkLearn 桌面端接管本机进程。'}
                      </p>
                    </StepField>

                    <StepField index={2} title="服务基本信息" required>
                      <div className="grid grid-cols-1 gap-3">
                        <input
                          value={form.name || ''}
                          disabled={selectedIsSystem}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="显示名称，例如：Tavily Web Search / Filesystem MCP"
                          className="h-10 w-full rounded-lg border border-[#ced7ea] bg-white px-3 text-sm outline-none focus:border-[#5d78f5]"
                          required
                        />
                        <input
                          value={form.description || ''}
                          disabled={selectedIsSystem}
                          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                          placeholder="服务标识符（小写英文/数字/连字符），例如：tavily-web-search"
                          className="h-10 w-full rounded-lg border border-[#ced7ea] bg-white px-3 text-sm outline-none focus:border-[#5d78f5]"
                        />
                      </div>
                    </StepField>

                    {form.transport === 'http' ? (
                      <StepField index={3} title="服务端点 URL" required>
                        <input
                          value={form.endpoint || ''}
                          disabled={selectedIsSystem}
                          onChange={(e) => setForm((p) => ({ ...p, endpoint: e.target.value }))}
                          placeholder="https://example.com/mcp"
                          className="h-10 w-full rounded-lg border border-[#ced7ea] bg-white px-3 text-sm outline-none focus:border-[#5d78f5]"
                          required
                        />
                        <p className="mt-2 text-xs text-[#8b96ab] inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> HTTP 必填 URL；stdio 不需要 URL。</p>
                      </StepField>
                    ) : (
                      <StepField index={3} title="本地启动参数" required>
                        {desktopReady ? (
                          <div className="space-y-3">
                            <PlainField label="Command">
                              <input
                                value={form.command || ''}
                                onChange={(e) => setForm((p) => ({ ...p, command: e.target.value }))}
                                placeholder="npx / uvx / node / python"
                                className="h-10 w-full rounded-lg border border-[#ced7ea] bg-white px-3 text-sm outline-none focus:border-[#f59e0b]"
                              />
                            </PlainField>
                            <PlainField label="Args JSON">
                              <textarea
                                value={argsJsonText}
                                onChange={(e) => setArgsJsonText(e.target.value)}
                                placeholder={'["-y", "@modelcontextprotocol/server-filesystem", "D:/Project_building/SparkLearn"]'}
                                className="min-h-[130px] w-full rounded-lg border border-[#ced7ea] bg-white px-3 py-2 text-sm font-mono outline-none focus:border-[#f59e0b]"
                              />
                            </PlainField>
                            <PlainField label="Env JSON">
                              <textarea
                                value={envJsonText}
                                onChange={(e) => setEnvJsonText(e.target.value)}
                                placeholder={'{\n  "NODE_ENV": "production"\n}'}
                                className="min-h-[130px] w-full rounded-lg border border-[#ced7ea] bg-white px-3 py-2 text-sm font-mono outline-none focus:border-[#f59e0b]"
                              />
                            </PlainField>
                            <p className="text-xs text-[#8b96ab]">`args_json` 需要是 JSON 数组，`env_json` 需要是 JSON 对象。</p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-4">
                            <div className="flex items-start gap-3">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#d97706] ring-1 ring-[#fed7aa]">
                                <Lock className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold text-[#92400e]">浏览器版已锁定本地 stdio 配置</h3>
                                <p className="mt-1 text-xs leading-5 text-[#9a6a2f]">
                                  stdio MCP 会启动本机命令或访问本地文件系统，浏览器版无法直接接管本机进程。请在 SparkLearn 桌面端中完成接入。
                                </p>
                                <button
                                  type="button"
                                  onClick={downloadDesktopConfig}
                                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#d97706] px-3 text-xs font-semibold text-white hover:bg-[#b45309]"
                                >
                                  <Download className="h-4 w-4" />
                                  下载桌面端配置
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </StepField>
                    )}
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
                          <select
                            value={form.transport}
                            onChange={(e) => {
                              if (e.target.value === 'stdio' && !desktopReady) {
                                notifyDesktopOnlyStdio()
                                return
                              }
                              setForm((p) => ({ ...p, transport: e.target.value as 'http' | 'stdio' }))
                            }}
                            className="h-10 w-full rounded-lg border border-[#d5ddef] bg-white px-3 text-sm"
                          >
                            <option value="http">HTTP</option>
                            <option value="stdio">STDIO{desktopReady ? '（本地）' : '（桌面端）'}</option>
                          </select>
                        </PlainField>
                        <p className="text-xs text-[#8b96ab]">{form.transport === 'http' ? '请求头参数将跟随后端字段扩展，目前用于结构占位。' : '桌面端本地 stdio 将直接使用 command / args_json / env_json 启动 MCP 进程。'}</p>
                      </div>
                    ) : null}

                    {activeTab === 'config' ? (
                      <div className="rounded-xl border border-[#e8edf7] bg-[#fafcff] p-4 space-y-3">
                        <PlainField label="启动超时（ms）">
                          <input type="number" value={form.startup_timeout_ms ?? 60000} onChange={(e) => setForm((p) => ({ ...p, startup_timeout_ms: Number(e.target.value || 0) }))} className="h-10 w-full rounded-lg border border-[#d5ddef] bg-white px-3 text-sm" />
                        </PlainField>
                        <PlainField label="工具调用超时（ms）">
                          <input type="number" value={form.tool_timeout_ms ?? 30000} onChange={(e) => setForm((p) => ({ ...p, tool_timeout_ms: Number(e.target.value || 0) }))} className="h-10 w-full rounded-lg border border-[#d5ddef] bg-white px-3 text-sm" />
                        </PlainField>
                        <PlainField label="长任务超时（ms）">
                          <input type="number" value={form.long_task_timeout_ms ?? 120000} onChange={(e) => setForm((p) => ({ ...p, long_task_timeout_ms: Number(e.target.value || 0) }))} className="h-10 w-full rounded-lg border border-[#d5ddef] bg-white px-3 text-sm" />
                        </PlainField>
                      </div>
                    ) : null}
                  </div>

                  {selectedIsSystem ? <p className="mt-4 rounded-xl bg-[#eef4ff] p-3 text-sm text-[#3153db]">该服务由系统内置提供，工具名为 get_weather，会在 Tutor 开启 MCP 后按天气类问题自动调用。</p> : null}
                  {error ? <p className="mt-4 rounded-xl bg-[#fff1f2] p-3 text-sm text-[#dc2626]">{error}</p> : null}
                  {feedback ? <p className="mt-4 rounded-xl bg-[#ecfdf3] p-3 text-sm text-[#15803d]">{feedback}</p> : null}
                </form>

                <div className="shrink-0 border-t border-[#e8edf7] bg-white px-6 py-4 flex justify-end gap-3">
                  <button type="button" onClick={resetForm} className="h-10 rounded-lg border border-[#d4dced] px-4 text-sm text-[#475569]">取消</button>
                  {selectedIsSystem ? (
                    <button type="button" onClick={() => setFeedback('内置天气 MCP 已安装，无需保存配置。')} className="h-10 rounded-lg bg-[#2563eb] px-4 text-sm font-medium text-white inline-flex items-center gap-1.5">
                      <Check className="h-4 w-4" /> 已安装
                    </button>
                  ) : form.transport === 'stdio' && !desktopReady ? (
                    <button type="button" onClick={downloadDesktopConfig} className="h-10 rounded-lg bg-[#d97706] px-4 text-sm font-medium text-white inline-flex items-center gap-1.5 hover:bg-[#b45309]">
                      <Download className="h-4 w-4" /> 下载桌面端配置
                    </button>
                  ) : (
                    <button type="submit" form="mcp-service-form" className="h-10 rounded-lg bg-gradient-to-r from-[#2f63f8] to-[#7a53f6] px-4 text-sm font-medium text-white inline-flex items-center gap-1.5">
                      <Check className="h-4 w-4" /> 保存并测试连接
                    </button>
                  )}
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

