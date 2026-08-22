import { describe, expect, it } from 'vitest'

import { PROFILE_DIALOG_HISTORY_HREF } from './dialogHistoryLink'

describe('画像页建档对话入口', () => {
  it('点击入口应跳转到对话式建档页面的已完成状态', () => {
    expect(PROFILE_DIALOG_HISTORY_HREF).toBe('/onboarding?view=completed')
  })
})
