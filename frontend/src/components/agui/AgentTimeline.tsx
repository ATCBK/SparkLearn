'use client'

import { CheckCircle2, ChevronDown, CircleDashed, Cpu, Loader2, XCircle } from 'lucide-react'
import type { AGUIEvent } from '@/lib/api'
import { cn } from '@/lib/utils/cn'

type AgentStep = {
  id: string
  title: string
  status: 'running' | 'done' | 'error'
  summary: string
  toolName?: string
  args?: Record<string, unknown>
  result?: Record<string, unknown>
  events: AGUIEvent[]
}

function stringifyCompact(value: Record<string, unknown> | undefined) {
  if (!value || Object.keys(value).length === 0) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function buildSteps(events: AGUIEvent[] = []): AgentStep[] {
  const steps = new Map<string, AgentStep>()

  events.forEach((event) => {
    const stepId = event.stepId || (event.type === 'RunStarted' ? 'run' : '')
    if (!stepId || stepId === 'run') return

    const existing = steps.get(stepId)
    const next: AgentStep = existing || {
      id: stepId,
      title: event.title || event.label || stepId,
      status: 'running',
      summary: event.summary || '',
      toolName: event.toolName,
      events: [],
    }

    next.events = [...next.events, event]
    if (event.title || event.label) next.title = event.title || event.label || next.title
    if (event.summary) next.summary = event.summary
    if (event.toolName) next.toolName = event.toolName
    if (event.type === 'ToolCallArgs') next.args = event.args
    if (event.type === 'ToolCallResult') next.result = event.data
    if (event.type === 'StepFinished' || event.type === 'ToolCallResult') {
      next.status = event.status === 'error' ? 'error' : 'done'
    }
    if (event.type === 'RunError') {
      next.status = 'error'
    }
    steps.set(stepId, next)
  })

  return Array.from(steps.values())
}

function statusLabel(status: AgentStep['status']) {
  if (status === 'running') return '执行中'
  if (status === 'error') return '异常'
  return '完成'
}

function StatusIcon({ status }: { status: AgentStep['status'] }) {
  if (status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin" />
  if (status === 'error') return <XCircle className="h-3.5 w-3.5" />
  return <CheckCircle2 className="h-3.5 w-3.5" />
}

function AgentTimelineSkeleton() {
  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-[#dbeafe] bg-[#f8fbff] text-left shadow-[0_8px_24px_rgba(37,99,235,0.06)]">
      <div className="flex items-center gap-2 border-b border-[#e6eefb] bg-white/75 px-3.5 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e6f0ff] text-[#2563eb]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#1e293b]">调用过程加载中</p>
          <p className="text-[10px] leading-4 text-[#64748b]">正在接收 AG-UI 事件流，稍后可展开查看参数和结果</p>
        </div>
      </div>
      <div className="divide-y divide-[#e6eefb]">
        {['加载学习画像', '分析本轮学习意图', '同步 A2UI 个性化面板'].map((title, index) => (
          <div key={title} className="flex items-center gap-3 px-3.5 py-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb]">
              {index === 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleDashed className="h-3.5 w-3.5 animate-pulse" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#1e293b]">{index + 1}. {title}</p>
              <div className="mt-1 h-2.5 w-48 max-w-full animate-pulse rounded-full bg-[#dbeafe]" />
            </div>
            <span className="shrink-0 rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-medium text-[#2563eb]">
              等待中
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function AgentTimeline({ events, loading = false }: { events?: AGUIEvent[], loading?: boolean }) {
  const steps = buildSteps(events)
  if (steps.length === 0) return loading ? <AgentTimelineSkeleton /> : null

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-[#dbeafe] bg-[#f8fbff] text-left shadow-[0_8px_24px_rgba(37,99,235,0.06)]">
      <div className="flex items-center gap-2 border-b border-[#e6eefb] bg-white/75 px-3.5 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e6f0ff] text-[#2563eb]">
          <Cpu className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#1e293b]">调用过程</p>
          <p className="text-[10px] leading-4 text-[#64748b]">AG-UI 事件流 · 默认折叠，可展开查看参数和结果</p>
        </div>
      </div>
      <div className="divide-y divide-[#e6eefb]">
        {steps.map((step, index) => {
          const argsText = stringifyCompact(step.args)
          const resultText = stringifyCompact(step.result)
          const defaultOpen = index === 0 || step.status === 'running'
          return (
            <details key={step.id} open={defaultOpen} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3 transition-colors hover:bg-white/70">
                <div className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  step.status === 'done' && 'bg-emerald-50 text-emerald-600',
                  step.status === 'running' && 'bg-[#eff6ff] text-[#2563eb]',
                  step.status === 'error' && 'bg-rose-50 text-rose-600',
                )}>
                  <StatusIcon status={step.status} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-semibold text-[#1e293b]">{index + 1}. {step.title}</span>
                    {step.toolName && (
                      <span className="hidden shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] text-[#64748b] ring-1 ring-[#e2e8f0] sm:inline-flex">
                        {step.toolName}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#64748b]">{step.summary || '等待事件同步'}</p>
                </div>
                <span className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  step.status === 'done' && 'bg-emerald-50 text-emerald-600',
                  step.status === 'running' && 'bg-[#eff6ff] text-[#2563eb]',
                  step.status === 'error' && 'bg-rose-50 text-rose-600',
                )}>
                  {statusLabel(step.status)}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#94a3b8] transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-2 bg-white/55 px-3.5 pb-3 pl-[52px] text-[11px] leading-5 text-[#475569]">
                {!argsText && !resultText && (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#dbeafe] bg-white px-3 py-2 text-[#64748b]">
                    <CircleDashed className="h-3.5 w-3.5" />
                    暂无可展开参数，等待后续事件。
                  </div>
                )}
                {argsText && (
                  <div className="rounded-lg border border-[#e2e8f0] bg-white p-2.5">
                    <p className="mb-1 text-[10px] font-semibold text-[#64748b]">调用参数</p>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-[#334155]">{argsText}</pre>
                  </div>
                )}
                {resultText && (
                  <div className="rounded-lg border border-[#dcfce7] bg-[#f7fff9] p-2.5">
                    <p className="mb-1 text-[10px] font-semibold text-emerald-700">调用结果</p>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-[#166534]">{resultText}</pre>
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
