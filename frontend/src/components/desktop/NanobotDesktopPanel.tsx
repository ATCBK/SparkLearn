'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, CheckCircle2, Loader2, PlugZap, RotateCcw, Save, Settings2, XCircle } from 'lucide-react'

type ChannelMeta = {
  id: string
  label: string
  status: 'ready' | 'planned' | string
}

type NanobotSettings = {
  runMode: 'hybrid' | 'serve' | 'channels' | string
  model: {
    provider: string
    model: string
    apiBase: string
    apiKey: string
  }
  tools: {
    webSearch: boolean
    restrictToWorkspace: boolean
  }
  channels: Record<string, Record<string, string | boolean>>
  runtimeConfigPath?: string
  workspacePath?: string
  availableChannels: ChannelMeta[]
}

type NanobotStatus = {
  settings: NanobotSettings
  services: {
    serve: { enabled: boolean; running: boolean; healthy?: boolean; healthUrl?: string; reason?: string }
    gateway: { enabled: boolean; running: boolean; healthy?: boolean; healthUrl?: string; reason?: string }
  }
}

type DesktopApi = {
  nanobot: {
    getConfig: () => Promise<NanobotSettings>
    saveConfig: (payload: Partial<NanobotSettings>) => Promise<NanobotSettings>
    getStatus: () => Promise<NanobotStatus>
    restartGateway: () => Promise<NanobotStatus>
    restartServe: () => Promise<NanobotStatus>
  }
}

declare global {
  interface Window {
    sparklearnDesktop?: DesktopApi
  }
}

const MODE_LABELS: Record<string, string> = {
  hybrid: 'API + 渠道',
  serve: '仅 API',
  channels: '仅渠道',
}

export function NanobotDesktopPanel() {
  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<NanobotStatus | null>(null)
  const [draft, setDraft] = useState<NanobotSettings | null>(null)
  const [message, setMessage] = useState('')

  const api = useMemo(() => {
    if (typeof window === 'undefined') return null
    return window.sparklearnDesktop?.nanobot || null
  }, [available])

  const load = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const next = await api.getStatus()
      setStatus(next)
      setDraft(next.settings)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    setAvailable(typeof window !== 'undefined' && Boolean(window.sparklearnDesktop?.nanobot))
  }, [])

  useEffect(() => {
    if (available) void load()
  }, [available, load])

  if (!available || !api || !draft) return null

  const feishu = (draft.channels.feishu || {}) as Record<string, string | boolean>
  const plannedChannels = draft.availableChannels.filter(channel => channel.id !== 'feishu')
  const serveOk = Boolean(status?.services.serve.healthy)
  const gatewayOk = Boolean(status?.services.gateway.healthy)

  function patchDraft(next: Partial<NanobotSettings>) {
    setDraft(current => current ? { ...current, ...next } : current)
  }

  function patchModel(field: keyof NanobotSettings['model'], value: string) {
    setDraft(current => current ? { ...current, model: { ...current.model, [field]: value } } : current)
  }

  function patchTools(field: keyof NanobotSettings['tools'], value: boolean) {
    setDraft(current => current ? { ...current, tools: { ...current.tools, [field]: value } } : current)
  }

  function patchFeishu(field: string, value: string | boolean) {
    setDraft(current => current ? {
      ...current,
      channels: {
        ...current.channels,
        feishu: { ...(current.channels.feishu || {}), [field]: value },
      },
    } : current)
  }

  async function save() {
    const desktopApi = api
    if (!draft || !desktopApi) return
    setSaving(true)
    setMessage('')
    try {
      const saved = await desktopApi.saveConfig(draft)
      setDraft(saved)
      const next = await desktopApi.getStatus()
      setStatus(next)
      setMessage('已保存配置，必要时请重启对应服务。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function restart(kind: 'serve' | 'gateway') {
    const desktopApi = api
    if (!desktopApi) return
    setLoading(true)
    setMessage('')
    try {
      const next = kind === 'serve' ? await desktopApi.restartServe() : await desktopApi.restartGateway()
      setStatus(next)
      setDraft(next.settings)
      setMessage(kind === 'serve' ? 'Nanobot API 已重启。' : 'Nanobot 渠道网关已重启。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '重启失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[90] inline-flex h-12 items-center gap-2 rounded-[10px] bg-[#111827] px-4 text-sm font-bold text-white shadow-lg shadow-black/20 transition hover:bg-[#0f172a]"
      >
        <Bot className="h-4 w-4" />
        Nanobot
        <span className={`h-2 w-2 rounded-full ${serveOk || gatewayOk ? 'bg-[#22c55e]' : 'bg-[#f97316]'}`} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/35 px-4 py-5 backdrop-blur-sm">
          <section className="ml-auto flex h-full w-full max-w-[560px] flex-col overflow-hidden rounded-[14px] border border-[#dbe3ef] bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-lg font-black text-[#111827]">
                  <Bot className="h-5 w-5 text-[#2563eb]" />
                  Nanobot 桌面连接
                </div>
                <p className="mt-1 text-xs leading-5 text-[#64748b]">仅在桌面端显示，用于配置本机 Nanobot 和渠道接入。</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-[8px] text-[#64748b] hover:bg-[#f1f5f9]">
                <XCircle className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <ServiceCard title="API 服务" ok={serveOk} detail={status?.services.serve.healthUrl || '127.0.0.1:8900'} />
                <ServiceCard title="渠道网关" ok={gatewayOk} detail={status?.services.gateway.healthUrl || '127.0.0.1:18790'} />
              </div>

              <div className="rounded-[10px] border border-[#e5e7eb] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#111827]">
                  <Settings2 className="h-4 w-4 text-[#2563eb]" />
                  运行模式
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['hybrid', 'serve', 'channels'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => patchDraft({ runMode: mode })}
                      className={`h-9 rounded-[8px] text-xs font-bold ${draft.runMode === mode ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'}`}
                    >
                      {MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[10px] border border-[#e5e7eb] p-4">
                <div className="mb-3 text-sm font-black text-[#111827]">模型配置</div>
                <div className="grid gap-3">
                  <LabeledInput label="Provider" value={draft.model.provider} onChange={value => patchModel('provider', value)} />
                  <LabeledInput label="Model" value={draft.model.model} onChange={value => patchModel('model', value)} />
                  <LabeledInput label="API Base" value={draft.model.apiBase} onChange={value => patchModel('apiBase', value)} />
                  <LabeledInput label="API Key" type="password" value={draft.model.apiKey} onChange={value => patchModel('apiKey', value)} placeholder="留空不改，******** 表示已保存" />
                </div>
                <div className="mt-3 grid gap-2 text-xs font-bold text-[#475569]">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.tools.webSearch} onChange={event => patchTools('webSearch', event.target.checked)} />
                    启用网页搜索工具
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.tools.restrictToWorkspace} onChange={event => patchTools('restrictToWorkspace', event.target.checked)} />
                    限制在工作区内读写
                  </label>
                </div>
              </div>

              <div className="rounded-[10px] border border-[#e5e7eb] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-black text-[#111827]">
                    <PlugZap className="h-4 w-4 text-[#2563eb]" />
                    飞书 / Lark
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#475569]">
                    <input type="checkbox" checked={Boolean(feishu.enabled)} onChange={event => patchFeishu('enabled', event.target.checked)} />
                    启用
                  </label>
                </div>
                <div className="grid gap-3">
                  <LabeledInput label="App ID" value={String(feishu.appId || '')} onChange={value => patchFeishu('appId', value)} />
                  <LabeledInput label="App Secret" type="password" value={String(feishu.appSecret || '')} onChange={value => patchFeishu('appSecret', value)} />
                  <LabeledInput label="Encrypt Key" type="password" value={String(feishu.encryptKey || '')} onChange={value => patchFeishu('encryptKey', value)} />
                  <LabeledInput label="Verification Token" type="password" value={String(feishu.verificationToken || '')} onChange={value => patchFeishu('verificationToken', value)} />
                  <LabeledInput label="允许来源" value={String(feishu.allowFrom || '*')} onChange={value => patchFeishu('allowFrom', value)} />
                </div>
              </div>

              <div className="rounded-[10px] border border-[#e5e7eb] p-4">
                <div className="mb-3 text-sm font-black text-[#111827]">后续渠道</div>
                <div className="flex flex-wrap gap-2">
                  {plannedChannels.map(channel => (
                    <span key={channel.id} className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-bold text-[#64748b]">
                      {channel.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <footer className="border-t border-[#e5e7eb] px-5 py-4">
              {message && <div className="mb-3 rounded-[8px] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#1d4ed8]">{message}</div>}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-[#f1f5f9] px-3 text-xs font-bold text-[#475569] hover:bg-[#e2e8f0] disabled:opacity-60">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  刷新
                </button>
                <button type="button" onClick={() => void restart('gateway')} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-[#f1f5f9] px-3 text-xs font-bold text-[#475569] hover:bg-[#e2e8f0] disabled:opacity-60">
                  重启网关
                </button>
                <button type="button" onClick={() => void restart('serve')} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-[#f1f5f9] px-3 text-xs font-bold text-[#475569] hover:bg-[#e2e8f0] disabled:opacity-60">
                  重启 API
                </button>
                <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-[#2563eb] px-4 text-xs font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-60">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  保存
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}

function ServiceCard({ title, ok, detail }: { title: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] bg-[#f8fafc] p-3">
      <div className="flex items-center gap-2 text-sm font-black text-[#111827]">
        {ok ? <CheckCircle2 className="h-4 w-4 text-[#16a34a]" /> : <XCircle className="h-4 w-4 text-[#f97316]" />}
        {title}
      </div>
      <div className="mt-1 truncate text-[11px] font-bold text-[#64748b]">{detail}</div>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.02em] text-[#64748b]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="h-9 rounded-[8px] border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
      />
    </label>
  )
}
