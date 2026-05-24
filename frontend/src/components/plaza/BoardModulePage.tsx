'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { MessageSquare, Plus, Search, X } from 'lucide-react'
import { api, ForumPost } from '@/lib/api'

type Tab = 'latest' | 'hot' | 'recommended'

export function BoardModulePage({ title, description, boardTag }: { title: string; description: string; boardTag: string }) {
  const [tab, setTab] = useState<Tab>('latest')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  async function loadPosts(nextTab: Tab, keyword: string) {
    setLoading(true)
    setError('')
    try {
      const data = await api.getForumPosts({ tab: nextTab, q: keyword, tag: boardTag })
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

  async function submitPost(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const manualTags = tagsText.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean)
      const tags = Array.from(new Set([boardTag, ...manualTags]))
      const post = await api.createForumPost({ title: postTitle, content, tags })
      if (files.length) await api.uploadForumAttachments(post.id, files)
      setShowComposer(false)
      setPostTitle('')
      setContent('')
      setTagsText('')
      setFiles([])
      await loadPosts(tab, q)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '发帖失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-lg bg-[#e9eef5] text-[#2f435b]">
            <MessageSquare className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-ink">{title}</h1>
            <p className="text-sm text-muted">{description}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="text-sm font-bold text-ink">帖子数：{items.length}</div>
          <div className="flex items-center gap-2">
            <select value={tab} onChange={(e) => setTab(e.target.value as Tab)} className="rounded-md border border-line bg-white px-2 py-1 text-sm">
              <option value="latest">最新发布</option>
              <option value="hot">热门</option>
              <option value="recommended">推荐</option>
            </select>
            <div className="flex items-center gap-2 rounded-md border border-line px-2 py-1">
              <Search className="h-4 w-4 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void loadPosts(tab, q)}
                className="w-[220px] bg-transparent text-sm outline-none"
                placeholder="搜索本模块帖子"
              />
              <button onClick={() => void loadPosts(tab, q)} className="text-xs font-bold text-blue">搜索</button>
            </div>
          </div>
        </div>
        {error && <div className="px-4 py-3 text-sm text-red">{error}</div>}
        {loading && <div className="px-4 py-3 text-sm text-muted">加载中...</div>}
        <div>
          {items.map((post) => (
            <Link key={post.id} href={`/plaza/${post.id}`} className="block border-b border-line px-4 py-4 hover:bg-[#f9fbff]">
              <h2 className="truncate text-lg font-bold text-ink">{post.title}</h2>
              <p className="mt-1 line-clamp-1 text-sm text-muted">{post.content}</p>
            </Link>
          ))}
          {!loading && !items.length && <div className="px-4 py-5 text-sm text-muted">本模块暂无帖子</div>}
        </div>
      </section>

      <button onClick={() => setShowComposer(true)} className="fixed bottom-8 right-8 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#2f435b] text-white shadow-lg hover:bg-[#24364b]" aria-label="发帖">
        <Plus className="h-6 w-6" />
      </button>

      {showComposer && (
        <div className="fixed inset-0 z-[60] bg-black/35 p-4">
          <div className="mx-auto mt-20 max-w-3xl rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-ink">发布到：{title}</h3>
              <button onClick={() => setShowComposer(false)} className="rounded-md p-1 text-ink-secondary hover:bg-bg-hover"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={submitPost} className="space-y-3">
              <input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="标题（120字以内）" className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-blue" />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="正文内容" rows={8} className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-blue" />
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder={`标签，默认自动带上 ${boardTag}`} className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-blue" />
              <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full rounded-lg border border-line px-3 py-2 text-sm" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowComposer(false)} className="rounded-lg bg-bg-hover px-3 py-2 text-sm font-bold text-ink">取消</button>
                <button disabled={submitting} className="rounded-lg bg-blue px-3 py-2 text-sm font-bold text-white disabled:opacity-60">{submitting ? '发布中...' : '发布'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
