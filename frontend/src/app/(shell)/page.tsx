'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Trash2, PieChart, ClipboardList, Flame, CheckCircle2, FileText, Brain, BookOpen, Sparkles, Clock, GitBranch, NotebookPen } from 'lucide-react'
import { api, Recommendation, Resource, StudentProfile, Task } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [profileReady, setProfileReady] = useState(false)

  async function load() {
    try {
      const [taskData, resourceData, recData, profileData] = await Promise.all([
        api.getTodayTasks(),
        api.getRecentResources(),
        api.getRecommendations(),
        api.getProfile().catch(() => null),
      ])
      setTasks(taskData)
      setResources(resourceData)
      setRecs(recData)
      setProfileReady(hasLearningProfile(profileData))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const pending = tasks.filter(t => t.status !== 'completed')
  const totalMinutes = pending.reduce((sum, task) => sum + task.duration, 0)
  const completion = tasks.length ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0
  const hasLearningData = tasks.length > 0 || resources.length > 0 || recs.length > 0

  const focusTitle = useMemo(() => {
    const first = recs[0]?.resource?.title || resources[0]?.title || ''
    return first && first.length > 18 ? first.slice(0, 18) : first
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
    <div>
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#6b7280]">正在加载学习空间...</span>
          </div>
        </div>
      ) : (
      <div>
      <PageHead
        eyebrow="学习中心 / 资源回顾与新推荐"
        title="今日学习工作台"
        description={hasLearningData ? '今天先处理待完成任务，再根据学习记录继续推进。' : '这是你的第一次登录。完成画像采集、创建任务或提交练习后，这里会生成个人学习工作台。'}
        chips={[
          { value: tasks.length ? `${totalMinutes} 分钟` : '暂无', label: '今日预计', icon: <Clock className="h-4 w-4" />, tone: 'blue' as const },
          { value: `${pending.length} 项`, label: '待完成任务', icon: <GitBranch className="h-4 w-4" />, tone: 'orange' as const },
          { value: '0 天', label: '连续学习', icon: <Flame className="h-4 w-4" />, tone: 'green' as const },
        ]}
      />

      <ProtoCard className="relative overflow-hidden p-[22px] border-0">
        {/* 背景图 - 铺满整个卡片 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ui-images/home-hero.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div className="relative z-10 max-w-[680px] space-y-3.5">
          <Pill tone="blue">{hasLearningData ? '优先薄弱点' : '首次学习空间'}</Pill>
          <h2 className="text-[24px] font-bold leading-tight text-ink">{focusTitle || '还没有形成个人学习数据'}</h2>
          <p className="text-small leading-6 text-muted">
            {hasLearningData ? '先补当前卡点，再做短练习。做完这一轮，今天的路径就能继续往前走。' : '完成画像采集后，系统会开始为你生成路径、任务、资源和学习报告。'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill tone="orange">{hasLearningData ? '先补当前卡点' : '等待画像采集'}</Pill>
            <Pill tone="blue">{hasLearningData ? '再做短练习' : '暂无今日任务'}</Pill>
            <Pill tone="purple">{hasLearningData ? '做完确认下一步' : '暂无学习报告'}</Pill>
            <Pill tone="green">{tasks.length ? `预计 ${totalMinutes} 分钟` : '预计暂无'}</Pill>
          </div>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <ProtoButton href={profileReady ? '/profile' : '/onboarding'} data-guide-target="profile-entry">
              {profileReady ? '查看学习画像' : '完善学习画像'}
            </ProtoButton>
            <ProtoButton href={hasLearningData ? '/practice' : '/path'} variant="secondary" data-guide-target="path-entry">{hasLearningData ? '先做练习' : '查看学习路径'}</ProtoButton>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-new-user-guide'))}
              data-guide-target="guide-replay"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#bfdbfe] bg-white px-4 py-2 text-small font-bold text-[#2563eb] shadow-sm transition-colors hover:bg-[#eff6ff]"
            >
              新手引导
            </button>
          </div>
        </div>
      </ProtoCard>
      <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-[12px] border border-line bg-white shadow-md max-[760px]:grid-cols-2">
        {[
          { value: `${completion}%`, label: '今日任务', desc: '已完成比例', icon: <PieChart className="h-5 w-5" />, color: 'bg-[#eff6ff] text-[#2563eb]' },
          { value: `${tasks.length} 项`, label: '任务池', desc: tasks.length ? '可创建和删除' : '暂无任务', icon: <ClipboardList className="h-5 w-5" />, color: 'bg-[#eff6ff] text-[#2563eb]' },
          { value: '0 天', label: '连续学习', desc: '开始后累计', icon: <Flame className="h-5 w-5" />, color: 'bg-[#ecfdf5] text-[#059669]' },
          { value: `${pending.length} 项`, label: '待完成', desc: '完成后进入下一步', icon: <CheckCircle2 className="h-5 w-5" />, color: 'bg-[#ecfdf5] text-[#059669]' },
        ].map((item, idx) => (
          <div key={item.label} className={`flex items-center gap-3 p-4 ${idx !== 3 ? 'border-r border-[#eef2f7]' : ''}`}>
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${item.color}`}>
              {item.icon}
            </div>
            <div>
              <b className="block text-[20px] text-ink">{item.value}</b>
              <span className="block text-micro leading-5 text-muted">{item.label}<br />{item.desc}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_.85fr] gap-4 max-[960px]:grid-cols-1">
        <ProtoCard>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#eff6ff] text-[#2563eb]">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h2 className="text-h2 font-bold text-ink">今日任务</h2>
            </div>
            <Pill tone="blue">{pending.length ? `${pending.length} 条待完成` : '暂无任务'}</Pill>
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
              <TaskRow
                key={task.id}
                task={task}
                busy={busy === task.id}
                onToggle={() => void toggleTask(task)}
                onDelete={() => void removeTask(task.id)}
                onNote={() => openLearningNotes({
                  type: 'task',
                  id: task.id,
                  title: task.title,
                  href: '/',
                })}
              />
            ))}
            {!tasks.length && <SoftCard className="text-small text-muted">暂无任务。第一次登录时这里会保持空状态，创建任务或完成画像后再继续推进。</SoftCard>}
          </div>
        </ProtoCard>

        <ProtoCard>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#fff7ed] text-[#d97706]">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-h2 font-bold text-ink">今日新资源推荐</h2>
            </div>
            <ProtoButton href="/generate?view=library" variant="ghost">查看全部 →</ProtoButton>
          </div>
          <div className="mt-5 space-y-1">
            {(recs.length ? recs : resources.map((resource, idx) => ({
              id: resource.id,
              resource,
              reason: idx === 0 ? '适合作为当前卡点的第一份复习资源。' : '基于最近学习记录推荐。',
              category: 'today' as const,
            }))).slice(0, 3).map(rec => (
              <Reco key={rec.id} title={rec.resource.title} meta={rec.reason} action="学习" resourceId={rec.resource.id} />
            ))}
            {!recs.length && !resources.length && (
              <SoftCard className="text-small text-muted">暂无推荐资源。完成画像采集、上传知识文件或生成资源后，系统会在这里推荐下一步内容。</SoftCard>
            )}
          </div>
          <ProtoButton href="/generate" variant="secondary" className="mt-5" data-guide-target="resource-entry">根据当前卡点生成新资源</ProtoButton>
        </ProtoCard>
      </div>
      </div>
      )}
    </div>
  )
}

function hasLearningProfile(profile: StudentProfile | null) {
  if (!profile) return false
  return Boolean(
    profile.major?.trim() ||
    profile.goals?.some(item => item.trim()) ||
    profile.knowledgeLevel?.trim() ||
    profile.weakPoints?.some(item => item.trim()) ||
    profile.learningPreference?.some(item => item.trim()),
  )
}

function openLearningNotes(source: { type: 'task' | 'resource'; id?: string; title: string; href: string }) {
  window.dispatchEvent(new CustomEvent('open-learning-notes', {
    detail: {
      source,
      draftTitle: `关于${source.title}的笔记`,
      openEditor: true,
    },
  }))
}

function TaskRow({ task, busy, onToggle, onDelete, onNote }: { task: Task; busy: boolean; onToggle: () => void; onDelete: () => void; onNote: () => void }) {
  const completed = task.status === 'completed'
  const typeIcons: Record<string, { icon: React.ReactNode; color: string }> = {
    reading: { icon: <FileText className="h-4 w-4" />, color: 'bg-[#eff6ff] text-[#2563eb]' },
    quiz: { icon: <Brain className="h-4 w-4" />, color: 'bg-[#f3efff] text-[#7c3aed]' },
    practice: { icon: <BookOpen className="h-4 w-4" />, color: 'bg-[#eff6ff] text-[#2563eb]' },
    video: { icon: <Flame className="h-4 w-4" />, color: 'bg-[#fff7ed] text-[#d97706]' },
  }
  const t = typeIcons[task.type] || typeIcons.reading

  return (
    <SoftCard className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] items-center gap-3 bg-white">
      {/* 彩色图标 */}
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${t.color}`}>
        {t.icon}
      </div>
      {/* 勾选按钮 */}
      <button
        onClick={onToggle}
        disabled={busy}
        className={`grid h-6 w-6 place-items-center rounded-full border-2 transition-colors ${completed ? 'border-[#059669] bg-[#059669] text-white' : 'border-[#d1d5db] bg-white hover:border-[#2563eb]'}`}
        aria-label={completed ? '标记为未完成' : '标记为完成'}
      >
        {completed && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0">
        <b className={`block truncate text-small ${completed ? 'text-muted line-through' : 'text-ink'}`}>{task.title}</b>
        <span className="text-micro text-muted">{task.duration} 分钟 · {task.type}</span>
      </div>
      <Pill tone={completed ? 'green' : 'orange'}>{completed ? '已完成' : '待完成'}</Pill>
      <button onClick={onNote} data-testid="task-note-button" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-blue-light hover:text-blue" aria-label="为任务记笔记" title="记笔记">
        <NotebookPen className="h-4 w-4" />
      </button>
      <button onClick={onDelete} disabled={busy} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red-light hover:text-red" aria-label="删除任务">
        <Trash2 className="h-4 w-4" />
      </button>
    </SoftCard>
  )
}

function Reco({ title, meta, action, resourceId }: { title: string; meta: string; action: string; resourceId?: string }) {
  const href = resourceId ? `/generate?view=library&id=${resourceId}` : '/generate?view=library'
  return (
    <SoftCard className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 bg-white">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb]">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <b className="block text-small text-ink">{title}</b>
        <span className="mt-1 block text-micro leading-5 text-muted">{meta}</span>
      </div>
      <button
        onClick={() => openLearningNotes({ type: 'resource', id: resourceId, title, href })}
        data-testid="resource-note-button"
        data-guide-target="resource-note-button"
        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-blue-light hover:text-blue"
        aria-label="为资源记笔记"
        title="记笔记"
      >
        <NotebookPen className="h-4 w-4" />
      </button>
      <ProtoButton href={href} variant="tertiary">{action}</ProtoButton>
    </SoftCard>
  )
}
