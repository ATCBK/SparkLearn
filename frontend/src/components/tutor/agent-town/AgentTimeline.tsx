import type { TownTimelineEvent } from './types'
import styles from './AgentTown.module.css'

export function AgentTimeline({ events, onSelectAgent }: { events: TownTimelineEvent[]; onSelectAgent: (id: string) => void }) {
  return <section className={styles.timeline}><div className={styles.timelineLabel}>EVENT TIMELINE</div><div className={styles.timelineTrack}>{events.length === 0 ? <span className={styles.timelineEmpty}>实时事件将在这里依次出现</span> : null}{events.slice(-8).map((event) => <button type="button" key={event.id} className={styles.timelineEvent} onClick={() => onSelectAgent(event.agentId)}><time>{formatTime(event.timestamp)}</time><strong>{event.agentName}</strong><span>{event.summary}</span></button>)}</div></section>
}
function formatTime(timestamp: string) { return timestamp ? new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false }) : '--:--:--' }

