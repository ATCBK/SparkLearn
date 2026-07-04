'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Database, Edit3, FileText, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'
import { createTeacherSubject, deleteTeacherSubject, getKnowledgeFiles, getTeacherSubjects, indexKnowledgeFile, updateTeacherSubject, uploadKnowledgeFiles } from '@/lib/api/real'
import type { KnowledgeFile, TeacherSubject } from '@/lib/api/types'

export default function TeacherSubjectsPage() {
  const [subjects, setSubjects] = useState<TeacherSubject[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(0)
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([])

  const enabledCount = useMemo(() => subjects.filter((item) => item.enabled).length, [subjects])
  const selectedSubject = useMemo(
    () => subjects.find((item) => item.id === selectedSubjectId) || subjects[0],
    [selectedSubjectId, subjects],
  )
  const indexedCount = useMemo(() => knowledgeFiles.filter((item) => item.status === 'indexed').length, [knowledgeFiles])

  async function loadSubjects() {
    setLoading(true)
    try {
      const data = await getTeacherSubjects()
      setSubjects(data)
      setSelectedSubjectId((current) => data.some((item) => item.id === current) ? current : data[0]?.id || 0)
    } catch (error) {
      setToast(error instanceof Error ? error.message : '学科列表加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubjects()
  }, [])

  useEffect(() => {
    if (!selectedSubject?.id) return
    loadKnowledgeFiles(selectedSubject.id)
  }, [selectedSubject?.id])

  async function loadKnowledgeFiles(subjectId: number) {
    try {
      const data = await getKnowledgeFiles({ subjectId })
      setKnowledgeFiles(data)
    } catch (error) {
      setToast(error instanceof Error ? error.message : '学科知识库加载失败')
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await updateTeacherSubject(editingId, { name, code, description, enabled })
        setToast('学科已更新，学生端会同步最新配置')
      } else {
        await createTeacherSubject({ name, code, description, enabled })
        setToast('学科已创建，学生端可选择')
      }
      resetSubjectForm()
      await loadSubjects()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  function resetSubjectForm() {
    setName('')
    setCode('')
    setDescription('')
    setEnabled(true)
    setEditingId(null)
  }

  function startEdit(subject: TeacherSubject) {
    setEditingId(subject.id)
    setName(subject.name)
    setCode(subject.code)
    setDescription(subject.description)
    setEnabled(subject.enabled)
  }

  async function handleToggleEnabled(subject: TeacherSubject) {
    setSaving(true)
    try {
      await updateTeacherSubject(subject.id, {
        name: subject.name,
        code: subject.code,
        description: subject.description,
        enabled: !subject.enabled,
      })
      setToast(!subject.enabled ? '学科已启用，学生端可选择' : '学科已停用，学生端不再展示')
      await loadSubjects()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '状态更新失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(subject: TeacherSubject) {
    const ok = window.confirm(`确定删除「${subject.name}」吗？学生端将不再展示该学科。`)
    if (!ok) return
    setSaving(true)
    try {
      await deleteTeacherSubject(subject.id)
      if (editingId === subject.id) resetSubjectForm()
      setToast('学科已删除，学生端列表已同步移除')
      await loadSubjects()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '删除失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleKnowledgeUpload(fileList: FileList | null) {
    if (!fileList?.length || !selectedSubject?.id) return
    setSaving(true)
    try {
      const uploaded = await uploadKnowledgeFiles([...fileList], selectedSubject.id)
      setToast(`已上传 ${uploaded.length} 个资料，请点击“整理入库”生成 RAG 索引`)
      await loadKnowledgeFiles(selectedSubject.id)
    } catch (error) {
      setToast(error instanceof Error ? error.message : '上传失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleIndex(file: KnowledgeFile) {
    setSaving(true)
    try {
      await indexKnowledgeFile(file.id)
      setToast(`${file.filename} 已整理为可检索知识片段`)
      if (selectedSubject?.id) await loadKnowledgeFiles(selectedSubject.id)
    } catch (error) {
      setToast(error instanceof Error ? error.message : '整理入库失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 学科目录"
        title="学科管理"
        description="维护学生登录与建档时可选择的学科，让平台从固定 Python 场景切换为多学科展示。"
        chips={[
          { value: `${subjects.length}`, label: '全部学科', icon: <BookOpen className="h-4 w-4" />, tone: 'blue' },
          { value: `${enabledCount}`, label: '学生可选', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'green' },
        ]}
      />

      {toast && (
        <div className="mb-4 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm font-semibold text-[#1d4ed8]">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-[0.95fr_1.35fr] gap-5 max-[1080px]:grid-cols-1">
        <div className="space-y-5">
          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">{editingId ? '编辑学科' : '创建学科'}</h2>
              <Pill tone="blue">{editingId ? '同步修改' : '单个添加'}</Pill>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">学科名称</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：初中数学"
                  className="h-11 w-full rounded-lg border border-[#dbe7f5] bg-white px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">学科编码</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="例如：math-junior"
                  className="h-11 w-full rounded-lg border border-[#dbe7f5] bg-white px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">展示说明</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="用于教师端说明，也可辅助后续资源生成"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#dbe7f5] bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-[#dbe7f5] bg-[#f8fafc] px-3 py-2.5">
                <span className="text-sm font-bold text-[#334155]">学生端可选择</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="h-5 w-5 accent-[#2563eb]"
                />
              </label>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] text-sm font-bold text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {editingId ? '保存修改' : '创建学科'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetSubjectForm}
                  className="h-10 w-full rounded-lg border border-[#dbe7f5] bg-white text-sm font-bold text-[#64748b] hover:bg-[#f8fafc]"
                >
                  取消编辑
                </button>
              )}
            </form>
          </ProtoCard>

          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">导入学科知识库</h2>
              <Pill tone="green">RAG</Pill>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#64748b]">选择学科</span>
              <select
                value={selectedSubject?.id || 0}
                onChange={(event) => setSelectedSubjectId(Number(event.target.value))}
                className="h-11 w-full rounded-lg border border-[#dbe7f5] bg-white px-3 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#93c5fd] bg-[#eff6ff] px-4 text-center text-sm font-bold text-[#1d4ed8] hover:bg-[#dbeafe]">
              <Upload className="h-5 w-5" />
              上传 PDF / Markdown / TXT 资料
              <span className="text-xs font-medium text-[#64748b]">资料会绑定到当前学科，整理后进入 RAG 检索</span>
              <input
                type="file"
                multiple
                accept=".pdf,.md,.txt,text/plain,application/pdf"
                className="hidden"
                onChange={(event) => void handleKnowledgeUpload(event.target.files)}
              />
            </label>
          </ProtoCard>
        </div>

        <ProtoCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-bold text-[#0f172a]">学生可选学科目录</h2>
              <p className="mt-1 text-xs text-[#64748b]">学生首次建档会读取这里的启用学科；学科资料会作为 RAG 上下文。</p>
            </div>
            <ProtoButton onClick={loadSubjects} variant="secondary">
              <RefreshCw className="h-4 w-4" />
              刷新
            </ProtoButton>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center text-sm text-[#64748b]">加载学科目录...</div>
          ) : subjects.length === 0 ? (
            <SoftCard className="text-sm text-[#64748b]">暂无学科，请先创建或导入。</SoftCard>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
              {subjects.map((subject) => (
                <article key={subject.id} className="rounded-xl border border-[#dbe7f5] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-[#0f172a]">{subject.name}</h3>
                      <p className="mt-1 text-xs font-semibold text-[#2563eb]">{subject.code || '未设置编码'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${subject.enabled ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                      {subject.enabled ? '启用' : '停用'}
                    </span>
                  </div>
                  <p className="min-h-[40px] text-sm leading-5 text-[#64748b]">
                    {subject.description || '暂无说明，可用于展示不同学科方向。'}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => startEdit(subject)}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#dbe7f5] bg-white text-xs font-bold text-[#2563eb] hover:bg-[#eff6ff]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      编辑
                    </button>
                    <button
                      onClick={() => void handleToggleEnabled(subject)}
                      disabled={saving}
                      className="h-9 rounded-lg border border-[#dbe7f5] bg-white text-xs font-bold text-[#0f766e] hover:bg-[#ecfdf5] disabled:opacity-50"
                    >
                      {subject.enabled ? '停用' : '启用'}
                    </button>
                    <button
                      onClick={() => void handleDelete(subject)}
                      disabled={saving}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#fecaca] bg-white text-xs font-bold text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </ProtoCard>
      </div>

      <ProtoCard className="mt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#0f172a]">{selectedSubject?.name || '学科'} RAG 资料</h2>
            <p className="mt-1 text-xs text-[#64748b]">已整理资料会在资源生成与问答中作为检索上下文。</p>
          </div>
          <Pill tone="cyan">
            <Database className="h-4 w-4" />
            {indexedCount}/{knowledgeFiles.length} 已入库
          </Pill>
        </div>
        {knowledgeFiles.length === 0 ? (
          <SoftCard className="text-sm text-[#64748b]">当前学科还没有资料，请先上传课程资料。</SoftCard>
        ) : (
          <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-[760px]:grid-cols-1">
            {knowledgeFiles.map((file) => (
              <article key={file.id} className="rounded-xl border border-[#dbe7f5] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eff6ff] text-[#2563eb]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#0f172a]">{file.filename}</h3>
                    <p className="mt-1 text-xs text-[#64748b]">{file.chunkCount} 个片段 · {file.status}</p>
                  </div>
                </div>
                <p className="mb-3 line-clamp-2 min-h-[40px] text-xs leading-5 text-[#64748b]">
                  {file.summary || '等待整理入库后生成摘要。'}
                </p>
                <button
                  onClick={() => void handleIndex(file)}
                  disabled={saving || file.status === 'processing'}
                  className="h-9 w-full rounded-lg bg-[#2563eb] text-xs font-bold text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {file.status === 'indexed' ? '重新整理入库' : '整理入库'}
                </button>
              </article>
            ))}
          </div>
        )}
      </ProtoCard>
    </div>
  )
}
