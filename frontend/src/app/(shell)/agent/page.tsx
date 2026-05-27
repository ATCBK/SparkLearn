'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, AgentPet } from '@/lib/api'
import { PageHead } from '@/components/proto'
import { Star, Sparkles, Zap } from 'lucide-react'
import { AdoptionFlow } from '@/components/agent/AdoptionFlow'
import { AgentPetCard } from '@/components/agent/AgentPetCard'
import { AgentChat } from '@/components/agent/AgentChat'
import { AgentHistory } from '@/components/agent/AgentHistory'
import { PetState } from '@/components/agent/PetAvatar'

export default function AgentPage() {
  const [pet, setPet] = useState<AgentPet | null | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const [petState, setPetState] = useState<PetState>('idle')
  const [statusText, setStatusText] = useState<string>('')

  const loadPet = useCallback(async () => {
    try {
      const data = await api.getAgentPet()
      setPet(data)
    } catch {
      setPet(null)
    }
  }, [])

  useEffect(() => {
    void loadPet()
  }, [loadPet, refreshKey])

  // Loading state
  if (pet === undefined) {
    return (
      <div>
        <PageHead
          eyebrow="学习中心 / 学习伙伴"
          title="学习伙伴空间"
          description="正在加载..."
        />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#6b7280]">正在连接学习伙伴...</span>
          </div>
        </div>
      </div>
    )
  }

  // No pet yet - show adoption prompt inside chat layout
  if (pet === null) {
    return (
      <div>
        <PageHead
          eyebrow="学习中心 / 学习伙伴"
          title="学习伙伴空间"
          description="认养一只 AI 小助手，它会陪你一起学习、帮你找资料、整理笔记。"
        />
        <AdoptionFlow onAdopted={() => setRefreshKey(k => k + 1)} />
      </div>
    )
  }

  // Has pet - show main interface
  return (
    <div>
      <PageHead
        eyebrow="学习中心 / 学习伙伴"
        title={`${pet.name}的学习空间`}
        description="让你的学习伙伴帮你搜索资料、整理笔记、发现学习内容。"
        chips={[
          { value: `Lv.${pet.level}`, label: '当前等级', icon: <Star className="h-4 w-4" />, tone: 'orange' as const },
          { value: `${pet.xp} XP`, label: '经验值', icon: <Sparkles className="h-4 w-4" />, tone: 'blue' as const },
          { value: `${pet.unlocked_abilities.length} 项`, label: '已解锁能力', icon: <Zap className="h-4 w-4" />, tone: 'green' as const },
        ]}
      />

      <div className="grid grid-cols-[1fr_300px] gap-5 max-[960px]:grid-cols-1">
        {/* 左侧：对话区 */}
        <div className="min-h-0">
          <AgentChat
            pet={pet}
            onXpChange={() => setRefreshKey(k => k + 1)}
            onStateChange={(state, text) => { setPetState(state); setStatusText(text || '') }}
          />
        </div>

        {/* 右侧：学习驾驶舱 */}
        <div className="space-y-0 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
          <AgentPetCard
            pet={pet}
            petState={petState}
            statusText={statusText}
            onUpdate={() => setRefreshKey(k => k + 1)}
          />
          <div className="mt-4">
            <AgentHistory />
          </div>
        </div>
      </div>
    </div>
  )
}
