'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHead, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'
import { api, TeacherBroadcast, TeacherMaterialFile, TeacherRecipient } from '@/lib/api'

export default function TeacherBroadcastPage() {
  const [recipients, setRecipients] = useState<TeacherRecipient[]>([])
  const [materials, setMaterials] = useState<TeacherMaterialFile[]>([])
  const [broadcasts, setBroadcasts] = useState<TeacherBroadcast[]>([])

  const [targetType, setTargetType] = useState<'all' | 'specific'>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)

  const selectedCount = useMemo(() => {
    return targetType === 'all' ? recipients.length : selectedIds.length
  }, [targetType, recipients.length, selectedIds.length])

  async function refreshAll() {
    const [r, m, b] = await Promise.all([
      api.getTeacherRecipients(),
      api.getTeacherMaterials(),
      api.getTeacherBroadcasts(),
    ])
    setRecipients(r)
    setMaterials(m)
    setBroadcasts(b)
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  async function uploadFiles(files: File[]) {
    if (!files.length) return
    setUploading(true)
    setError('')
    try {
      const uploaded = await api.uploadTeacherMaterials(files)
      setMaterials((prev) => [...uploaded, ...prev])
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '资料上传失败')
    } finally {
      setUploading(false)
    }
  }

  async function sendBroadcast() {
    setSending(true)
    setError('')
    try {
      await api.createTeacherBroadcast({
        title,
        content,
        target_type: targetType,
        student_ids: targetType === 'all' ? [] : selectedIds,
        material_file_ids: selectedMaterialIds,
      })
      setTitle('')
      setContent('')
      setSelectedIds([])
      setSelectedMaterialIds([])
      await refreshAll()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 通知分发"
        title="通知与资料分发"
        description="支持向全体学生或指定学生发送通知，并附带资料文件。"
      />

      <div className="grid grid-cols-[1.1fr_1fr] gap-5 max-[1100px]:grid-cols-1">
        <ProtoCard>
          <h2 className="mb-3 text-[18px] font-bold text-[#0f172a]">发送新通知</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setTargetType('all')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${targetType === 'all' ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627B]'}`}>全体学生</button>
              <button onClick={() => setTargetType('specific')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${targetType === 'specific' ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627B]'}`}>指定学生</button>
            </div>

            {targetType === 'specific' && (
              <SoftCard>
                <div className="mb-2 text-xs font-semibold text-[#64748b]">选择接收学生</div>
                <div className="grid max-h-[180px] grid-cols-2 gap-2 overflow-auto max-[760px]:grid-cols-1">
                  {recipients.map((stu) => (
                    <label key={stu.id} className="flex items-center gap-2 rounded-md bg-white p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(stu.id)}
                        onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, stu.id] : prev.filter((x) => x !== stu.id))}
                      />
                      <span>{stu.name}</span>
                    </label>
                  ))}
                </div>
              </SoftCard>
            )}

            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="通知标题" className="h-10 w-full rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm outline-none focus:border-[#2563eb]" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="通知内容" className="w-full rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] p-3 text-sm outline-none focus:border-[#2563eb]" />

            <SoftCard>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-[#64748b]">附带资料（可选）</div>
                <label className="cursor-pointer rounded-md bg-[#e8f1fb] px-2.5 py-1 text-xs font-bold text-[#0f4c81]">
                  {uploading ? '上传中...' : '上传资料'}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => void uploadFiles(Array.from(e.target.files || []))}
                  />
                </label>
              </div>
              <div className="grid max-h-[170px] grid-cols-1 gap-2 overflow-auto">
                {materials.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded-md bg-white p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedMaterialIds.includes(m.id)}
                      onChange={(e) => setSelectedMaterialIds((prev) => e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id))}
                    />
                    <span className="truncate">{m.filename}</span>
                  </label>
                ))}
                {!materials.length && <div className="text-xs text-[#94a3b8]">暂无可选资料</div>}
              </div>
            </SoftCard>

            {error && <div className="rounded-md bg-[#fff1f2] px-3 py-2 text-xs text-[#be123c]">{error}</div>}

            <div className="flex items-center justify-between">
              <div className="text-xs text-[#64748b]">本次接收人数：{selectedCount}</div>
              <ProtoButton onClick={sendBroadcast} disabled={sending}>{sending ? '发送中...' : '发送通知'}</ProtoButton>
            </div>
          </div>
        </ProtoCard>

        <ProtoCard>
          <h2 className="mb-3 text-[18px] font-bold text-[#0f172a]">发送记录</h2>
          <div className="space-y-2">
            {broadcasts.map((b) => (
              <SoftCard key={b.id} className="bg-white">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm text-[#0f172a]">{b.title}</b>
                  <span className="text-[10px] text-[#64748b]">{b.target_type === 'all' ? '全体学生' : `指定 ${b.target_student_ids.length} 人`}</span>
                </div>
                <p className="mt-1 text-xs text-[#475569]">{b.content}</p>
                <div className="mt-1 text-[10px] text-[#94a3b8]">{b.created_at}</div>
                {b.materials?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {b.materials.map((m) => (
                      <a
                        key={m.id}
                        href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'}/api/teacher/broadcast/materials/${m.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-[#e8f1fb] px-2 py-1 text-[10px] font-bold text-[#0f4c81]"
                      >
                        {m.filename}
                      </a>
                    ))}
                  </div>
                )}
              </SoftCard>
            ))}
            {!broadcasts.length && <div className="text-sm text-[#64748b]">暂无发送记录</div>}
          </div>
        </ProtoCard>
      </div>
    </div>
  )
}
