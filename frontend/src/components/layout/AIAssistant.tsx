'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Maximize2, Minus, Send, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils/cn'
import styled from 'styled-components'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const CONTEXTS: Record<string, { title: string; hint: string; quick: string[] }> = {
  '/': { title: '学习助手', hint: '我可以解释今日任务为什么这样安排。', quick: ['我今天先做什么', '为什么推荐这些资源', '帮我调整顺序'] },
  '/profile': { title: '画像助手', hint: '我可以解释画像维度和更新依据。', quick: ['解释我的薄弱点', '更新学习画像', '我适合什么资源'] },
  '/path': { title: '路径助手', hint: '我可以说明节点顺序和达标条件。', quick: ['为什么先学这里', '调整学习目标', '推荐下一步'] },
  '/generate': { title: '生成助手', hint: '我可以帮你优化生成要求。', quick: ['优化提示词', '选择资源类型', '解释生成结果'] },
  '/resources': { title: '资源助手', hint: '我可以讲解当前资源和安排练习。', quick: ['讲解这个资源', '生成配套练习', '找补弱资料'] },
  '/knowledge': { title: '资料助手', hint: '我可以帮你判断资料是否适合生成资源。', quick: ['总结资料用途', '哪些可用于生成', '整理资料建议'] },
  '/practice': { title: '练习助手', hint: '我可以讲解错因并推荐补弱资源。', quick: ['讲解这道题', '生成变式题', '推荐补弱资源'] },
  '/report': { title: '报告助手', hint: '我可以解读学习报告和下一步计划。', quick: ['解读本周报告', '下一步先做什么', '哪些薄弱点最急'] },
  '/loop': { title: '复习助手', hint: '我可以帮你安排三天复习计划。', quick: ['安排复习顺序', '今天复习什么', '减少复习压力'] },
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export function AIAssistant() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const posStart = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)

  // 3D tilt state (global mouse tracking)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const ctx = useMemo(() => CONTEXTS[pathname] || CONTEXTS['/'], [pathname])
  if (pathname === '/tutor') return null

  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }, [input])

  // Global mouse tracking for 3D tilt effect (only when closed)
  useEffect(() => {
    if (open) {
      setTilt({ rotateX: 0, rotateY: 0 })
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!cardRef.current || isDragging) return
      const rect = cardRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const deltaX = e.clientX - centerX
      const deltaY = e.clientY - centerY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      // Only apply tilt when mouse is within 300px of the card
      const maxDistance = 300
      if (distance > maxDistance) {
        setTilt({ rotateX: 0, rotateY: 0 })
        return
      }

      const intensity = 1 - distance / maxDistance
      const maxTilt = 15
      const rotateY = (deltaX / maxDistance) * maxTilt * intensity
      const rotateX = -(deltaY / maxDistance) * maxTilt * intensity

      setTilt({ rotateX, rotateY })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [open, isDragging])

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (open) return
    setIsDragging(true)
    hasMoved.current = false
    dragStart.current = { x: e.clientX, y: e.clientY }
    posStart.current = { ...position }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [open, position])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved.current = true
    }
    setPosition({ x: posStart.current.x + dx, y: posStart.current.y + dy })
  }, [isDragging])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    if (!hasMoved.current && !open) {
      setOpen(true)
    }
  }, [open])

  async function ask(text: string) {
    const question = text.trim()
    if (!question || streaming) return
    if (!open) setOpen(true)
    setInput('')

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    }

    const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
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
          onText: (chunk) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
            )
          },
          onError: (err) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: err.message || 'AI 助手暂时不可用。' } : m,
              ),
            )
          },
        },
      )
    } catch (ex) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: ex instanceof Error ? ex.message : 'AI 助手暂时不可用。' }
            : m,
        ),
      )
    } finally {
      setStreaming(false)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <StyledWrapper
      className="fixed z-50"
      $open={open}
      style={{
        bottom: `${24 - position.y}px`,
        right: `${24 - position.x}px`,
      }}
    >
      <div
        ref={cardRef}
        className="widget-root"
        onPointerDown={!open ? handlePointerDown : undefined}
        onPointerMove={!open ? handlePointerMove : undefined}
        onPointerUp={!open ? handlePointerUp : undefined}
      >
        {/* Closed state: small icon with 3D tilt */}
        {!open && (
          <div
            className="closed-icon"
            style={{
              transform: `perspective(800px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) translateZ(20px)`,
            }}
          >
            <div className="icon-bg">
              <div className="balls">
                <span className="ball rosa" />
                <span className="ball violet" />
                <span className="ball green" />
                <span className="ball cyan" />
              </div>
            </div>
            <div className="icon-face">
              <div className="eyes">
                <span className="eye" />
                <span className="eye" />
              </div>
              <div className="eyes happy">
                <svg fill="none" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z"
                  />
                </svg>
                <svg fill="none" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z"
                  />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Open state: chat panel */}
        {open && (
          <div className="chat-panel">
            <div className="chat">
              {/* Header */}
              <div className="chat-header">
                <span className="chat-title">{ctx.title}</span>
                <div className="chat-header-actions">
                  <button
                    onClick={() => router.push('/tutor')}
                    className="header-btn"
                    title="打开完整辅导"
                    aria-label="打开完整辅导"
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="header-btn"
                    title="最小化"
                    aria-label="最小化"
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    onClick={() => { setOpen(false); setMessages([]) }}
                    className="header-btn"
                    title="关闭"
                    aria-label="关闭"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="chat-messages">
                {!hasMessages ? (
                  <div className="chat-welcome">
                    <div className="welcome-icon">✦</div>
                    <p className="welcome-title">你好，我是{ctx.title}</p>
                    <p className="welcome-hint">{ctx.hint}</p>
                    <div className="quick-actions">
                      {ctx.quick.map((q) => (
                        <button
                          key={q}
                          onClick={() => void ask(q)}
                          className="quick-btn"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="messages-list">
                    {messages.map((msg) => {
                      const isUser = msg.role === 'user'
                      const isEmptyAssistant = !isUser && !msg.content.trim()
                      return (
                        <div key={msg.id} className={cn('msg-row', isUser ? 'msg-user' : 'msg-assistant')}>
                          {!isUser && (
                            <div className="msg-avatar">✦</div>
                          )}
                          <div className="msg-content-wrap">
                            <div className={cn('msg-bubble', isUser ? 'bubble-user' : 'bubble-assistant')}>
                              {isUser ? (
                                <p>{msg.content}</p>
                              ) : isEmptyAssistant ? (
                                <div className="typing-dots">
                                  <span />
                                  <span />
                                  <span />
                                </div>
                              ) : (
                                <div className="markdown-content">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                </div>
                              )}
                            </div>
                            {!isUser && !isEmptyAssistant && (
                              <div className="msg-footer">
                                <span>AI 生成，仅供参考</span>
                                <div className="feedback-btns">
                                  <button aria-label="有帮助">
                                    <ThumbsUp size={11} />
                                  </button>
                                  <button aria-label="没帮助">
                                    <ThumbsDown size={11} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Quick suggestions */}
              {hasMessages && !streaming && (
                <div className="chat-suggestions">
                  {ctx.quick.slice(0, 3).map((q) => (
                    <button
                      key={q}
                      onClick={() => void ask(q)}
                      className="suggestion-btn"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input area */}
              <div className="chat-input-area">
                <div className="chat-bot">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void ask(input)
                      }
                    }}
                    placeholder="输入你的问题...✦˚"
                  />
                </div>
                <div className="options">
                  <div className="btns-add">
                    <button onClick={() => router.push('/tutor')}>
                      <Maximize2 size={16} />
                    </button>
                  </div>
                  <button
                    className="btn-submit"
                    disabled={streaming || !input.trim()}
                    onClick={() => void ask(input)}
                  >
                    <i>
                      <Send size={16} />
                    </i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </StyledWrapper>
  )
}

const StyledWrapper = styled.div<{ $open: boolean }>`
  pointer-events: none;

  .widget-root {
    pointer-events: auto;
    width: ${({ $open }) => ($open ? '380px' : '80px')};
    height: ${({ $open }) => ($open ? '560px' : '80px')};
    transition: width 0.4s ease, height 0.4s ease;
    position: relative;
    cursor: ${({ $open }) => ($open ? 'default' : 'grab')};
    user-select: none;
    touch-action: none;
  }

  .widget-root:active {
    cursor: ${({ $open }) => ($open ? 'default' : 'grabbing')};
  }

  /* ===== Closed icon ===== */
  .closed-icon {
    width: 80px;
    height: 80px;
    border-radius: 1.5rem;
    position: relative;
    transition: transform 0.15s ease-out;
    will-change: transform;
  }

  .closed-icon:hover .eyes .eye {
    display: none;
  }

  .closed-icon:hover .eyes.happy {
    display: flex;
  }

  .icon-bg {
    position: absolute;
    inset: 0;
    border-radius: 1.5rem;
    background-color: rgba(255, 255, 255, 0.8);
    overflow: hidden;
    box-shadow:
      0 8px 30px rgba(0, 0, 60, 0.2),
      inset 0 0 8px rgba(255, 255, 255, 0.5);
  }

  .icon-bg .balls {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 80px;
    height: 80px;
    transform: translateX(-50%) translateY(-50%);
    animation: rotate-background-balls 10s linear infinite;
  }

  .closed-icon:hover .balls {
    animation-play-state: paused;
  }

  .icon-bg .ball {
    width: 3rem;
    height: 3rem;
    position: absolute;
    border-radius: 50%;
    filter: blur(15px);
  }

  .icon-bg .ball.violet {
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #9147ff;
  }

  .icon-bg .ball.green {
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #34d399;
  }

  .icon-bg .ball.rosa {
    top: 50%;
    left: -5px;
    transform: translateY(-50%);
    background-color: #ec4899;
  }

  .icon-bg .ball.cyan {
    top: 50%;
    right: -5px;
    transform: translateY(-50%);
    background-color: #05e0f5;
  }

  .icon-face {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(50px);
    border-radius: 1.5rem;
  }

  .eyes {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    gap: 0.7rem;
    transition: all 0.3s ease;

    & .eye {
      width: 12px;
      height: 28px;
      background-color: #fff;
      border-radius: 7px;
      animation: animate-eyes 10s infinite linear;
      transition: all 0.3s ease;
    }
  }

  .eyes.happy {
    display: none;
    color: #fff;
    gap: 0;

    & svg {
      width: 36px;
    }
  }

  /* ===== Chat panel (open) ===== */
  .chat-panel {
    width: 380px;
    height: 560px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
    animation: panel-in 0.3s ease;
  }

  .chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: #ffffff;
    border-radius: 16px;
    overflow: hidden;
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .chat-title {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
  }

  .chat-header-actions {
    display: flex;
    gap: 4px;
  }

  .header-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
      color: #333;
    }
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    min-height: 0;
  }

  .chat-welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 20px;
  }

  .welcome-icon {
    font-size: 32px;
    margin-bottom: 12px;
    background: linear-gradient(135deg, #9147ff, #ec4899);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .welcome-title {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a2e;
    margin-bottom: 6px;
  }

  .welcome-hint {
    font-size: 13px;
    color: #666;
    margin-bottom: 16px;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .quick-btn {
    padding: 6px 12px;
    font-size: 12px;
    border-radius: 16px;
    border: 1px solid rgba(145, 71, 255, 0.2);
    background: rgba(145, 71, 255, 0.05);
    color: #7c3aed;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(145, 71, 255, 0.12);
      border-color: rgba(145, 71, 255, 0.4);
    }
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .msg-row {
    display: flex;
    gap: 8px;
  }

  .msg-user {
    justify-content: flex-end;
  }

  .msg-assistant {
    justify-content: flex-start;
  }

  .msg-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, #9147ff, #ec4899);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: white;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .msg-content-wrap {
    max-width: 80%;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .msg-bubble {
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
  }

  .bubble-user {
    background: linear-gradient(135deg, #7c3aed, #9147ff);
    color: white;
    border-bottom-right-radius: 4px;
  }

  .bubble-assistant {
    background: rgba(0, 0, 0, 0.04);
    color: #1a1a2e;
    border-bottom-left-radius: 4px;
  }

  .typing-dots {
    display: flex;
    gap: 4px;
    padding: 4px 0;

    & span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #999;
      animation: typing-bounce 1.4s infinite ease-in-out;

      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }
  }

  .markdown-content {
    font-size: 13px;
    line-height: 1.6;

    p { margin: 0 0 8px; }
    p:last-child { margin: 0; }
    code {
      background: rgba(0, 0, 0, 0.06);
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 12px;
    }
    pre {
      background: rgba(0, 0, 0, 0.06);
      padding: 8px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 8px 0;
    }
    ul, ol { padding-left: 16px; margin: 4px 0; }
  }

  .msg-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #999;
    padding-left: 4px;
  }

  .feedback-btns {
    display: flex;
    gap: 2px;

    & button {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: #999;
      cursor: pointer;
      border-radius: 4px;

      &:hover {
        background: rgba(0, 0, 0, 0.06);
        color: #666;
      }
    }
  }

  .chat-suggestions {
    display: flex;
    gap: 6px;
    padding: 8px 16px;
    overflow-x: auto;
    border-top: 1px solid rgba(0, 0, 0, 0.04);
  }

  .suggestion-btn {
    padding: 4px 10px;
    font-size: 11px;
    border-radius: 12px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: white;
    color: #555;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;

    &:hover {
      border-color: #7c3aed;
      color: #7c3aed;
    }
  }

  .chat-input-area {
    padding: 8px 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .chat-bot {
    display: flex;

    & textarea {
      background-color: transparent;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      width: 100%;
      color: #333;
      font-family: sans-serif;
      font-size: 13px;
      padding: 8px 12px;
      resize: none;
      outline: none;
      min-height: 36px;
      max-height: 96px;
      line-height: 1.4;

      &::placeholder {
        color: #bbb;
        transition: color 0.2s;
      }

      &:focus::placeholder {
        color: #999;
      }

      &:focus {
        border-color: #7c3aed;
      }
    }
  }

  .options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
  }

  .btns-add {
    display: flex;
    gap: 8px;

    & button {
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(0, 0, 0, 0.2);
      background-color: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        color: #666;
      }
    }
  }

  .btn-submit {
    display: flex;
    padding: 2px;
    background-image: linear-gradient(to top, #ff4141, #9147ff, #3b82f6);
    border-radius: 10px;
    box-shadow: inset 0 6px 2px -4px rgba(255, 255, 255, 0.5);
    cursor: pointer;
    border: none;
    outline: none;
    opacity: 0.7;
    transition: all 0.15s ease;

    & i {
      width: 30px;
      height: 30px;
      padding: 6px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 10px;
      backdrop-filter: blur(3px);
      color: #cfcfcf;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    & svg {
      transition: all 0.3s ease;
    }

    &:hover:not(:disabled) {
      opacity: 1;

      & svg {
        color: #f3f6fd;
        filter: drop-shadow(0 0 5px #ffffff);
      }
    }

    &:active {
      transform: scale(0.92);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  @keyframes rotate-background-balls {
    from { transform: translateX(-50%) translateY(-50%) rotate(360deg); }
    to { transform: translateX(-50%) translateY(-50%) rotate(0); }
  }

  @keyframes animate-eyes {
    46% { height: 28px; }
    48% { height: 10px; }
    50% { height: 28px; }
    96% { height: 28px; }
    98% { height: 10px; }
    100% { height: 28px; }
  }

  @keyframes typing-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  @keyframes panel-in {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`
