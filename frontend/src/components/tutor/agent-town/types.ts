import type { WorkshopHubEvent } from '@/lib/api'
import type { AgentStatus } from '@/vendor/agent-town'
import type { TownAgentStatus } from './config'

export interface WorkshopParticipant { id: string; name: string; kind: string }
export interface WorkshopMetaPayload { enabled: boolean; complexity: string; rounds: number; participants: WorkshopParticipant[] }
export interface WorkshopPhasePayload { phase: string; round?: number; status: string }

export interface TownAgent {
  id: string
  name: string
  kind: string
  buildingName: string
  stageId: string
  duty: string
  status: TownAgentStatus
  engineStatus: AgentStatus
  activityLabel: string
  activity: string
  latestOutput: string
  phase: string
  round: number
  timestamp: string
  accent: string
}

export interface TownTimelineEvent { id: string; agentId: string; agentName: string; phase: string; round: number; summary: string; timestamp: string; status: TownAgentStatus }
export interface TownState {
  agents: TownAgent[]
  timeline: TownTimelineEvent[]
  phase: string
  phaseStatus: string
  round: number
  totalRounds: number
  complexity: string
  selectedAgentId: string
  taskStatus: 'waiting' | 'running' | 'completed' | 'error'
}

export type TownAdapterEvent =
  | { type: 'workshop_meta'; payload: WorkshopMetaPayload }
  | { type: 'workshop_phase'; payload: WorkshopPhasePayload }
  | { type: 'hub'; payload: WorkshopHubEvent }
  | { type: 'done' }
  | { type: 'error'; message: string }

