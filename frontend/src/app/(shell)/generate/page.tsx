'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, Play, Save, Sparkles, ArrowLeft, Download, MessageCircle, Trash2, Search, Presentation, Brain, Video, Radio, CheckSquare, BookOpen, Code, Database } from 'lucide-react'
import { api, KnowledgeFile, Resource, StudentProfile } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard, Bar } from '@/components/proto'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'

const STEPS = ['确认上下文', '选择类型', '配置要求', '生成中', '预览结果', '保存学习']
const TYPES: Array<{ type: Resource['type']; label: string; desc: string }> = [
  { type: 'document', label: '讲解文档', desc: '结构化概念讲义' },
  { type: 'ppt', label: 'PPT', desc: '课堂式演示稿' },
  { type: 'mindmap', label: '思维导图', desc: '知识关系梳理' },
  { type: 'video', label: '教学视频', desc: 'AI 合成讲解视频' },
  { type: 'blog', label: '播客电台', desc: 'AI 生成音频播客' },
  { type: 'quiz', label: '练习题', desc: '达标检测题组' },
  { type: 'reading', label: '拓展阅读', desc: '延伸材料' },
  { type: 'code', label: '代码案例', desc: '可运行实践案例' },
]

function typeLabel(type: string) {
  const map: Record<string, string> = { document: '讲义', ppt: 'PPT', mindmap: '思维导图', quiz: '题集', reading: '阅读', code: '代码案例', video: '视频', blog: '播客电台' }
  return map[type] || type
}

export default function GeneratePage() {
  const [view, setView] = useState<'generate' | 'library'>('generate')
  const [step, setStep] = useState(0)
  const [type, setType] = useState<Resource['type']>('document')
  const [prompt, setPrompt] = useState('请基于当前薄弱点"函数返回值"生成一份12分钟代码案例讲义，包含生活化类比、可运行代码、常见错误和5道检查题。')
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeFile[]>([])
  const [selectedKnowledge, setSelectedKnowledge] = useState<number[]>([])
  const [resource, setResource] = useState<Resource | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  
  // 资源库相关状态
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('全部')
  const [libraryError, setLibraryError] = useState('')

  useEffect(() => {
    let mounted = true
    Promise.allSettled([api.getProfile(), api.getKnowledgeFiles({ status: 'indexed' })]).then(([p, k]) => {
      if (!mounted) return
      if (p.status === 'fulfilled') setProfile(p.value)
      if (k.status === 'fulfilled') setKnowledge(k.value)
    })
    return () => {
      mounted = false
    }
  }, [])

  async function loadResources() {
    try {
      const data = await api.getResources()
      setResources(data)
      setSelectedId(prev => prev || data[0]?.id || '')
    } catch (ex) {
      setLibraryError(ex instanceof Error ? ex.message : '资源读取失败')
    }
  }

  useEffect(() => {
    if (view === 'library') {
      void loadResources()
    }
  }, [view])

  async function startGenerate() {
    setStep(3)
    setGenerating(true)
    setError('')
    setResource(null)
    try {
      const res = await api.generateResource(type, prompt, selectedKnowledge)
      setResource(res)
      setStep(4)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  async function removeResource(id: string) {
    await api.deleteResource(id)
    await loadResources()
  }

  const filtered = resources.filter((r) => {
    const matchQuery = !query || r.title.includes(query) || r.type.includes(query)
    const matchFilter = filter === '全部' || r.type === filter
    return matchQuery && matchFilter
  })
  const selected = resources.find(r => r.id === selectedId) || filtered[0]

  if (view === 'library') {
    return (
      <div>
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => setView('generate')} className="flex items-center gap-2 text-blue hover:text-blue-dark transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-bold">返回生成</span>
          </button>
        </div>

        <PageHead
          eyebrow="资源中心 / 资源库"
          title="资源库"
          description="所有生成和推荐过的资源都会沉淀在这里，学习进度会影响后续练习与报告。"
          chips={[
            { value: `${resources.length}`, label: '已保存资源', icon: <Database className="h-4 w-4" />, tone: 'cyan' as const },
            { value: `${resources.filter(r => r.status === 'completed').length}`, label: '可学习', icon: <BookOpen className="h-4 w-4" />, tone: 'green' as const },
            { value: `${resources.filter(r => r.type === 'ppt').length}`, label: 'PPT', icon: <Presentation className="h-4 w-4" />, tone: 'purple' as const },
          ]}
        />

        <div className="grid grid-cols-[360px_1fr] gap-4 max-[980px]:grid-cols-1">
          <ProtoCard>
            <div className="mb-3 grid gap-2">
              <div className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-[#f9fafb] px-3">
                <Search className="h-4 w-4 text-muted" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-small outline-none" placeholder="搜索资源或知识点" />
              </div>
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-[10px] border border-line bg-white px-3 text-small outline-none">
                {['全部', 'document', 'ppt', 'mindmap', 'quiz', 'reading', 'code', 'video', 'blog'].map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              {filtered.map((res) => (
                <button key={res.id} onClick={() => setSelectedId(res.id)} className={`rounded-[12px] border p-3 text-left ${selected?.id === res.id ? 'border-blue bg-blue-light' : 'border-line bg-white hover:border-blue'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <b className="line-clamp-1 text-small text-ink">{res.title}</b>
                    <Pill tone={res.status === 'completed' ? 'green' : res.status === 'failed' ? 'red' : 'blue'}>{res.status}</Pill>
                  </div>
                  <span className="mt-1 block text-micro text-muted">{typeLabel(res.type)} · 关联薄弱点：函数返回值</span>
                </button>
              ))}
              {!filtered.length && <SoftCard className="text-small text-muted">没有匹配资源。</SoftCard>}
            </div>
          </ProtoCard>

          <ProtoCard>
            {libraryError && <p className="mb-3 rounded-[10px] bg-red-light p-3 text-small text-red">{libraryError}</p>}
            {selected ? (
              <div>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <Pill tone="blue">{typeLabel(selected.type)}</Pill>
                    <h2 className="mt-3 text-[22px] font-bold text-ink">{selected.title}</h2>
                    <p className="mt-2 text-small text-muted">来源：AI 生成 · 关联薄弱点：函数返回值 · 学习进度 {selected.progress ?? 42}%</p>
                  </div>
                  <Pill tone="green">可学习</Pill>
                </div>
                <Bar value={selected.progress ?? 42} />
                <div className="mt-4 min-h-[300px] overflow-hidden rounded-[12px] border border-line bg-[#f9fafb]">
                  {selected.sourceUrl ? (
                    <iframe title={selected.title} src={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'}/api/resources/${selected.id}/preview/html`} className="h-[420px] w-full border-0" />
                  ) : (
                    <div className="p-5">
                      <pre className="whitespace-pre-wrap break-words text-small leading-7 text-text">{selected.content || '该资源暂无预览内容。'}</pre>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ProtoButton href="/practice">学完去练习</ProtoButton>
                  <ProtoButton variant="secondary"><MessageCircle className="h-4 w-4" />让 AI 讲解</ProtoButton>
                  <ProtoButton variant="tertiary" onClick={() => void api.downloadResource(selected.id)}><Download className="h-4 w-4" />下载</ProtoButton>
                  <ProtoButton variant="tertiary" onClick={() => void removeResource(selected.id)}><Trash2 className="h-4 w-4" />删除</ProtoButton>
                </div>
              </div>
            ) : (
              <SoftCard className="text-small text-muted">暂无资源，先到资源中心生成。</SoftCard>
            )}
          </ProtoCard>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-5 border-b border-line pb-4">
        <div className="mb-2 text-small font-extrabold text-soft">资源中心 / 生成与资源库</div>
        <div className="flex items-center gap-3">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#eff6ff] text-[#2563eb]">
            <Sparkles className="h-4 w-4" />
          </div>
          <h1 className="m-0 text-h1 font-bold leading-tight tracking-normal text-ink">资源中心</h1>
          <button onClick={() => setView('library')} className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] px-3.5 text-small font-bold transition-colors bg-white text-blue ring-1 ring-[#bfdbfe] hover:bg-blue-light">进入资源库</button>
        </div>
        <p className="mt-2 max-w-[760px] text-body leading-7 text-muted">在这里生成个性化学习资源，也可以进入资源库管理已保存内容。</p>
      </header>

      <ProtoCard className="mb-4 overflow-hidden p-0">
        <div className="grid grid-cols-6 max-[900px]:grid-cols-3 max-[560px]:grid-cols-2">
          {STEPS.map((label, idx) => (
            <button
              key={label}
              onClick={() => setStep(idx)}
              className={`min-h-16 border-0 border-r border-[#eef2f7] p-3 text-left last:border-r-0 ${idx === step ? 'bg-blue-light text-blue shadow-[inset_0_-3px_0_#2563eb]' : idx < step ? 'bg-green-light text-green' : 'bg-white text-muted'}`}
            >
              <span className={`grid h-6 w-6 place-items-center rounded-md text-[11px] font-extrabold ${idx === step ? 'bg-[#eff6ff] text-[#2563eb]' : idx < step ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#f1f5f9] text-muted'}`}>0{idx + 1}</span>
              <b className="mt-1 block text-small">{label}</b>
            </button>
          ))}
        </div>
      </ProtoCard>

      <ProtoCard className="p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><b className="text-ink">资源生成流程</b><p className="text-micro text-muted">按步骤确认上下文、资料来源和生成要求，完成后保存到资源库。</p></div>
          <Pill tone="blue">当前：函数返回值补弱</Pill>
        </div>
        <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Pill tone={generating ? 'blue' : resource ? 'green' : 'neutral'}>{generating ? '生成中' : resource ? '已完成' : '待配置'}</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">{step === 0 ? '确认这次资源要解决什么问题' : step === 1 ? '选择最适合这个节点的资源类型' : step === 2 ? '配置生成要求' : step === 3 ? '生成过程' : step === 4 ? '结果预览' : '保存并进入学习'}</h2>
          </div>
          <div className="flex gap-2">
            <ProtoButton variant="tertiary" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>上一步</ProtoButton>
            {step < 3 && <ProtoButton onClick={() => setStep(step + 1)}>下一步</ProtoButton>}
            {step === 3 && <ProtoButton onClick={() => void startGenerate()} disabled={generating}><Play className="h-4 w-4" />开始生成</ProtoButton>}
          </div>
        </div>

        {step === 0 && (
          <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
            <SoftCard><b className="text-ink">当前节点</b><p className="mt-2 text-small text-muted">{profile?.currentStage || '函数返回值与作用域修正'}。模块导入已暂缓，需要先修正 return 返回给调用处的理解。</p></SoftCard>
            <SoftCard><b className="text-ink">学生偏好</b><p className="mt-2 text-small text-muted">{profile?.learningPreference?.join('、') || '代码案例优先，短讲义加检查题效果最好'}。</p></SoftCard>
            <SoftCard><b className="text-ink">错题证据</b><p className="mt-2 text-small text-muted">3 道题把局部变量、返回值和 print 输出混在一起。</p></SoftCard>
            <SoftCard><b className="text-ink">本次目标</b><p className="mt-2 text-small text-muted">12 分钟内能解释"函数内部算出的结果如何交给主流程"。</p></SoftCard>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
            {TYPES.map((item) => {
              const IconMap: Record<string, { icon: React.ReactNode; color: string }> = {
                document: { icon: <FileText className="h-4 w-4" />, color: 'bg-[#eff6ff] text-[#2563eb]' },
                ppt: { icon: <Presentation className="h-4 w-4" />, color: 'bg-[#fff7ed] text-[#d97706]' },
                mindmap: { icon: <Brain className="h-4 w-4" />, color: 'bg-[#f3efff] text-[#7c3aed]' },
                video: { icon: <Video className="h-4 w-4" />, color: 'bg-[#f3efff] text-[#7c3aed]' },
                blog: { icon: <Radio className="h-4 w-4" />, color: 'bg-[#ecfeff] text-[#0891b2]' },
                quiz: { icon: <CheckSquare className="h-4 w-4" />, color: 'bg-[#fff7ed] text-[#d97706]' },
                reading: { icon: <BookOpen className="h-4 w-4" />, color: 'bg-[#ecfdf5] text-[#059669]' },
                code: { icon: <Code className="h-4 w-4" />, color: 'bg-[#eff6ff] text-[#2563eb]' },
              }
              const t = IconMap[item.type] || { icon: <FileText className="h-4 w-4" />, color: 'bg-[#eff6ff] text-[#2563eb]' }
              return (
                <button key={item.type} onClick={() => setType(item.type)} className={`rounded-[12px] border p-4 text-left ${type === item.type ? 'border-blue bg-blue-light' : 'border-line bg-white hover:border-blue'}`}>
                  <div className={`mb-3 grid h-9 w-9 place-items-center rounded-xl ${t.color}`}>
                    {t.icon}
                  </div>
                  <b className="block text-ink">{item.label}</b>
                  <span className="mt-1 block text-small text-muted">{item.desc}</span>
                </button>
              )
            })}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
            <div>
              <h3 className="text-h3 font-bold text-ink">生成侧重点</h3>
              <div className="mt-3 grid gap-3">
                <SoftCard className="bg-blue-light"><b className="text-ink">项目案例优先</b><span className="mt-1 block text-small text-muted">用"成绩统计小程序"承载函数参数、返回值和局部变量。</span></SoftCard>
                <SoftCard><b className="text-ink">错题拆解优先</b><span className="mt-1 block text-small text-muted">逐题解释为什么 print 输出不等于 return。</span></SoftCard>
                <SoftCard><b className="text-ink">达标练习优先</b><span className="mt-1 block text-small text-muted">先给题，再按错误类型补讲解。</span></SoftCard>
              </div>
            </div>
            <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-small font-bold text-ink">生成要求</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} className="rounded-[14px] border border-line bg-[#f9fafb] p-4 text-small leading-6 outline-none focus:border-blue" />
            </label>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-small font-bold text-ink">选择已整理资料</span>
                <ProtoButton href="/knowledge" variant="ghost">去知识库</ProtoButton>
              </div>
              <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
                {knowledge.map((file) => (
                  <label key={file.id} className="flex gap-3 rounded-[12px] border border-line bg-white p-3">
                    <input
                      type="checkbox"
                      checked={selectedKnowledge.includes(file.id)}
                      onChange={(event) => setSelectedKnowledge(prev => event.target.checked ? [...prev, file.id] : prev.filter(id => id !== file.id))}
                    />
                    <span className="min-w-0">
                      <b className="block truncate text-small text-ink">{file.filename}</b>
                      <span className="text-micro text-muted">{file.chunkCount} 条片段 · {file.tags.slice(0, 2).join('、')}</span>
                    </span>
                  </label>
                ))}
                {!knowledge.length && <SoftCard className="text-small text-muted">暂无已整理资料，可先到知识库上传并整理。</SoftCard>}
              </div>
            </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3">
            {['分析学习画像', '读取路径节点', '加载知识库资料', '多智能体生成内容', '安全检查', '保存资源索引'].map((row, idx) => (
              <SoftCard key={row} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-small font-bold text-ink">
                  {generating && idx < 4 ? <TypewriterLoader size="sm" /> : <CheckCircle2 className="h-4 w-4 text-green" />}
                  {row}
                </span>
                <Pill tone={generating && idx < 4 ? 'blue' : 'green'}>{generating && idx < 4 ? '处理中' : '完成'}</Pill>
              </SoftCard>
            ))}
            {error && <p className="rounded-[10px] bg-red-light p-3 text-small text-red">{error}</p>}
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4">
            {resource ? (
              <>
                <SoftCard>
                  <b className="block text-h2 text-ink">{resource.title}</b>
                  {resource.type === 'video' ? (
                    <div className="mt-3">
                      {resource.videoUrl ? (
                        <video src={resource.videoUrl} controls className="w-full rounded-xl bg-black" />
                      ) : (
                        <div className="flex items-center justify-center h-48 rounded-xl bg-[#1e293b] text-white/60">
                          <div className="text-center">
                            <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">视频已生成，可在视频页面查看完整预览</p>
                          </div>
                        </div>
                      )}
                      <p className="mt-2 text-small text-muted">视频资源已保存，可前往视频页面播放、下载音频和字幕。</p>
                    </div>
                  ) : (
                    <p className="mt-2 whitespace-pre-line text-small leading-6 text-muted">{resource.content?.slice(0, 700) || '资源已生成，可进入资源库查看完整预览。'}</p>
                  )}
                </SoftCard>
                <div className="flex gap-2">
                  {resource.type === 'video' ? (
                    <button onClick={() => setView('library')} className="px-4 py-2 rounded-[10px] bg-blue text-small font-bold text-white hover:bg-blue-dark transition-colors">在资源库中查看</button>
                  ) : (
                    <button onClick={() => setView('library')} className="px-4 py-2 rounded-[10px] bg-blue text-small font-bold text-white hover:bg-blue-dark transition-colors">进入资源库</button>
                  )}
                  <ProtoButton href="/practice" variant="secondary">生成配套练习</ProtoButton>
                  <ProtoButton onClick={() => setStep(5)} variant="tertiary"><Save className="h-4 w-4" />确认保存</ProtoButton>
                </div>
              </>
            ) : (
              <SoftCard className="text-small text-muted">生成完成后会在这里展示预览。</SoftCard>
            )}
          </div>
        )}

        {step === 5 && (
          <SoftCard className="flex items-center justify-between gap-3">
            <div>
              <b className="text-ink">已保存到资源库</b>
              <p className="mt-1 text-small text-muted">资源已关联当前路径节点，下一步建议开始学习并完成达标题。</p>
            </div>
            <button onClick={() => setView('library')} className="px-4 py-2 rounded-[10px] bg-blue text-small font-bold text-white hover:bg-blue-dark transition-colors flex items-center gap-2"><Sparkles className="h-4 w-4" />查看资源</button>
          </SoftCard>
        )}
        </div>
      </ProtoCard>
    </div>
  )
}
