interface TypewriterLoaderProps {
  text?: string
}

export function TypewriterLoader({ text }: TypewriterLoaderProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-1.5" aria-label="loading">
        <span className="h-2.5 w-2.5 rounded-full bg-blue animate-pulse [animation-delay:0ms]" />
        <span className="h-2.5 w-2.5 rounded-full bg-blue/80 animate-pulse [animation-delay:150ms]" />
        <span className="h-2.5 w-2.5 rounded-full bg-blue/60 animate-pulse [animation-delay:300ms]" />
      </div>
      {text && <p className="text-ink-secondary text-small">{text}</p>}
    </div>
  )
}
