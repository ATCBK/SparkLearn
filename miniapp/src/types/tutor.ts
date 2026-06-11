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

export type TutorMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  confidence?: ConfidenceLevel
  citations?: Citation[]
  workshop?: WorkshopPhase[]
  mcpCalls?: McpCall[]
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
