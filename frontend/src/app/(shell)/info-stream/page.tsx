'use client'

import { useState, useEffect } from 'react'
import { Search, Bookmark, BookmarkCheck, ExternalLink, PlayCircle, Code, FileText, PenTool, Globe, Loader2 } from 'lucide-react'

interface InfoItem {
  source: string
  external_id: string
  title: string
  summary: string
  url: string
  thumbnail: string
  author: string
  tags: string[]
  extra_data?: Record<string, any>
}

interface Source {
  id: string
  name: string
  icon: string
}

const SOURCE_ICONS: Record<string, any> = {
  globe: Globe,
  'play-circle': PlayCircle,
  github: Code,
  'file-text': FileText,
  'pen-tool': PenTool,
}

export default function InfoStreamPage() {
  const [keyword, setKeyword] = useState('')
  const [activeSource, setActiveSource] = useState('all')
  const [sources, setSources] = useState<Source[]>([])
  const [items, setItems] = useState<InfoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchSources()
    fetchBookmarks()
  }, [])

  async function fetchSources() {
    try {
      const res = await fetch('/api/info-stream/sources')
      const json = await res.json()
      if (json.success) setSources(json.data)
    } catch {}
  }

  async function fetchBookmarks() {
    try {
      const token = localStorage.getItem('sparklearn_token')
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/info-stream/bookmarks', { headers })
      const json = await res.json()
      if (json.success) {
        setBookmarks(new Set(json.data.map((b: any) => `${b.source}:${b.external_id}`)))
      }
    } catch {}
  }

  async function handleSearch() {
    if (!keyword.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({ keyword, source: activeSource, page_size: '15' })
      const res = await fetch(`/api/info-stream/search?${params}`)
      const json = await res.json()
      if (json.success) setItems(json.data.items || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  async function handleBookmark(item: InfoItem) {
    try {
      const token = localStorage.getItem('sparklearn_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/info-stream/bookmark', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source: item.source,
          external_id: item.external_id,
          title: item.title,
          url: item.url,
          summary: item.summary,
          thumbnail: item.thumbnail,
          author: item.author,
          tags: item.tags,
        }),
      })
      const json = await res.json()
      if (json.success) {
        const key = `${item.source}:${item.external_id}`
        setBookmarks((prev) => {
          const next = new Set(prev)
          if (json.data.bookmarked) next.add(key)
          else next.delete(key)
          return next
        })
      }
    } catch {}
  }

  function getSourceLabel(source: string): string {
    const map: Record<string, string> = {
      bilibili: 'B站',
      github: 'GitHub',
      arxiv: 'arXiv',
      juejin: '掘金',
    }
    return map[source] || source
  }

  function getSourceColor(source: string): string {
    const map: Record<string, string> = {
      bilibili: 'bg-pink-100 text-pink-700',
      github: 'bg-gray-100 text-gray-700',
      arxiv: 'bg-red-100 text-red-700',
      juejin: 'bg-blue-100 text-blue-700',
    }
    return map[source] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">信息流</h1>
        <p className="text-sm text-[#6b7280] mt-1">搜索和发现学习资源，来自 B站、GitHub、学术论文等多个来源</p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索学习资源..."
            className="w-full h-11 pl-11 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !keyword.trim()}
          className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#075ff0] to-[#5aa2ff] text-white text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : '搜索'}
        </button>
      </div>

      {/* Source Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sources.map((src) => {
          const Icon = SOURCE_ICONS[src.icon] || Globe
          return (
            <button
              key={src.id}
              onClick={() => { setActiveSource(src.id); if (searched) handleSearch() }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeSource === src.id
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'bg-white text-[#52627b] border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} />
              {src.name}
            </button>
          )
        })}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[#2563eb]" />
          <span className="ml-2 text-sm text-[#6b7280]">搜索中...</span>
        </div>
      ) : items.length > 0 ? (
        <div className="grid gap-4">
          {items.map((item, idx) => (
            <div
              key={`${item.source}-${item.external_id}-${idx}`}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4">
                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-24 h-18 object-cover rounded-xl shrink-0"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${getSourceColor(item.source)}`}>
                          {getSourceLabel(item.source)}
                        </span>
                        {item.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-md text-xs bg-gray-100 text-gray-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-[#111827] hover:text-[#2563eb] line-clamp-1"
                      >
                        {item.title}
                      </a>
                      {item.summary && (
                        <p className="text-sm text-[#6b7280] mt-1 line-clamp-2">{item.summary}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#9ca3af]">
                        {item.author && <span>{item.author}</span>}
                        {item.extra_data?.stars && <span>⭐ {item.extra_data.stars.toLocaleString()}</span>}
                        {item.extra_data?.play && <span>▶ {item.extra_data.play.toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleBookmark(item)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title={bookmarks.has(`${item.source}:${item.external_id}`) ? '取消收藏' : '收藏'}
                      >
                        {bookmarks.has(`${item.source}:${item.external_id}`) ? (
                          <BookmarkCheck size={18} className="text-[#2563eb]" />
                        ) : (
                          <Bookmark size={18} className="text-[#9ca3af]" />
                        )}
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title="打开链接"
                      >
                        <ExternalLink size={18} className="text-[#9ca3af]" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : searched ? (
        <div className="text-center py-20">
          <Search size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-[#6b7280]">未找到相关结果，换个关键词试试</p>
        </div>
      ) : (
        <div className="text-center py-20">
          <Globe size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-[#6b7280]">输入关键词搜索学习资源</p>
          <p className="text-xs text-[#9ca3af] mt-1">支持 B站视频、GitHub 仓库、学术论文、掘金文章</p>
        </div>
      )}
    </div>
  )
}
