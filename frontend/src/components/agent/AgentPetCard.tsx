'use client'

import { useEffect, useState } from 'react'
import { AgentPet, api } from '@/lib/api'
import { Bar, Pill, ProtoCard } from '@/components/proto'
import { Cpu, FileText, GitCompare, RefreshCw, Search, Settings, Sparkles, Star, TrendingUp, Zap } from 'lucide-react'
import { PetAvatar, PetState, PetType } from './PetAvatar'

const PERSONALITY_LABEL: Record<string, string> = {
  concise: '严格导师',
  verbose: '详细教练',
  encouraging: '鼓励陪练',
}

const ABILITY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  search: { label: '资料检索', icon: <Search className="h-3 w-3" /> },
  summarize: { label: '内容摘要', icon: <FileText className="h-3 w-3" /> },
  compare: { label: '概念对比', icon: <GitCompare className="h-3 w-3" /> },
  recommend: { label: '学习推荐', icon: <Sparkles className="h-3 w-3" /> },
}

const STATE_MESSAGES: Record<PetState, string> = {
  idle: '等待新的学习任务。',
  thinking: '正在拆解问题。',
  searching: '正在检索和筛选资料。',
  reading: '正在阅读并提取要点。',
  analyzing: '正在进行对比分析。',
  success: '任务已完成。',
  failed: '任务遇到问题，已保留上下文。',
  waiting: '可以继续输入学习任务。',
  levelup: '已升级，新的能力已开放。',
}

const AVATAR_OPTIONS: Array<{ id: PetType; label: string }> = [
  { id: 'fox', label: '灵狐' },
  { id: 'owl', label: '智枭' },
  { id: 'robot', label: '芯助' },
  { id: 'cat', label: '星猫' },
  { id: 'dragon', label: '焰龙' },
  { id: 'penguin', label: '冰企鹅' },
  { id: 'bunny', label: '棉兔' },
  { id: 'panda', label: '竹圆' },
]

export function AgentPetCard({
  pet,
  petState = 'idle',
  statusText,
  onUpdate,
  onReadopt,
}: {
  pet: AgentPet
  petState?: PetState
  statusText?: string
  onUpdate: () => void
  onReadopt?: () => void
}) {
  const [showSettings, setShowSettings] = useState(false)
  const [personality, setPersonality] = useState(pet.personality)
  const [avatar, setAvatar] = useState<PetType>(pet.avatar as PetType)
  const [saving, setSaving] = useState(false)

  const xpProgress = pet.next_level_xp ? Math.round((pet.xp / pet.next_level_xp) * 100) : 100
  const xpToNext = pet.next_level_xp ? Math.max(0, pet.next_level_xp - pet.xp) : 0
  const displayStatus = statusText || STATE_MESSAGES[petState]
  const hasSettingsChanged = personality !== pet.personality || avatar !== pet.avatar

  useEffect(() => {
    setPersonality(pet.personality)
    setAvatar(pet.avatar as PetType)
  }, [pet.personality, pet.avatar])

  async function saveSettings() {
    if (!hasSettingsChanged) return
    setSaving(true)
    try {
      await api.updateAgentPet({ personality, avatar })
      onUpdate()
      setShowSettings(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtoCard className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PetAvatar type={pet.avatar as PetType} state={petState} size="md" />
          <div>
            <h2 className="text-base font-bold text-ink">{pet.name}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Pill tone="orange"><Star className="h-3 w-3" />Lv.{pet.level}</Pill>
              <Pill tone="blue">{PERSONALITY_LABEL[pet.personality] || pet.personality}</Pill>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onReadopt && (
            <button
              onClick={onReadopt}
              className="grid h-8 w-8 place-items-center rounded-[8px] text-muted transition-colors hover:bg-[#f2f6fb] hover:text-blue"
              aria-label="重新认养学习伙伴"
              title="重新认养"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setShowSettings(v => !v)}
            className="grid h-8 w-8 place-items-center rounded-[8px] text-muted transition-colors hover:bg-[#f2f6fb] hover:text-ink"
            aria-label="调整陪伴风格"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-[10px] border border-line bg-[#f8fbff] p-3">
        <div className="mb-2 flex items-center gap-2 text-small font-bold text-ink">
          <Cpu className="h-4 w-4 text-blue" />
          学伴任务状态
        </div>
        <p className="text-small leading-6 text-muted">{displayStatus}</p>
      </div>

      {showSettings && (
        <div className="rounded-[10px] border border-line bg-white p-3">
          <div className="mb-2 text-small font-bold text-ink">陪伴风格</div>
          <div className="grid gap-2">
            {(['concise', 'verbose', 'encouraging'] as const).map(item => (
              <button
                key={item}
                onClick={() => setPersonality(item)}
                className={`rounded-[8px] px-3 py-2 text-left text-small font-bold transition-colors ${
                  personality === item ? 'bg-blue-light text-blue' : 'bg-[#f8fafc] text-muted hover:bg-[#eef4fb]'
                }`}
              >
                {PERSONALITY_LABEL[item]}
              </button>
            ))}
          </div>
          <div className="mt-4 mb-2 text-small font-bold text-ink">伙伴头像</div>
          <div className="grid grid-cols-4 gap-2">
            {AVATAR_OPTIONS.map(item => (
              <button
                key={item.id}
                onClick={() => setAvatar(item.id)}
                className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-[8px] border px-2 py-2 text-micro font-bold transition-colors ${
                  avatar === item.id
                    ? 'border-blue bg-blue-light text-blue'
                    : 'border-line bg-[#f8fafc] text-muted hover:bg-[#eef4fb]'
                }`}
                aria-label={`切换为${item.label}`}
              >
                <PetAvatar type={item.id} state={avatar === item.id ? 'waiting' : 'idle'} size="sm" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          {hasSettingsChanged && (
            <button
              onClick={saveSettings}
              disabled={saving}
              className="mt-3 h-9 w-full rounded-[8px] bg-blue text-small font-bold text-white transition-colors hover:bg-blue-dark disabled:opacity-50"
            >
              {saving ? '保存中' : '保存设置'}
            </button>
          )}
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-[8px] bg-orange-light text-orange">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="text-small font-bold text-ink">成长进度</span>
        </div>
        <div className="mb-1 flex justify-between text-micro text-muted">
          <span>{pet.xp} / {pet.next_level_xp || 'MAX'} XP</span>
          {xpToNext > 0 && <span>还需 {xpToNext} XP</span>}
        </div>
        <Bar value={xpProgress} tone="blue" />
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-small font-bold text-ink">
          <Cpu className="h-4 w-4 text-muted" />
          已解锁能力
        </div>
        <div className="grid gap-2">
          {pet.unlocked_abilities.map(ability => {
            const info = ABILITY_LABELS[ability]
            return (
              <div key={ability} className="flex items-center gap-2 rounded-[8px] bg-[#f8fafc] px-3 py-2 text-small text-muted">
                <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-green-light text-green">
                  {info?.icon || <Zap className="h-3 w-3" />}
                </span>
                {info?.label || ability}
              </div>
            )
          })}
        </div>
      </div>
    </ProtoCard>
  )
}
