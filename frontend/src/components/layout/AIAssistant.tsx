'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Minus, Send, ThumbsDown, ThumbsUp, X, Sparkles, Volume2, Mic, MicOff, Loader2, Pause } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils/cn'
import styled from 'styled-components'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const CONTEXTS: Record<string, { title: string; hint: string; quick: string[] }> = {
  '/': { title: '小星同学', hint: '我可以解释今日任务为什么这样安排。', quick: ['我今天先做什么', '为什么推荐这些资源', '帮我调整顺序'] },
  '/profile': { title: '小星同学', hint: '我可以解释画像维度和更新依据。', quick: ['解释我的薄弱点', '更新学习画像', '我适合什么资源'] },
  '/path': { title: '小星同学', hint: '我可以说明节点顺序和达标条件。', quick: ['为什么先学这里', '调整学习目标', '推荐下一步'] },
  '/generate': { title: '小星同学', hint: '我可以帮你优化生成要求，也可以讲解我的资源中的内容。', quick: ['优化提示词', '选择资源类型', '讲解这个资源'] },
  '/knowledge': { title: '小星同学', hint: '我可以帮你判断资料是否适合生成资源。', quick: ['总结资料用途', '哪些可用于生成', '整理资料建议'] },
  '/practice': { title: '小星同学', hint: '我可以讲解错因并推荐补弱资源。', quick: ['讲解这道题', '生成变式题', '推荐补弱资源'] },
  '/report': { title: '小星同学', hint: '我可以解读学习报告和下一步计划。', quick: ['解读本周报告', '下一步先做什么', '哪些薄弱点最急'] },
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

  // TTS playback
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null)
  const [ttsLoading, setTtsLoading] = useState<string | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsBlobUrlRef = useRef<string | null>(null)

  // Voice input
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<any>(null)
  const voiceBaseRef = useRef<string>('')

  // 3D tilt state (global mouse tracking)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  // 学习空间过场动画
  const [transitioning, setTransitioning] = useState(false)

  function goToLearningSpace() {
    setTransitioning(true)
    setTimeout(() => {
      router.push('/tutor')
    }, 800)
  }

  const ctx = useMemo(() => CONTEXTS[pathname] || CONTEXTS['/'], [pathname])

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

      // Global tracking - no distance limit, eyes follow mouse everywhere
      const maxTilt = 15
      const maxDelta = 400
      const clampedX = Math.max(-maxDelta, Math.min(maxDelta, deltaX))
      const clampedY = Math.max(-maxDelta, Math.min(maxDelta, deltaY))
      const rotateY = (clampedX / maxDelta) * maxTilt
      const rotateX = -(clampedY / maxDelta) * maxTilt

      setTilt({ rotateX, rotateY })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [open, isDragging])

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true)
    hasMoved.current = false
    dragStart.current = { x: e.clientX, y: e.clientY }
    posStart.current = { ...position }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [position])

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

  // 在 /tutor 页面不渲染
  if (pathname === '/tutor') return null

  // TTS playback function
  async function playTts(msgId: string, text: string) {
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
      const blob = await api.synthesizeSpeech(text.replace(/[#*`>\-|[\]()]/g, '').slice(0, 2000))
      const url = URL.createObjectURL(blob)
      ttsBlobUrlRef.current = url
      const audio = new Audio(url)
      ttsAudioRef.current = audio
      audio.addEventListener('ended', () => setPlayingMsgId(null))
      await audio.play()
      setPlayingMsgId(msgId)
    } catch { /* TTS failed */ }
    finally { setTtsLoading(null) }
  }

  // Voice input function
  function toggleVoiceInput() {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('当前浏览器不支持语音识别，请使用 Chrome 浏览器。')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    voiceBaseRef.current = input
    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(voiceBaseRef.current ? voiceBaseRef.current + transcript : transcript)
    }
    recognition.onend = () => setRecording(false)
    recognition.onerror = () => setRecording(false)
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

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
                m.id === assistantId ? { ...m, content: err.message || '小星同学暂时不可用。' } : m,
              ),
            )
          },
        },
      )
    } catch (ex) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: ex instanceof Error ? ex.message : '小星同学暂时不可用。' }
            : m,
        ),
      )
    } finally {
      setStreaming(false)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <>
      {/* 学习空间过场动画 */}
      {transitioning && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #1e1b4b, #312e81, #4c1d95)',
            animation: 'fadeIn 0.3s ease forwards',
          }}
        >
          <div
            className="flex flex-col items-center gap-4"
            style={{ animation: 'scaleIn 0.5s ease forwards' }}
          >
            <div className="grid h-20 w-20 place-items-center rounded-full bg-white/10 backdrop-blur-sm ring-2 ring-white/20">
              <Sparkles size={36} className="text-white animate-pulse" />
            </div>
            <p className="text-lg font-semibold text-white/90">正在进入学习空间...</p>
            <div className="flex gap-1.5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/60" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/60" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/60" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
          `}</style>
        </div>
      )}
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
        {/* Closed state: original 3D sprite scaled down */}
        {!open && (
          <div className="closed-sprite-wrapper">
            <div className="container-ai-input">
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <div className="area" />
              <label className="container-wrap">
                <input type="checkbox" readOnly checked={false} />
                <div className="card" style={{
                  transform: `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) translateZ(50px)`,
                }}>
                  <div className="background-blur-balls">
                    <div className="balls">
                      <span className="ball rosa" />
                      <span className="ball violet" />
                      <span className="ball green" />
                      <span className="ball cyan" />
                    </div>
                  </div>
                  <div className="content-card">
                    <div className="background-blur-card">
                      <div className="eyes">
                        <span className="eye" />
                        <span className="eye" />
                      </div>
                      <div className="eyes happy">
                        <svg fill="none" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z" />
                        </svg>
                        <svg fill="none" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Open state: chat panel */}
        {open && (
          <div className="chat-panel">
            <div className="chat">
              {/* Header */}
              <div
                className="chat-header"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <span className="chat-title">{ctx.title}</span>
                <div className="chat-header-actions">
                  <button
                    onClick={goToLearningSpace}
                    className="header-btn learning-space-btn"
                    title="进入学习空间"
                    aria-label="进入学习空间"
                  >
                    <Sparkles size={13} />
                    <span>学习空间</span>
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
                                  <button
                                    aria-label="语音播报"
                                    onClick={() => void playTts(msg.id, msg.content)}
                                    disabled={ttsLoading === msg.id}
                                    className={playingMsgId === msg.id ? 'active' : ''}
                                  >
                                    {ttsLoading === msg.id ? (
                                      <Loader2 size={11} className="animate-spin" />
                                    ) : playingMsgId === msg.id ? (
                                      <Pause size={11} />
                                    ) : (
                                      <Volume2 size={11} />
                                    )}
                                  </button>
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
                <div className="chat-input-box">
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
                  <div className="input-actions">
                    <button
                      type="button"
                      className={cn('input-action-btn mic-btn', recording && 'recording')}
                      onClick={toggleVoiceInput}
                      title={recording ? '停止录音' : '语音输入'}
                      aria-label={recording ? '停止录音' : '语音输入'}
                    >
                      {recording ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    <label className="input-action-btn" title="上传文件" aria-label="上传文件">
                      <input type="file" className="hidden" accept=".txt,.pdf,.md,.doc,.docx" />
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </label>
                    <button
                      className="input-send-btn"
                      disabled={streaming || !input.trim()}
                      onClick={() => void ask(input)}
                      aria-label="发送"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </StyledWrapper>
    </>
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

  /* ===== Closed sprite (original structure, scaled down) ===== */
  .closed-sprite-wrapper {
    width: 80px;
    height: 80px;
    position: relative;
    overflow: visible;
  }

  .container-ai-input {
    --perspective: 1000px;
    --translateY: 45px;
    position: absolute;
    left: 50%;
    top: 50%;
    width: 12rem;
    height: 17rem;
    margin-left: -6rem;
    margin-top: -8.5rem;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(3, 1fr);
    transform-style: preserve-3d;
    transform: scale(0.42);
  }

  .container-wrap {
    display: flex;
    align-items: center;
    justify-items: center;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translateX(-50%) translateY(-50%);
    z-index: 9;
    transform-style: preserve-3d;
    cursor: pointer;
    padding: 4px;
    transition: all 0.3s ease;
  }

  .container-wrap:hover {
    padding: 0;
  }

  .container-wrap:active {
    transform: translateX(-50%) translateY(-50%) scale(0.95);
  }

  .container-wrap:after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translateX(-50%) translateY(-55%);
    width: 12rem;
    height: 11rem;
    background-color: #dedfe0;
    border-radius: 3.2rem;
    transition: all 0.3s ease;
  }

  .container-wrap:hover:after {
    transform: translateX(-50%) translateY(-50%);
    height: 12rem;
  }

  .container-wrap input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .card {
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    will-change: transform;
    transition: transform 0.15s ease-out;
    border-radius: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card:hover {
    box-shadow:
      0 10px 40px rgba(0, 0, 60, 0.25),
      inset 0 0 10px rgba(255, 255, 255, 0.5);
  }

  .background-blur-balls {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translateX(-50%) translateY(-50%);
    width: 100%;
    height: 100%;
    z-index: -10;
    border-radius: 3rem;
    transition: all 0.3s ease;
    background-color: rgba(255, 255, 255, 0.8);
    overflow: hidden;
  }

  .balls {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translateX(-50%) translateY(-50%);
    animation: rotate-background-balls 10s linear infinite;
  }

  .container-wrap:hover .balls {
    animation-play-state: paused;
  }

  .background-blur-balls .ball {
    width: 6rem;
    height: 6rem;
    position: absolute;
    border-radius: 50%;
    filter: blur(30px);
  }

  .background-blur-balls .ball.violet {
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    background-color: #9147ff;
  }

  .background-blur-balls .ball.green {
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    background-color: #34d399;
  }

  .background-blur-balls .ball.rosa {
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    background-color: #ec4899;
  }

  .background-blur-balls .ball.cyan {
    top: 50%;
    right: 0;
    transform: translateY(-50%);
    background-color: #05e0f5;
  }

  .content-card {
    width: 12rem;
    height: 12rem;
    display: flex;
    border-radius: 3rem;
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .background-blur-card {
    width: 100%;
    height: 100%;
    backdrop-filter: blur(50px);
  }

  .eyes {
    position: absolute;
    left: 50%;
    bottom: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    height: 52px;
    gap: 2rem;
    transition: all 0.3s ease;

    & .eye {
      width: 26px;
      height: 52px;
      background-color: #fff;
      border-radius: 16px;
      animation: animate-eyes 10s infinite linear;
      transition: all 0.3s ease;
    }
  }

  .eyes.happy {
    display: none;
    color: #fff;
    gap: 0;

    & svg {
      width: 60px;
    }
  }

  .container-wrap:hover .eyes .eye {
    display: none;
  }

  .container-wrap:hover .eyes.happy {
    display: flex;
  }

  /* 3D tilt areas */
  .area:nth-child(15):hover ~ .container-wrap .card,
  .area:nth-child(15):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(14):hover ~ .container-wrap .card,
  .area:nth-child(14):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(13):hover ~ .container-wrap .card,
  .area:nth-child(13):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(0)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(12):hover ~ .container-wrap .card,
  .area:nth-child(12):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(-7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(11):hover ~ .container-wrap .card,
  .area:nth-child(11):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(-15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(10):hover ~ .container-wrap .card,
  .area:nth-child(10):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(9):hover ~ .container-wrap .card,
  .area:nth-child(9):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(8):hover ~ .container-wrap .card,
  .area:nth-child(8):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(0)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(7):hover ~ .container-wrap .card,
  .area:nth-child(7):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(-7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(6):hover ~ .container-wrap .card,
  .area:nth-child(6):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(-15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(5):hover ~ .container-wrap .card,
  .area:nth-child(5):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(15deg) rotateY(15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(4):hover ~ .container-wrap .card,
  .area:nth-child(4):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(15deg) rotateY(7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(3):hover ~ .container-wrap .card,
  .area:nth-child(3):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(15deg) rotateY(0)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(2):hover ~ .container-wrap .card,
  .area:nth-child(2):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(15deg) rotateY(-7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(1):hover ~ .container-wrap .card,
  .area:nth-child(1):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(15deg) rotateY(-15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
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
    cursor: grab;
    user-select: none;
    touch-action: none;
  }

  .chat-header:active {
    cursor: grabbing;
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

  .header-btn.learning-space-btn {
    width: auto;
    gap: 4px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 8px;
    background: linear-gradient(135deg, #7c3aed, #9147ff);
    color: white;

    &:hover {
      background: linear-gradient(135deg, #6d28d9, #7c3aed);
      color: white;
      transform: scale(1.02);
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
  }

  .chat-input-box {
    display: flex;
    align-items: flex-end;
    gap: 0;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 14px;
    padding: 6px 6px 6px 12px;
    transition: border-color 0.2s;

    &:focus-within {
      border-color: #7c3aed;
    }

    & textarea {
      background-color: transparent;
      border: none;
      width: 100%;
      color: #333;
      font-family: sans-serif;
      font-size: 13px;
      padding: 4px 0;
      resize: none;
      outline: none;
      min-height: 28px;
      max-height: 96px;
      line-height: 1.4;

      &::placeholder {
        color: #bbb;
      }
    }
  }

  .input-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    padding-bottom: 2px;
  }

  .input-action-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: #999;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    background: transparent;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #666;
    }

    & input {
      display: none;
    }

    &.mic-btn.recording {
      background: #dc2626;
      color: white;
      animation: pulse-mic 1.5s infinite;
    }
  }

  .feedback-btns button.active {
    color: #7c3aed;
  }

  .input-send-btn {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, #7c3aed, #ec4899);
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0.9;

    &:hover:not(:disabled) {
      opacity: 1;
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.92);
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  }

  .hidden {
    display: none;
  }

  @keyframes rotate-background-balls {
    from { transform: translateX(-50%) translateY(-50%) rotate(360deg); }
    to { transform: translateX(-50%) translateY(-50%) rotate(0); }
  }

  @keyframes animate-eyes {
    46% { height: 52px; }
    48% { height: 20px; }
    50% { height: 52px; }
    96% { height: 52px; }
    98% { height: 20px; }
    100% { height: 52px; }
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

  @keyframes pulse-mic {
    0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
    50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
  }
`
