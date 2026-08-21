import { describe, expect, it } from 'vitest'

import RootLayout from './layout'
import { GenerationTaskProvider } from '@/components/providers/GenerationTaskProvider'


describe('RootLayout', () => {
  it('在所有路由共同的根布局中保留后台生成任务', () => {
    const tree = RootLayout({ children: <main>测试页面</main> })
    const body = tree.props.children
    const downloadProvider = body.props.children
    const generationProvider = downloadProvider.props.children

    expect(generationProvider.type).toBe(GenerationTaskProvider)
  })
})
