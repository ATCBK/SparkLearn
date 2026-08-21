import { Check, CircleDot, Clock3, Users } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { TownAgent, TownState } from './types'
import styles from './AgentTown.module.css'

const STATUS_LABEL = { waiting: '等待', working: '工作中', completed: '完成', error: '异常' }
export function AgentStatusPanel({ state, topic, onSelectAgent }: { state: TownState; topic: string; onSelectAgent: (agentId: string) => void }) {
  return <aside className={styles.sidePanel}><div className={styles.eyebrow}>MISSION CONTROL</div><h2 className={styles.panelTitle}>当前任务</h2><p className={styles.taskText}>{topic || '等待输入新的学习研讨任务'}</p><div className={styles.taskMetrics}><span><CircleDot size={13} />{state.phase === 'waiting' ? '待命' : state.phase}</span><span><Clock3 size={13} />Round {state.round || 0}/{state.totalRounds || '—'}</span></div><div className={styles.sectionHeading}><Users size={14} /> AGENT ROSTER</div><div className={styles.agentList}>{state.agents.map((agent) => <AgentRow key={agent.id} agent={agent} onClick={() => onSelectAgent(agent.id)} />)}</div></aside>
}
function AgentRow({ agent, onClick }: { agent: TownAgent; onClick: () => void }) {
  return <button type="button" className={styles.agentRow} onClick={onClick}><span className={styles.avatarToken} style={{ '--agent-accent': agent.accent } as CSSProperties}>{agent.name.slice(0, 1)}</span><span className={styles.agentRowCopy}><strong>{agent.name}</strong><small>{agent.buildingName}</small></span><span className={`${styles.statusPill} ${styles[agent.status]}`}>{agent.status === 'completed' ? <Check size={11} /> : null}{STATUS_LABEL[agent.status]}</span></button>
}

