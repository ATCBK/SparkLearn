'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Link2,
  NotebookPen,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  LearningNote,
  NoteSource,
  noteSourceTypeLabel,
  readLearningNotes,
  writeLearningNotes,
} from '@/lib/learningNotes'

interface OpenNotesEventDetail {
  source?: NoteSource
  draftTitle?: string
  draftContent?: string
  openEditor?: boolean
}

declare global {
  interface WindowEventMap {
    'open-learning-notes': CustomEvent<OpenNotesEventDetail>
  }
}

function createId() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseTags(value: string) {
  return value
    .split(/[，,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function inferSource(pathname: string, searchParams: URLSearchParams): NoteSource {
  const resourceId = searchParams.get('id')
  if (pathname === '/generate' && resourceId) {
    return {
      type: 'resource',
      id: resourceId,
      title: `当前资源 ${resourceId}`,
      href: `/generate?view=library&id=${resourceId}`,
    }
  }

  if (pathname === '/generate') return { type: 'resource', title: '资源中心', href: '/generate' }
  if (pathname === '/knowledge') return { type: 'knowledge', title: '知识库资料', href: '/knowledge' }
  if (pathname === '/practice') return { type: 'practice', title: '练习评测', href: '/practice' }
  if (pathname === '/path') return { type: 'course', title: '个性化学习路径', href: '/path' }
  if (pathname === '/report') return { type: 'space', title: '学习报告', href: '/report' }
  return { type: 'space', title: '学习工作台', href: pathname || '/' }
}

function isSameSource(note: LearningNote, source: NoteSource) {
  if (note.source.type !== source.type) return false
  if (source.id) return note.source.id === source.id
  return note.source.href === source.href
}

export function LearningNotesPanel() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<LearningNote[]>([])
  const [sourceOverride, setSourceOverride] = useState<{ source: NoteSource; routeKey: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true)

  const currentSource = useMemo(() => {
    return sourceOverride?.routeKey === routeKey ? sourceOverride.source : inferSource(pathname, searchParams)
  }, [pathname, routeKey, searchParams, sourceOverride])

  useEffect(() => {
    function refreshNotes() {
      setNotes(readLearningNotes())
    }

    const timer = window.setTimeout(refreshNotes, 0)
    window.addEventListener('learning-notes-updated', refreshNotes)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('learning-notes-updated', refreshNotes)
    }
  }, [])

  useEffect(() => {
    function handleOpen(event: WindowEventMap['open-learning-notes']) {
      const detail = event.detail || {}
      if (detail.source) setSourceOverride({ source: detail.source, routeKey })
      setOpen(true)
      if (detail.openEditor !== false) {
        setEditingId('new')
        setTitle(detail.draftTitle || '')
        setContent(detail.draftContent || '')
        setTagInput('')
        setPersonalizationEnabled(true)
      }
    }

    window.addEventListener('open-learning-notes', handleOpen)
    return () => window.removeEventListener('open-learning-notes', handleOpen)
  }, [routeKey])

  const filteredNotes = useMemo(() => {
    const text = query.trim().toLowerCase()
    return notes
      .filter((note) => (scope === 'all' ? true : isSameSource(note, currentSource)))
      .filter((note) => {
        if (!text) return true
        return [note.title, note.content, note.source.title, ...note.tags].some((item) => item.toLowerCase().includes(text))
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [currentSource, notes, query, scope])

  const currentCount = notes.filter((note) => isSameSource(note, currentSource)).length

  function resetEditor() {
    setEditingId(null)
    setTitle('')
    setContent('')
    setTagInput('')
    setPersonalizationEnabled(true)
  }

  function startNew() {
    setEditingId('new')
    setTitle('')
    setContent('')
    setTagInput('')
    setPersonalizationEnabled(true)
    setOpen(true)
  }

  function startEdit(note: LearningNote) {
    setEditingId(note.id)
    setTitle(note.title)
    setContent(note.content)
    setTagInput(note.tags.join('，'))
    setPersonalizationEnabled(note.personalizationEnabled !== false)
    setSourceOverride({ source: note.source, routeKey })
  }

  function saveNote() {
    const now = new Date().toISOString()
    const trimmedTitle = title.trim() || `${noteSourceTypeLabel[currentSource.type]}笔记`
    const trimmedContent = content.trim()
    if (!trimmedContent) return

    let next: LearningNote[]
    if (editingId && editingId !== 'new') {
      next = notes.map((note) =>
        note.id === editingId
          ? {
              ...note,
              title: trimmedTitle,
              content: trimmedContent,
              source: currentSource,
              tags: parseTags(tagInput),
              personalizationEnabled,
              updatedAt: now,
            }
          : note,
      )
    } else {
      next = [
        {
          id: createId(),
          title: trimmedTitle,
          content: trimmedContent,
          source: currentSource,
          tags: parseTags(tagInput),
          personalizationEnabled,
          createdAt: now,
          updatedAt: now,
        },
        ...notes,
      ]
    }
    setNotes(next)
    writeLearningNotes(next)
    resetEditor()
    setScope('current')
  }

  function deleteNote(noteId: string) {
    const next = notes.filter((note) => note.id !== noteId)
    setNotes(next)
    writeLearningNotes(next)
    if (editingId === noteId) resetEditor()
  }

  function goSource(source: NoteSource) {
    setOpen(false)
    router.push(source.href)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="learning-notes-open"
        data-guide-target="learning-notes-open"
        className={cn(
          'fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center overflow-hidden rounded-l-[14px] border border-r-0 border-[#bfdbfe] bg-white text-blue shadow-lg transition-all duration-300 hover:w-[78px] hover:bg-blue-light',
          open ? 'w-0 translate-x-full opacity-0 pointer-events-none' : 'w-[42px] translate-x-0 opacity-100',
        )}
        title="学习笔记"
        aria-label="打开学习笔记"
      >
        <span className="flex h-[88px] w-[42px] shrink-0 flex-col items-center justify-center gap-2">
          <ChevronLeft className="h-4 w-4" />
          <NotebookPen className="h-4 w-4" />
        </span>
        <span className="mr-3 whitespace-nowrap text-small font-bold">笔记</span>
        {currentCount > 0 && (
          <span className="absolute left-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-blue px-1 text-[11px] font-bold text-white">
            {currentCount}
          </span>
        )}
      </button>

      {open && <div className="fixed inset-0 z-[55] bg-black/10 min-[900px]:hidden" onClick={() => setOpen(false)} />}

      <aside
        data-testid="learning-notes-panel"
        className={cn(
          'fixed bottom-0 right-0 top-14 z-[60] flex w-full max-w-[390px] flex-col border-l border-line bg-white shadow-[-16px_0_40px_rgba(15,23,42,0.12)] transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="border-b border-line px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-micro font-bold text-blue">
                <NotebookPen className="h-4 w-4" />
                学习笔记
              </div>
              <h2 className="mt-1 truncate text-[16px] font-bold text-ink">{currentSource.title}</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              data-testid="learning-notes-close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-bg-hover hover:text-ink"
              aria-label="折叠学习笔记"
              title="折叠"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => goSource(currentSource)}
            className="mt-3 flex w-full items-center justify-between rounded-[10px] border border-[#e8eef7] bg-[#f8fbff] px-3 py-2 text-left text-micro text-muted hover:border-[#bfdbfe]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-blue" />
              <span className="truncate">当前关联：{noteSourceTypeLabel[currentSource.type]} / {currentSource.title}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </header>

        <div className="border-b border-line p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setScope('current')}
              className={cn('h-8 flex-1 rounded-[8px] text-small font-bold transition-colors', scope === 'current' ? 'bg-blue text-white' : 'bg-[#f2f6fb] text-muted hover:bg-blue-light hover:text-blue')}
            >
              当前关联 {currentCount}
            </button>
            <button
              onClick={() => setScope('all')}
              className={cn('h-8 flex-1 rounded-[8px] text-small font-bold transition-colors', scope === 'all' ? 'bg-blue text-white' : 'bg-[#f2f6fb] text-muted hover:bg-blue-light hover:text-blue')}
            >
              全部笔记 {notes.length}
            </button>
          </div>
          <div className="mt-3 flex h-9 items-center gap-2 rounded-[10px] border border-line bg-[#f9fafb] px-3">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-small outline-none"
              placeholder="搜索标题、内容、标签"
            />
          </div>
          <button
            onClick={startNew}
            data-testid="learning-notes-new"
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] bg-blue px-3 text-small font-bold text-white transition-colors hover:bg-blue-dark"
          >
            <Plus className="h-4 w-4" />
            记到当前内容
          </button>
        </div>

        {editingId && (
          <section className="border-b border-line bg-[#fbfdff] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <b className="text-small text-ink">{editingId === 'new' ? '新建笔记' : '编辑笔记'}</b>
              <button onClick={resetEditor} className="text-micro font-bold text-muted hover:text-ink">取消</button>
            </div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              data-testid="learning-notes-title"
              className="h-9 w-full rounded-[9px] border border-line bg-white px-3 text-small outline-none focus:border-blue"
              placeholder="笔记标题"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              data-testid="learning-notes-content"
              className="mt-2 h-28 w-full resize-none rounded-[9px] border border-line bg-white px-3 py-2 text-small leading-6 outline-none focus:border-blue"
              placeholder="记录关键理解、易错点、复习提醒..."
            />
            <div className="mt-2 flex h-9 items-center gap-2 rounded-[9px] border border-line bg-white px-3">
              <Tag className="h-4 w-4 text-muted" />
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                data-testid="learning-notes-tags"
                className="min-w-0 flex-1 bg-transparent text-small outline-none"
                placeholder="标签，用逗号分隔"
              />
            </div>
            <label className="mt-2 flex items-center gap-2 rounded-[9px] border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-small text-[#1e3a8a]">
              <input
                type="checkbox"
                checked={personalizationEnabled}
                onChange={(event) => setPersonalizationEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-[#bfdbfe] accent-[#2563eb]"
              />
              用这条笔记优化个性化推荐
            </label>
            <button
              onClick={saveNote}
              data-testid="learning-notes-save"
              disabled={!content.trim()}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] bg-blue px-3 text-small font-bold text-white transition-colors hover:bg-blue-dark disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              保存笔记
            </button>
          </section>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {filteredNotes.map((note) => (
              <article key={note.id} className="rounded-[12px] border border-line bg-white p-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-small font-bold text-ink">{note.title}</h3>
                    <button onClick={() => goSource(note.source)} className="mt-1 flex max-w-full items-center gap-1.5 text-micro text-blue hover:text-blue-dark">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{noteSourceTypeLabel[note.source.type]} / {note.source.title}</span>
                    </button>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => startEdit(note)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-blue-light hover:text-blue" aria-label="编辑笔记">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteNote(note.id)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-red-light hover:text-red" aria-label="删除笔记">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-small leading-6 text-text">{note.content}</p>
                {note.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {note.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-[#f1f6fc] px-2 py-1 text-[11px] font-bold text-[#52627b]">
                        <Check className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#f8fafc] px-2 py-1 text-[11px] font-bold text-[#64748b]">
                  {note.personalizationEnabled !== false ? '已用于个性化' : '仅保存，不参与推荐'}
                </div>
              </article>
            ))}
            {!filteredNotes.length && (
              <div className="rounded-[12px] border border-dashed border-[#d7e2f0] bg-[#f9fbff] p-6 text-center">
                <NotebookPen className="mx-auto h-8 w-8 text-blue" />
                <p className="mt-3 text-small font-bold text-ink">还没有匹配的笔记</p>
                <p className="mt-1 text-micro leading-5 text-muted">点击“记到当前内容”，会自动关联到当前资源、任务或页面。</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
