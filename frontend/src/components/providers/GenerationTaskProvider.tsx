'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Resource } from '@/lib/api'

interface GenerationTask {
  id: string
  type: string
  prompt: string
  status: 'generating' | 'completed' | 'error'
  resource?: Resource
  error?: string
}

interface GenerationTaskContextType {
  tasks: GenerationTask[]
  startBackgroundGeneration: (type: string, prompt: string, knowledgeFileIds?: number[]) => void
  dismissTask: (id: string) => void
}

const GenerationTaskContext = createContext<GenerationTaskContextType>({
  tasks: [],
  startBackgroundGeneration: () => {},
  dismissTask: () => {},
})

export function useGenerationTasks() {
  return useContext(GenerationTaskContext)
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

export function GenerationTaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const router = useRouter()
  const taskIdRef = useRef(0)

  const startBackgroundGeneration = useCallback((type: string, prompt: string, knowledgeFileIds: number[] = []) => {
    const taskId = `bg-${Date.now()}-${++taskIdRef.current}`
    const newTask: GenerationTask = {
      id: taskId,
      type,
      prompt,
      status: 'generating',
    }
    setTasks(prev => [...prev, newTask])

    // 视频类型走独立管线
    if (type === 'video') {
      (async () => {
        try {
          // Step 1: Polish
          const polishRes = await fetch(`${API_BASE}/api/video/polish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, duration_sec: 90 }),
          })
          const polishJson = await polishRes.json()
          const polish = polishJson.data || polishJson

          // Step 2: Create job
          const jobRes = await fetch(`${API_BASE}/api/video/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              polish_id: polish.polish_id,
              prompt: polish.polished_prompt || prompt,
              title: polish.title || prompt.slice(0, 20),
              script_outline: polish.script_outline || [],
              video_provider: 'html_ppt',
            }),
          })
          const jobJson = await jobRes.json()
          const job = jobJson.data || jobJson
          const resourceId = job.resource_id

          // Step 3: Wait for events to complete
          if (job.events_url) {
            try {
              const eventsRes = await fetch(`${API_BASE}${job.events_url}`)
              if (eventsRes.body) {
                const reader = eventsRes.body.getReader()
                const decoder = new TextDecoder()
                let buf = ''
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) break
                  buf += decoder.decode(value, { stream: true })
                  buf = buf.split('\n\n').pop() || ''
                }
              }
            } catch { /* SSE failed, video may still generate */ }
          }

          // Step 4: Fetch result
          const resRes = await fetch(`${API_BASE}/api/video/resources/${resourceId}`)
          if (resRes.ok) {
            const resJson = await resRes.json()
            const raw = resJson.data || resJson
            const resource: Resource = {
              id: raw.id || resourceId,
              title: raw.title || polish.title || prompt.slice(0, 20),
              type: 'video',
              status: raw.status || 'completed',
              createdAt: raw.created_at || new Date().toISOString(),
            }
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', resource } : t))
          } else {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', resource: { id: resourceId, title: polish.title || prompt.slice(0, 20), type: 'video', status: 'completed', createdAt: new Date().toISOString() } } : t))
          }
        } catch (err: any) {
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', error: err?.message || '视频生成失败' } : t))
        }
      })()
      return
    }

    // 其他类型走 /api/resources/generate SSE
    fetch(`${API_BASE}/api/resources/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, prompt, knowledge_file_ids: knowledgeFileIds }),
    }).then(async (res) => {
      if (!res.body) throw new Error('流式响应体为空')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let resource: Resource | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''
        for (const c of chunks) {
          const line = c.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'done' && evt.payload?.resource) {
              const raw = evt.payload.resource
              resource = {
                id: raw.id,
                title: raw.title,
                type: raw.type,
                status: raw.status,
                createdAt: raw.created_at,
                content: raw.content,
                sourceUrl: raw.source_url,
                progress: raw.progress,
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }

      if (resource) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', resource } : t))
      } else {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', error: '生成结果为空' } : t))
      }
    }).catch((err) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', error: err?.message || '生成失败' } : t))
    })
  }, [])

  const dismissTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <GenerationTaskContext.Provider value={{ tasks, startBackgroundGeneration, dismissTask }}>
      {children}
      {/* 完成通知弹窗 */}
      {tasks.filter(t => t.status === 'completed' || t.status === 'error').map(task => (
        <div
          key={task.id}
          className="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-lg">
            {task.status === 'completed' ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#059669]" />
                  <span className="text-sm font-bold text-[#111827]">资源生成完成</span>
                </div>
                <p className="mt-1 text-xs text-[#6b7280] line-clamp-1">{task.resource?.title || task.prompt.slice(0, 30)}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      router.push(`/generate?view=library&id=${task.resource?.id || ''}`)
                      dismissTask(task.id)
                    }}
                    className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1d4ed8] transition-colors"
                  >
                    查看资源
                  </button>
                  <button
                    onClick={() => dismissTask(task.id)}
                    className="rounded-lg bg-[#f3f4f6] px-3 py-1.5 text-xs font-bold text-[#6b7280] hover:bg-[#e5e7eb] transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#dc2626]" />
                  <span className="text-sm font-bold text-[#111827]">生成失败</span>
                </div>
                <p className="mt-1 text-xs text-[#6b7280]">{task.error || '未知错误'}</p>
                <button
                  onClick={() => dismissTask(task.id)}
                  className="mt-3 rounded-lg bg-[#f3f4f6] px-3 py-1.5 text-xs font-bold text-[#6b7280] hover:bg-[#e5e7eb] transition-colors"
                >
                  关闭
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {/* 生成中指示器 - 右上角 */}
      {tasks.some(t => t.status === 'generating') && (
        <div className="fixed top-4 right-6 z-[9998] flex items-center gap-2 rounded-full bg-white border border-[#e5e7eb] px-4 py-2 shadow-md">
          <div className="h-3 w-3 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-[#6b7280]">
            {tasks.filter(t => t.status === 'generating').length} 个资源生成中...
          </span>
        </div>
      )}
    </GenerationTaskContext.Provider>
  )
}
