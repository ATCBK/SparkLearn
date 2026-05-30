'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, AgentPet, NanobotStatus } from '@/lib/api'
import { PageHead, Pill } from '@/components/proto'
import { Activity, AlertTriangle, Cpu, Star, Zap } from 'lucide-react'
import { AdoptionFlow } from '@/components/agent/AdoptionFlow'
import { AgentPetCard } from '@/components/agent/AgentPetCard'
import { AgentChat } from '@/components/agent/AgentChat'
import { AgentHistory } from '@/components/agent/AgentHistory'
import { PetState } from '@/components/agent/PetAvatar'

export default function AgentPage() {
  const [pet, setPet] = useState<AgentPet | null | undefined>(undefined)
  const [nanobot, setNanobot] = useState<NanobotStatus | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [petState, setPetState] = useState<PetState>('idle')
  const [statusText, setStatusText] = useState('')

  const loadPet = useCallback(async () => {
    try {
      const data = await api.getAgentPet()
      setPet(data)
    } catch {
      setPet(null)
    }
  }, [])

  const loadNanobot = useCallback(async () => {
    try {
      setNanobot(await api.getNanobotStatus())
    } catch {
      setNanobot({ enabled: true, healthy: false, reason: '无法连接后端状态接口' })
    }
  }, [])

  useEffect(() => {
    // The page must fetch persisted local companion state after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPet()
    void loadNanobot()
  }, [loadPet, loadNanobot, refreshKey])

  if (pet === undefined) {
    return (
      <div>
        <PageHead eyebrow="学习中心 / AI 学伴" title="AI 学伴空间" description="正在连接学习画像、任务记录和本机学伴内核。" />
        <div className="grid min-h-[420px] place-items-center">
          <div className="flex items-center gap-3 rounded-[12px] border border-line bg-white px-5 py-4 shadow-sm">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue border-t-transparent" />
            <span className="text-small font-bold text-muted">正在加载学伴空间</span>
          </div>
        </div>
      </div>
    )
  }

  if (pet === null) {
    return (
      <div>
        <PageHead
          eyebrow="学习中心 / AI 学伴"
          title="创建你的 AI 学伴"
          description="学伴会结合学习画像、任务目标和本机 Nanobot 能力，辅助完成资料检索、内容摘要和概念对比。"
          actions={<NanobotPill status={nanobot} />}
        />
        <AdoptionFlow onAdopted={() => setRefreshKey(k => k + 1)} />
      </div>
    )
  }

  return (
    <div>
      <PageHead
        eyebrow="学习中心 / AI 学伴"
        title={`${pet.name} 的学习工作台`}
        description="围绕一个明确任务发起对话，学伴会先调用本机 Nanobot，异常时自动切换到 SparkLearn 备用能力。"
        actions={<NanobotPill status={nanobot} />}
        chips={[
          { value: `Lv.${pet.level}`, label: '成长等级', icon: <Star className="h-4 w-4" />, tone: 'orange' },
          { value: `${pet.xp} XP`, label: '累计经验', icon: <Activity className="h-4 w-4" />, tone: 'blue' },
          { value: `${pet.unlocked_abilities.length} 项`, label: '已解锁能力', icon: <Zap className="h-4 w-4" />, tone: 'green' },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-[980px]:grid-cols-1">
        <AgentChat
          pet={pet}
          nanobot={nanobot}
          onXpChange={() => setRefreshKey(k => k + 1)}
          onStateChange={(state, text) => {
            setPetState(state)
            setStatusText(text || '')
          }}
        />

        <aside className="space-y-4">
          <AgentPetCard pet={pet} petState={petState} statusText={statusText} nanobot={nanobot} onUpdate={() => setRefreshKey(k => k + 1)} />
          <AgentHistory />
        </aside>
      </div>
    </div>
  )
}

function NanobotPill({ status }: { status: NanobotStatus | null }) {
  if (!status) {
    return <Pill tone="neutral"><Cpu className="h-3.5 w-3.5" />检测中</Pill>
  }
  if (!status.enabled) {
    return <Pill tone="neutral"><Cpu className="h-3.5 w-3.5" />未启用</Pill>
  }
  if (status.healthy) {
    return <Pill tone="green"><Cpu className="h-3.5 w-3.5" />Nanobot 在线</Pill>
  }
  return <Pill tone="orange"><AlertTriangle className="h-3.5 w-3.5" />备用模式</Pill>
}
