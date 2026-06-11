'use client'

import { useReducer, useCallback } from 'react'

export type DHState = 'idle' | 'loading_memory' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'error'

export interface DHMessage {
  role: 'user' | 'assistant'
  content: string
}

interface DHStateData {
  state: DHState
  currentVideoId: string | null
  currentVideoTitle: string | null
  currentMemoryId: string | null
  messages: DHMessage[]
  error: string | null
}

type DHAction =
  | { type: 'START_LOAD_MEMORY'; videoId: string }
  | { type: 'MEMORY_LOADED'; videoId: string; title: string; memoryId: string; greeting: string }
  | { type: 'MEMORY_LOAD_ERROR'; error: string }
  | { type: 'START_LISTENING' }
  | { type: 'STOP_LISTENING' }
  | { type: 'START_THINKING'; userMessage: string }
  | { type: 'RECEIVE_TOKEN'; token: string }
  | { type: 'START_SPEAKING' }
  | { type: 'DONE_SPEAKING' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RETRY' }

const initialState: DHStateData = {
  state: 'idle',
  currentVideoId: null,
  currentVideoTitle: null,
  currentMemoryId: null,
  messages: [],
  error: null,
}

function reducer(state: DHStateData, action: DHAction): DHStateData {
  switch (action.type) {
    case 'START_LOAD_MEMORY':
      return {
        ...state,
        state: 'loading_memory',
        currentVideoId: action.videoId,
        messages: [],
        error: null,
      }

    case 'MEMORY_LOADED':
      return {
        ...state,
        state: 'ready',
        currentVideoId: action.videoId,
        currentVideoTitle: action.title,
        currentMemoryId: action.memoryId,
        messages: [{ role: 'assistant', content: action.greeting }],
        error: null,
      }

    case 'MEMORY_LOAD_ERROR':
      return {
        ...state,
        state: 'error',
        error: action.error,
      }

    case 'START_LISTENING':
      return { ...state, state: 'listening' }

    case 'STOP_LISTENING':
      return { ...state, state: 'ready' }

    case 'START_THINKING':
      return {
        ...state,
        state: 'thinking',
        messages: [...state.messages, { role: 'user', content: action.userMessage }],
        error: null,
      }

    case 'RECEIVE_TOKEN': {
      const msgs = [...state.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant') {
        last.content += action.token
      } else {
        msgs.push({ role: 'assistant', content: action.token })
      }
      return { ...state, state: 'thinking', messages: msgs }
    }

    case 'START_SPEAKING':
      return { ...state, state: 'speaking' }

    case 'DONE_SPEAKING':
      return { ...state, state: 'ready' }

    case 'SET_ERROR':
      return { ...state, state: 'error', error: action.error }

    case 'RETRY':
      return { ...state, state: 'ready', error: null }

    default:
      return state
  }
}

export function useDigitalHuman() {
  const [data, dispatch] = useReducer(reducer, initialState)

  const loadMemory = useCallback((videoId: string) => {
    dispatch({ type: 'START_LOAD_MEMORY', videoId })
  }, [])

  const onMemoryLoaded = useCallback((videoId: string, title: string, memoryId: string, greeting: string) => {
    dispatch({ type: 'MEMORY_LOADED', videoId, title, memoryId, greeting })
  }, [])

  const onMemoryError = useCallback((error: string) => {
    dispatch({ type: 'MEMORY_LOAD_ERROR', error })
  }, [])

  const startListening = useCallback(() => {
    dispatch({ type: 'START_LISTENING' })
  }, [])

  const stopListening = useCallback(() => {
    dispatch({ type: 'STOP_LISTENING' })
  }, [])

  const sendMessage = useCallback((text: string) => {
    dispatch({ type: 'START_THINKING', userMessage: text })
  }, [])

  const onToken = useCallback((token: string) => {
    dispatch({ type: 'RECEIVE_TOKEN', token })
  }, [])

  const startSpeaking = useCallback(() => {
    dispatch({ type: 'START_SPEAKING' })
  }, [])

  const doneSpeaking = useCallback(() => {
    dispatch({ type: 'DONE_SPEAKING' })
  }, [])

  const setError = useCallback((error: string) => {
    dispatch({ type: 'SET_ERROR', error })
  }, [])

  const retry = useCallback(() => {
    dispatch({ type: 'RETRY' })
  }, [])

  return {
    ...data,
    loadMemory,
    onMemoryLoaded,
    onMemoryError,
    startListening,
    stopListening,
    sendMessage,
    onToken,
    startSpeaking,
    doneSpeaking,
    setError,
    retry,
  }
}
