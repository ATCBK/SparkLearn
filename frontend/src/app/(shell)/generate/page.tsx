'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, Loader2, Play, Save, Sparkles } from 'lucide-react'
import { api, KnowledgeFile, Resource, StudentProfile } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

const STEPS = ['确认上下文', '选择类型', '配置要求', '开始生成', '预览结果', '保存学习']
const TYPES: Array<{ type: Resource['type']; label: string; desc: string }> = [
  { type: 'document', label: '讲解文档', desc: '结构化概念讲义' },
  { type: 'ppt', label: 'PPT', desc: '课堂式演示稿' },
  { type: 'mindmap', label: '思维导图', desc: '知识关系梳理' },
  { type: 'quiz', label: '练习题', desc: '达标检测题组' },
  { type: 'reading', label: '拓展阅读', desc: '延伸材料' },
  { type: 'code', label: '代码案例', desc: '可运行实践案例' },
]

export default function GeneratePage() {
  const [step, setStep] = useState(0)
  const [type, setType] = useState<Resource['type']>('document')
  const [prompt, setPrompt] = useState('请基于当前薄弱点“函数返回值”生成一份12分钟代码案例讲义，包含生活化类比、可运行代码、常见错误和5道检查题。')
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeFile[]>([])
  const [selectedKnowledge, setSelectedKnowledge] = useState<number[]>([])
  const [resource, setResource] = useState<Resource | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div>
      <PageHead
        eyebrow="资源与练习 / 资源中心"
        title="资源生成"
        description="按原型六步流程生成个性化资源，生成内容会结合学习画像、路径节点和选中的资料库内容。"
        chips={[
          { value: STEPS[step], label: '当前步骤' },
          { value: typeLabel(type), label: '资源类型' },
          { value: `${selectedKnowledge.length}份`, label: '参考资料' },
        ]}
      />

      <ProtoCard className="mb-4">
        <div className="grid grid-cols-6 gap-2 max-[900px]:grid-cols-3 max-[560px]:grid-cols-2">
          {STEPS.map((label, idx) => (
            <button
              key={label}
              onClick={() => setStep(idx)}
              className={`rounded-[12px] border p-3 text-left ${idx === step ? 'border-blue bg-blue-light text-blue' : idx < step ? 'border-green-light bg-green-light text-green' : 'border-line bg-white text-muted'}`}
            >
              <span className="block text-[11px] font-extrabold">0{idx + 1}</span>
              <b className="mt-1 block text-small">{label}</b>
            </button>
          ))}
        </div>
      </ProtoCard>

      <ProtoCard>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Pill tone={generating ? 'blue' : resource ? 'green' : 'neutral'}>{generating ? '生成中' : resource ? '已完成' : '待配置'}</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">{STEPS[step]}</h2>
          </div>
          <div className="flex gap-2">
            <ProtoButton variant="tertiary" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>上一步</ProtoButton>
            {step < 3 && <ProtoButton onClick={() => setStep(step + 1)}>下一步</ProtoButton>}
            {step === 3 && <ProtoButton onClick={() => void startGenerate()} disabled={generating}><Play className="h-4 w-4" />开始生成</ProtoButton>}
          </div>
        </div>

        {step === 0 && (
          <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
            <SoftCard><b className="text-ink">学习画像</b><p className="mt-2 text-small text-muted">{profile?.learningPreference?.join('、') || '实践型、案例驱动'}，每日 {profile?.dailyTime || 60} 分钟。</p></SoftCard>
            <SoftCard><b className="text-ink">当前路径</b><p className="mt-2 text-small text-muted">{profile?.currentStage || '函数与模块'}，优先补函数返回值。</p></SoftCard>
            <SoftCard><b className="text-ink">生成目标</b><p className="mt-2 text-small text-muted">生成后保存到资源库，并可直接进入练习。</p></SoftCard>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
            {TYPES.map((item) => (
              <button key={item.type} onClick={() => setType(item.type)} className={`rounded-[12px] border p-4 text-left ${type === item.type ? 'border-blue bg-blue-light' : 'border-line bg-white hover:border-blue'}`}>
                <FileText className="mb-3 h-5 w-5 text-blue" />
                <b className="block text-ink">{item.label}</b>
                <span className="mt-1 block text-small text-muted">{item.desc}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-small font-bold text-ink">生成要求</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} className="rounded-[14px] border border-line bg-[#f9fafb] p-4 text-small leading-6 outline-none focus:border-blue" />
            </label>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-small font-bold text-ink">选择已整理资料</span>
                <ProtoButton href="/knowledge" variant="ghost">去资料库</ProtoButton>
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
                {!knowledge.length && <SoftCard className="text-small text-muted">暂无已整理资料，可先到资料库上传并整理。</SoftCard>}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3">
            {['分析学习画像', '读取路径节点', '加载知识库资料', '多智能体生成内容', '安全检查', '保存资源索引'].map((row, idx) => (
              <SoftCard key={row} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-small font-bold text-ink">
                  {generating && idx < 4 ? <Loader2 className="h-4 w-4 animate-spin text-blue" /> : <CheckCircle2 className="h-4 w-4 text-green" />}
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
                  <p className="mt-2 whitespace-pre-line text-small leading-6 text-muted">{resource.content?.slice(0, 700) || '资源已生成，可进入资源库查看完整预览。'}</p>
                </SoftCard>
                <div className="flex gap-2">
                  <ProtoButton href="/resources">进入资源库</ProtoButton>
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
            <ProtoButton href="/resources"><Sparkles className="h-4 w-4" />查看资源</ProtoButton>
          </SoftCard>
        )}
      </ProtoCard>
    </div>
  )
}

function typeLabel(type: string) {
  return TYPES.find(t => t.type === type)?.label || type
}
