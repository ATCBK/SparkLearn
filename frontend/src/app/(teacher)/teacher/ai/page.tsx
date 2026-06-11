'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Send, Sparkles, User } from 'lucide-react'
import { PageHead, Pill, ProtoCard, SoftCard } from '@/components/proto'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: string
}

// 教师专属快捷问题
const QUICK_QUESTIONS = [
  { label: '班级概况', text: '请总结一下当前班级的整体学习情况，重点说明需要关注的问题。' },
  { label: '薄弱分析', text: '全班在哪些知识点上掌握最薄弱？请给出针对性的教学建议。' },
  { label: '出题助手', text: '请为"函数与闭包"章节出5道中等难度的练习题，包含答案和解析。' },
  { label: '教学计划', text: '请帮我制定下周"面向对象编程"的教学计划，包含重点、难点和课堂活动。' },
  { label: '家长沟通', text: '请帮我写一份关于学习进度偏慢学生的家长沟通建议，语气温和专业。' },
  { label: '补弱策略', text: '对于在"作用域与闭包"上掌握度低于40%的学生，有哪些有效的补弱策略？' },
]

export default function TeacherAIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 SparkLearn 教师 AI 助手。我可以帮你分析班级数据、生成教学内容、制定干预策略，或者回答任何教学相关的问题。请问有什么可以帮你？',
      ts: new Date().toISOString(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text.trim(), ts: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // 构建教师专属 system context
    const systemContext = '你是 SparkLearn 平台的教师 AI 助手。你的用户是一位 Python 编程课教师，班级有9名学生，当前学习 Python 基础到高级特性。请以专业、简洁的方式回答教学相关问题，可以生成题目、教案、分析报告等内容。'

    try {
      const r = await fetch(`${API}/api/tutor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          mode: 'knowledge_qa',
          page_context: { role: 'teacher', system_hint: systemContext },
        }),
      })

      if (!r.body) throw new Error('no body')
      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantContent = ''
      const assistantId = `a-${Date.now()}`

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', ts: new Date().toISOString() }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''
        for (const chunk of chunks) {
          const line = chunk.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'text' && evt.payload?.content) {
              assistantContent += String(evt.payload.content)
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m))
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: 'assistant',
        content: '抱歉，AI 服务暂时不可用。请确认后端服务已启动（端口 8000）。',
        ts: new Date().toISOString(),
      }])
    }
    setLoading(false)
  }

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / AI 教学助手"
        title="AI 教学助手"
        description="教师专属 AI 对话，支持班级分析、出题、教案生成、家长沟通稿等教学场景。"
      />

      <div className="grid grid-cols-[240px_1fr] gap-5 max-[900px]:grid-cols-1">
        {/* 左侧：快捷问题 */}
        <div className="space-y-4">
          <ProtoCard>
            <div className="flex items-center gap-2 mb-3">
              <div className="grid h-6 w-6 place-items-center rounded-lg bg-[#fff7ed] text-[#d97706]">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-sm font-bold text-[#111827]">快捷问题</h3>
            </div>
            <div className="space-y-2">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q.label}
                  onClick={() => sendMessage(q.text)}
                  disabled={loading}
                  className="w-full rounded-[8px] border border-[#eef2f7] bg-[#f9fafb] px-3 py-2.5 text-left text-xs font-bold text-[#374151] transition-colors hover:border-[#bfdbfe] hover:bg-[#eff6ff] hover:text-[#2563eb] disabled:opacity-50"
                >
                  <span className="mb-0.5 block text-[10px] font-bold text-[#2563eb]">{q.label}</span>
                  <span className="line-clamp-2 font-normal text-[#6b7280]">{q.text.slice(0, 40)}...</span>
                </button>
              ))}
            </div>
          </ProtoCard>

          <ProtoCard>
            <h3 className="mb-2 text-xs font-bold text-[#6b7280]">使用提示</h3>
            <div className="space-y-1.5 text-xs text-[#6b7280]">
              <p>• 可以直接问班级数据相关问题</p>
              <p>• 支持生成练习题和教案</p>
              <p>• 可以请求家长沟通建议</p>
              <p>• 支持多轮对话上下文</p>
            </div>
          </ProtoCard>
        </div>

        {/* 右侧：对话区 */}
        <ProtoCard className="flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* 头像 */}
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white ${msg.role === 'user' ? 'bg-[#2563eb]' : 'bg-[#7c3aed]'}`}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                {/* 气泡 */}
                <div className={`max-w-[75%] rounded-[12px] px-4 py-3 text-sm leading-7 ${
                  msg.role === 'user'
                    ? 'bg-[#2563eb] text-white rounded-tr-[4px]'
                    : 'bg-[#f3f4f6] text-[#111827] rounded-tl-[4px]'
                }`}>
                  {msg.content || (
                    <span className="flex items-center gap-2 text-[#9ca3af]">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
                      思考中...
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* 输入区 */}
          <div className="mt-4 border-t border-[#eef2f7] pt-4">
            <form
              onSubmit={e => { e.preventDefault(); sendMessage(input) }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="输入教学问题，例如：帮我分析班级薄弱点..."
                disabled={loading}
                className="h-11 flex-1 rounded-[10px] border border-[#e5e7eb] bg-[#f9fafb] px-4 text-sm outline-none transition-colors focus:border-[#2563eb] focus:bg-white disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="grid h-11 w-11 place-items-center rounded-[10px] bg-[#2563eb] text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </ProtoCard>
      </div>
    </div>
  )
}
