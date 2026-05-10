'use client'

import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

export default function ReportPage() {
  return (
    <div>
      <PageHead
        eyebrow="学习结果 / 学完之后你现在到哪了"
        title="学习结果"
        description="这一页只看结果、卡点和下一步，不再展示系统内部回流说明。"
        chips={[
          { value: '81%', label: '任务完成' },
          { value: '74%', label: '练习正确率' },
          { value: '3 个', label: '薄弱点' },
        ]}
      />

      <div className="grid grid-cols-4 overflow-hidden rounded-[12px] border border-line bg-white shadow-md max-[760px]:grid-cols-2">
        <Metric value="6.5h" label="本周学习" />
        <Metric value="81%" label="任务完成" />
        <Metric value="74%" label="练习正确率" />
        <Metric value="3 个" label="高频薄弱点" last />
      </div>

      <div className="mt-5 grid grid-cols-[1fr_.6fr] gap-4 max-[960px]:grid-cols-1">
        <ProtoCard>
          <h2 className="text-h2 font-bold text-ink">这轮你完成了什么</h2>
          <div className="mt-8 flex h-[210px] items-end gap-5 px-5">
            {[60, 88, 42, 74, 96, 51, 68].map((h, idx) => (
              <div key={idx} className="flex-1 rounded-t-[8px] bg-gradient-to-b from-[#62c8f7] to-[#0b76df]" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 max-[760px]:grid-cols-1">
            <SoftCard><b className="text-small text-ink">资源学习</b><p className="mt-1 text-micro leading-5 text-muted">完成 3 个资源，核心讲义已经过完一遍。</p></SoftCard>
            <SoftCard><b className="text-small text-ink">练习完成</b><p className="mt-1 text-micro leading-5 text-muted">做了 22 题，已经知道主要卡在哪几类题。</p></SoftCard>
            <SoftCard><b className="text-small text-ink">当前进度</b><p className="mt-1 text-micro leading-5 text-muted">这一阶段已经推进到模块前的最后补强。</p></SoftCard>
          </div>
        </ProtoCard>

        <ProtoCard>
          <Pill tone="purple">下一步</Pill>
          <h2 className="mt-3 text-h2 font-bold text-ink">先把返回值这块补过去</h2>
          <p className="mt-4 text-small leading-6 text-muted">
            你已经把大部分基础内容走完了。现在只要把 return 和作用域这块补顺，就可以继续进入模块导入。
          </p>
          <div className="mt-5 space-y-3">
            <Step title="先看一个更短的例子" text="把结果传递的过程看懂，再做题会更稳。" />
            <Step title="补 8 道同类短练习" text="只针对返回值和作用域，不要再分散注意力。" />
            <Step title="做完就确认下一步" text="达标后直接进入模块导入，不需要再重复这一轮。" />
          </div>
          <div className="mt-5 grid gap-2.5">
            <ProtoButton href="/resources">先去补当前卡点</ProtoButton>
            <ProtoButton href="/practice" variant="secondary">直接开始短练习</ProtoButton>
            <ProtoButton href="/path" variant="secondary">回到当前路径</ProtoButton>
          </div>
        </ProtoCard>
      </div>
    </div>
  )
}

function Metric({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return <div className={`p-4 ${last ? '' : 'border-r border-[#eef2f7]'}`}><b className="block text-[20px] text-ink">{value}</b><span className="mt-1 block text-micro text-muted">{label}</span></div>
}

function Step({ title, text }: { title: string; text: string }) {
  return <SoftCard className="bg-white"><b className="text-small text-ink">{title}</b><span className="mt-1 block text-micro leading-5 text-muted">{text}</span></SoftCard>
}
