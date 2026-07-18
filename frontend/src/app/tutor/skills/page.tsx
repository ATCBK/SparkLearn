'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Paperclip,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Sparkles,
  UserCog,
  Users,
} from 'lucide-react'
import { addCustomSkill, LEARNING_SKILLS, markdownToSkill, readCustomSkills, SKILL_STORAGE_KEY, type LearningSkill } from '@/lib/skills'
import { cn } from '@/lib/utils/cn'
import { TutorUserBadge } from '@/components/tutor/TutorUserBadge'

function skillToneClass(tone: LearningSkill['tone']) {
  const tones: Record<LearningSkill['tone'], string> = {
    blue: 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
    green: 'border-[#bbf7d0] bg-[#ecfdf5] text-[#059669]',
    orange: 'border-[#fed7aa] bg-[#fff7ed] text-[#d97706]',
    purple: 'border-[#ddd6fe] bg-[#f5f3ff] text-[#7c3aed]',
    cyan: 'border-[#a5f3fc] bg-[#ecfeff] text-[#0891b2]',
    red: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  }
  return tones[tone]
}

export default function TutorSkillsPage() {
  const router = useRouter()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [customSkills, setCustomSkills] = useState<LearningSkill[]>(() => (typeof window === 'undefined' ? [] : readCustomSkills()))
  const [selectedSkillId, setSelectedSkillId] = useState(() => (typeof window === 'undefined' ? '' : localStorage.getItem(SKILL_STORAGE_KEY) || ''))
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const skillLibrary = useMemo(() => [...customSkills, ...LEARNING_SKILLS], [customSkills])
  const filteredSkills = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return skillLibrary
    return skillLibrary.filter((skill) => `${skill.title} ${skill.shortTitle} ${skill.category} ${skill.summary} ${skill.output}`.toLowerCase().includes(keyword))
  }, [search, skillLibrary])

  function chooseSkill(skillId: string) {
    const nextId = selectedSkillId === skillId ? '' : skillId
    setSelectedSkillId(nextId)
    if (nextId) localStorage.setItem(SKILL_STORAGE_KEY, nextId)
    else localStorage.removeItem(SKILL_STORAGE_KEY)
  }

  async function importSkills(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setNotice('')
    const markdownFiles = Array.from(files).filter((file) => /\.md$/i.test(file.name))
    if (markdownFiles.length === 0) {
      setError('请选择 Markdown（.md）技能文件')
      return
    }

    try {
      let nextSkills = readCustomSkills()
      for (const file of markdownFiles) {
        const content = await file.text()
        if (!content.trim()) continue
        nextSkills = addCustomSkill(markdownToSkill(content, file.name))
      }
      setCustomSkills(nextSkills)
      setNotice(`已导入 ${markdownFiles.length} 个技能到技能库`)
      if (importInputRef.current) importInputRef.current.value = ''
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '导入技能失败，请检查 Markdown 文件')
    }
  }

  return (
    <div className="h-screen flex bg-[#f5f7fa]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
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
            <Bot className="w-4 h-4" /> 知识库
          </button>
          <button onClick={() => router.push('/tutor/mcp-store')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Puzzle className="w-4 h-4" /> MCP 插件商店
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-medium shadow-sm">
            <Sparkles className="w-4 h-4" /> Skills 商店
          </div>
          <button onClick={() => router.push('/tutor/files')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <Paperclip className="w-4 h-4" /> 我的文件
          </button>
        </div>
        <div className="p-3 border-t border-[#e2e8f0] space-y-2">
          <button onClick={() => router.push('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#475569] hover:bg-white hover:text-[#1e293b] text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回主平台
          </button>
          <TutorUserBadge />
        </div>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto bg-[#fbfcfe]">
        <div className="mx-auto max-w-[980px] px-10 py-10">
          <div className="mb-12 flex items-start justify-between gap-8 max-[920px]:flex-col">
            <div className="pt-10 max-[920px]:pt-2">
              <h1 className="text-[30px] font-semibold leading-tight text-[#111827]">技能</h1>
              <p className="mt-2 text-base leading-7 text-[#8a93a3]">当前技能库共 {skillLibrary.length} 个技能。</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 max-[920px]:w-full max-[920px]:justify-start">
              <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[#8a93a3] hover:bg-white hover:text-[#475569]" onClick={() => setSearch('')}>
                <RefreshCw className="h-4 w-4" /> 刷新
              </button>
              <div className="flex h-10 w-[280px] items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 shadow-sm max-[520px]:w-full">
                <Search className="h-4 w-4 text-[#94a3b8]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索技能" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9ca3af]" />
              </div>
              <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white shadow-sm shadow-blue-100 hover:bg-[#1d4ed8]" onClick={() => importInputRef.current?.click()}>
                <Plus className="h-4 w-4" /> 新建技能
              </button>
              <input ref={importInputRef} type="file" accept=".md,text/markdown,text/plain" multiple className="hidden" onChange={(e) => void importSkills(e.target.files)} />
            </div>
          </div>

          {notice && <div className="mb-6 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1d4ed8]">{notice}</div>}
          {error && <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          <div className="mb-7 text-sm font-semibold text-[#374151]">已配置</div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-8 max-[980px]:grid-cols-1">
            {filteredSkills.map((skill) => {
              const active = selectedSkillId === skill.id
              return (
                <button key={skill.id} type="button" onClick={() => chooseSkill(skill.id)} className="group flex min-w-0 items-center gap-4 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white">
                  <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl border', skillToneClass(skill.tone))}>
                    <Puzzle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-[#1f2937]">{skill.title}</p>
                    <p className="mt-1 line-clamp-1 text-[14px] leading-5 text-[#8a93a3]">{skill.summary}</p>
                  </div>
                  <CheckCircle2 className={cn('h-5 w-5 shrink-0', active ? 'text-[#2563eb]' : 'text-[#c4cbd5]')} />
                </button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
