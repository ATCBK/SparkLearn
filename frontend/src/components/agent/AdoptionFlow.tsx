'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { ProtoButton, ProtoCard } from '@/components/proto'
import { Check } from 'lucide-react'

const AVATARS = [
  { id: 'fox', emoji: '🦊', name: '小狐狸', desc: '机灵好奇，善于发现' },
  { id: 'owl', emoji: '🦉', name: '猫头鹰', desc: '博学沉稳，善于分析' },
  { id: 'robot', emoji: '🤖', name: '小机器人', desc: '高效精准，善于整理' },
]

const PERSONALITIES = [
  { id: 'concise', name: '简洁型', desc: '回复精炼直接，不废话' },
  { id: 'verbose', name: '话多型', desc: '回复详细，包含解释和示例' },
  { id: 'encouraging', name: '鼓励型', desc: '温暖正向，每次都给你加油' },
]

interface Props {
  onAdopted: () => void
}

export function AdoptionFlow({ onAdopted }: Props) {
  const [step, setStep] = useState(0) // 0=选形象, 1=起名+性格, 2=确认
  const [avatar, setAvatar] = useState('fox')
  const [name, setName] = useState('')
  const [personality, setPersonality] = useState('encouraging')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAdopt() {
    if (!name.trim()) {
      setError('请给你的学习伙伴起个名字')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.adoptAgentPet({ name: name.trim(), avatar, personality })
      onAdopted()
    } catch (e: any) {
      setError(e.message || '认养失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtoCard className="max-w-[640px] mx-auto">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {['选择形象', '起名 & 性格', '确认认养'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              i <= step ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] text-[#94a3b8]'
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm ${i <= step ? 'text-[#111827] font-medium' : 'text-[#94a3b8]'}`}>{label}</span>
            {i < 2 && <div className="w-8 h-[2px] bg-[#e2e8f0]" />}
          </div>
        ))}
      </div>

      {/* Step 0: 选择形象 */}
      {step === 0 && (
        <div>
          <h2 className="text-lg font-bold text-center mb-6">选择你的学习伙伴</h2>
          <div className="grid grid-cols-3 gap-4">
            {AVATARS.map(a => (
              <button
                key={a.id}
                onClick={() => setAvatar(a.id)}
                className={`p-5 rounded-xl border-2 transition-all text-center ${
                  avatar === a.id
                    ? 'border-[#2563eb] bg-[#eff6ff] shadow-md scale-105'
                    : 'border-[#e2e8f0] hover:border-[#93c5fd] hover:bg-[#f8fafc]'
                }`}
              >
                <div className="text-5xl mb-3">{a.emoji}</div>
                <div className="font-bold text-[#111827]">{a.name}</div>
                <div className="text-xs text-[#6b7280] mt-1">{a.desc}</div>
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-6">
            <ProtoButton onClick={() => setStep(1)}>下一步</ProtoButton>
          </div>
        </div>
      )}

      {/* Step 1: 起名 + 性格 */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-bold text-center mb-6">给它起个名字</h2>
          <div className="flex justify-center mb-6">
            <div className="text-6xl">{AVATARS.find(a => a.id === avatar)?.emoji}</div>
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="输入名字（1-10个字符）"
            maxLength={10}
            className="w-full h-12 rounded-xl border border-[#e2e8f0] px-4 text-center text-lg font-medium outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <p className="text-xs text-[#6b7280] text-center mt-2">支持中文、英文、数字</p>

          <h3 className="text-sm font-bold text-[#374151] mt-8 mb-3">选择性格</h3>
          <div className="space-y-2">
            {PERSONALITIES.map(p => (
              <button
                key={p.id}
                onClick={() => setPersonality(p.id)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  personality === p.id
                    ? 'border-[#2563eb] bg-[#eff6ff]'
                    : 'border-[#e2e8f0] hover:border-[#93c5fd]'
                }`}
              >
                <span className="font-medium text-[#111827]">{p.name}</span>
                <span className="text-xs text-[#6b7280] ml-2">{p.desc}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-between mt-6">
            <ProtoButton variant="secondary" onClick={() => setStep(0)}>上一步</ProtoButton>
            <ProtoButton onClick={() => { if (name.trim()) setStep(2); else setError('请输入名字') }}>下一步</ProtoButton>
          </div>
        </div>
      )}

      {/* Step 2: 确认 */}
      {step === 2 && (
        <div className="text-center">
          <h2 className="text-lg font-bold mb-6">确认认养</h2>
          <div className="text-7xl mb-4">{AVATARS.find(a => a.id === avatar)?.emoji}</div>
          <div className="text-2xl font-bold text-[#111827] mb-2">{name}</div>
          <div className="text-sm text-[#6b7280] mb-6">
            {AVATARS.find(a => a.id === avatar)?.name} · {PERSONALITIES.find(p => p.id === personality)?.name}
          </div>
          <div className="bg-[#f8fafc] rounded-xl p-4 mb-6 text-sm text-[#374151]">
            <p>🎉 认养后，{name}将成为你的专属学习伙伴！</p>
            <p className="mt-1">它会帮你搜索资料、整理笔记，随着使用逐渐成长。</p>
          </div>

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          <div className="flex justify-between">
            <ProtoButton variant="secondary" onClick={() => setStep(1)}>上一步</ProtoButton>
            <ProtoButton onClick={handleAdopt} disabled={loading}>
              {loading ? '认养中...' : '🎊 确认认养'}
            </ProtoButton>
          </div>
        </div>
      )}
    </ProtoCard>
  )
}
