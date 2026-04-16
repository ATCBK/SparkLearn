import Link from 'next/link'

interface EmptyStateProps {
  type?: 'resources' | 'tasks' | 'quiz' | 'generic'
  title?: string
  description?: string
  action?: { label: string; href: string }
}

const defaults: Record<string, { title: string; desc: string; icon: string }> = {
  resources: {
    title: '还没有生成过资源',
    desc: '前往资源生成页面，让 AI 为你创建学习资料吧',
    icon: ' ',
  },
  tasks: {
    title: '今天还没有任务',
    desc: '去看看学习路径，开始新的学习任务吧',
    icon: '✅',
  },
  quiz: {
    title: '还没有错题记录',
    desc: '去做练习题，系统会自动记录你的错题',
    icon: ' ',
  },
  generic: {
    title: '暂无内容',
    desc: '相关内容将在你使用系统后自动出现',
    icon: ' ',
  },
}

export function EmptyState({ type = 'generic', title, description, action }: EmptyStateProps) {
  const d = defaults[type]

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-40 h-40 rounded-full bg-bg-hover flex items-center justify-center">
        <span className="text-5xl">{d.icon}</span>
      </div>
      <h3 className="text-h3 text-ink">{title || d.title}</h3>
      <p className="text-body text-ink-secondary max-w-sm text-center">
        {description || d.desc}
      </p>
      {action && (
        <Link
          href={action.href}
          className="mt-2 h-10 px-6 rounded-[12px] bg-blue text-white font-medium text-body hover:bg-blue-dark transition-colors inline-flex items-center"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
