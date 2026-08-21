'use client'

import { memo, useEffect, useRef } from 'react'
import { AgentTown } from '@/vendor/agent-town'
import { TOWN_STAGES } from './config'
import type { TownAgent } from './types'
import styles from './AgentTown.module.css'

function engineStatus(agent: TownAgent) {
  if (agent.status === 'completed') return 'success' as const
  if (agent.status === 'error') return 'error' as const
  if (agent.status === 'working') return agent.engineStatus
  return 'idle' as const
}

export const AgentTownScene = memo(function AgentTownScene({ agents, selectedAgentId, onSelectAgent }: { agents: TownAgent[]; selectedAgentId: string; onSelectAgent: (agentId: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const townRef = useRef<AgentTown | null>(null)
  const selectRef = useRef(onSelectAgent)
  useEffect(() => { selectRef.current = onSelectAgent }, [onSelectAgent])
  useEffect(() => {
    if (!containerRef.current) return
    const town = new AgentTown({ container: containerRef.current, environment: 'town', officeSize: 'xl', theme: 'hybrid', autoSize: false, roomMode: 'kanban', stages: TOWN_STAGES, onAgentClick: (agentId) => selectRef.current(agentId) })
    town.updateSettings({ particleDensity: 'medium', animationSpeed: 1 })
    townRef.current = town
    return () => { town.destroy(); townRef.current = null }
  }, [])
  useEffect(() => {
    const town = townRef.current
    if (!town) return
    const incoming = new Set(agents.map((agent) => agent.id))
    for (const existing of town.getAgents()) if (!incoming.has(existing.id)) town.removeAgent(existing.id)
    for (const agent of agents) {
      const status = engineStatus(agent)
      const message = agent.status === 'working' ? `${agent.activityLabel}: ${agent.activity}` : agent.status === 'completed' ? '✓ 已完成' : agent.activity
      if (!town.getAgent(agent.id)) town.addAgent({ id: agent.id, name: agent.name, role: agent.id === 'final-answer-agent' ? 'Director' : agent.buildingName, team: agent.kind === 'custom' ? 'Custom Tutor' : 'SparkLearn', status, message })
      town.updateAgent(agent.id, { name: agent.name, status, message, targetStageId: agent.stageId })
    }
  }, [agents])
  return <div className={styles.sceneShell} data-selected-agent={selectedAgentId}><div ref={containerRef} className={styles.canvasHost} aria-label="多智能体小镇实时地图" /><div className={styles.sceneHint}>点击人物查看详情 · Canvas 实时寻路与状态动画</div></div>
})
