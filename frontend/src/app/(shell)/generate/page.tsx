'use client'

/* eslint-disable react/no-unescaped-entities */

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock, FileText, Layers, Play, Save, Sparkles, ArrowLeft, Download, Trash2, Search, Presentation, Brain, Video, Radio, CheckSquare, BookOpen, Code, NotebookPen, ChevronLeft, ChevronRight, Globe, Zap, ShieldCheck, CircleGauge, X, Info, Loader2 } from 'lucide-react'
import { api, KnowledgeFile, Resource, ResourceQualityResult, StudentProfile, VideoStyle, VideoScriptSegment, VideoPolishResult } from '@/lib/api'
import { Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'
import { AudioRadio } from '@/components/ui/AudioRadio'
import { MarkdownCodePreview } from '@/components/ui/MarkdownCodePreview'
import { CodePracticePanel } from '@/components/ui/CodePracticePanel'
import { useGenerationTasks } from '@/components/providers/GenerationTaskProvider'
import { GenerationFailureContactDialog } from '@/components/ui/GenerationFailureContactDialog'
import { buildUrlAccessUrl } from '@/lib/api/real'

const STEPS = ['确认上下文', '选择类型', '配置要求', '生成中', '预览结果', '自动保存']
const TYPES: Array<{ type: Resource['type']; label: string; desc: string }> = [
  { type: 'document', label: '文档', desc: '结构化概念讲义' },
  { type: 'ppt', label: 'PPT', desc: '课堂式演示稿' },
  { type: 'mindmap', label: '思维导图', desc: '知识关系梳理' },
  { type: 'video', label: '教学视频', desc: 'AI 合成视频' },
  { type: 'blog', label: '播客电台', desc: 'AI 生成音频播客' },
  { type: 'quiz', label: '练习题', desc: '达标检测题组' },
  { type: 'reading', label: '拓展阅读', desc: '延伸材料' },
  { type: 'code', label: '代码案例', desc: '可运行实践案例' },
]

const TYPE_PROMPTS: Record<string, string> = {
  document: '请根据我填写的学习目标或薄弱点生成一份结构化讲义，包含概念解释、示例、常见错误和检查题。',
  ppt: '请根据我填写的学习目标或薄弱点生成一份课堂演示 PPT，包含核心概念、案例和互动环节。',
  mindmap: '请根据我填写的学习目标或薄弱点生成一份思维导图，梳理关键概念和前后依赖关系。',
  video: '请根据我填写的学习目标或薄弱点生成一段教学视频脚本，包含生活化类比和练习提示。',
  blog: '请根据我填写的学习目标或薄弱点生成一段轻松易懂的播客稿，让零基础的人也能听懂。',
  quiz: '请根据我填写的学习目标或薄弱点生成一组练习题，覆盖简单、中等、困难三个难度。',
  reading: '请根据我填写的学习目标或薄弱点生成一份拓展阅读材料，包含背景知识和实际应用场景。',
  code: '请根据我填写的学习目标或薄弱点生成一个完整代码案例，包含问题描述、代码实现和讲解。',
}

const GENERATION_FOCUS_OPTIONS = [
  {
    id: 'project',
    title: '项目案例优先',
    description: '用"成绩统计小程序"承载函数参数、返回值和局部变量。',
    promptHint: '生成侧重点：项目案例优先。请用一个可运行的小项目承载知识点，突出函数参数、返回值、局部变量和模块拆分。',
  },
  {
    id: 'mistake',
    title: '错题拆解优先',
    description: '逐题解释为什么 print 输出不等于 return。',
    promptHint: '生成侧重点：错题拆解优先。请先解释典型错误，再给出修正示例和原因。',
  },
  {
    id: 'practice',
    title: '达标练习优先',
    description: '先给题，再按错误类型补。',
    promptHint: '生成侧重点：达标练习优先。请先给达标练习，再按错误类型给补救讲解。',
  },
] as const

const DEFAULT_VIDEO_STYLES: VideoStyle[] = [
  { id: 'apple-minimal', name: '苹果极简风', description: '白底+蓝色点缀，系统化技术教学', accent_color: '#0071e3', bg_gradient: 'linear-gradient(135deg, #ffffff 0%, #e8f7ff 48%, #f7f3ff 100%)', font_family: '', code_bg: '#1d1d1f', code_color: '#f5f5f7', card_bg: 'rgba(255,255,255,.74)', tone: '简洁、现代、克制' },
  { id: 'dark-tech', name: '暗色科技风', description: '深色+霓虹青绿，进阶编程内容', accent_color: '#00e5a0', bg_gradient: 'linear-gradient(135deg, #0a0e17 0%, #111827 48%, #0d1b2a 100%)', font_family: '', code_bg: '#030712', code_color: '#00e5a0', card_bg: 'rgba(17,24,39,.92)', tone: '科技感、黑客风格' },
  { id: 'warm-education', name: '温暖教育风', description: '柔和暖色+圆润卡片，入门教学', accent_color: '#f59e0b', bg_gradient: 'linear-gradient(135deg, #fefce8 0%, #fff7ed 48%, #fef3c7 100%)', font_family: '', code_bg: '#292524', code_color: '#fef3c7', card_bg: 'rgba(255,252,240,.88)', tone: '温暖、耐心、鼓励式' },
  { id: 'business-pro', name: '商务专业风', description: '深蓝基调+金色点缀，企业培训', accent_color: '#d4a853', bg_gradient: 'linear-gradient(135deg, #0c1929 0%, #152238 48%, #0f1f3a 100%)', font_family: '', code_bg: '#020617', code_color: '#e2e8f0', card_bg: 'rgba(21,34,56,.94)', tone: '专业、权威、结构化' },
  { id: 'cartoon-playful', name: '趣味卡通风', description: '多彩渐变+大圆角，少儿编程', accent_color: '#8b5cf6', bg_gradient: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 25%, #fce7f3 55%, #e0e7ff 100%)', font_family: '', code_bg: '#2d1b69', code_color: '#e9d5ff', card_bg: 'rgba(255,255,255,.82)', tone: '活泼、有趣、游戏化' },
  { id: 'academic', name: '学术典雅风', description: '米色底色+衬线字体，大学课程', accent_color: '#8b2500', bg_gradient: 'linear-gradient(135deg, #fdfbf7 0%, #f7f3e8 48%, #faf6ee 100%)', font_family: '', code_bg: '#2c2420', code_color: '#f5e6d3', card_bg: 'rgba(253,251,247,.90)', tone: '学术、严谨、深度' },
]

const VOICE_PROVIDER_OPTIONS = [
  {
    id: 'cosyvoice',
    label: 'CosyVoice',
    description: '阿里云音色，默认推荐',
    defaultVoice: 'longxiaochun',
    defaultSpeed: 1.0,
    defaultPitch: 1.0,
    defaultVolume: 1.0,
    toneHint: '自然、连贯、适合',
    voiceColumns: [
      { id: 'longxiaochun', label: '长小春', description: '默认推荐，沉稳清晰' },
    ],
  },
  {
    id: 'xfyun',
    label: '讯飞 TTS',
    description: '兼容老项目音色',
    defaultVoice: 'xiaoyan',
    defaultSpeed: 45,
    defaultPitch: 50,
    defaultVolume: 65,
    toneHint: '更适合老项目语音风格',
    voiceColumns: [
      { id: 'xiaoyan', label: '小燕', description: '默认推荐，清晰自然' },
    ],
  },
] as const

function getDefaultVoice(providerId: string) {
  return VOICE_PROVIDER_OPTIONS.find((item) => item.id === providerId)?.defaultVoice || 'longxiaochun'
}

function getDefaultVoiceTone(providerId: string): { speed: number; pitch: number; volume: number } {
  const provider = VOICE_PROVIDER_OPTIONS.find((item) => item.id === providerId)
  return {
    speed: provider?.defaultSpeed ?? 1.0,
    pitch: provider?.defaultPitch ?? 1.0,
    volume: provider?.defaultVolume ?? 1.0,
  }
}

function typeLabel(type: string) {
  const map: Record<string, string> = { document: '讲义', ppt: 'PPT', mindmap: '思维导图', quiz: '题集', reading: '阅读', code: '代码案例', video: '视频', blog: '播客电台', discovery: '学习发现', web_material: '网页资料' }
  return map[type] || type
}

const RESOURCE_TABS = [
  { value: '全部', label: '全部' },
  { value: 'document', label: '文档' },
  { value: 'ppt', label: 'PPT' },
  { value: 'video', label: '视频' },
  { value: 'quiz', label: '题目' },
  { value: 'code', label: '代码' },
  { value: 'mindmap', label: '思维导图' },
  { value: 'blog', label: '播客' },
  { value: 'discovery', label: '学习发现' },
  { value: 'web_material', label: '网页资料' },
  { value: 'reading', label: '论坛分享' },
]

function resourceTypeText(type: string) {
  const map: Record<string, string> = {
    document: '文档',
    ppt: 'PPT',
    mindmap: '思维导图',
    quiz: '题目',
    reading: '阅读',
    code: '代码',
    video: '视频',
    blog: '播客',
    discovery: '学习发现',
    web_material: '网页资料',
  }
  return map[type] || typeLabel(type)
}

function resourceIcon(type: string) {
  const map: Record<string, { icon: React.ReactNode; tone: string }> = {
    document: { icon: <FileText className="h-5 w-5" />, tone: 'bg-[#e8f1ff] text-[#2563eb]' },
    ppt: { icon: <Presentation className="h-5 w-5" />, tone: 'bg-[#fff1e8] text-[#ea580c]' },
    video: { icon: <Video className="h-5 w-5" />, tone: 'bg-[#f1e8ff] text-[#7c3aed]' },
    quiz: { icon: <CheckSquare className="h-5 w-5" />, tone: 'bg-[#e9f9ef] text-[#16a34a]' },
    code: { icon: <Code className="h-5 w-5" />, tone: 'bg-[#edf4ff] text-[#3b82f6]' },
    mindmap: { icon: <Brain className="h-5 w-5" />, tone: 'bg-[#fff7e6] text-[#f59e0b]' },
    blog: { icon: <Radio className="h-5 w-5" />, tone: 'bg-[#e6fbff] text-[#0891b2]' },
    discovery: { icon: <Globe className="h-5 w-5" />, tone: 'bg-[#f0fdf4] text-[#059669]' },
    web_material: { icon: <Globe className="h-5 w-5" />, tone: 'bg-[#ecfeff] text-[#0891b2]' },
    reading: { icon: <BookOpen className="h-5 w-5" />, tone: 'bg-[#eefcf3] text-[#059669]' },
  }
  return map[type] || map.document
}

function resourceDate(value: string) {
  if (!value) return '未知日期'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function resourceOriginText(resource: Resource) {
  if (resource.type === 'web_material') return '网页采集'
  if (resource.type === 'reading') return '论坛导入'
  return 'AI 生成'
}

function sortResourcesByLatest(resources: Resource[]) {
  return [...resources].sort((a, b) => {
    const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (timeDiff !== 0) return timeDiff
    return String(b.id).localeCompare(String(a.id))
  })
}

function resourceExcerpt(resource: Resource) {
  if (resource.type === 'web_material') {
    return resource.analysis?.summary || resource.content?.slice(0, 52) || '浏览器插件采集并解析的网页资料。'
  }
  const plain = (resource.content || '')
    .replace(/[#*_`>\-[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain) return plain.slice(0, 52) + (plain.length > 52 ? '...' : '')
  if (resource.type === 'video') return '视频资源已生成，可前往视频中心播放和复习。'
  if (resource.type === 'ppt') return '课件资源，适合按章节快速回顾重点内容。'
  if (resource.type === 'quiz') return '练习题资源，适合完成阶段性自测。'
  return '已保存到我的资源，可继续查看和学习。'
}

function GeneratePageContent() {
  const searchParams = useSearchParams()
  const initialView = searchParams.get('view') === 'library' ? 'library' : 'generate'
  const initialResourceId = searchParams.get('id') || ''
  const { startBackgroundGeneration } = useGenerationTasks()

  const [view, setView] = useState<'generate' | 'library'>(initialView)
  const [step, setStep] = useState(0)
  const [type, setType] = useState<Resource['type']>('document')
  const [prompt, setPrompt] = useState('')
  const [generationFocus, setGenerationFocus] = useState<(typeof GENERATION_FOCUS_OPTIONS)[number]['id']>('project')
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeFile[]>([])
  const [selectedKnowledge, setSelectedKnowledge] = useState<number[]>([])
  const [resource, setResource] = useState<Resource | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // 视频模块专用状态
  const [videoStyleId, setVideoStyleId] = useState('apple-minimal')
  const [videoLevel, setVideoLevel] = useState('beginner')
  const [videoDuration] = useState(90)
  const [videoVoiceProvider, setVideoVoiceProvider] = useState<'cosyvoice' | 'xfyun'>('cosyvoice')
  const [videoVoice, setVideoVoice] = useState(getDefaultVoice('cosyvoice'))
  const defaultVoiceTone = getDefaultVoiceTone('cosyvoice')
  const [videoVoiceSpeed, setVideoVoiceSpeed] = useState<number>(defaultVoiceTone.speed)
  const [videoVoicePitch, setVideoVoicePitch] = useState<number>(defaultVoiceTone.pitch)
  const [videoVoiceVolume, setVideoVoiceVolume] = useState<number>(defaultVoiceTone.volume)
  const [videoStyles, setVideoStyles] = useState<VideoStyle[]>(DEFAULT_VIDEO_STYLES)
  const [polishResult, setPolishResult] = useState<VideoPolishResult | null>(null)
  const [polishError, setPolishError] = useState('')
  const [polishing, setPolishing] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [showSegments, setShowSegments] = useState(false)
  const [sseMessages, setSseMessages] = useState<string[]>([])

  // 资源库相关状态
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedId, setSelectedId] = useState<string>(initialResourceId)
  const [query, setQuery] = useState('')
  const [libraryCollapsed, setLibraryCollapsed] = useState(false)
  const [filter, setFilter] = useState('全部')
  const [libraryError, setLibraryError] = useState('')
  const [deletingResourceId, setDeletingResourceId] = useState('')
  const [downloadingResourceId, setDownloadingResourceId] = useState('')
  const [detailLoadingId, setDetailLoadingId] = useState('')
  const [qualityLoadingId, setQualityLoadingId] = useState('')
  const [qualityResults, setQualityResults] = useState<Record<string, ResourceQualityResult>>({})
  const [qualityDialogResourceId, setQualityDialogResourceId] = useState('')
  const [failureDialog, setFailureDialog] = useState<{ message: string; detail?: string } | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([api.getProfile(), api.getKnowledgeFiles({ status: 'indexed' })]).then(([p, k]) => {
      if (!mounted) return
      if (p.status === 'fulfilled') setProfile(p.value)
      if (k.status === 'fulfilled') setKnowledge(k.value)
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    void api.getVideoStyles()
      .then((styles) => {
        if (!mounted) return
        setVideoStyles((Array.isArray(styles) && styles.length > 0) ? styles : DEFAULT_VIDEO_STYLES)
      })
      .catch(() => {
        if (!mounted) return
        setVideoStyles(DEFAULT_VIDEO_STYLES)
      })
    return () => {
      mounted = false
    }
  }, [])

  const loadResources = useCallback(async () => {
    try {
      setLibraryError('')
      const data = await api.getResources()
      const sorted = sortResourcesByLatest(data)
      setResources(sorted)
      setSelectedId(prev => {
        if (prev && sorted.some((item) => item.id === prev)) return prev
        if (initialResourceId && sorted.some((item) => item.id === initialResourceId)) return initialResourceId
        return sorted[0]?.id || ''
      })
    } catch (ex) {
      setLibraryError(ex instanceof Error ? ex.message : '资源读取失败')
    }
  }, [initialResourceId])

  useEffect(() => {
    if (view === 'library') {
      void loadResources()
    }
  }, [loadResources, view])

  function buildFocusedPrompt() {
    const focus = GENERATION_FOCUS_OPTIONS.find((item) => item.id === generationFocus)
    return focus ? `${prompt.trim()}\n\n${focus.promptHint}` : prompt.trim()
  }

  async function startGenerate() {
    if (!prompt.trim()) {
      setError('请先填写这次要生成的真实学习内容。')
      return
    }
    console.log('[startGenerate] type:', type, 'prompt:', prompt.slice(0, 50))
    setStep(3)
    setGenerating(true)
    setError('')
    setGenerateError('')
    setSseMessages([])
    setResource(null)
    try {
      const focusedPrompt = buildFocusedPrompt()
      const res = await api.generateResource(
        type,
        focusedPrompt,
        selectedKnowledge,
        type === 'video' ? getVideoOptions() : undefined,
      )
      setResource(res)
      setResources((prev) => sortResourcesByLatest([res, ...prev.filter((item) => item.id !== res.id)]))
      setSelectedId(res.id)
      setStep(4)
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : '生成失败'
      setError(msg)
      if (type === 'video') setGenerateError(msg)
      setFailureDialog({
        message: '资源生成没有成功完成，请联系项目负责人处理。',
        detail: msg,
      })
    } finally {
      setGenerating(false)
    }
  }

  async function handlePolish() {
    setPolishing(true)
    setPolishError('')
    setPolishResult(null)
    setShowSegments(false)
    try {
      const result = await api.polishVideoPrompt(buildFocusedPrompt(), videoDuration, videoLevel, videoStyleId, videoVoice)
      setPolishResult(result)
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : '润色失败'
      setPolishError(msg)
      setFailureDialog({
        message: '视频脚本润色失败，请联系项目负责人处理。',
        detail: msg,
      })
    } finally {
      setPolishing(false)
    }
  }

  function getVideoOptions() {
    return {
      durationSec: videoDuration,
      targetLevel: videoLevel,
      styleId: videoStyleId,
      voice: videoVoice,
      voiceProvider: videoVoiceProvider,
      voiceSpeed: videoVoiceSpeed,
      voicePitch: videoVoicePitch,
      voiceVolume: videoVoiceVolume,
      onEvent: (evt: { type: string; payload: Record<string, unknown> }) => {
        if (evt.type === 'progress') {
          const msg = String(evt.payload.message || '')
          if (msg) setSseMessages(prev => [...prev, msg])
        }
        if (evt.type === 'error') {
          const msg = String(evt.payload.message || '视频生成失败')
          setGenerateError(msg)
          setFailureDialog({
            message: '视频生成没有成功完成，请联系项目负责人处理。',
            detail: msg,
          })
        }
      },
    }
  }

  async function removeResource(id: string) {
    if (!id || deletingResourceId === id) return
    const target = resources.find((item) => item.id === id)
    const title = target?.title || '该资源'
    if (!window.confirm(`确定删除《${title}》吗？删除后将无法恢复。`)) return

    setDeletingResourceId(id)
    setLibraryError('')
    try {
      await api.deleteResource(id)
      await loadResources()
    } catch (ex) {
      setLibraryError(ex instanceof Error ? ex.message : '删除资源失败')
    } finally {
      setDeletingResourceId('')
    }
  }

  async function downloadSelectedResource(res: Resource) {
    if (!res.id || downloadingResourceId === res.id) return

    setDownloadingResourceId(res.id)
    setLibraryError('')
    try {
      await api.downloadResource(res.id)
    } catch (ex) {
      setLibraryError(ex instanceof Error ? ex.message : '下载资源失败')
    } finally {
      setDownloadingResourceId('')
    }
  }

  async function openLibraryView(nextSelectedId?: string) {
    setQuery('')
    setFilter('全部')
    setLibraryError('')
    if (nextSelectedId) {
      setSelectedId(nextSelectedId)
    }
    setView('library')
    await loadResources()
  }

  function openResourceNotes(res: Resource) {
    window.dispatchEvent(new CustomEvent('open-learning-notes', {
      detail: {
        source: {
          type: 'resource',
          id: res.id,
          title: res.title,
          href: `/generate?view=library&id=${res.id}`,
        },
        draftTitle: `关于${res.title}的笔记`,
        openEditor: true,
      },
    }))
  }

  async function handleEvaluateResourceQuality(res: Resource) {
    if (!res?.id || qualityLoadingId === res.id) return
    setQualityLoadingId(res.id)
    try {
      const result = await api.evaluateResourceQuality(res.id)
      setQualityResults(prev => ({ ...prev, [res.id]: result }))
      setQualityDialogResourceId(res.id)
    } catch (ex) {
      setLibraryError(ex instanceof Error ? ex.message : '资源质量评估失败')
    } finally {
      setQualityLoadingId('')
    }
  }

  const filtered = resources.filter((r) => {
    const term = query.trim().toLowerCase()
    const matchQuery = !term || r.title.toLowerCase().includes(term) || r.type.toLowerCase().includes(term)
    const matchFilter = filter === '全部' || r.type === filter
    return matchQuery && (matchFilter || filter === '全部')
  })
  const selected = filtered.find(r => r.id === selectedId) || filtered[0]
  const selectedQuality = selected ? qualityResults[selected.id] : null
  const generatedQuality = resource ? qualityResults[resource.id] : null
  const generatedPreviewUrl = resource && (resource.sourceUrl || resource.type === 'mindmap')
    ? buildUrlAccessUrl(`/api/resources/${resource.id}/preview/html`)
    : ''
  const activeQualityResource = (resource && resource.id === qualityDialogResourceId)
    ? resource
    : resources.find(item => item.id === qualityDialogResourceId) || null
  const activeQualityResult = qualityDialogResourceId ? qualityResults[qualityDialogResourceId] || null : null

  useEffect(() => {
    if (view !== 'library' || !selected?.id || selected.type !== 'web_material' || selected.content) return
    let mounted = true
    setDetailLoadingId(selected.id)
    void api.getResource(selected.id)
      .then((detail) => {
        if (!mounted) return
        setResources(prev => prev.map(item => item.id === detail.id ? { ...item, ...detail } : item))
      })
      .catch((ex) => {
        if (!mounted) return
        setLibraryError(ex instanceof Error ? ex.message : '资源详情读取失败')
      })
      .finally(() => {
        if (mounted) setDetailLoadingId('')
      })
    return () => {
      mounted = false
    }
  }, [selected?.id, selected?.type, selected?.content, view])

  if (view === 'library') {
    const selectedIcon = selected ? resourceIcon(selected.type) : resourceIcon('document')
    const completedCount = resources.filter(r => r.status === 'completed').length
    const previewUrl = selected && selected.type !== 'web_material' && (selected.sourceUrl || selected.type === 'mindmap')
      ? buildUrlAccessUrl(`/api/resources/${selected.id}/preview/html`)
      : ''

    return (
      <div className="min-h-[calc(100vh-112px)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 text-small font-extrabold text-soft">资源中心 / 我的资源</div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 text-[26px] font-bold leading-tight text-ink">我的资源</h1>
              <button
                onClick={() => setView('generate')}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-[#bfdbfe] bg-white px-3.5 text-small font-bold text-blue transition-colors hover:bg-blue-light"
              >
                <ArrowLeft className="h-4 w-4" />
                返回资源生成
              </button>
            </div>
          </div>
          <div className="flex min-w-[260px] flex-1 items-center justify-end gap-3">
            <div className="flex h-10 w-full max-w-[360px] items-center gap-2 rounded-[12px] border border-line bg-white px-3 shadow-sm">
              <Search className="h-4 w-4 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-small outline-none"
                placeholder="搜索资源名称"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-muted transition-colors hover:text-ink" aria-label="清空搜索">
                  ×
                </button>
              )}
            </div>
            <ProtoButton href="/generate" variant="secondary"><Sparkles className="h-4 w-4" />生成资源</ProtoButton>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-3">
          {RESOURCE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`h-9 rounded-full px-5 text-small font-bold transition-colors ${
                filter === tab.value || (tab.value === '全部' && filter === '全部')
                  ? 'bg-blue text-white shadow-sm'
                  : 'bg-transparent text-ink hover:bg-[#eef5ff] hover:text-blue'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={`grid h-[calc(100vh-180px)] min-h-[720px] overflow-hidden rounded-[14px] border border-line bg-white shadow-md transition-[grid-template-columns] duration-300 max-[980px]:h-auto max-[980px]:min-h-0 max-[980px]:grid-cols-1 ${
          libraryCollapsed ? 'grid-cols-[76px_minmax(0,1fr)]' : 'grid-cols-[370px_minmax(0,1fr)]'
        }`}>
          <aside className="flex h-full min-h-0 flex-col border-r border-line bg-white">
            <div className="flex h-[62px] items-center justify-between border-b border-line px-4">
              {!libraryCollapsed && (
                <div>
                  <b className="block text-small text-ink">全部资源（{filtered.length}）</b>
                  <span className="text-micro text-muted">可学习 {completedCount} / 总计 {resources.length}</span>
                </div>
              )}
              <button
                onClick={() => setLibraryCollapsed(prev => !prev)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-line bg-white text-muted transition-colors hover:border-blue hover:text-blue"
                title={libraryCollapsed ? '展开资源列表' : '折叠资源列表'}
              >
                {libraryCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {filtered.map((res) => {
                const meta = resourceIcon(res.type)
                const active = selected?.id === res.id
                return (
                  <div
                    key={res.id}
                    className={`mb-3 flex items-start gap-3 rounded-[12px] border p-3 transition-colors ${
                      active ? 'border-blue bg-[#eef5ff]' : 'border-transparent bg-white hover:border-line hover:bg-[#f8fbff]'
                    } ${libraryCollapsed ? 'justify-center px-2' : ''}`}
                    title={res.title}
                  >
                    <button
                      onClick={() => setSelectedId(res.id)}
                      className={`flex min-w-0 flex-1 items-start gap-3 text-left ${libraryCollapsed ? 'justify-center' : ''}`}
                    >
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${meta.tone}`}>
                        {meta.icon}
                      </span>
                      {!libraryCollapsed && (
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <b className="line-clamp-1 min-w-0 text-small text-ink">{res.title}</b>
                            <span className="shrink-0 rounded-md bg-[#edf4ff] px-2 py-0.5 text-[11px] font-bold text-blue">{resourceTypeText(res.type)}</span>
                          </span>
                          <span className="mt-1 block text-micro text-muted">{resourceOriginText(res)} · {resourceDate(res.createdAt)}</span>
                          <span className="mt-1 block line-clamp-1 text-micro text-muted">{resourceExcerpt(res)}</span>
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
              {!filtered.length && (
                <div className="rounded-[12px] border border-dashed border-line p-4 text-center text-small text-muted">
                  暂无匹配资源
                </div>
              )}
            </div>
          </aside>

          <section className="flex h-full min-h-0 min-w-0 flex-col bg-[#f8fafc]">
            {libraryError && <p className="m-4 rounded-[10px] bg-red-light p-3 text-small text-red">{libraryError}</p>}
            {selected ? (
              <div className="flex h-full min-h-0 flex-col">
                <header className="flex min-h-[92px] flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-6 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] ${selectedIcon.tone}`}>{selectedIcon.icon}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="line-clamp-1 text-[20px] font-bold text-ink">{selected.title}</h2>
                        <span className="rounded-md bg-[#edf4ff] px-2 py-1 text-micro font-bold text-blue">{resourceTypeText(selected.type)}</span>
                      </div>
                      <p className="mt-1 text-small text-muted">
                        {resourceOriginText(selected)} · {resourceDate(selected.createdAt)}
                        {selected.type === 'web_material' ? '' : ` · ${selected.progress ?? 42}% 进度`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-nowrap items-center gap-2 overflow-x-auto [&>*:last-child]:shrink-0 [&>*:nth-child(3)]:hidden [&>*:nth-child(5)]:hidden">
                    <ProtoButton
                      variant="secondary"
                      onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant', { detail: { prompt: `请讲解这份资源《${selected.title}》的核心内容，并结合我当前的学习情况告诉我应该怎么学。` } }))}
                    ><Sparkles className="h-4 w-4" />AI 讲解</ProtoButton>
                    <ResourceQualityTrigger
                      result={selectedQuality}
                      loading={qualityLoadingId === selected.id}
                      onEvaluate={() => void handleEvaluateResourceQuality(selected)}
                      onOpen={() => setQualityDialogResourceId(selected.id)}
                    />
                    <ProtoButton variant="secondary"><Sparkles className="h-4 w-4" />AI </ProtoButton>
                    <ProtoButton
                      variant="tertiary"
                      onClick={() => void downloadSelectedResource(selected)}
                      disabled={downloadingResourceId === selected.id}
                    >
                      {downloadingResourceId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {downloadingResourceId === selected.id ? '下载中...' : '下载'}
                    </ProtoButton>
                    <ProtoButton variant="tertiary" onClick={() => openResourceNotes(selected)}><NotebookPen className="h-4 w-4" />笔记</ProtoButton>
                    <button
                      onClick={() => void removeResource(selected.id)}
                      disabled={deletingResourceId === selected.id}
                      className="grid h-9 w-9 place-items-center rounded-[8px] border border-line bg-white text-muted transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red disabled:cursor-not-allowed disabled:opacity-60"
                      title="删除资源"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-hidden bg-white">
                  <div className="h-full w-full overflow-y-auto px-10 py-9 max-[760px]:px-5">
                    {selected.type === 'blog' ? (
                      <AudioRadio
                        tracks={(() => {
                          let content = selected.content || ''
                          content = content.replace(/^#[^\n]*\n+/, '').trim()
                          if (!content) return [{ id: '1', title: selected.title, text: '播客内容加载中...', subtitle: '' }]
                          const paragraphs = content.split(/\n{2,}/).filter(p => p.trim().length > 20)
                          if (paragraphs.length <= 1) return [{ id: '1', title: selected.title, text: content.replace(/[#*`>\-|[\]()]/g, '').slice(0, 2000), subtitle: content.slice(0, 50) + '...' }]
                          return paragraphs.slice(0, 10).map((p, idx) => ({
                            id: `${idx + 1}`,
                            title: `第 ${idx + 1} 段`,
                            text: p.replace(/[#*`>\-|[\]()]/g, '').slice(0, 1000),
                            subtitle: p.replace(/[#*`>\-|[\]()]/g, '').slice(0, 60) + '...',
                          }))
                        })()}
                      />
                    ) : selected.type === 'web_material' ? (
                      <WebMaterialPreview resource={selected} loading={detailLoadingId === selected.id} />
                    ) : previewUrl ? (
                      <iframe title={selected.title} src={previewUrl} className="h-full min-h-[560px] w-full border-0" />
                    ) : selected.type === 'video' ? (
                      <div className="grid min-h-[420px] place-items-center rounded-[12px] bg-[#0f172a] text-white">
                        <div className="text-center">
                          <Video className="mx-auto mb-4 h-16 w-16 text-white/70" />
                          <b className="block text-[22px]">视频资源已生成</b>
                          <p className="mt-2 text-small text-white/70">前往视频中心查看完整预览和播放。</p>
                          <ProtoButton href="/video" className="mt-5">进入视频中心</ProtoButton>
                        </div>
                      </div>
                    ) : (
                      <article className="prose prose-slate max-h-[calc(100vh-300px)] max-w-none overflow-y-auto pr-3">
                        <h1 className="mb-8 text-[30px] font-bold text-ink">{selected.title}</h1>
                        <MarkdownCodePreview
                          content={selected.content || '该资源暂无预览内容。'}
                          editable={selected.type === 'code'}
                        />
                        {selected.type === 'code' && <CodePracticePanel resource={selected} />}
                      </article>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid min-h-[680px] place-items-center p-6">
                <div className="max-w-[360px] text-center">
                  <BookOpen className="mx-auto mb-3 h-10 w-10 text-blue" />
                  <b className="text-h2 text-ink">暂无资源</b>
                  <p className="mt-2 text-small text-muted">先生成或从论坛导入资源后，这里会展示资源列表和预览内容。</p>
                  <ProtoButton href="/generate" className="mt-4">生成资源</ProtoButton>
                </div>
              </div>
            )}
          </section>
          <ResourceQualityDialog
            open={Boolean(activeQualityResource && activeQualityResult)}
            resource={activeQualityResource}
            result={activeQualityResult}
            onClose={() => setQualityDialogResourceId('')}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-5 border-b border-line pb-4">
        <div className="mb-2 text-small font-extrabold text-soft">资源中心 / 生成与我的资源</div>
        <div className="flex items-center gap-3">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#eff6ff] text-[#2563eb]">
            <Sparkles className="h-4 w-4" />
          </div>
          <h1 className="m-0 text-h1 font-bold leading-tight tracking-normal text-ink">资源中心</h1>
          <button onClick={() => void openLibraryView(resource?.id)} className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] px-3.5 text-small font-bold transition-colors bg-white text-blue ring-1 ring-[#bfdbfe] hover:bg-blue-light">我的资源</button>
        </div>
        <p className="mt-2 max-w-[760px] text-body leading-7 text-muted">在这里生成个性化学习资源，也可以查看已保存的资源。</p>
      </header>

      <ProtoCard className="mb-4 overflow-hidden p-0">
        <div className="grid grid-cols-6 max-[900px]:grid-cols-3 max-[560px]:grid-cols-2">
          {STEPS.map((label, idx) => (
            <button
              key={label}
              onClick={() => setStep(idx)}
              className={`min-h-16 border-0 border-r border-[#eef2f7] p-3 text-left last:border-r-0 ${idx === step ? 'bg-blue-light text-blue shadow-[inset_0_-3px_0_#2563eb]' : idx < step ? 'bg-green-light text-green' : 'bg-white text-muted'}`}
            >
              <span className={`grid h-6 w-6 place-items-center rounded-md text-[11px] font-extrabold ${idx === step ? 'bg-[#eff6ff] text-[#2563eb]' : idx < step ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#f1f5f9] text-muted'}`}>0{idx + 1}</span>
              <b className="mt-1 block text-small">{label}</b>
            </button>
          ))}
        </div>
      </ProtoCard>

      <ProtoCard className="p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><b className="text-ink">资源生成流程</b><p className="text-micro text-muted">按步骤确认上下文、资料来源和生成要求，生成完成后会自动保存到我的资源。</p></div>
          <Pill tone="blue">{profile?.weakPoints?.[0] ? `当前：${profile.weakPoints[0]}` : '当前：暂无画像薄弱点'}</Pill>
        </div>
        <div className="p-5">
        <div className="mb-4 flex flex-col items-start gap-3 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
          <div>
            <Pill tone={generating ? 'blue' : resource ? 'green' : 'neutral'}>{generating ? '生成中' : resource ? '已完成' : '待配置'}</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">{step === 0 ? '确认这次资源要解决什么问题' : step === 1 ? '选择最适合这个节点的资源类型' : step === 2 ? '配置生成要求' : step === 3 ? '生成过程' : step === 4 ? '结果预览' : '已自动保存'}</h2>
          </div>
          <div className="flex w-full flex-wrap gap-2 min-[760px]:w-auto">
            <ProtoButton variant="tertiary" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>上一步</ProtoButton>
            {step < 3 && <ProtoButton onClick={() => setStep(step + 1)}>下一步</ProtoButton>}
            {step === 3 && <ProtoButton onClick={() => void startGenerate()} disabled={generating}><Play className="h-4 w-4" />{type === 'video' ? '生成视频' : '开始生成'}</ProtoButton>}
            {step === 2 && <ProtoButton variant="secondary" onClick={() => { startBackgroundGeneration(type, buildFocusedPrompt(), selectedKnowledge, type === 'video' ? { styleId: videoStyleId, durationSec: videoDuration, voice: videoVoice, voiceProvider: videoVoiceProvider, voiceSpeed: videoVoiceSpeed, voicePitch: videoVoicePitch, voiceVolume: videoVoiceVolume } : undefined); setStep(0) }}>后台生成</ProtoButton>}
          </div>
        </div>

        {step === 0 && (
          <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
            <SoftCard><b className="text-ink">当前节点</b><p className="mt-2 text-small text-muted">{profile?.currentStage || '暂无当前节点。完成画像采集或创建学习路径后会自动带入。'}</p></SoftCard>
            <SoftCard><b className="text-ink">学生偏好</b><p className="mt-2 text-small text-muted">{profile?.learningPreference?.length ? profile.learningPreference.join('、') : '暂无学习偏好。新用户不会默认套用演示偏好。'}</p></SoftCard>
            <SoftCard><b className="text-ink">错题证据</b><p className="mt-2 text-small text-muted">3 道题把局部变量、返回值和 print 输出混在一起。</p></SoftCard>
            <SoftCard><b className="text-ink">本次目标</b><p className="mt-2 text-small text-muted">12 分钟内能解释"函数内部算出的结果如何交给主流程"。</p></SoftCard>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
            {TYPES.map((item) => {
              const IconMap: Record<string, { icon: React.ReactNode; color: string }> = {
                document: { icon: <FileText className="h-4 w-4" />, color: 'bg-[#eff6ff] text-[#2563eb]' },
                ppt: { icon: <Presentation className="h-4 w-4" />, color: 'bg-[#fff7ed] text-[#d97706]' },
                mindmap: { icon: <Brain className="h-4 w-4" />, color: 'bg-[#f3efff] text-[#7c3aed]' },
                video: { icon: <Video className="h-4 w-4" />, color: 'bg-[#f3efff] text-[#7c3aed]' },
                blog: { icon: <Radio className="h-4 w-4" />, color: 'bg-[#ecfeff] text-[#0891b2]' },
                quiz: { icon: <CheckSquare className="h-4 w-4" />, color: 'bg-[#fff7ed] text-[#d97706]' },
                reading: { icon: <BookOpen className="h-4 w-4" />, color: 'bg-[#ecfdf5] text-[#059669]' },
                code: { icon: <Code className="h-4 w-4" />, color: 'bg-[#eff6ff] text-[#2563eb]' },
              }
              const t = IconMap[item.type] || { icon: <FileText className="h-4 w-4" />, color: 'bg-[#eff6ff] text-[#2563eb]' }
              return (
                <button key={item.type} onClick={() => { setType(item.type); setPrompt(TYPE_PROMPTS[item.type] || '') }} className={`rounded-[12px] border p-4 text-left ${type === item.type ? 'border-blue bg-blue-light' : 'border-line bg-white hover:border-blue'}`}>
                  <div className={`mb-3 grid h-9 w-9 place-items-center rounded-xl ${t.color}`}>
                    {t.icon}
                  </div>
                  <b className="block text-ink">{item.label}</b>
                  <span className="mt-1 block text-small text-muted">{item.desc}</span>
                </button>
              )
            })}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
            <div>
              <h3 className="text-h3 font-bold text-ink">生成侧重点</h3>
              <div className="mt-3 grid gap-3">
                {GENERATION_FOCUS_OPTIONS.map((option) => {
                  const selected = generationFocus === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setGenerationFocus(option.id)}
                      aria-pressed={selected}
                      className={`rounded-[12px] border p-4 text-left transition-all ${
                        selected
                          ? 'border-blue bg-blue-light shadow-[0_10px_24px_rgba(37,99,235,0.12)]'
                          : 'border-line bg-white hover:border-blue/50 hover:bg-[#f8fbff]'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <b className="text-ink">{option.title}</b>
                        {selected && <CheckCircle2 className="h-4 w-4 text-blue" />}
                      </span>
                      <span className="mt-1 block text-small text-muted">{option.description}</span>
                    </button>
                  )
                })}
              </div>

              {/* 视频风格选择器 —— 仅在选择"教学视频"时显示 */}
              {type === 'video' && (
                <div className="mt-4">
                  <h3 className="text-h3 font-bold text-ink mb-1">视频风格</h3>
                  <p className="mb-3 text-micro text-muted">模板来自后端 `/api/video/styles`，页面只做展示和选择，避免前后端模板重复维护。</p>
                  <div className="grid grid-cols-2 gap-2">
                    {videoStyles.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setVideoStyleId(s.id)}
                        className={`rounded-[12px] border p-3 text-left transition-all ${videoStyleId === s.id ? 'border-blue bg-blue-light ring-2 ring-blue/20' : 'border-line bg-white hover:border-blue/50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="grid h-5 w-5 place-items-center rounded-full border border-white/20 shadow-sm" style={{ background: s.bg_gradient }}>
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.accent_color }} />
                          </span>
                          <b className="text-small text-ink">{s.name}</b>
                          {videoStyleId === s.id && <CheckCircle2 className="ml-auto h-4 w-4 text-blue" />}
                        </div>
                        <p className="text-micro text-muted leading-relaxed">{s.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-4">
            {/* 视频专用：难度 & 时长 */}
            {type === 'video' && (
              <>
                <div>
                  <span className="text-small font-bold text-ink mb-2 block">难度级别</span>
                  <div className="flex gap-2">
                    {[
                      { value: 'beginner', label: '入门', desc: '零基础友好' },
                      { value: 'intermediate', label: '进阶', desc: '有一定基础' },
                      { value: 'advanced', label: '精通', desc: '深入原理' },
                    ].map((lvl) => (
                      <button
                        key={lvl.value}
                        onClick={() => setVideoLevel(lvl.value)}
                        className={`flex-1 rounded-[12px] border p-3 text-center transition-all ${videoLevel === lvl.value ? 'border-blue bg-blue-light ring-2 ring-blue/20' : 'border-line bg-white hover:border-blue/50'}`}
                      >
                        <b className="block text-small text-ink">{lvl.label}</b>
                        <span className="text-micro text-muted">{lvl.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-[14px] border border-line bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <b className="block text-small text-ink">当前配音方案</b>
                      <span className="mt-1 block text-micro text-muted">视频讲解已统一使用固定音色，不再提供切换选项。</span>
                    </div>
                    <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-micro font-bold text-blue">讯飞语音</span>
                  </div>
                  <div className="mt-3 rounded-[12px] bg-[#f8fafc] p-3 text-small text-muted">
                    默认音色：{videoVoice}
                  </div>
                </div>
                <div className="hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-small font-bold text-ink">音色选择</span>
                    <span className="text-micro text-muted">默认 CosyVoice</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {VOICE_PROVIDER_OPTIONS.map((provider) => {
                      const active = videoVoiceProvider === provider.id
                      return (
                        <div
                          key={provider.id}
                          onClick={() => {
                            setVideoVoiceProvider(provider.id as 'cosyvoice' | 'xfyun')
                            setVideoVoice(provider.defaultVoice)
                            setVideoVoiceSpeed(provider.defaultSpeed)
                            setVideoVoicePitch(provider.defaultPitch)
                            setVideoVoiceVolume(provider.defaultVolume)
                          }}
                          className={`cursor-pointer rounded-[14px] border p-4 text-left transition-all ${active ? 'border-blue bg-blue-light ring-2 ring-blue/20' : 'border-line bg-white hover:border-blue/50'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <b className="block text-small text-ink">{provider.label}</b>
                              <span className="mt-1 block text-micro text-muted">{provider.description}</span>
                              <span className="mt-1 block text-micro text-muted">{provider.toneHint}</span>
                            </div>
                            {active && <CheckCircle2 className="h-4 w-4 text-blue" />}
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {provider.voiceColumns.map((voice) => {
                              const voiceActive = active && videoVoice === voice.id
                              return (
                                <button
                                  key={voice.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setVideoVoiceProvider(provider.id as 'cosyvoice' | 'xfyun')
                                    setVideoVoice(voice.id)
                                  }}
                                  className={`rounded-[12px] border px-3 py-2 text-left transition-all ${voiceActive ? 'border-blue bg-white shadow-sm' : 'border-dashed border-[#dbe3ee] bg-[#f8fafc] hover:border-blue/50'}`}
                                >
                                  <span className="block text-small font-bold text-ink">{voice.label}</span>
                                  <span className="mt-1 block text-micro text-muted">{voice.id}</span>
                                  <span className="mt-1 block text-micro text-muted">{voice.description}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 rounded-[14px] border border-line bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <b className="block text-small text-ink">语音语调</b>
                        <span className="block text-micro text-muted">这三个参数会和音色一起传给后端 TTS</span>
                      </div>
                      <span className="text-micro text-muted">{videoVoiceProvider === 'cosyvoice' ? 'CosyVoice' : '讯飞 TTS'}</span>
                    </div>
                    <div className="grid gap-3">
                      <label className="grid gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-small font-medium text-ink">语速</span>
                          <span className="text-micro text-muted">{videoVoiceProvider === 'cosyvoice' ? videoVoiceSpeed.toFixed(1) : Math.round(videoVoiceSpeed)}</span>
                        </div>
                        <input
                          type="range"
                          min={videoVoiceProvider === 'cosyvoice' ? 0.7 : 20}
                          max={videoVoiceProvider === 'cosyvoice' ? 1.5 : 80}
                          step={videoVoiceProvider === 'cosyvoice' ? 0.1 : 1}
                          value={videoVoiceSpeed}
                          onChange={(event) => setVideoVoiceSpeed(Number(event.target.value))}
                          className="w-full"
                        />
                      </label>
                      <label className="grid gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-small font-medium text-ink">音高</span>
                          <span className="text-micro text-muted">{videoVoiceProvider === 'cosyvoice' ? videoVoicePitch.toFixed(1) : Math.round(videoVoicePitch)}</span>
                        </div>
                        <input
                          type="range"
                          min={videoVoiceProvider === 'cosyvoice' ? 0.7 : 20}
                          max={videoVoiceProvider === 'cosyvoice' ? 1.5 : 80}
                          step={videoVoiceProvider === 'cosyvoice' ? 0.1 : 1}
                          value={videoVoicePitch}
                          onChange={(event) => setVideoVoicePitch(Number(event.target.value))}
                          className="w-full"
                        />
                      </label>
                      <label className="grid gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-small font-medium text-ink">音量</span>
                          <span className="text-micro text-muted">{videoVoiceProvider === 'cosyvoice' ? videoVoiceVolume.toFixed(1) : Math.round(videoVoiceVolume)}</span>
                        </div>
                        <input
                          type="range"
                          min={videoVoiceProvider === 'cosyvoice' ? 0.5 : 20}
                          max={videoVoiceProvider === 'cosyvoice' ? 1.5 : 100}
                          step={videoVoiceProvider === 'cosyvoice' ? 0.1 : 1}
                          value={videoVoiceVolume}
                          onChange={(event) => setVideoVoiceVolume(Number(event.target.value))}
                          className="w-full"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            <label className="grid gap-2">
              <span className="text-small font-bold text-ink">生成要求</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={type === 'video' ? 4 : 7} placeholder="填写你这次真正想生成的学习内容。新用户没有画像数据时，系统不会自动带入演示薄弱点。" className="rounded-[14px] border border-line bg-[#f9fafb] p-4 text-small leading-6 outline-none focus:border-blue" />
            </label>

            {/* 视频：润色按钮 + 结果 */}
            {type === 'video' && (
              <>
                <button
                  onClick={handlePolish}
                  disabled={polishing || !prompt.trim()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-blue px-4 text-small font-bold text-white transition-colors hover:bg-blue-dark disabled:opacity-50"
                >
                  {polishing ? (
                    <><TypewriterLoader size="sm" /> AI 润色中...</>
                  ) : (
                    <><Zap className="h-4 w-4" /> AI 润色脚本</>
                  )}
                </button>

                {/* 润色错误卡片 */}
                {polishError && (
                  <div className="rounded-[12px] border-2 border-red/30 bg-red-light p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red" />
                      <div>
                        <b className="block text-small text-red">润色失败</b>
                        <p className="mt-1 text-small text-muted">{polishError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 润色结果卡片 */}
                {polishResult && !polishError && (
                  <div className="rounded-[14px] border border-line bg-white overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-light px-2 py-0.5 text-micro font-bold text-green">
                          <CheckCircle2 className="h-3 w-3" /> AI 已润色
                        </span>
                        <span className="text-micro text-muted">
                          来源：{polishResult.contentSource === 'ai' ? 'AI 生成' : '本地'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-small text-muted mb-3">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> 预计 {Math.floor(polishResult.estimatedDurationSec / 60)} 分 {polishResult.estimatedDurationSec % 60} 秒</span>
                        <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {polishResult.scriptOutline?.length || 0} 个分镜</span>
                        {polishResult.styleName && <span className="flex items-center gap-1">风格：{polishResult.styleName}</span>}
                      </div>
                      <button
                        onClick={() => setShowSegments(!showSegments)}
                        className="flex items-center gap-1 text-small font-bold text-blue hover:text-blue-dark transition-colors"
                      >
                        {showSegments ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        分镜详情
                      </button>
                    </div>
                    {showSegments && (
                      <div className="border-t border-line divide-y divide-line">
                        {(polishResult.scriptOutline || []).map((seg: VideoScriptSegment) => (
                          <div key={seg.segment_id} className="p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Pill tone="blue">{seg.slide_type || 'concept'}</Pill>
                              <b className="text-small text-ink">{seg.title}</b>
                            </div>
                            {seg.subtitle && <p className="text-micro text-muted mb-1">{seg.subtitle}</p>}
                            <p className="text-micro text-muted line-clamp-2">{seg.narration}</p>
                            {seg.duration_ms && (
                              <span className="text-micro text-muted">{Math.round(seg.duration_ms / 1000)}s</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-small font-bold text-ink">选择已整理资料</span>
                <ProtoButton href="/knowledge" variant="ghost">去知识库</ProtoButton>
              </div>
              <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
                {knowledge.map((file) => (
                  <label key={file.id} className="flex gap-3 rounded-[12px] border border-line bg-white p-3">
                    <input
                      type="checkbox"
                      checked={selectedKnowledge.includes(file.id)}
                      onChange={(event) => setSelectedKnowledge(prev => event.target.checked ? [...prev, file.id] : prev.filter(id => id !== file.id))}
                    />
                    <span className="min-w-0">
                      <b className="block truncate text-small text-ink">{file.filename}</b>
                      <span className="text-micro text-muted">{file.chunkCount} 条片段 · {file.tags.slice(0, 2).join('、')}</span>
                    </span>
                  </label>
                ))}
                {!knowledge.length && <SoftCard className="text-small text-muted">暂无已整理资料，可先到知识库上传并整理。</SoftCard>}
              </div>
            </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3">
            {type === 'video' && sseMessages.length > 0 ? (
              <>
                <SoftCard className="bg-blue-light">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: videoStyles.find(s => s.id === videoStyleId)?.bg_gradient }}>
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: videoStyles.find(s => s.id === videoStyleId)?.accent_color }} />
                    </span>
                    <b className="text-small text-ink">{videoStyles.find(s => s.id === videoStyleId)?.name || videoStyleId}</b>
                    <span className="text-micro text-muted">{videoLevel === 'beginner' ? '入门' : videoLevel === 'intermediate' ? '进阶' : '精通'} · {Math.floor(videoDuration / 60)}分{videoDuration % 60}秒</span>
                  </div>
                </SoftCard>
                {sseMessages.map((msg, idx) => (
                  <SoftCard key={idx} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-small font-bold text-ink">
                      {generating && idx >= sseMessages.length - 1 ? <TypewriterLoader size="sm" /> : <CheckCircle2 className="h-4 w-4 text-green" />}
                      {msg}
                    </span>
                    <Pill tone={generating && idx >= sseMessages.length - 1 ? 'blue' : 'green'}>
                      {generating && idx >= sseMessages.length - 1 ? '处理中' : '完成'}
                    </Pill>
                  </SoftCard>
                ))}
                {!generating && sseMessages.length > 0 && !generateError && !error && (
                  <SoftCard className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-small font-bold text-ink">
                      <CheckCircle2 className="h-4 w-4 text-green" />
                      视频创作产物已生成
                    </span>
                    <Pill tone="green">完成</Pill>
                  </SoftCard>
                )}
              </>
            ) : (
              ['分析学习画像', '读取路径节点', '加载知识库资料', '多智能体生成内容', '安全检查', '保存资源索引'].map((row, idx) => (
                <SoftCard key={row} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-small font-bold text-ink">
                    {generating && idx < 4 ? <TypewriterLoader size="sm" /> : <CheckCircle2 className="h-4 w-4 text-green" />}
                    {row}
                  </span>
                  <Pill tone={generating && idx < 4 ? 'blue' : 'green'}>{generating && idx < 4 ? '处理中' : '完成'}</Pill>
                </SoftCard>
              ))
            )}
            {generateError && (
              <div className="rounded-[12px] border-2 border-red/30 bg-red-light p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red" />
                  <div>
                    <b className="block text-small text-red">生成失败</b>
                    <p className="mt-1 text-small text-muted">{generateError}</p>
                  </div>
                </div>
              </div>
            )}
            {error && !generateError && <p className="rounded-[10px] bg-red-light p-3 text-small text-red">{error}</p>}
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4">
            {resource ? (
              <>
                <SoftCard>
                  <b className="block text-h2 text-ink">{resource.title}</b>
                  {resource.type === 'video' ? (
                    <div className="mt-3">
                      {resource.videoUrl ? (
                        <video src={resource.videoUrl} controls className="w-full rounded-xl bg-black" />
                      ) : (
                        <div className="flex items-center justify-center h-48 rounded-xl bg-[#1e293b] text-white/60">
                          <div className="text-center">
                            <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">视频已生成，可在视频页面查看完整预览</p>
                          </div>
                        </div>
                      )}
                      <p className="mt-2 text-small text-muted">视频资源已保存，可前往视频页面播放、下载音频和字幕。</p>
                    </div>
                  ) : resource.type === 'blog' ? (
                    <div className="mt-3">
                      <AudioRadio
                        tracks={(() => {
                          let content = resource.content || ''
                          // Strip the "# prompt" header line that resource generation adds
                          content = content.replace(/^#[^\n]*\n+/, '').trim()
                          if (!content) return [{ id: '1', title: resource.title, text: '播客内容生成中...', subtitle: '' }]
                          const paragraphs = content.split(/\n{2,}/).filter(p => p.trim().length > 20)
                          if (paragraphs.length <= 1) {
                            return [{ id: '1', title: resource.title, text: content.replace(/[#*`>\-|[\]()]/g, '').slice(0, 2000), subtitle: content.slice(0, 50) + '...' }]
                          }
                          return paragraphs.slice(0, 10).map((p, idx) => ({
                            id: `${idx + 1}`,
                            title: `第 ${idx + 1} 段`,
                            text: p.replace(/[#*`>\-|[\]()]/g, '').slice(0, 1000),
                            subtitle: p.replace(/[#*`>\-|[\]()]/g, '').slice(0, 60) + '...',
                          }))
                        })()}
                      />
                      <p className="mt-3 text-small text-muted">播客已生成，点击播放按钮收听 AI 语音。</p>
                    </div>
                  ) : generatedPreviewUrl ? (
                    <div className="mt-3">
                      <iframe title={resource.title} src={generatedPreviewUrl} className="h-[72vh] min-h-[560px] w-full rounded-xl border border-line bg-white" />
                    </div>
                  ) : (
                    <div className="mt-3 max-h-[calc(100vh-360px)] overflow-y-auto pr-3">
                      <MarkdownCodePreview
                        content={resource.content || '资源已生成，可在我的资源中查看完整预览。'}
                        editable={resource.type === 'code'}
                      />
                      {resource.type === 'code' && <CodePracticePanel resource={resource} />}
                    </div>
                  )}
                </SoftCard>
                <div className="flex gap-2">
                  <ResourceQualityTrigger
                    result={generatedQuality}
                    loading={Boolean(resource?.id) && qualityLoadingId === resource?.id}
                    onEvaluate={() => resource && void handleEvaluateResourceQuality(resource)}
                    onOpen={() => resource && setQualityDialogResourceId(resource.id)}
                  />
                  {resource.type === 'video' ? (
                    <button onClick={() => void openLibraryView(resource.id)} className="px-4 py-2 rounded-[10px] bg-blue text-small font-bold text-white hover:bg-blue-dark transition-colors">我的资源</button>
                  ) : (
                    <button onClick={() => void openLibraryView(resource.id)} className="px-4 py-2 rounded-[10px] bg-blue text-small font-bold text-white hover:bg-blue-dark transition-colors">我的资源</button>
                  )}
                  <ProtoButton href="/practice" variant="secondary">生成配套练习</ProtoButton>
                  <ProtoButton onClick={() => setStep(5)} variant="tertiary"><Save className="h-4 w-4" />查看保存状态</ProtoButton>
                </div>
              </>
            ) : (
              <SoftCard className="text-small text-muted">生成完成后会在这里展示预览。</SoftCard>
            )}
          </div>
        )}

        {step === 5 && (
          <SoftCard className="flex items-center justify-between gap-3">
            <div>
              <b className="text-ink">已保存到我的资源</b>
              <p className="mt-1 text-small text-muted">资源已关联当前路径节点，下一步建议开始学习并完成达标题。</p>
            </div>
            <button onClick={() => void openLibraryView(resource?.id)} className="px-4 py-2 rounded-[10px] bg-blue text-small font-bold text-white hover:bg-blue-dark transition-colors flex items-center gap-2"><Sparkles className="h-4 w-4" />查看资源</button>
          </SoftCard>
        )}
        </div>
      </ProtoCard>
      <ResourceQualityDialog
        open={Boolean(activeQualityResource && activeQualityResult)}
        resource={activeQualityResource}
        result={activeQualityResult}
        onClose={() => setQualityDialogResourceId('')}
      />
      <GenerationFailureContactDialog
        open={Boolean(failureDialog)}
        message={failureDialog?.message}
        detail={failureDialog?.detail}
        onClose={() => setFailureDialog(null)}
      />
    </div>
  )
}

function WebMaterialPreview({ resource, loading }: { resource: Resource; loading: boolean }) {
  const analysis = resource.analysis || {}
  const keyPoints = analysis.key_points || []

  return (
    <div className="mx-auto grid max-w-[920px] gap-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[#ecfeff] px-2.5 py-1 text-micro font-bold text-[#0891b2]">网页资料</span>
          {resource.sourceUrl ? (
            <a href={resource.sourceUrl} target="_blank" rel="noreferrer" className="min-w-0 truncate text-small font-semibold text-blue hover:underline">
              {resource.sourceUrl}
            </a>
          ) : null}
        </div>
        {loading ? <p className="text-small text-muted">正在加载网页资料详情...</p> : null}
      </div>

      <section className="rounded-[18px] border border-[#bfdbfe] bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_100%)] p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue" />
          <b className="text-small text-blue">AI 讲解稿</b>
        </div>
        <h3 className="mt-3 text-[22px] font-bold leading-tight text-ink">先读这份讲解，再回看原文</h3>
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-8 text-ink">{analysis.lecture_script || '讲解稿正在生成或暂无内容。'}</p>
      </section>

      <div className="grid grid-cols-[1.15fr_0.85fr] gap-4 max-[900px]:grid-cols-1">
        <section className="rounded-[16px] bg-[#f8fafc] p-5">
          <b className="text-small text-muted">讲解摘要</b>
          <p className="mt-2 text-[15px] leading-7 text-ink">{analysis.summary || '这份网页资料暂未生成摘要。'}</p>
        </section>
        <section className="rounded-[16px] bg-[#f8fafc] p-5">
          <b className="text-small text-muted">推荐学习方式</b>
          <p className="mt-2 text-small leading-7 text-ink">{analysis.learning_method || '建议先读讲解稿，再回看原文。'}</p>
        </section>
      </div>

      <section className="rounded-[16px] bg-[#f8fafc] p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <b className="text-small text-muted">辅助理解</b>
          <span className="text-micro text-muted">{analysis.audience || '适合需要快速理解该网页内容的学习者'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {keyPoints.length ? keyPoints.map((point, index) => (
            <span key={`${point}-${index}`} className="rounded-full bg-white px-3 py-1.5 text-small font-bold text-blue ring-1 ring-[#bfdbfe]">
              {point}
            </span>
          )) : <span className="text-small text-muted">暂无关键知识点。</span>}
        </div>
      </section>

      <section className="rounded-[16px] bg-white p-5 ring-1 ring-line">
        <b className="text-small text-muted">网页原文</b>
        <div className="mt-3 max-h-[360px] overflow-y-auto rounded-[12px] bg-[#f8fafc] p-4 text-small leading-7 text-ink">
          <p className="whitespace-pre-wrap">{resource.content || '原文加载中，稍后会显示在这里。'}</p>
        </div>
      </section>
    </div>
  )
}

function ResourceQualityTrigger({
  result,
  loading,
  onEvaluate,
  onOpen,
}: {
  result: ResourceQualityResult | null
  loading: boolean
  onEvaluate: () => void
  onOpen: () => void
}) {
  if (!result) {
    return (
      <ProtoButton variant="tertiary" onClick={onEvaluate} disabled={loading}>
        <ShieldCheck className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
        {loading ? '评估中...' : '评估质量'}
      </ProtoButton>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-[10px] border border-[#dbe7f5] bg-[#f8fbff] px-2.5 py-1.5">
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${qualityLabelTone(result.label)}`}>
        {result.label}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#2563eb] shadow-sm ring-1 ring-[#dbe7f5] transition hover:bg-[#eff6ff]"
        aria-label="查看资源质量分析"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function ResourceQualityDialog({
  open,
  resource,
  result,
  onClose,
}: {
  open: boolean
  resource: Resource | null
  result: ResourceQualityResult | null
  onClose: () => void
}) {
  if (!open || !resource || !result) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/28 px-4 py-8 backdrop-blur-[2px]">
      <div className="max-h-[88vh] w-full max-w-[860px] overflow-hidden rounded-[24px] border border-[#dbe7f5] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${qualityLabelTone(result.label)}`}>{result.label}</span>
              <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-[12px] font-bold text-[#2563eb]">{resourceTypeText(resource.type)}</span>
            </div>
            <h3 className="mt-3 text-[22px] font-bold text-ink">{resource.title}</h3>
            <p className="mt-2 max-w-[560px] text-small leading-6 text-muted">{result.summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f8fafc] text-muted transition hover:bg-[#eef2f7] hover:text-ink"
            aria-label="关闭资源质量分析"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 overflow-y-auto px-6 py-6 min-[900px]:grid-cols-[320px_1fr]">
          <div className="rounded-[20px] border border-[#e6eef9] bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-5">
            <div className="mb-3 flex items-center gap-2 text-small font-bold text-ink">
              <CircleGauge className="h-4 w-4 text-[#2563eb]" />
              资源质量雷达
            </div>
            <QualityRadarChart dimensions={result.dimensions} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {result.dimensions.map((dimension) => (
                <div key={dimension.key} className="rounded-[14px] border border-[#e7eef8] bg-white px-3 py-2">
                  <span className="block text-[12px] font-bold text-ink">{dimension.label}</span>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${dimensionLevelTone(dimension.level)}`}>
                    {dimension.level === 'high' ? '高' : dimension.level === 'low' ? '低' : '中'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {result.dimensions.map((dimension) => (
              <div key={dimension.key} className="rounded-[18px] border border-[#e6eef9] bg-[#fbfdff] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#eff6ff] text-[#2563eb]">
                      {dimensionIcon(dimension.key)}
                    </span>
                    <div>
                      <b className="block text-small text-ink">{dimension.label}</b>
                      <span className="block text-micro text-muted">{dimension.detail}</span>
                    </div>
                  </div>
                  <span className="text-small font-bold text-[#2563eb]">{dimension.score}</span>
                </div>
              </div>
            ))}

            <div className="rounded-[18px] border border-[#e2ebfb] bg-[linear-gradient(135deg,#eff6ff_0%,#f8fbff_100%)] p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#2563eb]" />
                <b className="text-small text-ink">AI 建议</b>
              </div>
              <p className="mt-2 text-small leading-7 text-ink">{result.advice}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QualityRadarChart({ dimensions }: { dimensions: ResourceQualityResult['dimensions'] }) {
  const size = 240
  const center = size / 2
  const radius = 82
  const levels = [0.25, 0.5, 0.75, 1]
  const normalized = dimensions.length ? dimensions : [
    { key: 'fit', label: '学情匹配', score: 0, level: 'low', detail: '' },
    { key: 'clarity', label: '内容清晰', score: 0, level: 'low', detail: '' },
    { key: 'practice', label: '练习支撑', score: 0, level: 'low', detail: '' },
    { key: 'priority', label: '当前优先级', score: 0, level: 'low', detail: '' },
  ]

  const pointAt = (index: number, scale: number) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index / normalized.length)
    return {
      x: center + Math.cos(angle) * radius * scale,
      y: center + Math.sin(angle) * radius * scale,
    }
  }

  const polygon = normalized
    .map((dimension, index) => {
      const point = pointAt(index, Math.max(0, Math.min(1, dimension.score / 100)))
      return `${point.x},${point.y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block h-[240px] w-[240px]">
      {levels.map((level) => (
        <polygon
          key={level}
          points={normalized.map((_, index) => {
            const point = pointAt(index, level)
            return `${point.x},${point.y}`
          }).join(' ')}
          fill={level === 1 ? '#f8fbff' : 'none'}
          stroke="#dbe7f5"
          strokeWidth="1"
        />
      ))}
      {normalized.map((dimension, index) => {
        const edge = pointAt(index, 1)
        const label = pointAt(index, 1.18)
        return (
          <g key={dimension.key}>
            <line x1={center} y1={center} x2={edge.x} y2={edge.y} stroke="#dbe7f5" strokeWidth="1" />
            <text x={label.x} y={label.y} fill="#64748b" fontSize="11" textAnchor="middle">
              {dimension.label}
            </text>
          </g>
        )
      })}
      <polygon points={polygon} fill="rgba(37,99,235,0.18)" stroke="#2563eb" strokeWidth="2" />
      {normalized.map((dimension, index) => {
        const point = pointAt(index, Math.max(0, Math.min(1, dimension.score / 100)))
        return <circle key={dimension.key} cx={point.x} cy={point.y} r="4" fill="#2563eb" />
      })}
    </svg>
  )
}

function dimensionIcon(key: string) {
  if (key === 'fit') return <ShieldCheck className="h-4 w-4" />
  if (key === 'clarity') return <BookOpen className="h-4 w-4" />
  if (key === 'practice') return <Code className="h-4 w-4" />
  return <CircleGauge className="h-4 w-4" />
}

function qualityLabelTone(label: string) {
  if (label === '较适合') return 'bg-[#e8f7ef] text-[#15803d]'
  if (label === '暂不优先') return 'bg-[#fff1f2] text-[#be123c]'
  return 'bg-[#fff7e8] text-[#b45309]'
}

function dimensionLevelTone(level: string) {
  if (level === 'high') return 'bg-[#e8f7ef] text-[#15803d]'
  if (level === 'low') return 'bg-[#fff1f2] text-[#be123c]'
  return 'bg-[#eff6ff] text-[#2563eb]'
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="p-6 text-small text-muted">资源工作台加载中...</div>}>
      <GeneratePageContent />
    </Suspense>
  )
}
