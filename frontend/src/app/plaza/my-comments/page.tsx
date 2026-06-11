'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type MyComment = { id: number; post_id: number; post_title: string; content: string; created_at: string }

export default function MyCommentsPage() {
  const [items, setItems] = useState<MyComment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api.getMyForumComments().then((d) => setItems(d.items || [])).finally(() => setLoading(false))
  }, [])

  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="border-b border-line px-4 py-3 text-lg font-extrabold text-ink">我的评论</div>
      {loading && <div className="px-4 py-4 text-sm text-muted">加载中...</div>}
      {!loading && items.map((c) => (
        <Link key={c.id} href={`/plaza/${c.post_id}`} className="block border-b border-line px-4 py-4 hover:bg-[#f9fbff]">
          <h3 className="font-bold text-ink">{c.post_title}</h3>
          <p className="mt-1 text-sm text-muted">{c.content}</p>
          <div className="mt-1 text-xs text-muted">评论时间：{c.created_at}</div>
        </Link>
      ))}
      {!loading && !items.length && <div className="px-4 py-4 text-sm text-muted">暂无评论记录</div>}
    </section>
  )
}
