export type TutorRole = {
  id: number
  name: string
  description?: string
}

export type TutorConversation = {
  id: number
  title?: string
  role_id?: number
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type Citation = {
  title?: string
  source?: string
  url?: string
  content?: string
}

export type WorkshopPhase = {
  phase?: string
  role?: string
  content?: string
  summary?: string
}

export type McpCall = {
  tool?: string
  name?: string
  status?: string
  summary?: string
  result?: string
}

export type ToolProcessStep = {
  id: string
  label: string
  detail?: string
  status: 'running' | 'done' | 'error'
}

export type VideoResource = {
  id: string
  title?: string
  status?: string
  duration?: number
  durationMs?: number
  createdAt?: string
  videoUrl?: string
  audioUrl?: string
  subtitleUrl?: string
  timelineUrl?: string
  sceneUrl?: string
  shareUrl?: string
  resolution?: string
  fps?: number
  provider?: string
  contentSource?: string
  ttsProvider?: string
  voiceProvider?: string
  voice?: string
  hasMp4?: boolean
  slides?: number
  audioStatus?: string
  audioMessage?: string
  frameStatus?: string
  frameMessage?: string
  muxStatus?: string
  muxMessage?: string
  progress?: number
  message?: string
}

export type TutorMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  confidence?: ConfidenceLevel
  citations?: Citation[]
  workshop?: WorkshopPhase[]
  mcpCalls?: McpCall[]
  toolSteps?: ToolProcessStep[]
  videoResource?: VideoResource
  error?: string
}

export type TutorStreamEvent =
  | { type: 'text'; payload?: { content?: string } }
  | { type: 'confidence'; payload?: { level?: ConfidenceLevel; confidence?: ConfidenceLevel; label?: string } }
  | { type: 'citations' | 'sources'; payload?: { items?: Citation[] } | Citation[] }
  | { type: 'workshop_phase' | 'hub'; payload?: WorkshopPhase }
  | { type: 'mcp_call'; payload?: McpCall }
  | { type: 'trust_meta'; payload?: { mcp_calls?: McpCall[] } }
  | { type: 'done'; payload?: Record<string, unknown> }
  | { type: 'error'; payload?: { message?: string; detail?: string } }
  | { type: string; payload?: Record<string, unknown> }

export type VideoJobEvent =
  | { type: 'progress'; payload?: { stage?: string; progress?: number; message?: string; resource_id?: string } }
  | { type: 'artifact'; payload?: { kind?: string; url?: string; resource_id?: string } }
  | { type: 'done'; payload?: { resource_id?: string; resource?: Record<string, unknown> } }
  | { type: 'error'; payload?: { code?: string; message?: string; retryable?: boolean } }
  | { type: string; payload?: Record<string, unknown> }
