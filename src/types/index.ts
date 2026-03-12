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
  token_mint: string | null
  signal_strength: string
  signal_type: string | null
  source_account: string | null
  post_content: string | null
  caller_win_rate: number | null
  on_chain_confirmed: boolean | null
  geoff_reviewed: boolean | null
  geoff_action: string | null
  notes: string | null
  created_at: string
  score: number | null
  score_reasons: string[] | null
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

export interface GeoffPMTrade {
  id: string
  market_title?: string
  market_id?: string
  side?: string
  contracts?: number
  avg_price?: number
  pnl?: number
  status?: string
  created_at: string
  closed_at?: string
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
  address: string | null
  created_at: string
  updated_at: string
}

export interface Estimate {
  id: string
  customer_name: string
  customer_email: string | null
  project_category: string | null
  project_details: string | null
  project_address: string | null
  project_city: string | null
  project_state: string | null
  subtotal: number | null
  total: number | null
  tax_amount: number | null
  status: string
  start_date: string | null
  estimated_completion_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  is_archived: boolean | null
  contract_signed: boolean | null
  contract_signed_date: string | null
  sent_to_client_at: string | null
  client_viewed_at: string | null
  client_response: string | null
  client_token: string | null
}

export interface CustomerFile {
  id: string
  customer_id: string
  file_name: string
  file_path: string
  file_url: string
  file_type: string | null
  file_size: number | null
  category: string | null
  description: string | null
  created_at: string
}

export interface ClientProject {
  id: string
  customer_id: string | null
  project_name: string
  project_type: string | null
  status: string
  start_date: string | null
  end_date: string | null
  estimated_cost: number | null
  actual_cost: number | null
  description: string | null
  address: string | null
  contract_value: number | null
  current_phase: string | null
  is_archived: boolean | null
  created_at: string
}

export interface XenaContent {
  id: string
  title: string | null
  content: string
  platform: string | null
  status: string
  scheduled_at: string | null
  published_at: string | null
  pillar_id: string | null
  pillar_name: string | null
  hashtags: string[] | null
  media_urls: string[] | null
  performance: Record<string, unknown> | null
  created_at: string
}

export interface XenaPillar {
  id: string
  pillar_name: string
  description: string | null
  posting_frequency: string | null
  best_days: string[] | null
  best_hours: number[] | null
  is_active: boolean
}

export interface XenaTrend {
  id: string
  topic: string
  platform: string | null
  score: number | null
  volume: number | null
  created_at: string
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
