'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  Bookmark,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Download,
  Gauge,
  GraduationCap,
  Layers,
  List,
  Loader2,
  MessageCircle,
  Mic,
  MoreHorizontal,
  NotebookPen,
  ExternalLink,
  Play,
  RotateCw,
  Send,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { api, type VideoInfo } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { readLearningNotes, writeLearningNotes, type LearningNote } from '@/lib/learningNotes'
import { cn } from '@/lib/utils/cn'

type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string
}

type MemoryState = {
  id: string | null
  title: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
}

type VideoDetailTab = 'intro' | 'knowledge' | 'notes' | 'practice'

type KnowledgePoint = {
  title: string
  summary: string
  takeaway: string
}

const KNOWLEDGE_TAGS = ['函数返回值', 'return 语句', '函数调用', '程序设计基础']

function formatDurationText(seconds: number | undefined) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0))
  if (safeSeconds < 60) return `${safeSeconds}秒`
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`
}

function formatDateText(value: string | undefined) {
  if (!value) return '最近更新'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLessonTitle(video: VideoInfo | null) {
  return video?.title || '函数返回值：像自动售货机一样'
}

function getAssistantStatus(memory: MemoryState) {
  if (memory.status === 'loading') return '正在学习当前视频'
  if (memory.status === 'error') return '视频记忆加载失败'
  if (memory.status === 'ready') return `在线 · 已学习《${memory.title || '当前视频'}》`
  return '在线 · 等待选择视频'
}

function buildOpeningMessages(video: VideoInfo): AssistantMessage[] {
  const title = getLessonTitle(video)
  return [
    {
      role: 'assistant',
      content: `你好！我是你的 AI 助教小思\n\n你刚刚学习了《${title}》，对这个知识点还有哪些疑问呢？我可以帮你复盘重点。`,
    },
  ]
}

function buildLessonSummary(video: VideoInfo | null) {
  const title = getLessonTitle(video)

  if (title.includes('返回') || title.toLowerCase().includes('return')) {
    return `本节视频围绕《${title}》展开，重点解释 return 的作用、返回值和输出的区别，以及函数调用后结果如何被继续使用。`
  }

  if (title.includes('循环') || title.includes('遍历')) {
    return `本节视频围绕《${title}》展开，重点解释循环结构的执行方式、适用场景以及循环中最容易出错的边界条件。`
  }

  return `本节视频围绕《${title}》展开，会从概念、案例和易错点三个层次帮你建立完整理解。`
}

function buildKnowledgePoints(video: VideoInfo | null): KnowledgePoint[] {
  const title = getLessonTitle(video)

  if (title.includes('返回') || title.toLowerCase().includes('return')) {
    return [
      {
        title: '返回值的职责',
        summary: 'return 用来把函数内部的处理结果交回调用方，它不是展示结果，而是传递结果。',
        takeaway: '先问“结果要给谁用”，再决定是否需要 return。',
      },
      {
        title: 'return 和 print 的区别',
        summary: 'print 负责显示，return 负责返回。一个偏输出，一个偏数据流转。',
        takeaway: '能参与后续计算的是 return，不是 print。',
      },
      {
        title: '多返回值的接收方式',
        summary: 'Python 可以一次返回多个值，实质上通常是返回一个元组，再由调用方解包。',
        takeaway: '看到多个返回值，优先检查接收变量的结构是否对应。',
      },
    ]
  }

  return KNOWLEDGE_TAGS.slice(0, 3).map((tag, index) => ({
    title: tag,
    summary: `围绕《${title}》拆出的第 ${index + 1} 个核心知识点，适合先理解定义，再结合一个简短案例消化。`,
    takeaway: '先记住一句话结论，再回到视频对应片段复看。',
  }))
}

function buildDefaultNote(video: VideoInfo | null, knowledgePoints: KnowledgePoint[]) {
  return [
    `主题：${getLessonTitle(video)}`,
    '',
    '本节课我先记住三件事：',
    ...knowledgePoints.slice(0, 3).map((item, index) => `${index + 1}. ${item.title}：${item.takeaway}`),
  ].join('\n')
}

function buildVideoSuggestions(video: VideoInfo | null) {
  const title = getLessonTitle(video)
  const lowerTitle = title.toLowerCase()

  if (title.includes('返回') || lowerTitle.includes('return')) {
    return [
      'return 和 print 有什么区别？',
      '函数没有 return 会怎样？',
      '如何返回多个值？',
    ]
  }

  if (title.includes('循环') || title.includes('遍历')) {
    return [
      'for 循环和 while 循环怎么选？',
      '循环什么时候会无限执行？',
      '能给我一道循环练习吗？',
    ]
  }

  return [
    `《${title}》的核心重点是什么？`,
    '这节课有哪些常见错误？',
    '能给我出一道练习题吗？',
  ]
}

function buildContextSuggestions(context: string) {
  const lower = context.toLowerCase()

  if (context.includes('return') || context.includes('返回')) {
    return [
      '能用一段代码演示 return 吗？',
      'return 后面的代码还会执行吗？',
      '返回值怎么参与下一步计算？',
    ]
  }

  if (context.includes('print') || context.includes('输出')) {
    return [
      'print 只负责显示结果吗？',
      '什么时候该用 print 调试？',
      'return 和 print 能同时用吗？',
    ]
  }

  if (context.includes('多个') || context.includes('多值')) {
    return [
      '多个返回值本质是什么？',
      '如何接收多个返回值？',
      '返回列表和返回多个值有什么区别？',
    ]
  }

  if (lower.includes('why') || context.includes('为什么') || context.includes('不懂')) {
    return [
      '能换个生活化例子解释吗？',
      '这个点考试会怎么考？',
      '我应该先记住哪句话？',
    ]
  }

  return [
    '能总结成三条重点吗？',
    '给我一道类似练习题',
    '这个知识点容易错在哪里？',
  ]
}

export default function VideoPage() {
  const router = useRouter()
  const [videos, setVideos] = useState<VideoInfo[]>([])
  const [selected, setSelected] = useState<VideoInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingArtifactId, setDownloadingArtifactId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [detailTab, setDetailTab] = useState<VideoDetailTab>('intro')
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const [learningNotes, setLearningNotes] = useState<LearningNote[]>([])
  const [memory, setMemory] = useState<MemoryState>({
    id: null,
    title: '',
    status: 'idle',
    error: '',
  })

  const chatScrollRef = useRef<HTMLDivElement>(null)

  const selectedIndex = useMemo(() => {
    if (!selected) return 0
    const index = videos.findIndex((video) => video.id === selected.id)
    return index >= 0 ? index : 0
  }, [selected, videos])

  const progressPercent = videos.length ? Math.round(((selectedIndex + 1) / videos.length) * 100) : 0
  const watchedPercent = Math.max(12, Math.min(92, progressPercent))
  const lessonTitle = getLessonTitle(selected)
  const lessonSummary = useMemo(() => buildLessonSummary(selected), [selected])
  const knowledgePoints = useMemo(() => buildKnowledgePoints(selected), [selected])
  const relatedNotes = useMemo(() => {
    if (!selected) return []
    return learningNotes
      .filter((note) => note.source.id === selected.id || note.source.title === selected.title)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [learningNotes, selected])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getVideos()
      setVideos(data)
      setSelected((current) => {
        if (current && data.some((video) => video.id === current.id)) return current
        return data[0] || null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '视频列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const refreshNotes = () => setLearningNotes(readLearningNotes())
    refreshNotes()
    window.addEventListener('learning-notes-updated', refreshNotes)
    return () => window.removeEventListener('learning-notes-updated', refreshNotes)
  }, [])

  useEffect(() => {
    if (!selected) {
      setMemory({ id: null, title: '', status: 'idle', error: '' })
      setMessages([])
      setSuggestions([])
      return
    }

    let alive = true
    setDetailTab('intro')
    setNoteSaved(false)
    setNoteDraft(buildDefaultNote(selected, buildKnowledgePoints(selected)))
    setMemory({ id: null, title: selected.title, status: 'loading', error: '' })
    setMessages(buildOpeningMessages(selected))
    setSuggestions(buildVideoSuggestions(selected))

    api.loadMemory(selected.id)
      .then((result) => {
        if (!alive) return
        setMemory({
          id: result.memory_id,
          title: result.video_title || selected.title,
          status: 'ready',
          error: '',
        })
      })
      .catch((err) => {
        if (!alive) return
        setMemory({
          id: null,
          title: selected.title,
          status: 'error',
          error: err instanceof Error ? err.message : '视频记忆加载失败',
        })
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: '我暂时还没读取到这节课的记忆，你仍然可以先观看视频内容。',
          },
        ])
      })

    return () => {
      alive = false
    }
  }, [selected])

  useEffect(() => {
    if (!chatScrollRef.current) return
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [messages, sending])

  function handleSaveNote() {
    if (!selected) return
    const content = noteDraft.trim()
    if (!content) return

    const now = new Date().toISOString()
    const nextNote: LearningNote = {
      id: `video-note-${selected.id}-${Date.now()}`,
      title: `${selected.title} 学习笔记`,
      content,
      source: {
        type: 'resource',
        id: selected.id,
        title: selected.title,
        href: '/video',
      },
      tags: knowledgePoints.map((item) => item.title),
      personalizationEnabled: true,
      createdAt: now,
      updatedAt: now,
    }

    writeLearningNotes([nextNote, ...learningNotes])
    setNoteSaved(true)
    window.setTimeout(() => setNoteSaved(false), 1800)
  }

  async function handleDelete(video: VideoInfo) {
    const confirmed = window.confirm(`确定删除“${video.title}”吗？删除后会清理视频、音频、字幕和时间轴文件。`)
    if (!confirmed) return

    try {
      setDeletingId(video.id)
      await api.deleteVideoResource(video.id)
      const next = videos.filter((item) => item.id !== video.id)
      setVideos(next)
      if (selected?.id === video.id) {
        setSelected(next[0] || null)
        if (memory.id) {
          api.deleteMemory(memory.id).catch(() => {})
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDownloadVideo(video: VideoInfo) {
    if (downloadingArtifactId === video.id) return

    try {
      setDownloadingArtifactId(video.id)
      setDownloadError('')
      await api.downloadVideoArtifact(video.id, 'mp4')
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : '视频下载失败')
    } finally {
      setDownloadingArtifactId(null)
    }
  }

  async function handleShare(video: VideoInfo) {
    const link = video.shareUrl || video.sceneUrl || video.url
    if (!link) return

    try {
      await navigator.clipboard?.writeText(link)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1800)
    } catch {
      setShareCopied(false)
    }
  }

  async function handleSend(text = input) {
    const content = text.trim()
    if (!content || sending || !memory.id) return

    const history = messages.map((message) => ({ role: message.role, content: message.content }))
    setInput('')
    setSending(true)
    setSuggestions(buildContextSuggestions(content))
    setMessages((current) => [...current, { role: 'user', content }, { role: 'assistant', content: '' }])

    let streamed = ''
    try {
      const fullText = await api.chatWithDigitalHuman(memory.id, content, history, (evt) => {
        if (evt.type !== 'token' && evt.type !== 'text') return
        const chunk = String(evt.payload.text || evt.payload.content || '')
        if (!chunk) return
        streamed += chunk
        setMessages((current) => {
          const next = [...current]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + chunk }
          }
          return next
        })
      })

      const answer = streamed || fullText || '我已经收到你的问题，我们继续拆解这节课。'
      if (!streamed) {
        setMessages((current) => {
          const next = [...current]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: answer }
          }
          return next
        })
      }
      setSuggestions(buildContextSuggestions(`${content}\n${answer}`))
    } catch (err) {
      setMessages((current) => {
        const next = [...current]
        const last = next[next.length - 1]
        const errorText = err instanceof Error ? err.message : '对话失败，请稍后重试'
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, content: errorText }
        }
        return next
      })
    } finally {
      setSending(false)
    }
  }

  const assistantPanel = (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border border-[#dbe7f8] bg-white shadow-[0_18px_60px_rgba(37,99,235,0.10)]">
      <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#edf2f8] bg-white px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[#eef5ff] text-blue">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-bold text-ink">数字人陪学</h2>
            <p className="mt-0.5 truncate text-[12px] text-muted">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green align-middle" />
              {getAssistantStatus(memory)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="grid h-9 w-9 place-items-center rounded-[8px] text-[#1f2f4a] hover:bg-[#f2f6fb]" aria-label="刷新陪学状态">
            <RotateCw className="h-4 w-4" />
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-[8px] text-[#1f2f4a] hover:bg-[#f2f6fb]" aria-label="更多陪学选项">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative h-[292px] shrink-0 overflow-hidden bg-[linear-gradient(135deg,#f6fbff_0%,#eaf4ff_55%,#dcecff_100%)]">
        <div className="absolute left-6 top-10 z-10 grid h-8 w-8 place-items-center rounded-[8px] border border-white bg-white/80 text-blue shadow-sm">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="absolute right-8 top-12 z-10 grid h-9 w-9 place-items-center rounded-[10px] border border-white bg-white/80 text-blue shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="absolute bottom-11 left-8 z-10 grid h-8 w-8 place-items-center rounded-[8px] border border-white bg-white/80 text-blue shadow-sm">
          <Layers className="h-4 w-4" />
        </div>
        <iframe
          src="/dh-live/index.html"
          title="数字人陪学"
          allow="autoplay"
          className="relative z-0 h-full w-full border-0 bg-transparent"
        />
      </div>

      <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[88%] whitespace-pre-line rounded-[8px] px-3 py-2 text-[13px] leading-6 shadow-sm',
                message.role === 'user'
                  ? 'bg-blue text-white'
                  : 'border border-[#e7eef7] bg-[#f8fbff] text-[#26364f]',
              )}
            >
              {message.content || (
                <span className="inline-flex items-center gap-1 text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  思考中
                </span>
              )}
            </div>
          </div>
        ))}
        {memory.status === 'error' && (
          <div className="rounded-[8px] border border-red/20 bg-red-light px-3 py-2 text-[12px] text-red">
            {memory.error}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[#edf2f8] px-5 pb-4 pt-3">
        <div className="mb-3 max-h-[132px] overflow-y-auto pr-1">
          <div className="flex flex-col gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSend(suggestion)}
                disabled={!memory.id || sending}
                className="w-full rounded-[8px] border border-[#dbe7f8] bg-white px-3 py-2 text-left text-[12px] font-medium text-blue transition hover:bg-blue-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#7a8aa3] hover:bg-[#f2f6fb] hover:text-blue"
            aria-label="语音输入"
          >
            <Mic className="h-5 w-5" />
          </button>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleSend()
              }
            }}
            disabled={!memory.id || sending}
            placeholder={memory.status === 'loading' ? '正在读取视频内容...' : '请输入你的问题...'}
            className="h-11 min-w-0 flex-1 rounded-full border border-[#dce6f3] bg-[#f9fbfe] px-4 text-[13px] text-ink outline-none transition placeholder:text-[#a0adc0] focus:border-blue focus:bg-white focus:ring-4 focus:ring-blue/10 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || !memory.id || sending}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition hover:bg-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="发送问题"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-[#a0adc0]">内容由 AI 生成，仅供参考</p>
      </div>
    </Card>
  )

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-44 rounded-[8px]" />
        <div className="grid min-h-[680px] grid-cols-[260px_minmax(0,1fr)_360px] gap-5 max-[1280px]:grid-cols-[240px_minmax(0,1fr)] max-[920px]:grid-cols-1">
          <Skeleton className="h-full rounded-[8px]" />
          <Skeleton className="h-full rounded-[8px]" />
          <Skeleton className="h-full rounded-[8px] max-[1280px]:hidden" />
        </div>
      </div>
    )
  }

  if (error) return <ErrorState type="server" description={error} onRetry={fetchData} />

  return (
    <div className="min-h-[calc(100vh-112px)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-[#64748b]">
            <Link href="/" className="font-medium hover:text-blue">SparkLearn</Link>
            <span>/</span>
            <Link href="/generate?view=library" className="font-medium hover:text-blue">视频资源</Link>
            <span>/</span>
            <span>函数进阶</span>
            <span>/</span>
            <span className="font-bold text-ink">视频播放</span>
          </div>
          <h1 className="text-[28px] font-bold leading-tight text-ink">视频播放</h1>
          <p className="mt-2 text-[15px] text-[#52627b]">观看课程视频，和数字人一起复盘讲解内容。</p>
        </div>
        <Button size="sm" variant="secondary" onClick={fetchData}>
          <RotateCw className="h-4 w-4" />
          刷新列表
        </Button>
      </div>

      {downloadError && (
        <div className="mb-4 rounded-[8px] border border-red-200 bg-red-light px-4 py-3 text-small text-red">
          {downloadError}
        </div>
      )}

      {videos.length === 0 ? (
        <EmptyState
          type="resources"
          title="还没有视频"
          description="前往资源生成页面创建视频"
          action={{ label: '去生成', href: '/generate' }}
        />
      ) : (
        <div className="grid h-[calc(100vh-180px)] min-h-[720px] grid-cols-[260px_minmax(0,1fr)_360px] gap-5 max-[1280px]:grid-cols-[250px_minmax(0,1fr)] max-[920px]:h-auto max-[920px]:min-h-0 max-[920px]:grid-cols-1">
          <Card className="flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-[#dde8f6] bg-white/94 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#edf2f8] px-5">
              <h2 className="text-[15px] font-bold text-ink">全部视频 ({videos.length})</h2>
              <button className="grid h-9 w-9 place-items-center rounded-[8px] text-[#52627b] hover:bg-[#f3f7fc]" aria-label="切换视频列表视图">
                <List className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 max-[920px]:grid max-[920px]:max-h-[360px] max-[920px]:grid-cols-2 max-[640px]:grid-cols-1">
              {videos.map((video, index) => {
                const active = selected?.id === video.id
                const completed = index < selectedIndex
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => setSelected(video)}
                    className={cn(
                      'group w-full rounded-[8px] border p-3 text-left transition duration-200',
                      active
                        ? 'border-blue bg-[linear-gradient(135deg,#f7fbff,#eef5ff)] shadow-[0_12px_28px_rgba(37,99,235,0.14)]'
                        : 'border-transparent bg-white hover:border-[#dbe7f8] hover:bg-[#f8fbff]',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {active ? (
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue text-white shadow-[0_10px_22px_rgba(37,99,235,0.25)]">
                          <Play className="h-5 w-5 fill-current" />
                        </div>
                      ) : (
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-[#d9e3f1] bg-[#f8fbff] text-[#52627b]">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[14px] font-bold leading-5 text-ink">{video.title}</p>
                        <div className="mt-2 flex items-center gap-1 text-[12px] text-muted">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDurationText(video.duration)}
                        </div>
                      </div>
                      <div className="pt-6">
                        {completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green" />
                        ) : active ? (
                          <BarChart3 className="h-4 w-4 text-blue" />
                        ) : (
                          <Circle className="h-4 w-4 text-[#b7c4d6]" />
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="shrink-0 border-t border-[#edf2f8] p-4">
              <button className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-[#dbe7f8] bg-white text-[13px] font-bold text-[#334155] transition hover:bg-[#f8fbff]">
                全部展开
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </Card>

          <div className="min-w-0 overflow-y-auto pr-1 max-[920px]:overflow-visible max-[920px]:pr-0">
            {selected && (
              <div className="space-y-4">
                <Card className="overflow-hidden rounded-[8px] border border-[#dbe7f8] bg-white shadow-[0_20px_60px_rgba(37,99,235,0.10)]">
                  <div className="relative aspect-video overflow-hidden bg-[linear-gradient(135deg,#eaf6ff_0%,#dcecff_48%,#f8fbff_100%)]">
                    {selected.hasMp4 && selected.url ? (
                      <video src={selected.url} controls preload="metadata" className="h-full w-full bg-[#0b1220]" />
                    ) : selected.sceneUrl ? (
                      <iframe src={selected.sceneUrl} className="h-full w-full bg-white" title={`${selected.title} 场景预览`} />
                    ) : selected.url ? (
                      <video src={selected.url} controls preload="metadata" className="h-full w-full bg-[#0b1220]" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-8 text-center">
                        <div className="max-w-[560px]">
                          <div className="mb-5 text-[13px] font-bold text-blue">第 {selectedIndex + 1} 讲 · {String(selectedIndex + 1).padStart(2, '0')}/{String(videos.length).padStart(2, '0')}</div>
                          <h2 className="text-[32px] font-bold leading-tight text-ink max-[640px]:text-[24px]">{lessonTitle}</h2>
                          <p className="mt-4 text-[15px] text-[#52627b]">理解 return 的作用</p>
                          <div className="mx-auto mt-7 grid max-w-[520px] gap-3">
                            {KNOWLEDGE_TAGS.slice(0, 3).map((tag) => (
                              <div key={tag} className="rounded-[8px] bg-white/82 px-4 py-3 text-left text-[14px] font-semibold text-[#26364f] shadow-sm">
                                <span className="mr-2 text-blue">·</span>
                                {tag}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="rounded-[8px] border border-[#dbe7f8] bg-white p-5 shadow-[0_14px_44px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center rounded-[8px] bg-blue px-2.5 py-1 text-[12px] font-bold text-white">正在学习</span>
                      <h2 className="mt-3 text-[20px] font-bold text-ink">{selected?.title}</h2>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="text-[13px] text-muted">学习进度</span>
                        <div className="h-1.5 w-44 rounded-full bg-[#e7eef8]">
                          <div className="h-full rounded-full bg-blue" style={{ width: `${watchedPercent}%` }} />
                        </div>
                        <span className="text-[12px] font-medium text-[#64748b]">已学 {watchedPercent}%</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleDownloadVideo(selected)}
                        disabled={downloadingArtifactId === selected.id}
                      >
                        {downloadingArtifactId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {downloadingArtifactId === selected.id ? '下载中...' : '下载'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleShare(selected)}>
                        <Share2 className="h-4 w-4" />
                        {shareCopied ? '已复制' : '分享'}
                      </Button>
                      <Button size="sm" onClick={() => handleShare(selected)}>
                        <Bookmark className="h-4 w-4" />
                        收藏
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(selected)}
                        disabled={deletingId === selected.id}
                        className="text-red hover:bg-red-light hover:text-red"
                      >
                        {deletingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        删除
                      </Button>
                    </div>
                    <div className="flex w-full flex-nowrap gap-2 overflow-x-auto pb-1">
                      {KNOWLEDGE_TAGS.map((tag) => (
                        <span key={tag} className="shrink-0 rounded-[8px] bg-[#f2f6fb] px-3 py-1.5 text-[12px] font-medium text-[#52627b]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card className="rounded-[8px] border border-[#dbe7f8] bg-white shadow-[0_14px_44px_rgba(15,23,42,0.06)]">
                  <div className="flex gap-6 overflow-x-auto border-b border-[#edf2f8] px-5 pt-4 text-[14px] font-bold text-[#64748b]">
                    {[
                      { id: 'intro', label: '课程简介' },
                      { id: 'knowledge', label: `知识点 ${knowledgePoints.length}` },
                      { id: 'notes', label: `学习笔记 ${relatedNotes.length}` },
                      { id: 'practice', label: '相关练习' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDetailTab(tab.id as VideoDetailTab)}
                        className={cn(
                          'shrink-0 border-b-2 pb-3 transition',
                          detailTab === tab.id ? 'border-blue text-blue' : 'border-transparent hover:text-ink',
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="p-5">
                    {detailTab === 'intro' && (
                      <>
                        <p className="text-[14px] leading-7 text-[#334155]">{lessonSummary}</p>
                        <div className="mt-5 grid grid-cols-4 gap-4 border-t border-[#edf2f8] pt-5 text-[12px] text-[#52627b] max-[760px]:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue" />
                            <span>课程时长<br /><b className="font-bold text-ink">{formatDurationText(selected?.duration)}</b></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Gauge className="h-5 w-5 text-blue" />
                            <span>难度<br /><b className="font-bold text-ink">中等</b></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-blue" />
                            <span>适合年级<br /><b className="font-bold text-ink">初中及以上</b></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-blue" />
                            <span>更新时间<br /><b className="font-bold text-ink">{formatDateText(selected?.createdAt)}</b></span>
                          </div>
                        </div>
                      </>
                    )}

                    {detailTab === 'knowledge' && (
                      <div className="space-y-4">
                        {knowledgePoints.map((item, index) => (
                          <div key={item.title} className="rounded-[8px] border border-[#e6eef8] bg-[#f8fbff] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[13px] font-bold text-blue">知识点 {index + 1}</p>
                                <h3 className="mt-1 text-[16px] font-bold text-ink">{item.title}</h3>
                              </div>
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#64748b] shadow-sm">核心必会</span>
                            </div>
                            <p className="mt-3 text-[14px] leading-7 text-[#334155]">{item.summary}</p>
                            <div className="mt-3 rounded-[8px] border border-[#dbe7f8] bg-white px-3 py-2 text-[13px] text-[#52627b]">
                              一句话记忆：{item.takeaway}
                            </div>
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => router.push('/graph')}>
                            <BookOpen className="h-4 w-4" />
                            去知识图谱继续看
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setDetailTab('notes')}>
                            <NotebookPen className="h-4 w-4" />
                            记到学习笔记
                          </Button>
                        </div>
                      </div>
                    )}

                    {detailTab === 'notes' && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#dbe7f8] bg-[#f8fbff] p-4">
                          <div>
                            <h3 className="text-[16px] font-bold text-ink">本视频学习笔记</h3>
                            <p className="mt-1 text-[13px] text-[#64748b]">支持把当前视频的重点沉淀到本地学习笔记，后续可被 AI 辅导引用。</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => setNoteModalOpen(true)}>
                              <NotebookPen className="h-4 w-4" />
                              新建笔记
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setNoteDraft(buildDefaultNote(selected, knowledgePoints))}>
                              重置模板
                            </Button>
                          </div>
                        </div>

                        {relatedNotes.length > 0 ? (
                          <div className="space-y-3">
                            {relatedNotes.slice(0, 3).map((note) => (
                              <div key={note.id} className="rounded-[8px] border border-[#e6eef8] bg-white p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <h4 className="text-[14px] font-bold text-ink">{note.title}</h4>
                                  <span className="text-[11px] text-[#94a3b8]">{formatDateText(note.updatedAt)}</span>
                                </div>
                                <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-[#475569]">
                                  {note.content.length > 180 ? `${note.content.slice(0, 180)}...` : note.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-[8px] border border-dashed border-[#cbdcf4] bg-white px-4 py-6 text-[13px] text-[#64748b]">
                            这节视频还没有正式学习笔记。可以直接点“新建笔记”，系统会先带出一份按知识点生成的模板。
                          </div>
                        )}
                      </div>
                    )}

                    {detailTab === 'practice' && (
                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-[8px] border border-[#e6eef8] bg-[#f8fbff] p-4">
                            <h3 className="text-[15px] font-bold text-ink">进入练习评测</h3>
                            <p className="mt-2 text-[13px] leading-6 text-[#52627b]">去做配套题，系统会记录正确率和掌握度变化。</p>
                            <Button size="sm" className="mt-4" onClick={() => router.push('/practice')}>
                              <ExternalLink className="h-4 w-4" />
                              去做练习
                            </Button>
                          </div>
                          <div className="rounded-[8px] border border-[#e6eef8] bg-white p-4">
                            <h3 className="text-[15px] font-bold text-ink">查看错题本</h3>
                            <p className="mt-2 text-[13px] leading-6 text-[#52627b]">如果这类知识点经常出错，可以直接回看已有错题。</p>
                            <Button size="sm" variant="secondary" className="mt-4" onClick={() => router.push('/practice/mistakes')}>
                              <ExternalLink className="h-4 w-4" />
                              打开错题本
                            </Button>
                          </div>
                          <div className="rounded-[8px] border border-[#e6eef8] bg-white p-4">
                            <h3 className="text-[15px] font-bold text-ink">答题记录</h3>
                            <p className="mt-2 text-[13px] leading-6 text-[#52627b]">查看最近练习结果，确认这节课的知识点是否已经吃透。</p>
                            <Button size="sm" variant="secondary" className="mt-4" onClick={() => router.push('/practice/records')}>
                              <ExternalLink className="h-4 w-4" />
                              查看记录
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-[8px] border border-[#dbe7f8] bg-[#f8fbff] p-4">
                          <h3 className="text-[15px] font-bold text-ink">建议先练这几个方向</h3>
                          <div className="mt-3 space-y-2 text-[13px] leading-6 text-[#475569]">
                            {knowledgePoints.map((item) => (
                              <div key={item.title} className="flex items-start gap-2">
                                <span className="mt-1 text-blue">•</span>
                                <span>{item.title}：围绕这个知识点各做 1 到 2 道短题，先验证概念，再验证迁移能力。</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {false && (
                <Card className="rounded-[8px] border border-[#dbe7f8] bg-white shadow-[0_14px_44px_rgba(15,23,42,0.06)]">
                  <div className="flex gap-8 border-b border-[#edf2f8] px-5 pt-4 text-[14px] font-bold text-[#64748b]">
                    {['课程简介', '知识点', '学习笔记', '相关练习'].map((tab, index) => (
                      <button key={tab} className={cn('border-b-2 pb-3 transition', index === 0 ? 'border-blue text-blue' : 'border-transparent hover:text-ink')}>
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div className="p-5">
                    <p className="text-[14px] leading-7 text-[#334155]">
                      本节课通过自动售货机的类比，帮助你理解函数返回值的概念和作用。我们将学习如何使用 return 语句将处理结果返回给调用者，以及在不同场景下的应用方式。
                    </p>
                    <button className="mt-2 text-[13px] font-bold text-blue hover:text-blue-dark">展开全部</button>
                    <div className="mt-5 grid grid-cols-4 gap-4 border-t border-[#edf2f8] pt-5 text-[12px] text-[#52627b] max-[760px]:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue" />
                        <span>课程时长<br /><b className="font-bold text-ink">{formatDurationText(selected?.duration)}</b></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Gauge className="h-5 w-5 text-blue" />
                        <span>难度<br /><b className="font-bold text-ink">中等</b></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-blue" />
                        <span>适合年级<br /><b className="font-bold text-ink">初中及以上</b></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-blue" />
                        <span>更新时间<br /><b className="font-bold text-ink">{formatDateText(selected?.createdAt)}</b></span>
                      </div>
                    </div>
                  </div>
                </Card>
                )}
              </div>
            )}
          </div>

          <div className="min-h-0 max-[1280px]:hidden">{assistantPanel}</div>

          <div className="fixed bottom-24 right-5 z-[80] hidden max-[1280px]:block">
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="grid h-14 w-14 place-items-center rounded-full bg-blue text-white shadow-[0_14px_30px_rgba(37,99,235,0.35)] transition hover:bg-blue-dark"
              aria-label="打开数字人陪学"
            >
              <MessageCircle className="h-6 w-6" />
            </button>
          </div>

          {assistantOpen && (
            <div className="fixed inset-0 z-[100] bg-[#0f172a]/60 p-4 backdrop-blur-sm">
              <div className="ml-auto flex h-full w-full max-w-[420px] flex-col">
                <button
                  type="button"
                  onClick={() => setAssistantOpen(false)}
                  className="mb-3 ml-auto grid h-10 w-10 place-items-center rounded-full bg-white text-[#334155] shadow-lg"
                  aria-label="关闭数字人陪学"
                >
                  <X className="h-5 w-5" />
                </button>
                {assistantPanel}
              </div>
            </div>
          )}

          {noteModalOpen && selected && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0f172a]/55 p-4 backdrop-blur-sm">
              <div className="w-full max-w-[760px] rounded-[12px] border border-[#dbe7f8] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                <div className="flex items-center justify-between border-b border-[#edf2f8] px-5 py-4">
                  <div>
                    <h3 className="text-[18px] font-bold text-ink">学习笔记</h3>
                    <p className="mt-1 text-[13px] text-[#64748b]">当前视频：{selected?.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNoteModalOpen(false)}
                    className="grid h-10 w-10 place-items-center rounded-full text-[#64748b] transition hover:bg-[#f3f7fc] hover:text-ink"
                    aria-label="关闭学习笔记"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="px-5 py-4">
                  <textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    className="min-h-[260px] w-full rounded-[8px] border border-[#dbe7f8] bg-[#fbfdff] px-4 py-3 text-[14px] leading-7 text-ink outline-none transition focus:border-blue focus:bg-white focus:ring-4 focus:ring-blue/10"
                    placeholder="记录你的理解、疑问和例题总结"
                  />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[12px] text-[#94a3b8]">保存后会写入本地学习笔记，供后续 AI 辅导引用。</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setNoteDraft(buildDefaultNote(selected, knowledgePoints))}>
                        重置模板
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveNote}
                        disabled={!noteDraft.trim()}
                      >
                        <NotebookPen className="h-4 w-4" />
                        保存笔记
                      </Button>
                    </div>
                  </div>
                  {noteSaved && <p className="mt-3 text-[12px] font-medium text-green">学习笔记已保存。</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
