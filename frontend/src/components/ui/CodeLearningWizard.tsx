'use client'

import { useState, useCallback } from 'react'
import { BookOpen, PenTool, Code, ChevronRight, ChevronLeft, CheckCircle2, Lightbulb, Eye, EyeOff, RotateCcw, Play, Loader2 } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'

/* ─── 类型定义 ─── */
interface TestCase {
  name: string
  input: string
  expected: string
}

interface TestResult {
  name: string
  passed: boolean
  expected: string
  actual: string
}

interface LevelContent {
  // 第一级
  concept?: string
  annotatedCode?: string
  keyPoints?: string[]
  // 第二级
  fillDescription?: string
  fillCode?: string
  fillHints?: string[]
  fillAnswer?: string
  fillTests?: TestCase[]
  // 第三级
  challengeDescription?: string
  challengeStarter?: string
  challengeHints?: string[]
  challengeSolution?: string
  challengeTests?: TestCase[]
}

interface CodeLearningWizardProps {
  content: string
  title?: string
}

/* ─── 步骤配置 ─── */
const STEPS = [
  { key: 'learn', label: '引导学习', icon: BookOpen, desc: '理解概念和示例' },
  { key: 'practice', label: '填空练习', icon: PenTool, desc: '填写关键代码' },
  { key: 'create', label: '自由编码', icon: Code, desc: '独立完成任务' },
] as const

type StepKey = typeof STEPS[number]['key']

/* ─── 辅助函数 ─── */
/** 从文本中提取第一个 code fence 的内容 */
function extractCode(text: string, lang?: string): string {
  const pattern = lang ? new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)```') : /```(?:\w*)\s*\n([\s\S]*?)```/
  const m = text.match(pattern)
  return m?.[1]?.trim() || ''
}

/** 提取所有 code fence */
function extractAllCode(text: string): string[] {
  return [...text.matchAll(/```(?:\w*)\s*\n([\s\S]*?)```/g)].map(m => m[1].trim())
}

/** 提取 JSON code fence */
function extractJson(text: string): any[] {
  const m = text.match(/```json\s*\n([\s\S]*?)```/)
  if (m) {
    try { return JSON.parse(m[1].trim()) } catch {}
  }
  // 尝试提取任意 code fence 中看起来像 JSON 的
  const codes = extractAllCode(text)
  for (const code of codes) {
    const trimmed = code.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try { return JSON.parse(trimmed) } catch {}
    }
  }
  return []
}

/** 提取列表项 */
function extractListItems(text: string): string[] {
  return text.split(/\n/)
    .filter(l => /^[-•*]\s+/.test(l.trim()) || /^\d+[\.\)、]\s*/.test(l.trim()))
    .map(l => l.trim().replace(/^[-•*\d\.\)、]\s*/, ''))
    .filter(Boolean)
}

/** 按 ### 标题分段 */
function splitByH3(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const parts = text.split(/(?=###\s*)/)
  for (const part of parts) {
    const m = part.match(/^###\s*(.+?)\s*\n?([\s\S]*)/)
    if (m) {
      sections[m[1].trim()] = m[2].trim()
    }
  }
  return sections
}

/** 按 ## 标题分段 */
function splitByH2(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const parts = text.split(/(?=##\s*)/)
  for (const part of parts) {
    const m = part.match(/^##\s*(.+?)\s*\n?([\s\S]*)/)
    if (m) {
      sections[m[1].trim()] = m[2].trim()
    }
  }
  return sections
}

/* ─── 解析函数 ─── */
function parseContent(raw: string): LevelContent {
  const result: LevelContent = {}

  // 按 ## 标题分成三大级
  const h2Sections = splitByH2(raw)

  // 查找第一级内容
  const level1Key = Object.keys(h2Sections).find(k => /第一级|引导学习|Learn/.test(k))
  const level1 = level1Key ? h2Sections[level1Key] : ''

  // 查找第二级内容
  const level2Key = Object.keys(h2Sections).find(k => /第二级|填空练习|Practice/.test(k))
  const level2 = level2Key ? h2Sections[level2Key] : ''

  // 查找第三级内容
  const level3Key = Object.keys(h2Sections).find(k => /第三级|自由编码|Create/.test(k))
  const level3 = level3Key ? h2Sections[level3Key] : ''

  // ── 第一级解析 ──
  if (level1) {
    const subs = splitByH3(level1)
    // 知识点讲解
    const conceptKey = Object.keys(subs).find(k => /知识点|概念|讲解/.test(k))
    result.concept = conceptKey ? subs[conceptKey] : ''

    // 示例代码
    const codeKey = Object.keys(subs).find(k => /示例代码|代码实现|代码示例/.test(k))
    if (codeKey) {
      result.annotatedCode = extractCode(subs[codeKey])
    }
    // fallback: 如果没有找到标题匹配的代码块，从整个 level1 提取
    if (!result.annotatedCode) {
      result.annotatedCode = extractCode(level1)
    }

    // 要点总结
    const pointsKey = Object.keys(subs).find(k => /要点|总结|核心/.test(k))
    if (pointsKey) {
      result.keyPoints = extractListItems(subs[pointsKey])
    }
  }

  // ── 第二级解析 ──
  if (level2) {
    const subs = splitByH3(level2)

    // 练习说明
    const descKey = Object.keys(subs).find(k => /练习说明|练习目标|说明/.test(k))
    result.fillDescription = descKey ? subs[descKey].split('\n')[0] : ''

    // 填空代码
    const fillCodeKey = Object.keys(subs).find(k => /填空代码|代码框架|填空/.test(k))
    if (fillCodeKey) {
      result.fillCode = extractCode(subs[fillCodeKey])
    }
    if (!result.fillCode) {
      // fallback: 从整个 level2 提取第一个代码块
      result.fillCode = extractCode(level2)
    }

    // 填空提示
    const hintsKey = Object.keys(subs).find(k => /提示|帮助/.test(k))
    if (hintsKey) {
      result.fillHints = extractListItems(subs[hintsKey])
    }

    // 参考答案
    const answerKey = Object.keys(subs).find(k => /参考答案|答案/.test(k))
    if (answerKey) {
      result.fillAnswer = extractCode(subs[answerKey])
    }

    // 测试用例
    const testKey = Object.keys(subs).find(k => /测试用例|测试/.test(k))
    if (testKey) {
      result.fillTests = extractJson(subs[testKey])
    }
  }

  // ── 第三级解析 ──
  if (level3) {
    const subs = splitByH3(level3)

    // 挑战任务
    const taskKey = Object.keys(subs).find(k => /挑战任务|任务|题目/.test(k))
    result.challengeDescription = taskKey ? subs[taskKey] : ''

    // 起始代码
    const starterKey = Object.keys(subs).find(k => /起始代码|代码骨架|起始/.test(k))
    if (starterKey) {
      result.challengeStarter = extractCode(subs[starterKey])
    }
    if (!result.challengeStarter) {
      result.challengeStarter = extractCode(level3)
    }

    // 提示
    const chHintsKey = Object.keys(subs).find(k => /^提示$/.test(k))
    if (chHintsKey) {
      result.challengeHints = extractListItems(subs[chHintsKey])
    }

    // 参考答案
    const solutionKey = Object.keys(subs).find(k => /参考答案|答案|解决方案/.test(k))
    if (solutionKey) {
      result.challengeSolution = extractCode(subs[solutionKey])
    }

    // 测试用例
    const chTestKey = Object.keys(subs).find(k => /测试用例|测试/.test(k))
    if (chTestKey) {
      result.challengeTests = extractJson(subs[chTestKey])
    }
  }

  return result
}

/* ─── Markdown 渲染 ─── */
function SimpleMarkdown({ text }: { text: string }) {
  // 简单的 Markdown 渲染：加粗、代码、列表
  const html = text
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-[#e11d48]">$1</code>')
    .replace(/\n/g, '<br/>')
  return <div className="text-sm text-[#374151] leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
}

/* ─── 主组件 ─── */
export default function CodeLearningWizard({ content, title }: CodeLearningWizardProps) {
  const [currentStep, setCurrentStep] = useState<StepKey>('learn')
  const [completed, setCompleted] = useState<Set<StepKey>>(new Set())

  // 第二级状态
  const [fillCode, setFillCode] = useState('')
  const [showFillHints, setShowFillHints] = useState(false)
  const [showFillAnswer, setShowFillAnswer] = useState(false)
  const [fillResults, setFillResults] = useState<TestResult[] | null>(null)
  const [fillRunning, setFillRunning] = useState(false)

  // 第三级状态
  const [challengeCode, setChallengeCode] = useState('')
  const [showChallengeHints, setShowChallengeHints] = useState(false)
  const [showChallengeSolution, setShowChallengeSolution] = useState(false)
  const [challengeResults, setChallengeResults] = useState<TestResult[] | null>(null)
  const [challengeRunning, setChallengeRunning] = useState(false)

  const parsed = parseContent(content)

  // 检查是否有有效内容
  const hasLevel1 = !!(parsed.concept || parsed.annotatedCode)
  const hasLevel2 = !!(parsed.fillCode || parsed.fillTests?.length)
  const hasLevel3 = !!(parsed.challengeDescription || parsed.challengeStarter)
  const hasAnyContent = hasLevel1 || hasLevel2 || hasLevel3

  // 如果解析完全失败，显示原始内容作为 fallback
  if (!hasAnyContent) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          内容解析未完全成功，以下为 AI 生成的原始内容：
        </div>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#374151] bg-[#f9fafb] rounded-xl p-5 border border-gray-200">
            {content}
          </pre>
        </div>
      </div>
    )
  }

  // 初始化填空代码
  const initFillCode = useCallback(() => {
    if (parsed.fillCode && !fillCode) setFillCode(parsed.fillCode)
  }, [parsed.fillCode, fillCode])

  // 初始化挑战代码
  const initChallengeCode = useCallback(() => {
    if (parsed.challengeStarter && !challengeCode) setChallengeCode(parsed.challengeStarter)
  }, [parsed.challengeStarter, challengeCode])

  // 运行测试
  const runTests = useCallback(async (code: string, tests: TestCase[]): Promise<TestResult[]> => {
    try {
      const res = await fetch('/api/code/run-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, tests }),
      })
      const data = await res.json()
      return data.results || []
    } catch {
      return tests.map(t => ({ name: t.name, passed: false, expected: t.expected, actual: '运行失败' }))
    }
  }, [])

  // 完成步骤
  const completeStep = (step: StepKey) => {
    setCompleted(prev => new Set(prev).add(step))
  }

  // 切换步骤
  const goToStep = (step: StepKey) => {
    setCurrentStep(step)
    if (step === 'practice') initFillCode()
    if (step === 'create') initChallengeCode()
  }

  const stepIndex = STEPS.findIndex(s => s.key === currentStep)

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, idx) => {
          const Icon = step.icon
          const isActive = step.key === currentStep
          const isDone = completed.has(step.key)
          return (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => goToStep(step.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#2563eb] text-white shadow-md'
                    : isDone
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-gray-50 text-[#6b7280] border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-[#d1d5db] mx-1" />
              )}
            </div>
          )
        })}
      </div>

      {/* ─── 第一级：引导学习 ─── */}
      {currentStep === 'learn' && (
        <div className="space-y-6">
          {/* 知识点讲解 */}
          {parsed.concept && (
            <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-5">
              <h4 className="text-sm font-bold text-[#0369a1] mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> 核心概念
              </h4>
              <SimpleMarkdown text={parsed.concept} />
            </div>
          )}

          {/* 示例代码 */}
          {parsed.annotatedCode && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <div className="bg-[#1e1e1e] px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-xs text-gray-400 ml-2">示例代码（逐行注释）</span>
              </div>
              <CodeMirror
                value={parsed.annotatedCode}
                extensions={[python()]}
                theme={oneDark}
                readOnly
                editable={false}
                basicSetup={{ lineNumbers: true, highlightActiveLine: false }}
              />
            </div>
          )}

          {/* 要点总结 */}
          {parsed.keyPoints && parsed.keyPoints.length > 0 && (
            <div className="bg-[#fefce8] border border-[#fde68a] rounded-xl p-5">
              <h4 className="text-sm font-bold text-[#a16207] mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" /> 要点总结
              </h4>
              <ol className="space-y-2">
                {parsed.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#78350f]">
                    <span className="w-5 h-5 rounded-full bg-[#fbbf24] text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 进入下一步 */}
          <div className="flex justify-end">
            <button
              onClick={() => { completeStep('learn'); goToStep('practice') }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors"
            >
              我理解了，进入练习 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── 第二级：填空练习 ─── */}
      {currentStep === 'practice' && (
        <div className="space-y-6">
          {/* 练习说明 */}
          {parsed.fillDescription && (
            <div className="bg-[#f5f3ff] border border-[#c4b5fd] rounded-xl p-5">
              <h4 className="text-sm font-bold text-[#6d28d9] mb-2 flex items-center gap-2">
                <PenTool className="w-4 h-4" /> 练习目标
              </h4>
              <p className="text-sm text-[#4c1d95]">{parsed.fillDescription}</p>
            </div>
          )}

          {/* 填空代码编辑器 */}
          {parsed.fillCode && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <div className="bg-[#1e1e1e] px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="text-xs text-gray-400 ml-2">填写 ___FILL___ 处的代码</span>
                </div>
                <button
                  onClick={() => setFillCode(parsed.fillCode!)}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> 重置
                </button>
              </div>
              <CodeMirror
                value={fillCode}
                onChange={setFillCode}
                extensions={[python()]}
                theme={oneDark}
                basicSetup={{ lineNumbers: true }}
              />
            </div>
          )}

          {/* 提示和答案 */}
          <div className="flex gap-3">
            {parsed.fillHints && parsed.fillHints.length > 0 && (
              <button
                onClick={() => setShowFillHints(!showFillHints)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm hover:bg-amber-100 transition-colors"
              >
                <Lightbulb className="w-4 h-4" />
                {showFillHints ? '隐藏提示' : '查看提示'}
              </button>
            )}
            {parsed.fillAnswer && (
              <button
                onClick={() => setShowFillAnswer(!showFillAnswer)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-[#6b7280] text-sm hover:bg-gray-100 transition-colors"
              >
                {showFillAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showFillAnswer ? '隐藏答案' : '查看答案'}
              </button>
            )}
          </div>

          {showFillHints && parsed.fillHints && (
            <div className="bg-[#fffbeb] border border-[#fde68a] rounded-xl p-4">
              <h5 className="text-xs font-bold text-[#92400e] mb-2">提示</h5>
              <ul className="space-y-1.5">
                {parsed.fillHints.map((h, i) => (
                  <li key={i} className="text-sm text-[#78350f] flex items-start gap-2">
                    <span className="text-[#d97706] font-bold">•</span> {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showFillAnswer && parsed.fillAnswer && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <div className="bg-[#1e1e1e] px-4 py-2">
                <span className="text-xs text-gray-400">参考答案</span>
              </div>
              <CodeMirror
                value={parsed.fillAnswer}
                extensions={[python()]}
                theme={oneDark}
                readOnly
                editable={false}
              />
            </div>
          )}

          {/* 运行测试 */}
          {parsed.fillTests && parsed.fillTests.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={async () => {
                  setFillRunning(true)
                  const results = await runTests(fillCode, parsed.fillTests!)
                  setFillResults(results)
                  setFillRunning(false)
                  if (results.every(r => r.passed)) completeStep('practice')
                }}
                disabled={fillRunning}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
              >
                {fillRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {fillRunning ? '运行中...' : '运行测试'}
              </button>

              {fillResults && (
                <div className="space-y-2">
                  {fillResults.map((r, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ${r.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shrink-0">✕</span>
                      )}
                      <span className={r.passed ? 'text-green-700' : 'text-red-700'}>{r.name}</span>
                      {!r.passed && (
                        <span className="text-xs text-red-500 ml-auto">
                          期望: {r.expected} | 实际: {r.actual}
                        </span>
                      )}
                    </div>
                  ))}
                  {fillResults.every(r => r.passed) && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-green-700">全部通过！你已经掌握了这个知识点</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 导航按钮 */}
          <div className="flex justify-between">
            <button
              onClick={() => goToStep('learn')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-[#6b7280] text-sm hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> 返回学习
            </button>
            <button
              onClick={() => { completeStep('practice'); goToStep('create') }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors"
            >
              进入挑战 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── 第三级：自由编码 ─── */}
      {currentStep === 'create' && (
        <div className="space-y-6">
          {/* 挑战任务 */}
          {parsed.challengeDescription && (
            <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-5">
              <h4 className="text-sm font-bold text-[#047857] mb-2 flex items-center gap-2">
                <Code className="w-4 h-4" /> 挑战任务
              </h4>
              <SimpleMarkdown text={parsed.challengeDescription} />
            </div>
          )}

          {/* 代码编辑器 */}
          {parsed.challengeStarter && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <div className="bg-[#1e1e1e] px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="text-xs text-gray-400 ml-2">在此编写你的代码</span>
                </div>
                <button
                  onClick={() => setChallengeCode(parsed.challengeStarter!)}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> 重置
                </button>
              </div>
              <CodeMirror
                value={challengeCode}
                onChange={setChallengeCode}
                extensions={[python()]}
                theme={oneDark}
                basicSetup={{ lineNumbers: true }}
              />
            </div>
          )}

          {/* 提示和答案 */}
          <div className="flex gap-3">
            {parsed.challengeHints && parsed.challengeHints.length > 0 && (
              <button
                onClick={() => setShowChallengeHints(!showChallengeHints)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm hover:bg-amber-100 transition-colors"
              >
                <Lightbulb className="w-4 h-4" />
                {showChallengeHints ? '隐藏提示' : '查看提示'}
              </button>
            )}
            {parsed.challengeSolution && (
              <button
                onClick={() => setShowChallengeSolution(!showChallengeSolution)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-[#6b7280] text-sm hover:bg-gray-100 transition-colors"
              >
                {showChallengeSolution ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showChallengeSolution ? '隐藏答案' : '查看答案'}
              </button>
            )}
          </div>

          {showChallengeHints && parsed.challengeHints && (
            <div className="bg-[#fffbeb] border border-[#fde68a] rounded-xl p-4">
              <h5 className="text-xs font-bold text-[#92400e] mb-2">提示</h5>
              <ul className="space-y-1.5">
                {parsed.challengeHints.map((h, i) => (
                  <li key={i} className="text-sm text-[#78350f] flex items-start gap-2">
                    <span className="text-[#d97706] font-bold">•</span> {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showChallengeSolution && parsed.challengeSolution && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <div className="bg-[#1e1e1e] px-4 py-2">
                <span className="text-xs text-gray-400">参考答案</span>
              </div>
              <CodeMirror
                value={parsed.challengeSolution}
                extensions={[python()]}
                theme={oneDark}
                readOnly
                editable={false}
              />
            </div>
          )}

          {/* 运行测试 */}
          {parsed.challengeTests && parsed.challengeTests.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={async () => {
                  setChallengeRunning(true)
                  const results = await runTests(challengeCode, parsed.challengeTests!)
                  setChallengeResults(results)
                  setChallengeRunning(false)
                  if (results.every(r => r.passed)) completeStep('create')
                }}
                disabled={challengeRunning}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
              >
                {challengeRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {challengeRunning ? '运行中...' : '运行测试'}
              </button>

              {challengeResults && (
                <div className="space-y-2">
                  {challengeResults.map((r, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ${r.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shrink-0">✕</span>
                      )}
                      <span className={r.passed ? 'text-green-700' : 'text-red-700'}>{r.name}</span>
                      {!r.passed && (
                        <span className="text-xs text-red-500 ml-auto">
                          期望: {r.expected} | 实际: {r.actual}
                        </span>
                      )}
                    </div>
                  ))}
                  {challengeResults.every(r => r.passed) && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 text-center">
                      <div className="text-4xl mb-3">🎉</div>
                      <p className="text-lg font-bold text-green-700 mb-1">恭喜完成全部挑战！</p>
                      <p className="text-sm text-green-600">你已经从理解到实践，真正掌握了这个知识点</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 导航按钮 */}
          <div className="flex justify-start">
            <button
              onClick={() => goToStep('practice')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-[#6b7280] text-sm hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> 返回填空练习
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
