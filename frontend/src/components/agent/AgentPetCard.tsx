'use client'

import { useState } from 'react'
import { AgentPet, api } from '@/lib/api'
import { ProtoCard, Pill, Bar } from '@/components/proto'
import { Settings, Star } from 'lucide-react'
import { PetAvatar, PetType } from './PetAvatar'

const AVATAR_EMOJI: Record<string, string> = { fox: '🦊', owl: '🦉', robot: '🤖', cat: '🐱', dragon: '🐲', penguin: '🐧', bunny: '🐰', panda: '🐼' }
const PERSONALITY_LABEL: Record<string, string> = { concise: '简洁型', verbose: '话多型', encouraging: '鼓励型' }
const ABILITY_LABELS: Record<string, string> = {
  search: '搜索资料',
  summarize: '文章摘要',
  compare: '对比搜索',
  recommend: '每日推荐',
}

interface Props {
  pet: AgentPet
  onUpdate: () => void
}

export function AgentPetCard({ pet, onUpdate }: Props) {
  const [showSettings, setShowSettings] = useState(false)
  const [personality, setPersonality] = useState(pet.personality)
  const [saving, setSaving] = useState(false)

  const xpProgress = pet.next_level_xp
    ? Math.round((pet.xp / pet.next_level_xp) * 100)
    : 100

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
    <ProtoCard className="relative">
      {/* Settings toggle */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#6b7280]"
      >
        <Settings className="h-4 w-4" />
      </button>

      {/* Avatar + Info */}
      <div className="text-center">
        <div className="flex justify-center mb-2">
          <PetAvatar type={pet.avatar as PetType} state="idle" size="lg" />
        </div>
        <h3 className="text-lg font-bold text-[#111827]">{pet.name}</h3>
        <div className="flex items-center justify-center gap-2 mt-1">
          <Pill tone="orange"><Star className="h-3 w-3" /> Lv.{pet.level}</Pill>
          <Pill tone="blue">{PERSONALITY_LABEL[pet.personality]}</Pill>
        </div>
      </div>

      {/* XP Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-[#6b7280] mb-1">
          <span>经验值</span>
          <span>{pet.xp} / {pet.next_level_xp || 'MAX'}</span>
        </div>
        <Bar value={xpProgress} tone="blue" />
      </div>

      {/* Abilities */}
      <div className="mt-4">
        <div className="text-xs font-bold text-[#374151] mb-2">已解锁能力</div>
        <div className="flex flex-wrap gap-1.5">
          {pet.unlocked_abilities.map(a => (
            <Pill key={a} tone="green">{ABILITY_LABELS[a] || a}</Pill>
          ))}
        </div>
        {pet.level < 5 && (
          <p className="text-xs text-[#9ca3af] mt-2">
            继续使用可升级解锁更多能力
          </p>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
          <div className="text-xs font-bold text-[#374151] mb-2">修改性格</div>
          <div className="space-y-1.5">
            {(['concise', 'verbose', 'encouraging'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPersonality(p)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
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
              className="mt-3 w-full h-8 rounded-lg bg-[#2563eb] text-white text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          )}
        </div>
      )}
    </ProtoCard>
  )
}
