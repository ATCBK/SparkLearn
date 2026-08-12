'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  Plus,
  RefreshCw,
  RotateCw,
  School,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Bar, PageHead, Pill, ProtoButton, ProtoCard } from '@/components/proto'
import {
  archiveTeacherClass,
  createTeacherClass,
  getTeacherClassMembers,
  getTeacherClasses,
  getTeacherSubjects,
  importTeacherClassMembersFromFiles,
  removeTeacherClassMember,
  resetTeacherClassInviteCode,
  updateTeacherClass,
} from '@/lib/api/real'
import type { TeacherClass, TeacherClassMember, TeacherSubject } from '@/lib/api/types'

type ClassForm = {
  name: string
  subject_id: number
  subject_name: string
  grade: string
  description: string
  status: string
}

type ImportResult = {
  added_count: number
  skipped_count: number
  parsed_count: number
  skipped_files: string[]
  supported_extensions: string[]
}

const emptyForm: ClassForm = {
  name: '',
  subject_id: 0,
  subject_name: '',
  grade: '',
  description: '',
  status: 'active',
}

function riskTone(risk: string): 'green' | 'orange' | 'red' {
  if (risk === 'danger') return 'red'
  if (risk === 'warning') return 'orange'
  return 'green'
}

function riskLabel(risk: string) {
  if (risk === 'danger') return '高风险'
  if (risk === 'warning') return '需关注'
  return '稳定'
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [subjects, setSubjects] = useState<TeacherSubject[]>([])
  const [members, setMembers] = useState<TeacherClassMember[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number>(0)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ClassForm>(emptyForm)
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFiles, setImportFiles] = useState<File[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || classes[0],
    [classes, selectedClassId],
  )

  const activeCount = useMemo(() => classes.filter((item) => item.status === 'active').length, [classes])
  const riskCount = useMemo(() => members.filter((item) => item.risk_level !== 'normal').length, [members])
  const filteredMembers = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return members
    return members.filter((item) =>
      [item.name, item.id, item.major, item.grade, item.current_stage].some((value) =>
        String(value || '').toLowerCase().includes(keyword),
      ),
    )
  }, [members, query])

  async function loadClasses() {
    setLoading(true)
    try {
      const [classData, subjectData] = await Promise.all([getTeacherClasses(), getTeacherSubjects(true)])
      setClasses(classData)
      setSubjects(subjectData)
      setSelectedClassId((current) => (classData.some((item) => item.id === current) ? current : classData[0]?.id || 0))
    } catch (error) {
      setToast(error instanceof Error ? error.message : '班级数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadMembers(classId: number) {
    if (!classId) {
      setMembers([])
      return
    }
    setMembersLoading(true)
    try {
      setMembers(await getTeacherClassMembers(classId))
    } catch (error) {
      setToast(error instanceof Error ? error.message : '班级成员加载失败')
    } finally {
      setMembersLoading(false)
    }
  }

  useEffect(() => {
    void loadClasses()
  }, [])

  useEffect(() => {
    void loadMembers(selectedClass?.id || 0)
  }, [selectedClass?.id])

  useEffect(() => {
    if (!modalOpen && !importModalOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (saving) return
      if (importModalOpen) {
        setImportModalOpen(false)
        setImportFiles([])
        setImportResult(null)
      } else if (modalOpen) {
        setModalOpen(false)
        setEditingId(null)
        setForm(emptyForm)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [importModalOpen, modalOpen, saving])

  function patchForm<K extends keyof ClassForm>(key: K, value: ClassForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubjectChange(subjectId: number) {
    const subject = subjects.find((item) => item.id === subjectId)
    setForm((prev) => ({
      ...prev,
      subject_id: subjectId,
      subject_name: subject?.name || '',
    }))
  }

  function openCreateModal() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEditModal(item: TeacherClass) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      subject_id: item.subject_id,
      subject_name: item.subject_name,
      grade: item.grade,
      description: item.description,
      status: item.status,
    })
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function openImportModal() {
    if (!selectedClass?.id) return
    setImportFiles([])
    setImportResult(null)
    setImportModalOpen(true)
  }

  function closeImportModal() {
    if (saving) return
    setImportModalOpen(false)
    setImportFiles([])
    setImportResult(null)
  }

  function handleImportFiles(fileList: FileList | null) {
    const files = Array.from(fileList || [])
    setImportFiles(files)
    setImportResult(null)
  }

  async function saveClass(event: React.FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await updateTeacherClass(editingId, form)
        setToast('班级信息已更新')
      } else {
        const created = await createTeacherClass(form)
        setSelectedClassId(created.id)
        setToast('班级已创建，可以复制邀请码给学生加入')
      }
      closeModal()
      await loadClasses()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '班级保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setToast(`邀请码 ${code} 已复制`)
    } catch {
      setToast(`邀请码：${code}`)
    }
  }

  async function resetInviteCode(item: TeacherClass) {
    setSaving(true)
    try {
      const updated = await resetTeacherClassInviteCode(item.id)
      setToast(`新邀请码已生成：${updated.invite_code}`)
      await loadClasses()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '邀请码重置失败')
    } finally {
      setSaving(false)
    }
  }

  async function archiveClass(item: TeacherClass) {
    if (!window.confirm(`确定归档「${item.name}」吗？学生端将不再显示该班级。`)) return
    setSaving(true)
    try {
      await archiveTeacherClass(item.id)
      setToast('班级已归档')
      await loadClasses()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '班级归档失败')
    } finally {
      setSaving(false)
    }
  }

  async function importMembersFromFiles() {
    if (!selectedClass?.id) return
    if (!importFiles.length) return
    setSaving(true)
    try {
      const result = await importTeacherClassMembersFromFiles(selectedClass.id, importFiles)
      setImportResult(result)
      setToast(`批量导入完成：新增 ${result.added_count} 人，跳过 ${result.skipped_count} 项`)
      await Promise.all([loadClasses(), loadMembers(selectedClass.id)])
    } catch (error) {
      setToast(error instanceof Error ? error.message : '批量导入失败')
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(member: TeacherClassMember) {
    if (!selectedClass?.id) return
    if (!window.confirm(`确定从班级移除「${member.name}」吗？`)) return
    setSaving(true)
    try {
      await removeTeacherClassMember(selectedClass.id, member.id)
      setToast('成员已移除')
      await Promise.all([loadClasses(), loadMembers(selectedClass.id)])
    } catch (error) {
      setToast(error instanceof Error ? error.message : '移除成员失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 班级关系"
        title="班级管理"
        description="左侧管理班级，右侧维护当前班级学生；学生也可以通过邀请码自行加入。"
        actions={
          <ProtoButton onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            新建课程
          </ProtoButton>
        }
        chips={[
          { value: `${classes.length}`, label: '班级总数', icon: <School className="h-4 w-4" />, tone: 'blue' },
          { value: `${activeCount}`, label: '运行中', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'green' },
          { value: `${members.length}`, label: '当前成员', icon: <Users className="h-4 w-4" />, tone: 'cyan' },
          { value: `${riskCount}`, label: '需关注', icon: <AlertTriangle className="h-4 w-4" />, tone: riskCount ? 'orange' : 'green' },
        ]}
      />

      {toast && (
        <div className="mb-4 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm font-semibold text-[#1d4ed8]">
          {toast}
        </div>
      )}

      <div className="grid min-h-[640px] grid-cols-[minmax(280px,1fr)_minmax(0,2fr)] gap-5 max-[980px]:grid-cols-1">
        <ProtoCard className="flex min-h-[640px] flex-col p-0">
          <div className="flex items-center justify-between border-b border-[#eef2f7] px-4 py-3">
            <div>
              <h2 className="text-[18px] font-bold text-[#0f172a]">班级列表</h2>
              <p className="mt-0.5 text-xs text-[#64748b]">点击班级后在右侧管理学生</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadClasses()}
                className="grid h-10 w-10 place-items-center rounded-lg bg-[#f2f6fb] text-[#2563eb] hover:bg-[#e8f1fb]"
                title="刷新班级"
                aria-label="刷新班级"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="grid h-10 w-10 place-items-center rounded-lg bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                title="新建课程"
                aria-label="新建课程"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-2">
              {classes.map((item) => {
                const active = item.id === selectedClass?.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedClassId(item.id)}
                    className={`w-full rounded-[10px] border p-3 text-left transition-colors ${active ? 'border-[#2563eb] bg-[#eff6ff]' : 'border-[#eef2f7] bg-white hover:bg-[#f8fafc]'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <b className="block truncate text-sm text-[#0f172a]">{item.name}</b>
                        <span className="mt-1 block truncate text-xs text-[#64748b]">
                          {item.subject_name || '未关联学科'} · {item.grade || '未设置年级'}
                        </span>
                      </div>
                      <Pill tone={item.status === 'active' ? 'green' : 'orange'}>
                        {item.status === 'active' ? '运行中' : '暂停'}
                      </Pill>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#64748b]">
                      <span className="rounded-md bg-[#f1f5f9] px-2 py-1 font-bold">成员 {item.member_count}</span>
                      <span className="rounded-md bg-[#f1f5f9] px-2 py-1 font-mono font-bold">{item.invite_code}</span>
                    </div>
                  </button>
                )
              })}
              {!classes.length && (
                <div className="rounded-[10px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-center text-sm font-semibold text-[#64748b]">
                  {loading ? '班级加载中...' : '暂无班级，点击右上角新建课程'}
                </div>
              )}
            </div>
          </div>
        </ProtoCard>

        <ProtoCard className="flex min-h-[640px] flex-col p-0">
          <div className="border-b border-[#eef2f7] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-[20px] font-bold text-[#0f172a]">{selectedClass?.name || '选择一个班级'}</h2>
                <p className="mt-1 text-xs text-[#64748b]">
                  {selectedClass
                    ? `${selectedClass.subject_name || '未关联学科'} · ${selectedClass.grade || '未设置年级'} · 邀请码 ${selectedClass.invite_code}`
                    : '左侧选择班级后，右侧会显示该班级学生'}
                </p>
              </div>
              {selectedClass && (
                <div className="flex flex-wrap gap-2">
                  <ProtoButton onClick={openImportModal}>
                    <Upload className="h-4 w-4" />
                    批量导入学生
                  </ProtoButton>
                  <ProtoButton variant="secondary" onClick={() => void copyInviteCode(selectedClass.invite_code)}>
                    <Copy className="h-4 w-4" />
                    复制邀请码
                  </ProtoButton>
                  <button
                    type="button"
                    onClick={() => void resetInviteCode(selectedClass)}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-[#f2f6fb] text-[#52627b] hover:bg-[#e8eff8]"
                    title="重置邀请码"
                    aria-label="重置邀请码"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedClass)}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-[#f2f6fb] text-[#52627b] hover:bg-[#e8eff8]"
                    title="编辑班级设置"
                    aria-label="编辑班级设置"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void archiveClass(selectedClass)}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-[#fff1f2] text-[#dc2626] hover:bg-[#ffe4e6]"
                    title="归档班级"
                    aria-label="归档班级"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {selectedClass ? (
            <>
              <div className="border-b border-[#eef2f7] px-5 py-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#94a3b8]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索姓名、用户 ID、专业、阶段"
                    className="h-10 w-full rounded-lg border border-[#dbe7f5] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {membersLoading && (
                  <div className="flex items-center justify-center py-16 text-sm font-semibold text-[#64748b]">
                    <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent" />
                    成员数据加载中...
                  </div>
                )}

                {!membersLoading && (
                  <div className="space-y-3">
                    {filteredMembers.map((member) => (
                      <div key={member.id} className="rounded-[10px] border border-[#eef2f7] bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eff6ff] text-sm font-extrabold text-[#2563eb]">
                              {member.avatar || member.name.slice(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <b className="truncate text-sm text-[#0f172a]">{member.name}</b>
                                <Pill tone={riskTone(member.risk_level)}>{riskLabel(member.risk_level)}</Pill>
                              </div>
                              <p className="mt-1 text-xs text-[#64748b]">
                                {member.major || '未设置专业'} · {member.grade || '未设置年级'} · {member.current_stage || '未设置阶段'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void removeMember(member)}
                            className="grid h-9 w-9 place-items-center rounded-lg bg-[#fff1f2] text-[#dc2626] hover:bg-[#ffe4e6]"
                            title="移除成员"
                            aria-label={`移除 ${member.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3 max-[760px]:grid-cols-1">
                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-bold text-[#64748b]">任务完成</span>
                              <span className="font-bold text-[#0f172a]">{Math.round(member.task_completion * 100)}%</span>
                            </div>
                            <Bar value={Math.round(member.task_completion * 100)} tone={member.task_completion < 0.5 ? 'red' : member.task_completion < 0.7 ? 'orange' : 'green'} />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-bold text-[#64748b]">练习正确率</span>
                              <span className="font-bold text-[#0f172a]">{Math.round(member.quiz_accuracy * 100)}%</span>
                            </div>
                            <Bar value={Math.round(member.quiz_accuracy * 100)} tone={member.quiz_accuracy < 0.5 ? 'red' : member.quiz_accuracy < 0.7 ? 'orange' : 'blue'} />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-bold text-[#64748b]">近 30 天学习</span>
                              <span className="font-bold text-[#0f172a]">{member.total_hours}h</span>
                            </div>
                            <Bar value={Math.min(100, Math.round(member.total_hours * 4))} tone="blue" />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#64748b]">
                          <span className="rounded-md bg-[#f8fafc] px-2 py-1">连续学习 {member.streak_days} 天</span>
                          <span className="rounded-md bg-[#f8fafc] px-2 py-1">最近活跃 {member.last_active || '暂无记录'}</span>
                          <span className="rounded-md bg-[#f8fafc] px-2 py-1">来源 {member.source === 'invite' ? '学生加入' : '教师导入'}</span>
                        </div>

                        {member.weak_points?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {member.weak_points.slice(0, 4).map((point) => (
                              <span key={point} className="rounded-md bg-[#fff7ed] px-2 py-1 text-xs font-bold text-[#d97706]">{point}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {!filteredMembers.length && (
                      <div className="rounded-[10px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-8 text-center text-sm font-semibold text-[#64748b]">
                        当前班级暂无匹配成员，可添加学生或复制邀请码让学生加入。
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm font-semibold text-[#64748b]">
              创建或选择一个班级后管理成员。
            </div>
          )}
        </ProtoCard>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-modal-title"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeModal()
            }}
            className="w-full max-w-[560px] rounded-[12px] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#eef2f7] px-5 py-4">
              <div>
                <h2 id="class-modal-title" className="text-[18px] font-bold text-[#0f172a]">{editingId ? '班级设置' : '新建课程'}</h2>
                <p className="mt-0.5 text-xs text-[#64748b]">设置班级名称、学科、年级和说明。</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="grid h-10 w-10 place-items-center rounded-lg bg-[#f2f6fb] text-[#52627b] hover:bg-[#e8eff8]"
                title="关闭"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveClass} className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">班级名称</span>
                <input
                  value={form.name}
                  onChange={(event) => patchForm('name', event.target.value)}
                  placeholder="例如：Python 实战 1 班"
                  className="h-11 w-full rounded-lg border border-[#dbe7f5] bg-white px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[#64748b]">关联学科</span>
                  <select
                    value={form.subject_id}
                    onChange={(event) => handleSubjectChange(Number(event.target.value))}
                    className="h-11 w-full rounded-lg border border-[#dbe7f5] bg-white px-3 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                  >
                    <option value={0}>未关联学科</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[#64748b]">年级</span>
                  <input
                    value={form.grade}
                    onChange={(event) => patchForm('grade', event.target.value)}
                    placeholder="例如：大二"
                    className="h-11 w-full rounded-lg border border-[#dbe7f5] bg-white px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">班级说明</span>
                <textarea
                  value={form.description}
                  onChange={(event) => patchForm('description', event.target.value)}
                  rows={4}
                  placeholder="用于教师端识别班级范围、教学阶段或管理备注"
                  className="w-full resize-none rounded-lg border border-[#dbe7f5] bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-[#eef2f7] pt-4">
                <ProtoButton type="button" variant="tertiary" onClick={closeModal} disabled={saving}>
                  取消
                </ProtoButton>
                <ProtoButton type="submit" disabled={saving || !form.name.trim()}>
                  {saving ? '保存中...' : editingId ? '保存设置' : '创建课程'}
                </ProtoButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {importModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeImportModal()
            }}
            className="w-full max-w-[620px] rounded-[12px] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#eef2f7] px-5 py-4">
              <div>
                <h2 id="import-modal-title" className="text-[18px] font-bold text-[#0f172a]">批量导入学生</h2>
                <p className="mt-0.5 text-xs text-[#64748b]">导入到「{selectedClass.name}」，文件中可放用户 ID、手机号或邮箱。</p>
              </div>
              <button
                type="button"
                onClick={closeImportModal}
                className="grid h-10 w-10 place-items-center rounded-lg bg-[#f2f6fb] text-[#52627b] hover:bg-[#e8eff8]"
                title="关闭"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="flex min-h-[148px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-[#93c5fd] bg-[#eff6ff] px-4 text-center hover:bg-[#dbeafe]">
                <Upload className="h-7 w-7 text-[#2563eb]" />
                <span className="text-sm font-bold text-[#1d4ed8]">选择 Excel、CSV、TXT、JSON 等学生名单文件</span>
                <span className="max-w-[460px] text-xs leading-5 text-[#64748b]">
                  支持 .xlsx、.xlsm、.csv、.tsv、.txt、.json、.md、.log，可一次选择多个文件。
                </span>
                <input
                  type="file"
                  multiple
                  accept=".xlsx,.xlsm,.csv,.tsv,.txt,.json,.md,.log"
                  className="hidden"
                  onChange={(event) => handleImportFiles(event.target.files)}
                />
              </label>

              <div className="rounded-[10px] border border-[#eef2f7] bg-[#f8fafc] p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#64748b]">
                  <FileText className="h-4 w-4" />
                  已选择文件
                </div>
                <div className="max-h-[140px] space-y-2 overflow-y-auto">
                  {importFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs">
                      <span className="min-w-0 truncate font-semibold text-[#0f172a]">{file.name}</span>
                      <span className="shrink-0 text-[#64748b]">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                    </div>
                  ))}
                  {!importFiles.length && <div className="text-xs font-semibold text-[#94a3b8]">还没有选择文件</div>}
                </div>
              </div>

              {importResult && (
                <div className="grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
                  <div className="rounded-[10px] bg-[#ecfdf5] p-3">
                    <div className="text-xs font-bold text-[#059669]">新增学生</div>
                    <div className="mt-1 text-xl font-extrabold text-[#047857]">{importResult.added_count}</div>
                  </div>
                  <div className="rounded-[10px] bg-[#eff6ff] p-3">
                    <div className="text-xs font-bold text-[#2563eb]">解析标识</div>
                    <div className="mt-1 text-xl font-extrabold text-[#1d4ed8]">{importResult.parsed_count}</div>
                  </div>
                  <div className="rounded-[10px] bg-[#fff7ed] p-3">
                    <div className="text-xs font-bold text-[#d97706]">跳过项目</div>
                    <div className="mt-1 text-xl font-extrabold text-[#c2410c]">{importResult.skipped_count}</div>
                  </div>
                  {importResult.skipped_files.length > 0 && (
                    <div className="col-span-3 rounded-[10px] bg-[#fef2f2] p-3 text-xs font-semibold text-[#dc2626] max-[640px]:col-span-1">
                      未处理文件：{importResult.skipped_files.join('、')}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-[#eef2f7] pt-4">
                <ProtoButton type="button" variant="tertiary" onClick={closeImportModal} disabled={saving}>
                  取消
                </ProtoButton>
                <ProtoButton onClick={() => void importMembersFromFiles()} disabled={saving || !importFiles.length}>
                  <UserPlus className="h-4 w-4" />
                  {saving ? '导入中...' : '开始导入'}
                </ProtoButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
