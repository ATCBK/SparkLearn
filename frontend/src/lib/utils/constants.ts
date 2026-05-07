export const RESOURCE_TYPES = [
  { key: 'document' as const, label: '课程文档', icon: 'FileText' },
  { key: 'ppt' as const, label: 'PPT', icon: 'Presentation' },
  { key: 'mindmap' as const, label: '思维导图', icon: 'GitBranch' },
  { key: 'quiz' as const, label: '练习题', icon: 'HelpCircle' },
  { key: 'reading' as const, label: '拓展阅读', icon: 'BookOpen' },
  { key: 'code' as const, label: '代码案例', icon: 'Code' },
] as const

export type ResourceType = typeof RESOURCE_TYPES[number]['key']

export const NAV_ITEMS = [
  { label: '首页总览', href: '/', icon: 'Home' },
  { label: '学习路径', href: '/path', icon: 'Route' },
  { label: '资源中心', href: '/resources', icon: 'Library' },
  { label: '练习与错题', href: '/practice', icon: 'PenTool' },
  { label: '资源推送', href: '/feed', icon: 'Sparkles' },
  { label: '资源生成', href: '/generate', icon: 'Wand2' },
] as const

export const TOOL_NAV_ITEMS = [
  { label: '智能辅导', href: '/tutor', icon: 'MessageCircle' },
  { label: '学习报告', href: '/report', icon: 'BarChart3' },
  { label: '视频播放', href: '/video', icon: 'Play' },
] as const

export const QUICK_TAGS = ['Python', '基础巩固', '函数', '面向对象', '数据结构', '算法']

export const MOCK_DELAY_MS = 300
