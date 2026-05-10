'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react'
import { Download, MessageCircle, Search, Trash2 } from 'lucide-react'
import { api, Resource } from '@/lib/api'
import { Bar, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('全部')
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = await api.getResources()
      setResources(data)
      setSelectedId(prev => prev || data[0]?.id || '')
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '资源读取失败')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => resources.filter((r) => {
    const matchQuery = !query || r.title.includes(query) || r.type.includes(query)
    const matchFilter = filter === '全部' || r.type === filter
    return matchQuery && matchFilter
  }), [resources, query, filter])
  const selected = resources.find(r => r.id === selectedId) || filtered[0]

  async function remove(id: string) {
    await api.deleteResource(id)
    await load()
  }

  return (
    <div>
      <PageHead
        eyebrow="资源与练习 / 资源库"
        title="资源库"
        description="所有生成和推荐过的资源都会沉淀在这里，学习进度会影响后续练习与报告。"
        chips={[
          { value: `${resources.length}`, label: '已保存资源' },
          { value: `${resources.filter(r => r.status === 'completed').length}`, label: '可学习' },
          { value: `${resources.filter(r => r.type === 'ppt').length}`, label: 'PPT' },
        ]}
      />

      <div className="grid grid-cols-[360px_1fr] gap-4 max-[980px]:grid-cols-1">
        <ProtoCard>
          <div className="mb-3 grid gap-2">
            <div className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-[#f9fafb] px-3">
              <Search className="h-4 w-4 text-muted" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-small outline-none" placeholder="搜索资源或知识点" />
            </div>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-[10px] border border-line bg-white px-3 text-small outline-none">
              {['全部', 'document', 'ppt', 'mindmap', 'quiz', 'reading', 'code', 'video'].map(item => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            {filtered.map((res) => (
              <button key={res.id} onClick={() => setSelectedId(res.id)} className={`rounded-[12px] border p-3 text-left ${selected?.id === res.id ? 'border-blue bg-blue-light' : 'border-line bg-white hover:border-blue'}`}>
                <div className="flex items-start justify-between gap-2">
                  <b className="line-clamp-1 text-small text-ink">{res.title}</b>
                  <Pill tone={res.status === 'completed' ? 'green' : res.status === 'failed' ? 'red' : 'blue'}>{res.status}</Pill>
                </div>
                <span className="mt-1 block text-micro text-muted">{typeLabel(res.type)} · 关联薄弱点：函数返回值</span>
              </button>
            ))}
            {!filtered.length && <SoftCard className="text-small text-muted">没有匹配资源。</SoftCard>}
          </div>
        </ProtoCard>

        <ProtoCard>
          {error && <p className="mb-3 rounded-[10px] bg-red-light p-3 text-small text-red">{error}</p>}
          {selected ? (
            <div>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <Pill tone="blue">{typeLabel(selected.type)}</Pill>
                  <h2 className="mt-3 text-[22px] font-bold text-ink">{selected.title}</h2>
                  <p className="mt-2 text-small text-muted">来源：AI 生成 · 关联薄弱点：函数返回值 · 学习进度 {selected.progress ?? 42}%</p>
                </div>
                <Pill tone="green">可学习</Pill>
              </div>
              <Bar value={selected.progress ?? 42} />
              <div className="mt-4 min-h-[300px] overflow-hidden rounded-[12px] border border-line bg-[#f9fafb]">
                {selected.sourceUrl ? (
                  <iframe title={selected.title} src={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'}/api/resources/${selected.id}/preview/html`} className="h-[420px] w-full border-0" />
                ) : (
                  <div className="p-5">
                    <pre className="whitespace-pre-wrap break-words text-small leading-7 text-text">{selected.content || '该资源暂无预览内容。'}</pre>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ProtoButton href="/practice">学完去练习</ProtoButton>
                <ProtoButton variant="secondary"><MessageCircle className="h-4 w-4" />让 AI 讲解</ProtoButton>
                <ProtoButton variant="tertiary" onClick={() => void api.downloadResource(selected.id)}><Download className="h-4 w-4" />下载</ProtoButton>
                <ProtoButton variant="tertiary" onClick={() => void remove(selected.id)}><Trash2 className="h-4 w-4" />删除</ProtoButton>
              </div>
            </div>
          ) : (
            <SoftCard className="text-small text-muted">暂无资源，先到资源中心生成。</SoftCard>
          )}
        </ProtoCard>
      </div>
    </div>
  )
}

function typeLabel(type: string) {
  const map: Record<string, string> = { document: '讲义', ppt: 'PPT', mindmap: '思维导图', quiz: '题集', reading: '阅读', code: '代码案例', video: '视频' }
  return map[type] || type
}
