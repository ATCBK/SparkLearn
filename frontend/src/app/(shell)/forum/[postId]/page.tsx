'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, ForumAttachment, ForumComment, ForumPost } from '@/lib/api'

export default function ForumPostDetailPage() {
  const params = useParams<{ postId: string }>()
  const postId = Number(params.postId)

  const [post, setPost] = useState<ForumPost | null>(null)
  const [attachments, setAttachments] = useState<ForumAttachment[]>([])
  const [comments, setComments] = useState<ForumComment[]>([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [commentError, setCommentError] = useState('')

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
    if (!Number.isNaN(postId)) {
      void loadAll()
    }
  }, [postId])

  if (error) {
    return <div className="rounded-lg bg-red-light p-3 text-sm text-red">{error}</div>
  }
  if (!post) {
    return <div className="rounded-lg bg-white p-4 text-sm text-muted ring-1 ring-line">加载中...</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/forum" className="text-sm font-bold text-blue hover:text-blue-dark">← 返回论坛</Link>

      <div className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h1 className="text-2xl font-bold text-ink">{post.title}</h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
          <span>👍 {post.like_count}</span>
          <span>💬 {post.comment_count}</span>
          <span>⭐ {post.favorite_count}</span>
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink">{post.content}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags?.map((tag) => <span key={tag} className="rounded bg-bg-hover px-2 py-1 text-xs">#{tag}</span>)}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={async () => { await api.toggleForumLike(post.id); await loadAll() }} className="rounded-lg bg-bg-hover px-3 py-2 text-sm font-bold text-ink">点赞</button>
          <button onClick={async () => { await api.toggleForumFavorite(post.id); await loadAll() }} className="rounded-lg bg-bg-hover px-3 py-2 text-sm font-bold text-ink">收藏</button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="text-lg font-bold text-ink">共享资料</h2>
        <div className="mt-3 space-y-2">
          {attachments.map((x) => (
            <a key={x.id} href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'}/api/forum/attachments/${x.id}/download`} className="block rounded-lg bg-bg-hover px-3 py-2 text-sm text-blue hover:text-blue-dark" target="_blank">
              {x.filename}
            </a>
          ))}
          {!attachments.length && <p className="text-sm text-muted">暂无附件</p>}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="text-lg font-bold text-ink">评论区</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              if (commentError) setCommentError('')
            }}
            placeholder="写下你的评论"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <button
            onClick={async () => {
              if (!comment.trim()) {
                setCommentError('请输入评论内容')
                return
              }
              await api.createForumComment(post.id, comment)
              setComment('')
              setCommentError('')
              await loadAll()
            }}
            className="rounded-lg bg-blue px-3 py-2 text-sm font-bold text-white hover:bg-blue-dark"
          >
            发送
          </button>
        </div>
        {commentError && <div className="mt-2 rounded-lg bg-red-light p-2 text-sm text-red">{commentError}</div>}
        <div className="mt-4 space-y-2">
          {comments.map((x) => (
            <div key={x.id} className="rounded-lg bg-bg-hover p-3 text-sm text-ink">
              {x.content}
            </div>
          ))}
          {!comments.length && <p className="text-sm text-muted">暂无评论</p>}
        </div>
      </div>
    </div>
  )
}
