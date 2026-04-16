interface ErrorStateProps {
  type?: 'server' | 'network' | 'generic'
  title?: string
  description?: string
  onRetry?: () => void
}

const defaults: Record<string, { title: string; desc: string; icon: string }> = {
  server: {
    title: '出了点小问题',
    desc: '服务器暂时无法响应，请稍后再试',
    icon: ' ',
  },
  network: {
    title: '网络不太给力',
    desc: '请检查网络连接后重试',
    icon: ' ',
  },
  generic: {
    title: '好像出了点状况',
    desc: '遇到了意外错误，请重试',
    icon: '⚠️',
  },
}

export function ErrorState({ type = 'generic', title, description, onRetry }: ErrorStateProps) {
  const d = defaults[type]

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      {/* SVG-style illustration placeholder */}
      <div className="w-48 h-48 rounded-full bg-bg-hover flex items-center justify-center">
        <span className="text-6xl">{d.icon}</span>
      </div>
      <h3 className="text-h3 text-ink">{title || d.title}</h3>
      <p className="text-body text-ink-secondary max-w-sm text-center">
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
