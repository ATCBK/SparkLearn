import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentType } from 'react'
import { describe, expect, it, vi } from 'vitest'

import TutorFilesPage from '../files/page'
import TutorKnowledgePage from '../knowledge/page'
import TutorMcpStorePage from '../mcp-store/page'
import TutorPage from '../page'
import TutorRolesPage from '../roles/page'
import TutorSkillsPage from '../skills/page'
import WorkshopPage from '../workshop/page'
import TutorModelSettingsPage from './page'

const navigationState = vi.hoisted(() => ({ pathname: '/tutor' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({
    back: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

const PAGE_CASES = [
  { pathname: '/tutor', Page: TutorPage },
  { pathname: '/tutor/roles', Page: TutorRolesPage },
  { pathname: '/tutor/workshop', Page: WorkshopPage },
  { pathname: '/tutor/knowledge', Page: TutorKnowledgePage },
  { pathname: '/tutor/mcp-store', Page: TutorMcpStorePage },
  { pathname: '/tutor/skills', Page: TutorSkillsPage },
  { pathname: '/tutor/model-settings', Page: TutorModelSettingsPage },
  { pathname: '/tutor/files', Page: TutorFilesPage },
]

const EXPECTED_ITEMS = [
  { label: '学习空间', href: '/tutor', icon: 'lucide-sparkles' },
  { label: '角色工坊', href: '/tutor/roles', icon: 'lucide-user-cog' },
  { label: '研讨会', href: '/tutor/workshop', icon: 'lucide-users' },
  { label: '知识库', href: '/tutor/knowledge', icon: 'lucide-database' },
  { label: 'MCP 插件商店', href: '/tutor/mcp-store', icon: 'lucide-puzzle' },
  { label: 'Skills 商店', href: '/tutor/skills', icon: 'lucide-sparkles' },
  { label: '模型配置', href: '/tutor/model-settings', icon: 'lucide-settings-2' },
  { label: '我的文件', href: '/tutor/files', icon: 'lucide-paperclip' },
]

function getTutorSidebar(Page: ComponentType, pathname: string) {
  navigationState.pathname = pathname
  const html = renderToStaticMarkup(<Page />)
  const sidebar = html.match(/<nav[^>]*aria-label="智能辅导功能菜单"[^>]*>[\s\S]*?<\/nav>/)?.[0]
  expect(sidebar, `${pathname} 应渲染统一 Tutor 侧栏`).toBeTruthy()
  return sidebar as string
}

function getMenuAnchor(sidebar: string, label: string) {
  return [...sidebar.matchAll(/<a\s+([^>]*)>([\s\S]*?)<\/a>/g)]
    .map((match) => ({ attributes: match[1], body: match[2], text: match[2].replace(/<[^>]+>/g, '').trim() }))
    .find((item) => item.text === label)
}

describe('Tutor 模型配置导航', () => {
  it('从智能辅导主菜单提供可访问的模型配置链接', () => {
    const html = renderToStaticMarkup(<TutorPage />)

    expect(html).toContain('href="/tutor/model-settings"')
    expect(html).toContain('模型配置')
  })

  it('在模型配置页面复用 Tutor 导航并标记当前页面', () => {
    navigationState.pathname = '/tutor/model-settings'
    const html = renderToStaticMarkup(<TutorModelSettingsPage />)

    expect(html).toContain('aria-label="智能辅导功能菜单"')
    expect(html).toMatch(/<a(?=[^>]*href="\/tutor\/model-settings")(?=[^>]*aria-current="page")[^>]*>/)
    expect(html).toContain('返回主平台')
  })

  it('所有 Tutor 页面保持相同菜单尺寸、链接和图标', () => {
    for (const { pathname, Page } of PAGE_CASES) {
      const sidebar = getTutorSidebar(Page, pathname)

      expect(sidebar).toContain('学而思 SparkLearn')
      for (const expected of EXPECTED_ITEMS) {
        const anchor = getMenuAnchor(sidebar, expected.label)
        expect(anchor, `${pathname} 缺少 ${expected.label}`).toBeTruthy()
        expect(anchor?.attributes).toContain(`href="${expected.href}"`)
        expect(anchor?.attributes).toContain('h-10')
        expect(anchor?.body).toContain(expected.icon)
      }

      const active = getMenuAnchor(sidebar, EXPECTED_ITEMS.find((item) => item.href === pathname)?.label || '学习空间')
      expect(active?.attributes).toContain('aria-current="page"')
    }
  })
})
