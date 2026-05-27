'use client'

import { useState } from 'react'
import { AgentPet, api } from '@/lib/api'
import { ProtoCard, Pill, Bar } from '@/components/proto'
import { Settings, Star, Zap, TrendingUp, Search, FileText, GitCompare, Sparkles } from 'lucide-react'
import { PetAvatar, PetType, PetState } from './PetAvatar'

const PERSONALITY_LABEL: Record<string, string> = { concise: '严格导师', verbose: '陪练伙伴', encouraging: '温柔朋友' }
const ABILITY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  search: { label: '搜索资料', icon: <Search className="h-3 w-3" /> },
  summarize: { label: '文章摘要', icon: <FileText className="h-3 w-3" /> },
  compare: { label: '对比搜索', icon: <GitCompare className="h-3 w-3" /> },
  recommend: { label: '每日推荐', icon: <Sparkles className="h-3 w-3" /> },
}

const STATE_MESSAGES: Record<PetState, string> = {
  idle: '等待你的指令...',
  thinking: '正在思考中...',
  searching: '正在帮你搜索资料...',
  reading: '正在阅读和总结...',
  analyzing: '正在对比分析...',
  success: '任务完成！',
  failed: '遇到了一些问题...',
  waiting: '有什么需要帮忙的吗？',
  levelup: '升级了！解锁新能力！',
}

interface Props {
  pet: AgentPet
  petState?: PetState
  statusText?: string
  onUpdate: () => void
}

export function AgentPetCard({ pet, petState = 'idle', statusText, onUpdate }: Props) {
  const [showSettings, setShowSettings] = useState(false)
  const [personality, setPersonality] = useState(pet.personality)
  const [saving, setSaving] = useState(false)

  const xpProgress = pet.next_level_xp
    ? Math.round((pet.xp / pet.next_level_xp) * 100)
    : 100

  const xpToNext = pet.next_level_xp ? pet.next_level_xp - pet.xp : 0

  async function savePersonality() {
    if (personality === pet.personality) return
    setSaving(true)
    try {
      await api.updateAgentPet({ personality })
      onUpdate()
      setShowSettings(false)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      {/* ─── 顶部：活体学伴区 ─── */}
      <ProtoCard className="relative text-center pb-4">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#6b7280]"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* 动画宠物 */}
        <div className="flex justify-center pt-2 mb-3">
          <PetAvatar type={pet.avatar as PetType} state={petState} size="lg" />
        </div>

        {/* 名字 + 等级 */}
        <h3 className="text-base font-bold text-[#111827]">{pet.name}</h3>
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <Pill tone="orange"><Star className="h-3 w-3" /> Lv.{pet.level}</Pill>
          <Pill tone="blue">{PERSONALITY_LABEL[pet.personality] || pet.personality}</Pill>
        </div>

        {/* 当前状态文字 */}
        <div className="mt-3 mx-auto max-w-[240px] px-3 py-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
          <p className="text-xs text-[#374151] leading-relaxed">
            {statusText || STATE_MESSAGES[petState]}
          </p>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 pt-3 border-t border-[#e2e8f0] text-left">
            <div className="text-xs font-bold text-[#374151] mb-2">修改陪伴风格</div>
            <div className="space-y-1.5">
              {(['concise', 'verbose', 'encouraging'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPersonality(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    personality === p ? 'bg-[#eff6ff] text-[#2563eb] font-medium' : 'hover:bg-[#f8fafc] text-[#374151]'
                  }`}
                >
                  {PERSONALITY_LABEL[p]}
                </button>
              ))}
            </div>
            {personality !== pet.personality && (
              <button
                onClick={savePersonality}
                disabled={saving}
                className="mt-2 w-full h-8 rounded-lg bg-[#2563eb] text-white text-xs font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            )}
          </div>
        )}
      </ProtoCard>

      {/* ─── 中部：成长进度 ─── */}
      <ProtoCard>
        <div className="flex items-center gap-2 mb-3">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-[#fff7ed] text-[#d97706]">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold text-[#374151]">成长进度</span>
        </div>

        {/* XP Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] text-[#6b7280] mb-1">
            <span>经验值 {pet.xp} / {pet.next_level_xp || 'MAX'}</span>
            {xpToNext > 0 && <span>还需 {xpToNext} XP 升级</span>}
          </div>
          <Bar value={xpProgress} tone="blue" />
        </div>

        {/* 能力列表 */}
        <div className="text-[11px] font-bold text-[#374151] mb-2">已解锁能力</div>
        <div className="space-y-1.5">
          {pet.unlocked_abilities.map(a => {
            const info = ABILITY_LABELS[a]
            return (
              <div key={a} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f8fafc]">
                <div className="grid h-5 w-5 place-items-center rounded bg-[#ecfdf5] text-[#059669]">
                  {info?.icon || <Zap className="h-3 w-3" />}
                </div>
                <span className="text-xs text-[#374151]">{info?.label || a}</span>
              </div>
            )
          })}
        </div>

        {pet.level < 5 && (
          <p className="text-[11px] text-[#9ca3af] mt-3 text-center">
            升到 Lv.{pet.level + 1} 解锁更多能力
          </p>
        )}
      </ProtoCard>
    </div>
  )
}
