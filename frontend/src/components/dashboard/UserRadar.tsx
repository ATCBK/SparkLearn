'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { DashboardStats, MasteryRecord, StudentProfile } from '@/lib/api'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import type { EChartsType } from 'echarts/core'

echarts.use([RadarChart, GridComponent, TooltipComponent, CanvasRenderer])

const RADAR_DIMENSIONS = ['活跃度', '忠诚度', '购买力', '兴趣广度', '社交影响力'] as const

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function buildRadarValues(profile: StudentProfile | null, stats: DashboardStats | null, mastery: MasteryRecord[]) {
  const masteryAvg = mastery.length
    ? mastery.reduce((sum, item) => sum + item.score, 0) / mastery.length
    : 0.68

  return [
    clampScore((stats?.totalHours ?? 8) * 5),
    clampScore((stats?.streakDays ?? 5) * 7),
    clampScore((stats?.quizAccuracy ?? 0.72) * 100),
    clampScore((profile?.learningPreference.length ?? 2) * 24),
    clampScore(masteryAvg * 100),
  ]
}

interface UserRadarProps {
  profile: StudentProfile | null
  stats: DashboardStats | null
  mastery: MasteryRecord[]
}

export function UserRadar({ profile, stats, mastery }: UserRadarProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstanceRef = useRef<EChartsType | null>(null)
  const previousValuesRef = useRef<number[]>([])
  const values = useMemo(() => buildRadarValues(profile, stats, mastery), [profile, stats, mastery])

  useEffect(() => {
    if (!chartRef.current) return

    const chart = echarts.init(chartRef.current, undefined, { renderer: 'canvas' })
    chartInstanceRef.current = chart

    const applyOption = (nextValues: number[]) => {
      const previousValues = previousValuesRef.current
      const hasMeaningfulChange = previousValues.some((prev, idx) => {
        if (!prev) return false
        return Math.abs(nextValues[idx] - prev) / prev > 0.05
      })

      if (hasMeaningfulChange) {
        console.info('[UserRadar] dimension changed over 5%', {
          previous: previousValues,
          next: nextValues,
        })
      }

      previousValuesRef.current = nextValues

      const option: EChartsOption = {
        color: ['#1890FF'],
        tooltip: { trigger: 'item' },
        radar: {
          radius: '68%',
          center: ['50%', '54%'],
          splitNumber: 4,
          axisName: {
            color: '#6e6e73',
            fontSize: 11,
          },
          axisLine: {
            lineStyle: { color: 'rgba(24, 144, 255, 0.15)' },
          },
          splitLine: {
            lineStyle: { color: 'rgba(24, 144, 255, 0.15)' },
          },
          splitArea: {
            areaStyle: {
              color: ['rgba(24,144,255,0.04)', 'rgba(24,144,255,0.02)'],
            },
          },
          indicator: RADAR_DIMENSIONS.map(name => ({ name, max: 100 })),
        },
        series: [{
          type: 'radar',
          data: [{
            value: nextValues,
            name: '用户画像',
            areaStyle: { color: 'rgba(24, 144, 255, 0.22)' },
            lineStyle: { color: '#1890FF', width: 2 },
            itemStyle: { color: '#1890FF' },
          }],
          animationDuration: 600,
          animationDurationUpdate: 600,
          animationEasing: 'cubicOut',
          animationEasingUpdate: 'cubicOut',
        }],
      }

      chart.setOption(option, true)
    }

    applyOption(values)

    const interval = window.setInterval(() => {
      applyOption(buildRadarValues(profile, stats, mastery))
    }, 3000)

    const resizeObserver = new ResizeObserver(() => chart.resize())
    resizeObserver.observe(chartRef.current)

    return () => {
      window.clearInterval(interval)
      resizeObserver.disconnect()
      chart.dispose()
      chartInstanceRef.current = null
    }
  }, [mastery, profile, stats, values])

  return <div ref={chartRef} className="h-[180px] w-full" aria-label="用户画像雷达图" />
}
