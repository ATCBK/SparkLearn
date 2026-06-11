'use client'

import { useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import { CheckCircle2, Lightbulb, Sparkles, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import type { CodeEvaluateResult, Resource } from '@/lib/api'

interface CodePracticePanelProps {
  resource: Resource
}

interface ExtractedPractice {
  question: string
  hint: string
}

function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstCodeBlock(text: string) {
  const match = text.match(/```(?:python|py|javascript|js|typescript|ts|json)?\s*([\s\S]*?)```/i)
  return match?.[1]?.trim() || ''
}

function extractPractice(resource: Resource): ExtractedPractice {
  const content = resource.content || ''
  const exerciseMatch = content.match(/(?:^|\n)#{2,4}\s*(?:配套练习|扩展练习|练习题|自由编码|填空练习)[^\n]*\n([\s\S]*)/i)
  const section = exerciseMatch?.[1]?.split(/\n#{2,4}\s+/)[0]?.trim() || ''
  const questionText = stripMarkdown(section).slice(0, 420)
  const hint = firstCodeBlock(section) || firstCodeBlock(content)

  if (questionText) {
    return {
      question: questionText,
      hint: hint || '回看上方示例，重点确认函数名、参数和 return 返回值。',
    }
  }

  return {
    question: `请根据“${resource.title}”完成一个小函数，要求代码能体现本资源讲解的核心知识点，并使用 return 返回结果。`,
    hint: hint || '先写函数定义，再根据题目目标计算结果，最后用 return 返回。',
  }
}

export function CodePracticePanel({ resource }: CodePracticePanelProps) {
  const practice = useMemo(() => extractPractice(resource), [resource])
  const [studentCode, setStudentCode] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [result, setResult] = useState<CodeEvaluateResult | null>(null)
  const [error, setError] = useState('')

  async function handleEvaluate() {
    const code = studentCode.trim()
    if (!code) {
      setError('请先写下你的代码。')
      setResult(null)
      return
    }
    setEvaluating(true)
    setError('')
    setResult(null)
    try {
      const nextResult = await api.evaluateCodeResource(resource.id, {
        question: practice.question,
        hint: practice.hint,
        studentCode: code,
      })
      setResult(nextResult)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '批改失败，请稍后重试。')
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <section className="mt-8 rounded-[12px] border border-[#dbeafe] bg-[#f8fbff] p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-h2 font-bold text-ink">手写代码练习</h2>
          <p className="mt-1 text-small leading-6 text-muted">不用运行环境，提交后由 AI 根据题目和资源内容判断正确或错误。</p>
        </div>
        <button
          type="button"
          onClick={() => setShowHint(prev => !prev)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#bfdbfe] bg-white px-3 text-small font-bold text-blue transition-colors hover:bg-blue-light"
        >
          <Lightbulb className="h-4 w-4" />
          提示
        </button>
      </div>

      <div className="rounded-[10px] border border-line bg-white p-3">
        <div className="mb-1 text-micro font-bold text-soft">题目</div>
        <p className="m-0 text-small leading-7 text-ink">{practice.question}</p>
      </div>

      {showHint && (
        <div className="mt-3 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] p-3">
          <div className="mb-1 text-micro font-bold text-[#92400e]">提示</div>
          <pre className="m-0 max-h-[220px] overflow-auto whitespace-pre-wrap break-words text-small leading-6 text-[#78350f]">{practice.hint}</pre>
        </div>
      )}

      <label className="mt-4 block">
        <span className="mb-2 block text-small font-bold text-ink">你的代码</span>
        <div className="overflow-hidden rounded-[10px] border border-[#cbd5e1] bg-[#0f172a]">
          <CodeMirror
            value={studentCode}
            minHeight="220px"
            theme={oneDark}
            extensions={[python()]}
            onChange={(value) => {
              setStudentCode(value)
              setResult(null)
              setError('')
            }}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
            }}
            style={{ fontSize: '13px' }}
          />
        </div>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleEvaluate}
          disabled={evaluating}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-blue px-4 text-small font-bold text-white transition-colors hover:bg-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {evaluating ? 'AI 批改中...' : 'AI 批改'}
        </button>
        {error && <span className="text-small font-bold text-red">{error}</span>}
        {result && (
          <span className={`inline-flex min-h-10 items-center gap-2 rounded-[8px] border px-3 text-small font-bold ${
            result.correct
              ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
              : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
          }`}>
            {result.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {result.result}：{result.reason}
          </span>
        )}
      </div>
    </section>
  )
}
