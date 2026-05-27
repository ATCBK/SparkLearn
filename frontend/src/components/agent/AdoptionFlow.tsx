'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { ProtoButton, ProtoCard } from '@/components/proto'
import { Check, Target, Clock, Sparkles, Search, FileText, GitCompare, BookOpen, TrendingUp, Star } from 'lucide-react'
import { PetAvatar, PetType } from './PetAvatar'

const AVATARS: Array<{ id: PetType; name: string; desc: string; trait: string; category: string }> = [
  { id: 'fox', name: '灵狐', desc: '机灵好奇，擅长快速搜索和发现优质学习资源', trait: '搜索发现', category: '探索系' },
  { id: 'owl', name: '智枭', desc: '博学沉稳，擅长深度分析和知识点总结归纳', trait: '分析总结', category: '学术系' },
  { id: 'robot', name: '芯助', desc: '高效精准，擅长整理笔记和制定学习计划', trait: '规划整理', category: '效率系' },
  { id: 'cat', name: '星猫', desc: '灵动优雅，擅长陪伴式学习和情绪调节', trait: '陪伴激励', category: '陪伴系' },
  { id: 'dragon', name: '焰龙', desc: '热情勇敢，擅长攻克难题和挑战高难度内容', trait: '攻坚克难', category: '挑战系' },
  { id: 'penguin', name: '冰企', desc: '踏实可靠，擅长每日打卡和习惯养成督促', trait: '习惯养成', category: '坚持系' },
  { id: 'bunny', name: '棉兔', desc: '温柔耐心，擅长错题分析和薄弱点针对训练', trait: '查漏补缺', category: '补强系' },
  { id: 'panda', name: '竹圆', desc: '从容淡定，擅长知识梳理和构建知识体系图谱', trait: '体系构建', category: '体系系' },
]

const COMPANION_STYLES = [
  {
    id: 'strict',
    name: '严格导师',
    desc: '直接指出问题，督促你完成目标',
    emoji: '📐',
    personality: 'concise' as const,
  },
  {
    id: 'friend',
    name: '温柔朋友',
    desc: '多鼓励少批评，降低学习压力',
    emoji: '🌸',
    personality: 'encouraging' as const,
  },
  {
    id: 'assistant',
    name: '高效助教',
    desc: '少废话直接给方案，效率优先',
    emoji: '⚡',
    personality: 'concise' as const,
  },
  {
    id: 'partner',
    name: '陪练伙伴',
    desc: '陪你一步步做题，详细解释过程',
    emoji: '🤝',
    personality: 'verbose' as const,
  },
]

const STUDY_TIMES = [
  { id: 'morning', label: '早上 6-9 点', emoji: '🌅' },
  { id: 'afternoon', label: '下午 14-17 点', emoji: '☀️' },
  { id: 'evening', label: '晚上 19-22 点', emoji: '🌙' },
  { id: 'flexible', label: '不固定', emoji: '🔄' },
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

  const steps = ['选择学伴', '学习目标', '陪伴风格', '起名确认']

  const selectedStyle = COMPANION_STYLES.find(s => s.id === companionStyle)

  async function handleAdopt() {
    if (!name.trim()) {
      setError('请给你的学习伙伴起个名字')
      return
    }
    setError('')
    setLoading(true)
    try {
      const personality = selectedStyle?.personality || 'encouraging'
      await api.adoptAgentPet({ name: name.trim(), avatar, personality })
      onAdopted()
    } catch (e: any) {
      setError(e.message || '认养失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtoCard className="max-w-[680px] mx-auto">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center gap-1 mb-8">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < step ? 'bg-[#16a34a] text-white' : i === step ? 'bg-[#2563eb] text-white scale-110' : 'bg-[#f1f5f9] text-[#94a3b8]'
            }`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${i <= step ? 'text-[#111827] font-medium' : 'text-[#94a3b8]'}`}>{label}</span>
            {i < steps.length - 1 && <div className={`w-6 h-[2px] mx-1 ${i < step ? 'bg-[#16a34a]' : 'bg-[#e2e8f0]'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: 选择学伴形象 */}
      {step === 0 && (
        <div>
          <h2 className="text-lg font-bold text-center mb-2">选择你的学习伙伴</h2>
          <p className="text-sm text-[#6b7280] text-center mb-2">每只学伴都有独特的性格和擅长领域，它将陪伴你的整个学习旅程。</p>
          <div className="bg-[#eff6ff] rounded-lg px-3 py-2 text-xs text-[#2563eb] text-center mb-5">
            💡 学伴的特长会影响它帮你学习的方式——比如「灵狐」更擅长帮你找资料，「棉兔」更擅长帮你分析错题。
          </div>
          <div className="grid grid-cols-4 gap-3 max-[640px]:grid-cols-2">
            {AVATARS.map(a => (
              <button
                key={a.id}
                onClick={() => setAvatar(a.id)}
                className={`relative p-4 rounded-2xl border-2 transition-all text-center ${
                  avatar === a.id
                    ? 'border-[#2563eb] bg-[#f8fbff] shadow-lg shadow-blue-100'
                    : 'border-[#e2e8f0] hover:border-[#93c5fd] hover:bg-[#fafbfc]'
                }`}
              >
                {avatar === a.id && (
                  <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[#2563eb] flex items-center justify-center shadow-sm">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div className="flex justify-center mb-2">
                  <PetAvatar type={a.id} state={avatar === a.id ? 'waiting' : 'idle'} size="sm" />
                </div>
                <div className="font-bold text-sm text-[#111827]">{a.name}</div>
                <div className="text-[10px] text-[#6b7280] mt-0.5 line-clamp-2 leading-tight">{a.desc}</div>
                <div className="mt-1.5 inline-block px-1.5 py-0.5 rounded-full bg-[#eff6ff] text-[10px] font-medium text-[#2563eb]">
                  {a.category}
                </div>
              </button>
            ))}
          </div>

          {/* 选中学伴的详细介绍 */}
          {avatar && (
            <div className="mt-4 p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <div className="flex items-center gap-3">
                <PetAvatar type={avatar} state="idle" size="md" />
                <div>
                  <div className="font-bold text-[#111827]">{AVATARS.find(a => a.id === avatar)?.name}</div>
                  <div className="text-xs text-[#6b7280] mt-0.5">{AVATARS.find(a => a.id === avatar)?.desc}</div>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#eff6ff] text-[10px] font-bold text-[#2563eb]">
                      擅长：{AVATARS.find(a => a.id === avatar)?.trait}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[10px] font-bold text-[#059669]">
                      {AVATARS.find(a => a.id === avatar)?.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <ProtoButton onClick={() => setStep(1)}>下一步 →</ProtoButton>
          </div>
        </div>
      )}

      {/* Step 1: 学习目标设定 */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-bold text-center mb-2">
            <Target className="inline h-5 w-5 text-[#2563eb] mr-1" />
            设定学习目标
          </h2>
          <p className="text-sm text-[#6b7280] text-center mb-3">让学伴了解你的学习情况，才能更好地帮助你</p>
          <div className="bg-[#fff7ed] rounded-lg px-3 py-2 text-xs text-[#9a3412] mb-5">
            🎯 学伴会根据你的目标和薄弱点，主动推荐资料、提醒复习、调整辅导策略。填写越具体，它帮你越精准。
          </div>

          {/* 学习目标 */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-[#374151] mb-2">你当前在学什么？</label>
            <input
              value={studyGoal}
              onChange={e => setStudyGoal(e.target.value)}
              placeholder="例如：高中数学函数、Python 编程入门、考研英语..."
              className="w-full h-11 rounded-xl border border-[#e2e8f0] px-4 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
              maxLength={50}
            />
          </div>

          {/* 薄弱点 */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-[#374151] mb-2">你觉得哪里比较薄弱？（选填）</label>
            <input
              value={weakPoints}
              onChange={e => setWeakPoints(e.target.value)}
              placeholder="例如：递归理解困难、阅读理解丢分多..."
              className="w-full h-11 rounded-xl border border-[#e2e8f0] px-4 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
              maxLength={100}
            />
          </div>

          {/* 学习时间 */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-[#374151] mb-2">
              <Clock className="inline h-4 w-4 mr-1" />
              你通常什么时候学习？
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STUDY_TIMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setStudyTime(t.id)}
                  className={`p-3 rounded-lg border text-left text-sm transition-all ${
                    studyTime === t.id
                      ? 'border-[#2563eb] bg-[#eff6ff] font-medium'
                      : 'border-[#e2e8f0] hover:border-[#93c5fd]'
                  }`}
                >
                  <span className="mr-2">{t.emoji}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <ProtoButton variant="secondary" onClick={() => setStep(0)}>上一步</ProtoButton>
            <ProtoButton onClick={() => setStep(2)}>下一步</ProtoButton>
          </div>
        </div>
      )}

      {/* Step 2: 陪伴风格 */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-bold text-center mb-2">
            <Sparkles className="inline h-5 w-5 text-[#2563eb] mr-1" />
            选择陪伴风格
          </h2>
          <p className="text-sm text-[#6b7280] text-center mb-3">你希望学伴用什么方式和你互动？</p>
          <div className="bg-[#f0fdf4] rounded-lg px-3 py-2 text-xs text-[#166534] mb-5">
            🧠 陪伴风格决定了学伴的说话方式和辅导策略。比如「严格导师」会直接指出错误并要求订正，「温柔朋友」会先肯定你的进步再给建议。你随时可以在设置中修改。
          </div>

          <div className="space-y-3">
            {COMPANION_STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => setCompanionStyle(s.id)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  companionStyle === s.id
                    ? 'border-[#2563eb] bg-[#eff6ff] shadow-sm'
                    : 'border-[#e2e8f0] hover:border-[#93c5fd] hover:bg-[#f8fafc]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.emoji}</span>
                  <div>
                    <div className="font-bold text-[#111827]">{s.name}</div>
                    <div className="text-xs text-[#6b7280] mt-0.5">{s.desc}</div>
                  </div>
                  {companionStyle === s.id && (
                    <div className="ml-auto w-6 h-6 rounded-full bg-[#2563eb] flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between mt-6">
            <ProtoButton variant="secondary" onClick={() => setStep(1)}>上一步</ProtoButton>
            <ProtoButton onClick={() => setStep(3)}>下一步</ProtoButton>
          </div>
        </div>
      )}

      {/* Step 3: 起名 + 确认 */}
      {step === 3 && (
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2 flex items-center justify-center gap-2">
            给你的学伴起个名字
            <Sparkles className="h-4 w-4 text-[#2563eb]" />
          </h2>
          <p className="text-sm text-[#6b7280] mb-4">一个好名字会让你和学伴的关系更亲近</p>

          <div className="flex flex-col items-center mb-4">
            <PetAvatar type={avatar} state="waiting" size="lg" />
            <div className="mt-2 px-3 py-1 rounded-full bg-[#eff6ff] text-sm font-bold text-[#2563eb]">
              {AVATARS.find(a => a.id === avatar)?.name}
            </div>
          </div>

          <div className="relative max-w-[400px] mx-auto mb-2">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]">✏️</div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入名字（1-10个字符）"
              maxLength={10}
              className="w-full h-13 rounded-xl border border-[#e2e8f0] pl-10 pr-4 text-center text-lg font-medium outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] placeholder:text-[#9ca3af]"
            />
          </div>
          <p className="text-xs text-[#9ca3af] mb-6">支持中文、英文、数字</p>

          {/* 两列布局：左档案 右功能 */}
          <div className="grid grid-cols-2 gap-4 text-left max-[600px]:grid-cols-1">
            {/* 左：学伴档案预览 */}
            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded bg-[#f1f5f9] flex items-center justify-center">
                  <FileText className="h-3 w-3 text-[#6b7280]" />
                </div>
                <span className="text-sm font-bold text-[#111827]">学伴档案预览</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#6b7280]">
                    <div className="w-5 h-5 rounded bg-[#eff6ff] flex items-center justify-center">
                      <Star className="h-3 w-3 text-[#2563eb]" />
                    </div>
                    形象
                  </div>
                  <span className="text-xs font-medium text-[#111827]">{AVATARS.find(a => a.id === avatar)?.name}（{AVATARS.find(a => a.id === avatar)?.category}）</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#6b7280]">
                    <div className="w-5 h-5 rounded bg-[#ecfdf5] flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-[#059669]" />
                    </div>
                    擅长领域
                  </div>
                  <span className="text-xs font-medium text-[#111827]">{AVATARS.find(a => a.id === avatar)?.trait}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#6b7280]">
                    <div className="w-5 h-5 rounded bg-[#fdf2f8] flex items-center justify-center">
                      <Target className="h-3 w-3 text-[#db2777]" />
                    </div>
                    陪伴风格
                  </div>
                  <span className="text-xs font-medium text-[#111827]">{selectedStyle?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#6b7280]">
                    <div className="w-5 h-5 rounded bg-[#fff7ed] flex items-center justify-center">
                      <Clock className="h-3 w-3 text-[#d97706]" />
                    </div>
                    学习时间
                  </div>
                  <span className="text-xs font-medium text-[#111827]">{STUDY_TIMES.find(t => t.id === studyTime)?.label}</span>
                </div>
              </div>
            </div>

            {/* 右：功能预告 */}
            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded bg-[#eff6ff] flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-[#2563eb]" />
                </div>
                <span className="text-sm font-bold text-[#111827]">认养后，你的学伴将能够：</span>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-2.5">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eff6ff] text-[#2563eb]">
                    <Search className="h-3 w-3" />
                  </div>
                  <span className="text-xs text-[#374151]">帮你搜索和筛选高质量学习资料</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f3efff] text-[#7c3aed]">
                    <FileText className="h-3 w-3" />
                  </div>
                  <span className="text-xs text-[#374151]">自动总结文章要点，生成结构化笔记</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#fff7ed] text-[#d97706]">
                    <GitCompare className="h-3 w-3" />
                  </div>
                  <span className="text-xs text-[#374151]">对比不同来源的解释，帮你全面理解</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ecfdf5] text-[#059669]">
                    <BookOpen className="h-3 w-3" />
                  </div>
                  <span className="text-xs text-[#374151]">每天根据你的进度推荐学习内容</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ecfeff] text-[#0891b2]">
                    <TrendingUp className="h-3 w-3" />
                  </div>
                  <span className="text-xs text-[#374151]">随着使用不断成长，解锁更强的辅导能力</span>
                </li>
              </ul>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

          <div className="flex justify-between mt-8">
            <ProtoButton variant="secondary" onClick={() => setStep(2)}>上一步</ProtoButton>
            <ProtoButton onClick={handleAdopt} disabled={loading}>
              {loading ? '认养中...' : '🐾 确认认养'}
            </ProtoButton>
          </div>
        </div>
      )}
    </ProtoCard>
  )
}
