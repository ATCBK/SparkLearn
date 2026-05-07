'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, DashboardStats, ProfileUpdatePayload, StudentProfile } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Save, Shield, Smartphone, Edit3 } from 'lucide-react'

type ProfileForm = {
  name: string
  email: string
  major: string
  grade: string
  knowledgeLevel: string
  goals: string
  weakPoints: string
  learningPreference: string
  cognitiveStyle: string
  dailyTime: string
  practicalAbility: string
  currentStage: string
}

function toCommaText(values: string[]): string {
  return values.join('，')
}

function fromCommaText(text: string): string[] {
  return text
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [form, setForm] = useState<ProfileForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedTip, setSavedTip] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const [p, s] = await Promise.all([api.getProfile(), api.getDashboardStats()])
      setProfile(p)
      setStats(s)
      setForm({
        name: p.name,
        email: p.email,
        major: p.major,
        grade: p.grade,
        knowledgeLevel: p.knowledgeLevel || '',
        goals: toCommaText(p.goals),
        weakPoints: toCommaText(p.weakPoints),
        learningPreference: toCommaText(p.learningPreference),
        cognitiveStyle: p.cognitiveStyle || '',
        dailyTime: String(p.dailyTime || 60),
        practicalAbility: p.practicalAbility || '',
        currentStage: p.currentStage || '',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const roleTags = useMemo(() => {
    if (!profile) return []
    return [profile.knowledgeLevel, ...profile.learningPreference.slice(0, 2)].filter(Boolean)
  }, [profile])

  async function handleSave() {
    if (!form) return
    const payload: ProfileUpdatePayload = {
      name: form.name.trim(),
      email: form.email.trim(),
      major: form.major.trim(),
      grade: form.grade.trim(),
      goals: fromCommaText(form.goals),
      knowledgeLevel: form.knowledgeLevel.trim(),
      weakPoints: fromCommaText(form.weakPoints),
      learningPreference: fromCommaText(form.learningPreference),
      cognitiveStyle: form.cognitiveStyle.trim(),
      dailyTime: Number(form.dailyTime) > 0 ? Number(form.dailyTime) : 60,
      practicalAbility: form.practicalAbility.trim(),
      currentStage: form.currentStage.trim(),
    }

    try {
      setSaving(true)
      setSavedTip('')
      await api.updateProfile(payload)
      setSavedTip('保存成功')
      setProfile((prev) => prev ? ({
        ...prev,
        name: form.name.trim(),
        major: form.major.trim(),
        grade: form.grade.trim(),
        email: form.email.trim(),
        goals: payload.goals || prev.goals,
        knowledgeLevel: payload.knowledgeLevel || prev.knowledgeLevel,
        weakPoints: payload.weakPoints || prev.weakPoints,
        learningPreference: payload.learningPreference || prev.learningPreference,
        cognitiveStyle: payload.cognitiveStyle || prev.cognitiveStyle,
        dailyTime: payload.dailyTime || prev.dailyTime,
        practicalAbility: payload.practicalAbility || prev.practicalAbility,
        currentStage: payload.currentStage || prev.currentStage,
      }) : prev)
    } catch (e) {
      setSavedTip(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 rounded-[20px]" />
        <div className="grid grid-cols-[1fr_300px] gap-6">
          <Skeleton className="h-[560px] rounded-[20px]" />
          <div className="space-y-6">
            <Skeleton className="h-44 rounded-[20px]" />
            <Skeleton className="h-40 rounded-[20px]" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile || !form) return <ErrorState type="server" onRetry={fetchData} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-ink">个人信息</h1>
        <p className="text-body text-ink-secondary mt-1">用户设置与账户管理</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <BrandLogo size={72} className="rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-h3 text-ink truncate">{form.name || '未命名用户'}</p>
            <p className="text-small text-ink-secondary truncate">{form.email || '-'}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {roleTags.map((tag) => <Badge key={tag} variant="info">{tag}</Badge>)}
            </div>
          </div>
          <Button variant="secondary" size="sm">
            <Edit3 className="w-4 h-4" />
            编辑资料
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-[1fr_300px] gap-6">
        <Card className="p-6">
          <h3 className="text-h3 text-ink mb-5">基本资料</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="邮箱" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="年级" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
            <Input label="专业" value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} />
          </div>

          <div className="mt-4 space-y-4">
            <Input
              label="知识基础"
              value={form.knowledgeLevel}
              onChange={(e) => setForm({ ...form, knowledgeLevel: e.target.value })}
            />
            <Input
              label="学习目标（逗号分隔）"
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
            />
            <Input
              label="薄弱点（逗号分隔）"
              value={form.weakPoints}
              onChange={(e) => setForm({ ...form, weakPoints: e.target.value })}
            />
            <Input
              label="学习偏好（逗号分隔）"
              value={form.learningPreference}
              onChange={(e) => setForm({ ...form, learningPreference: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="认知风格"
                value={form.cognitiveStyle}
                onChange={(e) => setForm({ ...form, cognitiveStyle: e.target.value })}
              />
              <Input
                label="每日学习时长（分钟）"
                type="number"
                min={1}
                value={form.dailyTime}
                onChange={(e) => setForm({ ...form, dailyTime: e.target.value })}
              />
            </div>
            <Input
              label="实践能力描述"
              value={form.practicalAbility}
              onChange={(e) => setForm({ ...form, practicalAbility: e.target.value })}
            />
            <Input
              label="当前学习阶段"
              value={form.currentStage}
              onChange={(e) => setForm({ ...form, currentStage: e.target.value })}
              placeholder="例如：函数与模块"
            />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存修改'}
            </Button>
            {savedTip ? <span className="text-small text-ink-secondary">{savedTip}</span> : null}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-small font-semibold text-ink mb-4">学习统计</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-bg-hover">
                <span className="text-small text-ink-secondary">累计学习时长</span>
                <span className="text-small font-semibold text-ink">{stats?.totalHours ?? 0}h</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-bg-hover">
                <span className="text-small text-ink-secondary">任务完成率</span>
                <span className="text-small font-semibold text-ink">{Math.round((stats?.taskCompletionRate ?? 0) * 100)}%</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-bg-hover">
                <span className="text-small text-ink-secondary">答题正确率</span>
                <span className="text-small font-semibold text-ink">{Math.round((stats?.quizAccuracy ?? 0) * 100)}%</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-bg-hover">
                <span className="text-small text-ink-secondary">连续学习天数</span>
                <span className="text-small font-semibold text-ink">{stats?.streakDays ?? 0}天</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-small font-semibold text-ink mb-4">安全设置</h3>
            <div className="space-y-2">
              <Button variant="secondary" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  修改密码
                </span>
              </Button>
              <Button variant="secondary" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  绑定手机
                </span>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

