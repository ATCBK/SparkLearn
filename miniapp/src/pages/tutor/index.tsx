import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import AppHeader from '../../components/AppHeader'
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
    content: '你好，我是你的 AI 助学导师。可以直接提问，也可以从刷题结果带题目来让我讲解。',
    confidence: 'high',
    citations: [],
    workshop: [],
    mcpCalls: []
  }
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
  const raw = String((event.payload as any)?.level || (event.payload as any)?.confidence || (event.payload as any)?.label || '').toLowerCase()
  if (raw.includes('medium') || raw.includes('中')) return 'medium'
  if (raw.includes('low') || raw.includes('低')) return 'low'
  return 'high'
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
  const [workshopEnabled, setWorkshopEnabled] = useState(true)
  const [mcpEnabled, setMcpEnabled] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [imageModeEnabled, setImageModeEnabled] = useState(false)
  const [trustModeEnabled, setTrustModeEnabled] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [fileIds, setFileIds] = useState<number[]>([])
  const [recording, setRecording] = useState(false)
  const [workshopOpen, setWorkshopOpen] = useState(true)
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
  }, [])

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
      fileIds
    })
  }, [conversationId, currentRoleId, fileIds, imageModeEnabled, mcpEnabled, messages, modelName, question, trustModeEnabled, webSearchEnabled, workshopEnabled])

  const patchAssistant = (messageId: string, event: TutorStreamEvent) => {
    if (event.type === 'text') {
      const content = String((event.payload as any)?.content || '')
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
      const calls = (event.payload as any)?.mcp_calls
      if (Array.isArray(calls)) {
        setMessages(appendMessageUpdate(messageId, (message) => ({ ...message, mcpCalls: calls })))
      }
      return
    }

    if (event.type === 'error') {
      const error = (event.payload as any)?.message || (event.payload as any)?.detail || 'AI 输出中断'
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
      // Chat can still work with the backend default conversation behavior.
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
      mcpCalls: []
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
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
            trust_mode: trustModeEnabled
          },
          attachments: {
            image_count: images.length,
            note: images.length ? '图片仅作本地附件预览，未进入 AI 视觉理解。' : undefined
          }
        },
        onEvent: (event) => patchAssistant(assistantId, event)
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
      }
    })
  }

  const handleModelSelect = () => {
    Taro.showActionSheet({
      itemList: modelOptions,
      success: (res) => {
        const model = modelOptions[res.tapIndex]
        if (model) setModelName(model)
      }
    })
  }

  const handleNewConversation = async () => {
    if (streaming) return
    setMessages(defaultMessages)
    setQuestion('')
    setImages([])
    setFileIds([])
    setImageModeEnabled(false)
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
        setQuestion((value) => value || '请把刚才的语音识别文本填在这里。')
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

  const handleSkillsStore = () => {
    Taro.showToast({ title: 'Skills 商店即将开放', icon: 'none' })
  }

  const handleFile = async () => {
    let loadingShown = false
    try {
      const res = await Taro.chooseMessageFile({ count: 3, type: 'file' })
      Taro.showLoading({ title: '上传中' })
      loadingShown = true
      const uploaded = await Promise.all(
        res.tempFiles.map((file) => uploadTutorFile(file.path, file.name))
      )
      const ids = uploaded.map((item) => Number(item.file_id || item.id)).filter((id) => Number.isFinite(id))
      setFileIds((prev) => [...prev, ...ids])
      Taro.showToast({ title: ids.length ? '文件已添加' : '上传完成', icon: 'none' })
    } catch {
      Taro.showToast({ title: '文件上传失败', icon: 'none' })
    } finally {
      if (loadingShown) {
        Taro.hideLoading()
      }
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
          <Text>+</Text>
        </View>
      </AppHeader>

      <ScrollView scrollY enhanced showScrollbar={false} className='tutor-scroll' scrollIntoView={lastAssistant?.id}>
        <View className='message-stack'>
          {messages.map((message) => (
            message.role === 'user' ? (
              <View key={message.id} id={message.id} className='message-row message-row--user'>
                <View className='message-bubble message-bubble--user'>
                  <Text>{message.content}</Text>
                </View>
              </View>
            ) : (
              <View key={message.id} id={message.id} className='ai-answer'>
                <View className='answer-head'>
                  <View className='avatar-mini avatar-mini--ai'>
                    <Text>AI</Text>
                  </View>
                  <View className='answer-title'>
                    <Text className='section-title'>综合回答</Text>
                    <Text className='section-subtitle'>{message.streaming ? '正在流式输出' : message.error ? '可保留内容后重试' : '已完成'}</Text>
                  </View>
                  <View className={`trust-badge ${confidenceClass(message.confidence)}`}>
                    <View className={`status-dot ${confidenceDot(message.confidence)}`} />
                    <Text>{confidenceText(message.confidence)}</Text>
                  </View>
                </View>

                <View className='answer-card'>
                  <Text className='answer-text'>{message.content || (message.streaming ? '正在整理回答...' : '暂无内容')}</Text>
                  {message.error ? <Text className='answer-error'>{message.error}</Text> : null}
                </View>

                <View className='meta-strip'>
                  <View className='meta-chip'>
                    <Text className='meta-chip__label'>引用</Text>
                    <Text className='meta-chip__value'>{message.citations?.length || 0}</Text>
                  </View>
                  <View className='meta-chip meta-chip--violet'>
                    <Text className='meta-chip__label'>MCP 工具</Text>
                    <Text className='meta-chip__value'>{message.mcpCalls?.length || 0} 个</Text>
                  </View>
                </View>

                {(message.workshop?.length || 0) > 0 ? (
                  <View className='workshop-panel'>
                    <View className='panel-head' onClick={() => setWorkshopOpen((value) => !value)}>
                      <Text className='panel-title'>多角色研讨</Text>
                      <Text className='panel-state'>{workshopOpen ? '收起' : '展开'}</Text>
                    </View>
                    {workshopOpen ? message.workshop?.slice(-4).map((item, index) => (
                      <View key={`${message.id}-phase-${index}`} className='phase-row'>
                        <View className='phase-dot' />
                        <Text>{item.summary || item.content || item.phase || item.role || '研讨阶段更新'}</Text>
                      </View>
                    )) : null}
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
            placeholder='和 AI 对话，提任何学习问题...'
            placeholderClass='question-input__placeholder'
            disabled={streaming}
            onInput={(event) => setQuestion(event.detail.value)}
            confirmType='send'
            onConfirm={handleSend}
          />
          <View className='composer-action composer-action--add' hoverClass='tap-active' onClick={handleFile}>
            <Text>+</Text>
          </View>
          <View className={`composer-action composer-action--voice ${recording ? 'is-on' : ''}`} hoverClass='tap-active' onClick={handleVoice}>
            <View className='action-glyph action-glyph--voice' />
          </View>
          <View className={`composer-action composer-action--send ${streaming || !question.trim() ? 'is-disabled' : ''}`} hoverClass='tap-active' onClick={handleSend}>
            <View className='action-glyph action-glyph--send' />
          </View>
        </View>
        <ScrollView scrollX enhanced showScrollbar={false} className='composer-options'>
          <View className='option-strip'>
            <View className='option-chip option-chip--model' hoverClass='tap-active' onClick={handleModelSelect}>
              <Text>{modelName}</Text>
              <View className='chip-chevron' />
            </View>
            <View className='option-chip' hoverClass='tap-active' onClick={handleSkillsStore}>
              <View className='chip-glyph chip-glyph--skills' />
              <Text>Skills 商店</Text>
            </View>
            <View className={`option-chip ${webSearchEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setWebSearchEnabled((value) => !value)}>
              <View className='chip-glyph chip-glyph--web' />
              <Text>联网搜索</Text>
            </View>
            <View className={`option-chip ${mcpEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setMcpEnabled((value) => !value)}>
              <View className='chip-glyph chip-glyph--mcp' />
              <Text>MCP 模式</Text>
            </View>
            <View className={`option-chip ${workshopEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setWorkshopEnabled((value) => !value)}>
              <View className='chip-glyph chip-glyph--knowledge' />
              <Text>知识逆构</Text>
            </View>
            <View className={`option-chip ${imageModeEnabled || images.length ? 'is-on' : ''}`} hoverClass='tap-active' onClick={handleImage}>
              <View className='chip-glyph chip-glyph--image' />
              <Text>图片模式</Text>
            </View>
            <View className={`option-chip ${trustModeEnabled ? 'is-on' : ''}`} hoverClass='tap-active' onClick={() => setTrustModeEnabled((value) => !value)}>
              <View className='chip-glyph chip-glyph--trust' />
              <Text>可信模式</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      <AppTabBar current='tutor' />
    </View>
  )
}
