import type { AgentStatus, StageConfig } from '@/vendor/agent-town'

export type TownAgentStatus = 'waiting' | 'working' | 'completed' | 'error'

export interface AgentProfile {
  buildingName: string
  stageId: string
  duty: string
  engineStatus: AgentStatus
  activityLabel: string
  accent: string
}

export const TOWN_STAGES: StageConfig[] = [
  { id: 'profile', name: '学习画像中心', color: '#3f75d8', buildingStyle: 'lab' },
  { id: 'planning', name: '任务规划站', color: '#2a91a8', buildingStyle: 'office' },
  { id: 'research', name: '学科研究所', color: '#2563a9', buildingStyle: 'lab' },
  { id: 'audit', name: '质疑审计局', color: '#c45f4a', buildingStyle: 'office' },
  { id: 'action', name: '行动工坊', color: '#d58a35', buildingStyle: 'workshop' },
  { id: 'collaboration', name: '协作中心', color: '#6476b8', buildingStyle: 'tavern' },
  { id: 'synthesis', name: '中央调度中心', color: '#1eaa83', buildingStyle: 'depot' },
]

const PROFILES: Record<string, AgentProfile> = {
  'profile-agent': { buildingName: '学习画像中心', stageId: 'profile', duty: '读取学习画像、薄弱点和学习偏好', engineStatus: 'analyzing', activityLabel: '正在分析', accent: '#618ce0' },
  clarifier: { buildingName: '任务规划站', stageId: 'planning', duty: '补全目标、约束和问题上下文', engineStatus: 'planning', activityLabel: '正在规划', accent: '#34a3b8' },
  researcher: { buildingName: '学科研究所', stageId: 'research', duty: '检索资料、证据和专业知识', engineStatus: 'reading', activityLabel: '正在研究', accent: '#4279bd' },
  'subject-tutor': { buildingName: '学科研究所', stageId: 'research', duty: '提供专业解释与解题路径', engineStatus: 'reading', activityLabel: '正在研究', accent: '#4279bd' },
  challenger: { buildingName: '质疑审计局', stageId: 'audit', duty: '检查漏洞、风险与边界条件', engineStatus: 'reviewing', activityLabel: '正在审计', accent: '#d36f57' },
  coach: { buildingName: '行动工坊', stageId: 'action', duty: '把讨论转化为可执行学习动作', engineStatus: 'generating', activityLabel: '正在执行', accent: '#dd9342' },
  'final-answer-agent': { buildingName: '中央调度中心', stageId: 'synthesis', duty: '汇总各方观点并生成最终答复', engineStatus: 'generating', activityLabel: '正在汇总', accent: '#2db28d' },
}

const CUSTOM_PROFILE: AgentProfile = { buildingName: '协作中心', stageId: 'collaboration', duty: '参与多智能体协同研讨', engineStatus: 'thinking', activityLabel: '正在协作', accent: '#7484c5' }

export function getAgentProfile(id: string): AgentProfile {
  return PROFILES[id] ?? CUSTOM_PROFILE
}

export const DEFAULT_PARTICIPANTS = [
  { id: 'profile-agent', name: '画像分析师', kind: 'system' },
  { id: 'clarifier', name: '任务规划 Agent', kind: 'system' },
  { id: 'subject-tutor', name: '学科导师', kind: 'system' },
  { id: 'challenger', name: '质疑者', kind: 'system' },
  { id: 'coach', name: '行动教练', kind: 'system' },
  { id: 'final-answer-agent', name: '最终回答 Agent', kind: 'system' },
]
