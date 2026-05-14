'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, AgentPet, AgentTask } from '@/lib/api'
import { PageHead } from '@/components/proto'
import { Bot, Sparkles, Star } from 'lucide-react'
import { AdoptionFlow } from '@/components/agent/AdoptionFlow'
import { AgentPetCard } from '@/components/agent/AgentPetCard'
import { AgentChat } from '@/components/agent/AgentChat'
import { AgentHistory } from '@/components/agent/AgentHistory'

export default function AgentPage() {
  const [pet, setPet] = useState<AgentPet | null | undefined>(undefined) // undefined = loading
  const [refreshKey, setRefreshKey] = useState(0)

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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted">加载中...</div>
      </div>
    )
  }

  // No pet yet - show adoption flow
  if (pet === null) {
    return (
      <div>
        <PageHead
          eyebrow="学习中心 / 学习伙伴"
          title="认养你的学习伙伴"
          description="选择一只 AI 小助手，它会陪你一起学习、帮你找资料、整理笔记。"
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
          { value: `${pet.unlocked_abilities.length} 项`, label: '已解锁能力', icon: <Bot className="h-4 w-4" />, tone: 'green' as const },
        ]}
      />

      <div className="grid grid-cols-[1fr_320px] gap-5 max-[960px]:grid-cols-1" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {/* 左侧：对话区 - 固定高度 */}
        <div className="min-h-0">
          <AgentChat pet={pet} onXpChange={() => setRefreshKey(k => k + 1)} />
        </div>

        {/* 右侧：伙伴信息 + 历史 - 超出滚动 */}
        <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
          <AgentPetCard pet={pet} onUpdate={() => setRefreshKey(k => k + 1)} />
          <AgentHistory />
        </div>
      </div>
    </div>
  )
}
