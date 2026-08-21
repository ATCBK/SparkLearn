import { DEFAULT_PARTICIPANTS, getAgentProfile } from './config'
import type { TownAdapterEvent, TownAgent, TownState, WorkshopParticipant } from './types'

function createAgent(participant: WorkshopParticipant): TownAgent {
  const profile = getAgentProfile(participant.id)
  return { id: participant.id, name: participant.name, kind: participant.kind, ...profile, status: 'waiting', activity: '等待任务', latestOutput: '', phase: 'waiting', round: 0, timestamp: '' }
}

export function createInitialTownState(participants: WorkshopParticipant[] = DEFAULT_PARTICIPANTS): TownState {
  const agents = participants.map(createAgent)
  return { agents, timeline: [], totalRounds: 0, complexity: '', phase: 'waiting', phaseStatus: '', round: 0, selectedAgentId: agents[0]?.id ?? '', taskStatus: 'waiting' }
}

function truncateActivity(content: string, limit = 19) {
  const text = content.replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function upsertAgent(agents: TownAgent[], participant: WorkshopParticipant) {
  if (agents.some((agent) => agent.id === participant.id)) return agents
  return [...agents, createAgent(participant)]
}

export function reduceTownEvent(state: TownState, event: TownAdapterEvent): TownState {
  if (event.type === 'workshop_meta') {
    const agents = event.payload.participants.map((participant) => state.agents.find((agent) => agent.id === participant.id) ?? createAgent(participant))
    return { ...state, agents, totalRounds: event.payload.rounds, complexity: event.payload.complexity, selectedAgentId: agents[0]?.id ?? '', taskStatus: 'running' }
  }
  if (event.type === 'workshop_phase') {
    return { ...state, phase: event.payload.phase, phaseStatus: event.payload.status, round: event.payload.round ?? state.round, selectedAgentId: event.payload.phase === 'synthesis' ? 'final-answer-agent' : state.selectedAgentId, taskStatus: event.payload.status === 'running' ? 'running' : state.taskStatus }
  }
  if (event.type === 'hub') {
    const hub = event.payload
    const withAgent = upsertAgent(state.agents, { id: hub.agentId, name: hub.agentName, kind: hub.agentKind })
    const status: TownAgent['status'] = hub.delta ? 'working' : 'completed'
    const agents = withAgent.map((agent) => agent.id === hub.agentId ? { ...agent, name: hub.agentName, kind: hub.agentKind, status, activity: truncateActivity(hub.content) || agent.activityLabel, latestOutput: hub.content, phase: hub.phase, round: hub.round, timestamp: hub.timestamp } : agent)
    const timelineId = `${hub.agentId}:${hub.phase}:${hub.round}`
    const timeline = hub.delta || state.timeline.some((item) => item.id === timelineId) ? state.timeline : [...state.timeline, { id: timelineId, agentId: hub.agentId, agentName: hub.agentName, phase: hub.phase, round: hub.round, summary: truncateActivity(hub.content, 42), timestamp: hub.timestamp, status }]
    return { ...state, agents, timeline, phase: hub.phase, round: hub.round || state.round, selectedAgentId: hub.agentId, taskStatus: 'running' }
  }
  if (event.type === 'error') {
    return { ...state, taskStatus: 'error', agents: state.agents.map((agent) => agent.id === state.selectedAgentId ? { ...agent, status: 'error', activity: event.message } : agent) }
  }
  return { ...state, taskStatus: 'completed', phaseStatus: 'done', selectedAgentId: 'final-answer-agent', agents: state.agents.map((agent) => ({ ...agent, status: 'completed', activity: '任务完成' })) }
}

export function getPhaseLabel(phase: string, round: number, totalRounds: number) {
  if (phase === 'profile_analysis') return '阶段 1 · 学习画像分析'
  if (phase === 'discussion') return `阶段 2 · 多智能体协同讨论${round ? ` · Round ${round}${totalRounds ? ` / ${totalRounds}` : ''}` : ''}`
  if (phase === 'synthesis') return '阶段 3 · 最终综合'
  return '等待多智能体任务'
}
