'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, ForumPost } from '@/lib/api'

export default function MyLikesPage() {
  const [items, setItems] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api.getMyLikedPosts().then((d) => setItems(d.items || [])).finally(() => setLoading(false))
  }, [])

  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="border-b border-line px-4 py-3 text-lg font-extrabold text-ink">我点赞</div>
      {loading && <div className="px-4 py-4 text-sm text-muted">加载中...</div>}
      {!loading && items.map((post) => (
        <Link key={post.id} href={`/plaza/${post.id}`} className="block border-b border-line px-4 py-4 hover:bg-[#f9fbff]">
          <h3 className="font-bold text-ink">{post.title}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-muted">{post.content}</p>
        </Link>
      ))}
      {!loading && !items.length && <div className="px-4 py-4 text-sm text-muted">暂无点赞记录</div>}
    </section>
  )
}
