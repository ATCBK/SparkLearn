'use client'

import { useEffect, useMemo, useState } from 'react'
import { Edit3, Flag, Layers, Target, UserRound } from 'lucide-react'
import { api, DashboardStats, MasteryRecord, Resource, StudentProfile } from '@/lib/api'
import { Bar, PageHead, Pill, ProgressRing, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

export default function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [mastery, setMastery] = useState<MasteryRecord[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [resources, setResources] = useState<Resource[]>([])

  useEffect(() => {
    let mounted = true
    Promise.allSettled([api.getProfile(), api.getMasteryData(), api.getDashboardStats(), api.getRecentResources()]).then(([p, m, s, r]) => {
      if (!mounted) return
      if (p.status === 'fulfilled') setProfile(p.value)
      if (m.status === 'fulfilled') setMastery(m.value)
      if (s.status === 'fulfilled') setStats(s.value)
      if (r.status === 'fulfilled') setResources(r.value)
    })
    return () => {
      mounted = false
    }
  }, [])

  const weakest = useMemo(() => [...mastery].sort((a, b) => a.score - b.score)[0], [mastery])
  const stability = Math.round((weakest?.score ?? 0.48) * 100)
  const radar = [
    { label: '知识基础', value: 72 },
    { label: '实践迁移', value: 66 },
    { label: '稳定复习', value: stats ? Math.round(stats.taskCompletionRate * 100) : 78 },
    { label: '练习准确', value: stats ? Math.round(stats.quizAccuracy * 100) : 74 },
    { label: '自主规划', value: 68 },
  ]

  return (
    <div>
      <PageHead
        eyebrow="学习中心 / 学习画像"
        title="学习画像"
        description="这里展示系统对当前学习状态的判断，画像会影响路径、资源推荐和练习难度。"
        actions={<ProtoButton href="/profile/settings" variant="secondary"><Edit3 className="h-4 w-4" />编辑画像</ProtoButton>}
        chips={[
          { value: `${stability}%`, label: '当前稳定度' },
          { value: profile?.learningPreference?.[0] || '案例驱动', label: '学习偏好' },
          { value: `${profile?.dailyTime || 60}分钟`, label: '日投入' },
        ]}
      />

      <div className="grid grid-cols-[360px_1fr] gap-4 max-[980px]:grid-cols-1">
        <ProtoCard className="relative min-h-[360px] overflow-hidden p-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(104,168,248,.22),_transparent_45%),linear-gradient(180deg,#ffffff,#eef6ff)]" />
          <div className="relative z-10 flex h-full flex-col justify-end p-5">
            <div className="absolute left-5 top-5 rounded-[14px] border border-[#e8eff8] bg-white/90 p-3 shadow-sm">
              <b className="block text-[18px]">{profile?.name || '张同学'}</b>
              <span className="text-micro text-muted">{profile?.major || '计算机科学'} · {profile?.grade || '大二'}</span>
            </div>
            <div className="absolute right-5 top-[110px] max-w-[160px] rounded-[14px] border border-[#e8eff8] bg-white/90 p-3 shadow-sm">
              <b className="block text-[18px]">{stability}%</b>
              <span className="text-micro text-muted">当前薄弱点稳定度</span>
            </div>
            <div className="mx-auto mb-8 grid h-36 w-36 place-items-center rounded-full bg-white shadow-md">
              <UserRound className="h-20 w-20 text-blue" />
            </div>
            <div className="rounded-[14px] border border-[#e8eff8] bg-white/90 p-4">
              <h2 className="text-h2 font-bold text-ink">偏实践型学习者</h2>
              <p className="mt-2 text-small leading-6 text-muted">更适合先看案例，再用短练习验证概念。当前建议围绕「{weakest?.knowledgePointName || '函数返回值'}」补弱。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(profile?.learningPreference?.length ? profile.learningPreference : ['视觉型', '实践型']).map((tag) => <Pill key={tag} tone="blue">{tag}</Pill>)}
              </div>
            </div>
          </div>
        </ProtoCard>

        <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
          <ProtoCard>
            <div className="flex items-start gap-4">
              <ProgressRing value={stability} label="稳定度" />
              <div className="min-w-0">
                <Pill tone="orange">当前焦点</Pill>
                <h2 className="mt-3 text-h2 font-bold text-ink">{weakest?.knowledgePointName || '函数返回值'}</h2>
                <p className="mt-2 text-small leading-6 text-muted">错题和路径均指向这个卡点，建议先补概念再练题。</p>
              </div>
            </div>
          </ProtoCard>
          <ProtoCard>
            <CardTitle icon={<Layers className="h-4 w-4" />} title="学习偏好" />
            <div className="mt-4 space-y-3">
              {(profile?.learningPreference?.length ? profile.learningPreference : ['视觉型', '实践型', '案例驱动']).slice(0, 3).map((item, idx) => (
                <div key={item}>
                  <div className="mb-1 flex justify-between text-micro text-muted"><span>{item}</span><span>{82 - idx * 12}%</span></div>
                  <Bar value={82 - idx * 12} tone={idx === 0 ? 'blue' : idx === 1 ? 'green' : 'purple'} />
                </div>
              ))}
            </div>
          </ProtoCard>
          <ProtoCard>
            <CardTitle icon={<Target className="h-4 w-4" />} title="学习目标" />
            <div className="mt-4 grid gap-2">
              {(profile?.goals?.length ? profile.goals : ['期末提分', '竞赛准备']).map((goal) => (
                <SoftCard key={goal} className="text-small font-bold text-ink">{goal}</SoftCard>
              ))}
            </div>
          </ProtoCard>
          <ProtoCard>
            <CardTitle icon={<Flag className="h-4 w-4" />} title="今日计划" />
            <div className="mt-4 space-y-3">
              {['回顾函数返回值讲义', '完成8道达标题', '确认下一路径节点'].map((item, idx) => (
                <div key={item} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-[12px] border border-[#e4eef8] bg-[#f8fbff] p-3">
                  <b className="grid h-9 w-9 place-items-center rounded-[10px] bg-white text-blue">{idx + 1}</b>
                  <span className="text-small font-bold text-ink">{item}</span>
                  <Pill>{idx === 0 ? '12分' : idx === 1 ? '10分' : '2分'}</Pill>
                </div>
              ))}
            </div>
          </ProtoCard>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1.1fr_.9fr] gap-4 max-[980px]:grid-cols-1">
        <ProtoCard>
          <h2 className="mb-4 text-h2 font-bold text-ink">能力雷达</h2>
          <div className="grid gap-3">
            {radar.map((item, idx) => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-small"><span className="font-bold text-ink">{item.label}</span><span className="text-muted">{item.value}%</span></div>
                <Bar value={item.value} tone={idx % 2 === 0 ? 'blue' : 'green'} />
              </div>
            ))}
          </div>
        </ProtoCard>
        <ProtoCard>
          <h2 className="mb-4 text-h2 font-bold text-ink">最近学习过的资源</h2>
          <div className="space-y-2">
            {resources.slice(0, 4).map((res) => (
              <SoftCard key={res.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <b className="block truncate text-small text-ink">{res.title}</b>
                  <span className="text-micro text-muted">关联画像：{weakest?.knowledgePointName || '函数返回值'}</span>
                </div>
                <Pill tone="green">已记录</Pill>
              </SoftCard>
            ))}
          </div>
        </ProtoCard>
      </div>
    </div>
  )
}

function CardTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-h2 font-bold text-ink">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-blue-light text-blue">{icon}</span>
      {title}
    </h2>
  )
}
