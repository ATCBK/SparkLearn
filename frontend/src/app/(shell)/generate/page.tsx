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

const typeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="w-5 h-5" />,
  ppt: <Presentation className="w-5 h-5" />,
  mindmap: <GitBranch className="w-5 h-5" />,
  quiz: <HelpCircle className="w-5 h-5" />,
  reading: <BookOpen className="w-5 h-5" />,
  code: <Code className="w-5 h-5" />,
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
    if (!state.prompt.trim()) return
    const resource = await api.generateResource(state.selectedType, state.prompt)
    dispatch({ type: 'ADD', resource })
    dispatch({ type: 'SET_PROMPT', prompt: '' })

    // Simulate generation progress
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 20
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        dispatch({
          type: 'UPDATE',
          id: resource.id,
          updates: {
            status: 'completed',
            progress: 100,
            content: `# ${state.prompt}\n\n这是 AI 生成的学习资源内容。基于你的学习画像和需求，我们为你准备了以下内容...\n\n## 核心知识点\n\n1. 概念理解\n2. 实际应用\n3. 常见问题\n\n## 示例代码\n\n\`\`\`python\ndef example():\n    print("Hello, SparkLearn!")\n\`\`\``,
          },
        })
      } else {
        dispatch({ type: 'UPDATE', id: resource.id, updates: { progress: Math.round(progress) } })
      }
    }, 800)
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
          <Button onClick={handleGenerate} disabled={!state.prompt.trim()}>
            <Send className="w-4 h-4" />
            生成
          </Button>
        </div>
      </Card>

      {/* Content Grid: List + Preview */}
      {state.resources.length > 0 && (
        <div className="grid grid-cols-[1fr_360px] gap-6">
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
                    <Button variant="secondary" size="sm">
                      <Download className="w-4 h-4" />
                      下载
                    </Button>
                    <Button size="sm">
                      <Save className="w-4 h-4" />
                      保存到资源中心
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
