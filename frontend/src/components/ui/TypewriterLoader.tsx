interface TypewriterLoaderProps {
  text?: string
}

export function TypewriterLoader({ text }: TypewriterLoaderProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="typewriter">
        <div className="slide"><i></i></div>
        <div className="paper"></div>
        <div className="keyboard"></div>
      </div>
      {text && <p className="text-ink-secondary text-small">{text}</p>}
    </div>
  )
}
