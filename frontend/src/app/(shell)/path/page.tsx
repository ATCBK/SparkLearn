'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bot, GitBranch, Target } from 'lucide-react'
import { api, KnowledgeGraphNode, LearningPath, PathNodeAdvice, Recommendation } from '@/lib/api'
import { Bar, PageHead, Pill, ProgressRing, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

export default function PathPage() {
  const [path, setPath] = useState<LearningPath | null>(null)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [selected, setSelected] = useState<KnowledgeGraphNode | null>(null)
  const [advice, setAdvice] = useState<PathNodeAdvice | null>(null)
  const [goal, setGoal] = useState('完成 Python 函数与模块专项提升')

  useEffect(() => {
    let mounted = true
    Promise.allSettled([api.getLearningPath(), api.getRecommendations()]).then(([p, r]) => {
      if (!mounted) return
      if (p.status === 'fulfilled') {
        setPath(p.value)
        setSelected(p.value.knowledgeGraph?.nodes.find(n => n.status === 'current') || p.value.knowledgeGraph?.nodes[0] || null)
      }
      if (r.status === 'fulfilled') setRecs(r.value)
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    api.getLearningPathNodeAdvice(selected.id).then(setAdvice).catch(() => setAdvice(null))
  }, [selected])

  const nodes = useMemo(() => path?.knowledgeGraph?.nodes || [], [path])
  const sorted = useMemo(() => [...nodes].sort((a, b) => a.mastery - b.mastery), [nodes])
  const branches = [
    { title: '补弱路径', tone: 'orange' as const, nodes: sorted.slice(0, 4) },
    { title: '达标路径', tone: 'blue' as const, nodes: nodes.filter(n => n.status !== 'pending').slice(0, 4) },
    { title: '目标路径', tone: 'purple' as const, nodes: nodes.filter(n => n.status !== 'completed').slice(-4) },
  ]
  const progress = nodes.length ? Math.round((nodes.filter(n => n.status === 'completed').length / nodes.length) * 100) : 42

  return (
    <div>
      <PageHead
        eyebrow="学习中心 / 个性化路径"
        title="学习路径"
        description="路径会根据画像、掌握度和练习结果动态调整。当前优先补弱，再推进目标节点。"
        chips={[
          { value: `${progress}%`, label: '整体进度' },
          { value: selected?.name || '函数返回值', label: '当前节点' },
          { value: `${nodes.length || 8}个`, label: '知识节点' },
        ]}
      />

      <ProtoCard className="mb-4">
        <div className="grid grid-cols-[1fr_auto] items-center gap-5 max-[760px]:grid-cols-1">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Pill tone="blue">路径目标</Pill>
              <span className="text-small text-muted">输入目标后，系统会重排建议顺序</span>
            </div>
            <input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="h-11 w-full rounded-[14px] border border-line bg-[#f9fafb] px-4 text-small font-bold outline-none focus:border-blue"
            />
          </div>
          <ProgressRing value={progress} label="路径进度" />
        </div>
      </ProtoCard>

      <div className="grid grid-cols-[1.38fr_.62fr] gap-4 max-[1050px]:grid-cols-1">
        <ProtoCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-h2 font-bold text-ink"><GitBranch className="h-5 w-5 text-blue" />三分支学习导航</h2>
            <Pill tone="green">练习结果会回流</Pill>
          </div>
          <div className="grid grid-cols-3 gap-3 max-[760px]:grid-cols-1">
            {branches.map((branch) => (
              <div key={branch.title} className="rounded-[12px] border border-[#e8eff8] bg-[#fbfdff] p-3">
                <Pill tone={branch.tone}>{branch.title}</Pill>
                <div className="mt-3 grid gap-2">
                  {(branch.nodes.length ? branch.nodes : nodes.slice(0, 3)).map((node) => (
                    <button
                      key={`${branch.title}-${node.id}`}
                      onClick={() => setSelected(node)}
                      className={`rounded-[12px] border p-3 text-left transition ${selected?.id === node.id ? 'border-blue bg-blue-light' : 'border-line bg-white hover:border-blue'}`}
                    >
                      <b className="block text-small text-ink">{node.name}</b>
                      <span className="mt-1 block text-micro text-muted">{node.stage} · {Math.round(node.mastery * 100)}%</span>
                      <div className="mt-2"><Bar value={Math.round(node.mastery * 100)} tone={branch.tone === 'purple' ? 'purple' : branch.tone === 'orange' ? 'orange' : 'blue'} /></div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ProtoCard>

        <ProtoCard>
          <Pill tone="blue">当前建议</Pill>
          <h2 className="mt-3 text-h2 font-bold text-ink">{selected?.name || '函数返回值与作用域'}</h2>
          <p className="mt-2 text-small leading-6 text-muted">{advice?.suggestion || '建议先学习短讲义，再通过达标题验证掌握情况。'}</p>
          <div className="my-4">
            <div className="mb-1 flex justify-between text-micro text-muted"><span>掌握度</span><span>{Math.round((selected?.mastery ?? advice?.mastery ?? 0.48) * 100)}%</span></div>
            <Bar value={Math.round((selected?.mastery ?? advice?.mastery ?? 0.48) * 100)} tone="blue" />
          </div>
          <div className="grid gap-2">
            {(advice?.nextActions?.length ? advice.nextActions : ['回顾概念讲义', '完成达标练习', '生成代码案例']).map((item) => (
              <SoftCard key={item} className="flex items-center justify-between gap-3">
                <span className="text-small font-bold text-ink">{item}</span>
                <ArrowRight className="h-4 w-4 text-muted" />
              </SoftCard>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ProtoButton href="/resources" variant="secondary">看资源</ProtoButton>
            <ProtoButton href="/generate">生成资源</ProtoButton>
            <ProtoButton href="/practice" variant="tertiary">做练习</ProtoButton>
            <ProtoButton variant="tertiary"><Bot className="h-4 w-4" />问 AI</ProtoButton>
          </div>
        </ProtoCard>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 max-[960px]:grid-cols-1">
        {recs.slice(0, 3).map((rec) => (
          <SoftCard key={rec.id}>
            <div className="mb-2 flex items-center gap-2"><Target className="h-4 w-4 text-blue" /><b className="text-small text-ink">{rec.resource.title}</b></div>
            <p className="text-micro leading-5 text-muted">{rec.reason}</p>
          </SoftCard>
        ))}
      </div>
    </div>
  )
}
