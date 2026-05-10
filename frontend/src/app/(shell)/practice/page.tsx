'use client'

import { useState } from 'react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

export default function PracticePage() {
  const [submitted, setSubmitted] = useState(false)
  const [count, setCount] = useState(8)

  return (
    <div>
      <PageHead
        eyebrow="练习评测 / 判题、解析、错题"
        title="练习评测"
        description="完成针对练习后，系统会回写画像、错题本和学习路径。"
        actions={<div className="flex gap-2"><ProtoButton href="/practice/mistakes" variant="secondary">错题本</ProtoButton><ProtoButton href="/practice/favorites" variant="secondary">收藏题目</ProtoButton></div>}
        chips={[
          { value: '8 题', label: '今日练习' },
          { value: '80%', label: '达标线' },
          { value: '48%', label: '当前掌握' },
        ]}
      />

      <div className="grid grid-cols-[1fr_300px] gap-4 max-[980px]:grid-cols-1">
        <ProtoCard>
          <div className="flex items-start justify-between gap-3">
            <div><Pill tone="blue">个性化练习 · 函数返回值</Pill><h2 className="mt-3 text-h2 font-bold text-ink">第 3 题：函数默认返回值</h2></div>
            <span className="text-micro text-muted">当前题组：8 题 · 预计 12 分钟</span>
          </div>
          <div className="mt-5 rounded-[12px] border border-line bg-[#f9fafb] p-4">
            <b className="text-small text-ink">运行下面代码后，print(result) 输出什么？</b>
            <pre className="mt-3 overflow-auto rounded-[10px] bg-[#0f172a] p-4 text-small leading-6 text-white">{`def add(a, b):
    total = a + b

result = add(2, 3)
print(result)`}</pre>
          </div>
          <div className="mt-4 grid gap-2">
            <Answer text="A. 5" wrong={submitted} />
            <Answer text="B. None" correct={submitted} />
            <Answer text="C. total" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <ProtoButton onClick={() => setSubmitted(true)}>提交判题</ProtoButton>
            <ProtoButton variant="secondary">收藏题目</ProtoButton>
          </div>
          {!submitted ? (
            <SoftCard className="mt-5 bg-white"><b className="text-small text-ink">等待作答</b><p className="mt-2 text-small leading-6 text-muted">提交后会显示判题结果、答案解析、错因分析，并自动判断是否加入错题本。</p></SoftCard>
          ) : (
            <SoftCard className="mt-5 bg-white">
              <Pill tone="red">判题结果：错误</Pill>
              <h2 className="mt-3 text-h2 font-bold text-ink">正确答案是 None</h2>
              <p className="mt-3 text-small leading-6 text-muted">函数 add 内部计算了 total，但没有 return total。没有 return 的函数默认返回 None，所以 result 是 None。</p>
              <div className="mt-4 grid gap-3">
                <Step title="已加入错题本" text="分类：函数返回值 / 默认返回 None。" />
                <Step title="掌握度回写" text="返回值掌握度从 52% 调整为 48%。" />
                <Step title="补弱推荐" text="推荐 1 个短视频、1 份错题讲义、5 道同类题。" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5"><ProtoButton href="/generate">一键生成补弱资源</ProtoButton><ProtoButton href="/resources" variant="secondary">查看推荐资源</ProtoButton></div>
            </SoftCard>
          )}
        </ProtoCard>

        <aside className="grid gap-3">
          <ProtoCard>
            <div className="flex items-center justify-between"><h2 className="text-h2 font-bold text-ink">生成练习</h2><Pill tone="blue">个性化</Pill></div>
            <label className="mt-4 block text-micro text-muted">题目数量</label>
            <div className="mt-2 grid grid-cols-[40px_1fr_40px] overflow-hidden rounded-[10px] border border-line">
              <button className="h-10 bg-white" onClick={() => setCount(Math.max(1, count - 1))}>-</button>
              <input className="h-10 border-x border-line text-center outline-none" value={count} readOnly />
              <button className="h-10 bg-white" onClick={() => setCount(count + 1)}>+</button>
            </div>
            <select className="mt-3 h-10 w-full rounded-[10px] border border-line bg-white px-3 text-small outline-none"><option>针对薄弱点</option><option>混合复习</option><option>项目应用</option></select>
            <ProtoButton className="mt-3 w-full">生成练习题</ProtoButton>
          </ProtoCard>
          <ProtoCard>
            <div className="flex items-center justify-between"><h2 className="text-h2 font-bold text-ink">答题进度</h2><Pill tone="blue">3 / 8</Pill></div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <button key={n} className={`h-10 rounded-[10px] border text-small font-bold ${n < 3 ? 'border-green bg-green-light text-green' : n === 3 ? 'border-blue bg-blue-light text-blue' : 'border-line bg-white text-muted'}`}>{n}</button>)}
            </div>
            <div className="mt-4 space-y-2">
              <SoftCard className="flex items-center justify-between bg-white"><span><b className="text-small text-ink">完成</b><span className="block text-micro text-muted">2 题</span></span><Pill tone="green">2 对</Pill></SoftCard>
              <SoftCard className="flex items-center justify-between bg-white"><span><b className="text-small text-ink">正确率</b><span className="block text-micro text-muted">达标线 80%</span></span><Pill tone="blue">100%</Pill></SoftCard>
            </div>
            <div className="mt-3 flex flex-wrap gap-2"><ProtoButton href="/practice/mistakes" variant="secondary">错题本</ProtoButton><ProtoButton href="/practice/favorites" variant="tertiary">收藏题目</ProtoButton></div>
          </ProtoCard>
        </aside>
      </div>
    </div>
  )
}

function Answer({ text, correct, wrong }: { text: string; correct?: boolean; wrong?: boolean }) {
  return <button className={`rounded-[12px] border p-4 text-left text-small font-bold ${correct ? 'border-green bg-green-light text-green' : wrong ? 'border-red bg-red-light text-red' : 'border-line bg-white text-ink hover:border-blue'}`}>{text}</button>
}

function Step({ title, text }: { title: string; text: string }) {
  return <div><b className="text-small text-ink">{title}</b><span className="mt-1 block text-micro text-muted">{text}</span></div>
}
