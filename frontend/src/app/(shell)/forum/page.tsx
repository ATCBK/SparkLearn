'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api, ForumPost } from '@/lib/api'

export default function ForumPage() {
  const [tab, setTab] = useState<'latest' | 'hot' | 'recommended'>('latest')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadPosts(nextTab: 'latest' | 'hot' | 'recommended', keyword: string) {
    setLoading(true)
    setError('')
    try {
      const data = await api.getForumPosts({ tab: nextTab, q: keyword })
      setItems(data.items || [])
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPosts(tab, q)
  }, [tab])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">学习论坛</h1>
          <p className="text-sm text-muted">发帖交流与资料共享，独立页面跳转使用。</p>
        </div>
        <Link href="/forum/new" className="rounded-lg bg-blue px-4 py-2 text-sm font-bold text-white hover:bg-blue-dark">发布帖子</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['latest', 'hot', 'recommended'] as const).map((x) => (
          <button
            key={x}
            onClick={() => setTab(x)}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === x ? 'bg-blue text-white' : 'bg-white text-ink ring-1 ring-line'}`}
          >
            {x === 'latest' ? '最新' : x === 'hot' ? '热门' : '推荐'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-line">
        <Search className="h-4 w-4 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void loadPosts(tab, q)
            }
          }}
          className="w-full bg-transparent text-sm outline-none"
          placeholder="模糊搜索帖子（标题/正文/标签）"
        />
        <button onClick={() => void loadPosts(tab, q)} className="rounded bg-bg-hover px-2 py-1 text-xs font-bold text-ink">搜索</button>
      </div>

      {error && <div className="rounded-lg bg-red-light p-3 text-sm text-red">{error}</div>}
      {loading && <div className="rounded-lg bg-white p-4 text-sm text-muted ring-1 ring-line">加载中...</div>}

      <div className="space-y-3">
        {items.map((post) => (
          <Link key={post.id} href={`/forum/${post.id}`} className="block rounded-xl bg-white p-4 ring-1 ring-line hover:ring-blue">
            <h2 className="text-lg font-bold text-ink">{post.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-muted">{post.content}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>👍 {post.like_count}</span>
              <span>💬 {post.comment_count}</span>
              <span>⭐ {post.favorite_count}</span>
              {post.tags?.map((tag) => <span key={tag} className="rounded bg-bg-hover px-2 py-0.5">#{tag}</span>)}
            </div>
          </Link>
        ))}
        {!loading && !items.length && <div className="rounded-lg bg-white p-4 text-sm text-muted ring-1 ring-line">暂无帖子</div>}
      </div>
    </div>
  )
}
