'use client'

import { useEffect, useState } from 'react'
import { api, StudentProfile } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { User, Save } from 'lucide-react'

export default function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getProfile()
      setProfile(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-[20px]" />
          <Skeleton className="h-80 rounded-[20px]" />
        </div>
      </div>
    )
  }
  if (error || !profile) return <ErrorState type="server" onRetry={fetchData} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-ink">个人信息</h1>
        <p className="text-body text-ink-secondary mt-1">管理你的账户和学习资料</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card className="p-6">
          <h3 className="text-h3 text-ink mb-6">基本信息</h3>
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full bg-blue-light flex items-center justify-center mb-3">
              <User className="w-8 h-8 text-blue" />
            </div>
            <p className="text-h3 text-ink">{profile.name}</p>
          </div>
          <div className="space-y-4">
            <Input label="姓名" defaultValue={profile.name} />
            <Input label="专业" defaultValue={profile.major} />
            <Input label="年级" defaultValue={profile.grade} />
            <div>
              <label className="block text-small font-medium text-ink mb-1.5">学习目标</label>
              <div className="flex flex-wrap gap-2">
                {profile.goals.map(g => (
                  <Badge key={g} variant="info">{g}</Badge>
                ))}
              </div>
            </div>
            <Button className="mt-4">
              <Save className="w-4 h-4" />
              保存修改
            </Button>
          </div>
        </Card>

        {/* Stats + Settings */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-h3 text-ink mb-4">学习概况</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-bg-hover rounded-lg">
                <span className="text-small text-ink-secondary">学习偏好</span>
                <div className="flex gap-1">
                  {profile.learningPreference.map(p => (
                    <Badge key={p} variant="info" size="sm">{p}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-bg-hover rounded-lg">
                <span className="text-small text-ink-secondary">认知风格</span>
                <Badge variant="purple" size="sm">{profile.cognitiveStyle}</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-bg-hover rounded-lg">
                <span className="text-small text-ink-secondary">每日学习时长</span>
                <span className="text-small font-medium text-ink">{profile.dailyTime} 分钟</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-bg-hover rounded-lg">
                <span className="text-small text-ink-secondary">实操能力</span>
                <span className="text-small font-medium text-ink">{profile.practicalAbility}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-h3 text-ink mb-4">安全设置</h3>
            <Button variant="secondary">修改密码</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
