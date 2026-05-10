'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

type WrongItem = Awaited<ReturnType<typeof api.getWrongQuizItems>>[number]

export default function MistakesPage() {
  const [items, setItems] = useState<WrongItem[]>([])
  async function load() { setItems(await api.getWrongQuizItems()) }
  async function remove(id: string) { await api.deleteWrongQuizItem(id); await load() }
  useEffect(() => { void load() }, [])
  return (
    <div>
      <PageHead eyebrow="资源与练习 / 错题本" title="错题本" description="错题按知识点和错因沉淀，用于后续补弱资源和路径调整。" actions={<ProtoButton href="/practice" variant="secondary">返回练习评测</ProtoButton>} />
      <div className="grid gap-3">
        {items.map((item) => (
          <ProtoCard key={item.quizId}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Pill tone="orange">错 {item.count} 次</Pill>
                <h2 className="mt-3 text-h2 font-bold text-ink">{item.content}</h2>
                <p className="mt-2 text-small text-muted">错因分类：概念混淆 · 关联知识点：函数返回值</p>
              </div>
              <div className="flex gap-2">
                <ProtoButton href="/practice" variant="secondary"><RotateCcw className="h-4 w-4" />再练一次</ProtoButton>
                <button onClick={() => void remove(item.quizId)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-red-light hover:text-red" aria-label="删除错题"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </ProtoCard>
        ))}
        {!items.length && <SoftCard className="text-small text-muted">暂无错题，完成一次练习后会自动沉淀。</SoftCard>}
      </div>
    </div>
  )
}
