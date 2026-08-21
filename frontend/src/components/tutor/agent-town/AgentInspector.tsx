import { Bot, ChevronDown, MapPin, RadioTower } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { TownAgent } from './types'
import styles from './AgentTown.module.css'

export function AgentInspector({ agent }: { agent?: TownAgent }) {
  if (!agent) return <aside className={styles.inspector}><p className={styles.muted}>选择一个 Agent 查看详情。</p></aside>
  return <aside className={styles.inspector}><div className={styles.eyebrow}>AGENT INSPECTOR</div><div className={styles.inspectorIdentity}><div className={styles.largeAvatar} style={{ '--agent-accent': agent.accent } as CSSProperties}><Bot /></div><div><h2>{agent.name}</h2><span className={`${styles.liveStatus} ${styles[agent.status]}`}>● {agent.status === 'working' ? '正在工作' : agent.status === 'completed' ? '已完成' : agent.status === 'error' ? '异常' : '等待中'}</span></div></div><dl className={styles.detailGrid}><div><dt><MapPin size={12} /> 工作区域</dt><dd>{agent.buildingName}</dd></div><div><dt><RadioTower size={12} /> 当前轮次</dt><dd>{agent.round ? `Round ${agent.round}` : '尚未开始'}</dd></div><div className={styles.detailWide}><dt>职责</dt><dd>{agent.duty}</dd></div></dl><section className={styles.activityBox}><span>CURRENT ACTIVITY</span><p>{agent.activity}</p></section><section className={styles.outputBox}><span>LATEST OUTPUT</span><p>{agent.latestOutput ? `${agent.latestOutput.slice(0, 110)}${agent.latestOutput.length > 110 ? '…' : ''}` : '尚无输出'}</p>{agent.latestOutput ? <details><summary>查看详细输出 <ChevronDown size={13} /></summary><div>{agent.latestOutput}</div></details> : null}</section></aside>
}

