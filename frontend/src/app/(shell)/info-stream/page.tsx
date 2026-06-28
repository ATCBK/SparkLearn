'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Brain,
  Check,
  Code,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  PenTool,
  PlayCircle,
  Plus,
  Search,
  Sparkles,
  Target,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ProtoButton } from '@/components/proto'

interface InfoItem {
  source: string
  external_id: string
  title: string
  summary: string
  url: string
  thumbnail: string
  author: string
  tags: string[]
  extra_data?: Record<string, unknown>
}

interface Source {
  id: string
  name: string
  icon: string
}

const SOURCE_ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  'play-circle': PlayCircle,
  github: Code,
  'file-text': FileText,
  'pen-tool': PenTool,
}

const DISCOVERY_PROMPTS = ['人工智能 函数 模块', 'Python return 作用域', '机器学习 入门 项目']

function numberMeta(value: unknown) {
  return typeof value === 'number' ? value.toLocaleString() : ''
}

function authHeaders(json = false) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sparklearn_token') : ''
  const headers: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {}
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function getSourceLabel(source: string): string {
  const map: Record<string, string> = {
    bilibili: 'B站视频',
    github: 'GitHub',
    arxiv: '学术论文',
    juejin: '掘金文章',
  }
  return map[source] || source
}

function getSourceColor(source: string): string {
  const map: Record<string, string> = {
    bilibili: 'bg-[#fff1f2] text-[#e11d48]',
    github: 'bg-[#f1f5f9] text-[#334155]',
    arxiv: 'bg-[#fef2f2] text-[#dc2626]',
    juejin: 'bg-[#eff6ff] text-[#2563eb]',
  }
  return map[source] || 'bg-[#f1f5f9] text-[#52627b]'
}

export default function InfoStreamPage() {
  const [keyword, setKeyword] = useState('人工智能 函数 模块')
  const [activeSource, setActiveSource] = useState('all')
  const [sources, setSources] = useState<Source[]>([])
  const [items, setItems] = useState<InfoItem[]>([])
  const [recommendKeywords] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [imported, setImported] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState<Set<string>>(new Set())

  useEffect(() => {
    void fetchSources()
  }, [])

  const highlighted = useMemo(() => items[0], [items])

  async function fetchSources() {
    try {
      const res = await fetch('/api/info-stream/sources')
      const json = await res.json()
      if (json.success) setSources(json.data)
    } catch {}
  }

  async function handleSearch(nextSource = activeSource) {
    if (!keyword.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({ keyword, source: nextSource, page_size: '15' })
      const res = await fetch(`/api/info-stream/search?${params}`)
      const json = await res.json()
      if (json.success) setItems(json.data.items || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  async function importToLibrary(item: InfoItem) {
    const key = `${item.source}:${item.external_id}`
    setImporting(prev => new Set(prev).add(key))
    try {
      const res = await fetch('/api/info-stream/import-resource', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(item),
      })
      const json = await res.json()
      if (json.success) {
        setImported(prev => new Set(prev).add(key))
      }
    } finally {
      setImporting(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[14px] border border-line bg-white p-5 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-small font-extrabold text-soft">
              <Sparkles className="h-4 w-4 text-blue" />
              学习发现 / 个性化内容流
            </div>
            <h1 className="m-0 text-[28px] font-bold leading-tight text-ink">学习发现</h1>
            <p className="mt-2 max-w-[720px] text-body leading-7 text-muted">
              根据你的专业方向、当前阶段和薄弱点发现外部学习内容，并沉淀到我的资源库继续学习。
            </p>
          </div>
          <ProtoButton href="/generate?view=library" variant="secondary">
            我的资源 <ArrowRight className="h-4 w-4" />
          </ProtoButton>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_220px] gap-3 max-[760px]:grid-cols-1">
          <div className="flex h-11 items-center gap-2 rounded-[12px] border border-line bg-[#f8fafc] px-3">
            <Search className="h-4 w-4 text-muted" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              placeholder="搜索和当前学习阶段相关的内容"
              className="min-w-0 flex-1 bg-transparent text-small outline-none"
            />
          </div>
          <button
            onClick={() => void handleSearch()}
            disabled={loading || !keyword.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-blue px-5 text-small font-bold text-white transition-colors hover:bg-blue-dark disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            发现内容
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(recommendKeywords.length ? recommendKeywords : DISCOVERY_PROMPTS).map((prompt) => (
            <button
              key={prompt}
              onClick={() => setKeyword(prompt)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-micro font-bold text-muted transition-colors hover:border-blue hover:text-blue"
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,900px)_300px] gap-5 max-[1100px]:grid-cols-1">
        <main className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sources.map((src) => {
              const Icon = SOURCE_ICONS[src.icon] || Globe
              return (
                <button
                  key={src.id}
                  onClick={() => {
                    setActiveSource(src.id)
                    if (searched) void handleSearch(src.id)
                  }}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-small font-bold whitespace-nowrap transition-colors ${
                    activeSource === src.id ? 'bg-blue text-white' : 'bg-white text-[#52627b] ring-1 ring-line hover:bg-[#eef5ff] hover:text-blue'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {src.name}
                </button>
              )
            })}
          </div>

          {loading ? (
            <div className="grid min-h-[320px] place-items-center rounded-[14px] border border-line bg-white">
              <div className="flex items-center gap-2 text-small text-muted">
                <Loader2 className="h-5 w-5 animate-spin text-blue" />
                正在发现适合你的学习内容...
              </div>
            </div>
          ) : items.length > 0 ? (
            <div className="grid gap-3">
              {items.map((item, idx) => (
                <DiscoveryCard
                  key={`${item.source}-${item.external_id}-${idx}`}
                  item={item}
                  imported={imported.has(`${item.source}:${item.external_id}`)}
                  importing={importing.has(`${item.source}:${item.external_id}`)}
                  onImport={() => void importToLibrary(item)}
                />
              ))}
            </div>
          ) : searched ? (
            <EmptyState title="没有找到相关内容" description="换一个关键词，或使用右侧的推荐搜索词。" />
          ) : (
            <EmptyState title="开始学习发现" description="输入关键词后，系统会从视频、代码、论文和技术文章中发现学习资料。" />
          )}
        </main>

        <aside className="space-y-4 pt-[56px] max-[1100px]:pt-0">
          <section className="rounded-[14px] border border-line bg-white p-4 shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue" />
              <b className="text-small text-ink">为什么推荐</b>
            </div>
            <div className="space-y-2 text-small leading-6 text-muted">
              <p>当前发现流优先围绕专业方向、学习阶段和薄弱点检索内容。</p>
              <p>适合加入资源库的内容，会继续进入“我的资源”进行阅读、下载和 AI 讲解。</p>
            </div>
          </section>

          <section className="rounded-[14px] border border-line bg-white p-4 shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple" />
              <b className="text-small text-ink">当前精选</b>
            </div>
            {highlighted ? (
              <div>
                <span className={`rounded-md px-2 py-1 text-micro font-bold ${getSourceColor(highlighted.source)}`}>{getSourceLabel(highlighted.source)}</span>
                <p className="mt-3 line-clamp-3 text-small font-bold leading-6 text-ink">{highlighted.title}</p>
                <p className="mt-2 line-clamp-4 text-small leading-6 text-muted">{highlighted.summary || '这条内容适合作为当前阶段的拓展学习资料。'}</p>
              </div>
            ) : (
              <p className="text-small text-muted">搜索后会在这里展示最适合优先学习的一条内容。</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function DiscoveryCard({
  item,
  imported,
  importing,
  onImport,
}: {
  item: InfoItem
  imported: boolean
  importing: boolean
  onImport: () => void
}) {
  return (
    <article className="overflow-hidden rounded-[14px] border border-line bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="grid grid-cols-[148px_minmax(0,1fr)] gap-4 max-[640px]:grid-cols-1">
        {item.thumbnail && (
          // 外部采集缩略图域名不可预知，保留原生 img 避免 Next Image 远程域名拦截。
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt={item.title}
            className="h-[108px] w-full rounded-[10px] object-cover max-[640px]:h-[180px]"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        )}
        <div className="min-w-0 overflow-hidden">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-1 text-micro font-bold ${getSourceColor(item.source)}`}>{getSourceLabel(item.source)}</span>
            <span className="rounded-md bg-[#eef5ff] px-2 py-1 text-micro font-bold text-blue">学习发现</span>
            {item.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-md bg-[#f1f5f9] px-2 py-1 text-micro font-bold text-muted">{tag}</span>
            ))}
          </div>

          <a href={item.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 break-words text-[17px] font-bold leading-6 text-ink hover:text-blue">
            {item.title}
          </a>
          <p className="mt-2 line-clamp-2 text-small leading-6 text-muted">{item.summary || '暂无摘要，建议打开原文快速判断是否适合加入学习资源库。'}</p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex flex-wrap items-center gap-3 text-micro text-muted">
              {item.author && <span className="max-w-[180px] truncate">{item.author}</span>}
              {numberMeta(item.extra_data?.stars) && <span>Stars {numberMeta(item.extra_data?.stars)}</span>}
              {numberMeta(item.extra_data?.play) && <span>播放 {numberMeta(item.extra_data?.play)}</span>}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={onImport}
                disabled={importing || imported}
                className={`inline-flex h-9 items-center gap-2 rounded-[8px] px-3 text-small font-bold transition-colors ${
                  imported ? 'bg-green-light text-green' : 'bg-blue text-white hover:bg-blue-dark'
                } disabled:opacity-80`}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : imported ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {imported ? '已加入' : '加入资源库'}
              </button>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-line bg-white px-3 text-small font-bold text-muted hover:text-blue" title="打开原文">
                <ExternalLink className="h-4 w-4" />
                原文
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-[14px] border border-line bg-white p-6 text-center">
      <div>
        <Globe className="mx-auto mb-4 h-11 w-11 text-[#cbd5e1]" />
        <b className="text-h2 text-ink">{title}</b>
        <p className="mt-2 text-small text-muted">{description}</p>
      </div>
    </div>
  )
}
