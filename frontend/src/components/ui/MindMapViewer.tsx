'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'
import { Toolbar } from 'markmap-toolbar'
import 'markmap-toolbar/dist/style.css'

interface MindMapViewerProps {
  content: string
  className?: string
}

const transformer = new Transformer()

/**
 * 从思维导图 content 中提取 Markdown 列表部分（去掉"建议学习顺序"等非导图内容）
 */
function extractMindmapMarkdown(content: string): string {
  if (!content) return ''
  const lines = content.split('\n')
  const result: string[] = []
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()
    // 跳过"建议学习顺序"、"关联关系"等非导图段落
    if (/^#+\s*(建议学习顺序|关联关系|学习路径|参考)/.test(trimmed)) {
      break
    }
    // 保留标题行和列表行
    if (trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith(' ')) {
      inList = true
      result.push(line)
    } else if (inList && trimmed === '') {
      // 列表间的空行保留
      result.push(line)
    }
  }

  // 清理：去掉末尾空行，确保至少有内容
  let md = result.join('\n').trim()
  // 如果没有标题，添加一个默认标题
  if (md && !md.startsWith('#')) {
    md = '# 知识导图\n' + md
  }
  return md || content
}

export function MindMapViewer({ content, className }: MindMapViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const markmapRef = useRef<Markmap | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const renderMindmap = useCallback(() => {
    if (!svgRef.current) return

    const md = extractMindmapMarkdown(content)
    if (!md) return

    const { root } = transformer.transform(md)
    if (!root) return

    // 销毁旧实例
    if (markmapRef.current) {
      markmapRef.current.destroy()
      markmapRef.current = null
    }

    // 创建新实例
    const mm = Markmap.create(svgRef.current, {
      autoFit: true,
      duration: 300,
      initialExpandLevel: 3,
      maxWidth: 300,
      spacingHorizontal: 80,
      spacingVertical: 5,
    })
    markmapRef.current = mm

    // 渲染数据
    void mm.setData(root).then(() => {
      void mm.fit()
    })

    // 挂载工具栏
    if (toolbarRef.current) {
      toolbarRef.current.innerHTML = ''
      const toolbar = Toolbar.create(mm)
      toolbarRef.current.appendChild(toolbar.render())
    }
  }, [content])

  useEffect(() => {
    renderMindmap()
    return () => {
      if (markmapRef.current) {
        markmapRef.current.destroy()
        markmapRef.current = null
      }
    }
  }, [renderMindmap])

  if (!content) {
    return (
      <div className={`flex items-center justify-center h-[300px] text-muted ${className || ''}`}>
        暂无思维导图内容
      </div>
    )
  }

  return (
    <div className={`relative ${className || ''}`}>
      <div
        ref={toolbarRef}
        className="absolute top-2 right-2 z-10 flex items-center gap-1"
      />
      <svg
        ref={svgRef}
        className="w-full h-[420px]"
        style={{ background: 'transparent' }}
      />
    </div>
  )
}
