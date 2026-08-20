'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  Clock3,
  FileText,
  Flag,
  History,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'
import {
  api,
  type MasteryRecord,
  type ProfileAnalysis,
  type ProfileHistoryItem,
  type ProfileHistoryResp,
  type Resource,
  type StudentProfile,
  type Task,
} from '@/lib/api'

const EMPTY_HISTORY: ProfileHistoryResp = {
  items: [],
  update_interval_days: 3,
  next_update_at: '',
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [profileReloadKey, setProfileReloadKey] = useState(0)
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null)
  const [history, setHistory] = useState<ProfileHistoryResp>(EMPTY_HISTORY)
  const [recentResources, setRecentResources] = useState<Resource[]>([])
  const [mastery, setMastery] = useState<MasteryRecord[]>([])
  const [todayTasks, setTodayTasks] = useState<Task[]>([])
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  useEffect(() => {
    let active = true
    setProfileStatus('loading')

    Promise.all([
      api.getProfile()
        .then(data => ({ status: 'ready' as const, data }))
        .catch(error => api.isProfileNotFoundError(error)
          ? ({ status: 'missing' as const, data: null })
          : ({ status: 'error' as const, data: null })),
      api.getCurrentProfileAnalysis().catch(() => null),
      api.getProfileHistory().catch(() => EMPTY_HISTORY),
      api.getRecentResources().then(items => items.slice(0, 3)).catch(() => []),
      api.getMasteryData().catch(() => []),
      api.getTodayTasks().catch(() => []),
    ]).then(([profileResult, analysisData, historyData, resourceData, masteryData, taskData]) => {
      if (!active) return
      setProfile(profileResult.data)
      setProfileStatus(profileResult.status)
      setAnalysis(analysisData)
      setHistory(historyData)
      setRecentResources(resourceData)
      setMastery(masteryData)
      setTodayTasks(taskData)
    })

    return () => {
      active = false
    }
  }, [profileReloadKey])

  async function regenerateAnalysis() {
    setAnalysisLoading(true)
    setAnalysisError('')
    try {
      const result = await api.analyzeProfileHistory()
      setAnalysis(result)
      const latestHistory = await api.getProfileHistory().catch(() => history)
      setHistory(latestHistory)
    } catch {
      setAnalysisError('暂时无法重新生成分析，请稍后重试。')
    } finally {
      setAnalysisLoading(false)
    }
  }

  if (profileStatus === 'loading') return <ProfileLoading />

  if (profileStatus === 'error') {
    return <ProfileLoadError onRetry={() => setProfileReloadKey(value => value + 1)} />
  }

  if (profileStatus === 'missing') return <EmptyProfile />

  if (!profile) {
    return <ProfileLoadError onRetry={() => setProfileReloadKey(value => value + 1)} />
  }

  return (
    <div data-guide-target="profile-overview">
      <PageHead
        eyebrow="学习画像 / AI 融合分析"
        title="学习画像"
        description="把目标、基础、偏好与学习记录放在一起理解，帮你找到当前最值得投入的方向。"
        actions={(
          <ProtoButton href="/profile/settings" variant="ghost">
            查看画像资料 <ArrowRight className="h-4 w-4" />
          </ProtoButton>
        )}
      />

      {analysis ? (
        <>
          <AnalysisOverview analysis={analysis} onRegenerate={() => void regenerateAnalysis()} loading={analysisLoading} />
          {analysisError ? (
            <div role="alert" className="mt-3 flex items-center gap-2 rounded-[10px] border border-orange/20 bg-orange-light px-4 py-3 text-small text-orange">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {analysisError}
            </div>
          ) : null}
          <AnalysisFocus analysis={analysis} />
          <AnalysisEvidence analysis={analysis} />
        </>
      ) : (
        <UnavailableAnalysis onRegenerate={() => void regenerateAnalysis()} loading={analysisLoading} error={analysisError} />
      )}

      <LearningSignals
        historyCount={history.items.length}
        resourceCount={recentResources.length}
        masteryCount={mastery.length}
        taskCount={todayTasks.length}
      />
      <ProfileHistoryPanel
        history={history}
        loading={analysisLoading}
        onRegenerate={() => void regenerateAnalysis()}
      />
    </div>
  )
}

function AnalysisOverview({
  analysis,
  onRegenerate,
  loading,
}: {
  analysis: ProfileAnalysis
  onRegenerate: () => void
  loading: boolean
}) {
  const status = getAnalysisStatus(analysis)
  const confidence = formatConfidence(analysis.confidence)

  return (
    <ProtoCard className="relative overflow-hidden border-[#cfe0f4] bg-[linear-gradient(135deg,#ffffff_0%,#f5f9ff_58%,#eef6ff_100%)] p-0">
      <div aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#dcecff]/55 blur-2xl" />
      <div className="relative grid grid-cols-[minmax(0,1fr)_260px] gap-6 p-6 max-[860px]:grid-cols-1 max-[760px]:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={status.tone}>{status.label}</Pill>
            <Pill>v{analysis.profile_version}</Pill>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-blue text-white shadow-sm">
              <Brain className="h-5 w-5" />
            </span>
            <h2 className="text-[26px] font-bold leading-tight text-ink">当前综合画像</h2>
          </div>
          <p className="mt-5 max-w-[820px] text-[18px] font-bold leading-8 text-ink">
            {analysis.overview || '当前综合结论尚未完整生成。'}
          </p>
          <p className="mt-3 max-w-[900px] whitespace-pre-line text-body leading-8 text-muted">
            {analysis.narrative || '随着画像资料和学习记录补充，这里会形成连续的学习画像描述。'}
          </p>
        </div>

        <aside aria-label="分析状态" className="rounded-[14px] border border-white/90 bg-white/85 p-4 shadow-sm backdrop-blur">
          <span className="text-micro font-bold tracking-[0.12em] text-soft">分析可信度</span>
          <div className="mt-2 flex items-end gap-2">
            <strong className="text-[34px] leading-none text-blue">{confidence}</strong>
            <span className="pb-1 text-micro text-muted">当前置信度</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e8eff8]">
            <div className="h-full rounded-full bg-blue" style={{ width: confidence }} />
          </div>
          <dl className="mt-5 space-y-3 border-t border-line pt-4 text-small">
            <MetadataRow label="画像版本" value={`v${analysis.profile_version}`} />
            <MetadataRow label="分析来源" value={formatSource(analysis.source_type)} />
            <MetadataRow label="更新时间" value={formatDateTime(analysis.updated_at) || '未记录'} />
          </dl>
          <ProtoButton className="mt-5 w-full" variant="secondary" onClick={onRegenerate} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '正在重新分析' : '重新生成分析'}
          </ProtoButton>
        </aside>
      </div>
    </ProtoCard>
  )
}

function AnalysisFocus({ analysis }: { analysis: ProfileAnalysis }) {
  return (
    <section aria-labelledby="profile-focus-title" className="mt-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-blue" />
        <h2 id="profile-focus-title" className="text-h2 font-bold text-ink">这些结论最值得关注</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 max-[820px]:grid-cols-1">
        <InsightCard
          title="目标与差距"
          icon={<Target className="h-5 w-5" />}
          tone="blue"
          className="col-span-2 max-[820px]:col-span-1"
        >
          <p className="text-body leading-7 text-ink">{analysis.goal_gap || '目标或当前基础尚未采集，差距待验证。'}</p>
        </InsightCard>
        <InsightCard title="优势" icon={<CheckCircle2 className="h-5 w-5" />} tone="green">
          <AnalysisList items={analysis.strengths} empty="暂无足够证据确认稳定优势。" />
        </InsightCard>
        <InsightCard title="待提升点" icon={<Flag className="h-5 w-5" />} tone="orange">
          <AnalysisList items={analysis.focus_areas} empty="暂无明确待提升点，待后续学习记录验证。" />
        </InsightCard>
        <InsightCard title="适合你的学习方式" icon={<Lightbulb className="h-5 w-5" />} tone="purple">
          <p className="text-body leading-7 text-ink">{analysis.learning_strategy || '学习偏好和可用时间尚未采集。'}</p>
        </InsightCard>
        <InsightCard title="下一步行动" icon={<BookOpenCheck className="h-5 w-5" />} tone="cyan">
          <AnalysisList items={analysis.next_actions} ordered empty="暂无可靠的行动建议，可先补充画像资料。" />
        </InsightCard>
      </div>
    </section>
  )
}

function AnalysisEvidence({ analysis }: { analysis: ProfileAnalysis }) {
  return (
    <details className="group mt-5 rounded-[12px] border border-line bg-white shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-small font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue" />
          查看分析依据
        </span>
        <span aria-hidden="true" className="text-blue transition-transform group-open:rotate-90">→</span>
      </summary>
      <div className="grid grid-cols-2 gap-4 border-t border-line p-5 max-[760px]:grid-cols-1">
        <div>
          <h3 className="text-small font-bold text-ink">使用的证据</h3>
          {analysis.evidence.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {analysis.evidence.map((item, index) => (
                <li key={`${item.source}-${item.captured_at}-${index}`} className="rounded-[10px] bg-[#f7faff] p-3 text-small">
                  <b className="block text-ink">{item.label}</b>
                  <span className="mt-1 block text-micro text-muted">
                    {formatSource(item.source)} · {formatDateTime(item.captured_at) || '未记录时间'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-small leading-6 text-muted">暂无可展示的证据条目。</p>
          )}
        </div>
        <div>
          <h3 className="text-small font-bold text-ink">分析过程</h3>
          {analysis.analysis_steps.length > 0 ? (
            <ol className="mt-3 space-y-2">
              {analysis.analysis_steps.map((step, index) => (
                <li key={`${step.title}-${index}`} className="flex gap-3 rounded-[10px] bg-[#f7faff] p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-light text-micro font-bold text-blue">{index + 1}</span>
                  <span>
                    <b className="block text-small text-ink">{step.title}</b>
                    <span className="mt-1 block text-micro leading-5 text-muted">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-small leading-6 text-muted">本次分析未记录详细过程。</p>
          )}
        </div>
      </div>
    </details>
  )
}

function LearningSignals({
  historyCount,
  resourceCount,
  masteryCount,
  taskCount,
}: {
  historyCount: number
  resourceCount: number
  masteryCount: number
  taskCount: number
}) {
  const signals = [
    { label: '画像快照', value: historyCount, hint: '用于识别变化' },
    { label: '近期资源', value: resourceCount, hint: '反映学习投入' },
    { label: '掌握记录', value: masteryCount, hint: '用于验证结论' },
    { label: '今日任务', value: taskCount, hint: '连接下一步行动' },
  ]

  return (
    <section aria-labelledby="learning-signals-title" className="mt-5">
      <h2 id="learning-signals-title" className="sr-only">画像之外的学习信号</h2>
      <div className="grid grid-cols-4 overflow-hidden rounded-[12px] border border-line bg-white shadow-md max-[760px]:grid-cols-2">
        {signals.map((signal, index) => (
          <div key={signal.label} className={`p-4 ${index < signals.length - 1 ? 'border-r border-line max-[760px]:border-r-0' : ''}`}>
            <b className="block text-[20px] text-ink">{signal.value}</b>
            <span className="mt-1 block text-small font-bold text-ink">{signal.label}</span>
            <span className="mt-1 block text-micro text-muted">{signal.hint}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProfileHistoryPanel({
  history,
  loading,
  onRegenerate,
}: {
  history: ProfileHistoryResp
  loading: boolean
  onRegenerate: () => void
}) {
  return (
    <ProtoCard className="mt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue" />
            <h2 className="text-h2 font-bold text-ink">历史画像</h2>
          </div>
          <p className="mt-2 text-small leading-6 text-muted">
            查看综合结论如何随学习证据变化，并在需要时重新生成当前分析。
          </p>
        </div>
        <ProtoButton variant="secondary" onClick={onRegenerate} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '正在分析' : '重新分析'}
        </ProtoButton>
      </div>

      {history.items.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
          {history.items.slice(0, 4).map((item, index) => (
            <HistoryItem key={item.id || `${item.captured_at}-${index}`} item={item} latest={index === 0} />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[12px] border border-dashed border-line bg-[#fbfdff] p-5 text-small leading-6 text-muted">
          暂无历史画像。完成建档或更新资料后，系统会在这里保留可追溯的结论快照。
        </div>
      )}
    </ProtoCard>
  )
}

function HistoryItem({ item, latest }: { item: ProfileHistoryItem; latest: boolean }) {
  const narrative = item.narrative?.trim() || item.summary?.trim() || '本次快照暂无摘要。'
  const source = formatHistoryAnalysisSource(item.analysis_source)
  const confidence = formatHistoryConfidence(item.confidence)

  return (
    <SoftCard className={latest ? 'border-blue/25 bg-blue-light' : 'bg-[#fbfdff]'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pill tone={latest ? 'blue' : 'neutral'}>{latest ? '当前快照' : `v${item.version}`}</Pill>
        <span className="flex items-center gap-1 text-micro text-muted">
          <Clock3 className="h-3.5 w-3.5" />
          {formatDateTime(item.captured_at) || '未记录'}
        </span>
      </div>
      <p className="mt-3 text-small leading-6 text-ink">{narrative}</p>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-micro text-muted">
        <span>来源：{source}</span>
        <span>{confidence}</span>
        <span>{formatReason(item.reason)}</span>
      </div>
    </SoftCard>
  )
}

function UnavailableAnalysis({
  onRegenerate,
  loading,
  error,
}: {
  onRegenerate: () => void
  loading: boolean
  error: string
}) {
  return (
    <ProtoCard className="border-dashed border-[#bfd4ec] bg-[#f8fbff]">
      <div className="grid min-h-[260px] place-items-center text-center">
        <div className="max-w-[560px]">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-blue-light text-blue">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-h2 font-bold text-ink">分析暂时不可用</h2>
          <p className="mt-2 text-small leading-6 text-muted">当前画像资料仍在，但综合分析还没有成功读取。你可以重新生成，也可以先检查画像资料。</p>
          {error ? <p role="alert" className="mt-3 text-small text-orange">{error}</p> : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <ProtoButton onClick={onRegenerate} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? '正在生成' : '生成综合分析'}
            </ProtoButton>
            <ProtoButton href="/profile/settings" variant="secondary">查看画像资料</ProtoButton>
          </div>
        </div>
      </div>
    </ProtoCard>
  )
}

function EmptyProfile() {
  return (
    <div data-guide-target="profile-overview">
      <PageHead
        eyebrow="学习画像 / 等待建档"
        title="学习画像"
        description="建档后，AI 会融合你的目标、基础与学习偏好，形成可持续更新的综合画像。"
      />
      <ProtoCard className="border-dashed border-[#bfd4ec] bg-[linear-gradient(135deg,#ffffff,#f3f8ff)]">
        <div className="grid min-h-[360px] place-items-center px-4 text-center">
          <div className="max-w-[620px]">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] bg-blue text-white shadow-md">
              <Brain className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-[26px] font-bold text-ink">还没有学习画像</h2>
            <p className="mt-3 text-body leading-7 text-muted">
              通过几轮简短对话告诉我们你想学什么、现在在哪里、更喜欢怎么学。完成后会自动生成连续的 AI 综合分析。
            </p>
            <ProtoButton href="/onboarding" className="mt-6">
              重新建档 <ArrowRight className="h-4 w-4" />
            </ProtoButton>
          </div>
        </div>
      </ProtoCard>
    </div>
  )
}

function ProfileLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div data-guide-target="profile-overview">
      <PageHead
        eyebrow="学习画像 / 读取异常"
        title="学习画像"
        description="当前无法确认画像状态，你已有的画像资料不会因此被清除。"
      />
      <ProtoCard className="border-dashed border-orange/25 bg-[linear-gradient(135deg,#ffffff,#fffaf2)]">
        <div className="grid min-h-[320px] place-items-center px-4 text-center">
          <div className="max-w-[600px]">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] bg-orange-light text-orange">
              <AlertCircle className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-[26px] font-bold text-ink">画像加载失败</h2>
            <p className="mt-3 text-body leading-7 text-muted">
              这通常是网络波动或服务暂时不可用，不代表你没有学习画像。请重新加载，或前往资料页确认当前内容。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <ProtoButton onClick={onRetry}>
                <RefreshCw className="h-4 w-4" />
                重新加载
              </ProtoButton>
              <ProtoButton href="/profile/settings" variant="secondary">查看画像资料</ProtoButton>
            </div>
          </div>
        </div>
      </ProtoCard>
    </div>
  )
}

function ProfileLoading() {
  return (
    <div aria-live="polite" aria-busy="true">
      <PageHead eyebrow="学习画像 / AI 融合分析" title="学习画像" />
      <div className="animate-pulse rounded-[12px] border border-line bg-white p-6 shadow-md">
        <div className="h-5 w-36 rounded bg-[#e8eff8]" />
        <div className="mt-6 h-8 w-64 rounded bg-[#e8eff8]" />
        <div className="mt-5 h-4 w-full rounded bg-[#eef3f8]" />
        <div className="mt-3 h-4 w-4/5 rounded bg-[#eef3f8]" />
        <span className="sr-only">正在读取学习画像</span>
      </div>
    </div>
  )
}

function InsightCard({
  title,
  icon,
  tone,
  className = '',
  children,
}: {
  title: string
  icon: React.ReactNode
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'cyan'
  className?: string
  children: React.ReactNode
}) {
  const toneClasses = {
    blue: 'bg-blue-light text-blue',
    green: 'bg-green-light text-green',
    orange: 'bg-orange-light text-orange',
    purple: 'bg-purple-light text-purple',
    cyan: 'bg-[#ecfeff] text-[#0891b2]',
  }

  return (
    <ProtoCard className={className}>
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[11px] ${toneClasses[tone]}`}>{icon}</span>
        <h3 className="text-h2 font-bold text-ink">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </ProtoCard>
  )
}

function AnalysisList({ items, empty, ordered = false }: { items: string[]; empty: string; ordered?: boolean }) {
  if (items.length === 0) return <p className="text-small leading-6 text-muted">{empty}</p>
  const List = ordered ? 'ol' : 'ul'

  return (
    <List className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2 text-body leading-7 text-ink">
          <span className="mt-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-blue-light text-[10px] font-bold text-blue">
            {ordered ? index + 1 : '•'}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </List>
  )
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-bold text-ink">{value}</dd>
    </div>
  )
}

function getAnalysisStatus(analysis: ProfileAnalysis): {
  label: string
  tone: 'blue' | 'green' | 'orange' | 'purple'
} {
  if (analysis.generated_by === 'rule_fallback') {
    return { label: '基础分析（AI 暂不可用）', tone: 'orange' }
  }
  if (analysis.generated_by === 'legacy_unverified') {
    return { label: '历史分析，建议重新生成', tone: 'purple' }
  }
  if (analysis.status !== 'ready') {
    return { label: '分析处理中', tone: 'blue' }
  }
  return { label: 'AI 融合分析', tone: 'green' }
}

function formatConfidence(value: number) {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  return `${Math.round(normalized * 100)}%`
}

function formatDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSource(value: string) {
  const labels: Record<string, string> = {
    onboarding: '问卷建档',
    dialog: '对话建档',
    manual_update: '画像资料更新',
    history_analyze: '当前画像与历史对比',
    current_profile: '当前画像',
  }
  return labels[value] || value || '未知来源'
}

function formatHistoryAnalysisSource(value?: string) {
  const labels: Record<string, string> = {
    llm: 'AI 融合分析',
    rule_fallback: '基础分析（AI 暂不可用）',
    legacy_unverified: '历史记录（未经 AI 验证）',
  }
  return labels[value || ''] || '历史记录（未经 AI 验证）'
}

function formatHistoryConfidence(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '置信度未记录'
  const normalized = Math.max(0, Math.min(1, value))
  return `${Math.round(normalized * 100)}% 置信度`
}

function formatReason(value: string) {
  const labels: Record<string, string> = {
    onboarding: '首次建档',
    dialog: '对话建档',
    manual_update: '画像资料更新',
    history_analyze: '重新分析',
    history_view: '自动快照',
  }
  return labels[value] || '画像更新'
}
