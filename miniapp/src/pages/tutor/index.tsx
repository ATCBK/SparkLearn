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
    content: '你好，我是你的 AI 助学导师。你可以直接提问，我会整理回答、引用来源和研讨过程。',
    confidence: 'high',
    citations: [],
    workshop: [],
    mcpCalls: [],
  },
]

const modelOptions = ['Lite', 'Pro', 'Deep']
const quickQuestions = [
  '帮我梳理这章最重要的 3 个知识点',
  '根据我现在的情况推荐今天先学什么',
  '把这个知识点讲到我能马上做题',
  '给我 3 个最容易混淆的考点提醒',
]

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`
}

function normalizeConfidence(event: TutorStreamEvent): ConfidenceLevel {
  const payload = event.payload as Record<string, unknown> | undefined
  const raw = String(payload?.level || payload?.confidence || payload?.label || '').toLowerCase()
  if (raw.includes('medium') || raw.includes('中')) return 'medium'
  if (raw.includes('low') || raw.includes('低')) return 'low'
  return 'high'
}

function phaseLabel(item: WorkshopPhase) {
  return item.phase || item.role || '研讨阶段'
}

function phaseContent(item: WorkshopPhase) {
  return item.summary || item.content || item.role || item.phase || '研讨过程更新'
}

function appendMessageUpdate(messageId: string, updater: (message: TutorMessage) => TutorMessage) {
  return (messages: TutorMessage[]) => messages.map((message) => (message.id === messageId ? updater(message) : message))
}

function hasEvidence(message: TutorMessage) {
  return Boolean(message.citations?.length || message.mcpCalls?.length || message.workshop?.length)
}

function assistantContent(message: TutorMessage) {
  if (message.content) return message.content
  if (message.streaming) return '正在整理回答...'
  return '暂无内容'
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
  const conversationMessages = useMemo(() => messages.filter((message) => message.id !== 'welcome'), [messages])
  const hasConversationMessages = conversationMessages.length > 0
  const lastAssistant = [...conversationMessages].reverse().find((message) => message.role === 'assistant')

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

  const handleSendWithText = async (rawText: string) => {
    const text = rawText.trim()
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

  const handleSend = async () => {
    await handleSendWithText(question)
  }

  const handleQuickQuestionAsk = async (text: string) => {
    await handleSendWithText(text)
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

      {hasConversationMessages ? (
        <ScrollView scrollY showScrollbar={false} className='tutor-scroll' scrollIntoView={lastAssistant?.id}>
          <View className='message-stack'>
            {conversationMessages.map((message) =>
              message.role === 'user' ? (
                <View key={message.id} id={message.id} className='message-row message-row--user'>
                  <View className='message-bubble message-bubble--user'>
                    <Text>{message.content}</Text>
                  </View>
                </View>
              ) : (
                <View key={message.id} id={message.id} className='assistant-message'>
                  <Text className='assistant-message__content'>{assistantContent(message)}</Text>
                  {message.error ? <Text className='assistant-message__error'>{message.error}</Text> : null}

                  {hasEvidence(message) ? (
                    <View className='assistant-evidence'>
                      <View className='assistant-evidence__summary' onClick={() => setExpandedMessageId((value) => (value === message.id ? '' : message.id))}>
                        <Text className='assistant-evidence__summary-text'>... 查看检索与调用过程</Text>
                        <Text className='assistant-evidence__summary-action'>{expandedMessageId === message.id ? '收起' : '展开'}</Text>
                      </View>

                      {expandedMessageId === message.id ? (
                        <View className='assistant-evidence__body'>
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
              ),
            )}
          </View>
        </ScrollView>
      ) : (
        <View className='tutor-empty-state'>
          <View className='tutor-empty-state__hero'>
            <View className='tutor-empty-state__badge'>
              <AppIcon name='sparkles' className='tutor-empty-state__badge-icon' />
            </View>
            <Text className='tutor-empty-state__title'>AI助学</Text>
            <Text className='tutor-empty-state__subtitle'>直接提问，或点一个快捷问题马上开始。</Text>
          </View>

          <View className='quick-question-list'>
            {quickQuestions.map((item) => (
              <View key={item} className='quick-question-chip' hoverClass='tap-active' onClick={() => void handleQuickQuestionAsk(item)}>
                <Text>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className='composer'>
        {images.length || fileIds.length ? (
          <View className='attachment-strip'>
            {images.map((src) => <Image key={src} className='attachment-image' src={src} mode='aspectFill' />)}
            {fileIds.map((id) => <Text key={id} className='attachment-file'>文件 #{id}</Text>)}
          </View>
        ) : null}

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
              <Text>研讨会</Text>
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

        <View className='composer-main'>
          <Input
            className='question-input'
            value={question}
            placeholder='发送消息或按住说话...'
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
      </View>

      <AppTabBar current='tutor' />
    </View>
  )
}
