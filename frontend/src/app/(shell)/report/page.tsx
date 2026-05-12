'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar, FileText, Sparkles } from 'lucide-react'
import { PageHead, Pill, ProtoCard, SoftCard } from '@/components/proto'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'
import { api, ReportData } from '@/lib/api'

type ViewMode = 'day' | 'week' | 'month'

// 生成热力图数据
function generateHeatmapData(mode: ViewMode): number[][] {
  if (mode === 'day') {
    // 24小时 x 1行，每小时的学习强度 0-4
    return [Array.from({ length: 24 }, () => Math.floor(Math.random() * 5))]
  }
  if (mode === 'week') {
    // 7天 x 24小时
    return Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => Math.floor(Math.random() * 5))
    )
  }
  // month: 30天 x 24小时
  return Array.from({ length: 30 }, () =>
    Array.from({ length: 24 }, () => Math.floor(Math.random() * 5))
  )
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`)

function getHeatColor(value: number): string {
  const colors = [
    'bg-[#ebedf0]',   // 0 - no activity
    'bg-[#9be9a8]',   // 1 - light
    'bg-[#40c463]',   // 2 - medium
    'bg-[#30a14e]',   // 3 - high
    'bg-[#216e39]',   // 4 - very high
  ]
  return colors[Math.min(value, 4)]
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getDateLabel(date: Date, mode: ViewMode): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  if (mode === 'day') return `${y}年${m}月${d}日`
  if (mode === 'week') {
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay() + 1)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 - ${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`
  }
  return `${y}年${m}月`
}

export default function ReportPage() {
  const [mode, setMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [heatmapData, setHeatmapData] = useState<number[][]>([])
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState<string>('')
  const [aiGenerating, setAiGenerating] = useState(false)

  const loadData = useCallback(async (viewMode: ViewMode) => {
    setLoading(true)
    try {
      const [reportData] = await Promise.all([
        api.getReport(viewMode),
      ])
      setReport(reportData)
      setHeatmapData(generateHeatmapData(viewMode))
    } catch {
      // fallback
      setHeatmapData(generateHeatmapData(viewMode))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(mode)
  }, [mode, loadData])

  function navigateDate(direction: -1 | 1) {
    const next = new Date(currentDate)
    if (mode === 'day') next.setDate(next.getDate() + direction)
    else if (mode === 'week') next.setDate(next.getDate() + direction * 7)
    else next.setMonth(next.getMonth() + direction)
    setCurrentDate(next)
    setHeatmapData(generateHeatmapData(mode))
  }

  function switchMode(newMode: ViewMode) {
    setMode(newMode)
    setCurrentDate(new Date())
    setAiSummary('')
  }

  async function generateAiSummary() {
    if (!report) return
    setAiGenerating(true)
    setAiSummary('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/api/report/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: mode }),
      })
      if (!res.ok) throw new Error('Failed')
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        // Parse SSE events
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const evt = JSON.parse(line.slice(6))
              if (evt.type === 'text') {
                text += evt.payload.content || ''
                setAiSummary(text)
              }
            } catch { /* skip malformed */ }
          }
        }
      }
      if (!text) {
        setAiSummary(report.aiSummary)
      }
    } catch {
      setAiSummary(report?.aiSummary || '生成失败，请重试。')
    } finally {
      setAiGenerating(false)
    }
  }

  const modeLabels: Record<ViewMode, string> = { day: '日报', week: '周报', month: '月报' }

  return (
    <div>
      <PageHead
        eyebrow="学习报告 / 数据驱动的学习复盘"
        title="学习报告"
        description="通过热力图和 AI 报告全面了解你的学习节奏与效率。"
        chips={report ? [
          { value: `${report.stats.totalHours}h`, label: '学习时长' },
          { value: `${Math.round(report.stats.taskCompletionRate * 100)}%`, label: '任务完成' },
          { value: `${Math.round(report.stats.quizAccuracy * 100)}%`, label: '练习正确率' },
        ] : undefined}
      />

      {/* Mode Tabs + Date Navigation */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex gap-1 bg-[#f1f5f9] p-1 rounded-[12px]">
          {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-4 py-2 rounded-[10px] text-small font-bold transition-colors ${
                mode === m
                  ? 'bg-white text-blue shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateDate(-1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-[#f1f5f9] transition-colors"
            aria-label="上一个周期"
          >
            <ChevronLeft className="h-4 w-4 text-muted" />
          </button>
          <div className="flex items-center gap-2 text-small font-bold text-ink">
            <Calendar className="h-4 w-4 text-blue" />
            {getDateLabel(currentDate, mode)}
          </div>
          <button
            onClick={() => navigateDate(1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-[#f1f5f9] transition-colors"
            aria-label="下一个周期"
          >
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <TypewriterLoader text="加载学习报告..." />
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_.45fr] gap-4 max-[1080px]:grid-cols-1">
          {/* Left: Heatmap */}
          <ProtoCard className="overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2 font-bold text-ink flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-light">
                  <Calendar className="h-4 w-4 text-blue" />
                </span>
                学习热力图
              </h2>
              <HeatmapLegend />
            </div>

            <div className="overflow-x-auto">
              <HeatmapGrid data={heatmapData} mode={mode} />
            </div>

            {/* Stats summary below heatmap (not shown in week view) */}
            {report && mode !== 'week' && (
              <div className="mt-5 grid grid-cols-4 gap-3 max-[760px]:grid-cols-2">
                <StatCard label="总学习时长" value={`${report.stats.totalHours}h`} />
                <StatCard label="连续学习" value={`${report.stats.streakDays}天`} />
                <StatCard label="高效时段" value="20:00-22:00" />
                <StatCard label="活跃天数" value={`${heatmapData.filter(row => row.some(v => v > 0)).length}天`} />
              </div>
            )}

            {/* Day view extra charts to fill space */}
            {mode === 'day' && report && (
              <div className="mt-5 space-y-5">
                {/* Hourly learning curve */}
                <DayHourlyCurve data={heatmapData[0] || []} />

                {/* Two-column: Task donut + Focus sessions */}
                <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
                  <DayTaskDonut report={report} />
                  <DayFocusSessions />
                </div>
              </div>
            )}

            {/* Week view extra charts */}
            {mode === 'week' && report && (
              <div className="mt-5 space-y-5">
                {/* Row 1: Pie chart + Weekly bar chart */}
                <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
                  <WeekTimePie report={report} />
                  <WeekDailyBar report={report} />
                </div>

                {/* Row 2: Radar + Progress */}
                <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
                  <WeekSkillRadar report={report} />
                  <WeekProgressStack />
                </div>
              </div>
            )}
          </ProtoCard>

          {/* Right: AI Report */}
          <ProtoCard className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-purple-light">
                  <Sparkles className="h-4 w-4 text-purple" />
                </span>
                <h2 className="text-h2 font-bold text-ink">AI {modeLabels[mode]}</h2>
              </div>
              <button
                onClick={() => generateAiSummary()}
                disabled={aiGenerating}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] px-3 py-1.5 text-micro font-bold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60"
              >
                <Sparkles className="h-3 w-3" />
                {aiGenerating ? '生成中...' : 'AI 生成总结'}
              </button>
            </div>

            {report ? (
              <div className="flex flex-col flex-1">
                {/* AI Summary - ONLY this part scrolls */}
                <SoftCard className="mb-4">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-blue mt-0.5 shrink-0" />
                    <div className="text-small leading-7 text-ink whitespace-pre-wrap max-h-[150px] overflow-y-auto pr-1">
                      {aiGenerating ? (
                        <span className="inline-flex items-center gap-2 text-muted">
                          <span className="inline-block h-2 w-2 rounded-full bg-purple animate-pulse" />
                          AI 正在分析学习数据并生成{modeLabels[mode]}...
                        </span>
                      ) : (
                        aiSummary || report.aiSummary
                      )}
                    </div>
                  </div>
                </SoftCard>

                {/* Time Distribution - fixed, no scroll */}
                <div className="mb-4">
                  <h3 className="text-small font-bold text-ink mb-3">时间分布</h3>
                  <div className="space-y-2.5">
                    {report.timeDistribution.map((item) => (
                      <div key={item.category} className="flex items-center gap-3">
                        <span className="w-16 text-micro text-muted shrink-0">{item.category}</span>
                        <div className="flex-1 h-2 rounded-full bg-[#e8eff8] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue to-[#60a5fa]"
                            style={{ width: `${Math.min(100, (item.minutes / 150) * 100)}%` }}
                          />
                        </div>
                        <span className="text-micro font-bold text-ink w-12 text-right">{item.minutes}分</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weak Points - fixed, no scroll */}
                <div className="mb-4">
                  <h3 className="text-small font-bold text-ink mb-3">薄弱知识点</h3>
                  <div className="space-y-2">
                    {report.weakPoints.map((wp) => (
                      <div key={wp.name} className="flex items-center justify-between rounded-[8px] border border-[#fee2e2] bg-[#fff5f5] px-3 py-2">
                        <span className="text-small text-ink">{wp.name}</span>
                        <Pill tone="red">{Math.round(wp.score * 100)}%</Pill>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Learning Trend - fixed at bottom */}
                <div className="mt-auto pt-4 border-t border-line">
                  <h3 className="text-small font-bold text-ink mb-3">学习趋势</h3>
                  <TrendChart mode={mode} />
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-muted text-small">暂无报告数据</div>
            )}
          </ProtoCard>
        </div>
      )}
    </div>
  )
}

// ===== Sub-components =====

function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted">
      <span>少</span>
      {[0, 1, 2, 3, 4].map((v) => (
        <div key={v} className={`h-3 w-3 rounded-[2px] ${getHeatColor(v)}`} />
      ))}
      <span>多</span>
    </div>
  )
}

function HeatmapGrid({ data, mode }: { data: number[][]; mode: ViewMode }) {
  if (mode === 'day') {
    // Single row: 24 hours
    return (
      <div>
        <div className="flex gap-[3px]">
          {(data[0] || []).map((value, hour) => (
            <div
              key={hour}
              className={`h-8 flex-1 min-w-[20px] rounded-[4px] ${getHeatColor(value)} transition-colors`}
              title={`${hour}:00 - 学习强度: ${value}`}
            />
          ))}
        </div>
        <div className="flex mt-2">
          {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
            <span key={h} className="flex-1 text-[10px] text-muted text-center">{h}</span>
          ))}
        </div>
      </div>
    )
  }

  if (mode === 'week') {
    // 7 rows x 24 columns
    return (
      <div>
        <div className="flex gap-[3px] mb-1">
          <div className="w-8 shrink-0" />
          {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
            <span key={h} className="flex-1 text-[10px] text-muted text-center min-w-[20px]">{h}</span>
          ))}
        </div>
        <div className="space-y-[3px]">
          {data.map((row, dayIdx) => (
            <div key={dayIdx} className="flex gap-[3px] items-center">
              <span className="w-8 shrink-0 text-[10px] text-muted text-right pr-1">{WEEKDAYS[dayIdx]}</span>
              {row.map((value, hour) => (
                <div
                  key={hour}
                  className={`h-5 flex-1 min-w-[12px] rounded-[3px] ${getHeatColor(value)} transition-colors`}
                  title={`${WEEKDAYS[dayIdx]} ${hour}:00 - 学习强度: ${value}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Month: 30 rows x 24 columns (compact)
  return (
    <div>
      <div className="flex gap-[2px] mb-1">
        <div className="w-6 shrink-0" />
        {HOURS.filter((_, i) => i % 4 === 0).map((h) => (
          <span key={h} className="flex-1 text-[9px] text-muted text-center min-w-[10px]">{h}</span>
        ))}
      </div>
      <div className="space-y-[2px]">
        {data.map((row, dayIdx) => (
          <div key={dayIdx} className="flex gap-[2px] items-center">
            <span className="w-6 shrink-0 text-[9px] text-muted text-right pr-0.5">{dayIdx + 1}日</span>
            {row.map((value, hour) => (
              <div
                key={hour}
                className={`h-3 flex-1 min-w-[8px] rounded-[2px] ${getHeatColor(value)} transition-colors`}
                title={`${dayIdx + 1}日 ${hour}:00 - 学习强度: ${value}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <SoftCard>
      <b className="block text-[18px] text-ink">{value}</b>
      <span className="mt-0.5 block text-micro text-muted">{label}</span>
    </SoftCard>
  )
}

// ===== Day View Extra Charts =====

/** Hourly learning intensity curve (area chart) */
function DayHourlyCurve({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const points = data.map((v, i) => {
    const x = (i / 23) * 100
    const y = 100 - (v / max) * 100
    return `${x},${y}`
  })
  const areaPoints = `0,100 ${points.join(' ')} 100,100`
  const linePoints = points.join(' ')

  return (
    <div className="rounded-[10px] border border-[#eef2f7] bg-[#f9fafb] p-4">
      <h3 className="text-small font-bold text-ink mb-3 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-green-light">
          <svg className="h-3 w-3 text-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="22,12 18,12 15,21 9,3 6,12 2,12" /></svg>
        </span>
        学习强度曲线
      </h3>
      <div className="relative h-[120px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {/* Grid lines */}
          {[25, 50, 75].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e5e7eb" strokeWidth="0.3" strokeDasharray="2,2" />
          ))}
          {/* Area fill */}
          <polygon points={areaPoints} fill="url(#areaGradient)" opacity="0.3" />
          {/* Line */}
          <polyline points={linePoints} fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots at peaks */}
          {data.map((v, i) => {
            if (v >= max * 0.7) {
              const x = (i / 23) * 100
              const y = 100 - (v / max) * 100
              return <circle key={i} cx={x} cy={y} r="1.5" fill="#16a34a" />
            }
            return null
          })}
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
            </linearGradient>
          </defs>
        </svg>
        {/* X-axis labels */}
        <div className="absolute bottom-[-18px] left-0 right-0 flex justify-between">
          {[0, 6, 12, 18, 23].map((h) => (
            <span key={h} className="text-[9px] text-muted">{h}:00</span>
          ))}
        </div>
      </div>
      <div className="mt-6 flex items-center gap-4 text-micro text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green" />高峰时段</span>
        <span>最高强度: {max} 级</span>
        <span>活跃小时: {data.filter(v => v > 0).length}h</span>
      </div>
    </div>
  )
}

/** Task completion donut chart */
function DayTaskDonut({ report }: { report: ReportData }) {
  const completion = Math.round(report.stats.taskCompletionRate * 100)
  const accuracy = Math.round(report.stats.quizAccuracy * 100)
  const circumference = 2 * Math.PI * 40

  return (
    <div className="rounded-[10px] border border-[#eef2f7] bg-[#f9fafb] p-4">
      <h3 className="text-small font-bold text-ink mb-3 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-blue-light">
          <svg className="h-3 w-3 text-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
        </span>
        任务完成度
      </h3>
      <div className="flex items-center justify-center py-2">
        <div className="relative">
          <svg width="110" height="110" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e8eff8" strokeWidth="8" />
            {/* Completion arc */}
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke="#2563eb" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - completion / 100)}
              transform="rotate(-90 50 50)"
            />
            {/* Inner accuracy arc */}
            <circle cx="50" cy="50" r="30" fill="none" stroke="#e8eff8" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="30" fill="none"
              stroke="#16a34a" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 30}
              strokeDashoffset={2 * Math.PI * 30 * (1 - accuracy / 100)}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-[20px] text-ink leading-none">{completion}%</b>
            <span className="text-[9px] text-muted mt-0.5">完成率</span>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-2 text-micro">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue" />任务 {completion}%</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green" />正确率 {accuracy}%</span>
      </div>
    </div>
  )
}

/** Focus session timeline */
function DayFocusSessions() {
  const sessions = [
    { start: '08:30', end: '09:15', label: '阅读讲义', duration: 45, color: 'bg-blue' },
    { start: '10:00', end: '10:40', label: '练习题', duration: 40, color: 'bg-green' },
    { start: '14:20', end: '14:50', label: '视频学习', duration: 30, color: 'bg-purple' },
    { start: '20:00', end: '21:10', label: '代码实践', duration: 70, color: 'bg-orange' },
    { start: '21:30', end: '22:00', label: '错题复盘', duration: 30, color: 'bg-red' },
  ]

  const maxDuration = Math.max(...sessions.map(s => s.duration))

  return (
    <div className="rounded-[10px] border border-[#eef2f7] bg-[#f9fafb] p-4">
      <h3 className="text-small font-bold text-ink mb-3 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-orange-light">
          <svg className="h-3 w-3 text-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        </span>
        专注时段
      </h3>
      <div className="space-y-2.5">
        {sessions.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="w-[72px] shrink-0 text-[10px] text-muted font-mono">{s.start}-{s.end}</span>
            <div className="flex-1 h-4 rounded-full bg-[#e8eff8] overflow-hidden relative">
              <div
                className={`h-full rounded-full ${s.color} opacity-80`}
                style={{ width: `${(s.duration / maxDuration) * 100}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-[10px] text-ink font-bold text-right">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-[#eef2f7] flex justify-between text-micro text-muted">
        <span>共 {sessions.length} 个专注时段</span>
        <span className="font-bold text-ink">{sessions.reduce((a, s) => a + s.duration, 0)} 分钟</span>
      </div>
    </div>
  )
}

// ===== Week View Extra Charts =====

/** Time distribution pie chart */
function WeekTimePie({ report }: { report: ReportData }) {
  const data = report.timeDistribution
  const total = data.reduce((sum, d) => sum + d.minutes, 0)
  const colors = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6']

  // Calculate pie slices
  let cumulativePercent = 0
  const slices = data.map((item, i) => {
    const percent = item.minutes / total
    const startAngle = cumulativePercent * 360
    const endAngle = (cumulativePercent + percent) * 360
    cumulativePercent += percent

    const startRad = ((startAngle - 90) * Math.PI) / 180
    const endRad = ((endAngle - 90) * Math.PI) / 180
    const largeArc = percent > 0.5 ? 1 : 0

    const x1 = 50 + 38 * Math.cos(startRad)
    const y1 = 50 + 38 * Math.sin(startRad)
    const x2 = 50 + 38 * Math.cos(endRad)
    const y2 = 50 + 38 * Math.sin(endRad)

    return {
      path: `M 50 50 L ${x1} ${y1} A 38 38 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: colors[i % colors.length],
      label: item.category,
      minutes: item.minutes,
      percent: Math.round(percent * 100),
    }
  })

  return (
    <div className="rounded-[10px] border border-[#eef2f7] bg-[#f9fafb] p-4">
      <h3 className="text-small font-bold text-ink mb-3 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-blue-light">
          <svg className="h-3 w-3 text-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>
        </span>
        时间分配
      </h3>
      <div className="flex items-center gap-4">
        <svg width="130" height="130" viewBox="0 0 100 100" className="shrink-0">
          {slices.map((slice, i) => (
            <path key={i} d={slice.path} fill={slice.color} opacity="0.85" />
          ))}
          <circle cx="50" cy="50" r="20" fill="white" />
          <text x="50" y="48" textAnchor="middle" className="text-[10px] font-bold" fill="#111827">{total}</text>
          <text x="50" y="58" textAnchor="middle" className="text-[7px]" fill="#6b7280">分钟</text>
        </svg>
        <div className="space-y-2 flex-1">
          {slices.map((slice, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: slice.color }} />
              <span className="text-micro text-ink flex-1">{slice.label}</span>
              <span className="text-micro font-bold text-ink">{slice.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Weekly daily bar chart */
function WeekDailyBar({ report }: { report: ReportData }) {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  // Fixed data - no random values to avoid re-render flicker
  const baseData = [2.0, 1.5, 2.5, 1.8, 2.2, 1.2, 1.3]
  const data = days.map((day, i) => ({
    day,
    hours: baseData[i],
  }))
  // Use report daily hours if available
  if (report.dailyHours.length >= 3) {
    report.dailyHours.forEach((d, i) => {
      if (i < data.length) {
        data[i].hours = d.hours
      }
    })
  }
  const maxH = Math.max(...data.map(d => d.hours), 1)

  return (
    <div className="rounded-[10px] border border-[#eef2f7] bg-[#f9fafb] p-4">
      <h3 className="text-small font-bold text-ink mb-3 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-green-light">
          <svg className="h-3 w-3 text-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" /></svg>
        </span>
        每日学习时长
      </h3>
      <div className="flex items-end gap-2 h-[120px] pt-2">
        {data.map((d, i) => {
          const pct = (d.hours / maxH) * 100
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <span className="text-[9px] font-bold text-ink">{d.hours}h</span>
              <div
                className="w-full rounded-t-[6px] bg-gradient-to-b from-[#4ade80] to-[#16a34a] min-h-[6px]"
                style={{ height: `${pct}%` }}
              />
              <span className="text-[9px] text-muted mt-1">{d.day}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-[#eef2f7] flex justify-between text-micro text-muted">
        <span>日均 {(data.reduce((s, d) => s + d.hours, 0) / 7).toFixed(1)}h</span>
        <span className="font-bold text-ink">总计 {data.reduce((s, d) => s + d.hours, 0).toFixed(1)}h</span>
      </div>
    </div>
  )
}

/** Skill radar chart (simplified polygon) */
function WeekSkillRadar({ report }: { report: ReportData }) {
  const skills = [
    { name: '语法基础', value: 84 },
    { name: '函数理解', value: 62 },
    { name: '面向对象', value: 45 },
    { name: '实践能力', value: 57 },
    { name: '解题速度', value: 71 },
    { name: '知识迁移', value: 38 },
  ]

  const n = skills.length
  const cx = 50, cy = 50, r = 36

  // Generate polygon points for the skill values
  const points = skills.map((s, i) => {
    const angle = ((i * 360) / n - 90) * (Math.PI / 180)
    const dist = (s.value / 100) * r
    return `${cx + dist * Math.cos(angle)},${cy + dist * Math.sin(angle)}`
  }).join(' ')

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1]

  return (
    <div className="rounded-[10px] border border-[#eef2f7] bg-[#f9fafb] p-4">
      <h3 className="text-small font-bold text-ink mb-3 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-purple-light">
          <svg className="h-3 w-3 text-purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
        </span>
        能力雷达
      </h3>
      <div className="flex items-center justify-center">
        <svg width="160" height="160" viewBox="0 0 100 100">
          {/* Grid rings */}
          {rings.map((scale) => {
            const ringPoints = Array.from({ length: n }, (_, i) => {
              const angle = ((i * 360) / n - 90) * (Math.PI / 180)
              return `${cx + r * scale * Math.cos(angle)},${cy + r * scale * Math.sin(angle)}`
            }).join(' ')
            return <polygon key={scale} points={ringPoints} fill="none" stroke="#e5e7eb" strokeWidth="0.4" />
          })}
          {/* Axis lines */}
          {skills.map((_, i) => {
            const angle = ((i * 360) / n - 90) * (Math.PI / 180)
            return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)} stroke="#e5e7eb" strokeWidth="0.3" />
          })}
          {/* Data polygon */}
          <polygon points={points} fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="1.2" />
          {/* Data dots */}
          {skills.map((s, i) => {
            const angle = ((i * 360) / n - 90) * (Math.PI / 180)
            const dist = (s.value / 100) * r
            return <circle key={i} cx={cx + dist * Math.cos(angle)} cy={cy + dist * Math.sin(angle)} r="2" fill="#8b5cf6" />
          })}
          {/* Labels */}
          {skills.map((s, i) => {
            const angle = ((i * 360) / n - 90) * (Math.PI / 180)
            const lx = cx + (r + 10) * Math.cos(angle)
            const ly = cy + (r + 10) * Math.sin(angle)
            return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="text-[5px]" fill="#6b7280">{s.name}</text>
          })}
        </svg>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {skills.map((s) => (
          <div key={s.name} className="text-center">
            <b className="block text-micro text-ink">{s.value}%</b>
            <span className="text-[9px] text-muted">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Weekly progress stacked bars */
function WeekProgressStack() {
  const categories = [
    { name: '视频学习', completed: 5, total: 7, color: '#2563eb' },
    { name: '练习题', completed: 18, total: 25, color: '#16a34a' },
    { name: '阅读讲义', completed: 3, total: 4, color: '#f59e0b' },
    { name: '代码实践', completed: 4, total: 6, color: '#8b5cf6' },
    { name: '错题复盘', completed: 8, total: 10, color: '#ef4444' },
  ]

  const totalCompleted = categories.reduce((s, c) => s + c.completed, 0)
  const totalAll = categories.reduce((s, c) => s + c.total, 0)

  return (
    <div className="rounded-[10px] border border-[#eef2f7] bg-[#f9fafb] p-4">
      <h3 className="text-small font-bold text-ink mb-3 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-orange-light">
          <svg className="h-3 w-3 text-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
        </span>
        任务进度
      </h3>
      <div className="space-y-3">
        {categories.map((cat) => {
          const pct = Math.round((cat.completed / cat.total) * 100)
          return (
            <div key={cat.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-micro text-ink">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: cat.color }} />
                  {cat.name}
                </span>
                <span className="text-micro text-muted">{cat.completed}/{cat.total}</span>
              </div>
              <div className="h-3 rounded-full bg-[#e8eff8] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: cat.color, opacity: 0.8 }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-[#eef2f7] flex items-center justify-between">
        <span className="text-micro text-muted">总完成率</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 rounded-full bg-[#e8eff8] overflow-hidden">
            <div className="h-full rounded-full bg-blue" style={{ width: `${Math.round((totalCompleted / totalAll) * 100)}%` }} />
          </div>
          <span className="text-micro font-bold text-ink">{Math.round((totalCompleted / totalAll) * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

// ===== Trend Chart with real data =====

function TrendChart({ mode }: { mode: ViewMode }) {
  // Generate realistic trend data based on mode
  const data = getTrendData(mode)
  const maxH = Math.max(...data.map(d => d.value), 1)

  return (
    <div>
      <div className="flex items-end gap-[6px] h-[90px]">
        {data.map((d, i) => {
          const pct = (d.value / maxH) * 100
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#1f2937] text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {d.label}: {d.value}h
              </div>
              <div
                className="w-full rounded-t-[4px] bg-gradient-to-b from-[#60a5fa] to-blue min-h-[4px] transition-all group-hover:from-[#93c5fd] group-hover:to-[#3b82f6]"
                style={{ height: `${Math.max(pct, 5)}%` }}
              />
              <span className="text-[8px] text-muted leading-none">{d.label}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-micro text-muted">
        <span>日均 {(data.reduce((s, d) => s + d.value, 0) / data.length).toFixed(1)}h</span>
        <span className="font-bold text-ink">总计 {data.reduce((s, d) => s + d.value, 0).toFixed(1)}h</span>
      </div>
    </div>
  )
}

function getTrendData(mode: ViewMode): Array<{ label: string; value: number }> {
  if (mode === 'day') {
    // 6 time slots for the day
    return [
      { label: '早晨', value: 0.3 },
      { label: '上午', value: 0.8 },
      { label: '中午', value: 0.2 },
      { label: '下午', value: 1.1 },
      { label: '傍晚', value: 0.5 },
      { label: '晚上', value: 1.8 },
    ]
  }
  if (mode === 'week') {
    return [
      { label: '周一', value: 2.0 },
      { label: '周二', value: 1.5 },
      { label: '周三', value: 2.5 },
      { label: '周四', value: 1.8 },
      { label: '周五', value: 2.2 },
      { label: '周六', value: 1.2 },
      { label: '周日', value: 1.3 },
    ]
  }
  // month - 4 weeks
  return [
    { label: '第1周', value: 6.5 },
    { label: '第2周', value: 7.0 },
    { label: '第3周', value: 6.2 },
    { label: '第4周', value: 8.3 },
  ]
}
