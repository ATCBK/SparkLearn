'use client'

import { useEffect, useState } from 'react'
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

export default function TutorFilesPage() {
  const router = useRouter()
  const [files, setFiles] = useState<TutorFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await api.getTutorFiles()
      setFiles(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function remove(id: number) {
    await api.deleteTutorFile(id)
    await load()
  }

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
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-medium shadow-sm">
            <Paperclip className="w-4 h-4" /> 我的文件
          </div>
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

      {/* ═══ 主内容区 ═══ */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[800px] px-8 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#1e293b]">我的文件</h1>
            <p className="mt-1 text-sm text-[#64748b]">在对话中上传过的所有文件都会保存在这里。</p>
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
            <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs text-[#64748b]">
                  <tr>
                    <th className="p-4">文件名</th>
                    <th className="p-4">类型</th>
                    <th className="p-4">大小</th>
                    <th className="p-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} className="border-t border-[#f1f5f9] hover:bg-[#f8fafc]">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb]">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-[#1e293b]">{file.filename}</span>
                        </div>
                      </td>
                      <td className="p-4 text-[#64748b]">{file.mimeType}</td>
                      <td className="p-4 text-[#64748b]">{(file.sizeBytes / 1024).toFixed(1)} KB</td>
                      <td className="p-4">
                        <button onClick={() => void remove(file.id)} className="grid h-8 w-8 place-items-center rounded-lg text-[#94a3b8] hover:bg-[#fef2f2] hover:text-[#dc2626] transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
