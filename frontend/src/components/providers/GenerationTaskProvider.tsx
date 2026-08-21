'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { api, type Resource } from '@/lib/api'
import { getCurrentUserId } from '@/lib/auth'
import { GenerationFailureContactDialog } from '@/components/ui/GenerationFailureContactDialog'

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
  startBackgroundGeneration: (type: string, prompt: string, knowledgeFileIds?: number[], videoOptions?: { styleId?: string; durationSec?: number; voice?: string; voiceProvider?: string; voiceSpeed?: number; voicePitch?: number; voiceVolume?: number; codeLevel?: string }) => void
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

export function GenerationTaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const [failureDialog, setFailureDialog] = useState<{ message: string; detail?: string } | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const taskIdRef = useRef(0)
  const ownerIdRef = useRef(getCurrentUserId())

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentOwnerId = getCurrentUserId()
      if (ownerIdRef.current === currentOwnerId) return
      ownerIdRef.current = currentOwnerId
      setTasks([])
      setFailureDialog(null)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [pathname])

  const startBackgroundGeneration = useCallback((type: string, prompt: string, knowledgeFileIds: number[] = [], videoOptions?: { styleId?: string; durationSec?: number; voice?: string; voiceProvider?: string; voiceSpeed?: number; voicePitch?: number; voiceVolume?: number; codeLevel?: string }) => {
    const taskOwnerId = getCurrentUserId()
    const taskId = `bg-${Date.now()}-${++taskIdRef.current}`
    const newTask: GenerationTask = {
      id: taskId,
      type,
      prompt,
      status: 'generating',
    }
    setTasks(prev => [...prev, newTask])

    const styleId = videoOptions?.styleId || 'apple-minimal'
    const durationSec = videoOptions?.durationSec || 90
    const voice = videoOptions?.voice || ''
    const voiceProvider = videoOptions?.voiceProvider || 'cosyvoice'
    const voiceSpeed = videoOptions?.voiceSpeed
    const voicePitch = videoOptions?.voicePitch
    const voiceVolume = videoOptions?.voiceVolume

    void api.generateResource(type as Resource['type'], prompt, knowledgeFileIds, {
      durationSec,
      styleId,
      voice,
      voiceProvider,
      voiceSpeed,
      voicePitch,
      voiceVolume,
      codeLevel: videoOptions?.codeLevel,
    }).then((resource) => {
      if (getCurrentUserId() !== taskOwnerId) return
      if (resource.status !== 'completed') {
        throw new Error('后台生成尚未返回完成结果，请稍后重试')
      }
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', resource } : t))
    }).catch((err: unknown) => {
      if (getCurrentUserId() !== taskOwnerId) return
      const message = err instanceof Error ? err.message : '生成失败'
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', error: message } : t))
      setFailureDialog({
        message: type === 'video' ? '后台视频生成失败，请联系项目负责人处理。' : '后台资源生成失败，请联系项目负责人处理。',
        detail: message,
      })
    })
  }, [])

  const dismissTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <GenerationTaskContext.Provider value={{ tasks, startBackgroundGeneration, dismissTask }}>
      {children}
      {/* 完成通知弹窗 */}
      <div className="fixed bottom-6 right-6 z-[9999] flex max-w-sm flex-col gap-3">
        {tasks.filter(t => t.status === 'completed' || t.status === 'error').map(task => (
          <div key={task.id} className="animate-in slide-in-from-bottom-4 fade-in duration-300">
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
      </div>
      <GenerationFailureContactDialog
        open={Boolean(failureDialog)}
        message={failureDialog?.message}
        detail={failureDialog?.detail}
        onClose={() => setFailureDialog(null)}
      />
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
