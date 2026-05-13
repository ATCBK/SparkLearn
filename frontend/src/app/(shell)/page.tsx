'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { api, Recommendation, Resource, Task } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    const [taskData, resourceData, recData] = await Promise.all([
      api.getTodayTasks(),
      api.getRecentResources(),
      api.getRecommendations(),
    ])
    setTasks(taskData)
    setResources(resourceData)
    setRecs(recData)
  }

  useEffect(() => {
    void load()
  }, [])

  const pending = tasks.filter(t => t.status !== 'completed')
  const totalMinutes = pending.reduce((sum, task) => sum + task.duration, 0) || 24
  const completion = tasks.length ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 72

  const focusTitle = useMemo(() => {
    const first = recs[0]?.resource?.title || resources[0]?.title || '函数返回值'
    return first.length > 18 ? '函数返回值' : first
  }, [recs, resources])

  async function addTask() {
    const title = newTitle.trim()
    if (!title) return
    setBusy('create')
    try {
      const created = await api.createTask({ title, type: 'practice', duration: 15 })
      setTasks(prev => [...prev, created])
      setNewTitle('')
    } finally {
      setBusy('')
    }
  }

  async function toggleTask(task: Task) {
    setBusy(task.id)
    try {
      const next = task.status === 'completed' ? 'pending' : 'completed'
      const updated = await api.updateTaskStatus(task.id, next)
      setTasks(prev => prev.map(item => item.id === task.id ? updated : item))
    } finally {
      setBusy('')
    }
  }

  async function removeTask(taskId: string) {
    setBusy(taskId)
    try {
      await api.deleteTask(taskId)
      setTasks(prev => prev.filter(task => task.id !== taskId))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-120px)]" style={{ backgroundImage: 'url(/gongzuotai-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div className="absolute inset-0 bg-white/85 pointer-events-none" />
      <div className="relative z-10">
      <PageHead
        eyebrow="学习中心 / 资源回顾与新推荐"
        title="今日学习工作台"
        description="今天先把当前卡点补上，再完成一轮短练习，最后确认是否进入下一模块。"
        chips={[
          { value: `${totalMinutes} 分钟`, label: '今日预计' },
          { value: `${pending.length} 项`, label: '路径待确认' },
          { value: '12 天', label: '连续学习' },
        ]}
      />

      <ProtoCard className="relative overflow-hidden p-[22px]">
        <div className="max-w-[680px] space-y-3.5">
          <Pill tone="blue">优先薄弱点</Pill>
          <h2 className="text-[24px] font-bold leading-tight text-ink">{focusTitle}</h2>
          <p className="text-small leading-6 text-muted">
            先补当前卡点，再做短练习。做完这一轮，今天的路径就能继续往前走。
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill tone="orange">先补当前卡点</Pill>
            <Pill tone="blue">再做短练习</Pill>
            <Pill tone="purple">做完确认下一步</Pill>
            <Pill tone="green">预计 {totalMinutes} 分钟</Pill>
          </div>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <ProtoButton href="/resources">开始回顾资源</ProtoButton>
            <ProtoButton href="/practice" variant="secondary">先做练习</ProtoButton>
          </div>
        </div>
      </ProtoCard>

      <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-[12px] border border-line bg-white shadow-md max-[760px]:grid-cols-2">
        {[
          [`${completion}%`, '今日任务', '已完成比例'],
          [`${tasks.length || 8} 项`, '任务池', '可创建和删除'],
          ['12 天', '连续学习', '保持得不错'],
          [`${pending.length} 项`, '待完成', '完成后进入下一步'],
        ].map(([value, label, desc], idx) => (
          <div key={label} className={`p-4 ${idx !== 3 ? 'border-r border-[#eef2f7]' : ''}`}>
            <b className="block text-[20px] text-ink">{value}</b>
            <span className="mt-1 block text-micro leading-5 text-muted">{label}<br />{desc}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_.85fr] gap-4 max-[960px]:grid-cols-1">
        <ProtoCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-h2 font-bold text-ink">今日任务</h2>
            <Pill tone="blue">{pending.length} 条待完成</Pill>
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void addTask()
            }}
          >
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3 text-small outline-none focus:border-blue"
              placeholder="添加今天要完成的学习任务"
            />
            <ProtoButton disabled={busy === 'create' || !newTitle.trim()}><Plus className="h-4 w-4" />添加</ProtoButton>
          </form>
          <div className="mt-5 space-y-2">
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} busy={busy === task.id} onToggle={() => void toggleTask(task)} onDelete={() => void removeTask(task.id)} />
            ))}
            {!tasks.length && <SoftCard className="text-small text-muted">暂无任务，先创建一条今日学习任务。</SoftCard>}
          </div>
        </ProtoCard>

        <ProtoCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-h2 font-bold text-ink">今日新资源推荐</h2>
            <ProtoButton href="/resources" variant="ghost">查看全部 →</ProtoButton>
          </div>
          <div className="mt-5 space-y-1">
            {(recs.length ? recs : resources.map((resource, idx) => ({
              id: resource.id,
              resource,
              reason: idx === 0 ? '适合作为当前卡点的第一份复习资源。' : '基于最近学习记录推荐。',
              category: 'today' as const,
            }))).slice(0, 3).map(rec => (
              <Reco key={rec.id} title={rec.resource.title} meta={rec.reason} action="学习" />
            ))}
          </div>
          <ProtoButton href="/generate" variant="secondary" className="mt-5">根据当前卡点生成新资源</ProtoButton>
        </ProtoCard>
      </div>
      </div>
    </div>
  )
}

function TaskRow({ task, busy, onToggle, onDelete }: { task: Task; busy: boolean; onToggle: () => void; onDelete: () => void }) {
  const completed = task.status === 'completed'
  return (
    <SoftCard className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 bg-white">
      <button
        onClick={onToggle}
        disabled={busy}
        className={`grid h-7 w-7 place-items-center rounded-full border ${completed ? 'border-green bg-green text-white' : 'border-line bg-white text-muted hover:border-blue'}`}
        aria-label={completed ? '标记为未完成' : '标记为完成'}
      >
        {completed && <Check className="h-4 w-4" />}
      </button>
      <div className="min-w-0">
        <b className={`block truncate text-small ${completed ? 'text-muted line-through' : 'text-ink'}`}>{task.title}</b>
        <span className="text-micro text-muted">{task.duration} 分钟 · {task.type}</span>
      </div>
      <Pill tone={completed ? 'green' : 'orange'}>{completed ? '已完成' : '待完成'}</Pill>
      <button onClick={onDelete} disabled={busy} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red-light hover:text-red" aria-label="删除任务">
        <Trash2 className="h-4 w-4" />
      </button>
    </SoftCard>
  )
}

function Reco({ title, meta, action }: { title: string; meta: string; action: string }) {
  return (
    <SoftCard className="grid grid-cols-[1fr_auto] items-center gap-3 bg-white">
      <div className="min-w-0">
        <b className="block text-small text-ink">{title}</b>
        <span className="mt-1 block text-micro leading-5 text-muted">{meta}</span>
      </div>
      <ProtoButton href="/resources" variant="tertiary">{action}</ProtoButton>
    </SoftCard>
  )
}
