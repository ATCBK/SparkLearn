'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { api } from '@/lib/api'

export default function NewForumPostPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const tags = tagsText.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean)
      const post = await api.createForumPost({ title, content, tags })
      if (files.length) {
        await api.uploadForumAttachments(post.id, files)
      }
      router.push(`/forum/${post.id}`)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">发布帖子</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-line">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（120字以内）" className="w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-blue" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="正文内容" rows={10} className="w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-blue" />
        <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="标签，逗号分隔，如：Python,函数" className="w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-blue" />
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="w-full rounded-lg border border-line p-3 text-sm"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg"
        />
        {error && <div className="rounded-lg bg-red-light p-3 text-sm text-red">{error}</div>}
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push('/forum')} className="rounded-lg bg-bg-hover px-4 py-2 text-sm font-bold text-ink">取消</button>
          <button disabled={submitting} className="rounded-lg bg-blue px-4 py-2 text-sm font-bold text-white hover:bg-blue-dark disabled:opacity-60">{submitting ? '发布中...' : '发布'}</button>
        </div>
      </form>
    </div>
  )
}
