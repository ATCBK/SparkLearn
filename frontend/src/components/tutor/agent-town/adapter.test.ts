import { describe, expect, it } from 'vitest'

import { createInitialTownState, reduceTownEvent } from './adapter'

describe('AgentTownAdapter', () => {
  it('registers system and custom agents from workshop metadata', () => {
    const state = reduceTownEvent(createInitialTownState(), {
      type: 'workshop_meta',
      payload: {
        enabled: true,
        complexity: 'complex',
        rounds: 2,
        participants: [
          { id: 'profile-agent', name: '画像分析师', kind: 'system' },
          { id: 'role-18', name: '苏格拉底导师', kind: 'custom' },
        ],
      },
    })

    expect(state.agents.map((agent) => agent.id)).toEqual(['profile-agent', 'role-18'])
    expect(state.agents[1]).toMatchObject({ buildingName: '协作中心', status: 'waiting' })
    expect(state.totalRounds).toBe(2)
  })

  it('maps streaming hub output to a working agent with a short activity', () => {
    const initial = createInitialTownState([
      { id: 'challenger', name: '质疑者', kind: 'system' },
    ])
    const state = reduceTownEvent(initial, {
      type: 'hub',
      payload: {
        phase: 'discussion',
        round: 1,
        agentId: 'challenger',
        agentName: '质疑者',
        agentKind: 'system',
        content: '当前方案存在三个需要继续核对的边界条件与风险点。',
        timestamp: '2026-08-20T08:34:34.000Z',
        delta: true,
      },
    })

    expect(state.selectedAgentId).toBe('challenger')
    expect(state.agents[0].status).toBe('working')
    expect(state.agents[0].activity).toBe('当前方案存在三个需要继续核对的边界条件…')
    expect(state.timeline).toHaveLength(0)
  })

  it('marks a completed hub turn and appends only one timeline event', () => {
    const initial = createInitialTownState([
      { id: 'coach', name: '行动教练', kind: 'system' },
    ])
    const event = {
      type: 'hub' as const,
      payload: {
        phase: 'discussion',
        round: 1,
        agentId: 'coach',
        agentName: '行动教练',
        agentKind: 'system',
        content: '已经整理出三项可执行学习行动。',
        timestamp: '2026-08-20T08:34:42.000Z',
        delta: false,
      },
    }
    const once = reduceTownEvent(initial, event)
    const twice = reduceTownEvent(once, event)

    expect(twice.agents[0].status).toBe('completed')
    expect(twice.timeline).toHaveLength(1)
    expect(twice.timeline[0]).toMatchObject({ agentId: 'coach', round: 1 })
  })

  it('activates synthesis and completes the entire town', () => {
    const synthesis = reduceTownEvent(createInitialTownState(), {
      type: 'workshop_phase',
      payload: { phase: 'synthesis', status: 'running' },
    })
    const completed = reduceTownEvent(synthesis, { type: 'done' })

    expect(synthesis.phase).toBe('synthesis')
    expect(synthesis.selectedAgentId).toBe('final-answer-agent')
    expect(completed.taskStatus).toBe('completed')
    expect(completed.agents.every((agent) => agent.status === 'completed')).toBe(true)
  })

  it('registers an unknown hub agent instead of dropping it', () => {
    const state = reduceTownEvent(createInitialTownState([]), {
      type: 'hub',
      payload: {
        phase: 'discussion',
        round: 1,
        agentId: 'custom-9',
        agentName: '类比教学导师',
        agentKind: 'custom',
        content: '正在寻找直观类比。',
        timestamp: '2026-08-20T08:35:00.000Z',
        delta: true,
      },
    })

    expect(state.agents[0]).toMatchObject({
      id: 'custom-9',
      buildingName: '协作中心',
      status: 'working',
    })
  })
})
