'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, Monitor, Star, Zap } from 'lucide-react'
import { api, AgentPet } from '@/lib/api'
import { PageHead, ProtoCard } from '@/components/proto'
import { AdoptionFlow } from '@/components/agent/AdoptionFlow'
import { AgentPetCard } from '@/components/agent/AgentPetCard'
import { AgentChat } from '@/components/agent/AgentChat'
import { AgentHistory } from '@/components/agent/AgentHistory'
import { PetState } from '@/components/agent/PetAvatar'

export default function AgentPage() {
  const [pet, setPet] = useState<AgentPet | null | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const [petState, setPetState] = useState<PetState>('idle')
  const [statusText, setStatusText] = useState('')
  const [readopting, setReadopting] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const refreshPet = useCallback(() => setRefreshKey(k => k + 1), [])

  const handleAgentStateChange = useCallback((state: PetState, text?: string) => {
    setPetState(state)
    setStatusText(text || '')
  }, [])

  const loadPet = useCallback(async () => {
    try {
      const data = await api.getAgentPet()
      setPet(data)
      if (!data) {
        setReadopting(false)
      }
    } catch {
      setPet(null)
      setReadopting(false)
    }
  }, [])

  useEffect(() => {
    // 页面需要在水合后读取已持久化的本地伙伴状态。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPet()
  }, [loadPet, refreshKey])

  if (pet === undefined) {
    return (
      <div data-guide-target="agent-workspace">
        <PageHead
          eyebrow="学习中心 / AI 伙伴"
          title="AI 伙伴空间"
          description="正在连接学习画像、任务记录和本地伙伴核心。"
        />
        <div className="grid min-h-[420px] place-items-center">
          <div className="flex items-center gap-3 rounded-[12px] border border-line bg-white px-5 py-4 shadow-sm">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue border-t-transparent" />
            <span className="text-small font-bold text-muted">正在加载伙伴空间</span>
          </div>
        </div>
      </div>
    )
  }

  if (pet === null) {
    return (
      <div>
        <PageHead
          eyebrow="学习中心 / AI 伙伴"
          title="创建你的 AI 学习伙伴"
          description="选择一个长期陪伴你的学习伙伴。它会结合你的学习目标，协助完成资料检索、内容摘要和概念对比。"
        />
        <AdoptionFlow onAdopted={() => setRefreshKey(k => k + 1)} />
      </div>
    )
  }

  if (readopting) {
    return (
      <div data-guide-target="agent-workspace">
        <PageHead
          eyebrow="学习中心 / AI 伙伴"
          title="重新认养你的 AI 学习伙伴"
          description="重新选择伙伴形象、陪伴风格和名字，并清空原伙伴的历史对话、经验和任务记录。"
          chips={[
            { value: `Lv.${pet.level}`, label: '当前等级', icon: <Star className="h-4 w-4" />, tone: 'orange' },
            { value: `${pet.xp} XP`, label: '将被清空', icon: <Activity className="h-4 w-4" />, tone: 'blue' },
            { value: `${pet.unlocked_abilities.length} 项`, label: '重新开始', icon: <Zap className="h-4 w-4" />, tone: 'green' },
          ]}
        />
        <AdoptionFlow
          mode="readopt"
          initialPet={pet}
          onCancel={() => setReadopting(false)}
          onAdopted={() => {
            setReadopting(false)
            setRefreshKey(k => k + 1)
          }}
        />
      </div>
    )
  }

  return (
    <div data-guide-target="agent-workspace">
      <PageHead
        eyebrow="学习中心 / AI 伙伴"
        title={`${pet.name} 的学习工作台`}
        description="伙伴会结合学习画像和任务目标，协助完成资料检索、内容摘要和概念对比。"
        chips={[
          { value: `Lv.${pet.level}`, label: '成长等级', icon: <Star className="h-4 w-4" />, tone: 'orange' },
          { value: `${pet.xp} XP`, label: '累计经验', icon: <Activity className="h-4 w-4" />, tone: 'blue' },
          { value: `${pet.unlocked_abilities.length} 项`, label: '已解锁能力', icon: <Zap className="h-4 w-4" />, tone: 'green' },
        ]}
      />

      <div className="grid items-stretch grid-cols-[minmax(0,1fr)_320px] gap-5 max-[980px]:grid-cols-1">
        <AgentChat
          pet={pet}
          selectedTaskId={selectedTaskId}
          onXpChange={refreshPet}
          onStateChange={handleAgentStateChange}
        />

        <aside className="space-y-4">
          <AgentPetCard
            pet={pet}
            petState={petState}
            statusText={statusText}
            onUpdate={refreshPet}
            onReadopt={() => setReadopting(true)}
          />
          <ProtoCard>
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-blue-light text-blue">
                <Monitor className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-small font-bold text-ink">本地控制能力</h3>
                <p className="mt-2 text-small leading-6 text-muted">
                  线上 Web 版只支持对话、任务建议和学习资源处理。需要控制本机浏览器时，必须安装 SparkLearn 桌面端并启用本地服务。
                </p>
              </div>
            </div>
          </ProtoCard>
          <AgentHistory selectedTaskId={selectedTaskId} onSelectTask={setSelectedTaskId} />
        </aside>
      </div>
    </div>
  )
}
