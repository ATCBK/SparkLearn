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

  const [viewFilter, setViewFilter] = useState<'all' | 'viewed' | 'unviewed'>('all')
  const [viewedMap, setViewedMap] = useState<Record<number, boolean>>({})

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('teacher_broadcast_viewed_map')
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, boolean>
      const next: Record<number, boolean> = {}
      for (const [k, v] of Object.entries(parsed)) next[Number(k)] = !!v
      setViewedMap(next)
    } catch {
      setViewedMap({})
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('teacher_broadcast_viewed_map', JSON.stringify(viewedMap))
  }, [viewedMap])

  const viewedCount = useMemo(() => broadcasts.filter((b) => !!viewedMap[b.id]).length, [broadcasts, viewedMap])
  const unviewedCount = useMemo(() => Math.max(0, broadcasts.length - viewedCount), [broadcasts.length, viewedCount])

  const filteredBroadcasts = useMemo(() => {
    if (viewFilter === 'viewed') return broadcasts.filter((b) => !!viewedMap[b.id])
    if (viewFilter === 'unviewed') return broadcasts.filter((b) => !viewedMap[b.id])
    return broadcasts
  }, [broadcasts, viewFilter, viewedMap])

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
      const message = ex instanceof Error ? ex.message : '发送失败'
      const friendly = message.includes('title is required')
        ? '请输入通知标题'
        : message.includes('content is required')
          ? '请输入通知内容'
          : message.includes('student_ids required')
            ? '请选择接收学生'
            : message
      setError(friendly)
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
            {filteredBroadcasts.map((b) => (
              <SoftCard key={b.id} className="bg-white">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm text-[#0f172a]">{b.title}</b>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#64748b]">{b.target_type === 'all' ? '全体学生' : `指定 ${b.target_student_ids.length} 人`}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${viewedMap[b.id] ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fff7ed] text-[#d97706]'}`}>
                      {viewedMap[b.id] ? '已查看' : '未查看'}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-[#475569]">{b.content}</p>
                <div className="mt-1 text-[10px] text-[#94a3b8]">{b.created_at}</div>
                <div className="mt-2">
                  <button
                    onClick={() => setViewedMap((prev) => ({ ...prev, [b.id]: !prev[b.id] }))}
                    className="rounded-md bg-[#f3f4f6] px-2 py-1 text-[10px] font-bold text-[#52627B] hover:bg-[#e5e7eb]"
                  >
                    {viewedMap[b.id] ? '标记为未查看' : '标记为已查看'}
                  </button>
                </div>
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
            {!filteredBroadcasts.length && <div className="text-sm text-[#64748b]">当前筛选下暂无记录</div>}
          </div>
        </ProtoCard>
      </div>

      <ProtoCard className="mt-5">
        <h3 className="mb-3 text-base font-bold text-[#0f172a]">查看状态</h3>
        <div className="mb-3 grid grid-cols-2 gap-2 max-[760px]:grid-cols-1">
          <SoftCard className="bg-white">
            <div className="text-xs text-[#64748b]">已查看</div>
            <div className="mt-1 text-lg font-extrabold text-[#059669]">{viewedCount}</div>
          </SoftCard>
          <SoftCard className="bg-white">
            <div className="text-xs text-[#64748b]">未查看</div>
            <div className="mt-1 text-lg font-extrabold text-[#d97706]">{unviewedCount}</div>
          </SoftCard>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewFilter('all')} className={`rounded-md px-2.5 py-1 text-xs font-bold ${viewFilter === 'all' ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627B]'}`}>全部</button>
          <button onClick={() => setViewFilter('viewed')} className={`rounded-md px-2.5 py-1 text-xs font-bold ${viewFilter === 'viewed' ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627B]'}`}>仅看已查看</button>
          <button onClick={() => setViewFilter('unviewed')} className={`rounded-md px-2.5 py-1 text-xs font-bold ${viewFilter === 'unviewed' ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#52627B]'}`}>仅看未查看</button>
        </div>
      </ProtoCard>
    </div>
  )
}
