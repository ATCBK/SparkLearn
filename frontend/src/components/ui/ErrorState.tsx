interface ErrorStateProps {
  type?: 'server' | 'network' | 'generic'
  title?: string
  description?: string
  onRetry?: () => void
}

const defaults: Record<NonNullable<ErrorStateProps['type']>, { title: string; desc: string; icon: string }> = {
  server: {
    title: '出了点小问题',
    desc: '服务器暂时无法响应，请稍后重试。',
    icon: '⚠️',
  },
  network: {
    title: '网络连接异常',
    desc: '请检查网络连接后重试。',
    icon: '📶',
  },
  generic: {
    title: '发生了意外错误',
    desc: '请重试一次，如果仍有问题请稍后再试。',
    icon: '❗',
  },
}

export function ErrorState({ type = 'generic', title, description, onRetry }: ErrorStateProps) {
  const d = defaults[type]

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-28 h-28 rounded-full bg-bg-hover flex items-center justify-center" aria-hidden>
        <span className="text-4xl">{d.icon}</span>
      </div>

      <h3 className="text-h3 text-ink">{title || d.title}</h3>
      <p className="text-body text-ink-secondary max-w-[520px] leading-7 whitespace-normal break-words">
        {description || d.desc}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 h-10 px-6 rounded-[12px] bg-blue text-white font-medium text-body hover:bg-blue-dark transition-colors"
        >
          重试
        </button>
      )}
    </div>
  )
}
