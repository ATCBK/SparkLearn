'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, Clock, Sparkles, Target } from 'lucide-react'
import { api, DashboardStats, MasteryRecord, Recommendation, Resource, Task } from '@/lib/api'
import { MetricStrip, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [mastery, setMastery] = useState<MasteryRecord[]>([])
  const [recent, setRecent] = useState<Resource[]>([])
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([
      api.getTodayTasks(),
      api.getDashboardStats(),
      api.getMasteryData(),
      api.getRecentResources(),
      api.getRecommendations(),
    ]).then(([t, s, m, r, rec]) => {
      if (!mounted) return
      if (t.status === 'fulfilled') setTasks(t.value)
      if (s.status === 'fulfilled') setStats(s.value)
      if (m.status === 'fulfilled') setMastery(m.value)
      if (r.status === 'fulfilled') setRecent(r.value)
      if (rec.status === 'fulfilled') setRecs(rec.value)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  const weakest = useMemo(() => [...mastery].sort((a, b) => a.score - b.score)[0], [mastery])
  const focusName = weakest?.knowledgePointName || '函数返回值'
  const focusScore = Math.round((weakest?.score ?? 0.48) * 100)

  return (
    <div>
      <PageHead
        eyebrow="学习中心 / 资源回顾与新推荐"
        title="今日学习工作台"
        description="系统已结合画像、路径和错题，把今天最应该完成的学习动作排在前面。"
        chips={[
          { value: `${tasks.reduce((sum, t) => sum + (t.status === 'completed' ? 0 : t.duration), 0) || 24}分钟`, label: '建议投入' },
          { value: `${tasks.filter(t => t.status !== 'completed').length || 1}项`, label: '待完成' },
          { value: `${stats?.streakDays ?? 12}天`, label: '连续学习' },
        ]}
      />

      <ProtoCard className="relative overflow-hidden p-6">
        <div className="max-w-[720px] space-y-4">
          <Pill tone="orange">优先薄弱点</Pill>
          <div>
            <h2 className="text-[24px] font-bold leading-tight text-ink">先补「{focusName}」，再推进下一段路径</h2>
            <p className="mt-2 text-body leading-7 text-muted">
              当前稳定度 {focusScore}%。建议先回顾一个短资源，再做 8 道达标题，预计 24 分钟。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="orange">来自错题回流</Pill>
            <Pill tone="blue">关联当前路径</Pill>
            <Pill tone="purple">适合案例驱动</Pill>
            <Pill tone="green">完成后可进入下一节点</Pill>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <ProtoButton href="/resources">开始回顾资源</ProtoButton>
            <ProtoButton href="/practice" variant="secondary">先做练习</ProtoButton>
            <ProtoButton href="/generate" variant="tertiary">根据卡点生成</ProtoButton>
          </div>
        </div>
      </ProtoCard>

      <div className="mt-5">
        <MetricStrip
          items={[
            { value: `${focusScore}%`, label: '当前薄弱点稳定度' },
            { value: '8题', label: '建议达标题数量' },
            { value: `${stats?.streakDays ?? 12}天`, label: '连续学习' },
            { value: '1步', label: '到下一路径节点' },
          ]}
        />
      </div>

      <div className="mt-5 grid grid-cols-[1fr_1fr] gap-4 max-[960px]:grid-cols-1">
        <ProtoCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-h2 font-bold text-ink">资源回顾推送</h2>
            <ProtoButton href="/resources" variant="ghost">进入资源库 <ArrowRight className="h-4 w-4" /></ProtoButton>
          </div>
          <div className="space-y-1">
            {(recent.length ? recent : []).slice(0, 3).map((res) => (
              <ResourceRow key={res.id} title={res.title} meta={`${typeLabel(res.type)} · 学习进度 ${res.progress ?? 42}%`} href="/resources" />
            ))}
            {!recent.length && !loading && <EmptyLine text="暂无资源，先根据当前卡点生成一份讲义。" />}
          </div>
        </ProtoCard>

        <ProtoCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-h2 font-bold text-ink">今日新资源推荐</h2>
            <ProtoButton href="/generate" variant="ghost">根据卡点生成 <ArrowRight className="h-4 w-4" /></ProtoButton>
          </div>
          <div className="space-y-1">
            {recs.slice(0, 3).map((rec) => (
              <ResourceRow key={rec.id} title={rec.resource.title} meta={rec.reason} href="/resources" accent />
            ))}
            {!recs.length && !loading && <EmptyLine text="推荐资源为空，完成一次练习后会刷新。" />}
          </div>
        </ProtoCard>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 max-[960px]:grid-cols-1">
        {tasks.slice(0, 3).map((task) => (
          <SoftCard key={task.id} className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-blue-light text-blue">
              {task.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <b className="block text-small text-ink">{task.title}</b>
              <span className="mt-1 block text-micro text-muted">{task.duration} 分钟 · {task.status === 'completed' ? '已完成' : '等待开始'}</span>
            </div>
          </SoftCard>
        ))}
        {!tasks.length && (
          <>
            <MiniAction icon={<Target className="h-4 w-4" />} title="确认路径节点" text="先看清楚当前卡在哪里。" />
            <MiniAction icon={<BookOpen className="h-4 w-4" />} title="回顾资源" text="用短讲义补齐返回值。" />
            <MiniAction icon={<Sparkles className="h-4 w-4" />} title="达标练习" text="完成 8 道同类题。" />
          </>
        )}
      </div>
    </div>
  )
}

function ResourceRow({ title, meta, href, accent }: { title: string; meta: string; href: string; accent?: boolean }) {
  return (
    <a href={href} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[#eef2f7] py-3 last:border-b-0">
      <div className="min-w-0">
        <b className="block truncate text-h3 text-ink">{title}</b>
        <span className="mt-1 block line-clamp-1 text-micro text-muted">{meta}</span>
      </div>
      <Pill tone={accent ? 'blue' : 'neutral'}>{accent ? '推荐' : '回顾'}</Pill>
    </a>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-[10px] bg-[#f9fafb] p-4 text-small text-muted">{text}</div>
}

function MiniAction({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <SoftCard className="flex items-start gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-blue-light text-blue">{icon}</span>
      <div>
        <b className="block text-small text-ink">{title}</b>
        <span className="text-micro text-muted">{text}</span>
      </div>
    </SoftCard>
  )
}

function typeLabel(type: string) {
  const map: Record<string, string> = { document: '讲义', ppt: 'PPT', mindmap: '思维导图', quiz: '题集', reading: '阅读', code: '代码案例', video: '视频' }
  return map[type] || type
}
