'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { BellRing, Camera, Mail, GraduationCap, BookOpen, Clock, Target, ArrowLeft, LogOut, School } from 'lucide-react'
import { api, ClassBroadcast, ProfileUpdatePayload, StudentProfile, TeacherClass } from '@/lib/api'
import { getUser, setUser, syncStudyBuddyProfile } from '@/lib/auth'
import { PageHead, ProtoButton, ProtoCard } from '@/components/proto'

export default function ProfileSettingsPage() {
  const [form, setForm] = useState<StudentProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [myClasses, setMyClasses] = useState<TeacherClass[]>([])
  const [classBroadcasts, setClassBroadcasts] = useState<ClassBroadcast[]>([])
  const [inviteCode, setInviteCode] = useState('')
  const [classMessage, setClassMessage] = useState('')
  const [classLoading, setClassLoading] = useState(false)

  useEffect(() => {
    void loadClassInfo()
    api.getProfile().then(setForm).catch((ex) => setError(ex instanceof Error ? ex.message : '信息读取失败'))
  }, [])

  function update<K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  async function save() {
    if (!form) return
    setSaving(true)
    setError('')
    setSuccess(false)
    const payload: ProfileUpdatePayload = {
      name: form.name,
      email: form.email,
      major: form.major,
      grade: form.grade,
      goals: form.goals,
      knowledgeLevel: form.knowledgeLevel,
      weakPoints: form.weakPoints,
      learningPreference: form.learningPreference,
      cognitiveStyle: form.cognitiveStyle,
      dailyTime: form.dailyTime,
      practicalAbility: form.practicalAbility,
      currentStage: form.currentStage,
    }
    try {
      await api.updateProfile(payload)
      const nextProfile = await api.getProfile()
      setForm(nextProfile)
      const currentUser = getUser()
      if (currentUser && nextProfile.name.trim()) {
        setUser({ ...currentUser, name: nextProfile.name.trim() })
        window.dispatchEvent(new Event('sparklearn:user-updated'))
      }
      await syncStudyBuddyProfile('profile-settings')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function loadClassInfo() {
    setClassLoading(true)
    try {
      const [classes, broadcasts] = await Promise.all([
        api.getMyClasses(),
        api.getClassBroadcasts(),
      ])
      setMyClasses(classes)
      setClassBroadcasts(broadcasts)
    } catch (ex) {
      setClassMessage(ex instanceof Error ? ex.message : '班级信息读取失败')
    } finally {
      setClassLoading(false)
    }
  }

  async function joinClass() {
    if (!inviteCode.trim()) return
    setClassLoading(true)
    setClassMessage('')
    try {
      await api.joinClassByInviteCode(inviteCode.trim())
      setInviteCode('')
      setClassMessage('已加入班级')
      await loadClassInfo()
    } catch (ex) {
      setClassMessage(ex instanceof Error ? ex.message : '加入班级失败')
    } finally {
      setClassLoading(false)
    }
  }

  async function leaveClass(classId: number) {
    if (!window.confirm('确定退出这个班级吗？退出后将不再接收该班级通知。')) return
    setClassLoading(true)
    setClassMessage('')
    try {
      await api.leaveMyClass(classId)
      setClassMessage('已退出班级')
      await loadClassInfo()
    } catch (ex) {
      setClassMessage(ex instanceof Error ? ex.message : '退出班级失败')
    } finally {
      setClassLoading(false)
    }
  }

  async function markBroadcastRead(broadcastId: number) {
    try {
      await api.markClassBroadcastRead(broadcastId)
      await loadClassInfo()
    } catch (ex) {
      setClassMessage(ex instanceof Error ? ex.message : '标记已读失败')
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHead
        eyebrow="个人中心"
        title="个人设置"
        description="管理你的基本信息、学习目标和画像基础资料。保存后会同步到学习画像与学习伙伴。"
        actions={
          <ProtoButton href="/profile" variant="tertiary">
            <ArrowLeft className="h-4 w-4" />
            返回画像
          </ProtoButton>
        }
      />

      {/* 成功提示 */}
      {success && (
        <div className="mb-4 rounded-[10px] border border-green/30 bg-green-light p-3 text-small font-bold text-green">
          ✓ 保存成功
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 rounded-[10px] border border-red/30 bg-red-light p-3 text-small text-red">
          {error}
        </div>
      )}

      {!form && !error && (
        <ProtoCard>
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue border-t-transparent" />
            <span className="ml-3 text-small text-muted">正在加载...</span>
          </div>
        </ProtoCard>
      )}

      {form && (
        <div className="space-y-5">
          {/* 头像与姓名卡片 */}
          <ProtoCard>
            <div className="flex items-center gap-6">
              {/* 头像上传 */}
              <label className="group relative cursor-pointer">
                <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-blue to-[#60a5fa] text-white shadow-lg ring-4 ring-blue/10">
                  {avatarPreview ? (
                    <Image src={avatarPreview} alt="头像" width={80} height={80} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[28px] font-bold">{form.name.charAt(0)}</span>
                  )}
                </div>
                <div className="absolute inset-0 grid place-items-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-5 w-5 text-white" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  aria-label="上传头像"
                />
              </label>
              <div className="flex-1">
                <h2 className="text-[20px] font-bold text-ink">{form.name}</h2>
                <p className="mt-1 text-small text-muted">{form.major} · {form.grade}</p>
                <p className="mt-0.5 text-micro text-soft">点击头像可更换</p>
              </div>
            </div>
          </ProtoCard>

          {/* 基本信息 */}
          <ProtoCard>
            <SectionTitle icon={<Mail className="h-4 w-4" />} title="基本信息" />
            <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <FormField label="姓名" value={form.name} onChange={v => update('name', v)} placeholder="请输入姓名" />
              <FormField label="邮箱" value={form.email} onChange={v => update('email', v)} placeholder="请输入邮箱" type="email" />
            </div>
          </ProtoCard>

          {/* 学业信息 */}
          <ProtoCard>
            <SectionTitle icon={<GraduationCap className="h-4 w-4" />} title="学业信息" />
            <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <FormField label="专业" value={form.major} onChange={v => update('major', v)} placeholder="如：计算机科学" />
              <FormField label="年级" value={form.grade} onChange={v => update('grade', v)} placeholder="如：大二" />
            </div>
          </ProtoCard>

          <ProtoCard>
            <SectionTitle icon={<School className="h-4 w-4" />} title="我的班级" />
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-[1fr_auto] gap-3 max-[640px]:grid-cols-1">
                <input
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  placeholder="输入教师提供的邀请码"
                  className="h-11 w-full rounded-lg border border-[#dbe7f5] bg-white px-3 text-sm font-semibold tracking-normal outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                />
                <ProtoButton onClick={() => void joinClass()} disabled={classLoading || !inviteCode.trim()}>
                  <School className="h-4 w-4" />
                  加入班级
                </ProtoButton>
              </div>

              {classMessage && (
                <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#1d4ed8]">
                  {classMessage}
                </div>
              )}

              <div className="space-y-2">
                {myClasses.map((item) => (
                  <div key={item.id} className="rounded-[10px] border border-[#eef2f7] bg-[#f8fafc] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <b className="block truncate text-sm text-[#0f172a]">{item.name}</b>
                        <span className="mt-1 block text-xs text-[#64748b]">{item.subject_name || '未关联学科'} · {item.grade || '未设置年级'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void leaveClass(item.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-xs font-bold text-[#dc2626] ring-1 ring-[#fecaca] hover:bg-[#fef2f2]"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        退出
                      </button>
                    </div>
                  </div>
                ))}
                {!classLoading && !myClasses.length && (
                  <div className="rounded-[10px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-center text-sm font-semibold text-[#64748b]">
                    暂未加入班级
                  </div>
                )}
              </div>

              <div className="border-t border-[#eef2f7] pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-blue" />
                  <h4 className="text-sm font-bold text-ink">班级通知</h4>
                </div>
                <div className="space-y-2">
                  {classBroadcasts.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-[10px] border border-[#eef2f7] bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <b className="text-sm text-[#0f172a]">{item.title}</b>
                        <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${item.read_at ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fff7ed] text-[#d97706]'}`}>
                          {item.read_at ? '已读' : '未读'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#475569]">{item.content}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-[#94a3b8]">{item.created_at}</span>
                        {!item.read_at && (
                          <button
                            type="button"
                            onClick={() => void markBroadcastRead(item.id)}
                            className="rounded-md bg-[#eff6ff] px-2 py-1 text-[10px] font-bold text-[#2563eb] hover:bg-[#dbeafe]"
                          >
                            标记已读
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!classLoading && !classBroadcasts.length && (
                    <div className="rounded-[10px] bg-[#f8fafc] p-3 text-center text-xs font-semibold text-[#64748b]">
                      暂无班级通知
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ProtoCard>

          {/* 学习偏好 */}
          <ProtoCard>
            <SectionTitle icon={<BookOpen className="h-4 w-4" />} title="学习偏好" />
            <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <FormField
                label="学习目标"
                value={form.goals.join('，')}
                onChange={v => update('goals', split(v))}
                placeholder="用逗号分隔多个目标"
              />
              <FormField
                label="当前阶段"
                value={form.currentStage}
                onChange={v => update('currentStage', v)}
                placeholder="如：函数与模块到项目实战过渡期"
              />
              <FormField
                label="薄弱点"
                value={form.weakPoints.join('，')}
                onChange={v => update('weakPoints', split(v))}
                placeholder="用逗号分隔多个薄弱点"
              />
              <FormField
                label="学习方式偏好"
                value={form.learningPreference.join('，')}
                onChange={v => update('learningPreference', split(v))}
                placeholder="如：先看案例再做短练，互动问答"
              />
              <TextAreaField
                label="知识基础"
                value={form.knowledgeLevel}
                onChange={v => update('knowledgeLevel', v)}
                placeholder="描述当前基础水平"
              />
              <TextAreaField
                label="认知风格"
                value={form.cognitiveStyle}
                onChange={v => update('cognitiveStyle', v)}
                placeholder="描述更适合怎样理解和迁移知识"
              />
              <TextAreaField
                label="实践能力"
                value={form.practicalAbility}
                onChange={v => update('practicalAbility', v)}
                placeholder="描述当前能独立完成什么，还需要补什么"
                className="col-span-2 max-[640px]:col-span-1"
              />
              <div>
                <label className="mb-2 block text-small font-bold text-ink">
                  <span className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted" />
                    每日可投入时间
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={180}
                    step={5}
                    value={form.dailyTime}
                    onChange={e => update('dailyTime', Number(e.target.value))}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#e8eff8] accent-blue"
                  />
                  <span className="min-w-[56px] rounded-lg bg-blue-light px-2 py-1 text-center text-small font-bold text-blue">
                    {form.dailyTime} 分钟
                  </span>
                </div>
              </div>
            </div>
          </ProtoCard>

          {/* AI 画像说明 */}
          <div className="rounded-[12px] border border-dashed border-[#d1d5db] bg-[#f9fafb] p-4">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div>
                <p className="text-small font-bold text-ink">关于学习画像</p>
                <p className="mt-1 text-micro leading-5 text-muted">
                  这里维护的是画像基础资料。系统后续会结合学习行为继续分析，但演示账号也可以在这里直接补充姓名、目标、薄弱点和学习偏好。
                </p>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <ProtoButton href="/profile" variant="tertiary">取消</ProtoButton>
            <ProtoButton onClick={() => void save()} disabled={saving}>
              {saving ? '保存中...' : '保存修改'}
            </ProtoButton>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── 子组件 ─── */

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#eef2f7] pb-3">
      <span className="text-blue">{icon}</span>
      <h3 className="text-body font-bold text-ink">{title}</h3>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-small font-bold text-ink">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[10px] border border-line bg-[#fafbfc] px-4 text-small text-ink outline-none transition-colors placeholder:text-soft focus:border-blue focus:bg-white focus:ring-2 focus:ring-blue/10"
      />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-small font-bold text-ink">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-[10px] border border-line bg-[#fafbfc] px-4 py-3 text-small leading-6 text-ink outline-none transition-colors placeholder:text-soft focus:border-blue focus:bg-white focus:ring-2 focus:ring-blue/10"
      />
    </label>
  )
}

function split(value: string) {
  return value.split(/[，,]/).map(item => item.trim()).filter(Boolean)
}
