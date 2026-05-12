'use client'

import { useEffect, useRef, useState } from 'react'
import { Database, FileUp, Search, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { api, KnowledgeFile, KnowledgeStats } from '@/lib/api'
import { MetricStrip, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'

interface ChunkData {
  id: number
  content: string
  chunkIndex: number
}

export default function KnowledgePage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [stats, setStats] = useState<KnowledgeStats>({ total: 0, indexed: 0, chunks: 0, references: 0 })
  const [selected, setSelected] = useState<KnowledgeFile | null>(null)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [chunks, setChunks] = useState<ChunkData[]>([])
  const [chunksLoading, setChunksLoading] = useState(false)
  const [showChunks, setShowChunks] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  // 当选中文件变化时，重置 chunks 展示
  useEffect(() => {
    setChunks([])
    setShowChunks(false)
  }, [selected?.id])

  async function load() {
    const [list, s] = await Promise.all([api.getKnowledgeFiles(), api.getKnowledgeStats()])
    setFiles(list)
    setStats(s)
    setSelected(prev => prev || list[0] || null)
  }

  async function upload(fileList: FileList | null) {
    if (!fileList?.length) return
    setError('')
    try {
      const uploaded = await api.uploadKnowledgeFiles([...fileList])
      await load()
      setSelected(uploaded[0] || null)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '上传失败')
    }
  }

  async function indexFile(file: KnowledgeFile) {
    setBusyId(file.id)
    setError('')
    try {
      const updated = await api.indexKnowledgeFile(file.id)
      await load()
      setSelected(updated)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '整理失败')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(file: KnowledgeFile) {
    await api.deleteKnowledgeFile(file.id)
    setSelected(null)
    await load()
  }

  async function loadChunks() {
    if (!selected || selected.status !== 'indexed') return
    if (showChunks) {
      setShowChunks(false)
      return
    }
    setChunksLoading(true)
    try {
      const data = await api.getKnowledgeChunks(selected.id)
      setChunks(data)
      setShowChunks(true)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '加载片段失败')
    } finally {
      setChunksLoading(false)
    }
  }

  const filtered = files.filter(file => !query || file.filename.includes(query) || file.tags.join(' ').includes(query))

  return (
    <div>
      <PageHead
        eyebrow="知识库"
        title="知识库"
        description="上传课程资料后执行整理，系统会提取文本、切片、生成摘要和标签，供资源生成与 AI 辅导引用。"
      />
      <MetricStrip
        items={[
          { value: `${stats.total}`, label: '文件总数' },
          { value: `${stats.indexed}`, label: '已整理' },
          { value: `${stats.chunks}`, label: '知识片段' },
          { value: `${stats.references}`, label: '引用次数' },
        ]}
      />

      <div className="mt-4 grid grid-cols-[360px_1fr] gap-4 max-[980px]:grid-cols-1">
        <ProtoCard>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => void upload(event.target.files)} />
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              void upload(event.dataTransfer.files)
            }}
            className="grid min-h-[168px] w-full place-items-center rounded-[14px] border border-dashed border-[#bfdbfe] bg-blue-light p-5 text-center"
          >
            <span>
              <FileUp className="mx-auto mb-3 h-8 w-8 text-blue" />
              <b className="block text-ink">拖拽或点击上传资料</b>
              <span className="mt-1 block text-small text-muted">支持 PDF、DOCX、TXT、MD</span>
            </span>
          </button>
          {error && <p className="mt-3 rounded-[10px] bg-red-light p-3 text-small text-red">{error}</p>}
          <div className="mt-4 grid gap-2">
            <Info title="AI 结构化提取" text="自动提取摘要、标签和片段，用于后续生成。" />
            <Info title="资料可用于" text="资源生成、AI 问答、错题补弱和报告建议。" />
          </div>
        </ProtoCard>

        <ProtoCard>
          <div className="mb-3 flex h-10 items-center gap-2 rounded-[10px] border border-line bg-[#f9fafb] px-3">
            <Search className="h-4 w-4 text-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-small outline-none" placeholder="搜索文件、标签、摘要" />
          </div>
          <div className="overflow-hidden rounded-[12px] border border-line">
            <table className="w-full border-collapse text-left text-small">
              <thead className="bg-[#f9fafb] text-micro text-muted">
                <tr>
                  <th className="p-3">文件</th>
                  <th className="p-3">标签</th>
                  <th className="p-3">状态</th>
                  <th className="p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => (
                  <tr key={file.id} className={`border-t border-line ${selected?.id === file.id ? 'bg-blue-light/60' : 'bg-white'}`}>
                    <td className="p-3">
                      <button onClick={() => setSelected(file)} className="text-left">
                        <b className="block text-ink">{file.filename}</b>
                        <span className="text-micro text-muted">{Math.round(file.sizeBytes / 1024)}KB · {file.chunkCount} 条片段</span>
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">{file.tags.slice(0, 3).map(tag => <Pill key={tag} tone="blue">{tag}</Pill>)}</div>
                    </td>
                    <td className="p-3"><Pill tone={file.status === 'indexed' ? 'green' : file.status === 'failed' ? 'red' : file.status === 'processing' ? 'blue' : 'orange'}>{statusLabel(file.status)}</Pill></td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <ProtoButton variant="tertiary" className="h-8 px-2" onClick={() => void indexFile(file)} disabled={busyId === file.id}>
                          {busyId === file.id ? <TypewriterLoader size="sm" /> : '整理'}
                        </ProtoButton>
                        <button onClick={() => void remove(file)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red-light hover:text-red" aria-label="删除">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <div className="p-5 text-small text-muted">暂无资料。</div>}
          </div>
        </ProtoCard>
      </div>

      <div className="mt-4 grid grid-cols-[1.2fr_.8fr] gap-4 max-[980px]:grid-cols-1">
        <ProtoCard>
          <h2 className="mb-3 flex items-center gap-2 text-h2 font-bold text-ink"><Database className="h-5 w-5 text-blue" />资料摘要</h2>
          <p className="text-small leading-7 text-muted">{selected?.summary || '选择文件后查看整理摘要。'}</p>
          {selected?.status === 'indexed' && (
            <div className="mt-4">
              <button
                onClick={() => void loadChunks()}
                disabled={chunksLoading}
                className="flex items-center gap-2 rounded-[10px] border border-line bg-[#f9fafb] px-4 py-2 text-small font-medium text-ink hover:border-blue hover:bg-blue-light transition-colors"
              >
                {chunksLoading ? (
                  <TypewriterLoader size="sm" />
                ) : showChunks ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {showChunks ? '收起知识片段' : `查看向量化结果（${selected.chunkCount} 条片段）`}
              </button>
              {showChunks && chunks.length > 0 && (
                <div className="mt-3 max-h-[480px] overflow-y-auto rounded-[12px] border border-line">
                  {chunks.map((chunk, idx) => (
                    <div key={chunk.id} className={`p-4 ${idx > 0 ? 'border-t border-line' : ''}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 min-w-[24px] items-center justify-center rounded-md bg-blue/10 px-1.5 text-micro font-bold text-blue">
                          #{chunk.chunkIndex + 1}
                        </span>
                        <span className="text-micro text-muted">
                          {chunk.content.length} 字符
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-small leading-6 text-muted">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {showChunks && chunks.length === 0 && (
                <p className="mt-3 text-small text-muted">暂无片段数据。</p>
              )}
            </div>
          )}
        </ProtoCard>
        <ProtoCard>
          <h2 className="mb-3 text-h2 font-bold text-ink">隐私与使用</h2>
          <div className="grid gap-2">
            <SoftCard className="text-small text-muted">资料仅存储在本地项目数据目录。</SoftCard>
            <SoftCard className="text-small text-muted">只有已整理资料会进入生成上下文。</SoftCard>
            <SoftCard className="text-small text-muted">删除文件会同步删除知识片段。</SoftCard>
          </div>
        </ProtoCard>
      </div>
    </div>
  )
}

function Info({ title, text }: { title: string; text: string }) {
  return <SoftCard><b className="block text-small text-ink">{title}</b><span className="mt-1 block text-micro leading-5 text-muted">{text}</span></SoftCard>
}

function statusLabel(status: string) {
  return { pending: '待处理', processing: '整理中', indexed: '已整理', failed: '失败' }[status] || status
}
