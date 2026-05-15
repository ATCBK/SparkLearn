'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { ProtoButton, ProtoCard } from '@/components/proto'
import { Check, Target, Clock, Sparkles } from 'lucide-react'
import { PetAvatar, PetType } from './PetAvatar'

const AVATARS: Array<{ id: PetType; name: string; desc: string; trait: string }> = [
  { id: 'fox', name: '小狐狸', desc: '机灵好奇，善于发现新资源', trait: '搜索能力强' },
  { id: 'owl', name: '猫头鹰', desc: '博学沉稳，善于分析和总结', trait: '分析能力强' },
  { id: 'robot', name: '小机器人', desc: '高效精准，善于整理和规划', trait: '整理能力强' },
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
          <p className="text-sm text-[#6b7280] text-center mb-6">它将陪伴你的整个学习旅程</p>
          <div className="grid grid-cols-3 gap-4">
            {AVATARS.map(a => (
              <button
                key={a.id}
                onClick={() => setAvatar(a.id)}
                className={`p-5 rounded-xl border-2 transition-all text-center ${
                  avatar === a.id
                    ? 'border-[#2563eb] bg-[#eff6ff] shadow-md scale-[1.02]'
                    : 'border-[#e2e8f0] hover:border-[#93c5fd] hover:bg-[#f8fafc]'
                }`}
              >
                <div className="flex justify-center mb-3">
                  <PetAvatar type={a.id} state={avatar === a.id ? 'waiting' : 'idle'} size="md" />
                </div>
                <div className="font-bold text-[#111827]">{a.name}</div>
                <div className="text-xs text-[#6b7280] mt-1">{a.desc}</div>
                <div className="mt-2 inline-block px-2 py-0.5 rounded-full bg-[#eff6ff] text-[10px] font-medium text-[#2563eb]">
                  {a.trait}
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-6">
            <ProtoButton onClick={() => setStep(1)}>下一步</ProtoButton>
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
          <p className="text-sm text-[#6b7280] text-center mb-6">让学伴了解你的学习情况，才能更好地帮助你</p>

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
          <p className="text-sm text-[#6b7280] text-center mb-6">你希望学伴用什么方式和你互动？</p>

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
          <h2 className="text-lg font-bold mb-4">给你的学伴起个名字</h2>

          <div className="flex justify-center mb-4">
            <PetAvatar type={avatar} state="waiting" size="lg" />
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="输入名字（1-10个字符）"
            maxLength={10}
            className="w-full max-w-[300px] mx-auto h-12 rounded-xl border border-[#e2e8f0] px-4 text-center text-lg font-medium outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <p className="text-xs text-[#6b7280] mt-2 mb-6">支持中文、英文、数字</p>

          {/* 认养预览 */}
          <div className="bg-[#f8fafc] rounded-xl p-4 text-left max-w-[400px] mx-auto mb-6">
            <div className="text-xs font-bold text-[#6b7280] uppercase tracking-wide mb-3">学伴档案预览</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6b7280]">形象</span>
                <span className="font-medium">{AVATARS.find(a => a.id === avatar)?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7280]">陪伴风格</span>
                <span className="font-medium">{selectedStyle?.name}</span>
              </div>
              {studyGoal && (
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">学习目标</span>
                  <span className="font-medium truncate max-w-[180px]">{studyGoal}</span>
                </div>
              )}
              {weakPoints && (
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">薄弱点</span>
                  <span className="font-medium truncate max-w-[180px]">{weakPoints}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#6b7280]">学习时间</span>
                <span className="font-medium">{STUDY_TIMES.find(t => t.id === studyTime)?.label}</span>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          <div className="flex justify-between max-w-[400px] mx-auto">
            <ProtoButton variant="secondary" onClick={() => setStep(2)}>上一步</ProtoButton>
            <ProtoButton onClick={handleAdopt} disabled={loading}>
              {loading ? '认养中...' : '🎊 确认认养'}
            </ProtoButton>
          </div>
        </div>
      )}
    </ProtoCard>
  )
}
