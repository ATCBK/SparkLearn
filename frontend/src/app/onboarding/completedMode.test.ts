import { describe, expect, it } from 'vitest'

import { isProfileDialogCompletedMode } from './completedMode'

describe('对话式建档完成态', () => {
  it('通过 view=completed 进入已采集完成状态', () => {
    expect(isProfileDialogCompletedMode('?view=completed')).toBe(true)
    expect(isProfileDialogCompletedMode('?foo=bar&view=completed')).toBe(true)
  })

  it('没有 completed 参数时保持建档流程', () => {
    expect(isProfileDialogCompletedMode('')).toBe(false)
    expect(isProfileDialogCompletedMode('?view=history')).toBe(false)
    expect(isProfileDialogCompletedMode('?view=collect')).toBe(false)
  })
})
