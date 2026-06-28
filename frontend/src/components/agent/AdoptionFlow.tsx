'use client'

import { useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { ProtoButton } from '@/components/proto'
import {
  BookOpen,
  Check,
  Clock,
  FileText,
  GitCompare,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react'
import { PetAvatar, PetState, PetType } from './PetAvatar'

type CompanionOption = {
  id: PetType
  name: string
  desc: string
  trait: string
  category: string
  state: PetState
  accent: string
}

const AVATARS: CompanionOption[] = [
  {
    id: 'fox',
    name: '灵狐',
    desc: '反应敏捷，擅长快速搜索、筛选资料和发现高质量学习线索。',
    trait: '搜索发现',
    category: '探索系',
    state: 'searching',
    accent: '#f97316',
  },
  {
    id: 'owl',
    name: '智枭',
    desc: '沉稳博学，适合帮你拆解概念、总结知识点和整理脉络。',
    trait: '分析总结',
    category: '学术系',
    state: 'reading',
    accent: '#78716c',
  },
  {
    id: 'robot',
    name: '芯助',
    desc: '高效精准，适合规划学习步骤、整理笔记和追踪任务进度。',
    trait: '规划整理',
    category: '效率系',
    state: 'thinking',
    accent: '#2563eb',
  },
  {
    id: 'cat',
    name: '星猫',
    desc: '灵动温柔，适合陪伴式学习、缓解压力和保持学习节奏。',
    trait: '陪伴激励',
    category: '陪伴系',
    state: 'waiting',
    accent: '#6366f1',
  },
  {
    id: 'dragon',
    name: '焰龙',
    desc: '热情勇敢，适合攻克难题、挑战高难度内容和冲刺目标。',
    trait: '攻坚克难',
    category: '挑战系',
    state: 'thinking',
    accent: '#10b981',
  },
  {
    id: 'penguin',
    name: '冰企鹅',
    desc: '踏实可靠，适合每日打卡、习惯养成和稳定复盘。',
    trait: '习惯养成',
    category: '坚持系',
    state: 'idle',
    accent: '#0f172a',
  },
  {
    id: 'bunny',
    name: '棉兔',
    desc: '耐心细致，适合错题分析、薄弱点训练和温和提醒。',
    trait: '查漏补缺',
    category: '补强系',
    state: 'success',
    accent: '#f472b6',
  },
  {
    id: 'panda',
    name: '竹圆',
    desc: '从容稳定，适合构建知识体系、梳理结构和长期学习。',
    trait: '体系构建',
    category: '体系系',
    state: 'reading',
    accent: '#16a34a',
  },
]

const COMPANION_STYLES = [
  {
    id: 'strict',
    name: '严格导师',
    desc: '直接指出问题，帮你守住目标和完成度。',
    personality: 'concise' as const,
  },
  {
    id: 'friend',
    name: '温柔朋友',
    desc: '多鼓励、少压迫，适合保持长期学习动力。',
    personality: 'encouraging' as const,
  },
  {
    id: 'assistant',
    name: '高效助教',
    desc: '少废话、给方案，优先帮你节省时间。',
    personality: 'concise' as const,
  },
  {
    id: 'partner',
    name: '陪练伙伴',
    desc: '一步步陪你推理，解释过程更完整。',
    personality: 'verbose' as const,
  },
]

const STUDY_TIMES = [
  { id: 'morning', label: '早上 6-9 点' },
  { id: 'afternoon', label: '下午 14-17 点' },
  { id: 'evening', label: '晚上 19-22 点' },
  { id: 'flexible', label: '不固定，按任务安排' },
]

const STEP_LABELS = ['选择伙伴', '学习目标', '陪伴风格', '起名确认']

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

  const selectedAvatar = useMemo(() => AVATARS.find(item => item.id === avatar) || AVATARS[0], [avatar])
  const selectedStyle = useMemo(
    () => COMPANION_STYLES.find(item => item.id === companionStyle) || COMPANION_STYLES[1],
    [companionStyle],
  )

  async function handleAdopt() {
    if (!name.trim()) {
      setError('请给你的学习伙伴起一个名字')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.adoptAgentPet({
        name: name.trim(),
        avatar,
        personality: selectedStyle.personality,
      })
      onAdopted()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setError(message || '认养失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-[18px] border border-[#dbe7f3] bg-white shadow-lg">
      <div className="grid min-h-[660px] grid-cols-[minmax(0,1fr)_360px] max-[1080px]:grid-cols-1">
        <div className="p-5 min-[760px]:p-7">
          <StepHeader step={step} />

          {step === 0 && (
            <div>
              <SectionTitle
                icon={<Sparkles className="h-5 w-5" />}
                title="选择最适合你的学习伙伴"
                desc="每个伙伴都有统一的动态展示和不同的学习擅长点。先选一个你想长期一起学习的角色。"
              />

              <div className="grid grid-cols-2 gap-3 min-[760px]:grid-cols-4">
                {AVATARS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAvatar(item.id)}
                    aria-pressed={avatar === item.id}
                    className={`group relative min-h-[172px] overflow-hidden rounded-[16px] border p-3 text-left transition-all duration-200 ${
                      avatar === item.id
                        ? 'border-[#2563eb] bg-[#f8fbff] shadow-[0_16px_36px_rgba(37,99,235,0.14)]'
                        : 'border-[#e2e8f0] bg-white hover:-translate-y-0.5 hover:border-[#93c5fd] hover:shadow-md'
                    }`}
                    style={{ ['--pet-accent' as string]: item.accent }}
                  >
                    <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[var(--pet-accent)] opacity-10 transition-transform group-hover:scale-125" />
                    {avatar === item.id && (
                      <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-[#2563eb] text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div className="flex justify-center py-2">
                      <PetAvatar type={item.id} state={avatar === item.id ? item.state : 'idle'} size="md" />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <b className="text-[15px] text-[#111827]">{item.name}</b>
                      <span className="rounded-md bg-[#f1f6fc] px-2 py-1 text-[11px] font-bold text-[#52627b]">{item.category}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[#64748b]">{item.desc}</p>
                    <div className="mt-3 inline-flex rounded-md bg-[#eff6ff] px-2 py-1 text-[11px] font-bold text-[#2563eb]">
                      擅长：{item.trait}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <ProtoButton onClick={() => setStep(1)}>下一步</ProtoButton>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <SectionTitle
                icon={<Target className="h-5 w-5" />}
                title="告诉伙伴你的学习目标"
                desc="这些信息只用于初始化伙伴档案，让它后续的建议更贴近你的学习状态。"
              />

              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[#334155]">你当前在学什么？</span>
                  <input
                    value={studyGoal}
                    onChange={e => setStudyGoal(e.target.value)}
                    placeholder="例如：高中数学函数、Python 入门、考研英语阅读"
                    maxLength={50}
                    className="h-12 w-full rounded-[12px] border border-[#dbe7f3] bg-white px-4 text-sm outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#dbeafe]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[#334155]">你觉得哪里比较薄弱？</span>
                  <input
                    value={weakPoints}
                    onChange={e => setWeakPoints(e.target.value)}
                    placeholder="例如：递归理解困难、阅读理解失分多、概念容易混淆"
                    maxLength={100}
                    className="h-12 w-full rounded-[12px] border border-[#dbe7f3] bg-white px-4 text-sm outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#dbeafe]"
                  />
                </label>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#334155]">
                    <Clock className="h-4 w-4" />
                    你通常什么时候学习？
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                    {STUDY_TIMES.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setStudyTime(item.id)}
                        className={`rounded-[12px] border px-4 py-3 text-left text-sm font-bold transition ${
                          studyTime === item.id
                            ? 'border-[#2563eb] bg-[#eff6ff] text-[#2563eb]'
                            : 'border-[#dbe7f3] bg-white text-[#475569] hover:border-[#93c5fd]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <StepActions onBack={() => setStep(0)} onNext={() => setStep(2)} />
            </div>
          )}

          {step === 2 && (
            <div>
              <SectionTitle
                icon={<Star className="h-5 w-5" />}
                title="选择陪伴风格"
                desc="这会影响伙伴说话方式和辅导节奏，认养后仍可以调整。"
              />

              <div className="grid grid-cols-2 gap-3 max-[720px]:grid-cols-1">
                {COMPANION_STYLES.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCompanionStyle(item.id)}
                    className={`rounded-[16px] border p-4 text-left transition ${
                      companionStyle === item.id
                        ? 'border-[#2563eb] bg-[#f8fbff] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                        : 'border-[#dbe7f3] bg-white hover:border-[#93c5fd] hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <b className="text-base text-[#111827]">{item.name}</b>
                        <p className="mt-2 text-sm leading-6 text-[#64748b]">{item.desc}</p>
                      </div>
                      {companionStyle === item.id && (
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#2563eb] text-white">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <StepActions onBack={() => setStep(1)} onNext={() => setStep(3)} />
            </div>
          )}

          {step === 3 && (
            <div>
              <SectionTitle
                icon={<Sparkles className="h-5 w-5" />}
                title="给你的学习伙伴起个名字"
                desc="名字会出现在后续学习工作台里，建议简短、好记、有一点陪伴感。"
              />

              <div className="rounded-[18px] border border-[#dbe7f3] bg-[#f8fbff] p-5 text-center">
                <PetAvatar type={avatar} state="waiting" size="lg" />
                <div className="mx-auto mt-4 max-w-[420px]">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="输入名字，最多 10 个字符"
                    maxLength={10}
                    className="h-13 w-full rounded-[14px] border border-[#bfdbfe] bg-white px-4 text-center text-lg font-bold text-[#111827] outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#dbeafe]"
                  />
                  <p className="mt-2 text-xs text-[#64748b]">支持中文、英文和数字</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
                <SummaryPanel
                  title="伙伴档案预览"
                  items={[
                    ['形象', `${selectedAvatar.name}（${selectedAvatar.category}）`],
                    ['擅长', selectedAvatar.trait],
                    ['风格', selectedStyle.name],
                    ['学习时间', STUDY_TIMES.find(item => item.id === studyTime)?.label || '未设置'],
                  ]}
                />
                <div className="rounded-[16px] border border-[#dbe7f3] bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#111827]">
                    <Sparkles className="h-4 w-4 text-[#2563eb]" />
                    认养后可以帮你
                  </div>
                  <ul className="space-y-3 text-sm text-[#475569]">
                    <AbilityItem icon={<Search className="h-3.5 w-3.5" />} text="搜索并筛选学习资料" />
                    <AbilityItem icon={<FileText className="h-3.5 w-3.5" />} text="总结文章要点和笔记" />
                    <AbilityItem icon={<GitCompare className="h-3.5 w-3.5" />} text="对比不同来源的解释" />
                    <AbilityItem icon={<BookOpen className="h-3.5 w-3.5" />} text="根据进度推荐学习内容" />
                    <AbilityItem icon={<TrendingUp className="h-3.5 w-3.5" />} text="随着使用成长并解锁能力" />
                  </ul>
                </div>
              </div>

              {error && <p className="mt-4 text-sm font-bold text-[#dc2626]">{error}</p>}

              <div className="mt-6 flex justify-between">
                <ProtoButton variant="secondary" onClick={() => setStep(2)}>上一步</ProtoButton>
                <ProtoButton onClick={handleAdopt} disabled={loading}>
                  {loading ? '认养中...' : '确认认养'}
                </ProtoButton>
              </div>
            </div>
          )}
        </div>

        <LivePreview
          avatar={selectedAvatar}
          styleName={selectedStyle.name}
          step={step}
          name={name}
          studyGoal={studyGoal}
          weakPoints={weakPoints}
          studyTime={STUDY_TIMES.find(item => item.id === studyTime)?.label || '未设置'}
        />
      </div>
    </section>
  )
}

function StepHeader({ step }: { step: number }) {
  return (
    <div className="mb-7 flex flex-wrap items-center gap-2">
      {STEP_LABELS.map((label, index) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold transition ${
              index < step
                ? 'bg-[#16a34a] text-white'
                : index === step
                  ? 'bg-[#2563eb] text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)]'
                  : 'bg-[#eef4fb] text-[#94a3b8]'
            }`}
          >
            {index < step ? <Check className="h-4 w-4" /> : index + 1}
          </div>
          <span className={`text-xs font-bold ${index <= step ? 'text-[#111827]' : 'text-[#94a3b8]'}`}>{label}</span>
          {index < STEP_LABELS.length - 1 && (
            <span className={`h-[2px] w-7 rounded-full ${index < step ? 'bg-[#16a34a]' : 'bg-[#dbe7f3]'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2 text-[#2563eb]">
        {icon}
        <h2 className="text-xl font-extrabold leading-tight text-[#111827]">{title}</h2>
      </div>
      <p className="max-w-[760px] text-sm leading-7 text-[#64748b]">{desc}</p>
    </div>
  )
}

function StepActions({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="mt-7 flex justify-between">
      <ProtoButton variant="secondary" onClick={onBack}>上一步</ProtoButton>
      <ProtoButton onClick={onNext}>下一步</ProtoButton>
    </div>
  )
}

function LivePreview({
  avatar,
  styleName,
  step,
  name,
  studyGoal,
  weakPoints,
  studyTime,
}: {
  avatar: CompanionOption
  styleName: string
  step: number
  name: string
  studyGoal: string
  weakPoints: string
  studyTime: string
}) {
  const displayName = name.trim() || avatar.name

  return (
    <aside className="border-l border-[#dbe7f3] bg-[#f7fbff] p-6 pr-24 max-[1080px]:border-l-0 max-[1080px]:border-t max-[1080px]:pr-6">
      <div className="sticky top-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-extrabold text-[#2563eb]">
          <Sparkles className="h-4 w-4" />
          实时伙伴预览
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#dbe7f3] bg-white shadow-md">
          <div className="relative grid place-items-center overflow-hidden bg-[#edf6ff] px-6 py-8">
            <div className="absolute -left-10 top-8 h-28 w-28 rounded-full bg-[#bfdbfe] opacity-45" />
            <div className="absolute -right-12 bottom-4 h-32 w-32 rounded-full bg-[#bbf7d0] opacity-45" />
            <PetAvatar type={avatar.id} state={avatar.state} size="lg" />
            <div className="relative mt-4 text-center">
              <h3 className="text-2xl font-extrabold text-[#111827]">{displayName}</h3>
              <p className="mt-1 text-sm font-bold text-[#2563eb]">{avatar.name} · {avatar.category}</p>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <PreviewRow label="伙伴特长" value={`擅长：${avatar.trait}`} />
            <PreviewRow label="陪伴风格" value={styleName} />
            <PreviewRow label="学习目标" value={studyGoal.trim() || '等待你填写'} />
            <PreviewRow label="薄弱点" value={weakPoints.trim() || '可选补充'} />
            <PreviewRow label="学习时间" value={studyTime} />
          </div>
        </div>

        <div className="mt-4 rounded-[16px] border border-[#dbe7f3] bg-white p-4">
          <div className="mb-3 flex items-center justify-between text-xs font-bold text-[#64748b]">
            <span>认养进度</span>
            <span>{step + 1} / {STEP_LABELS.length}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#e8eff8]">
            <div className="h-full rounded-full bg-[#2563eb] transition-all" style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }} />
          </div>
          <p className="mt-3 text-xs leading-5 text-[#64748b]">这只是认养展示增强；认养完成后的学习工作台交互保持原样。</p>
        </div>
      </div>
    </aside>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-[#f8fafc] px-3 py-2">
      <div className="text-[11px] font-bold text-[#94a3b8]">{label}</div>
      <div className="mt-0.5 line-clamp-2 text-sm font-bold text-[#334155]">{value}</div>
    </div>
  )
}

function SummaryPanel({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div className="rounded-[16px] border border-[#dbe7f3] bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#111827]">
        <FileText className="h-4 w-4 text-[#2563eb]" />
        {title}
      </div>
      <div className="space-y-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-[10px] bg-[#f8fafc] px-3 py-2 text-sm">
            <span className="text-[#64748b]">{label}</span>
            <b className="text-right text-[#111827]">{value}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function AbilityItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-[#eff6ff] text-[#2563eb]">{icon}</span>
      <span>{text}</span>
    </li>
  )
}
