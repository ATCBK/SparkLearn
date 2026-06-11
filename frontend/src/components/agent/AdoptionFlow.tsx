'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { ProtoButton, ProtoCard } from '@/components/proto'
import { Check, Target, Clock, Sparkles, Search, FileText, GitCompare, BookOpen, TrendingUp, Star } from 'lucide-react'
import { PetAvatar, PetType } from './PetAvatar'

const AVATARS: Array<{ id: PetType; name: string; desc: string; trait: string; category: string }> = [
  { id: 'fox', name: '灵狐', desc: '机灵敏锐，擅长快速搜索与发现高质量学习资料。', trait: '搜索发现', category: '探索系' },
  { id: 'owl', name: '智枭', desc: '沉稳博学，擅长深度分析、总结和知识点归纳。', trait: '分析总结', category: '学术系' },
  { id: 'robot', name: '芯助', desc: '高效精准，擅长整理笔记、拆解任务与制定计划。', trait: '规划整理', category: '效率系' },
  { id: 'cat', name: '星猫', desc: '灵动温柔，适合陪伴式学习和情绪调节。', trait: '陪伴激励', category: '陪伴系' },
  { id: 'dragon', name: '燃龙', desc: '热情果断，擅长攻克难题和推动高强度挑战。', trait: '攻坚克难', category: '挑战系' },
  { id: 'penguin', name: '冰企', desc: '踏实可靠，适合每日打卡和习惯养成督促。', trait: '习惯养成', category: '坚持系' },
  { id: 'bunny', name: '棉兔', desc: '温柔耐心，擅长错题分析和薄弱点专项训练。', trait: '查漏补缺', category: '补强系' },
  { id: 'panda', name: '竹圆', desc: '从容稳定，擅长梳理知识体系与构建理解框架。', trait: '体系构建', category: '体系系' },
]

const COMPANION_STYLES = [
  {
    id: 'strict',
    name: '严格导师',
    desc: '直接指出问题，帮你把目标拆成明确执行项。',
    emoji: '🧭',
    personality: 'concise' as const,
    summary: '适合想提高执行力、需要清晰边界和节奏管理的学习者。',
  },
  {
    id: 'friend',
    name: '温柔朋友',
    desc: '鼓励优先，先肯定进步，再给你细致建议。',
    emoji: '🌷',
    personality: 'encouraging' as const,
    summary: '适合想降低压力、慢慢建立学习状态和长期陪伴感的人。',
  },
  {
    id: 'assistant',
    name: '高效助教',
    desc: '少废话，直接给方案、步骤和资料建议。',
    emoji: '⚙️',
    personality: 'concise' as const,
    summary: '适合偏结果导向，希望更快拿到可执行答案的学习者。',
  },
  {
    id: 'partner',
    name: '陪练伙伴',
    desc: '会陪你一步一步推进，并解释每个关键节点。',
    emoji: '🤝',
    personality: 'verbose' as const,
    summary: '适合需要边做边学、希望过程更细致更有互动感的人。',
  },
]

const STUDY_TIMES = [
  { id: 'morning', label: '早上 6-9 点', emoji: '🌤️' },
  { id: 'afternoon', label: '下午 14-17 点', emoji: '☀️' },
  { id: 'evening', label: '晚上 19-22 点', emoji: '🌙' },
  { id: 'flexible', label: '时间不固定', emoji: '🗓️' },
]

interface Props {
  onAdopted: () => void
}

export function AdoptionFlow({ onAdopted }: Props) {
  const [step, setStep] = useState(0)
  const [avatar, setAvatar] = useState<PetType>('fox')
  const [name, setName] = useState('')
  const [companionStyle, setCompanionStyle] = useState('friend')
  const [studyGoal, setStudyGoal] = useState('')
  const [studyTime, setStudyTime] = useState('evening')
  const [weakPoints, setWeakPoints] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const steps = ['选择学伴', '学习画像', '互动风格', '命名确认']
  const selectedStyle = COMPANION_STYLES.find((s) => s.id === companionStyle)
  const selectedAvatar = AVATARS.find((a) => a.id === avatar)
  const selectedTime = STUDY_TIMES.find((t) => t.id === studyTime)

  async function handleAdopt() {
    if (!name.trim()) {
      setError('请先给你的学习伙伴起个名字')
      return
    }

    setError('')
    setLoading(true)

    try {
      const personality = selectedStyle?.personality || 'encouraging'
      await api.adoptAgentPet({ name: name.trim(), avatar, personality })
      onAdopted()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '认养失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtoCard className="mx-auto max-w-[1120px] overflow-hidden rounded-[28px] border-[#dbe4f0] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-6 shadow-[0_28px_70px_rgba(15,23,42,0.08)] sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold transition-all ${
                i < step
                  ? 'bg-[#16a34a] text-white shadow-[0_10px_24px_rgba(22,163,74,0.24)]'
                  : i === step
                    ? 'scale-110 bg-[#2563eb] text-white shadow-[0_12px_28px_rgba(37,99,235,0.28)]'
                    : 'bg-[#eef2f7] text-[#94a3b8]'
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs sm:text-sm ${i <= step ? 'font-semibold text-[#111827]' : 'text-[#94a3b8]'}`}>{label}</span>
            {i < steps.length - 1 && (
              <div className={`mx-1 hidden h-[2px] w-10 rounded-full sm:block ${i < step ? 'bg-[#16a34a]' : 'bg-[#dbe4f0]'}`} />
            )}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div>
          <div className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_320px]">
            <div className="rounded-[26px] border border-[#d7e7fb] bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.22),transparent_38%),linear-gradient(135deg,#f8fbff_0%,#eef6ff_52%,#ffffff_100%)] p-6 sm:p-7">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#2563eb]">
                Companion Lab
              </div>
              <h2 className="text-2xl font-black tracking-tight text-[#0f172a] sm:text-[32px]">先挑一只适合你的学习伙伴</h2>
              <p className="mt-3 max-w-[640px] text-sm leading-7 text-[#52627b] sm:text-[15px]">
                这一步决定你的学伴擅长怎样帮助你。它不只是一个形象，而是后续互动气质、能力偏好和陪伴感的起点。
              </p>
              <div className="mt-5 rounded-2xl border border-[#cfe3fb] bg-white/80 px-4 py-3 text-xs leading-6 text-[#2563eb] shadow-[0_10px_30px_rgba(37,99,235,0.08)]">
                选得越贴合，你后面在搜索资料、分析错题、整理知识和保持节奏时，体验会越顺手。
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[26px] border border-[#e2e8f0] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#dbeafe] blur-2xl" />
              <div className="relative">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#94a3b8]">Current Pick</div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="grid h-24 w-24 place-items-center rounded-[24px] bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] ring-1 ring-[#dbeafe]">
                    <PetAvatar type={avatar} state="waiting" size="lg" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[22px] font-black tracking-tight text-[#0f172a]">{selectedAvatar?.name}</div>
                    <div className="mt-1 inline-flex rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-bold text-[#2563eb]">
                      {selectedAvatar?.category}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#52627b]">{selectedAvatar?.desc}</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-[#f8fafc] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#94a3b8]">Signature Trait</div>
                  <div className="mt-2 text-base font-bold text-[#111827]">{selectedAvatar?.trait}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {AVATARS.map((item) => {
              const active = avatar === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => setAvatar(item.id)}
                  className={`group relative overflow-hidden rounded-[24px] border-2 p-5 text-left transition-all duration-200 ${
                    active
                      ? 'border-[#2563eb] bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] shadow-[0_18px_40px_rgba(37,99,235,0.16)]'
                      : 'border-[#e2e8f0] bg-white hover:-translate-y-0.5 hover:border-[#93c5fd] hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]'
                  }`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${active ? 'bg-[#2563eb]' : 'bg-transparent group-hover:bg-[#bfdbfe]'}`} />
                  {active && (
                    <div className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-[#2563eb] shadow-sm">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[22px] bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_100%)] ring-1 ring-[#e5edf7]">
                      <PetAvatar type={item.id} state={active ? 'waiting' : 'idle'} size="md" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[11px] font-bold text-[#2563eb]">
                        {item.category}
                      </span>
                      <span className="rounded-full bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-[#52627b]">
                        {item.trait}
                      </span>
                    </div>
                  </div>

                  <div className="text-xl font-black tracking-tight text-[#0f172a]">{item.name}</div>
                  <p className="mt-2 min-h-[72px] text-sm leading-6 text-[#52627b]">{item.desc}</p>

                  <div className="mt-4 flex items-center justify-between border-t border-[#edf2f7] pt-4">
                    <span className="text-xs font-semibold text-[#94a3b8]">点击即可切换</span>
                    <span className={`text-sm font-bold ${active ? 'text-[#2563eb]' : 'text-[#64748b]'}`}>
                      {active ? '已选中' : '选择它'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-6 rounded-[24px] border border-[#dbe4f0] bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <PetAvatar type={avatar} state="idle" size="md" />
              <div>
                <div className="text-xl font-black tracking-tight text-[#0f172a]">{selectedAvatar?.name}</div>
                <div className="mt-1 text-sm leading-6 text-[#52627b]">{selectedAvatar?.desc}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-bold text-[#2563eb]">
                    擅长：{selectedAvatar?.trait}
                  </span>
                  <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-[11px] font-bold text-[#059669]">
                    {selectedAvatar?.category}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <ProtoButton className="h-11 rounded-xl px-5" onClick={() => setStep(1)}>下一步</ProtoButton>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 className="mb-2 text-center text-xl font-black tracking-tight text-[#0f172a]">
            <Target className="mr-1 inline h-5 w-5 text-[#2563eb]" />
            先让学伴认识你的学习状态
          </h2>
          <p className="mb-4 text-center text-sm text-[#6b7280]">目标、薄弱点和常用学习时段越清晰，学伴后面的建议就越贴合。</p>

          <div className="mb-6 rounded-2xl border border-[#fde7c7] bg-[#fff7ed] px-4 py-3 text-xs leading-6 text-[#9a3412]">
            学伴会根据你的目标和薄弱点，主动推荐资料、提醒复习、调整辅导策略。填写得越具体，后面体验越精准。
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-[#374151]">你当前主要在学什么？</label>
                <input
                  value={studyGoal}
                  onChange={(e) => setStudyGoal(e.target.value)}
                  placeholder="例如：高数函数、Python 入门、考研英语阅读"
                  className="h-12 w-full rounded-2xl border border-[#e2e8f0] px-4 text-sm outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#dbeafe]"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#374151]">你觉得自己最容易卡住在哪？</label>
                <input
                  value={weakPoints}
                  onChange={(e) => setWeakPoints(e.target.value)}
                  placeholder="例如：递归理解困难、阅读理解丢分多、做题容易粗心"
                  className="h-12 w-full rounded-2xl border border-[#e2e8f0] px-4 text-sm outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#dbeafe]"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-3 block text-sm font-bold text-[#374151]">
                  <Clock className="mr-1 inline h-4 w-4" />
                  你通常在什么时间学习？
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {STUDY_TIMES.map((time) => {
                    const active = studyTime === time.id
                    return (
                      <button
                        key={time.id}
                        onClick={() => setStudyTime(time.id)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          active
                            ? 'border-[#2563eb] bg-[#eff6ff] shadow-[0_12px_28px_rgba(37,99,235,0.1)]'
                            : 'border-[#e2e8f0] bg-white hover:border-[#93c5fd]'
                        }`}
                      >
                        <div className="text-lg">{time.emoji}</div>
                        <div className="mt-2 text-sm font-bold text-[#111827]">{time.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.04)]">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#94a3b8]">Preview</div>
              <div className="mt-4 flex items-center gap-3">
                <PetAvatar type={avatar} state="idle" size="md" />
                <div>
                  <div className="text-lg font-black text-[#0f172a]">{selectedAvatar?.name}</div>
                  <div className="text-xs text-[#64748b]">{selectedStyle?.name}</div>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-2xl bg-[#f8fafc] p-3">
                  <div className="text-xs font-bold text-[#94a3b8]">学习目标</div>
                  <div className="mt-1 text-[#111827]">{studyGoal || '还未填写'}</div>
                </div>
                <div className="rounded-2xl bg-[#f8fafc] p-3">
                  <div className="text-xs font-bold text-[#94a3b8]">薄弱点</div>
                  <div className="mt-1 text-[#111827]">{weakPoints || '还未填写'}</div>
                </div>
                <div className="rounded-2xl bg-[#f8fafc] p-3">
                  <div className="text-xs font-bold text-[#94a3b8]">常用时段</div>
                  <div className="mt-1 text-[#111827]">{selectedTime?.label}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <ProtoButton className="h-11 rounded-xl px-5" variant="secondary" onClick={() => setStep(0)}>上一步</ProtoButton>
            <ProtoButton className="h-11 rounded-xl px-5" onClick={() => setStep(2)}>下一步</ProtoButton>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="mb-2 text-center text-xl font-black tracking-tight text-[#0f172a]">
            <Sparkles className="mr-1 inline h-5 w-5 text-[#2563eb]" />
            选一个你更愿意长期相处的互动风格
          </h2>
          <p className="mb-4 text-center text-sm text-[#6b7280]">这决定学伴平时提醒你、纠正你、陪你推进任务时的语气和节奏。</p>

          <div className="mb-6 rounded-2xl border border-[#d8f5df] bg-[#f0fdf4] px-4 py-3 text-xs leading-6 text-[#166534]">
            这不是永久设定。你后面仍然可以根据学习阶段切换，让学伴从“温柔陪伴”变成“高效推进”。
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {COMPANION_STYLES.map((style) => {
              const active = companionStyle === style.id

              return (
                <button
                  key={style.id}
                  onClick={() => setCompanionStyle(style.id)}
                  className={`w-full rounded-[22px] border-2 p-5 text-left transition-all ${
                    active
                      ? 'border-[#2563eb] bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] shadow-[0_18px_40px_rgba(37,99,235,0.14)]'
                      : 'border-[#e2e8f0] bg-white hover:-translate-y-0.5 hover:border-[#93c5fd] hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-white/80 text-3xl shadow-sm ring-1 ring-[#e5edf7]">
                        <span>{style.emoji}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-black tracking-tight text-[#0f172a]">{style.name}</div>
                        <div className="mt-1 text-sm leading-6 text-[#52627b]">{style.desc}</div>
                      </div>
                      {active && (
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#2563eb] shadow-sm">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="mt-auto rounded-2xl bg-white/70 px-4 py-3 text-xs leading-6 text-[#64748b] ring-1 ring-[#e6eef8]">
                      {style.summary}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-8 flex justify-between">
            <ProtoButton className="h-11 rounded-xl px-5" variant="secondary" onClick={() => setStep(1)}>上一步</ProtoButton>
            <ProtoButton className="h-11 rounded-xl px-5" onClick={() => setStep(3)}>下一步</ProtoButton>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center">
          <h2 className="mb-2 flex items-center justify-center gap-2 text-2xl font-black tracking-tight text-[#0f172a]">
            给你的学习伙伴起个名字
            <Sparkles className="h-4 w-4 text-[#2563eb]" />
          </h2>
          <p className="mb-5 text-sm text-[#6b7280]">名字会成为你们后续每次互动时最直观的连接点。</p>

          <div className="mb-5 flex flex-col items-center">
            <div className="grid h-32 w-32 place-items-center rounded-[28px] bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] ring-1 ring-[#dbeafe]">
              <PetAvatar type={avatar} state="waiting" size="lg" />
            </div>
            <div className="mt-3 rounded-full bg-[#eff6ff] px-3 py-1 text-sm font-bold text-[#2563eb]">
              {selectedAvatar?.name}
            </div>
          </div>

          <div className="relative mx-auto mb-2 max-w-[440px]">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]">✦</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入名字（1-10 个字符）"
              maxLength={10}
              className="h-14 w-full rounded-2xl border border-[#e2e8f0] pl-10 pr-4 text-center text-lg font-medium outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#dbeafe] placeholder:text-[#9ca3af]"
            />
          </div>
          <p className="mb-8 text-xs text-[#9ca3af]">支持中文、英文和数字</p>

          <div className="grid gap-4 text-left md:grid-cols-2">
            <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.04)]">
              <div className="mb-4 flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#f1f5f9]">
                  <FileText className="h-3.5 w-3.5 text-[#6b7280]" />
                </div>
                <span className="text-sm font-bold text-[#111827]">学伴档案预览</span>
              </div>

              <div className="space-y-3">
                <SummaryRow icon={<Star className="h-3 w-3" />} label="形象" value={`${selectedAvatar?.name} · ${selectedAvatar?.category}`} tone="bg-[#eff6ff] text-[#2563eb]" />
                <SummaryRow icon={<Sparkles className="h-3 w-3" />} label="特长" value={selectedAvatar?.trait || ''} tone="bg-[#ecfdf5] text-[#059669]" />
                <SummaryRow icon={<Target className="h-3 w-3" />} label="风格" value={selectedStyle?.name || ''} tone="bg-[#fdf2f8] text-[#db2777]" />
                <SummaryRow icon={<Clock className="h-3 w-3" />} label="时段" value={selectedTime?.label || ''} tone="bg-[#fff7ed] text-[#d97706]" />
              </div>
            </div>

            <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.04)]">
              <div className="mb-4 flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#eff6ff]">
                  <Sparkles className="h-3.5 w-3.5 text-[#2563eb]" />
                </div>
                <span className="text-sm font-bold text-[#111827]">认养后，你的学伴将能帮你</span>
              </div>

              <ul className="space-y-3">
                <FeatureItem icon={<Search className="h-3 w-3" />} tone="bg-[#eff6ff] text-[#2563eb]" text="搜索、筛选并推荐更适合你的学习资料" />
                <FeatureItem icon={<FileText className="h-3 w-3" />} tone="bg-[#f3efff] text-[#7c3aed]" text="总结文章重点，帮你生成结构化笔记" />
                <FeatureItem icon={<GitCompare className="h-3 w-3" />} tone="bg-[#fff7ed] text-[#d97706]" text="对比不同解释和来源，帮助你更全面理解" />
                <FeatureItem icon={<BookOpen className="h-3 w-3" />} tone="bg-[#ecfdf5] text-[#059669]" text="根据你的进度推荐每天该学什么" />
                <FeatureItem icon={<TrendingUp className="h-3 w-3" />} tone="bg-[#ecfeff] text-[#0891b2]" text="随着使用持续成长，解锁更强的辅导能力" />
              </ul>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          <div className="mt-8 flex justify-between">
            <ProtoButton className="h-11 rounded-xl px-5" variant="secondary" onClick={() => setStep(2)}>上一步</ProtoButton>
            <ProtoButton className="h-11 rounded-xl px-5" onClick={handleAdopt} disabled={loading}>
              {loading ? '认养中...' : '确认认养'}
            </ProtoButton>
          </div>
        </div>
      )}
    </ProtoCard>
  )
}

function SummaryRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f8fafc] px-3 py-3">
      <div className="flex items-center gap-2 text-xs text-[#6b7280]">
        <div className={`grid h-6 w-6 place-items-center rounded-lg ${tone}`}>
          {icon}
        </div>
        {label}
      </div>
      <span className="text-right text-xs font-medium text-[#111827]">{value}</span>
    </div>
  )
}

function FeatureItem({
  icon,
  tone,
  text,
}: {
  icon: React.ReactNode
  tone: string
  text: string
}) {
  return (
    <li className="flex items-center gap-3">
      <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone}`}>
        {icon}
      </div>
      <span className="text-sm text-[#374151]">{text}</span>
    </li>
  )
}
