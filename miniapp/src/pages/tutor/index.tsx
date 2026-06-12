import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import AppHeader from '../../components/AppHeader'
import AppIcon from '../../components/AppIcon'
import AppTabBar from '../../components/AppTabBar'
import { createConversation, getRoles, requestTutorStream, uploadTutorFile } from '../../services/tutorApi'
import type { Citation, ConfidenceLevel, McpCall, TutorMessage, TutorRole, TutorStreamEvent, WorkshopPhase } from '../../types/tutor'
import { buildAskAiPrompt } from '../../utils/format'
import { consumeAskAiContext, getTutorDraft, setTutorDraft } from '../../utils/storage'
import './index.scss'

const defaultMessages: TutorMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: '你好，我是你的 AI 助学导师。直接提问即可，我会按照主平台 Tutor 的方式给你整理回答、引用和研讨会过程。',
    confidence: 'high',
    citations: [],
    workshop: [],
    mcpCalls: [],
  },
]

const modelOptions = ['Lite', 'Pro', 'Deep']

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`
}

function confidenceText(level?: ConfidenceLevel) {
  if (level === 'medium') return '中可信'
  if (level === 'low') return '低可信'
  return '高可信'
}

function confidenceClass(level?: ConfidenceLevel) {
  if (level === 'medium') return 'trust-badge--medium'
  if (level === 'low') return 'trust-badge--low'
  return 'trust-badge--high'
}

function confidenceDot(level?: ConfidenceLevel) {
  if (level === 'medium') return 'status-dot--orange'
  if (level === 'low') return 'status-dot--red'
  return 'status-dot--green'
}

function normalizeConfidence(event: TutorStreamEvent): ConfidenceLevel {
  const payload = event.payload as Record<string, unknown> | undefined
  const raw = String(payload?.level || payload?.confidence || payload?.label || '').toLowerCase()
  if (raw.includes('medium') || raw.includes('中')) return 'medium'
  if (raw.includes('low') || raw.includes('低')) return 'low'
  return 'high'
}

function assistantStateText(message: TutorMessage) {
  if (message.streaming) return '正在生成'
  if (message.error) return '请重试'
  return '已完成'
}

function workshopStateText(enabled: boolean) {
  return enabled ? '研讨会模式已开启' : '单导师回答'
}

function phaseLabel(item: WorkshopPhase) {
  return item.phase || item.role || '研讨阶段'
}

function phaseContent(item: WorkshopPhase) {
  return item.summary || item.content || item.role || item.phase || '研讨会过程更新'
}

function appendMessageUpdate(messageId: string, updater: (message: TutorMessage) => TutorMessage) {
  return (messages: TutorMessage[]) => messages.map((message) => (message.id === messageId ? updater(message) : message))
}

export default function TutorPage() {
  const initialDraft = useMemo(() => getTutorDraft(), [])
  const [roles, setRoles] = useState<TutorRole[]>([])
  const [currentRoleId, setCurrentRoleId] = useState<number | undefined>()
  const [conversationId, setConversationId] = useState<number | undefined>()
  const [messages, setMessages] = useState<TutorMessage[]>(defaultMessages)
  const [question, setQuestion] = useState('')
  const [modelName, setModelName] = useState(initialDraft?.modelName || 'Lite')
  const [workshopEnabled, setWorkshopEnabled] = useState(initialDraft?.workshopEnabled || false)
  const [mcpEnabled, setMcpEnabled] = useState(initialDraft?.mcpEnabled || false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(Boolean(initialDraft?.webSearchEnabled))
  const [imageModeEnabled, setImageModeEnabled] = useState(Boolean(initialDraft?.imageModeEnabled))
  const [trustModeEnabled, setTrustModeEnabled] = useState(initialDraft?.trustModeEnabled !== false)
  const [streaming, setStreaming] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [fileIds, setFileIds] = useState<number[]>([])
  const [recording, setRecording] = useState(false)
  const [expandedMessageId, setExpandedMessageId] = useState<string>('welcome')
  const pendingAskAi = useRef(false)

  const currentRole = useMemo(() => roles.find((role) => role.id === currentRoleId), [roles, currentRoleId])
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')

  useEffect(() => {
    if (!initialDraft) return
    setConversationId(initialDraft.conversationId)
    setCurrentRoleId(initialDraft.currentRoleId)
    setMessages(initialDraft.messages.length ? initialDraft.messages : defaultMessages)
    setQuestion(initialDraft.question)
    setModelName(initialDraft.modelName || 'Lite')
    setWorkshopEnabled(initialDraft.workshopEnabled)
    setMcpEnabled(initialDraft.mcpEnabled)
    setWebSearchEnabled(Boolean(initialDraft.webSearchEnabled))
    setImageModeEnabled(Boolean(initialDraft.imageModeEnabled))
    setTrustModeEnabled(initialDraft.trustModeEnabled !== false)
    setFileIds(initialDraft.fileIds)
  }, [initialDraft])

  useEffect(() => {
    getRoles()
      .then((items) => {
        const safeItems = Array.isArray(items) ? items : []
        setRoles(safeItems)
        if (!initialDraft?.currentRoleId && safeItems[0]?.id) {
          setCurrentRoleId(safeItems[0].id)
        }
      })
      .catch(() => {
        setRoles([])
      })

    const askAiContext = consumeAskAiContext()
    if (askAiContext && !pendingAskAi.current) {
      pendingAskAi.current = true
      setQuestion(buildAskAiPrompt(askAiContext))
    }
  }, [initialDraft?.currentRoleId])

  useEffect(() => {
    setTutorDraft({
      conversationId,
      currentRoleId,
      messages,
      question,
      modelName,
      workshopEnabled,
      mcpEnabled,
      webSearchEnabled,
      imageModeEnabled,
      trustModeEnabled,
      fileIds,
    })
  }, [conversationId, currentRoleId, fileIds, imageModeEnabled, mcpEnabled, messages, modelName, question, trustModeEnabled, webSearchEnabled, workshopEnabled])

  const patchAssistant = (messageId: string, event: TutorStreamEvent) => {
    if (event.type === 'text') {
      const payload = event.payload as Record<string, unknown> | undefined
      const content = String(payload?.content || '')
      if (!content) return
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, content: `${message.content}${content}` })))
      return
    }

    if (event.type === 'confidence') {
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, confidence: normalizeConfidence(event) })))
      return
    }

    if (event.type === 'citations' || event.type === 'sources') {
      const payload = event.payload as { items?: Citation[] } | Citation[] | undefined
      const items = Array.isArray(payload) ? payload : payload?.items || []
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, citations: items })))
      return
    }

    if (event.type === 'workshop_phase' || event.type === 'hub') {
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, workshop: [...(message.workshop || []), event.payload as WorkshopPhase] })))
      return
    }

    if (event.type === 'mcp_call') {
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, mcpCalls: [...(message.mcpCalls || []), event.payload as McpCall] })))
      return
    }

    if (event.type === 'trust_meta') {
      const payload = event.payload as { mcp_calls?: McpCall[] } | undefined
      if (Array.isArray(payload?.mcp_calls)) {
        setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, mcpCalls: payload.mcp_calls })))
      }
      return
    }

    if (event.type === 'error') {
      const payload = event.payload as { message?: string; detail?: string } | undefined
      const error = payload?.message || payload?.detail || 'AI 输出中断'
      setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, error, streaming: false })))
    }
  }

  const ensureConversation = async () => {
    if (conversationId) return conversationId
    try {
      const conversation = await createConversation('小程序 AI 助学', currentRoleId)
      if (conversation?.id) {
        setConversationId(conversation.id)
        return conversation.id
      }
    } catch {
      // Keep fallback behavior.
    }
    return undefined
  }

  const handleSend = async () => {
    const text = question.trim()
    if (!text || streaming) return

    const userMessage: TutorMessage = { id: nextId('user'), role: 'user', content: text }
    const assistantId = nextId('assistant')
    const assistantMessage: TutorMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
      confidence: 'high',
      citations: [],
      workshop: [],
      mcpCalls: [],
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setExpandedMessageId(assistantId)
    setQuestion('')
    setStreaming(true)

    try {
      const activeConversationId = await ensureConversation()
      await requestTutorStream({
        message: text,
        conversationId: activeConversationId,
        roleId: currentRoleId,
        fileIds,
        workshopEnabled,
        mcpEnabled,
        pageContext: {
          modes: {
            model: modelName,
            web_search: webSearchEnabled,
            image_mode: imageModeEnabled,
            trust_mode: trustModeEnabled,
          },
          attachments: {
            image_count: images.length,
            note: images.length ? '图片已附加到本次提问。' : undefined,
          },
        },
        onEvent: (event) => patchAssistant(assistantId, event),
      })
      setMessages(appendMessageUpdate(assistantId, (message) => ({ ...message, streaming: false })))
      setImages([])
      setFileIds([])
    } catch (err) {
      const error = err instanceof Error ? err.message : 'AI 连接失败'
      setMessages(appendMessageUpdate(assistantId, (message) => ({ ...message, streaming: false, error })))
      Taro.showToast({ title: '发送失败', icon: 'none' })
    } finally {
      setStreaming(false)
    }
  }

  const handleRoleSelect = () => {
    if (!roles.length) {
      Taro.showToast({ title: '暂无可选导师角色', icon: 'none' })
      return
    }
    Taro.showActionSheet({
      itemList: roles.slice(0, 6).map((role) => role.name || `导师 ${role.id}`),
      success: (res) => {
        const role = roles[res.tapIndex]
        if (role) setCurrentRoleId(role.id)
      },
    })
  }

  const handleModelSelect = () => {
    Taro.showActionSheet({
      itemList: modelOptions,
      success: (res) => {
        const model = modelOptions[res.tapIndex]
        if (model) setModelName(model)
      },
    })
  }

  const handleNewConversation = async () => {
    if (streaming) return
    setMessages(defaultMessages)
    setQuestion('')
    setImages([])
    setFileIds([])
    setImageModeEnabled(false)
    setExpandedMessageId('welcome')
    try {
      const conversation = await createConversation('新的学习对话', currentRoleId)
      setConversationId(conversation?.id)
      Taro.showToast({ title: '已新建对话', icon: 'success' })
    } catch {
      setConversationId(undefined)
      Taro.showToast({ title: '已清空当前对话', icon: 'none' })
    }
  }

  const handleVoice = () => {
    try {
      const recorder = Taro.getRecorderManager()
      if (recording) {
        recorder.stop()
        setRecording(false)
        return
      }
      recorder.onStop(() => {
        setRecording(false)
        setQuestion((value) => value || '请把刚才的语音转成文字后继续发送。')
        Taro.showToast({ title: '录音已完成', icon: 'none' })
      })
      recorder.start({ duration: 60000, format: 'mp3' })
      setRecording(true)
      Taro.showToast({ title: '开始录音', icon: 'none' })
    } catch {
      Taro.showToast({ title: '当前环境暂不支持录音', icon: 'none' })
    }
  }

  const handleImage = async () => {
    try {
      const res = await Taro.chooseImage({ count: 3, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      setImages((prev) => [...prev, ...res.tempFilePaths].slice(0, 3))
      setImageModeEnabled(true)
    } catch {
      // User cancellation is fine.
    }
  }

  const handleFile = async () => {
    let loadingShown = false
    try {
      const res = await Taro.chooseMessageFile({ count: 3, type: 'file' })
      Taro.showLoading({ title: '上传中' })
      loadingShown = true
      const uploaded = await Promise.all(res.tempFiles.map((file) => uploadTutorFile(file.path, file.name)))
      const ids = uploaded.map((item) => Number(item.file_id || item.id)).filter((id) => Number.isFinite(id))
      setFileIds((prev) => [...prev, ...ids])
      Taro.showToast({ title: ids.length ? '文件已加入' : '上传完成', icon: 'none' })
    } catch {
      Taro.showToast({ title: '文件上传失败', icon: 'none' })
    } finally {
      if (loadingShown) Taro.hideLoading()
    }
  }

  return (
    <View className='app-page tutor-page'>
      <AppHeader title='AI助学'>
        <View className='role-pill' hoverClass='tap-active' onClick={handleRoleSelect}>
          <View className='status-dot status-dot--violet' />
          <Text>{currentRole?.name || '默认导师'}</Text>
        </View>
        <View className='icon-button' hoverClass='tap-active' onClick={handleNewConversation}>
          <AppIcon name='plus' className='header-action-icon' />
        </View>
      </AppHeader>

      <ScrollView scrollX showScrollbar={false} className='mode-strip-scroll'>
        <View className='mode-strip'>
          <View className={`mode-pill ${workshopEnabled ? 'is-active' : ''}`} hoverClass='tap-active' onClick={() => setWorkshopEnabled((value) => !value)}>
            <AppIcon name='users' className='mode-pill__icon' />
            <Text>{workshopEnabled ? '研讨会开启' : '研讨会关闭'}</Text>
          </View>
          <View className='mode-pill mode-pill--static' hoverClass='tap-active' onClick={handleModelSelect}>
            <AppIcon name='sparkles' className='mode-pill__icon' />
            <Text>{modelName}</Text>
          </View>
          <View className={`mode-pill ${webSearchEnabled ? 'is-active' : ''}`} hoverClass='tap-active' onClick={() => setWebSearchEnabled((value) => !value)}>
            <AppIcon name='globe' className='mode-pill__icon' />
            <Text>联网搜索</Text>
          </View>
          <View className={`mode-pill ${mcpEnabled ? 'is-active' : ''}`} hoverClass='tap-active' onClick={() => setMcpEnabled((value) => !value)}>
            <AppIcon name='cpu' className='mode-pill__icon' />
            <Text>MCP模式</Text>
          </View>
          <View className={`mode-pill ${trustModeEnabled ? 'is-active' : ''}`} hoverClass='tap-active' onClick={() => setTrustModeEnabled((value) => !value)}>
            <AppIcon name='shield' className='mode-pill__icon' />
            <Text>可信模式</Text>
          </View>
          <View className={`mode-pill ${imageModeEnabled || images.length ? 'is-active' : ''}`} hoverClass='tap-active' onClick={handleImage}>
            <AppIcon name='image' className='mode-pill__icon' />
            <Text>图片模式</Text>
          </View>
        </View>
      </ScrollView>

      <View className='mode-hint'>
        <AppIcon name='bot' className='mode-hint__icon' />
        <Text className='mode-hint__text'>{workshopStateText(workshopEnabled)}</Text>
      </View>

      <ScrollView scrollY showScrollbar={false} className='tutor-scroll' scrollIntoView={lastAssistant?.id}>
        <View className='message-stack'>
          {messages.map((message) => (
            message.role === 'user' ? (
              <View key={message.id} id={message.id} className='message-row message-row--user'>
                <View className='message-bubble message-bubble--user'>
                  <Text>{message.content}</Text>
                </View>
              </View>
            ) : (
              <View key={message.id} id={message.id} className='assistant-message'>
                <View className='assistant-message__head'>
                  <View className='assistant-avatar'>
                    <AppIcon name='bot' className='assistant-avatar__icon' />
                  </View>
                  <View className='assistant-headline'>
                    <Text className='assistant-title'>智能导师</Text>
                    <Text className='assistant-subtitle'>{assistantStateText(message)}</Text>
                  </View>
                  <View className={`trust-badge ${confidenceClass(message.confidence)}`}>
                    <View className={`status-dot ${confidenceDot(message.confidence)}`} />
                    <Text>{confidenceText(message.confidence)}</Text>
                  </View>
                </View>

                <View className='assistant-card'>
                  <Text className='assistant-card__content'>{message.content || (message.streaming ? '正在整理回答...' : '暂无内容')}</Text>
                  {message.error ? <Text className='assistant-card__error'>{message.error}</Text> : null}
                </View>

                <View className='assistant-meta'>
                  <View className='assistant-meta__pill'>
                    <Text className='assistant-meta__label'>引用</Text>
                    <Text className='assistant-meta__value'>{message.citations?.length || 0}</Text>
                  </View>
                  <View className='assistant-meta__pill assistant-meta__pill--violet'>
                    <Text className='assistant-meta__label'>MCP</Text>
                    <Text className='assistant-meta__value'>{message.mcpCalls?.length || 0}</Text>
                  </View>
                  <View className='assistant-meta__pill assistant-meta__pill--slate'>
                    <Text className='assistant-meta__label'>研讨会</Text>
                    <Text className='assistant-meta__value'>{message.workshop?.length || 0}</Text>
                  </View>
                </View>

                {((message.citations?.length || 0) > 0 || (message.mcpCalls?.length || 0) > 0 || (message.workshop?.length || 0) > 0) ? (
                  <View className='details-panel'>
                    <View className='details-panel__head' onClick={() => setExpandedMessageId((value) => (value === message.id ? '' : message.id))}>
                      <Text className='details-panel__title'>回答依据与过程</Text>
                      <Text className='details-panel__state'>{expandedMessageId === message.id ? '收起' : '展开'}</Text>
                    </View>

                    {expandedMessageId === message.id ? (
                      <View className='details-panel__body'>
                        {(message.citations?.length || 0) > 0 ? (
                          <View className='detail-group'>
                            <Text className='detail-group__title'>引用来源</Text>
                            {message.citations?.slice(0, 4).map((item, index) => (
                              <View key={`${message.id}-citation-${index}`} className='detail-card'>
                                <Text className='detail-card__title'>{item.title || item.source || `引用 ${index + 1}`}</Text>
                                <Text className='detail-card__content'>{item.content || item.url || '暂无更多说明'}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        {(message.mcpCalls?.length || 0) > 0 ? (
                          <View className='detail-group'>
                            <Text className='detail-group__title'>工具调用</Text>
                            {message.mcpCalls?.slice(-3).map((item, index) => (
                              <View key={`${message.id}-mcp-${index}`} className='detail-card detail-card--compact'>
                                <Text className='detail-card__title'>{item.tool || item.name || 'MCP 调用'}</Text>
                                <Text className='detail-card__content'>{item.summary || item.status || item.result || '工具调用已完成'}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        {(message.workshop?.length || 0) > 0 ? (
                          <View className='detail-group'>
                            <Text className='detail-group__title'>研讨会轨迹</Text>
                            {message.workshop?.slice(-4).map((item, index) => (
                              <View key={`${message.id}-phase-${index}`} className='phase-item'>
                                <View className='phase-item__marker' />
                                <View className='phase-item__body'>
                                  <Text className='phase-item__title'>{phaseLabel(item)}</Text>
                                  <Text className='phase-item__content'>{phaseContent(item)}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          ))}
        </View>
      </ScrollView>

      <View className='composer'>
        {images.length || fileIds.length ? (
          <View className='attachment-strip'>
            {images.map((src) => <Image key={src} className='attachment-image' src={src} mode='aspectFill' />)}
            {fileIds.map((id) => <Text key={id} className='attachment-file'>文件 #{id}</Text>)}
          </View>
        ) : null}

        <View className='composer-main'>
          <Input
            className='question-input'
            value={question}
            placeholder='和 Tutor 对话，提任何学习问题...'
            placeholderClass='question-input__placeholder'
            disabled={streaming}
            onInput={(event) => setQuestion(event.detail.value)}
            confirmType='send'
            onConfirm={handleSend}
          />
          <View className='composer-action composer-action--add' hoverClass='tap-active' onClick={handleFile}>
            <AppIcon name='folder' className='composer-action__icon' />
          </View>
          <View className={`composer-action composer-action--voice ${recording ? 'is-on' : ''}`} hoverClass='tap-active' onClick={handleVoice}>
            <AppIcon name='mic' className='composer-action__icon' />
          </View>
          <View className={`composer-action composer-action--send ${streaming || !question.trim() ? 'is-disabled' : ''}`} hoverClass='tap-active' onClick={handleSend}>
            <AppIcon name='send' className='composer-action__icon composer-action__icon--light' />
          </View>
        </View>

        <ScrollView scrollX showScrollbar={false} className='composer-options'>
          <View className='option-strip'>
            <View className='option-chip option-chip--model' hoverClass='tap-active' onClick={handleModelSelect}>
              <AppIcon name='sparkles' className='option-chip__icon' />
              <Text>{modelName}</Text>
            </View>
            <View className={`option-chip ${webSearchEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setWebSearchEnabled((value) => !value)}>
              <AppIcon name='globe' className='option-chip__icon' />
              <Text>联网搜索</Text>
            </View>
            <View className={`option-chip ${mcpEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setMcpEnabled((value) => !value)}>
              <AppIcon name='cpu' className='option-chip__icon' />
              <Text>MCP模式</Text>
            </View>
            <View className={`option-chip ${workshopEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setWorkshopEnabled((value) => !value)}>
              <AppIcon name='users' className='option-chip__icon' />
              <Text>研讨会模式</Text>
            </View>
            <View className={`option-chip ${imageModeEnabled || images.length ? 'is-on' : ''}`} hoverClass='tap-active' onClick={handleImage}>
              <AppIcon name='image' className='option-chip__icon' />
              <Text>图片模式</Text>
            </View>
            <View className={`option-chip ${trustModeEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setTrustModeEnabled((value) => !value)}>
              <AppIcon name='shield' className='option-chip__icon' />
              <Text>可信模式</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      <AppTabBar current='tutor' />
    </View>
  )
}
