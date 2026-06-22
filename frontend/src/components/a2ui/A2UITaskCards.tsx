'use client'

import { CheckCircle2, Clock3, FileText, ListChecks, PlayCircle, PlusCircle, Sparkles, Target } from 'lucide-react'
import type { A2UISurfaceState } from '@/lib/api'
import { cn } from '@/lib/utils/cn'

export type A2UITaskAction = {
  name: string
  label: string
}

export type A2UITaskCard = {
  id: string
  title: string
  description: string
  durationMinutes: number
  difficulty: string
  media?: A2UITaskMedia
  resources: string[]
  actions: A2UITaskAction[]
}

export type A2UITaskMedia = {
  type: 'document' | 'quiz' | 'video' | 'image' | 'resource' | string
  title: string
  description: string
  label: string
  href?: string
}

type TaskCardsModel = {
  summary?: string
  uiOnly?: boolean
  learner?: {
    name?: string
    stage?: string
    weakPoint?: string
    preference?: string
    dailyTime?: number
  }
  nextAction?: {
    title?: string
    description?: string
    media?: A2UITaskMedia
  }
  tasks: Record<string, unknown>[]
}

function isTaskCardsModel(value: Record<string, unknown>): value is TaskCardsModel {
  return Array.isArray(value.tasks)
}

function normalizeTasks(value: Record<string, unknown>): A2UITaskCard[] {
  if (!isTaskCardsModel(value)) return []
  return value.tasks
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => ({
      id: String(item.id || `task-${index}`),
      title: String(item.title || `学习任务 ${index + 1}`),
      description: String(item.description || ''),
      durationMinutes: Number(item.durationMinutes || 0),
      difficulty: String(item.difficulty || '常规'),
      media: normalizeMedia(item.media),
      resources: Array.isArray(item.resources) ? item.resources.map((resource) => String(resource)) : [],
      actions: Array.isArray(item.actions)
        ? item.actions
            .filter((action): action is Record<string, unknown> => Boolean(action) && typeof action === 'object')
            .map((action) => ({
              name: String(action.name || ''),
              label: String(action.label || '执行'),
            }))
            .filter((action) => action.name)
        : [],
    }))
}

function normalizeMedia(value: unknown): A2UITaskMedia | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const media = value as Record<string, unknown>
  const title = String(media.title || '')
  return {
    type: String(media.type || 'resource'),
    title: title || '学习资源',
    description: String(media.description || ''),
    label: String(media.label || '资源'),
    href: typeof media.href === 'string' ? media.href : undefined,
  }
}

function mediaTone(type: string) {
  if (type === 'video') return 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]'
  if (type === 'quiz') return 'border-[#bbf7d0] bg-[#ecfdf5] text-[#059669]'
  if (type === 'document') return 'border-[#fed7aa] bg-[#fff7ed] text-[#d97706]'
  if (type === 'image') return 'border-[#ddd6fe] bg-[#f5f3ff] text-[#7c3aed]'
  return 'border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]'
}

function MediaIcon({ type }: { type: string }) {
  if (type === 'video') return <PlayCircle className="h-4 w-4" />
  if (type === 'quiz') return <Target className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

function PersonalizedLearningPanel({
  surface,
  tasks,
  onAction,
}: {
  surface: A2UISurfaceState
  tasks: A2UITaskCard[]
  onAction: (task: A2UITaskCard, action: A2UITaskAction) => void
}) {
  const model = surface.dataModel as TaskCardsModel
  const learner = model.learner || {}
  const nextAction = model.nextAction || {}
  const nextMedia = normalizeMedia(nextAction.media)
  const actionTask = {
    id: `${surface.surfaceId}-next`,
    title: String(nextAction.title || '个性化下一步'),
    description: String(nextAction.description || ''),
    durationMinutes: Number(learner.dailyTime || 25),
    difficulty: '推荐',
    media: nextMedia,
    resources: [],
    actions: [
      { name: 'open_media', label: nextMedia?.type === 'video' ? '打开视频' : '打开资料' },
      { name: 'add_to_path', label: '加入学习路径' },
    ],
  }

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#dbeafe] bg-white shadow-[0_12px_32px_rgba(37,99,235,0.10)]">
      <div className="bg-gradient-to-r from-[#eff6ff] via-white to-[#f8fbff] px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#2563eb] text-white shadow-sm shadow-blue-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-[#1e293b]">{surface.title || '个性化学习行动面板'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full bg-white px-2 py-1 text-[#2563eb] ring-1 ring-[#dbeafe]">
                {learner.name || '学习者'} · {learner.stage || '学习推进中'}
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-[#64748b] ring-1 ring-[#e2e8f0]">
                薄弱点：{learner.weakPoint || '当前主题实践'}
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-[#64748b] ring-1 ring-[#e2e8f0]">
                偏好：{learner.preference || '直观讲解'}
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-[#64748b] ring-1 ring-[#e2e8f0]">
                {Number(learner.dailyTime || 25)} 分钟
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#bfdbfe] bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#2563eb]">推荐下一步</p>
              <h4 className="mt-1 text-base font-semibold text-[#0f172a]">{String(nextAction.title || '先完成最适合你的下一步')}</h4>
              <p className="mt-1 text-sm leading-6 text-[#64748b]">
                {String(nextAction.description || '根据画像和当前问题，先完成一个可验证学习动作。')}
              </p>
            </div>
            {nextMedia && (
              <div className={cn('shrink-0 rounded-xl border px-3 py-2 md:w-[220px]', mediaTone(nextMedia.type))}>
                <div className="flex items-center gap-2">
                  <MediaIcon type={nextMedia.type} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{nextMedia.title}</p>
                    <p className="mt-0.5 text-[11px] opacity-80">{nextMedia.label}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAction(actionTask, { name: 'open_media', label: '开始学习' })}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2563eb] px-3 text-xs font-semibold text-white shadow-sm shadow-blue-100 hover:bg-[#1d4ed8]"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              开始学习
            </button>
            <button
              type="button"
              onClick={() => onAction(actionTask, { name: 'add_to_path', label: '加入学习路径' })}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-3 text-xs font-semibold text-[#2563eb] hover:bg-[#dbeafe]"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              加入学习路径
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-0 border-t border-[#e2e8f0] md:grid-cols-3">
        {tasks.map((task, index) => (
          <div key={task.id} className="border-b border-[#eef2f7] px-4 py-3 md:border-b-0 md:border-r last:border-r-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#94a3b8]">步骤 {index + 1}</span>
              <span className="rounded-full bg-[#f8fafc] px-2 py-0.5 text-[11px] text-[#64748b]">{task.durationMinutes} 分钟</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#1e293b]">{task.title}</p>
            {task.media && (
              <div className={cn('mt-2 rounded-lg border px-2.5 py-2', mediaTone(task.media.type))}>
                <div className="flex items-center gap-2">
                  <MediaIcon type={task.media.type} />
                  <p className="truncate text-xs font-medium">{task.media.label} · {task.media.title}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function A2UITaskCards({
  surfaces,
  onAction,
}: {
  surfaces?: A2UISurfaceState[]
  onAction: (task: A2UITaskCard, action: A2UITaskAction) => void
}) {
  const taskSurfaces = (surfaces || []).filter((surface) => (
    surface.catalogId === 'sparklearn.task_cards.v1'
    && surface.components.some((component) => component.component === 'SparkTaskCards' || component.component === 'PersonalizedLearningPanel')
  ))

  if (taskSurfaces.length === 0) return null

  return (
    <div className="mt-4 space-y-3">
      {taskSurfaces.map((surface) => {
        const tasks = normalizeTasks(surface.dataModel)
        if (tasks.length === 0) return null
        const summary = typeof surface.dataModel.summary === 'string' ? surface.dataModel.summary : ''
        const isPersonalizedPanel = surface.components.some((component) => component.component === 'PersonalizedLearningPanel')

        if (isPersonalizedPanel) {
          return (
            <PersonalizedLearningPanel
              key={surface.surfaceId}
              surface={surface}
              tasks={tasks}
              onAction={onAction}
            />
          )
        }

        return (
          <section key={surface.surfaceId} className="overflow-hidden rounded-2xl border border-[#dbeafe] bg-[#f8fbff] shadow-sm">
            <div className="flex items-start gap-3 border-b border-[#dbeafe] bg-white px-4 py-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#eff6ff] text-[#2563eb]">
                <ListChecks className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1e293b]">{surface.title || '学习任务卡'}</p>
                {summary && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748b]">{summary}</p>}
              </div>
            </div>

            <div className="grid gap-3 p-3 md:grid-cols-3">
              {tasks.map((task, index) => (
                <article key={task.id} className="flex min-h-[220px] flex-col rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-[0_2px_8px_rgba(37,99,235,0.05)]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eff6ff] text-xs font-semibold text-[#2563eb]">
                      {index + 1}
                    </span>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      task.difficulty === '入门' && 'bg-emerald-50 text-emerald-600',
                      task.difficulty === '进阶' && 'bg-amber-50 text-amber-600',
                      task.difficulty === '巩固' && 'bg-violet-50 text-violet-600',
                      !['入门', '进阶', '巩固'].includes(task.difficulty) && 'bg-slate-50 text-slate-600',
                    )}>
                      {task.difficulty}
                    </span>
                  </div>
                  <h4 className="mt-3 text-sm font-semibold leading-5 text-[#1e293b]">{task.title}</h4>
                  <p className="mt-2 flex-1 text-xs leading-5 text-[#64748b]">{task.description}</p>

                  {task.media && (
                    <div className={cn('mt-3 rounded-xl border p-2.5', mediaTone(task.media.type))}>
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/70">
                          <MediaIcon type={task.media.type} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold">
                              {task.media.label}
                            </span>
                            <p className="truncate text-xs font-semibold">{task.media.title}</p>
                          </div>
                          {task.media.description && (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-4 opacity-80">
                              {task.media.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#64748b]">
                    <Clock3 className="h-3.5 w-3.5 text-[#94a3b8]" />
                    {task.durationMinutes > 0 ? `${task.durationMinutes} 分钟` : '灵活安排'}
                  </div>

                  {task.resources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {task.resources.slice(0, 3).map((resource) => (
                        <span key={resource} className="rounded-md bg-[#f1f5f9] px-2 py-1 text-[11px] text-[#64748b]">
                          {resource}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {task.actions.slice(0, 3).map((action) => {
                      const isComplete = action.name === 'complete_task'
                      const isOpenMedia = action.name === 'open_media'
                      return (
                        <button
                          key={action.name}
                          type="button"
                          onClick={() => onAction(task, action)}
                          className={cn(
                            'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors',
                            isComplete
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : isOpenMedia
                                ? 'border-[#fed7aa] bg-[#fff7ed] text-[#d97706] hover:bg-[#ffedd5]'
                                : 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb] hover:bg-[#dbeafe]',
                          )}
                        >
                          {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : isOpenMedia ? <PlayCircle className="h-3.5 w-3.5" /> : <PlusCircle className="h-3.5 w-3.5" />}
                          {action.label}
                        </button>
                      )
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
