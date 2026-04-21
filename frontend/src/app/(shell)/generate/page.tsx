'use client'

import { useEffect, useState, useReducer } from 'react'
import { api, Resource } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'
import { ErrorState } from '@/components/ui/ErrorState'
import { RESOURCE_TYPES, QUICK_TAGS } from '@/lib/utils/constants'
import { cn } from '@/lib/utils/cn'
import { FileText, Presentation, GitBranch, HelpCircle, BookOpen, Code, Send, RotateCcw, Download, Save } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { PptDeck, PptSlide } from '@/lib/api/types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

const typeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="w-5 h-5" />,
  ppt: <Presentation className="w-5 h-5" />,
  mindmap: <GitBranch className="w-5 h-5" />,
  quiz: <HelpCircle className="w-5 h-5" />,
  reading: <BookOpen className="w-5 h-5" />,
  code: <Code className="w-5 h-5" />,
}

function stepMaxForSlide(slide: PptSlide): number {
  if (slide.layout === 'bullets') return Math.max(1, ...(slide.bullets || []).map((x) => Number(x.step || 1)))
  if (slide.layout === 'process') return Math.max(1, ...(slide.nodes || []).map((x) => Number(x.step || 1)))
  return 1
}

function PptPreview({ deck }: { deck: PptDeck }) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [step, setStep] = useState(1)
  const slides = deck.slides || []
  const slide = slides[slideIndex]

  useEffect(() => {
    setStep(1)
  }, [slideIndex])

  if (!slide) {
    return <p className="text-small text-ink-secondary">暂无可预览的幻灯片</p>
  }

  const maxStep = stepMaxForSlide(slide)

  function nextStepOrSlide() {
    if (step < maxStep) {
      setStep((s) => s + 1)
      return
    }
    if (slideIndex < slides.length - 1) setSlideIndex((i) => i + 1)
  }

  function prevStepOrSlide() {
    if (step > 1) {
      setStep((s) => s - 1)
      return
    }
    if (slideIndex > 0) setSlideIndex((i) => i - 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-small text-ink-secondary">
        <span>{deck.title}</span>
        <span>
          第 {slideIndex + 1}/{slides.length} 页 · Step {step}/{maxStep}
        </span>
      </div>

      <div className="rounded-[16px] border border-black/[0.06] bg-white p-8 min-h-[380px] shadow-[0_8px_24px_rgba(4,14,32,0.08)]">
        <h2 id={`${slide.id}-title`} className="text-[30px] leading-[1.2] font-semibold text-ink">
          {slide.title}
        </h2>
        {slide.subtitle && <p className="mt-3 text-body text-ink-secondary">{slide.subtitle}</p>}

        {slide.layout === 'bullets' && (
          <ul className="mt-6 space-y-3 list-disc pl-6">
            {(slide.bullets || []).map((item) => (
              <li
                id={item.id}
                key={item.id}
                className={cn(
                  'text-[18px] transition-all',
                  item.step <= step ? 'opacity-100 text-ink' : 'opacity-20 text-ink-secondary',
                )}
              >
                {item.text}
              </li>
            ))}
          </ul>
        )}

        {slide.layout === 'process' && (
          <div className="mt-8 grid grid-cols-3 gap-4">
            {(slide.nodes || []).map((node) => (
              <div
                id={node.id}
                key={node.id}
                className={cn(
                  'rounded-[12px] border p-4 text-center text-body transition-all',
                  node.step <= step
                    ? 'border-blue bg-blue-light text-ink'
                    : 'border-black/[0.08] bg-bg-hover text-ink-secondary opacity-50',
                )}
              >
                {node.label}
              </div>
            ))}
          </div>
        )}

        {slide.layout === 'summary' && (
          <ul className="mt-6 space-y-3">
            {(slide.summary_points || []).map((point, idx) => (
              <li key={idx} className={cn('text-[18px] text-ink', idx + 1 <= step ? 'opacity-100' : 'opacity-20')}>
                {idx + 1}. {point}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSlideIndex(0)}>
            首页
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={prevStepOrSlide} disabled={slideIndex === 0 && step === 1}>
            上一步
          </Button>
          <Button size="sm" onClick={nextStepOrSlide} disabled={slideIndex === slides.length - 1 && step === maxStep}>
            下一步
          </Button>
        </div>
      </div>
    </div>
  )
}

type GenerateState = {
  resources: Resource[]
  selectedType: Resource['type']
  selectedId: string | null
  prompt: string
}

type GenerateAction =
  | { type: 'LOAD'; resources: Resource[] }
  | { type: 'ADD'; resource: Resource }
  | { type: 'UPDATE'; id: string; updates: Partial<Resource> }
  | { type: 'REPLACE_TEMP'; tempId: string; resource: Resource }
  | { type: 'SELECT_TYPE'; resourceType: Resource['type'] }
  | { type: 'SELECT_RESOURCE'; id: string }
  | { type: 'SET_PROMPT'; prompt: string }

function generateReducer(state: GenerateState, action: GenerateAction): GenerateState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, resources: action.resources }
    case 'ADD':
      return { ...state, resources: [...state.resources, action.resource], selectedId: action.resource.id }
    case 'UPDATE':
      return {
        ...state,
        resources: state.resources.map(r =>
          r.id === action.id ? { ...r, ...action.updates } : r
        ),
      }
    case 'REPLACE_TEMP':
      return {
        ...state,
        resources: state.resources.map(r => (r.id === action.tempId ? action.resource : r)),
        selectedId: state.selectedId === action.tempId ? action.resource.id : state.selectedId,
      }
    case 'SELECT_TYPE':
      return { ...state, selectedType: action.resourceType }
    case 'SELECT_RESOURCE':
      return { ...state, selectedId: action.id }
    case 'SET_PROMPT':
      return { ...state, prompt: action.prompt }
  }
}

export default function GeneratePage() {
  const [state, dispatch] = useReducer(generateReducer, {
    resources: [],
    selectedType: 'document',
    selectedId: null,
    prompt: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getResources()
      dispatch({ type: 'LOAD', resources: data })
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  async function handleGenerate() {
    const prompt = state.prompt.trim()
    if (!prompt || isGenerating) return

    const tempId = `temp-${Date.now()}`
    const tempResource: Resource = {
      id: tempId,
      title: prompt.slice(0, 20) || 'Generating...',
      type: state.selectedType,
      status: 'generating',
      createdAt: new Date().toISOString(),
      progress: 8,
      content: '',
    }
    dispatch({ type: 'ADD', resource: tempResource })
    dispatch({ type: 'SELECT_RESOURCE', id: tempId })
    dispatch({ type: 'SET_PROMPT', prompt: '' })
    setIsGenerating(true)

    let progress = 8
    const timer = setInterval(() => {
      progress = Math.min(progress + Math.floor(Math.random() * 8) + 3, 88)
      dispatch({ type: 'UPDATE', id: tempId, updates: { progress } })
    }, 450)

    try {
      const resource = await api.generateResource(state.selectedType, prompt)
      clearInterval(timer)
      dispatch({
        type: 'REPLACE_TEMP',
        tempId,
        resource: { ...resource, status: 'completed', progress: 100 },
      })
    } catch (e) {
      clearInterval(timer)
      dispatch({
        type: 'UPDATE',
        id: tempId,
        updates: {
          status: 'failed',
          progress: 0,
          content: e instanceof Error ? e.message : 'Generation failed',
        },
      })
    } finally {
      setIsGenerating(false)
    }
  }

  function handleRetry(id: string) {
    dispatch({ type: 'UPDATE', id, updates: { status: 'generating', progress: 0 } })
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 25
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        dispatch({ type: 'UPDATE', id, updates: { status: 'completed', progress: 100 } })
      } else {
        dispatch({ type: 'UPDATE', id, updates: { progress: Math.round(progress) } })
      }
    }, 600)
  }

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="animate-pulse h-48 rounded-[20px] bg-bg-hover" />)}</div>
  if (error) return <ErrorState type="server" onRetry={fetchData} />

  const selected = state.resources.find(r => r.id === state.selectedId)
  const selectedLink = selected?.sourceUrl || null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-ink">资源生成</h1>
        <p className="text-body text-ink-secondary mt-1">让 AI 为你创建个性化学习资料</p>
      </div>

      {/* Type Selector - Six Grid */}
      <div className="grid grid-cols-6 gap-3">
        {RESOURCE_TYPES.map(rt => (
          <button
            key={rt.key}
            onClick={() => dispatch({ type: 'SELECT_TYPE', resourceType: rt.key as Resource['type'] })}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-[16px] border transition-all',
              state.selectedType === rt.key
                ? 'border-blue bg-blue-light text-blue'
                : 'border-black/[0.06] bg-bg-card text-ink-secondary hover:border-blue/30 hover:bg-blue-light/50',
            )}
          >
            <div className={cn('w-10 h-10 rounded-[12px] flex items-center justify-center',
              state.selectedType === rt.key ? 'bg-blue/10' : 'bg-bg-hover',
            )}>
              {typeIcons[rt.key]}
            </div>
            <span className="text-small font-medium">{rt.label}</span>
          </button>
        ))}
      </div>

      {/* Input Area */}
      <Card className="p-5">
        <textarea
          placeholder="请描述你需要的学习资源..."
          value={state.prompt}
          onChange={e => dispatch({ type: 'SET_PROMPT', prompt: e.target.value })}
          className="w-full h-24 p-0 border-0 bg-transparent text-body text-ink placeholder:text-ink-disabled focus:outline-none resize-none"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/[0.06]">
          <div className="flex gap-2 flex-wrap">
            {QUICK_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => dispatch({ type: 'SET_PROMPT', prompt: state.prompt ? `${state.prompt} ${tag}` : tag })}
                className="px-3 py-1 rounded-pill bg-bg-hover text-caption text-ink-secondary hover:text-ink transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
          <Button onClick={handleGenerate} disabled={!state.prompt.trim() || isGenerating}>
            <Send className="w-4 h-4" />
            {isGenerating ? 'Generating...' : '生成'}
          </Button>
        </div>
      </Card>

      {/* Content Grid: Left small list + Right large preview */}
      {state.resources.length > 0 && (
        <div className="grid grid-cols-[340px_1fr] gap-6">
          {/* Resource List */}
          <Card className="p-4 space-y-1 max-h-[600px] overflow-y-auto">
            {state.resources.map(res => (
              <div
                key={res.id}
                onClick={() => dispatch({ type: 'SELECT_RESOURCE', id: res.id })}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-[12px] cursor-pointer transition-colors',
                  state.selectedId === res.id ? 'bg-blue-light' : 'hover:bg-bg-hover',
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  state.selectedId === res.id ? 'text-blue' : 'text-ink-secondary',
                )}>
                  {typeIcons[res.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-small font-medium text-ink truncate">{res.title}</p>
                  {res.status === 'generating' && (
                    <div className="flex items-center gap-2 mt-1">
                      <ProgressBar value={res.progress || 0} className="flex-1" />
                      <span className="text-micro text-ink-tertiary">{res.progress || 0}%</span>
                    </div>
                  )}
                </div>
                {res.status === 'completed' && <Badge variant="success">完成</Badge>}
                {res.status === 'generating' && <Badge variant="warning">生成中</Badge>}
                {res.status === 'failed' && (
                  <div className="flex items-center gap-2">
                    <Badge variant="default">失败</Badge>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRetry(res.id) }}>
                      <RotateCcw className="w-3 h-3" />
                      重试
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </Card>

          {/* Preview Panel */}
          <Card className="p-0 overflow-hidden flex flex-col">
            {selected ? (
              <>
                <div className="p-5 border-b border-black/[0.06]">
                  <h3 className="text-h3 text-ink">{selected.title}</h3>
                  <Badge variant="info" size="sm">{RESOURCE_TYPES.find(rt => rt.key === selected.type)?.label}</Badge>
                </div>
                <div className="flex-1 p-5 overflow-y-auto">
                  {selected.status === 'generating' ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-6">
                      <TypewriterLoader />
                      <p className="text-ink-secondary text-small">AI 正在为你生成资源...</p>
                      <ProgressBar value={selected.progress || 0} className="w-64" />
                    </div>
                  ) : selected.status === 'failed' ? (
                    <ErrorState type="server" title="生成失败" onRetry={() => handleRetry(selected.id)} />
                  ) : selected.type === 'ppt' && selected.pptSchema ? (
                    <PptPreview deck={selected.pptSchema} />
                  ) : selected.type === 'document' && selectedLink ? (
                    <div className="space-y-4">
                      <div className="rounded-[12px] border border-black/[0.06] bg-bg-hover px-3 py-2 text-small text-ink-secondary">
                        Document URL detected: {selectedLink}
                      </div>
                      <iframe
                        src={`${API_BASE}/api/resources/${selected.id}/preview/html`}
                        className="w-full h-[560px] rounded-[12px] border border-black/[0.08] bg-white"
                        title="Document Preview"
                      />
                    </div>
                  ) : selected.content ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-16">
                      <p className="text-ink-tertiary text-small">预览内容</p>
                    </div>
                  )}
                </div>
                {selected.status === 'completed' && (
                  <div className="p-4 border-t border-black/[0.06] flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        try {
                          await api.downloadResource(selected.id)
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : 'PDF download failed'
                          window.alert(msg)
                        }
                      }}
                    >
                      <Download className="w-4 h-4" />
                      下载PDF
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (selectedLink) window.open(selectedLink, '_blank', 'noopener,noreferrer')
                      }}
                      disabled={!selectedLink}
                    >
                      <Save className="w-4 h-4" />
                      Open Link
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full py-16">
                <p className="text-ink-tertiary text-small">选择一个资源查看预览</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
