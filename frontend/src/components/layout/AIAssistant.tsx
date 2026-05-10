'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bot, Maximize2, MessageCircle, Minus, Send } from 'lucide-react'
import { api } from '@/lib/api'
import { ProtoButton } from '@/components/proto'

const CONTEXTS: Record<string, { title: string; hint: string; quick: string[] }> = {
  '/': { title: '工作台助手', hint: '我可以解释今日任务为什么这样安排。', quick: ['我今天先做什么', '为什么推荐这些资源', '帮我调整顺序'] },
  '/profile': { title: '画像助手', hint: '我可以解释画像维度和更新依据。', quick: ['解释我的薄弱点', '更新学习画像', '我适合什么资源'] },
  '/path': { title: '路径助手', hint: '我可以说明节点顺序和达标条件。', quick: ['为什么先学这里', '调整学习目标', '推荐下一步'] },
  '/generate': { title: '生成助手', hint: '我可以帮你优化生成要求。', quick: ['优化提示词', '选择资源类型', '解释生成结果'] },
  '/resources': { title: '资源助手', hint: '我可以讲解当前资源和安排练习。', quick: ['讲解这个资源', '生成配套练习', '找补弱资料'] },
  '/knowledge': { title: '资料助手', hint: '我可以帮你判断资料是否适合生成资源。', quick: ['总结资料用途', '哪些可用于生成', '整理资料建议'] },
  '/practice': { title: '练习助手', hint: '我可以讲解错因并推荐补弱资源。', quick: ['讲解这道题', '生成变式题', '推荐补弱资源'] },
  '/report': { title: '报告助手', hint: '我可以解读学习报告和下一步计划。', quick: ['解读本周报告', '下一步先做什么', '哪些薄弱点最急'] },
  '/loop': { title: '复习助手', hint: '我可以帮你安排三天复习计划。', quick: ['安排复习顺序', '今天复习什么', '减少复习压力'] },
}

export function AIAssistant() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState('我会结合当前页面给你建议。')
  const [streaming, setStreaming] = useState(false)

  const ctx = useMemo(() => CONTEXTS[pathname] || CONTEXTS['/'], [pathname])
  if (pathname === '/tutor') return null

  async function ask(text: string) {
    const question = text.trim()
    if (!question || streaming) return
    setOpen(true)
    setInput('')
    setAnswer('')
    setStreaming(true)
    try {
      await api.sendMessage(
        question,
        {
          mode: 'knowledge_qa',
          pageContext: {
            pathname,
            page_title: ctx.title,
            hint: ctx.hint,
          },
        },
        {
          onText: (chunk) => setAnswer((prev) => prev + chunk),
          onError: (err) => setAnswer(err.message || 'AI 助手暂时不可用。'),
        },
      )
    } catch (ex) {
      setAnswer(ex instanceof Error ? ex.message : 'AI 助手暂时不可用。')
    } finally {
      setStreaming(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-blue text-white shadow-lg hover:bg-blue-dark"
        aria-label="打开 AI 助手"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    )
  }

  return (
    <aside className="fixed bottom-6 right-6 z-50 w-[390px] max-w-[calc(100vw-32px)] rounded-[16px] border border-line bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-light text-blue">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <b className="block text-small text-ink">{ctx.title}</b>
            <span className="text-micro text-muted">{ctx.hint}</span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => router.push('/tutor')} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bg-hover" aria-label="打开完整辅导">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bg-hover" aria-label="最小化">
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-[12px] bg-[#f9fafb] p-3 text-small leading-6 text-text">
          {answer || (streaming ? '正在思考...' : '选择一个快捷问题，或直接输入你的问题。')}
        </div>
        <div className="flex flex-wrap gap-2">
          {ctx.quick.map((q) => (
            <ProtoButton key={q} variant="tertiary" className="h-8 px-2.5 text-micro" onClick={() => void ask(q)}>
              {q}
            </ProtoButton>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void ask(input)
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3 text-small outline-none focus:border-blue"
            placeholder="问问当前页面..."
          />
          <button className="grid h-10 w-10 place-items-center rounded-[10px] bg-blue text-white disabled:opacity-50" disabled={streaming || !input.trim()} aria-label="发送">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  )
}
