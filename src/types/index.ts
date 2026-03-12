export interface HarnessTask {
  id: string
  task_id: string
  title: string
  description: string | null
  owner_agent: string
  routed_to: string | null
  status: string
  priority: string | null
  created_at: string
  completed_at: string | null
}

export interface XenaAlphaSignal {
  id: string
  token_symbol: string
  signal_strength: string
  signal_type: string | null
  source_account: string | null
  post_content: string | null
  caller_win_rate: number | null
  on_chain_confirmed: boolean | null
  geoff_reviewed: boolean | null
  created_at: string
  score: number | null
}

export interface GeoffPosition {
  id: string
  symbol?: string
  side?: string
  size?: number
  entry_price?: number
  current_price?: number
  pnl?: number
  status?: string
  created_at: string
}

export interface Trade {
  id: string
  symbol?: string
  side?: string
  size?: number
  price?: number
  pnl?: number
  status?: string
  created_at: string
}

export interface GeoffSignal {
  id: string
  symbol?: string
  signal?: string
  confidence?: number
  created_at: string
}

export interface GeoffEvent {
  id: string
  event_type?: string
  data?: Record<string, unknown>
  created_at: string
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  created_at: string
}

export interface Estimate {
  id: string
  customer_name: string
  project_category: string | null
  subtotal: number | null
  total: number | null
  status: string
  created_at: string
  is_archived: boolean | null
}

export interface BobSession {
  id: string
  chat_id: string
  messages: Record<string, unknown>[] | null
  lead_data: Record<string, unknown> | null
  updated_at: string
}

export interface Agent {
  name: string
  role: string
  color: string
  bgColor: string
  borderColor: string
  textColor: string
  emoji: string
}

export const AGENTS: Agent[] = [
  {
    name: 'Ralph',
    role: 'Chief of Staff',
    color: '#8B5CF6',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
    emoji: '👔',
  },
  {
    name: 'Bob',
    role: 'OVB Construction',
    color: '#3B82F6',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    emoji: '🔧',
  },
  {
    name: 'GEOFF',
    role: 'Trading/Finance',
    color: '#10B981',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    emoji: '📈',
  },
  {
    name: 'Xena',
    role: 'Content/Alpha',
    color: '#EC4899',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    textColor: 'text-pink-400',
    emoji: '🎯',
  },
]
