'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Expand, Minimize2, Radio } from 'lucide-react'
import type { WorkshopHubEvent } from '@/lib/api'
import { createInitialTownState, getPhaseLabel, reduceTownEvent } from './adapter'
import { DEFAULT_PARTICIPANTS } from './config'
import { AgentInspector } from './AgentInspector'
import { AgentStatusPanel } from './AgentStatusPanel'
import { AgentTimeline } from './AgentTimeline'
import { AgentTownScene } from './AgentTownScene'
import type { WorkshopMetaPayload, WorkshopParticipant, WorkshopPhasePayload } from './types'
import styles from './AgentTown.module.css'

export function AgentTownWorkspace({ topic, hubEvents, workshopMeta, workshopPhase, previewParticipants, started, streaming, completed, error }: { topic: string; hubEvents: WorkshopHubEvent[]; workshopMeta: WorkshopMetaPayload | null; workshopPhase: WorkshopPhasePayload | null; previewParticipants: WorkshopParticipant[]; started: boolean; streaming: boolean; completed: boolean; error: string }) {
  const state = useMemo(() => {
    const participants = workshopMeta?.participants ?? [
      ...DEFAULT_PARTICIPANTS,
      ...previewParticipants.filter((participant) => !DEFAULT_PARTICIPANTS.some((item) => item.id === participant.id)),
    ]
    let next = createInitialTownState(participants)
    if (workshopMeta) next = reduceTownEvent(next, { type: 'workshop_meta', payload: workshopMeta })
    if (started && workshopPhase) next = reduceTownEvent(next, { type: 'workshop_phase', payload: workshopPhase })
    for (const event of hubEvents) next = reduceTownEvent(next, { type: 'hub', payload: event })
    if (error) next = reduceTownEvent(next, { type: 'error', message: error })
    if (completed) next = reduceTownEvent(next, { type: 'done' })
    return next
  }, [completed, error, hubEvents, previewParticipants, started, workshopMeta, workshopPhase])
  const [manualSelection, setManualSelection] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const mapRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === mapRef.current)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  async function toggleFullscreen() {
    if (document.fullscreenElement === mapRef.current) {
      await document.exitFullscreen()
      return
    }
    await mapRef.current?.requestFullscreen()
  }

  const selectedAgentId = manualSelection || state.selectedAgentId
  const selectedAgent = state.agents.find((agent) => agent.id === selectedAgentId) ?? state.agents[0]
  return <div className={styles.workspace}><div className={styles.townHeader}><div><span className={styles.brandMark}>SL</span><div><strong>SparkLearn Agent Town</strong><small>{getPhaseLabel(state.phase, state.round, state.totalRounds)}</small></div></div><div className={styles.runState} data-active={streaming}>{completed ? <CheckCircle2 size={15} /> : <Radio size={15} />}{completed ? 'MULTI-AGENT TASK COMPLETED' : streaming ? 'LIVE WORKSHOP' : 'STANDBY'}</div></div><div className={styles.mainGrid}><AgentStatusPanel state={state} topic={topic} onSelectAgent={setManualSelection} /><main ref={mapRef} className={styles.mapPanel}><div className={styles.mapToolbar}><span>AI WORK TOWN / LIVE MAP</span><div className={styles.mapToolbarRight}><span>{state.agents.filter((agent) => agent.status === 'working').length} ACTIVE</span><button type="button" className={styles.fullscreenButton} onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? '退出全屏' : '全屏显示小镇'} title={isFullscreen ? '退出全屏' : '全屏显示小镇'}>{isFullscreen ? <Minimize2 size={13} /> : <Expand size={13} />}{isFullscreen ? '退出全屏' : '全屏'}</button></div></div><AgentTownScene agents={state.agents} selectedAgentId={selectedAgentId} onSelectAgent={setManualSelection} />{completed ? <div className={styles.completionBanner}><CheckCircle2 />任务完成 · 中央调度中心已生成最终综合</div> : null}</main><AgentInspector agent={selectedAgent} /></div><AgentTimeline events={state.timeline} onSelectAgent={setManualSelection} /></div>
}
export type { WorkshopMetaPayload, WorkshopPhasePayload } from './types'
