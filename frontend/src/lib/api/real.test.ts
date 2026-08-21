import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateResource, generateTutorVideo, generateVideo, getChatHistory } from './real'


describe('getChatHistory', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('恢复历史消息中持久化的视频资源卡片', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: [
        {
          id: 42,
          role: 'assistant',
          content: '视频已生成，可以直接在下方播放。',
          timestamp: '2026-08-20T12:00:00Z',
          conversation_id: 7,
          video_resource: {
            id: 'video_history_1',
            title: '闭包讲解',
            type: 'video',
            status: 'completed',
            created_at: '2026-08-20T12:00:00Z',
            video_url: '/api/video/resources/video_history_1/download/mp4',
            audio_url: '/api/video/resources/video_history_1/download/audio',
            subtitle_url: '/api/video/resources/video_history_1/download/srt',
            timeline_url: '/api/video/resources/video_history_1/timeline',
            scene_url: '/api/video/resources/video_history_1/scene',
            has_mp4: true,
          },
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    const history = await getChatHistory(7)

    expect(history).toHaveLength(1)
    expect(history[0].videoResource).toEqual(expect.objectContaining({
      id: 'video_history_1',
      title: '闭包讲解',
      type: 'video',
      status: 'completed',
      hasMp4: true,
      videoUrl: 'http://127.0.0.1:8000/api/video/resources/video_history_1/download/mp4',
      sceneUrl: 'http://127.0.0.1:8000/api/video/resources/video_history_1/scene',
    }))
  })

  it('Tutor 视频任务携带原会话上下文交给后端持久化', async () => {
    let videoJobBody: Record<string, unknown> | null = null
    let createdConversationId: number | undefined
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/video/polish')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            polish_id: 'polish_1',
            title: '闭包讲解',
            polished_prompt: '用动画讲解闭包',
            script_outline: [{ segment_id: 's1', title: '闭包', narration: '闭包讲解', visual_hint: '代码' }],
            estimated_duration_sec: 90,
            voice: 'longxiaochun',
            style_id: 'apple-minimal',
            style_name: '极简',
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/api/video/jobs')) {
        videoJobBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
        return new Response(JSON.stringify({
          success: true,
          data: {
            job_id: 'job_1',
            resource_id: 'video_1',
            conversation_id: 23,
            status: 'queued',
            events_url: '/api/video/jobs/job_1/events',
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/api/video/jobs/job_1/events')) {
        return new Response('data: {"type":"done","payload":{"resource_id":"video_1"}}\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }
      if (url.endsWith('/api/video/resources/video_1')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: 'video_1',
            title: '闭包讲解',
            type: 'video',
            status: 'completed',
            created_at: '2026-08-20T12:00:00Z',
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`未处理的测试请求：${url}`)
    }))

    const result = await generateTutorVideo(
      '用视频讲解 Python 闭包',
      {
        conversationId: 7,
        roleId: 3,
        message: '用视频讲解 Python 闭包',
      },
      {
        onConversationCreated: (conversationId) => {
          createdConversationId = conversationId
        },
      },
    )

    expect(videoJobBody).toEqual(expect.objectContaining({
      tutor_context: {
        conversation_id: 7,
        role_id: 3,
        message: '用视频讲解 Python 闭包',
      },
    }))
    expect(createdConversationId).toBe(23)
    expect(result.conversationId).toBe(23)
    expect(result.resource.id).toBe('video_1')
  })

  it('后台视频事件返回失败时拒绝成功通知且不再拉取资源', async () => {
    const requestedUrls: string[] = []
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url.endsWith('/api/video/polish')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            polish_id: 'polish_failed',
            title: '失败视频',
            polished_prompt: '生成一个失败视频',
            script_outline: [],
            estimated_duration_sec: 90,
            voice: 'longxiaochun',
            style_id: 'apple-minimal',
            style_name: '极简',
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/api/video/jobs')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            job_id: 'job_failed',
            resource_id: 'video_failed',
            status: 'queued',
            events_url: '/api/video/jobs/job_failed/events',
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/api/video/jobs/job_failed/events')) {
        return new Response('data: {"type":"error","payload":{"message":"渲染器不可用"}}\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }
      throw new Error(`失败事件后不应继续请求：${url}`)
    }))

    await expect(generateVideo('生成一个失败视频')).rejects.toThrow('渲染器不可用')
    expect(requestedUrls.some((url) => url.endsWith('/api/video/resources/video_failed'))).toBe(false)
  })

  it('SSE 传输中断后重连同一任务并读取最终成功资源', async () => {
    let eventRequests = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/video/polish')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            polish_id: 'polish_reconnect',
            title: '断线恢复视频',
            polished_prompt: '断线后继续生成',
            script_outline: [],
            estimated_duration_sec: 90,
            voice: 'longxiaochun',
            style_id: 'apple-minimal',
            style_name: '极简',
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/api/video/jobs')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            job_id: 'job_reconnect',
            resource_id: 'video_reconnect',
            status: 'queued',
            events_url: '/api/video/jobs/job_reconnect/events',
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/api/video/jobs/job_reconnect/events')) {
        eventRequests += 1
        if (eventRequests === 1) {
          return new Response(new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('data: {"type":"progress","payload":{"progress":42}}\n\n'))
              controller.error(new Error('连接被代理中断'))
            },
          }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
        }
        return new Response('data: {"type":"done","payload":{"resource_id":"video_reconnect"}}\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }
      if (url.endsWith('/api/video/resources/video_reconnect')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: 'video_reconnect',
            title: '断线恢复视频',
            type: 'video',
            status: 'completed',
            created_at: '2026-08-20T12:00:00Z',
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`未处理的测试请求：${url}`)
    }))

    const resource = await generateVideo('断线后继续生成')

    expect(eventRequests).toBe(2)
    expect(resource.id).toBe('video_reconnect')
    expect(resource.status).toBe('completed')
  })

  it('非视频后台生成请求携带当前用户令牌', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === 'sparklearn_token' ? 'user-a-token' : null,
    })
    let authorizationHeader = ''
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_input: string | URL | Request, init?: RequestInit) => {
      authorizationHeader = new Headers(init?.headers).get('Authorization') || ''
      return new Response('data: {"type":"done","payload":{"resource":{"id":"doc_1","title":"文档","type":"document","status":"completed","created_at":"2026-08-20T12:00:00Z"}}}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }))

    const resource = await generateResource('document', '生成认证文档')

    expect(authorizationHeader).toBe('Bearer user-a-token')
    expect(resource.id).toBe('doc_1')
  })
})
