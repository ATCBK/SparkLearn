'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bar, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'
import { AlertCircle, ArrowRight, Clock, History, Lightbulb, RefreshCw, Sparkles, Target } from 'lucide-react'
import { api, MasteryRecord, ProfileAnalysis, ProfileAnalysisResp, ProfileHistoryItem, ProfileHistoryResp, Resource as ResourceType, StudentProfile, Task } from '@/lib/api'
import { clearDesktopAuthSession, removeToken } from '@/lib/auth'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function ProfilePage() {
  const router = useRouter()
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [recentResources, setRecentResources] = useState<ResourceType[]>([])
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [profileReloadKey, setProfileReloadKey] = useState(0)
  const [mastery, setMastery] = useState<MasteryRecord[]>([])
  const [todayTasks, setTodayTasks] = useState<Task[]>([])
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryResp | null>(null)
  const [analysis, setAnalysis] = useState<ProfileAnalysis | ProfileAnalysisResp | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)

  useEffect(() => {
    let cancelled = false

    api.getRecentResources().then(data => setRecentResources(data.slice(0, 3))).catch(() => {})
    setProfileStatus('loading')
    api.getProfile()
      .then(data => {
        setProfile(data)
        setProfileStatus('ready')
      })
      .catch(async error => {
        if (isUnauthorizedRequest(error)) {
          removeToken()
          await clearDesktopAuthSession()
          if (!cancelled) router.replace('/auth')
          return
        }
        setProfile(null)
        setProfileStatus(api.isProfileNotFoundError(error) ? 'missing' : 'error')
      })
    api.getCurrentProfileAnalysis().then(setAnalysis).catch(() => setAnalysis(null))
    api.getMasteryData().then(setMastery).catch(() => setMastery([]))
    api.getTodayTasks().then(setTodayTasks).catch(() => setTodayTasks([]))
    setHistoryLoading(true)
    api.getProfileHistory()
      .then(setProfileHistory)
      .catch(() => setProfileHistory({ items: [], update_interval_days: 3, next_update_at: '' }))
      .finally(() => setHistoryLoading(false))

    return () => {
      cancelled = true
    }
  }, [profileReloadKey, router])

  async function runProfileAnalysis() {
    setAnalysisLoading(true)
    setAnalysisProgress(8)
    const progressTimer = window.setInterval(() => {
      setAnalysisProgress(prev => Math.min(prev + 11, 92))
    }, 180)
    try {
      const [result] = await Promise.all([
        api.analyzeProfileHistory(),
        new Promise(resolve => setTimeout(resolve, 1200)),
      ])
      window.clearInterval(progressTimer)
      setAnalysisProgress(100)
      await new Promise(resolve => setTimeout(resolve, 180))
      setAnalysis(result)
    } finally {
      window.clearInterval(progressTimer)
      setAnalysisLoading(false)
    }
  }

  const avatarSrc = gender === 'male' ? '/ui-images/profile-male.png' : '/ui-images/profile-female.png'
  const radarData = buildAbilityRadar(profile, mastery)
  const hasRadarData = radarData.some(item => item.value > 0)
  const profileReady = hasMeaningfulProfile(profile)
  const weakestMastery = [...mastery].filter(item => Number.isFinite(Number(item.score))).sort((a, b) => Number(a.score) - Number(b.score))[0]
  const attentionPoint = profile?.weakPoints?.[0] || weakestMastery?.knowledgePointName || ''
  const attentionScore = weakestMastery ? Math.round(Number(weakestMastery.score || 0) * 100) : null
  const learningPreference = profile?.learningPreference?.[0] || ''
  const stageGoal = profile?.currentStage || profile?.goals?.[0] || ''
  const displayName = profile?.name?.trim() || '新用户'
  const latestProfileDate = formatProfileDate(profileHistory?.items?.[0]?.captured_at)

  if (profileStatus === 'loading') return <ProfileLoading />
  if (profileStatus === 'error') return <ProfileLoadError onRetry={() => setProfileReloadKey(value => value + 1)} />
  if (profileStatus === 'missing') return <EmptyProfile />
  if (!profile) return <ProfileLoadError onRetry={() => setProfileReloadKey(value => value + 1)} />

  return (
    <div data-guide-target="profile-overview">
      <PageHead
        eyebrow="学习画像 / 你现在更适合怎么学"
        title="学习画像"
        description="这一页只保留会直接影响你学习体验的内容：当前卡点、适合的学法和本阶段目标。"
        chips={[
          { value: attentionScore !== null ? `${attentionScore}%` : '暂无', label: '掌握数据', icon: <Target className="h-4 w-4" />, tone: 'purple' as const },
          { value: learningPreference || '未选择', label: '学习偏好', icon: <Lightbulb className="h-4 w-4" />, tone: 'blue' as const },
          { value: latestProfileDate || '暂无', label: '最近更新', icon: <Clock className="h-4 w-4" />, tone: 'green' as const },
        ]}
      />

      <div className="grid grid-cols-[360px_1fr] gap-4 max-[1100px]:grid-cols-1">
        <ProtoCard className="relative min-h-[580px] overflow-hidden p-0">
          <img src={avatarSrc} alt="学生人物画像" className="absolute inset-0 h-full w-full object-cover" />
          {/* 性别切换按钮 */}
          <div className="absolute top-4 right-4 z-10 flex gap-1 rounded-full bg-white/80 p-1 shadow-md backdrop-blur">
            <button
              onClick={() => setGender('male')}
              className={`rounded-full px-3 py-1.5 text-micro font-bold transition-colors ${gender === 'male' ? 'bg-[#2563eb] text-white' : 'text-[#6b7280] hover:bg-[#f3f4f6]'}`}
            >
              男生
            </button>
            <button
              onClick={() => setGender('female')}
              className={`rounded-full px-3 py-1.5 text-micro font-bold transition-colors ${gender === 'female' ? 'bg-[#ec4899] text-white' : 'text-[#6b7280] hover:bg-[#f3f4f6]'}`}
            >
              女生
            </button>
          </div>
          <div className="absolute bottom-6 left-6 right-6 rounded-[14px] border border-line bg-white/92 p-4 shadow-md backdrop-blur">
            <Pill tone="blue">人物画像</Pill>
            <h2 className="mt-2 text-h2 font-bold text-ink">
              {profileReady ? `${displayName}${stageGoal ? ` · ${stageGoal}` : ''}` : '还没有生成学习画像'}
            </h2>
            <div aria-label="AI 学习画像总结" className="mt-2">
              <span className="text-micro font-bold text-blue">{profileReady ? profileSummarySource(analysis) : '等待建档'}</span>
              <p className="mt-1 line-clamp-2 max-h-12 overflow-hidden text-small leading-6 text-muted">
                {profileReady
                  ? profileSummaryText(profile, analysis)
                  : '第一次登录时这里不会展示演示学生数据。完成画像采集后，系统会根据你的目标、基础和偏好生成专属画像。'}
              </p>
            </div>
          </div>
        </ProtoCard>

        <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
          <ProtoCard>
            <Pill tone="orange">需要关注</Pill>
            {attentionPoint ? (
              <>
                <h2 className="mt-3 text-h2 font-bold text-ink">{attentionPoint}</h2>
                <p className="mt-2 text-small leading-6 text-muted">
                  {attentionScore !== null ? '系统会优先关注当前掌握度较低的知识点。' : '这是你在画像采集中标记的薄弱方向。'}
                </p>
                <div className="mt-4 flex items-center gap-5">
                  <div className="grid h-[100px] w-[100px] shrink-0 place-items-center rounded-full border border-[#eef3f9]" style={{ background: `radial-gradient(circle at center, #fff 0 34px, transparent 35px), conic-gradient(#2563eb 0 ${attentionScore ?? 0}%, #e8eff8 ${attentionScore ?? 0}% 100%)` }}>
                    <div className="text-center"><b className="block text-[24px] leading-none">{attentionScore !== null ? `${attentionScore}%` : '--'}</b><span className="text-[10px] text-muted">当前稳定度</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(profile?.weakPoints?.length ? profile.weakPoints : [attentionPoint]).slice(0, 3).map(point => <Pill key={point}>{point}</Pill>)}
                  </div>
                </div>
              </>
            ) : (
              <EmptyBlock title="暂无薄弱点数据" text="完成画像采集或练习评测后，系统会在这里显示真实需要关注的知识点。" />
            )}
          </ProtoCard>

          <ProtoCard>
            <Pill tone="purple">更适合的学法</Pill>
            {learningPreference ? (
              <>
                <h2 className="mt-3 text-h2 font-bold text-ink">{learningPreference}</h2>
                <p className="mt-3 text-small leading-6 text-muted">这是你当前画像中记录的学习偏好，后续资源推荐会优先参考它。</p>
                <div className="mt-4 grid grid-cols-[1.2fr_.8fr] gap-3">
                  <SoftCard className="bg-blue-light"><b className="text-small text-ink">已记录的偏好</b><div className="mt-4 flex flex-wrap gap-2">{profile?.learningPreference.slice(0, 4).map(item => <Pill key={item}>{item}</Pill>)}</div></SoftCard>
                  <div className="grid gap-3"><SoftCard><b>{profile?.cognitiveStyle || '认知风格待补充'}</b></SoftCard><SoftCard><b>{profile?.dailyTime ? `${profile.dailyTime} 分钟/天` : '学习时长待补充'}</b></SoftCard></div>
                </div>
              </>
            ) : (
              <EmptyBlock title="暂无学习偏好" text="新用户不会默认套用演示学法。完成画像采集后，这里会展示你真正适合的学习方式。" />
            )}
          </ProtoCard>

          <ProtoCard>
            <Pill tone="green">阶段目标</Pill>
            {stageGoal || profile?.goals?.length ? (
              <>
                <h2 className="mt-3 text-h2 font-bold text-ink">{stageGoal || '目标待确认'}</h2>
                <p className="mt-3 text-small leading-6 text-muted">{profile?.practicalAbility || profile?.knowledgeLevel || '系统会根据你的画像和练习结果持续调整阶段目标。'}</p>
                <div className="mt-4 space-y-3">
                  {(profile?.goals?.length ? profile.goals : [stageGoal]).filter(Boolean).slice(0, 3).map((goal, idx) => (
                    <Goal key={goal} title={goal} text={idx === 0 ? '当前优先目标' : '后续目标'} current={idx === 0} />
                  ))}
                </div>
              </>
            ) : (
              <EmptyBlock title="暂无阶段目标" text="完成画像采集后，系统会生成本阶段目标；没有真实数据时不显示演示路线。" />
            )}
          </ProtoCard>

          <ProtoCard>
            <Pill tone="blue">今天先做</Pill>
            {todayTasks.length > 0 ? (
              <>
                <h2 className="mt-3 text-h2 font-bold text-ink">继续完成今日任务</h2>
                <div className="mt-4 space-y-3">
                  {todayTasks.slice(0, 3).map((task, idx) => (
                    <Plan key={task.id} idx={String(idx + 1).padStart(2, '0')} title={task.title} text={task.status === 'completed' ? '已完成' : '待完成'} time={`${task.duration} 分钟`} />
                  ))}
                </div>
                <ProtoButton href="/path" variant="secondary" className="mt-4">查看路径</ProtoButton>
              </>
            ) : (
              <EmptyBlock title="今天还没有任务" text="新用户不会默认出现演示任务。创建学习路径或生成资源后，这里会出现真实待办。" action={<ProtoButton href="/path" variant="secondary">创建路径</ProtoButton>} />
            )}
          </ProtoCard>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[1.1fr_.9fr] gap-4 max-[960px]:grid-cols-1">
        <ProtoCard>
          <div className="flex items-center justify-between gap-3"><h2 className="text-h2 font-bold text-ink">能力雷达</h2><ProtoButton variant="secondary" onClick={() => window.dispatchEvent(new Event('open-ai-assistant'))}>告诉 AI 你想怎么学</ProtoButton></div>
          {hasRadarData ? (
            <div className="mt-5 grid grid-cols-[260px_1fr] gap-5 max-[760px]:grid-cols-1">
              <RadarChart data={radarData} />
              <div className="space-y-3">
                {radarData.map(item => <Radar key={item.name} name={item.name} value={item.value} />)}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[12px] border border-dashed border-line bg-[#fbfdff] p-6 text-small leading-6 text-muted">
              暂无能力雷达数据。第一次登录时这里不会展示演示分数；完成画像采集、学习任务或练习评测后，系统会根据你的真实记录生成能力雷达。
            </div>
          )}
        </ProtoCard>

        <ProtoCard>
          <div className="flex items-center justify-between gap-3"><h2 className="text-h2 font-bold text-ink">最近学习过的资源</h2><ProtoButton href="/generate?view=library" variant="ghost">查看全部 →</ProtoButton></div>
          <p className="mt-5 text-small leading-6 text-muted">从这里继续上次没学完的内容，不用重新找入口。</p>
          <div className="mt-4 space-y-3">
            {recentResources.length > 0 ? recentResources.map(r => (
              <Resource key={r.id} id={r.id} title={r.title} meta={`${r.type} · ${r.status === 'completed' ? '已完成' : '进行中'} · ${r.createdAt}`} tag={r.status === 'completed' ? '已完成' : '继续学习'} />
            )) : (
              <>
                <Resource title="暂无资源" meta="去资源中心生成你的第一份学习资源" tag="去生成" />
              </>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5"><ProtoButton href="/generate?view=library" variant="secondary">继续最近资源</ProtoButton><ProtoButton href="/generate" variant="tertiary">生成补弱资源</ProtoButton></div>
        </ProtoCard>
      </div>

      <ProfileHistoryPanel
        history={profileHistory}
        loading={historyLoading}
        analysis={analysis}
        analysisLoading={analysisLoading}
        analysisProgress={analysisProgress}
        onAnalyze={() => void runProfileAnalysis()}
      />
    </div>
  )
}

function ProfileHistoryPanel({
  history,
  loading,
  analysis,
  analysisLoading,
  analysisProgress,
  onAnalyze,
}: {
  history: ProfileHistoryResp | null
  loading: boolean
  analysis: ProfileAnalysis | ProfileAnalysisResp | null
  analysisLoading: boolean
  analysisProgress: number
  onAnalyze: () => void
}) {
  const items = history?.items || []
  const latest = items[0]
  const analysisContent = analysis
    ? ('analysis' in analysis && analysis.analysis ? analysis.analysis : analysis.narrative || analysis.overview)
    : ''

  return (
    <ProtoCard className="mt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue" />
            <h2 className="text-h2 font-bold text-ink">历史画像</h2>
          </div>
          <p className="mt-2 text-small leading-6 text-muted">
            系统按 {history?.update_interval_days || 3} 天更新一次画像快照，用于观察学习目标、薄弱点和偏好的变化。
          </p>
        </div>
        <ProtoButton variant="secondary" onClick={onAnalyze} disabled={analysisLoading}>
          {analysisLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {analysisLoading ? 'AI 分析中...' : 'AI 分析画像'}
        </ProtoButton>
      </div>

      <div className="mt-5 grid grid-cols-[1.15fr_.85fr] items-stretch gap-4 max-[960px]:grid-cols-1">
        <div className="h-full rounded-[14px] border border-line bg-[#fbfdff] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Pill tone="blue">三天一更新</Pill>
            <span className="text-micro text-muted">
              下次可更新：{formatProfileDate(history?.next_update_at) || '暂无'}
            </span>
          </div>

          {loading && <div className="py-8 text-center text-small text-muted">正在读取历史画像...</div>}

          {!loading && items.length === 0 && (
            <div className="rounded-[12px] border border-dashed border-line bg-white p-5 text-small text-muted">
              暂无历史画像。完成画像采集或修改个人资料后，系统会生成第一条画像快照。
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <ProfileHistoryRow key={item.id || `${item.captured_at}-${idx}`} item={item} active={idx === 0} />
              ))}
            </div>
          )}
        </div>

        <div className="flex h-full min-h-[360px] flex-col rounded-[14px] border border-line bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Pill tone="purple">AI 画像分析</Pill>
            {analysis?.updated_at && <span className="text-micro text-muted">{formatProfileDate(analysis.updated_at)}</span>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            {analysisLoading ? (
              <ProfileAnalysisProgress progress={analysisProgress} />
            ) : analysis?.analysis_steps?.length ? (
              <div className="relative space-y-0 pl-8">
                {analysis.analysis_steps.map((step, idx) => (
                  <div key={`${step.title}-${idx}`} className="relative border-l border-[#dbe7f5] pb-4 pl-5 last:border-l-transparent last:pb-0">
                    <span className="absolute -left-[13px] top-0 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-blue text-[11px] font-bold text-white shadow-sm">
                      {idx + 1}
                    </span>
                    <div className="rounded-r-[10px] bg-[#fbfdff] px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <b className="text-small text-ink">{step.title}</b>
                        <span className="shrink-0 text-micro text-green">{step.status === 'done' ? '已完成' : step.status}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line break-words text-micro leading-5 text-muted">{step.detail}</p>
                    </div>
                  </div>
                ))}
                <div className="rounded-[10px] border border-purple/20 bg-[#faf7ff] p-3">
                  <b className="text-small text-ink">最终诊断</b>
                  <ProfileAnalysisMarkdown content={analysisContent} />
                </div>
              </div>
            ) : (
              <ProfileAnalysisMarkdown content={analysisContent || buildDefaultProfileAnalysis(latest)} plain />
            )}
          </div>
        </div>
      </div>
    </ProtoCard>
  )
}

function ProfileAnalysisMarkdown({ content, plain = false }: { content: string; plain?: boolean }) {
  const normalizedContent = normalizeProfileAnalysisMarkdown(content)

  return (
    <div className={`${plain ? '' : 'mt-2'} break-words text-small leading-7 text-ink`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          h1: ({ children }) => <h3 className="mt-3 text-base font-bold text-ink first:mt-0">{children}</h3>,
          h2: ({ children }) => <h3 className="mt-3 text-base font-bold text-ink first:mt-0">{children}</h3>,
          h3: ({ children }) => <h3 className="mt-3 text-small font-bold text-ink first:mt-0">{children}</h3>,
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}

function normalizeProfileAnalysisMarkdown(content: string) {
  return content
    .trim()
    .replace(/\s+(\*\*[^*\n]+?\*\*[：:])/g, '\n\n$1')
    .replace(/([。！？；])\s+(?=\*\*[^*\n]+?\*\*[：:])/g, '$1\n\n')
}

function hasMeaningfulProfile(profile: StudentProfile | null) {
  if (!profile) return false
  return Boolean(
    profile.major
    || profile.grade
    || profile.goals.length
    || profile.knowledgeLevel
    || profile.weakPoints.length
    || profile.learningPreference.length
    || profile.cognitiveStyle
    || profile.dailyTime
    || profile.practicalAbility
    || profile.currentStage,
  )
}

function buildProfileSummary(profile: StudentProfile | null) {
  if (!profile) return ''
  const parts = [
    profile.knowledgeLevel ? `当前基础：${profile.knowledgeLevel}` : '',
    profile.weakPoints.length ? `需要关注：${profile.weakPoints.slice(0, 2).join('、')}` : '',
    profile.learningPreference.length ? `偏好：${profile.learningPreference.slice(0, 2).join('、')}` : '',
  ].filter(Boolean)
  return parts.length ? parts.join('。') : '画像已创建，但关键学习信息还不完整，可以继续补充目标、薄弱点和学习偏好。'
}

function profileSummaryText(profile: StudentProfile | null, analysis: ProfileAnalysis | ProfileAnalysisResp | null) {
  return analysis?.overview?.trim() || analysis?.narrative?.trim() || buildProfileSummary(profile)
}

function isUnauthorizedRequest(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && (error as { status?: unknown }).status === 401
}

function profileSummarySource(analysis: ProfileAnalysis | ProfileAnalysisResp | null) {
  if (!analysis) return '画像资料摘要'
  if (analysis.generated_by === 'rule_fallback'
    && 'fallback_reason' in analysis
    && analysis.fallback_reason === '尚无已保存的融合分析') {
    return 'AI 总结待生成'
  }
  if (analysis.generated_by === 'rule_fallback') return '基础总结（AI 暂不可用）'
  if (analysis.generated_by === 'legacy_unverified') return '历史总结（建议重新生成）'
  return 'AI 总结'
}

function EmptyBlock({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-[12px] border border-dashed border-line bg-[#fbfdff] p-5">
      <b className="block text-small text-ink">{title}</b>
      <p className="mt-2 text-small leading-6 text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

function ProfileHistoryRow({ item, active }: { item: ProfileHistoryItem; active: boolean }) {
  return (
    <div className={`rounded-[12px] border p-4 ${active ? 'border-blue/40 bg-blue-light' : 'border-line bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-blue' : 'bg-[#cbd5e1]'}`} />
          <b className="text-small text-ink">{formatProfileDate(item.captured_at) || '未记录时间'}</b>
        </div>
        <span className="text-micro text-muted">v{item.version} · {reasonLabel(item.reason)}</span>
      </div>
      <p className="mt-2 text-small leading-6 text-muted">{item.narrative || item.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.major && <Pill tone="blue">{item.major}</Pill>}
        {item.current_stage && <Pill tone="green">{item.current_stage}</Pill>}
        {item.knowledge_level && <Pill>{item.knowledge_level}</Pill>}
        {item.weak_points.slice(0, 3).map(point => <Pill key={point} tone="orange">{point}</Pill>)}
      </div>
    </div>
  )
}

function ProfileAnalysisProgress({ progress }: { progress: number }) {
  const stage =
    progress >= 92 ? '整理最终诊断'
      : progress >= 68 ? '生成路径建议'
        : progress >= 46 ? '识别学习风险'
          : progress >= 24 ? '对比历史变化'
            : '读取画像快照'

  return (
    <div className="rounded-[12px] border border-blue/20 bg-blue-light p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <b className="block text-small text-ink">AI 正在分析画像</b>
          <span className="mt-1 block text-micro text-muted">{stage}</span>
        </div>
        <span className="text-small font-bold text-blue">{progress}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-blue transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-4 space-y-2">
        {['读取当前画像', '载入历史快照', '对比变化', '识别风险', '生成建议'].map((label, idx) => {
          const active = progress >= (idx + 1) * 18
          return (
            <div key={label} className="flex items-center gap-2 text-micro">
              <span className={`h-2 w-2 rounded-full ${active ? 'bg-blue' : 'bg-[#cbd5e1]'}`} />
              <span className={active ? 'text-ink' : 'text-muted'}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function buildDefaultProfileAnalysis(item?: ProfileHistoryItem) {
  if (!item) return '点击“AI 分析画像”后，系统会结合当前画像与历史变化，生成学习风险、资源推荐和路径调整建议。'
  const weak = item.weak_points.slice(0, 2).join('、') || '当前薄弱点'
  const goal = item.goals.slice(0, 2).join('、') || '当前目标'
  return `当前画像围绕“${goal}”推进，重点关注“${weak}”。建议先完成短周期补弱资源，再根据练习结果更新路径节点。`
}

function formatProfileDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function reasonLabel(reason: string) {
  const labels: Record<string, string> = {
    onboarding: '首次采集',
    dialog: '对话建档',
    manual_update: '资料更新',
    history_analyze: '重新分析',
    history_view: '自动快照',
  }
  return labels[reason] || '画像更新'
}

function EmptyProfile() {
  return (
    <div data-guide-target="profile-overview">
      <PageHead
        eyebrow="学习画像 / 等待建档"
        title="学习画像"
        description="完成对话建档后，这里会恢复你专属的学生画像和学习卡片。"
      />
      <ProtoCard className="border-dashed border-[#bfd4ec] bg-[linear-gradient(135deg,#ffffff,#f3f8ff)]">
        <div className="grid min-h-[360px] place-items-center px-4 text-center">
          <div className="max-w-[580px]">
            <h2 className="text-[26px] font-bold text-ink">还没有学习画像</h2>
            <p className="mt-3 text-body leading-7 text-muted">通过几轮简短对话补充目标、基础和偏好，完成后会生成学生画像与简洁总结。</p>
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
      <PageHead eyebrow="学习画像 / 读取异常" title="学习画像" description="当前无法确认画像状态，你已有的画像资料不会因此被清除。" />
      <ProtoCard className="border-dashed border-orange/25 bg-[linear-gradient(135deg,#ffffff,#fffaf2)]">
        <div className="grid min-h-[320px] place-items-center px-4 text-center">
          <div className="max-w-[580px]">
            <AlertCircle className="mx-auto h-9 w-9 text-orange" />
            <h2 className="mt-5 text-[26px] font-bold text-ink">画像加载失败</h2>
            <p className="mt-3 text-body leading-7 text-muted">这通常是网络波动或服务暂时不可用，不代表你没有学习画像。</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <ProtoButton onClick={onRetry}>重新加载</ProtoButton>
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
      <PageHead eyebrow="学习画像 / 读取中" title="学习画像" />
      <div className="animate-pulse rounded-[12px] border border-line bg-white p-6 shadow-md">
        <div className="h-5 w-36 rounded bg-[#e8eff8]" />
        <div className="mt-6 h-8 w-64 rounded bg-[#e8eff8]" />
        <div className="mt-5 h-4 w-full rounded bg-[#eef3f8]" />
        <span className="sr-only">正在读取学习画像</span>
      </div>
    </div>
  )
}

function buildAbilityRadar(profile: StudentProfile | null, mastery: MasteryRecord[]) {
  const average = (rows: MasteryRecord[], fallback = 0) => {
    if (!rows.length) return fallback
    return Math.round((rows.reduce((sum, item) => sum + Number(item.score || 0), 0) / rows.length) * 100)
  }
  const byText = (keywords: string[]) => mastery.filter(item => {
    const text = `${item.knowledgePointName} ${item.chapter}`.toLowerCase()
    return keywords.some(keyword => text.includes(keyword.toLowerCase()))
  })
  const overall = average(mastery)
  const profileReady = Boolean(profile && (
    profile.goals.length
    || profile.weakPoints.length
    || profile.learningPreference.length
    || profile.knowledgeLevel
    || profile.currentStage
  ))

  if (!mastery.length && !profileReady) {
    return [
      { name: '语法基础', value: 0 },
      { name: '案例理解', value: 0 },
      { name: '练习稳定', value: 0 },
      { name: '项目迁移', value: 0 },
      { name: '结果传递', value: 0 },
    ]
  }

  return [
    { name: '语法基础', value: average(byText(['变量', '表达式', '条件', '循环', '列表', '字典']), mastery.length ? overall : 0) },
    { name: '案例理解', value: average(byText(['函数', '模块', '类', '对象']), mastery.length ? overall : 0) },
    { name: '练习稳定', value: overall },
    { name: '项目迁移', value: average(byText(['项目', '文件', 'json', '日志', '异步']), mastery.length ? overall : 0) },
    { name: '结果传递', value: average(byText(['返回', '作用域', '参数', '闭包']), mastery.length ? overall : 0) },
  ]
}

function Goal({ title, text, done, current }: { title: string; text: string; done?: boolean; current?: boolean }) {
  return <SoftCard className={done ? 'bg-green-light' : current ? 'bg-blue-light' : 'bg-white'}><b className="text-small text-ink">{title}</b><span className="mt-1 block text-micro text-muted">{text}</span></SoftCard>
}
function Plan({ idx, title, text, time }: { idx: string; title: string; text: string; time: string }) {
  return <SoftCard className="grid grid-cols-[42px_1fr_auto] items-center gap-3 bg-white"><b className="text-blue">{idx}</b><span><b className="block text-small text-ink">{title}</b><span className="text-micro text-muted">{text}</span></span><Pill>{time}</Pill></SoftCard>
}
function Radar({ name, value }: { name: string; value: number }) {
  return <div><div className="mb-1 flex justify-between text-micro"><b>{name}</b><span className="text-muted">{value}</span></div><Bar value={value} /></div>
}

function RadarChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const size = 260
  const center = size / 2
  const radius = 80
  const levels = 5
  const maxValue = 100

  // 计算五边形的顶点坐标
  const points = data.map((item, index) => {
    const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2
    const x = center + radius * Math.cos(angle)
    const y = center + radius * Math.sin(angle)
    return { x, y, ...item }
  })

  // 生成网格线
  const gridLines = Array.from({ length: levels }, (_, i) => {
    const r = (radius / levels) * (i + 1)
    const gridPoints = data.map((_, index) => {
      const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2
      const x = center + r * Math.cos(angle)
      const y = center + r * Math.sin(angle)
      return `${x},${y}`
    })
    return gridPoints.join(' ')
  })

  // 计算数据点坐标
  const dataPoints = data.map((item, index) => {
    const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2
    const r = (radius / maxValue) * item.value
    const x = center + r * Math.cos(angle)
    const y = center + r * Math.sin(angle)
    return `${x},${y}`
  })

  // 计算标签位置
  const labelPoints = data.map((item, index) => {
    const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2
    const labelRadius = radius + 35
    const x = center + labelRadius * Math.cos(angle)
    const y = center + labelRadius * Math.sin(angle)
    return { x, y, name: item.name }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="w-full">
      {/* 网格线 */}
      {gridLines.map((points, i) => (
        <polygon
          key={`grid-${i}`}
          points={points}
          fill="none"
          stroke="#e0e7ff"
          strokeWidth="1"
        />
      ))}

      {/* 坐标轴 */}
      {points.map((point, i) => (
        <line
          key={`axis-${i}`}
          x1={center}
          y1={center}
          x2={point.x}
          y2={point.y}
          stroke="#e0e7ff"
          strokeWidth="1"
        />
      ))}

      {/* 数据区域 */}
      <polygon
        points={dataPoints.join(' ')}
        fill="#3b82f6"
        fillOpacity="0.2"
        stroke="#2563eb"
        strokeWidth="2"
      />

      {/* 数据点 */}
      {points.map((point, i) => (
        <circle
          key={`point-${i}`}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#2563eb"
          stroke="white"
          strokeWidth="2"
        />
      ))}

      {/* 标签 */}
      {labelPoints.map((point, i) => (
        <text
          key={`label-${i}`}
          x={point.x}
          y={point.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[11px] font-bold fill-[#374151]"
        >
          {point.name}
        </text>
      ))}
    </svg>
  )
}
function Resource({ title, meta, tag, id }: { title: string; meta: string; tag: string; id?: string }) {
  const href = id ? `/generate?view=library&id=${id}` : '/generate?view=library'
  return (
    <a href={href} className="block">
      <SoftCard className="flex items-center justify-between gap-3 bg-white hover:border-[#2563eb] transition-colors cursor-pointer"><span><b className="block text-small text-ink">{title}</b><span className="text-micro text-muted">{meta}</span></span><Pill tone="blue">{tag}</Pill></SoftCard>
    </a>
  )
}
