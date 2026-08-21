'use client'

import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  KeyRound,
  Plus,
  Save,
  Server,
  Trash2,
  Zap,
} from 'lucide-react'
import { TutorSidebar } from '@/components/tutor/TutorSidebar'

type ModelProvider = 'spark' | 'deepseek'

type ModelConfig = {
  id: string
  provider: ModelProvider
  name: string
  modelId: string
  apiKey: string
  baseUrl: string
  enabled: boolean
  updatedAt: string
}

const STORAGE_KEY = 'sparklearn_tutor_model_configs'

const PROVIDERS: Array<{
  key: ModelProvider
  label: string
  description: string
  defaultBaseUrl: string
  defaultModelId: string
}> = [
  {
    key: 'spark',
    label: '讯飞星火',
    description: '用于默认学习问答、资源生成和多智能体讨论。',
    defaultBaseUrl: 'https://spark-api.xf-yun.com',
    defaultModelId: 'spark-lite',
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    description: '用于代码解释、复杂推理和长上下文学习任务。',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModelId: 'deepseek-chat',
  },
]

function nowText() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function defaultConfig(provider: ModelProvider): ModelConfig {
  const meta = PROVIDERS.find((item) => item.key === provider) || PROVIDERS[0]
  return {
    id: `${provider}-draft`,
    provider,
    name: meta.label,
    modelId: meta.defaultModelId,
    apiKey: '',
    baseUrl: meta.defaultBaseUrl,
    enabled: true,
    updatedAt: '',
  }
}

function readConfigs(): ModelConfig[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function maskKey(apiKey: string) {
  const value = apiKey.trim()
  if (!value) return '未配置'
  if (value.length <= 8) return '已配置'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function initialPageState() {
  const configs = readConfigs()
  const firstDeepSeek = configs.find((item) => item.provider === 'deepseek')
  const form = firstDeepSeek ? { ...firstDeepSeek, apiKey: firstDeepSeek.apiKey || '' } : defaultConfig('deepseek')
  return {
    configs,
    selectedProvider: form.provider,
    editingId: firstDeepSeek?.id || '',
    form,
  }
}

export default function TutorModelSettingsPage() {
  const [initialState] = useState(() => initialPageState())
  const [configs, setConfigs] = useState<ModelConfig[]>(initialState.configs)
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>(initialState.selectedProvider)
  const [editingId, setEditingId] = useState<string>(initialState.editingId)
  const [form, setForm] = useState<ModelConfig>(initialState.form)
  const [toast, setToast] = useState('')

  const activeConfig = useMemo(
    () => configs.find((item) => item.id === editingId) || null,
    [configs, editingId],
  )

  function persist(next: ModelConfig[]) {
    setConfigs(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function chooseProvider(provider: ModelProvider) {
    setSelectedProvider(provider)
    const existing = configs.find((item) => item.provider === provider)
    if (existing) {
      setEditingId(existing.id)
      setForm({ ...existing })
      return
    }
    setEditingId('')
    setForm(defaultConfig(provider))
  }

  function patchForm<K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function saveConfig(event: React.FormEvent) {
    event.preventDefault()
    const cleanName = form.name.trim()
    const cleanModelId = form.modelId.trim()
    if (!cleanName || !cleanModelId) {
      setToast('模型名称和模型标识不能为空')
      return
    }

    const nextConfig = {
      ...form,
      id: editingId || `${form.provider}-${Date.now()}`,
      name: cleanName,
      modelId: cleanModelId,
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      updatedAt: nowText(),
    }
    const exists = configs.some((item) => item.id === nextConfig.id)
    const next = exists
      ? configs.map((item) => (item.id === nextConfig.id ? nextConfig : item))
      : [nextConfig, ...configs]
    persist(next)
    setEditingId(nextConfig.id)
    setForm(nextConfig)
    setToast(exists ? '模型配置已更新' : '模型配置已保存')
  }

  function removeConfig(id: string) {
    const next = configs.filter((item) => item.id !== id)
    persist(next)
    if (editingId === id) {
      setEditingId('')
      setForm(defaultConfig(selectedProvider))
    }
    setToast('模型配置已删除')
  }

  function testConfig() {
    if (!form.apiKey.trim()) {
      setToast('请先填写 API Key 再测试连接')
      return
    }
    setToast('连接参数已通过本地格式校验')
  }

  return (
    <div
      className="flex h-screen bg-[#f5f7fa] text-[#0f172a] max-[760px]:h-auto max-[760px]:min-h-screen"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      <TutorSidebar />

      <main className="min-w-0 flex-1 overflow-y-auto bg-[#fbfcfe]">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[#e2e8f0] bg-white px-6 py-3">
          <div>
            <h1 className="text-sm font-semibold text-[#1e293b]">模型配置</h1>
            <p className="mt-0.5 text-[11px] text-[#94a3b8]">智能辅导 / 模型配置</p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#64748b]">
            <span className="h-2 w-2 rounded-full bg-[#059669]" />
            本机配置
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1100px] px-8 py-7 max-[760px]:px-4">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#1e293b]">管理 Tutor 使用的大模型</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">
                配置模型名称、模型标识、API Key 和接口地址，供智能辅导读取同一套模型标识。
              </p>
            </div>
            <button
              type="button"
              onClick={() => chooseProvider(selectedProvider)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white shadow-sm shadow-blue-100 transition-colors hover:bg-[#1d4ed8]"
            >
              <Plus className="h-4 w-4" />
              新建配置
            </button>
          </div>

          {toast && (
            <div className="mb-5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm font-medium text-[#1d4ed8]">
              {toast}
            </div>
          )}

          <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-[0_8px_24px_rgba(31,41,55,0.04)]">
            <div className="mb-3 px-2 text-xs font-bold uppercase text-[#94a3b8]">供应商</div>
            <div className="space-y-2">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() => chooseProvider(provider.key)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedProvider === provider.key
                      ? 'border-[#2563eb] bg-[#eff6ff]'
                      : 'border-[#eef2f7] bg-white hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-[#2563eb]" />
                    <span className="font-bold">{provider.label}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#64748b]">{provider.description}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 mb-3 px-2 text-xs font-bold uppercase text-[#94a3b8]">已保存</div>
            <div className="space-y-2">
              {configs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setEditingId(item.id)
                    setSelectedProvider(item.provider)
                    setForm(item)
                  }}
                  className={`w-full rounded-lg border p-3 text-left ${
                    editingId === item.id ? 'border-[#2563eb] bg-[#eff6ff]' : 'border-[#eef2f7] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <b className="truncate text-sm">{item.name}</b>
                    <span className="rounded-md bg-[#ecfdf5] px-2 py-1 text-[11px] font-bold text-[#059669]">
                      {item.enabled ? '启用' : '停用'}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-[#64748b]">{item.modelId} · {maskKey(item.apiKey)}</p>
                </button>
              ))}
              {!configs.length && (
                <div className="rounded-lg border border-dashed border-[#cbd5e1] p-4 text-center text-xs font-semibold text-[#94a3b8]">
                  暂无保存的模型配置
                </div>
              )}
            </div>
          </aside>

          <form onSubmit={saveConfig} className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.04)]">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f7] pb-4">
              <div>
                <h2 className="text-xl font-extrabold">{activeConfig ? '编辑模型' : '新增模型'}</h2>
                <p className="mt-1 text-xs text-[#64748b]">保存后会在本机浏览器中持久化，便于 Tutor 页面读取同一套模型标识。</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={testConfig}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dbe7f5] px-3 text-sm font-bold text-[#2563eb] hover:bg-[#eff6ff]"
                >
                  <Zap className="h-4 w-4" />
                  测试连接
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => removeConfig(editingId)}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-[#fff1f2] text-[#dc2626] hover:bg-[#ffe4e6]"
                    aria-label="删除模型配置"
                    title="删除模型配置"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">模型名称</span>
                <input
                  value={form.name}
                  onChange={(event) => patchForm('name', event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#dbe7f5] px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                  placeholder="例如：DeepSeek 推理模型"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">模型标识</span>
                <input
                  value={form.modelId}
                  onChange={(event) => patchForm('modelId', event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#dbe7f5] px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                  placeholder="deepseek-chat"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">API Key</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#94a3b8]" />
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(event) => patchForm('apiKey', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#dbe7f5] px-9 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                    placeholder="sk-..."
                  />
                </div>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">接口地址</span>
                <input
                  value={form.baseUrl}
                  onChange={(event) => patchForm('baseUrl', event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#dbe7f5] px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                  placeholder="https://api.deepseek.com"
                />
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-[#eef2f7] bg-[#f8fafc] px-3 py-3 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => patchForm('enabled', event.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-bold text-[#334155]">启用这个模型配置</span>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2f7] pt-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748b]">
                <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                最近更新：{form.updatedAt || '尚未保存'}
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563eb] px-4 text-sm font-bold text-white hover:bg-[#1d4ed8]"
              >
                <Save className="h-4 w-4" />
                保存配置
              </button>
            </div>
          </form>
          </section>
        </div>
      </main>
    </div>
  )
}
