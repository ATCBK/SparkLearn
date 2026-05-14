'use client'
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import { Bar, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'
import { Target, Lightbulb, Clock } from 'lucide-react'

export default function ProfilePage() {
  const [chatOpen, setChatOpen] = useState(false)
  const [gender, setGender] = useState<'male' | 'female'>('male')

  const avatarSrc = gender === 'male' ? '/ui-images/profile-male.png' : '/ui-images/profile-female.png'

  return (
    <div>
      <PageHead
        eyebrow="学习画像 / 你现在更适合怎么学"
        title="学习画像"
        description="这一页只保留会直接影响你学习体验的内容：当前卡点、适合的学法和本阶段目标。"
        chips={[
          { value: '48%', label: '返回值掌握', icon: <Target className="h-4 w-4" />, tone: 'purple' as const },
          { value: '案例驱动', label: '学习偏好', icon: <Lightbulb className="h-4 w-4" />, tone: 'blue' as const },
          { value: '08:12', label: '最近更新', icon: <Clock className="h-4 w-4" />, tone: 'green' as const },
        ]}
      />

      <div className="grid grid-cols-[360px_1fr] gap-4 max-[1100px]:grid-cols-1">
        <ProtoCard className="relative min-h-[580px] overflow-hidden p-0">
          <img src={avatarSrc} alt="学生人物画像" className="absolute inset-0 h-full w-full object-cover" />
          {/* 性别切换按钮 */}
          <div className="absolute top-4 right-4 z-10 flex gap-1 rounded-full bg-white/80 p-1 shadow-md backdrop-blur">
            <button
              onClick={() => setGender('male')}
              className={`rounded-full px-3 py-1.5 text-micro font-bold transition-colors ${gender === 'male' ? 'bg-[#2563eb] text-white' : 'text-[#6b7280] hover:bg-[#f3f4f6]'}`}
            >
              男生
            </button>
            <button
              onClick={() => setGender('female')}
              className={`rounded-full px-3 py-1.5 text-micro font-bold transition-colors ${gender === 'female' ? 'bg-[#ec4899] text-white' : 'text-[#6b7280] hover:bg-[#f3f4f6]'}`}
            >
              女生
            </button>
          </div>
          <div className="absolute bottom-6 left-6 right-6 rounded-[14px] border border-line bg-white/92 p-4 shadow-md backdrop-blur">
            <Pill tone="blue">人物画像</Pill>
            <h2 className="mt-2 text-h2 font-bold text-ink">李明 · 项目实践准备期</h2>
            <p className="mt-2 text-small leading-6 text-muted">基础语法已经够用，当前重点是把函数和模块这块学顺，尽快回到小项目实践。</p>
          </div>
        </ProtoCard>

        <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
          <ProtoCard>
            <Pill tone="orange">需要关注</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">函数返回值</h2>
            <p className="mt-2 text-small leading-6 text-muted">这块不是完全不会，而是关键概念容易串线，导致一做题就乱。</p>
            <div className="mt-4 flex items-center gap-5">
              <div className="grid h-[100px] w-[100px] shrink-0 place-items-center rounded-full border border-[#eef3f9]" style={{ background: 'radial-gradient(circle at center, #fff 0 34px, transparent 35px), conic-gradient(#2563eb 0 48%, #e8eff8 48% 100%)' }}>
                <div className="text-center"><b className="block text-[24px] leading-none">48%</b><span className="text-[10px] text-muted">当前稳定度</span></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill>return 和 print 容易混</Pill>
                <Pill>局部变量作用范围不够稳</Pill>
              </div>
            </div>
          </ProtoCard>

          <ProtoCard>
            <Pill tone="purple">更适合的学法</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">先看例子，再做短练</h2>
            <p className="mt-3 text-small leading-6 text-muted">和纯文字解释相比，你更吃“短讲解 + 可运行代码 + 立刻验证”这一套。</p>
            <div className="mt-4 grid grid-cols-[1.2fr_.8fr] gap-3">
              <SoftCard className="bg-blue-light"><b className="text-small text-ink">代码案例最容易进入状态</b><div className="mt-4 space-y-2"><i className="block h-2 w-4/5 rounded-full bg-blue" /><i className="block h-2 w-3/5 rounded-full bg-blue/60" /><i className="block h-2 w-2/3 rounded-full bg-blue/40" /></div></SoftCard>
              <div className="grid gap-3"><SoftCard><b>短讲解</b></SoftCard><SoftCard><b>即时反馈</b></SoftCard></div>
            </div>
          </ProtoCard>

          <ProtoCard>
            <Pill tone="green">阶段目标</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">完成 Python 小项目</h2>
            <p className="mt-3 text-small leading-6 text-muted">当前不是重学整章，而是把进入项目实践前的最后一段补顺。</p>
            <div className="mt-4 space-y-3">
              <Goal title="基础语法" text="变量、分支和循环已经够用。" done />
              <Goal title="函数补强" text="先把返回值和作用域彻底理顺。" current />
              <Goal title="模块导入" text="通过后回到小项目拆分与调用。" />
            </div>
          </ProtoCard>

          <ProtoCard>
            <Pill tone="blue">今天先做</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">补弱后再确认路径</h2>
            <div className="mt-4 space-y-3">
              <Plan idx="01" title="看 12 分钟案例讲义" text="把结果怎么传出来这件事先看顺。" time="12 分钟" />
              <Plan idx="02" title="做 8 道返回值短练" text="只测这一类题，不再分散到其他知识点。" time="8 题" />
            </div>
            <ProtoButton href="/path" variant="secondary" className="mt-4">查看路径</ProtoButton>
          </ProtoCard>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[1.1fr_.9fr] gap-4 max-[960px]:grid-cols-1">
        <ProtoCard>
          <div className="flex items-center justify-between gap-3"><h2 className="text-h2 font-bold text-ink">能力雷达</h2><ProtoButton variant="secondary" onClick={() => setChatOpen(!chatOpen)}>告诉 AI 你想怎么学</ProtoButton></div>
          <div className="mt-5 grid grid-cols-[260px_1fr] gap-5 max-[760px]:grid-cols-1">
            <RadarChart data={[
              { name: '语法基础', value: 84 },
              { name: '案例理解', value: 68 },
              { name: '练习稳定', value: 57 },
              { name: '项目迁移', value: 42 },
              { name: '结果传递', value: 53 },
            ]} />
            <div className="space-y-3">
              {[
                ['语法基础', 84], ['案例理解', 68], ['练习稳定', 57], ['项目迁移', 42], ['结果传递', 53],
              ].map(([name, value]) => <Radar key={name as string} name={name as string} value={value as number} />)}
            </div>
          </div>
        </ProtoCard>

        <ProtoCard>
          <div className="flex items-center justify-between gap-3"><h2 className="text-h2 font-bold text-ink">最近学习过的资源</h2><ProtoButton href="/resources" variant="ghost">查看全部 →</ProtoButton></div>
          <p className="mt-5 text-small leading-6 text-muted">从这里继续上次没学完的内容，不用重新找入口。</p>
          <div className="mt-4 space-y-3">
            <Resource title="return 到底返回给谁" meta="视频 · 已学习 70% · 来源：错题补弱" tag="继续学习" />
            <Resource title="函数作用域错题讲义" meta="文档 · 已打开 2 次 · 来源：练习错题" tag="已纳入画像" />
            <Resource title="成绩统计小项目代码案例" meta="代码案例 · 已学习 35% · 来源：画像偏好" tag="待完成" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5"><ProtoButton href="/resources" variant="secondary">继续最近资源</ProtoButton><ProtoButton href="/generate" variant="tertiary">生成补弱资源</ProtoButton></div>
        </ProtoCard>
      </div>

      {chatOpen && (
        <div className="mt-5 grid grid-cols-[1fr_320px] gap-4 max-[960px]:grid-cols-1">
          <ProtoCard><h2 className="text-h2 font-bold text-ink">告诉 AI 你想怎么学</h2><SoftCard className="mt-4 bg-white">AI：我看到你最近在返回值上连续出错。你更想先看动画讲解，还是直接做代码案例？</SoftCard><div className="mt-4 flex gap-2"><input className="h-10 min-w-0 flex-1 rounded-[10px] border border-line px-3 outline-none" placeholder="例如：我想先看代码案例，再做短练习" /><ProtoButton>发送</ProtoButton></div></ProtoCard>
          <ProtoCard><h2 className="text-h2 font-bold text-ink">立即开始</h2><p className="mt-4 text-small text-muted">选定你更想要的学法后，直接去生成对应资源或开始当前练习。</p><div className="mt-4 grid gap-2"><ProtoButton href="/generate">按我的学法生成资源</ProtoButton><ProtoButton href="/practice" variant="secondary">直接开始短练习</ProtoButton></div></ProtoCard>
        </div>
      )}
    </div>
  )
}

function Goal({ title, text, done, current }: { title: string; text: string; done?: boolean; current?: boolean }) {
  return <SoftCard className={done ? 'bg-green-light' : current ? 'bg-blue-light' : 'bg-white'}><b className="text-small text-ink">{title}</b><span className="mt-1 block text-micro text-muted">{text}</span></SoftCard>
}
function Plan({ idx, title, text, time }: { idx: string; title: string; text: string; time: string }) {
  return <SoftCard className="grid grid-cols-[42px_1fr_auto] items-center gap-3 bg-white"><b className="text-blue">{idx}</b><span><b className="block text-small text-ink">{title}</b><span className="text-micro text-muted">{text}</span></span><Pill>{time}</Pill></SoftCard>
}
function Radar({ name, value }: { name: string; value: number }) {
  return <div><div className="mb-1 flex justify-between text-micro"><b>{name}</b><span className="text-muted">{value}</span></div><Bar value={value} /></div>
}

function RadarChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const size = 260
  const center = size / 2
  const radius = 80
  const levels = 5
  const maxValue = 100

  // 计算五边形的顶点坐标
  const points = data.map((item, index) => {
    const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2
    const x = center + radius * Math.cos(angle)
    const y = center + radius * Math.sin(angle)
    return { x, y, ...item }
  })

  // 生成网格线
  const gridLines = Array.from({ length: levels }, (_, i) => {
    const r = (radius / levels) * (i + 1)
    const gridPoints = data.map((_, index) => {
      const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2
      const x = center + r * Math.cos(angle)
      const y = center + r * Math.sin(angle)
      return `${x},${y}`
    })
    return gridPoints.join(' ')
  })

  // 计算数据点坐标
  const dataPoints = data.map((item, index) => {
    const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2
    const r = (radius / maxValue) * item.value
    const x = center + r * Math.cos(angle)
    const y = center + r * Math.sin(angle)
    return `${x},${y}`
  })

  // 计算标签位置
  const labelPoints = data.map((item, index) => {
    const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2
    const labelRadius = radius + 35
    const x = center + labelRadius * Math.cos(angle)
    const y = center + labelRadius * Math.sin(angle)
    return { x, y, name: item.name }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="w-full">
      {/* 网格线 */}
      {gridLines.map((points, i) => (
        <polygon
          key={`grid-${i}`}
          points={points}
          fill="none"
          stroke="#e0e7ff"
          strokeWidth="1"
        />
      ))}

      {/* 坐标轴 */}
      {points.map((point, i) => (
        <line
          key={`axis-${i}`}
          x1={center}
          y1={center}
          x2={point.x}
          y2={point.y}
          stroke="#e0e7ff"
          strokeWidth="1"
        />
      ))}

      {/* 数据区域 */}
      <polygon
        points={dataPoints.join(' ')}
        fill="#3b82f6"
        fillOpacity="0.2"
        stroke="#2563eb"
        strokeWidth="2"
      />

      {/* 数据点 */}
      {points.map((point, i) => (
        <circle
          key={`point-${i}`}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#2563eb"
          stroke="white"
          strokeWidth="2"
        />
      ))}

      {/* 标签 */}
      {labelPoints.map((point, i) => (
        <text
          key={`label-${i}`}
          x={point.x}
          y={point.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[11px] font-bold fill-[#374151]"
        >
          {point.name}
        </text>
      ))}
    </svg>
  )
}
function Resource({ title, meta, tag }: { title: string; meta: string; tag: string }) {
  return <SoftCard className="flex items-center justify-between gap-3 bg-white"><span><b className="block text-small text-ink">{title}</b><span className="text-micro text-muted">{meta}</span></span><Pill tone="blue">{tag}</Pill></SoftCard>
}
