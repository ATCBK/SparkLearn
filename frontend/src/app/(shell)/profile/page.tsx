'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import { Bar, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'
import { Clock, History, Lightbulb, RefreshCw, Sparkles, Target } from 'lucide-react'
import { api, ProfileAnalysisResp, ProfileHistoryItem, ProfileHistoryResp, Resource as ResourceType } from '@/lib/api'

export default function ProfilePage() {
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [recentResources, setRecentResources] = useState<ResourceType[]>([])
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryResp | null>(null)
  const [analysis, setAnalysis] = useState<ProfileAnalysisResp | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)

  useEffect(() => {
    api.getRecentResources().then(data => setRecentResources(data.slice(0, 3))).catch(() => {})
    setHistoryLoading(true)
    api.getProfileHistory()
      .then(setProfileHistory)
      .catch(() => setProfileHistory({ items: [], update_interval_days: 3, next_update_at: '' }))
      .finally(() => setHistoryLoading(false))
  }, [])

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

  return (
    <div>
      <PageHead
        eyebrow="学习画像 / 你现在更适合怎么学"
        title="学习画像"
        description="这一页只保留会直接影响你学习体验的内容：当前卡点、适合的学法和本阶段目标。"
        chips={[
          { value: '48%', label: '返回值掌握', icon: <Target className="h-4 w-4" />, tone: 'purple' as const },
          { value: '案例驱动', label: '学习偏好', icon: <Lightbulb className="h-4 w-4" />, tone: 'blue' as const },
          { value: '08:12', label: '最近更新', icon: <Clock className="h-4 w-4" />, tone: 'green' as const },
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
            <h2 className="mt-2 text-h2 font-bold text-ink">李明 · 项目实践准备期</h2>
            <p className="mt-2 text-small leading-6 text-muted">基础语法已经够用，当前重点是把函数和模块这块学顺，尽快回到小项目实践。</p>
          </div>
        </ProtoCard>

        <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
          <ProtoCard>
            <Pill tone="orange">需要关注</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">函数返回值</h2>
            <p className="mt-2 text-small leading-6 text-muted">这块不是完全不会，而是关键概念容易串线，导致一做题就乱。</p>
            <div className="mt-4 flex items-center gap-5">
              <div className="grid h-[100px] w-[100px] shrink-0 place-items-center rounded-full border border-[#eef3f9]" style={{ background: 'radial-gradient(circle at center, #fff 0 34px, transparent 35px), conic-gradient(#2563eb 0 48%, #e8eff8 48% 100%)' }}>
                <div className="text-center"><b className="block text-[24px] leading-none">48%</b><span className="text-[10px] text-muted">当前稳定度</span></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill>return 和 print 容易混</Pill>
                <Pill>局部变量作用范围不够稳</Pill>
              </div>
            </div>
          </ProtoCard>

          <ProtoCard>
            <Pill tone="purple">更适合的学法</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">先看例子，再做短练</h2>
            <p className="mt-3 text-small leading-6 text-muted">和纯文字解释相比，你更吃“短讲解 + 可运行代码 + 立刻验证”这一套。</p>
            <div className="mt-4 grid grid-cols-[1.2fr_.8fr] gap-3">
              <SoftCard className="bg-blue-light"><b className="text-small text-ink">代码案例最容易进入状态</b><div className="mt-4 space-y-2"><i className="block h-2 w-4/5 rounded-full bg-blue" /><i className="block h-2 w-3/5 rounded-full bg-blue/60" /><i className="block h-2 w-2/3 rounded-full bg-blue/40" /></div></SoftCard>
              <div className="grid gap-3"><SoftCard><b>短讲解</b></SoftCard><SoftCard><b>即时反馈</b></SoftCard></div>
            </div>
          </ProtoCard>

          <ProtoCard>
            <Pill tone="green">阶段目标</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">完成 Python 小项目</h2>
            <p className="mt-3 text-small leading-6 text-muted">当前不是重学整章，而是把进入项目实践前的最后一段补顺。</p>
            <div className="mt-4 space-y-3">
              <Goal title="基础语法" text="变量、分支和循环已经够用。" done />
              <Goal title="函数补强" text="先把返回值和作用域彻底理顺。" current />
              <Goal title="模块导入" text="通过后回到小项目拆分与调用。" />
            </div>
          </ProtoCard>

          <ProtoCard>
            <Pill tone="blue">今天先做</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">补弱后再确认路径</h2>
            <div className="mt-4 space-y-3">
              <Plan idx="01" title="看 12 分钟案例讲义" text="把结果怎么传出来这件事先看顺。" time="12 分钟" />
              <Plan idx="02" title="做 8 道返回值短练" text="只测这一类题，不再分散到其他知识点。" time="8 题" />
            </div>
            <ProtoButton href="/path" variant="secondary" className="mt-4">查看路径</ProtoButton>
          </ProtoCard>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[1.1fr_.9fr] gap-4 max-[960px]:grid-cols-1">
        <ProtoCard>
          <div className="flex items-center justify-between gap-3"><h2 className="text-h2 font-bold text-ink">能力雷达</h2><ProtoButton variant="secondary" onClick={() => window.dispatchEvent(new Event('open-ai-assistant'))}>告诉 AI 你想怎么学</ProtoButton></div>
          <div className="mt-5 grid grid-cols-[260px_1fr] gap-5 max-[760px]:grid-cols-1">
            <RadarChart data={[
              { name: '语法基础', value: 84 },
              { name: '案例理解', value: 68 },
              { name: '练习稳定', value: 57 },
              { name: '项目迁移', value: 42 },
              { name: '结果传递', value: 53 },
            ]} />
            <div className="space-y-3">
              {[
                ['语法基础', 84], ['案例理解', 68], ['练习稳定', 57], ['项目迁移', 42], ['结果传递', 53],
              ].map(([name, value]) => <Radar key={name as string} name={name as string} value={value as number} />)}
            </div>
          </div>
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
  analysis: ProfileAnalysisResp | null
  analysisLoading: boolean
  analysisProgress: number
  onAnalyze: () => void
}) {
  const items = history?.items || []
  const latest = items[0]

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
                      <p className="mt-1 text-micro leading-5 text-muted">{step.detail}</p>
                    </div>
                  </div>
                ))}
                <div className="rounded-[10px] border border-purple/20 bg-[#faf7ff] p-3">
                  <b className="text-small text-ink">最终诊断</b>
                  <p className="mt-2 text-small leading-7 text-ink">{analysis.analysis}</p>
                </div>
              </div>
            ) : (
              <p className="text-small leading-7 text-ink">
                {analysis?.analysis || buildDefaultProfileAnalysis(latest)}
              </p>
            )}
          </div>
        </div>
      </div>
    </ProtoCard>
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
      <p className="mt-2 text-small leading-6 text-muted">{item.summary}</p>
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
    history_view: '自动快照',
  }
  return labels[reason] || '画像更新'
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
