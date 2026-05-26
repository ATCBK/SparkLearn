import type { LucideIcon } from 'lucide-react'
import { BookOpen, CheckSquare, Home, Map, MessageSquare, User } from 'lucide-react'

export type PageMeta = {
  group: string
  title: string
  isMainTab?: boolean
}

export type MobileTabItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const PAGE_META: Record<string, PageMeta> = {
  '/': { group: 'SparkLearn', title: '学习工作台', isMainTab: true },
  '/profile': { group: 'SparkLearn', title: '学习画像', isMainTab: true },
  '/profile/settings': { group: '个人设置', title: '设置' },
  '/path': { group: 'SparkLearn', title: '个性化路径', isMainTab: true },
  '/generate': { group: 'SparkLearn', title: '资源中心', isMainTab: true },
  '/knowledge': { group: 'SparkLearn', title: '知识库' },
  '/practice': { group: 'SparkLearn', title: '练习评测', isMainTab: true },
  '/practice/mistakes': { group: '练习评测', title: '错题本' },
  '/practice/favorites': { group: '练习评测', title: '收藏题目' },
  '/practice/records': { group: '练习评测', title: '练习记录' },
  '/forum': { group: 'SparkLearn', title: '学习论坛' },
  '/forum/new': { group: '学习论坛', title: '发布帖子' },
  '/forum/my': { group: '学习论坛', title: '我的帖子' },
  '/report': { group: 'SparkLearn', title: '学习报告' },
  '/agent': { group: 'SparkLearn', title: '学习伙伴' },
  '/tutor': { group: '工具', title: '智能辅导' },
  '/tutor/mcp-store': { group: '工具', title: 'MCP 插件商店' },
  '/video': { group: 'SparkLearn', title: '视频资源' },
}

export const MOBILE_TABS: MobileTabItem[] = [
  { label: '工作台', href: '/', icon: Home },
  { label: '画像', href: '/profile', icon: User },
  { label: '路径', href: '/path', icon: Map },
  { label: '资源', href: '/generate', icon: BookOpen },
  { label: '练习', href: '/practice', icon: CheckSquare },
  { label: '论坛', href: '/forum', icon: MessageSquare },
]
