'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AgentPet, AgentTask, AgentTaskStep, NanobotStatus, api } from '@/lib/api'
import { ProtoCard, SoftCard } from '@/components/proto'
import { Bookmark, ExternalLink, FileText, GitCompare, Loader2, Mic, MicOff, Pause, Search, Send, ThumbsDown, ThumbsUp, Volume2 } from 'lucide-react'
import { PetAvatar, PetState, PetType, taskStatusToPetState } from './PetAvatar'

type SpeechRecognitionConstructor = new () => {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type AgentResultItem = {
  title?: string
  summary?: string
  url?: string
  source?: string
  reason?: string
  explanation?: string
}

type AgentResultPayload = {
  items?: AgentResultItem[]
  topic?: string
  key_points?: string[]
  conclusion?: string
  comparison?: string
}

type BrowserWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const TASK_TYPE_OPTIONS = [
  { id: 'search', label: '资料检索', icon: <Search className="h-3.5 w-3.5" />, placeholder: '例如：帮我找适合初学者理解 Python 装饰器的资料，并说明先看哪一个' },
  { id: 'summarize', label: '内容摘要', icon: <FileText className="h-3.5 w-3.5" />, placeholder: '粘贴一段文章、笔记或链接，让学伴提炼要点和下一步建议' },
  { id: 'compare', label: '概念对比', icon: <GitCompare className="h-3.5 w-3.5" />, placeholder: '例如：对比 Python 生成器和列表推导式，说明适用场景' },
]

interface ChatMessage {
  id: string
  sender: 'user' | 'agent'
  content: string
  task?: AgentTask
  timestamp: string
}

export function AgentChat({
  pet,
  nanobot,
  onXpChange,
  onStateChange,
}: {
  pet: AgentPet
  nanobot?: NanobotStatus | null
  onXpChange: () => void
  onStateChange?: (state: PetState, statusText?: string) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      content: `我是 ${pet.name}。请给我一个具体学习任务，例如检索资料、总结内容或对比概念。`,
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [taskType, setTaskType] = useState('search')
  const [polling, setPolling] = useState(false)
  const [steps, setSteps] = useState<AgentTaskStep[]>([])
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null)
  const [ttsLoading, setTtsLoading] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const msgCounter = useRef(0)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsBlobUrlRef = useRef<string | null>(null)
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null)
  const voiceBaseRef = useRef('')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, steps])

  useEffect(() => () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (ttsAudioRef.current) ttsAudioRef.current.pause()
    if (ttsBlobUrlRef.current) URL.revokeObjectURL(ttsBlobUrlRef.current)
    recognitionRef.current?.stop()
  }, [])

  const playTts = useCallback(async (msgId: string, text: string) => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current = null
    }
    if (ttsBlobUrlRef.current) {
      URL.revokeObjectURL(ttsBlobUrlRef.current)
      ttsBlobUrlRef.current = null
    }
    if (playingMsgId === msgId) {
      setPlayingMsgId(null)
      return
    }

    setTtsLoading(msgId)
    try {
      const blob = await api.synthesizeSpeech(text.replace(/[#*`>\-|[\]()]/g, '').slice(0, 1600))
      const url = URL.createObjectURL(blob)
      ttsBlobUrlRef.current = url
      const audio = new Audio(url)
      ttsAudioRef.current = audio
      audio.addEventListener('ended', () => setPlayingMsgId(null))
      await audio.play()
      setPlayingMsgId(msgId)
    } finally {
      setTtsLoading(null)
    }
  }, [playingMsgId])

  const toggleVoiceInput = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }

    const browserWindow = window as BrowserWithSpeech
    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, {
        id: `voice-${++msgCounter.current}`,
        sender: 'agent',
        content: '当前环境不支持语音输入，请使用文本输入继续。',
        timestamp: new Date().toISOString(),
      }])
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    voiceBaseRef.current = input
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(voiceBaseRef.current ? `${voiceBaseRef.current}${transcript}` : transcript)
    }
    recognition.onend = () => setRecording(false)
    recognition.onerror = () => setRecording(false)
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }, [input, recording])

  async function handleSend() {
    const text = input.trim()
    if (!text || polling) return

    if (text.length < 6) {
      setMessages(prev => [...prev, {
        id: `guard-${++msgCounter.current}`,
        sender: 'agent',
        content: '任务描述太短。请补充学习目标、当前基础或希望得到的结果。',
        timestamp: new Date().toISOString(),
      }])
      return
    }

    if (!pet.unlocked_abilities.includes(taskType)) {
      setMessages(prev => [...prev, {
        id: `locked-${++msgCounter.current}`,
        sender: 'agent',
        content: '该能力尚未解锁。先完成当前等级可用任务，升级后再使用。',
        timestamp: new Date().toISOString(),
      }])
      return
    }

    setMessages(prev => [...prev, {
      id: `user-${++msgCounter.current}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }])
    setInput('')
    setPolling(true)
    setSteps([])
    onStateChange?.('thinking', nanobot?.healthy ? '正在调用本机 Nanobot 学伴内核。' : 'Nanobot 不在线，准备使用备用能力。')

    try {
      const result = await api.createAgentTask({ task_type: taskType, input_text: text })
      let handled = false
      pollingRef.current = setInterval(async () => {
        if (handled) return
        try {
          const task = await api.getAgentTask(result.task_id)
          setSteps(task.steps || [])
          onStateChange?.(taskStatusToPetState(task.status, task.task_type), latestStepText(task.steps))

          if (task.status === 'completed' || task.status === 'failed') {
            handled = true
            if (pollingRef.current) clearInterval(pollingRef.current)
            pollingRef.current = null
            setPolling(false)
            setSteps([])
            setMessages(prev => [...prev, {
              id: `agent-${++msgCounter.current}`,
              sender: 'agent',
              content: task.status === 'completed' ? formatResult(task) : task.error_message || '任务执行失败，请稍后重试。',
              task: task.status === 'completed' ? task : undefined,
              timestamp: new Date().toISOString(),
            }])
            onStateChange?.(task.status === 'completed' ? 'success' : 'failed')
            if (task.status === 'completed') onXpChange()
          }
        } catch {
          // Keep polling; transient backend errors are common during startup.
        }
      }, 1600)
    } catch (error: unknown) {
      setPolling(false)
      onStateChange?.('failed', '任务未能创建。')
      setMessages(prev => [...prev, {
        id: `err-${++msgCounter.current}`,
        sender: 'agent',
        content: error instanceof Error ? error.message : '任务创建失败，请确认后端服务可用。',
        timestamp: new Date().toISOString(),
      }])
    }
  }

  async function handleFeedback(taskId: string, feedback: 'useful' | 'not_useful') {
    await api.submitAgentFeedback(taskId, feedback)
    setMessages(prev => prev.map(m => m.task?.task_id === taskId ? { ...m, task: { ...m.task, feedback } } : m))
  }

  async function handleBookmark(task: AgentTask, item: AgentResultItem, index: number) {
    await api.bookmarkAgentResult({
      task_id: task.task_id,
      item_index: index,
      title: item.title || item.source || '学伴结果',
      url: item.url || '',
      summary: item.summary || item.explanation || item.reason || '',
    })
    setMessages(prev => [...prev, {
      id: `bookmark-${++msgCounter.current}`,
      sender: 'agent',
      content: `已收藏「${item.title || item.source || '学伴结果'}」到知识库。`,
      timestamp: new Date().toISOString(),
    }])
  }

  return (
    <ProtoCard className="flex h-[calc(100vh-220px)] min-h-[560px] flex-col p-0">
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">任务对话</h2>
            <p className="mt-1 text-small text-muted">一次只处理一个明确任务，结果会沉淀到任务记录。</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TASK_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setTaskType(opt.id)}
                disabled={!pet.unlocked_abilities.includes(opt.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-micro font-bold transition-colors ${
                  taskType === opt.id ? 'bg-blue text-white' : 'bg-[#f2f6fb] text-muted hover:bg-[#e9f0f8]'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[86%]">
              {msg.sender === 'agent' && (
                <div className="mb-1.5 flex items-center gap-2">
                  <PetAvatar type={pet.avatar as PetType} state="idle" size="sm" />
                  <span className="text-micro font-bold text-muted">{pet.name}</span>
                </div>
              )}
              <div className={`rounded-[12px] px-4 py-3 text-small leading-6 ${
                msg.sender === 'user' ? 'bg-blue text-white' : 'bg-[#f3f7fb] text-ink'
              }`}>
                {msg.content}
              </div>

              {msg.sender === 'agent' && (
                <button
                  onClick={() => void playTts(msg.id, msg.content)}
                  disabled={ttsLoading === msg.id}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-micro font-bold text-muted hover:bg-blue-light hover:text-blue disabled:opacity-50"
                >
                  {ttsLoading === msg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : playingMsgId === msg.id ? <Pause className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  {playingMsgId === msg.id ? '暂停' : '朗读'}
                </button>
              )}

              {msg.task?.result && (
                <div className="mt-2 space-y-2">
                  <TaskResultView task={msg.task} onBookmark={handleBookmark} />
                  {!msg.task.feedback ? (
                    <div className="flex items-center gap-2 text-micro text-muted">
                      <span>结果是否有帮助</span>
                      <button aria-label="结果有帮助" onClick={() => void handleFeedback(msg.task!.task_id, 'useful')} className="rounded p-1 hover:bg-green-light hover:text-green"><ThumbsUp className="h-3.5 w-3.5" /></button>
                      <button aria-label="结果没有帮助" onClick={() => void handleFeedback(msg.task!.task_id, 'not_useful')} className="rounded p-1 hover:bg-red-light hover:text-red"><ThumbsDown className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="text-micro text-muted">反馈已记录</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {polling && (
          <div className="flex justify-start">
            <div className="max-w-[86%]">
              <div className="mb-1.5 flex items-center gap-2">
                <PetAvatar type={pet.avatar as PetType} state="searching" size="sm" />
                <span className="text-micro font-bold text-muted">{pet.name}</span>
              </div>
              <div className="rounded-[12px] bg-[#f3f7fb] px-4 py-3">
                <div className="flex items-center gap-2 text-small font-bold text-ink">
                  <Loader2 className="h-4 w-4 animate-spin text-blue" />
                  正在处理任务
                </div>
                {steps.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {steps.slice(-4).map(step => (
                      <div key={`${step.step}-${step.action}`} className="text-micro leading-5 text-muted">
                        {step.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={e => { e.preventDefault(); void handleSend() }} className="border-t border-line p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={TASK_TYPE_OPTIONS.find(o => o.id === taskType)?.placeholder}
            disabled={polling}
            maxLength={240}
            className="h-11 min-w-0 flex-1 rounded-[10px] border border-line px-4 text-small text-ink outline-none transition focus:border-blue focus:ring-2 focus:ring-[#bfdbfe] disabled:bg-[#f8fafc]"
          />
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] transition-colors ${recording ? 'bg-red text-white' : 'bg-[#f2f6fb] text-muted hover:bg-[#e9f0f8] hover:text-ink'}`}
            aria-label={recording ? '停止语音输入' : '语音输入'}
          >
            {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="submit"
            disabled={!input.trim() || polling}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-blue text-white transition-colors hover:bg-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="发送任务"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </ProtoCard>
  )
}

function latestStepText(steps?: AgentTaskStep[]) {
  if (!steps || steps.length === 0) return undefined
  return steps[steps.length - 1].description
}

function formatResult(task: AgentTask): string {
  if (!task.result) return '任务完成，但没有返回可展示的结果。'
  if (task.task_type === 'search' && 'items' in task.result) return `找到 ${task.result.items?.length || 0} 条可用学习资料。`
  if (task.task_type === 'summarize' && 'topic' in task.result) return '摘要已生成，请查看要点和建议。'
  if (task.task_type === 'compare' && 'items' in task.result) return '对比分析已完成，请查看不同视角。'
  return '任务已完成。'
}

function TaskResultView({ task, onBookmark }: { task: AgentTask; onBookmark: (task: AgentTask, item: AgentResultItem, index: number) => void }) {
  const result = task.result as AgentResultPayload | null
  if (!result) return null

  if ((task.task_type === 'search' || task.task_type === 'recommend') && result.items) {
    return (
      <div className="space-y-2">
        {result.items.map((item, index) => (
          <SoftCard key={index} className="bg-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-small font-bold text-ink">{item.title}</div>
                <p className="mt-1 line-clamp-2 text-micro leading-5 text-muted">{item.summary || item.reason}</p>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-micro font-bold text-blue hover:underline">
                    <ExternalLink className="h-3 w-3" />查看来源
                  </a>
                )}
              </div>
              <button onClick={() => void onBookmark(task, item, index)} className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-muted hover:bg-blue-light hover:text-blue" aria-label="收藏结果">
                <Bookmark className="h-4 w-4" />
              </button>
            </div>
          </SoftCard>
        ))}
      </div>
    )
  }

  if (task.task_type === 'summarize' && result.topic) {
    return (
      <SoftCard className="bg-white">
        <div className="text-small font-bold text-ink">{result.topic}</div>
        <ul className="mt-2 space-y-1">
          {(result.key_points || []).map((point: string, index: number) => (
            <li key={index} className="text-micro leading-5 text-muted">• {point}</li>
          ))}
        </ul>
        {result.conclusion && <div className="mt-2 border-t border-line pt-2 text-micro leading-5 text-muted">{result.conclusion}</div>}
      </SoftCard>
    )
  }

  if (task.task_type === 'compare' && result.items) {
    return (
      <div className="space-y-2">
        {result.items.map((item, index) => (
          <SoftCard key={index} className="bg-white">
            <div className="text-micro font-bold text-blue">{item.source || `视角 ${index + 1}`}</div>
            <p className="mt-1 text-micro leading-5 text-muted">{item.explanation}</p>
          </SoftCard>
        ))}
        {result.comparison && <div className="rounded-[8px] bg-orange-light p-3 text-micro leading-5 text-orange">{result.comparison}</div>}
      </div>
    )
  }

  return null
}
