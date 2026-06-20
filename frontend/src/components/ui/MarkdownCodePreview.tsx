'use client'

import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { Copy, Check, RotateCcw, Pencil, Eye } from 'lucide-react'

// Map language strings to CodeMirror extensions
function getLanguageExtension(lang?: string) {
  if (!lang) return undefined
  const normalized = lang.toLowerCase().trim()
  if (normalized === 'python' || normalized === 'py') return python()
  if (normalized === 'javascript' || normalized === 'js' || normalized === 'jsx' || normalized === 'typescript' || normalized === 'ts' || normalized === 'tsx') return javascript()
  if (normalized === 'html' || normalized === 'xml') return html()
  if (normalized === 'json') return json()
  return undefined
}

function getLanguageLabel(lang?: string) {
  if (!lang) return null
  const map: Record<string, string> = {
    python: 'Python', py: 'Python',
    javascript: 'JavaScript', js: 'JavaScript',
    typescript: 'TypeScript', ts: 'TypeScript',
    html: 'HTML', xml: 'XML',
    css: 'CSS',
    json: 'JSON',
    cpp: 'C++', c: 'C',
    java: 'Java',
    bash: 'Bash', sh: 'Shell',
    sql: 'SQL',
  }
  return map[lang.toLowerCase().trim()] || lang
}

// A single code block with toolbar (copy, edit toggle, reset)
function CodeBlock({ code, language, editable = false }: { code: string; language?: string; editable?: boolean }) {
  const [isEditing, setIsEditing] = useState(false)
  const [currentCode, setCurrentCode] = useState(code)
  const [copied, setCopied] = useState(false)
  const [originalCode] = useState(code)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const textarea = document.createElement('textarea')
      textarea.value = currentCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [currentCode])

  const handleReset = useCallback(() => {
    setCurrentCode(originalCode)
    setIsEditing(false)
  }, [originalCode])

  const langExt = getLanguageExtension(language)
  const langLabel = getLanguageLabel(language)

  return (
    <div className="my-3 rounded-[10px] border border-[#e2e8f0] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#f8fafc] border-b border-[#e2e8f0]">
        <span className="text-micro text-[#64748b] font-mono">
          {langLabel || 'code'}
        </span>
        <div className="flex items-center gap-1">
          {editable && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="p-1 rounded hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#334155] transition-colors"
              title={isEditing ? '只读模式' : '编辑模式'}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            </button>
          )}
          {editable && isEditing && currentCode !== originalCode && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1 rounded hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#334155] transition-colors"
              title="重置为原始代码"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#334155] transition-colors"
            title="复制代码"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#16a34a]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {/* Editor */}
      <CodeMirror
        value={currentCode}
        readOnly={!isEditing}
        theme={oneDark}
        extensions={langExt ? [langExt] : []}
        onChange={(val) => setCurrentCode(val)}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: isEditing,
          highlightActiveLineGutter: isEditing,
        }}
        style={{ fontSize: '13px' }}
      />
    </div>
  )
}

// Build custom components for ReactMarkdown
function buildComponents(editable: boolean): Components {
  return {
    code(props) {
      const { children, className, ...rest } = props as { children?: React.ReactNode; className?: string; node?: unknown }
      const match = /language-(\w+)/.exec(className || '')
      const isBlock = Boolean(match)

      if (isBlock) {
        const code = String(children).replace(/\n$/, '')
        return <CodeBlock code={code} language={match?.[1]} editable={editable} />
      }

      // Inline code
      return (
        <code className="bg-[#f1f5f9] text-[#e11d48] px-1.5 py-0.5 rounded text-[13px] font-mono" {...rest}>
          {children}
        </code>
      )
    },
    h1({ children }) {
      return <h1 className="text-h1 font-bold text-ink mt-6 mb-3">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-h2 font-bold text-ink mt-5 mb-2">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-h3 font-bold text-ink mt-4 mb-2">{children}</h3>
    },
    p({ children }) {
      return <p className="text-small leading-7 text-[#374151] my-2">{children}</p>
    },
    a({ children, href }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="break-all [overflow-wrap:anywhere] text-[#2563eb] underline underline-offset-2"
        >
          {children}
        </a>
      )
    },
    ul({ children }) {
      return <ul className="list-disc pl-5 my-2 text-small leading-7 text-[#374151]">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal pl-5 my-2 text-small leading-7 text-[#374151]">{children}</ol>
    },
    li({ children }) {
      return <li className="my-0.5">{children}</li>
    },
    blockquote({ children }) {
      return <blockquote className="border-l-4 border-[#2563eb] bg-[#eff6ff] pl-4 py-2 my-3 rounded-r-[8px] text-small text-[#374151]">{children}</blockquote>
    },
    strong({ children }) {
      return <strong className="font-bold text-ink">{children}</strong>
    },
    hr() {
      return <hr className="my-4 border-[#e5e7eb]" />
    },
    table({ children }) {
      return <div className="overflow-x-auto my-3"><table className="w-full text-small border-collapse">{children}</table></div>
    },
    th({ children }) {
      return <th className="border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-left font-bold text-ink">{children}</th>
    },
    td({ children }) {
      return <td className="border border-[#e5e7eb] px-3 py-2 text-[#374151]">{children}</td>
    },
  }
}

export interface MarkdownCodePreviewProps {
  content: string
  /** Enable code editing (copy/reset/edit toggle). Default: true */
  editable?: boolean
  /** Additional className for the wrapper */
  className?: string
}

export function MarkdownCodePreview({ content, editable = true, className }: MarkdownCodePreviewProps) {
  const components = buildComponents(editable)
  const wrapperClassName = ['min-w-0 break-all [overflow-wrap:anywhere]', className].filter(Boolean).join(' ')

  return (
    <div className={wrapperClassName}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
