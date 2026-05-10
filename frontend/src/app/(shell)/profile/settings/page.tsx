'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ProfileUpdatePayload, StudentProfile } from '@/lib/api'
import { PageHead, ProtoButton, ProtoCard } from '@/components/proto'

export default function ProfileSettingsPage() {
  const router = useRouter()
  const [form, setForm] = useState<StudentProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getProfile().then(setForm).catch((ex) => setError(ex instanceof Error ? ex.message : '画像读取失败'))
  }, [])

  function update<K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
  }

  async function save() {
    if (!form) return
    setSaving(true)
    setError('')
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
      router.push('/profile')
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="底部 / 个人信息"
        title="个人信息编辑"
        description="这里保留原有画像和基础资料编辑能力，保存后会回到学习画像页。"
      />
      <ProtoCard>
        {!form && !error && <p className="text-muted">正在读取画像...</p>}
        {error && <p className="mb-4 rounded-[10px] bg-red-light p-3 text-small text-red">{error}</p>}
        {form && (
          <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
            <Field label="姓名" value={form.name} onChange={v => update('name', v)} />
            <Field label="邮箱" value={form.email} onChange={v => update('email', v)} />
            <Field label="专业" value={form.major} onChange={v => update('major', v)} />
            <Field label="年级" value={form.grade} onChange={v => update('grade', v)} />
            <Field label="知识基础" value={form.knowledgeLevel} onChange={v => update('knowledgeLevel', v)} />
            <Field label="认知风格" value={form.cognitiveStyle} onChange={v => update('cognitiveStyle', v)} />
            <Field label="每日可投入分钟" value={String(form.dailyTime)} type="number" onChange={v => update('dailyTime', Number(v) || 0)} />
            <Field label="当前阶段" value={form.currentStage} onChange={v => update('currentStage', v)} />
            <Field label="学习目标（逗号分隔）" value={form.goals.join('，')} onChange={v => update('goals', split(v))} />
            <Field label="薄弱点（逗号分隔）" value={form.weakPoints.join('，')} onChange={v => update('weakPoints', split(v))} />
            <Field label="学习偏好（逗号分隔）" value={form.learningPreference.join('，')} onChange={v => update('learningPreference', split(v))} />
            <Field label="实践能力" value={form.practicalAbility} onChange={v => update('practicalAbility', v)} />
            <div className="col-span-2 flex justify-end gap-3 max-[760px]:col-span-1">
              <ProtoButton href="/profile" variant="tertiary">取消</ProtoButton>
              <ProtoButton onClick={() => void save()} disabled={saving}>{saving ? '保存中...' : '保存画像'}</ProtoButton>
            </div>
          </div>
        )}
      </ProtoCard>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-small font-bold text-ink">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-[14px] border border-line bg-white px-3 text-small outline-none focus:border-blue"
      />
    </label>
  )
}

function split(value: string) {
  return value.split(/[，,]/).map(item => item.trim()).filter(Boolean)
}
