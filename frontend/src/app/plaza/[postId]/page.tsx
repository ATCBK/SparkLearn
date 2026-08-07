'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, ForumAttachment, ForumComment, ForumPost } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

export default function PlazaPostDetailPage() {
  const params = useParams<{ postId: string }>()
  const postId = Number(params.postId)
  const invalidPostId = !Number.isInteger(postId) || postId <= 0

  const [post, setPost] = useState<ForumPost | null>(null)
  const [attachments, setAttachments] = useState<ForumAttachment[]>([])
  const [comments, setComments] = useState<ForumComment[]>([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [importingPost, setImportingPost] = useState(false)
  const [importingAttachmentId, setImportingAttachmentId] = useState<number | null>(null)
  const [importMessage, setImportMessage] = useState('')

  async function loadAll() {
    try {
      const detail = await api.getForumPostDetail(postId)
      const list = await api.getForumComments(postId)
      setPost(detail.post)
      setAttachments(detail.attachments || [])
      setComments(list)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '加载失败')
    }
  }

  useEffect(() => {
    if (!invalidPostId) void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidPostId, postId])

  async function importPostToResources() {
    if (!post) return
    setImportingPost(true)
    setImportMessage('')
    try {
      const result = await api.importForumResource(post.id, { mode: 'post' })
      setImportMessage(result.count > 0 ? '已加入我的资源库' : '没有可导入的资源')
    } catch (ex) {
      setImportMessage(ex instanceof Error ? ex.message : '导入失败')
    } finally {
      setImportingPost(false)
    }
  }

  async function importAttachmentToResources(attachmentId: number) {
    if (!post) return
    setImportingAttachmentId(attachmentId)
    setImportMessage('')
    try {
      const result = await api.importForumResource(post.id, { mode: 'attachments', attachment_ids: [attachmentId] })
      setImportMessage(result.count > 0 ? '附件已加入我的资源库' : '没有可导入的附件')
    } catch (ex) {
      setImportMessage(ex instanceof Error ? ex.message : '导入失败')
    } finally {
      setImportingAttachmentId(null)
    }
  }

  if (invalidPostId) {
    return (
      <div className="rounded-xl bg-white p-5 text-sm text-muted ring-1 ring-line">
        <p className="font-bold text-ink">帖子地址无效</p>
        <p className="mt-2">请从学习广场重新选择一个帖子。</p>
        <Link href="/plaza" className="mt-4 inline-flex rounded-lg bg-blue px-3 py-2 text-sm font-bold text-white hover:bg-blue-dark">返回学习广场</Link>
      </div>
    )
  }

  if (error) {
    return <div className="rounded-lg bg-red-light p-3 text-sm text-red">{error}</div>
  }
  if (!post) {
    return <div className="rounded-lg bg-white p-4 text-sm text-muted ring-1 ring-line">加载中...</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/plaza" className="text-sm font-bold text-blue hover:text-blue-dark">
        返回学习广场
      </Link>

      <div className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h1 className="text-2xl font-bold text-ink">{post.title}</h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
          <span>点赞 {post.like_count}</span>
          <span>评论 {post.comment_count}</span>
          <span>收藏 {post.favorite_count}</span>
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink">{post.content}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags?.map((tag) => <span key={tag} className="rounded bg-bg-hover px-2 py-1 text-xs">#{tag}</span>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={async () => { await api.toggleForumLike(post.id); await loadAll() }} className="rounded-lg bg-bg-hover px-3 py-2 text-sm font-bold text-ink">点赞</button>
          <button onClick={async () => { await api.toggleForumFavorite(post.id); await loadAll() }} className="rounded-lg bg-bg-hover px-3 py-2 text-sm font-bold text-ink">收藏</button>
          <button
            onClick={() => void importPostToResources()}
            disabled={importingPost}
            className="rounded-lg bg-blue px-3 py-2 text-sm font-bold text-white hover:bg-blue-dark disabled:opacity-60"
          >
            {importingPost ? '导入中...' : '加入我的资源库'}
          </button>
        </div>
        {importMessage && <p className="mt-3 text-sm font-bold text-blue">{importMessage}</p>}
      </div>

      <div className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="text-lg font-bold text-ink">共享资料</h2>
        <div className="mt-3 space-y-2">
          {attachments.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-bg-hover px-3 py-2">
              <a
                href={`${API_BASE}/api/forum/attachments/${item.id}/download`}
                className="min-w-0 truncate text-sm text-blue hover:text-blue-dark"
                target="_blank"
              >
                {item.filename}
              </a>
              <button
                onClick={() => void importAttachmentToResources(item.id)}
                disabled={importingAttachmentId === item.id}
                className="shrink-0 rounded-md bg-white px-2.5 py-1.5 text-xs font-bold text-ink ring-1 ring-line hover:text-blue disabled:opacity-60"
              >
                {importingAttachmentId === item.id ? '导入中...' : '导入资源库'}
              </button>
            </div>
          ))}
          {!attachments.length && <p className="text-sm text-muted">暂无附件</p>}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="text-lg font-bold text-ink">评论区</h2>
        <div className="mt-3 flex gap-2">
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="写下你的评论" className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-blue" />
          <button
            onClick={async () => {
              if (!comment.trim()) return
              await api.createForumComment(post.id, comment)
              setComment('')
              await loadAll()
            }}
            className="rounded-lg bg-blue px-3 py-2 text-sm font-bold text-white hover:bg-blue-dark"
          >
            发送
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {comments.map((item) => (
            <div key={item.id} className="rounded-lg bg-bg-hover p-3 text-sm text-ink">
              {item.content}
            </div>
          ))}
          {!comments.length && <p className="text-sm text-muted">暂无评论</p>}
        </div>
      </div>
    </div>
  )
}
