'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Mail, GraduationCap, BookOpen, Clock, Target, ArrowLeft } from 'lucide-react'
import { api, ProfileUpdatePayload, StudentProfile } from '@/lib/api'
import { PageHead, ProtoButton, ProtoCard } from '@/components/proto'

export default function ProfileSettingsPage() {
  const router = useRouter()
  const [form, setForm] = useState<StudentProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  useEffect(() => {
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
      dailyTime: form.dailyTime,
    }
    try {
      await api.updateProfile(payload)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHead
        eyebrow="个人中心"
        title="个人设置"
        description="管理你的基本信息和学习偏好。学习画像由系统自动生成，无需手动修改。"
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
                    <img src={avatarPreview} alt="头像" className="h-full w-full object-cover" />
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
                  知识基础、薄弱点、认知风格等画像数据由系统根据你的学习行为自动分析生成，无需手动修改。
                  你可以在「学习画像」页面查看完整的 AI 分析结果。
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

function split(value: string) {
  return value.split(/[，,]/).map(item => item.trim()).filter(Boolean)
}
