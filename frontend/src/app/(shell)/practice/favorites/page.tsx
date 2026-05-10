'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { BookmarkX } from 'lucide-react'
import { api } from '@/lib/api'
import { PageHead, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

type FavItem = Awaited<ReturnType<typeof api.getQuizFavorites>>[number]

export default function FavoritesPage() {
  const [items, setItems] = useState<FavItem[]>([])
  async function load() { setItems(await api.getQuizFavorites()) }
  async function remove(id: string) { await api.setQuizFavorite(id, false); await load() }
  useEffect(() => { void load() }, [])
  return (
    <div>
      <PageHead eyebrow="资源与练习 / 收藏题目" title="收藏题目" description="收藏题可用于生成复习练习，适合考前集中回顾。" actions={<ProtoButton href="/practice" variant="secondary">返回练习评测</ProtoButton>} />
      <div className="grid gap-3">
        {items.map((item) => (
          <ProtoCard key={item.quizId}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-h2 font-bold text-ink">{String(item.question?.content || `收藏题 ${item.quizId}`)}</h2>
                <p className="mt-2 text-small text-muted">收藏时间：{item.createdAt || '刚刚'} · 可加入复习练习</p>
              </div>
              <div className="flex gap-2">
                <ProtoButton href="/practice">加入练习</ProtoButton>
                <button onClick={() => void remove(item.quizId)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-red-light hover:text-red" aria-label="取消收藏"><BookmarkX className="h-4 w-4" /></button>
              </div>
            </div>
          </ProtoCard>
        ))}
        {!items.length && <SoftCard className="text-small text-muted">暂无收藏题。</SoftCard>}
      </div>
    </div>
  )
}
