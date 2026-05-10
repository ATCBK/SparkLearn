'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { api, ReportData } from '@/lib/api'
import { Bar, MetricStrip, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

type Period = 'week' | 'day' | 'month'

export default function ReportPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [report, setReport] = useState<ReportData | null>(null)
  const [summary, setSummary] = useState('')

  useEffect(() => {
    api.getReport(period).then((data) => {
      setReport(data)
      setSummary(data.aiSummary)
    })
  }, [period])

  const stats = report?.stats

  return (
    <div>
      <PageHead
        eyebrow="分析与反馈 / 学习报表"
        title="学习报表"
        description="报告汇总学习行为、练习结果和薄弱点，并回流到画像、路径和资源推荐。"
        chips={[
          { value: report?.period || '本周', label: '周期' },
          { value: `${report?.weakPoints?.length || 3}个`, label: '薄弱点' },
          { value: `${stats ? Math.round(stats.quizAccuracy * 100) : 74}%`, label: '正确率' },
        ]}
      />
      <div className="mb-4 flex gap-2">
        {(['week', 'day', 'month'] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg px-4 py-2 text-small font-bold ${period === p ? 'bg-blue text-white' : 'bg-white text-muted'}`}>
            {p === 'week' ? '周报' : p === 'day' ? '日报' : '月报'}
          </button>
        ))}
      </div>

      <MetricStrip
        items={[
          { value: `${stats?.totalHours ?? 0}h`, label: '学习时长' },
          { value: `${Math.round((stats?.taskCompletionRate ?? 0) * 100)}%`, label: '任务完成率' },
          { value: `${Math.round((stats?.quizAccuracy ?? 0) * 100)}%`, label: '练习正确率' },
          { value: `${stats?.streakDays ?? 0}天`, label: '连续学习' },
        ]}
      />

      <ProtoCard className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h2 font-bold text-ink">学习热力图</h2>
          <Pill tone="blue">{period === 'week' ? '过去12周' : period === 'day' ? '本周小时分布' : '全年分布'}</Pill>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${period === 'day' ? 24 : period === 'month' ? 31 : 12}, minmax(0, 1fr))` }}>
          {Array.from({ length: period === 'day' ? 24 * 7 : period === 'month' ? 31 * 12 : 12 * 7 }).map((_, idx) => (
            <span key={idx} className="h-3 rounded-[3px]" style={{ background: heatColor(idx) }} />
          ))}
        </div>
      </ProtoCard>

      <div className="mt-4 grid grid-cols-[1fr_.9fr] gap-4 max-[980px]:grid-cols-1">
        <ProtoCard>
          <h2 className="mb-4 text-h2 font-bold text-ink">完成情况</h2>
          <div className="grid gap-3">
            {(report?.timeDistribution || []).map((item, idx) => (
              <div key={item.category}>
                <div className="mb-1 flex justify-between text-small"><span className="font-bold text-ink">{item.category}</span><span className="text-muted">{item.minutes} 分钟</span></div>
                <Bar value={Math.min(100, item.minutes / 2)} tone={idx % 2 ? 'green' : 'blue'} />
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {(report?.weakPoints || []).map((item) => (
              <SoftCard key={item.name} className="flex items-center justify-between">
                <span className="text-small font-bold text-ink">{item.name}</span>
                <Pill tone="orange">{Math.round(item.score * 100)}%</Pill>
              </SoftCard>
            ))}
          </div>
        </ProtoCard>
        <ProtoCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-h2 font-bold text-ink">AI 报告总结</h2>
            <ProtoButton variant="secondary" onClick={() => setSummary(report?.aiSummary || '')}><Sparkles className="h-4 w-4" />生成总结</ProtoButton>
          </div>
          <p className="min-h-[160px] rounded-[12px] bg-[#f9fafb] p-4 text-small leading-7 text-text">{summary || '点击生成总结。'}</p>
          <div className="mt-4 grid gap-2">
            <ProtoButton href="/resources">去补当前卡点</ProtoButton>
            <ProtoButton href="/path" variant="tertiary">查看路径调整</ProtoButton>
          </div>
        </ProtoCard>
      </div>
    </div>
  )
}

function heatColor(idx: number) {
  const levels = ['#eef2f7', '#dbeafe', '#93c5fd', '#60a5fa', '#2563eb']
  return levels[(idx * 7 + idx) % levels.length]
}
