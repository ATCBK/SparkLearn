import { describe, expect, it } from 'vitest'

import { buildPetAdoptionRequest } from './adoptionRequest'

describe('学习伙伴认养请求构建', () => {
  it('重新认养时使用重置后重新创建来清空历史记录', () => {
    const request = buildPetAdoptionRequest({
      mode: 'readopt',
      name: '星火',
      avatar: 'owl',
      personality: 'verbose',
    })

    expect(request).toEqual({
      action: 'resetAndCreate',
      payload: {
        name: '星火',
        avatar: 'owl',
        personality: 'verbose',
      },
    })
  })
})
