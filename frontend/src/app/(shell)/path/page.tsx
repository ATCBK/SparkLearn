'use client'

import { useState } from 'react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

type Branch = 'weak' | 'standard' | 'goal'

export default function PathPage() {
  const [branch, setBranch] = useState<Branch>('weak')
  const copy = {
    weak: ['补弱路径建议', '先补返回值，再补作用域', '资源 10 分钟 + 练习 5 题', '卡住就换一种讲法'],
    standard: ['达标路径建议', '按标准路线推进', '保持当前节奏', '达标再解锁后续'],
    goal: ['目标路径建议', '先补阻塞点，再朝目标走', '目标会重排后续路线', '优先靠近结果'],
  }[branch]

  return (
    <div>
      <PageHead
        eyebrow="学习路径 / 你现在要走的下一步"
        title="个性化学习路径"
        description="这一页只保留当前阶段、完成标准和下一步入口，不再堆系统解释。"
        actions={<div className="w-[360px] max-w-full"><span className="text-micro text-muted">输入你的目标，AI 会重排右侧目标路径</span><div className="mt-2 flex gap-2"><input className="h-10 min-w-0 flex-1 rounded-[10px] border border-line px-3 outline-none" placeholder="例如：我想自己写一个成绩统计程序" /><ProtoButton>生成路径</ProtoButton></div></div>}
      />

      <ProtoCard>
        <div className="grid grid-cols-[repeat(4,1fr)_160px] gap-4 max-[960px]:grid-cols-1">
          <Overview label="当前目标" value="Python 函数与模块" />
          <Overview label="路径进度" value="62%" />
          <Overview label="当前阶段" value="薄弱点补强" meta="第 2 / 7 步" />
          <Overview label="当前重点" value="先补返回值" meta="通过后再进模块导入" />
          <div className="grid gap-2"><ProtoButton href="/resources">开始今日路径</ProtoButton><ProtoButton href="/profile" variant="secondary">调整目标</ProtoButton></div>
        </div>
      </ProtoCard>

      <div className="mt-4 grid grid-cols-[1fr_360px] gap-4 max-[1080px]:grid-cols-1">
        <ProtoCard>
          <div className="flex items-center justify-between gap-3"><h2 className="text-h2 font-bold text-ink">当前导航图</h2><span className="text-micro text-muted">从你现在的状态出发，选择下一条学习路径</span></div>
          <div className="relative mt-5 min-h-[520px] rounded-[16px] border border-[#e8eff8] bg-[#fbfdff] p-5">
            <div className="absolute left-1/2 top-8 w-[210px] -translate-x-1/2 rounded-[16px] border border-line bg-white p-4 text-center shadow-md">
              <b className="text-small text-ink">当前学习状态</b>
              <p className="mt-2 text-micro leading-5 text-muted">从当前状态分出补弱、达标、目标三条路径。</p>
            </div>
            <div className="grid h-full grid-cols-3 items-end gap-4 pt-40">
              <BranchCard active={branch === 'weak'} tone="orange" title="补弱路径" nodes={['回看返回值短讲义', '补清作用域混淆', '做 5 题补弱短练']} onClick={() => setBranch('weak')} />
              <BranchCard active={branch === 'standard'} tone="blue" title="达标路径" nodes={['回顾函数定义', '完成返回值理解', '完成 8 题达标练习', '进入模块导入']} onClick={() => setBranch('standard')} />
              <BranchCard active={branch === 'goal'} tone="purple" title="目标路径" nodes={['进入模块导入', '学习文件读写', '完成成绩统计项目']} onClick={() => setBranch('goal')} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill>绿色：已完成</Pill><Pill tone="blue">蓝色：当前推荐</Pill><Pill>灰色：未开始</Pill>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5"><ProtoButton href="/resources">学习当前节点资源</ProtoButton><ProtoButton href="/practice" variant="secondary">进入当前节点练习</ProtoButton><ProtoButton href="/generate" variant="tertiary">生成补弱资源</ProtoButton></div>
        </ProtoCard>

        <div>
          <ProtoCard>
            <h2 className="text-h2 font-bold text-ink">{copy[0]}</h2>
            <div className="mt-4 space-y-3">
              {copy.slice(1).map((item) => <SoftCard key={item} className="bg-white"><b className="text-small text-ink">{item}</b><p className="mt-1 text-micro leading-5 text-muted">根据当前画像、错题和路径状态自动推荐。</p></SoftCard>)}
            </div>
            <h2 className="mt-5 text-h2 font-bold text-ink">对应资源</h2>
            <div className="mt-4 space-y-3">
              <Resource title="函数返回值项目讲义" tag="优先学习" />
              <Resource title="函数作用域错题讲义" tag="待复习" />
              <Resource title="返回值补弱短练" tag="5 题" />
            </div>
          </ProtoCard>
          <div className="mt-4 flex flex-wrap gap-2.5"><ProtoButton href="/resources" variant="secondary">查看全部资源</ProtoButton><ProtoButton variant="ghost">让 AI 推荐先走哪条</ProtoButton></div>
        </div>
      </div>
    </div>
  )
}

function Overview({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return <div><span className="text-micro text-muted">{label}</span><b className="mt-1 block text-small text-ink">{value}</b>{meta && <p className="mt-1 text-micro text-muted">{meta}</p>}</div>
}

function BranchCard({ title, nodes, tone, active, onClick }: { title: string; nodes: string[]; tone: 'orange' | 'blue' | 'purple'; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-[16px] border p-4 text-left shadow-sm ${active ? 'border-blue bg-blue-light' : 'border-line bg-white'}`}>
      <Pill tone={tone}>{title}</Pill>
      <div className="mt-4 space-y-3">
        {nodes.map((node, idx) => <div key={node} className="rounded-[12px] border border-line bg-white p-3"><b className="block text-small text-ink">{node}</b><span className="mt-1 block text-micro text-muted">{idx === 0 ? '当前推荐' : idx === nodes.length - 1 ? '后续解锁' : '下一步'}</span></div>)}
      </div>
    </button>
  )
}

function Resource({ title, tag }: { title: string; tag: string }) {
  return <SoftCard className="bg-white"><b className="text-small text-ink">{title}</b><p className="mt-1 text-micro text-muted">围绕当前节点推荐的资源。</p><Pill tone="blue" className="mt-2">{tag}</Pill></SoftCard>
}
