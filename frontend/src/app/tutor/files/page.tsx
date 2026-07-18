'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Database,
  FileText,
  Paperclip,
  Plus,
  Puzzle,
  Sparkles,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react'
import { api, TutorFile } from '@/lib/api'
import { TutorUserBadge } from '@/components/tutor/TutorUserBadge'

export default function TutorFilesPage() {
  const router = useRouter()
  const [files, setFiles] = useState<TutorFile[]>([])
  const [selected, setSelected] = useState<TutorFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  const openDetail = useCallback(async (file: TutorFile) => {
    setSelected(file)
    setDetailLoading(true)
    try {
      const detail = await api.getTutorFile(file.id)
      setSelected(detail)
    } catch {
      setSelected(file)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getTutorFiles()
      setFiles(data)
      if (data[0]) {
        void openDetail(data[0])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [openDetail])

  useEffect(() => { void load() }, [load])

  async function remove(id: number) {
    await api.deleteTutorFile(id)
    if (selected?.id === id) setSelected(null)
    await load()
  }

  const analysis = selected?.analysis || {}
  const keyPoints = analysis.key_points || []

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
          <button onClick={() => router.push('/tutor/knowledge')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Database className="w-4 h-4" /> 知识库
          </button>
          <button onClick={() => router.push('/tutor/mcp-store')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Puzzle className="w-4 h-4" /> MCP 插件商店
          </button>
          <button onClick={() => router.push('/tutor/skills')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Sparkles className="w-4 h-4" /> Skills 商店
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-medium shadow-sm">
            <Paperclip className="w-4 h-4" /> 我的文件
          </div>
        </div>
        <div className="p-3 border-t border-[#e2e8f0] space-y-2">
          <button onClick={() => router.push('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回主平台
          </button>
          <TutorUserBadge />
        </div>
      </nav>

      {/* ═══ 主内容区 ═══ */}
      <main className="min-w-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full max-w-[800px] flex-col px-8 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#1e293b]">我的文件</h1>
            <p className="mt-1 text-sm text-[#64748b]">对话中上传的文件会保存在这里，网页抓取资料请到资源中心查看。</p>
          </div>

          {loading ? (
            <div className="py-20 text-center text-sm text-[#94a3b8]">加载中...</div>
          ) : files.length === 0 ? (
            <div className="py-20 text-center">
              <Paperclip className="mx-auto mb-3 h-8 w-8 text-[#d1d5db]" />
              <p className="text-sm text-[#64748b]">暂无上传文件</p>
              <p className="mt-1 text-xs text-[#94a3b8]">在对话中上传文件后会自动出现在这里</p>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] gap-5 overflow-hidden max-[900px]:grid-cols-1">
              <div className="min-h-0 overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white">
                {files.map((file) => {
                  const active = selected?.id === file.id
                  return (
                    <button
                      key={file.id}
                      onClick={() => void openDetail(file)}
                      className={`flex w-full items-start gap-3 border-b border-[#f1f5f9] p-4 text-left transition-colors last:border-b-0 ${active ? 'bg-[#eff6ff]' : 'hover:bg-[#f8fafc]'}`}
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb]">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-sm font-semibold text-[#1e293b]">{file.filename}</div>
                        <div className="mt-1 text-xs text-[#64748b]">{file.mimeType || '上传文件'} · {(file.sizeBytes / 1024).toFixed(1)} KB</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <section className="min-h-0 overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white p-5">
                {!selected ? (
                  <div className="py-24 text-center text-sm text-[#94a3b8]">选择一份资料查看解析结果</div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#2563eb]" />
                          <span className="text-xs font-bold text-[#64748b]">上传资料</span>
                        </div>
                        <h2 className="mt-2 text-lg font-bold text-[#1e293b]">{selected.filename}</h2>
                        {selected.sourceUrl ? (
                          <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-[#2563eb] hover:underline">
                            {selected.sourceUrl}
                          </a>
                        ) : null}
                      </div>
                      <button onClick={() => void remove(selected.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#94a3b8] transition-colors hover:bg-[#fef2f2] hover:text-[#dc2626]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {detailLoading ? <div className="mt-8 text-sm text-[#94a3b8]">正在加载解析结果...</div> : null}

                    {analysis.summary ? (
                      <div className="mt-5 grid gap-4">
                        <div className="rounded-xl bg-[#f8fafc] p-4">
                          <div className="text-xs font-bold text-[#64748b]">摘要</div>
                          <p className="mt-2 text-sm leading-6 text-[#334155]">{analysis.summary}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-xl bg-[#f8fafc] p-4">
                            <div className="text-xs font-bold text-[#64748b]">适合人群</div>
                            <p className="mt-2 text-sm leading-6 text-[#334155]">{analysis.audience}</p>
                          </div>
                          <div className="rounded-xl bg-[#f8fafc] p-4">
                            <div className="text-xs font-bold text-[#64748b]">推荐学习方式</div>
                            <p className="mt-2 text-sm leading-6 text-[#334155]">{analysis.learning_method}</p>
                          </div>
                        </div>

                        <div className="rounded-xl bg-[#f8fafc] p-4">
                          <div className="text-xs font-bold text-[#64748b]">关键知识点</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {keyPoints.map((point, index) => (
                              <span key={`${point}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#2563eb] ring-1 ring-[#bfdbfe]">{point}</span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl bg-[#f8fafc] p-4">
                          <div className="text-xs font-bold text-[#64748b]">AI 讲解稿</div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#334155]">{analysis.lecture_script}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-xl bg-[#f8fafc] p-4">
                        <div className="text-xs font-bold text-[#64748b]">资料正文</div>
                        <p className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap text-sm leading-7 text-[#334155]">{selected.content || '这份资料暂无解析结果。'}</p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
