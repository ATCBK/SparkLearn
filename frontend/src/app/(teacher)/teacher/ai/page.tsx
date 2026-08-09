'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot,
  ChevronDown,
  Clapperboard,
  Cpu,
  FileText,
  Globe,
  Image as ImageIcon,
  Mic,
  MicOff,
  Plus,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PageHead, ProtoCard } from '@/components/proto'
import { cn } from '@/lib/utils/cn'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: string
  fileNames?: string[]
}

interface PendingFile {
  id: string
  filename: string
  sizeBytes: number
  excerpt: string
}

type MultimodalMode = 'image' | 'video' | null

type ApiResp<T> = {
  success: boolean
  data: T
  error?: string
}

type TeacherDashboardData = {
  summary: {
    total_students: number
    active_today: number
    active_rate: number
    avg_quiz_accuracy: number
    avg_task_completion: number
    avg_streak_days: number
    risk_count: number
  }
  risk_students: Array<{
    id: string
    name: string
    current_stage: string
    risk_level: string
    weak_points: string[]
    streak_days: number
    last_active: string
  }>
  stage_distribution: Array<{ stage: string; count: number }>
}

type TeacherStudent = {
  id: string
  name: string
  current_stage: string
  risk_level: string
  weak_points: string[]
  quiz_accuracy: number
  task_completion: number
  streak_days: number
}

type TeacherDailyReport = {
  report: string
  active: number
  total: number
}

type TeacherDiagnosis = {
  name: string
  diagnosis: string
}

type SpeechRecognitionConstructor = new () => SpeechRecognition

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const MODEL_OPTIONS = [
  { key: 'lite', shortLabel: 'Lite', label: 'Spark Lite' },
  { key: 'x1', shortLabel: 'x1.5', label: 'Spark X1.5' },
  { key: 'x2', shortLabel: 'x2', label: 'Spark X2' },
  { key: 'ds-flash', shortLabel: 'DS Flash', label: 'DeepSeek V4 Flash' },
  { key: 'ds-pro', shortLabel: 'DS Pro', label: 'DeepSeek V4 Pro' },
]

// 教师专属快捷问题
const QUICK_QUESTIONS = [
  { label: '班级概况', text: '请总结一下当前班级的整体学习情况，重点说明需要关注的问题。' },
  { label: '薄弱分析', text: '全班在哪些知识点上掌握最薄弱？请给出针对性的教学建议。' },
  { label: '出题助手', text: '请为"函数与闭包"章节出5道中等难度的练习题，包含答案和解析。' },
  { label: '教学计划', text: '请帮我制定下周"面向对象编程"的教学计划，包含重点、难点和课堂活动。' },
  { label: '家长沟通', text: '请帮我写一份关于学习进度偏慢学生的家长沟通建议，语气温和专业。' },
  { label: '补弱策略', text: '对于在"作用域与闭包"上掌握度低于40%的学生，有哪些有效的补弱策略？' },
]

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function canReadAsText(file: File) {
  return file.type.startsWith('text/')
    || /\.(md|txt|json|csv|tsv|log|py|js|ts|tsx|jsx|html|css)$/i.test(file.name)
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function fetchTeacherApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init)
  const json = await response.json() as ApiResp<T>
  if (!response.ok || !json.success) {
    throw new Error(json.error || `教师端接口请求失败：${response.status}`)
  }
  return json.data
}

function buildExerciseReply(input: string) {
  const topicMatch = input.match(/[“"《]?([^“"《》]{2,20})(?:[”"》])?章节?/)
  const topic = topicMatch?.[1]?.trim() || '当前章节'
  return [
    `下面是一组面向「${topic}」的中等难度练习题，可直接用于课堂检测：`,
    '',
    '1. 概念辨析题：请用自己的话说明核心概念，并举一个课堂中的代码例子。',
    '   答案要点：定义准确、能解释使用场景、示例代码能运行。',
    '',
    '2. 代码阅读题：给出一段包含典型易错点的代码，让学生判断输出结果并说明原因。',
    '   答案要点：关注变量作用范围、执行顺序和边界条件。',
    '',
    '3. 改错题：提供一段存在逻辑错误的实现，请学生定位错误并修复。',
    '   答案要点：说明错误原因，给出修改后的关键代码。',
    '',
    '4. 应用题：要求学生把该知识点应用到一个小型业务场景中。',
    '   答案要点：能抽象问题、拆分步骤、完成核心功能。',
    '',
    '5. 拓展题：让学生比较该知识点与相邻知识点的区别。',
    '   答案要点：能说清使用边界，并指出常见误用。',
  ].join('\n')
}

function buildPlanReply(input: string, dashboard: TeacherDashboardData | null) {
  const stageText = dashboard?.stage_distribution?.map((item) => `${item.stage}${item.count}人`).join('、') || '暂无阶段分布数据'
  return [
    '下面是一份可落地的下周教学计划：',
    '',
    `班级基础：${stageText}。`,
    '',
    '一、教学目标',
    '- 明确本周核心知识点的概念、使用场景和常见误区。',
    '- 完成一次课堂讲解、一次分层练习和一次错因复盘。',
    '',
    '二、课堂安排',
    '- 第1课时：用真实案例导入，讲清概念和最小可运行示例。',
    '- 第2课时：组织代码阅读和改错，暴露学生的理解断点。',
    '- 第3课时：分层练习，基础组补概念，进阶组做综合任务。',
    '- 第4课时：讲评高频错误，形成班级共性问题清单。',
    '',
    '三、干预重点',
    `- 对风险学生优先安排短任务和即时反馈${dashboard?.risk_students?.length ? `，当前需关注 ${dashboard.risk_students.length} 人` : ''}。`,
    '- 对掌握较好的学生安排解释型任务，让他们输出思路而不是只提交答案。',
    '',
    input.includes('面向对象') ? '四、面向对象建议：用“学生-课程-成绩”这类对象关系做建模练习，避免只讲语法。' : '',
  ].filter(Boolean).join('\n')
}

function buildParentReply(dashboard: TeacherDashboardData | null) {
  const riskNames = dashboard?.risk_students?.slice(0, 3).map((item) => item.name).join('、') || '相关学生'
  return [
    '下面是一份温和、专业的家长沟通建议稿：',
    '',
    `您好，近期我们关注到 ${riskNames} 在学习节奏和阶段任务完成上有一些波动。整体来看，孩子并不是没有能力，而是当前知识点需要更多连续练习和及时反馈。`,
    '',
    '建议家长在家中重点配合三件事：',
    '1. 每天固定一小段学习时间，先保证连续性，不追求一次学很久。',
    '2. 让孩子复述当天学到的概念，用“讲给别人听”的方式检查理解。',
    '3. 遇到不会的题目时，先记录卡点，再带着问题回到课堂或平台练习。',
    '',
    '我们也会在课堂中安排更细的分层任务，帮助孩子把薄弱点逐步补起来。后续我会继续同步学习变化。'
  ].join('\n')
}

function buildWeaknessReply(dashboard: TeacherDashboardData | null, students: TeacherStudent[]) {
  const weakPoints = students
    .flatMap((student) => student.weak_points || [])
    .reduce<Record<string, number>>((acc, point) => {
      acc[point] = (acc[point] || 0) + 1
      return acc
    }, {})
  const topWeak = Object.entries(weakPoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([point, count]) => `${point}（${count}人）`)
    .join('、') || '暂未发现明显集中薄弱点'
  const risk = dashboard?.risk_students?.slice(0, 4).map((item) => item.name).join('、') || '暂无重点风险名单'
  return [
    '根据教师端班级数据，当前建议这样处理薄弱点：',
    '',
    `高频薄弱点：${topWeak}。`,
    `重点关注学生：${risk}。`,
    '',
    '建议策略：',
    '- 先做一次 10 分钟快速诊断，区分“概念不会”和“会概念但不会迁移”。',
    '- 对共性薄弱点采用“示例讲解 → 改错题 → 小任务”的三段式训练。',
    '- 对风险学生降低单次任务粒度，每次只验证一个小目标。',
    '- 每节课结束保留 3 分钟，让学生写下一个仍不确定的问题，作为下次课导入。',
  ].join('\n')
}

async function buildTeacherAssistantReply(input: string, pendingFiles: PendingFile[]) {
  const normalized = input.trim()
  const needsDashboard = /(班级|概况|整体|薄弱|补弱|计划|家长|日报|报告|风险|干预)/.test(normalized)
  const dashboardPromise = needsDashboard
    ? fetchTeacherApi<TeacherDashboardData>('/api/teacher/dashboard').catch(() => null)
    : Promise.resolve(null)
  const studentsPromise = /(薄弱|补弱|风险|学生|干预|诊断)/.test(normalized)
    ? fetchTeacherApi<TeacherStudent[]>('/api/teacher/students').catch(() => [])
    : Promise.resolve([])
  const [dashboard, students] = await Promise.all([dashboardPromise, studentsPromise])

  if (/(日报|概况|整体|班级情况|班级数据|报告)/.test(normalized)) {
    const daily = await fetchTeacherApi<TeacherDailyReport>('/api/teacher/ai/daily-report', { method: 'POST' })
    const summary = dashboard?.summary
    return [
      daily.report,
      '',
      summary
        ? `补充数据：全班 ${summary.total_students} 人，今日活跃 ${summary.active_today} 人，平均正确率 ${Math.round(summary.avg_quiz_accuracy * 100)}%，任务完成率 ${Math.round(summary.avg_task_completion * 100)}%，风险预警 ${summary.risk_count} 人。`
        : '',
    ].filter(Boolean).join('\n')
  }

  const matchedStudent = students.find((student) => normalized.includes(student.name))
  if (matchedStudent || /(诊断|干预|风险学生)/.test(normalized)) {
    const target = matchedStudent || dashboard?.risk_students?.[0]
    if (target) {
      const diagnosis = await fetchTeacherApi<TeacherDiagnosis>('/api/teacher/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: target.id }),
      })
      return `${diagnosis.name}：${diagnosis.diagnosis}`
    }
  }

  if (/(出题|练习题|测验|题目)/.test(normalized)) return buildExerciseReply(normalized)
  if (/(教学计划|下周|教案|课堂活动)/.test(normalized)) return buildPlanReply(normalized, dashboard)
  if (/(家长|沟通)/.test(normalized)) return buildParentReply(dashboard)
  if (/(薄弱|补弱|掌握|知识点)/.test(normalized)) return buildWeaknessReply(dashboard, students)

  const fileHint = pendingFiles.length
    ? `\n\n我也收到了 ${pendingFiles.length} 个本次参考资料：${pendingFiles.map((file) => file.filename).join('、')}。当前教师端沿用原有教师接口，文本资料可作为你继续追问时的上下文参考。`
    : ''
  return `我可以继续帮你做班级分析、薄弱点定位、出题、教学计划、干预建议和家长沟通稿。你可以直接问“生成今日班级日报”或“分析全班薄弱点”。${fileHint}`
}

export default function TeacherAIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 SparkLearn 教师 AI 助手。我可以帮你分析班级数据、生成教学内容、制定干预策略，或者回答任何教学相关的问题。请问有什么可以帮你？',
      ts: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [selectedModel, setSelectedModel] = useState('lite')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [mcpEnabled, setMcpEnabled] = useState(false)
  const [knowledgeReverse, setKnowledgeReverse] = useState(false)
  const [multimodalMode, setMultimodalMode] = useState<MultimodalMode>(null)
  const [multimodalMenuOpen, setMultimodalMenuOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const voiceBaseRef = useRef('')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toggleVoiceInput = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }
    const speechWindow = window as SpeechRecognitionWindow
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('当前浏览器不支持语音识别，请使用 Chrome。')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    voiceBaseRef.current = input
    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i += 1) {
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

  const handlePickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError('')
    const nextFiles = await Promise.all(Array.from(files).map(async (file) => {
      let excerpt = ''
      if (canReadAsText(file)) {
        try {
          excerpt = (await file.text()).slice(0, 5000)
        } catch {
          excerpt = ''
        }
      }
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        filename: file.name,
        sizeBytes: file.size,
        excerpt,
      }
    }))
    setPendingFiles((prev) => [...prev, ...nextFiles])
    setNotice('已加入本次对话参考资料，发送后会随问题一起提供给 AI。')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingFile = (fileId: string) => {
    setPendingFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  const streamAssistantContent = useCallback(async (messageId: string, content: string) => {
    const text = content || '教师端 AI 暂无可展示内容。'
    let rendered = ''
    for (let index = 0; index < text.length; index += 3) {
      rendered += text.slice(index, index + 3)
      setMessages((prev) => prev.map((msg) => (
        msg.id === messageId ? { ...msg, content: rendered } : msg
      )))
      await wait(18)
    }
  }, [])

  const sendMessage = async (text?: string) => {
    const textValue = (text ?? input).trim()
    if ((!textValue && pendingFiles.length === 0) || loading) return

    const userInput = textValue || '请基于我上传的教学参考资料进行分析，并给出可执行的教学建议。'
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: userInput,
      ts: new Date().toISOString(),
      fileNames: pendingFiles.map((file) => file.filename),
    }
    const assistantId = `a-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', ts: new Date().toISOString() },
    ])
    setInput('')
    setLoading(true)
    setNotice('')
    setError('')

    try {
      const answer = await buildTeacherAssistantReply(userInput, pendingFiles)
      await streamAssistantContent(assistantId, answer)
      setPendingFiles([])
    } catch (err) {
      setMessages((prev) => prev.map((msg) => (
        msg.id === assistantId
          ? {
              ...msg,
              content: err instanceof Error && err.message
                ? `抱歉，教师端 AI 服务暂时不可用：${err.message}`
                : '抱歉，教师端 AI 服务暂时不可用。请确认后端服务已启动（端口 8000）。',
            }
          : msg
      )))
    } finally {
      setLoading(false)
    }
  }

  const currentModel = MODEL_OPTIONS.find((model) => model.key === selectedModel) || MODEL_OPTIONS[0]

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / AI 教学助手"
        title="AI 教学助手"
        description="教师专属 AI 对话，支持班级分析、出题、教案生成、家长沟通稿等教学场景。"
      />

      <div className="grid min-h-[calc(100vh-190px)] grid-cols-[260px_minmax(0,1fr)] gap-5 max-[900px]:grid-cols-1">
        <aside className="space-y-4">
          <ProtoCard className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#fff7ed] text-[#d97706]">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-sm font-bold text-[#111827]">快捷问题</h3>
            </div>
            <div className="space-y-2">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question.label}
                  type="button"
                  onClick={() => void sendMessage(question.text)}
                  disabled={loading}
                  className="w-full rounded-[8px] border border-[#eef2f7] bg-[#f9fafb] px-3 py-2.5 text-left text-xs font-bold text-[#374151] transition-colors hover:border-[#bfdbfe] hover:bg-[#eff6ff] hover:text-[#2563eb] disabled:opacity-50"
                >
                  <span className="mb-0.5 block text-[10px] font-bold text-[#2563eb]">{question.label}</span>
                  <span className="line-clamp-2 font-normal leading-5 text-[#6b7280]">{question.text}</span>
                </button>
              ))}
            </div>
          </ProtoCard>

          <ProtoCard className="p-4">
            <h3 className="mb-2 text-xs font-bold text-[#6b7280]">使用提示</h3>
            <div className="space-y-1.5 text-xs leading-5 text-[#6b7280]">
              <p>• 可以直接问班级数据相关问题</p>
              <p>• 支持生成练习题和教案</p>
              <p>• 可以请求家长沟通建议</p>
              <p>• 支持多轮对话上下文</p>
            </div>
          </ProtoCard>
        </aside>

        <section className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#e2e8f0] bg-white shadow-md">
          <div className="flex items-center justify-between gap-3 border-b border-[#eef2f7] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb]">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-[#111827]">教师智能问答</h2>
                <p className="mt-0.5 truncate text-xs text-[#64748b]">复用学生端交互方式，面向教学决策场景优化</p>
              </div>
            </div>
            <div className="hidden rounded-full border border-[#dbeafe] bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#2563eb] min-[720px]:block">
              {currentModel.label}
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto bg-[#f8fafc]/60 px-5 py-5">
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                <div className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-sm',
                  msg.role === 'user' ? 'bg-[#2563eb]' : 'bg-[#7c3aed]',
                )}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={cn('min-w-0 max-w-[78%] max-[640px]:max-w-[86%]', msg.role === 'user' && 'text-right')}>
                  {msg.fileNames && msg.fileNames.length > 0 && (
                    <div className={cn('mb-1 flex flex-wrap gap-1.5', msg.role === 'user' && 'justify-end')}>
                      {msg.fileNames.map((name) => (
                        <span key={name} className="inline-flex items-center gap-1 rounded-md border border-[#dbe3ef] bg-white px-2 py-1 text-[11px] text-[#64748b]">
                          <FileText className="h-3 w-3" />
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={cn(
                    'rounded-[14px] px-4 py-3 text-left text-sm leading-7 shadow-sm',
                    msg.role === 'user'
                      ? 'rounded-tr-[4px] bg-[#2563eb] text-white'
                      : 'rounded-tl-[4px] border border-[#e2e8f0] bg-white text-[#111827]',
                  )}>
                    {msg.content ? (
                      msg.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-headings:mb-2 prose-headings:mt-3">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )
                    ) : (
                      <span className="flex items-center gap-2 text-[#9ca3af]">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
                        思考中...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 border-t border-[#eef2f7] bg-white px-5 pb-4 pt-3">
            <div className="w-full">
              {pendingFiles.length > 0 && (
                <div className="mb-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <p className="mb-2 text-xs font-medium text-[#334155]">本次参考资料 {pendingFiles.length} 个</p>
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((file) => (
                      <span key={file.id} className="inline-flex items-center gap-1 rounded-md border border-[#dbe3ef] bg-white px-2 py-1 text-xs text-[#334155]">
                        <FileText className="h-3 w-3" />
                        {file.filename}
                        <span className="text-[10px] text-[#94a3b8]">{formatFileSize(file.sizeBytes)}</span>
                        <button
                          type="button"
                          onClick={() => removePendingFile(file.id)}
                          className="text-[#94a3b8] transition-colors hover:text-[#ef4444]"
                          aria-label={`移除 ${file.filename}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(notice || error) && (
                <p className={cn('mb-2 text-xs', error ? 'text-[#dc2626]' : 'text-[#64748b]')}>{error || notice}</p>
              )}

              <div className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void sendMessage()
                      }
                    }}
                    placeholder={multimodalMode === 'video'
                      ? '输入你要生成的视频主题、知识点或讲解要求...'
                      : multimodalMode === 'image'
                        ? '输入你要生成的图片描述、风格或教学内容...'
                        : '和 AI 对话，提任何教学问题...'}
                    rows={1}
                    disabled={loading}
                    className="max-h-[120px] min-h-[24px] flex-1 resize-none border-0 bg-transparent text-[15px] text-[#1e293b] outline-none placeholder:text-[#94a3b8] disabled:opacity-60"
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto'
                        el.style.height = `${Math.min(el.scrollHeight, 120)}px`
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b] transition-colors hover:bg-[#e2e8f0] hover:text-[#1e293b]"
                    title="添加参考资料"
                    aria-label="添加参考资料"
                  >
                    <Plus className="h-4 w-4" />
                    {pendingFiles.length > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#2563eb] text-[10px] font-medium text-white">
                        {pendingFiles.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
                      recording ? 'animate-pulse bg-red-500 text-white' : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1e293b]',
                    )}
                    title={recording ? '停止录音' : '语音输入'}
                    aria-label={recording ? '停止录音' : '语音输入'}
                  >
                    {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={loading || (!input.trim() && pendingFiles.length === 0)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-30"
                    title="发送"
                    aria-label="发送"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#f1f5f9] pt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => void handlePickFiles(event.target.files)}
                  />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelMenuOpen((open) => !open)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#e2e8f0] px-2.5 py-1 text-xs text-[#64748b] transition-colors hover:bg-[#f8fafc]"
                    >
                      {currentModel.shortLabel}
                      <ChevronDown className={cn('h-3 w-3 transition-transform', modelMenuOpen && 'rotate-180')} />
                    </button>
                    {modelMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setModelMenuOpen(false)} />
                        <div className="absolute bottom-full left-0 z-20 mb-1 min-w-[150px] rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-lg">
                          {MODEL_OPTIONS.map((model) => (
                            <button
                              key={model.key}
                              type="button"
                              onClick={() => {
                                setSelectedModel(model.key)
                                setModelMenuOpen(false)
                              }}
                              className={cn(
                                'w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#f1f5f9]',
                                selectedModel === model.key ? 'font-medium text-[#2563eb]' : 'text-[#334155]',
                              )}
                            >
                              {model.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setWebSearch((value) => !value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                      webSearch ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]',
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    联网搜索
                  </button>
                  <button
                    type="button"
                    onClick={() => setMcpEnabled((value) => !value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                      mcpEnabled ? 'border-[#7c3aed] bg-[#f5f3ff] text-[#6d28d9]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]',
                    )}
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    MCP 模式
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKnowledgeReverse((value) => {
                        const next = !value
                        if (next) {
                          setWebSearch(true)
                          setMultimodalMode(null)
                        }
                        return next
                      })
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                      knowledgeReverse ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]',
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    知识逆构
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMultimodalMenuOpen((open) => !open)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                        multimodalMode ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]',
                      )}
                    >
                      {multimodalMode === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <Clapperboard className="h-3.5 w-3.5" />}
                      {multimodalMode === 'image' ? '图片模式' : multimodalMode === 'video' ? '视频模式' : '多模态'}
                      <ChevronDown className={cn('h-3 w-3 transition-transform', multimodalMenuOpen && 'rotate-180')} />
                    </button>
                    {multimodalMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMultimodalMenuOpen(false)} />
                        <div className="absolute bottom-full left-0 z-20 mb-1 min-w-[180px] overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-lg">
                          {([
                            { key: 'image', label: '图片模式', desc: '生成教学配图或课堂素材' },
                            { key: 'video', label: '视频模式', desc: '整理视频脚本和讲解要求' },
                          ] as const).map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => {
                                setMultimodalMode(item.key)
                                setKnowledgeReverse(false)
                                setMultimodalMenuOpen(false)
                              }}
                              className={cn(
                                'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[#f8fafc]',
                                multimodalMode === item.key && 'bg-[#eff6ff]',
                              )}
                            >
                              <span className={cn(
                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                                item.key === 'image' ? 'bg-[#ecfeff] text-[#0f766e]' : 'bg-[#eff6ff] text-[#2563eb]',
                              )}>
                                {item.key === 'image' ? <ImageIcon className="h-3 w-3" /> : <Clapperboard className="h-3 w-3" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-medium text-[#1e293b]">{item.label}</span>
                                <span className="block text-[11px] leading-4 text-[#64748b]">{item.desc}</span>
                              </span>
                            </button>
                          ))}
                          {multimodalMode && (
                            <button
                              type="button"
                              onClick={() => {
                                setMultimodalMode(null)
                                setMultimodalMenuOpen(false)
                              }}
                              className="flex w-full items-center justify-center border-t border-[#eef2f7] px-3 py-2 text-xs text-[#64748b] hover:bg-[#f8fafc]"
                            >
                              关闭多模态
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {multimodalMode === 'video' && (
                  <p className="mt-2 text-xs text-[#a16207]">
                    视频模式会把你的输入作为教学视频脚本需求发送给 AI，用于先生成结构化讲解方案。
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
