'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, FileCheck2, Search, Trash2, XCircle } from 'lucide-react'
import { api, type ForumPost } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

type FilterStatus = 'all' | ForumPost['status']

const STATUS_META: Record<ForumPost['status'], { label: string; tone: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'neutral' }> = {
  pending: { label: '待审核', tone: 'orange' },
  published: { label: '已通过', tone: 'green' },
  rejected: { label: '已驳回', tone: 'red' },
  hidden: { label: '已隐藏', tone: 'purple' },
  deleted: { label: '已下架', tone: 'neutral' },
}

const FILTERS: Array<{ label: string; value: FilterStatus }> = [
  { label: '全部', value: 'all' },
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'published' },
  { label: '已驳回', value: 'rejected' },
  { label: '已下架', value: 'deleted' },
]

export default function AdminForumModerationPage() {
  const [items, setItems] = useState<ForumPost[]>([])
  const [stats, setStats] = useState<Record<ForumPost['status'], number>>({ pending: 0, published: 0, rejected: 0, hidden: 0, deleted: 0 })
  const [status, setStatus] = useState<FilterStatus>('all')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getAdminForumPosts({ status, q: keyword, pageSize: 50 })
      setItems(data.items)
      setStats(data.stats)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '审核列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [keyword, status])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  const total = useMemo(() => Object.values(stats).reduce((sum, value) => sum + value, 0), [stats])

  const updateStatus = async (post: ForumPost, nextStatus: ForumPost['status'], reason: string) => {
    setBusyId(post.id)
    setMessage('')
    try {
      await api.updateAdminForumPostStatus(post.id, nextStatus, reason)
      setMessage(`已将「${post.title}」标记为${STATUS_META[nextStatus].label}`)
      await loadPosts()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="平台管理 / 帖子审核"
        title="帖子审核"
        description="审核学习空间中的帖子内容，支持通过、驳回、隐藏和下架，确保论坛内容可控。"
        actions={<ProtoButton onClick={() => void loadPosts()} variant="secondary">刷新列表</ProtoButton>}
        chips={[
          { value: String(stats.pending), label: '待审核', icon: <AlertTriangle className="h-4 w-4" />, tone: 'orange' },
          { value: String(stats.published), label: '已通过', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'green' },
          { value: String(total), label: '全部帖子', icon: <FileCheck2 className="h-4 w-4" />, tone: 'blue' },
        ]}
      />

      <div className="space-y-5">
        <ProtoCard>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索标题、正文、标签或用户"
                className="h-9 w-full rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] pl-9 pr-3 text-sm outline-none focus:border-[#2563eb]"
              />
            </div>
            {FILTERS.map((item) => (
              <button
                key={item.value}
                onClick={() => setStatus(item.value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  status === item.value ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627b] hover:bg-[#e5e7eb]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {message && <div className="mt-3 rounded-[8px] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#2563eb]">{message}</div>}
        </ProtoCard>

        <ProtoCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#0f172a]">审核队列</h2>
            <Pill tone="blue">{items.length} 条</Pill>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm font-bold text-[#64748b]">正在加载审核数据...</div>
          ) : items.length === 0 ? (
            <SoftCard className="text-sm text-[#64748b]">当前筛选条件下暂无帖子。</SoftCard>
          ) : (
            <div className="space-y-3">
              {items.map((post) => {
                const meta = STATUS_META[post.status]
                const disabled = busyId === post.id
                return (
                  <SoftCard key={post.id} className="bg-white">
                    <div className="grid grid-cols-[1fr_auto] gap-4 max-[900px]:grid-cols-1">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                          <span className="text-xs font-semibold text-[#94a3b8]">#{post.id}</span>
                          <span className="text-xs text-[#94a3b8]">用户：{post.user_id}</span>
                          <span className="text-xs text-[#94a3b8]">更新：{post.updated_at}</span>
                        </div>
                        <h3 className="truncate text-base font-bold text-[#0f172a]">{post.title}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#64748b]">{post.content}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {post.tags.map((tag) => (
                            <span key={tag} className="rounded bg-[#f1f6fc] px-2 py-1 text-[11px] font-bold text-[#52627b]">#{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/plaza/${post.id}`}
                          target="_blank"
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-[#f2f6fb] px-3.5 text-small font-bold text-ink transition-colors hover:bg-[#eaf0f7]"
                        >
                          <Eye className="h-4 w-4" />
                          预览
                        </Link>
                        <ProtoButton disabled={disabled} onClick={() => void updateStatus(post, 'published', '审核通过')} variant="secondary">
                          <CheckCircle2 className="h-4 w-4" />
                          通过
                        </ProtoButton>
                        <ProtoButton disabled={disabled} onClick={() => void updateStatus(post, 'rejected', '内容不符合社区规范')} variant="tertiary">
                          <XCircle className="h-4 w-4" />
                          驳回
                        </ProtoButton>
                        <ProtoButton disabled={disabled} onClick={() => void updateStatus(post, 'deleted', '管理员下架')} variant="tertiary" className="hover:bg-[#fef2f2] hover:text-[#dc2626]">
                          <Trash2 className="h-4 w-4" />
                          下架
                        </ProtoButton>
                      </div>
                    </div>
                  </SoftCard>
                )
              })}
            </div>
          )}
        </ProtoCard>
      </div>
    </div>
  )
}
