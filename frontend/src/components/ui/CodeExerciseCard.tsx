'use client'

import { useState, useCallback, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { Play, RotateCcw, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Terminal } from 'lucide-react'
import { ProtoButton, Pill } from '@/components/proto'

function getLanguageExtension(lang: string) {
  const normalized = lang.toLowerCase().trim()
  if (normalized === 'python' || normalized === 'py') return python()
  if (normalized === 'javascript' || normalized === 'js') return javascript()
  if (normalized === 'html' || normalized === 'xml') return html()
  return undefined
}

export interface TestCase {
  name: string
  input: string
  expected: string
}

export interface TestResult {
  name: string
  passed: boolean
  expected: string
  actual: string
}

export interface CodeExerciseCardProps {
  title?: string
  description: string
  language?: string
  difficulty?: string
  initialCode: string
  testCases?: TestCase[]
  hints?: string
  solution?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

export function CodeExerciseCard({
  title,
  description,
  language = 'python',
  difficulty,
  initialCode,
  testCases,
  hints,
  solution,
}: CodeExerciseCardProps) {
  const [code, setCode] = useState(initialCode)
  const [output, setOutput] = useState<string | null>(null)
  const [stderr, setStderr] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[] | null>(null)
  const [showSolution, setShowSolution] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const originalCode = useRef(initialCode)

  const handleReset = useCallback(() => {
    setCode(originalCode.current)
    setOutput(null)
    setStderr(null)
    setTestResults(null)
    setTimedOut(false)
  }, [])

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    setOutput(null)
    setStderr(null)
    setTestResults(null)
    setTimedOut(false)
    try {
      if (testCases && testCases.length > 0) {
        // Run with test cases
        const res = await fetch(`${API_BASE}/api/code/run-tests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language, test_cases: testCases }),
        })
        const data = await res.json()
        if (!res.ok) {
          setStderr(data.detail || '运行失败')
        } else {
          setTestResults(data.results || [])
          setOutput(data.stdout || null)
          setStderr(data.stderr || null)
          setTimedOut(data.timed_out || false)
        }
      } else {
        // Run code only
        const res = await fetch(`${API_BASE}/api/code/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language }),
        })
        const data = await res.json()
        if (!res.ok) {
          setStderr(data.detail || '运行失败')
        } else {
          setOutput(data.stdout || null)
          setStderr(data.stderr || null)
          setTimedOut(data.timed_out || false)
        }
      }
    } catch (err) {
      setStderr(err instanceof Error ? `网络错误: ${err.message}` : '网络错误，请检查后端服务是否运行')
    } finally {
      setIsRunning(false)
    }
  }, [code, language, testCases])

  const passedCount = testResults?.filter(r => r.passed).length ?? 0
  const totalCount = testResults?.length ?? 0
  const langExt = getLanguageExtension(language)

  return (
    <div className="rounded-[12px] border border-line bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#f9fafb] border-b border-line">
        <div className="flex items-center gap-2">
          {title && <span className="text-h3 font-bold text-ink">{title}</span>}
          {difficulty && (
            <Pill tone={difficulty === 'beginner' ? 'green' : difficulty === 'intermediate' ? 'blue' : 'purple'}>
              {difficulty === 'beginner' ? '入门' : difficulty === 'intermediate' ? '进阶' : '高级'}
            </Pill>
          )}
        </div>
        <span className="text-micro text-muted font-mono">{language}</span>
      </div>

      {/* Description */}
      <div className="px-5 py-3 border-b border-[#f1f5f9]">
        <p className="text-small leading-6 text-[#374151] whitespace-pre-wrap">{description}</p>
      </div>

      {/* Code Editor */}
      <div className="border-b border-line">
        <CodeMirror
          value={code}
          theme={oneDark}
          extensions={langExt ? [langExt] : []}
          onChange={(val) => setCode(val)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
          }}
          style={{ fontSize: '13px', minHeight: '120px', maxHeight: '400px' }}
        />
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-2 px-5 py-3 bg-[#f9fafb] border-b border-line flex-wrap">
        <ProtoButton onClick={handleRun} disabled={isRunning}>
          {isRunning ? (
            <><Loader2 className="h-4 w-4 animate-spin" />运行中...</>
          ) : (
            <><Play className="h-4 w-4" />运行代码</>
          )}
        </ProtoButton>
        <ProtoButton variant="tertiary" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />重置
        </ProtoButton>
        {hints && (
          <ProtoButton variant="ghost" onClick={() => setShowHints(!showHints)}>
            {showHints ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showHints ? '隐藏提示' : '查看提示'}
          </ProtoButton>
        )}
        {solution && (
          <ProtoButton variant="ghost" onClick={() => setShowSolution(!showSolution)}>
            {showSolution ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showSolution ? '隐藏答案' : '查看答案'}
          </ProtoButton>
        )}
      </div>

      {/* Hints */}
      {showHints && hints && (
        <div className="px-5 py-3 bg-[#eff6ff] border-b border-[#bfdbfe]">
          <p className="text-small text-[#1e40af] whitespace-pre-wrap">{hints}</p>
        </div>
      )}

      {/* Solution */}
      {showSolution && solution && (
        <div className="px-5 py-3 bg-[#f0fdf4] border-b border-[#bbf7d0]">
          <p className="text-micro font-bold text-[#166534] mb-2">参考答案</p>
          <pre className="text-small text-[#166534] bg-[#1e1e1e] rounded-[8px] p-3 overflow-x-auto">{solution}</pre>
        </div>
      )}

      {/* Output Panel */}
      {(output || stderr || timedOut) && (
        <div className="px-5 py-3">
          <div className={`rounded-[10px] border overflow-hidden ${stderr || timedOut ? 'border-red/30' : 'border-green/30'}`}>
            <div className={`flex items-center gap-2 px-4 py-2 ${stderr || timedOut ? 'bg-red-light' : 'bg-green-light'}`}>
              <Terminal className="h-3.5 w-3.5" />
              <span className="text-micro font-bold">{timedOut ? '超时' : stderr ? '错误' : '输出'}</span>
            </div>
            <pre className="px-4 py-3 text-small leading-6 bg-[#0f172a] text-[#e2e8f0] overflow-x-auto max-h-[200px] overflow-y-auto">
              {timedOut ? '代码执行超时（5 秒限制）' : stderr || output}
            </pre>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults && testResults.length > 0 && (
        <div className="px-5 py-3 border-t border-line">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-small font-bold text-ink">测试结果</span>
            <Pill tone={passedCount === totalCount ? 'green' : 'red'}>
              {passedCount}/{totalCount} 通过
            </Pill>
          </div>
          <div className="grid gap-2">
            {testResults.map((result, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 rounded-[8px] p-3 ${result.passed ? 'bg-green-light' : 'bg-red-light'}`}
              >
                {result.passed ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 text-red shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <b className="text-small text-ink">{result.name}</b>
                  {!result.passed && (
                    <div className="mt-1 text-micro">
                      <p className="text-muted">期望: <code className="bg-white/60 px-1 rounded">{result.expected}</code></p>
                      <p className="text-red">实际: <code className="bg-white/60 px-1 rounded">{result.actual}</code></p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
