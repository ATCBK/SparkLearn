'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  FileUp,
  Search,
  Trash2,
  Files,
  CheckCircle2,
  Layers,
  Link2,
  Plus,
  Sparkles,
  UserCog,
  Users,
  Paperclip,
} from 'lucide-react'
import { api, KnowledgeFile, KnowledgeStats } from '@/lib/api'

export default function TutorKnowledgePage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [stats, setStats] = useState<KnowledgeStats>({ total: 0, indexed: 0, chunks: 0, references: 0 })
  const [selected, setSelected] = useState<KnowledgeFile | null>(null)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [chunks, setChunks] = useState<{ id: number; content: string; chunkIndex: number }[]>([])
  const [chunksLoading, setChunksLoading] = useState(false)
  const [showChunks, setShowChunks] = useState(false)

  useEffect(() => { void load() }, [])
  useEffect(() => { setChunks([]); setShowChunks(false) }, [selected?.id])

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
    } catch (ex) { setError(ex instanceof Error ? ex.message : '上传失败') }
  }

  async function indexFile(file: KnowledgeFile) {
    setBusyId(file.id); setError('')
    try { const updated = await api.indexKnowledgeFile(file.id); await load(); setSelected(updated) }
    catch (ex) { setError(ex instanceof Error ? ex.message : '整理失败'); await load() }
    finally { setBusyId(null) }
  }

  async function remove(file: KnowledgeFile) {
    await api.deleteKnowledgeFile(file.id); setSelected(null); await load()
  }

  async function loadChunks() {
    if (!selected || selected.status !== 'indexed') return
    if (showChunks) { setShowChunks(false); return }
    setChunksLoading(true)
    try { const data = await api.getKnowledgeChunks(selected.id); setChunks(data); setShowChunks(true) }
    catch (ex) { setError(ex instanceof Error ? ex.message : '加载片段失败') }
    finally { setChunksLoading(false) }
  }

  const filtered = files.filter(f => !query || f.filename.includes(query) || f.tags.join(' ').includes(query))

  return (
    <div className="h-screen flex bg-[#f5f7fa]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ═══ 左侧导航栏 ═══ */}
      <nav className="w-[200px] shrink-0 bg-[#f0f4ff] border-r border-[#e2e8f0] flex flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="p-3 border-b border-[#e2e8f0]"><div className="flex items-center gap-2.5"><img src="/sparklearn-logo-official.png" alt="" className="h-8 w-8 object-contain" /><div><div className="text-xs font-bold text-[#1e293b]">学而思 SparkLearn</div><div className="text-[10px] text-[#94a3b8]">个性化学习闭环</div></div></div></div>
        <div className="p-3">
          <button onClick={() => router.push('/tutor')} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> 新建对话
          </button>
        </div>
        <div className="px-3 space-y-0.5 flex-1">
          <button onClick={() => router.push('/tutor')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Sparkles className="w-4 h-4" /> 学习空间
          </button>
          <button onClick={() => router.push('/tutor/roles')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <UserCog className="w-4 h-4" /> 角色工坊
          </button>
          <button onClick={() => router.push('/tutor/workshop')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Users className="w-4 h-4" /> 研讨会
          </button>
          <div className="my-3 border-t border-[#e2e8f0]" />
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-medium shadow-sm">
            <Database className="w-4 h-4" /> 知识库
          </div>
          <button onClick={() => router.push('/tutor/files')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Paperclip className="w-4 h-4" /> 我的文件
          </button>
        </div>
        <div className="p-3 border-t border-[#e2e8f0] space-y-2">
          <button onClick={() => router.push('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回主平台
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-xs font-bold text-white">李</div>
            <div><p className="text-sm font-medium text-[#1e293b]">李明</p><p className="text-[11px] text-[#94a3b8]">学习平台</p></div>
          </div>
        </div>
      </nav>

      {/* 隐藏的文件上传 input */}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />

      {/* ═══ 主内容区 ═══ */}
      <main className="flex-1 flex overflow-hidden">
        {/* 二级侧边栏 - 最近处理情况 */}
        <aside className="w-[220px] shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          <div className="p-4 border-b border-[#f1f5f9]">
            <h3 className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider">最近处理</h3>
          </div>
          <div className="p-3 space-y-1">
            {files.length === 0 ? (
              <p className="px-3 py-4 text-xs text-[#94a3b8] text-center">暂无文件</p>
            ) : (
              files.slice(0, 10).map((file) => (
                <button
                  key={file.id}
                  onClick={() => setSelected(file)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${selected?.id === file.id ? 'bg-[#eff6ff] text-[#2563eb]' : 'text-[#475569] hover:bg-[#f8fafc]'}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 shrink-0 rounded-full ${file.status === 'indexed' ? 'bg-[#059669]' : file.status === 'processing' ? 'bg-[#2563eb] animate-pulse' : file.status === 'failed' ? 'bg-[#dc2626]' : 'bg-[#d97706]'}`} />
                    <span className="text-sm font-medium truncate">{file.filename}</span>
                  </div>
                  <div className="mt-1 pl-4 flex items-center gap-2 text-[11px] text-[#94a3b8]">
                    <span>{{ pending: '待处理', processing: '整理中', indexed: '已整理', failed: '失败' }[file.status]}</span>
                    <span>·</span>
                    <span>{file.chunkCount} 片段</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* 主内容 */}
        <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-8 py-6">
          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#1e293b]">知识库</h1>
            <p className="mt-1 text-sm text-[#64748b]">上传课程资料后执行整理，系统会提取文本、切片、生成摘要和标签，供资源生成与 AI 辅导引用。</p>
          </div>

          {/* 统计栏 */}
          <div className="grid grid-cols-4 gap-4 mb-6 max-[760px]:grid-cols-2">
            {[
              { value: stats.total, label: '文件总数', icon: <Files className="h-5 w-5" />, color: 'bg-[#ecfeff] text-[#0891b2]' },
              { value: stats.indexed, label: '已整理', icon: <CheckCircle2 className="h-5 w-5" />, color: 'bg-[#ecfdf5] text-[#059669]' },
              { value: stats.chunks, label: '知识片段', icon: <Layers className="h-5 w-5" />, color: 'bg-[#f3efff] text-[#7c3aed]' },
              { value: stats.references, label: '引用次数', icon: <Link2 className="h-5 w-5" />, color: 'bg-[#eff6ff] text-[#2563eb]' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${item.color}`}>{item.icon}</div>
                <div>
                  <b className="block text-xl text-[#1e293b]">{item.value}</b>
                  <span className="text-xs text-[#64748b]">{item.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 主体 */}
          <div className="grid grid-cols-[340px_1fr] gap-5 max-[900px]:grid-cols-1">
            {/* 左侧：上传 */}
            <div className="space-y-4">
              <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
                <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
                <button
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files) }}
                  className="grid min-h-[140px] w-full place-items-center rounded-xl border-2 border-dashed border-[#bfdbfe] bg-[#f8fafc] p-5 text-center hover:bg-[#eff6ff] transition-colors"
                >
                  <span>
                    <FileUp className="mx-auto mb-2 h-7 w-7 text-[#2563eb]" />
                    <b className="block text-sm text-[#1e293b]">拖拽或点击上传资料</b>
                    <span className="mt-1 block text-xs text-[#64748b]">支持 PDF、DOCX、TXT、MD</span>
                  </span>
                </button>
                {error && <p className="mt-3 rounded-lg bg-[#fef2f2] p-3 text-xs text-[#dc2626]">{error}</p>}
              </div>
              <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 space-y-2">
                <InfoCard title="AI 结构化提取" text="自动提取摘要、标签和片段，用于后续生成。" />
                <InfoCard title="资料可用于" text="资源生成、AI 问答、错题补弱和报告建议。" />
              </div>
            </div>

            {/* 右侧：文件列表 */}
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
              <div className="mb-4 flex h-9 items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3">
                <Search className="h-4 w-4 text-[#94a3b8]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#94a3b8]" placeholder="搜索文件、标签、摘要" />
              </div>
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[#f8fafc] text-xs text-[#64748b]">
                    <tr>
                      <th className="p-3">文件</th>
                      <th className="p-3">标签</th>
                      <th className="p-3">状态</th>
                      <th className="p-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((file) => (
                      <tr key={file.id} className={`border-t border-[#f1f5f9] ${selected?.id === file.id ? 'bg-[#eff6ff]' : 'bg-white'}`}>
                        <td className="p-3">
                          <button onClick={() => setSelected(file)} className="text-left">
                            <b className="block text-[#1e293b]">{file.filename}</b>
                            <span className="text-xs text-[#94a3b8]">{Math.round(file.sizeBytes / 1024)}KB · {file.chunkCount} 条片段</span>
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">{file.tags.slice(0, 3).map(tag => <span key={tag} className="rounded-md bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#2563eb]">{tag}</span>)}</div>
                        </td>
                        <td className="p-3">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${file.status === 'indexed' ? 'bg-[#ecfdf5] text-[#059669]' : file.status === 'failed' ? 'bg-[#fef2f2] text-[#dc2626]' : 'bg-[#fff7ed] text-[#d97706]'}`}>
                            {{ pending: '待处理', processing: '整理中', indexed: '已整理', failed: '失败' }[file.status] || file.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button onClick={() => void indexFile(file)} disabled={busyId === file.id} className="rounded-lg bg-[#f1f5f9] px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#e2e8f0] disabled:opacity-50">
                              {busyId === file.id ? '...' : '整理'}
                            </button>
                            <button onClick={() => void remove(file)} className="grid h-7 w-7 place-items-center rounded-lg text-[#94a3b8] hover:bg-[#fef2f2] hover:text-[#dc2626]">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && <div className="p-5 text-sm text-[#94a3b8]">暂无资料。</div>}
              </div>
            </div>
          </div>

          {/* 底部：摘要 + 隐私 */}
          <div className="mt-5 grid grid-cols-[1.2fr_.8fr] gap-5 max-[900px]:grid-cols-1">
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#eff6ff] text-[#2563eb]"><FileText className="h-4 w-4" /></div>
                <h2 className="text-sm font-bold text-[#1e293b]">资料摘要</h2>
              </div>
              <p className="text-sm leading-7 text-[#64748b]">{selected?.summary || '选择文件后查看整理摘要。'}</p>
              {selected?.status === 'indexed' && (
                <div className="mt-4">
                  <button onClick={() => void loadChunks()} disabled={chunksLoading} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2 text-sm font-medium text-[#1e293b] hover:border-[#2563eb] hover:bg-[#eff6ff] transition-colors">
                    {showChunks ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showChunks ? '收起知识片段' : `查看向量化结果（${selected.chunkCount} 条片段）`}
                  </button>
                  {showChunks && chunks.length > 0 && (
                    <div className="mt-3 max-h-[400px] overflow-y-auto rounded-lg border border-[#e2e8f0]">
                      {chunks.map((chunk, idx) => (
                        <div key={chunk.id} className={`p-4 ${idx > 0 ? 'border-t border-[#f1f5f9]' : ''}`}>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="rounded-md bg-[#eff6ff] px-1.5 py-0.5 text-xs font-bold text-[#2563eb]">#{chunk.chunkIndex + 1}</span>
                            <span className="text-xs text-[#94a3b8]">{chunk.content.length} 字符</span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-[#64748b]">{chunk.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#ecfeff] text-[#0891b2]"><Database className="h-4 w-4" /></div>
                <h2 className="text-sm font-bold text-[#1e293b]">隐私与使用</h2>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg bg-[#f8fafc] p-3 text-sm text-[#64748b]">资料仅存储在本地项目数据目录。</div>
                <div className="rounded-lg bg-[#f8fafc] p-3 text-sm text-[#64748b]">只有已整理资料会进入生成上下文。</div>
                <div className="rounded-lg bg-[#f8fafc] p-3 text-sm text-[#64748b]">删除文件会同步删除知识片段。</div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] p-3">
      <b className="block text-sm text-[#1e293b]">{title}</b>
      <span className="mt-1 block text-xs leading-5 text-[#64748b]">{text}</span>
    </div>
  )
}
