'use client'

import { useState, useRef, useEffect } from 'react'
import { api, AgentPet, AgentTask, AgentTaskStep } from '@/lib/api'
import { ProtoCard, ProtoButton, Pill, SoftCard } from '@/components/proto'
import { Send, Search, FileText, GitCompare, Bookmark, ThumbsUp, ThumbsDown, Loader2, ExternalLink } from 'lucide-react'
import { PetAvatar, PetType, taskStatusToPetState } from './PetAvatar'

const AVATAR_EMOJI: Record<string, string> = { fox: '🦊', owl: '🦉', robot: '🤖', cat: '🐱', dragon: '🐲', penguin: '🐧', bunny: '🐰', panda: '🐼' }

const TASK_TYPE_OPTIONS = [
  { id: 'search', label: '搜索资料', icon: <Search className="h-3.5 w-3.5" />, placeholder: '帮我找 Python 装饰器的入门教程' },
  { id: 'summarize', label: '文章摘要', icon: <FileText className="h-3.5 w-3.5" />, placeholder: '帮我总结这篇文章的要点...' },
  { id: 'compare', label: '对比搜索', icon: <GitCompare className="h-3.5 w-3.5" />, placeholder: 'for 和 while 的区别' },
]

interface ChatMessage {
  id: string
  sender: 'user' | 'agent'
  content: string
  task?: AgentTask
  timestamp: string
}

interface Props {
  pet: AgentPet
  onXpChange: () => void
}

export function AgentChat({ pet, onXpChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      content: `你好！我是${pet.name}，你的学习伙伴。有什么我能帮你的吗？`,
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [taskType, setTaskType] = useState('search')
  const [currentTask, setCurrentTask] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [steps, setSteps] = useState<AgentTaskStep[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const msgCounter = useRef(0)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, steps])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  async function handleSend() {
    const text = input.trim()
    if (!text || polling) return

    // Check ability
    if (!pet.unlocked_abilities.includes(taskType)) {
      msgCounter.current++
      setMessages(prev => [...prev, {
        id: `err-${msgCounter.current}`,
        sender: 'agent',
        content: `抱歉，${taskType === 'summarize' ? '文章摘要' : taskType === 'compare' ? '对比搜索' : '该'}能力需要更高等级才能解锁哦~`,
        timestamp: new Date().toISOString(),
      }])
      return
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${++msgCounter.current}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    // Create task
    try {
      const result = await api.createAgentTask({ task_type: taskType, input_text: text })
      setCurrentTask(result.task_id)
      setPolling(true)
      setSteps([])

      // Start polling with guard against duplicate completion handling
      let handled = false
      pollingRef.current = setInterval(async () => {
        if (handled) return
        try {
          const task = await api.getAgentTask(result.task_id)
          setSteps(task.steps || [])

          if (task.status === 'completed' || task.status === 'failed') {
            if (handled) return
            handled = true

            // Stop polling
            if (pollingRef.current) clearInterval(pollingRef.current)
            pollingRef.current = null
            setPolling(false)
            setCurrentTask(null)

            // Add agent response
            const agentMsg: ChatMessage = {
              id: `agent-${++msgCounter.current}`,
              sender: 'agent',
              content: task.status === 'completed'
                ? formatResult(task)
                : `😔 ${task.error_message || '任务执行失败，请稍后重试'}`,
              task: task.status === 'completed' ? task : undefined,
              timestamp: new Date().toISOString(),
            }
            setMessages(prev => [...prev, agentMsg])
            setSteps([])

            if (task.status === 'completed') {
              onXpChange()
            }
          }
        } catch {
          // Polling error, continue
        }
      }, 2000)
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `err-${++msgCounter.current}`,
        sender: 'agent',
        content: `😅 ${e.message || '创建任务失败'}`,
        timestamp: new Date().toISOString(),
      }])
    }
  }

  function formatResult(task: AgentTask): string {
    if (!task.result) return '任务完成，但没有返回结果。'
    if (task.task_type === 'search' && 'items' in task.result) {
      const items = (task.result as any).items || []
      if (items.length === 0) return '没有找到相关资源，试试换个关键词？'
      return `找到了 ${items.length} 条相关资源：`
    }
    if (task.task_type === 'summarize' && 'topic' in task.result) {
      return '文章摘要已生成：'
    }
    if (task.task_type === 'compare' && 'items' in task.result) {
      return '对比分析完成：'
    }
    return '任务完成！'
  }

  async function handleFeedback(taskId: string, feedback: 'useful' | 'not_useful') {
    try {
      await api.submitAgentFeedback(taskId, feedback)
      setMessages(prev => prev.map(m =>
        m.task?.task_id === taskId
          ? { ...m, task: { ...m.task!, feedback } }
          : m
      ))
    } catch { /* ignore */ }
  }

  async function handleBookmark(task: AgentTask, item: any, index: number) {
    try {
      await api.bookmarkAgentResult({
        task_id: task.task_id,
        item_index: index,
        title: item.title,
        url: item.url || '',
        summary: item.summary || item.explanation || '',
      })
      setMessages(prev => [...prev, {
        id: `bookmark-${++msgCounter.current}`,
        sender: 'agent',
        content: `✅ 已将「${item.title}」收藏到知识库！`,
        timestamp: new Date().toISOString(),
      }])
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `bookmark-err-${++msgCounter.current}`,
        sender: 'agent',
        content: `收藏失败：${e.message}`,
        timestamp: new Date().toISOString(),
      }])
    }
  }

  return (
    <ProtoCard className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      {/* Messages area - fills available space, scrolls internally */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.sender === 'user' ? 'order-1' : ''}`}>
              {msg.sender === 'agent' && (
                <div className="flex items-center gap-1.5 mb-1">
                  <PetAvatar type={pet.avatar as PetType} state="idle" size="sm" />
                  <span className="text-xs font-medium text-[#6b7280]">{pet.name}</span>
                </div>
              )}
              <div className={`rounded-xl px-3.5 py-2.5 text-sm ${
                msg.sender === 'user'
                  ? 'bg-[#2563eb] text-white'
                  : 'bg-[#f1f5f9] text-[#111827]'
              }`}>
                {msg.content}
              </div>

              {/* Render task results */}
              {msg.task && msg.task.result && (
                <div className="mt-2 space-y-2">
                  <TaskResultView task={msg.task} onBookmark={handleBookmark} />
                  {/* Feedback buttons */}
                  {!msg.task.feedback && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-[#9ca3af]">有帮助吗？</span>
                      <button
                        onClick={() => handleFeedback(msg.task!.task_id, 'useful')}
                        className="p-1 rounded hover:bg-[#ecfdf5] text-[#6b7280] hover:text-[#059669]"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.task!.task_id, 'not_useful')}
                        className="p-1 rounded hover:bg-[#fef2f2] text-[#6b7280] hover:text-[#dc2626]"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {msg.task.feedback && (
                    <div className="text-xs text-[#9ca3af] mt-1">
                      {msg.task.feedback === 'useful' ? '👍 感谢反馈！' : '已记录，下次会做得更好'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Polling status / steps */}
        {polling && (
          <div className="flex justify-start">
            <div className="max-w-[85%]">
              <div className="flex items-center gap-1.5 mb-1">
                <PetAvatar type={pet.avatar as PetType} state="searching" size="sm" />
                <span className="text-xs font-medium text-[#6b7280]">{pet.name}</span>
              </div>
              <div className="bg-[#f1f5f9] rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-sm text-[#374151]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2563eb]" />
                  <span>正在工作中...</span>
                </div>
                {steps.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {steps.slice(-3).map((s, i) => (
                      <div key={i} className="text-xs text-[#6b7280] flex items-center gap-1.5">
                        <StepIcon action={s.action} />
                        <span>{s.description}</span>
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

      {/* Task type selector */}
      <div className="flex gap-1.5 mb-3 mt-4 shrink-0">
        {TASK_TYPE_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setTaskType(opt.id)}
            disabled={!pet.unlocked_abilities.includes(opt.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              taskType === opt.id
                ? 'bg-[#2563eb] text-white'
                : pet.unlocked_abilities.includes(opt.id)
                  ? 'bg-[#f1f5f9] text-[#374151] hover:bg-[#e2e8f0]'
                  : 'bg-[#f9fafb] text-[#d1d5db] cursor-not-allowed'
            }`}
          >
            {opt.icon}
            {opt.label}
            {!pet.unlocked_abilities.includes(opt.id) && <span className="text-[10px]">🔒</span>}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); void handleSend() }}
        className="flex gap-2 shrink-0"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={TASK_TYPE_OPTIONS.find(o => o.id === taskType)?.placeholder || '输入你的问题...'}
          disabled={polling}
          className="flex-1 h-10 rounded-xl border border-[#e2e8f0] px-4 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] disabled:bg-[#f9fafb]"
          maxLength={200}
        />
        <button
          type="submit"
          disabled={!input.trim() || polling}
          className="h-10 w-10 rounded-xl bg-[#2563eb] text-white flex items-center justify-center hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </ProtoCard>
  )
}

function StepIcon({ action }: { action: string }) {
  const icons: Record<string, string> = {
    start: '🚀',
    navigate: '🌐',
    input: '⌨️',
    search: '🔍',
    click: '🖱️',
    extract: '📖',
    done: '✅',
    error: '❌',
  }
  return <span>{icons[action] || '⚡'}</span>
}

function TaskResultView({ task, onBookmark }: { task: AgentTask; onBookmark: (task: AgentTask, item: any, index: number) => void }) {
  const result = task.result as any
  if (!result) return null

  // Search results
  if (task.task_type === 'search' && result.items) {
    return (
      <div className="space-y-2">
        {result.items.map((item: any, i: number) => (
          <SoftCard key={i} className="bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-[#111827] truncate">{item.title}</div>
                <p className="text-xs text-[#6b7280] mt-1 line-clamp-2">{item.summary}</p>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#2563eb] mt-1 hover:underline">
                    <ExternalLink className="h-3 w-3" />{item.source || '查看原文'}
                  </a>
                )}
              </div>
              <button
                onClick={() => onBookmark(task, item, i)}
                className="shrink-0 p-1.5 rounded-lg hover:bg-[#eff6ff] text-[#6b7280] hover:text-[#2563eb]"
                title="收藏到知识库"
              >
                <Bookmark className="h-4 w-4" />
              </button>
            </div>
          </SoftCard>
        ))}
      </div>
    )
  }

  // Summary results
  if (task.task_type === 'summarize' && result.topic) {
    return (
      <SoftCard className="bg-white">
        <div className="text-sm font-medium text-[#111827] mb-2">📌 {result.topic}</div>
        <ul className="space-y-1 mb-2">
          {(result.key_points || []).map((point: string, i: number) => (
            <li key={i} className="text-xs text-[#374151] flex items-start gap-1.5">
              <span className="text-[#2563eb] mt-0.5">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        {result.conclusion && (
          <div className="text-xs text-[#6b7280] pt-2 border-t border-[#f1f5f9]">
            💡 {result.conclusion}
          </div>
        )}
      </SoftCard>
    )
  }

  // Compare results
  if (task.task_type === 'compare' && result.items) {
    return (
      <div className="space-y-2">
        {result.items.map((item: any, i: number) => (
          <SoftCard key={i} className="bg-white">
            <div className="text-xs font-bold text-[#2563eb] mb-1">视角 {i + 1}: {item.source}</div>
            <p className="text-xs text-[#374151]">{item.explanation}</p>
          </SoftCard>
        ))}
        {result.comparison && (
          <div className="text-xs text-[#6b7280] bg-[#fffbeb] rounded-lg p-2.5">
            ⚖️ <strong>对比总结：</strong>{result.comparison}
          </div>
        )}
      </div>
    )
  }

  return null
}
