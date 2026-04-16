'use client'

import { useEffect, useState } from 'react'
import { api, ReportData } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { Clock, CheckCircle2, Target, Flame, AlertTriangle, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export default function ReportPage() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'week' | 'month'>('week')

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getReport()
      setReport(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-full" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-[20px]" />)}
        </div>
        <Skeleton className="h-80 rounded-[20px]" />
      </div>
    )
  }
  if (error || !report) return <ErrorState type="server" onRetry={fetchData} />

  const maxHours = Math.max(...report.dailyHours.map(d => d.hours))
  const totalMinutes = report.timeDistribution.reduce((sum, t) => sum + t.minutes, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-ink">学习报告</h1>
          <p className="text-body text-ink-secondary mt-1">了解你的学习表现和薄弱环节</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPeriod('week')} className={cn(
            'px-4 py-2 rounded-pill text-small font-medium transition-colors',
            period === 'week' ? 'bg-blue text-white' : 'bg-bg-hover text-ink-secondary hover:text-ink',
          )}>本周</button>
          <button onClick={() => setPeriod('month')} className={cn(
            'px-4 py-2 rounded-pill text-small font-medium transition-colors',
            period === 'month' ? 'bg-blue text-white' : 'bg-bg-hover text-ink-secondary hover:text-ink',
          )}>本月</button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-5 bg-blue/5">
          <Clock className="w-5 h-5 text-blue mb-2" />
          <p className="text-h1 text-ink">{report.stats.totalHours}h</p>
          <p className="text-caption text-ink-tertiary">总学习时长</p>
        </Card>
        <Card className="p-5 bg-success/5">
          <CheckCircle2 className="w-5 h-5 text-success mb-2" />
          <p className="text-h1 text-ink">{Math.round(report.stats.taskCompletionRate * 100)}%</p>
          <p className="text-caption text-ink-tertiary">任务完成率</p>
        </Card>
        <Card className="p-5 bg-warning/5">
          <Target className="w-5 h-5 text-warning mb-2" />
          <p className="text-h1 text-ink">{Math.round(report.stats.quizAccuracy * 100)}%</p>
          <p className="text-caption text-ink-tertiary">习题正确率</p>
        </Card>
        <Card className="p-5 bg-purple/5">
          <Flame className="w-5 h-5 text-purple mb-2" />
          <p className="text-h1 text-ink">{report.stats.streakDays}天</p>
          <p className="text-caption text-ink-tertiary">连续学习</p>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-[1fr_360px] gap-6">
        {/* Charts */}
        <div className="space-y-6">
          {/* Bar Chart */}
          <Card className="p-6">
            <h3 className="text-h3 text-ink mb-4">每日学习时长</h3>
            <div className="flex items-end gap-3 h-40">
              {report.dailyHours.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center justify-end h-32">
                    <div
                      className="w-full max-w-8 rounded-t-lg bg-gradient-to-t from-blue to-teal transition-all duration-800 ease-out"
                      style={{ height: `${(d.hours / maxHours) * 100}%` }}
                    />
                  </div>
                  <span className="text-micro text-ink-tertiary">{d.date}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Time Distribution */}
          <Card className="p-6">
            <h3 className="text-h3 text-ink mb-4">时间分配</h3>
            <div className="space-y-3">
              {report.timeDistribution.map(t => (
                <div key={t.category}>
                  <div className="flex justify-between text-caption mb-1">
                    <span className="text-ink-secondary">{t.category}</span>
                    <span className="text-ink-tertiary">{Math.round(t.minutes / 60 * 10) / 10}h</span>
                  </div>
                  <ProgressBar value={(t.minutes / totalMinutes) * 100} color="gradient" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Panel: Weak Points */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-small font-semibold text-ink mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              薄弱点
            </h3>
            <div className="space-y-3">
              {report.weakPoints.map(wp => (
                <div key={wp.name} className="p-3 rounded-lg bg-bg-hover">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-small font-medium text-ink">{wp.name}</span>
                    <Badge variant={wp.score < 0.4 ? 'danger' : 'warning'}>
                      掌握度 {Math.round(wp.score * 100)}%
                    </Badge>
                  </div>
                  <ProgressBar
                    value={wp.score * 100}
                    color={wp.score < 0.4 ? 'danger' : 'warning'}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* AI Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h3 text-ink">AI 分析总结</h3>
          <Button variant="ghost" size="sm">
            <Volume2 className="w-4 h-4" />
            语音播报
          </Button>
        </div>
        <p className="text-body text-ink-secondary leading-relaxed">{report.aiSummary}</p>
      </Card>
    </div>
  )
}
