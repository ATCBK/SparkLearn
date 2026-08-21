import { describe, expect, it } from 'vitest'

import {
  canNavigateToNextPeriod,
  generateHeatmapData,
  getWeekStart,
  moveReportPeriod,
} from './heatmap'

const NOW = new Date(2026, 7, 21, 14, 30)

describe('generateHeatmapData', () => {
  it('未来月份只生成尚未发生的格子', () => {
    const data = generateHeatmapData('month', new Date(2026, 8, 1), NOW)

    expect(data).toHaveLength(30)
    expect(data.flat().every((value) => value === null)).toBe(true)
  })

  it('当前月份使用真实天数并屏蔽未来日期和小时', () => {
    const data = generateHeatmapData('month', new Date(2026, 7, 1), NOW)

    expect(data).toHaveLength(31)
    expect(data[20][14]).not.toBeNull()
    expect(data[20][15]).toBeNull()
    expect(data[21].every((value) => value === null)).toBe(true)
  })

  it.each([
    [2027, 1, 28],
    [2028, 1, 29],
    [2026, 3, 30],
  ])('%i 年第 %i 个月生成正确的自然月天数', (year, monthIndex, expectedDays) => {
    const data = generateHeatmapData('month', new Date(year, monthIndex, 1), new Date(2030, 0, 1))

    expect(data).toHaveLength(expectedDays)
  })

  it('同一个日期和小时的 Mock 强度保持稳定', () => {
    const selectedDate = new Date(2026, 6, 15)

    expect(generateHeatmapData('day', selectedDate, NOW)).toEqual(
      generateHeatmapData('day', selectedDate, NOW),
    )
  })
})

describe('报告周期导航', () => {
  it('当前周期不能继续进入未来，过去周期可以前进到当前周期', () => {
    expect(canNavigateToNextPeriod('day', new Date(2026, 7, 21), NOW)).toBe(false)
    expect(canNavigateToNextPeriod('day', new Date(2026, 7, 20), NOW)).toBe(true)
    expect(canNavigateToNextPeriod('week', new Date(2026, 7, 21), NOW)).toBe(false)
    expect(canNavigateToNextPeriod('week', new Date(2026, 7, 14), NOW)).toBe(true)
    expect(canNavigateToNextPeriod('month', new Date(2026, 7, 1), NOW)).toBe(false)
    expect(canNavigateToNextPeriod('month', new Date(2026, 6, 1), NOW)).toBe(true)
  })

  it('周日仍归入刚刚结束的自然周', () => {
    const sunday = new Date(2026, 7, 23)

    expect(getWeekStart(sunday)).toEqual(new Date(2026, 7, 17))
  })

  it('月末切换月份不会跳过目标月份', () => {
    expect(moveReportPeriod(new Date(2026, 0, 31), 'month', 1)).toEqual(new Date(2026, 1, 1))
  })
})
