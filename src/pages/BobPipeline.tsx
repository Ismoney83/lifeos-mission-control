import { useEffect, useState } from 'react'
import { ovb } from '../lib/supabase'
import type { Estimate, Lead } from '../types'
import { ClientDrawer } from '../components/ClientDrawer'
import {
  FileText, CheckCircle, Clock,
  ChevronRight, ChevronDown, Search, List, LayoutGrid,
  Plus, Edit2, Archive, TrendingUp, Users, PhoneCall
} from 'lucide-react'

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface DrawerSelection {
  id: string
  type: 'estimate' | 'lead'
}

// ─── Estimate Helpers ────────────────────────────────────────────────────────

type EstimateStatusKey = 'draft' | 'sent' | 'approved' | 'rejected'
type ViewMode = 'list' | 'board'

const ESTIMATE_STATUS_CONFIG: Record<EstimateStatusKey, {
  label: string
  color: string
  pill: string
  border: string
  colHeader: string
}> = {
  draft: {
    label: 'Draft',
    color: '#8B9EB3',
    pill: 'bg-[#8B9EB3]/10 text-[#8B9EB3]',
    border: 'border-[#8B9EB3]/25',
    colHeader: 'border-t-[#8B9EB3]',
  },
  sent: {
    label: 'Sent',
    color: '#4573D2',
    pill: 'bg-[#4573D2]/10 text-[#4573D2]',
    border: 'border-[#4573D2]/25',
    colHeader: 'border-t-[#4573D2]',
  },
  approved: {
    label: 'Approved',
    color: '#37C68B',
    pill: 'bg-[#37C68B]/10 text-[#37C68B]',
    border: 'border-[#37C68B]/25',
    colHeader: 'border-t-[#37C68B]',
  },
  rejected: {
    label: 'Rejected',
    color: '#F06A6A',
    pill: 'bg-[#F06A6A]/10 text-[#F06A6A]',
    border: 'border-[#F06A6A]/25',
    colHeader: 'border-t-[#F06A6A]',
  },
}

const ESTIMATE_STATUSES: EstimateStatusKey[] = ['draft', 'sent', 'approved', 'rejected']

function getEstimateStatusCfg(status: string) {
  return ESTIMATE_STATUS_CONFIG[status?.toLowerCase() as EstimateStatusKey] ?? ESTIMATE_STATUS_CONFIG.draft
}

// ─── Lead Helpers ─────────────────────────────────────────────────────────────

type LeadStatusKey = 'new' | 'contacted' | 'site_visit_scheduled' | 'estimate_sent' | 'negotiating' | 'converted' | 'lost'

const LEAD_STATUS_CONFIG: Record<LeadStatusKey, { label: string; color: string }> = {
  new:                   { label: 'New',         color: '#94a3b8' },
  contacted:             { label: 'Contacted',   color: '#4573D2' },
  site_visit_scheduled:  { label: 'Site Visit',  color: '#F59E0B' },
  estimate_sent:         { label: 'Est. Sent',   color: '#A855F7' },
  negotiating:           { label: 'Negotiating', color: '#06B6D4' },
  converted:             { label: 'Converted',   color: '#37C68B' },
  lost:                  { label: 'Lost',        color: '#F06A6A' },
}

const LEAD_STATUSES: LeadStatusKey[] = ['new', 'contacted', 'site_visit_scheduled', 'estimate_sent', 'negotiating', 'converted', 'lost']

function getLeadStatusCfg(status: string) {
  return LEAD_STATUS_CONFIG[status?.toLowerCase() as LeadStatusKey] ?? LEAD_STATUS_CONFIG.new
}

function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function isThisWeek(dateStr: string) {
  return daysSince(dateStr) <= 7
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function formatMoney(n: number | null) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  accentColor: string
  icon: React.ReactNode
}

function MetricCard({ label, value, sub, accentColor, icon }: MetricCardProps) {
  return (
    <div
      className="rounded-xl p-4 flex items-center gap-4 transition-all duration-150"
      style={{
        background: '#161b27',
        border: `1px solid rgba(255,255,255,0.06)`,
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${accentColor}18` }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[#8B9EB3] text-xs font-medium">{label}</div>
        <div className="text-[#F8F9FA] text-lg font-bold leading-tight">{value}</div>
        {sub && <div className="text-[#8B9EB3] text-xs">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Status Pill (Estimate) ───────────────────────────────────────────────────

function EstimateStatusPill({ status }: { status: string }) {
  const cfg = getEstimateStatusCfg(status)
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.pill} ${cfg.border}`}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

// ─── Lead Status Pill ────────────────────────────────────────────────────────

function LeadStatusPill({ status }: { status: string }) {
  const cfg = getLeadStatusCfg(status)
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{
        background: `${cfg.color}18`,
        color: cfg.color,
        borderColor: `${cfg.color}40`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

// ─── Estimate List Row ────────────────────────────────────────────────────────

interface EstimateRowProps {
  estimate: Estimate
  isSelected: boolean
  onSelect: () => void
}

function EstimateRow({ estimate, isSelected, onSelect }: EstimateRowProps) {
  const [hovered, setHovered] = useState(false)
  const cfg = getEstimateStatusCfg(estimate.status)
  const isApproved = estimate.status?.toLowerCase() === 'approved'

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150 group"
      style={{
        borderLeft: `3px solid ${hovered || isSelected ? cfg.color : 'transparent'}`,
        background: isSelected
          ? 'rgba(69,115,210,0.06)'
          : hovered
            ? 'rgba(255,255,255,0.03)'
            : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div
        className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-150"
        style={{
          borderColor: isApproved ? '#37C68B' : hovered ? cfg.color : 'rgba(139,158,179,0.4)',
          background: isApproved ? '#37C68B' : 'transparent',
        }}
      >
        {isApproved && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-[#F8F9FA] font-semibold text-sm">
          {estimate.customer_name}
        </span>
        {estimate.project_category && (
          <span className="text-[#8B9EB3] text-xs ml-2">
            {estimate.project_category}
          </span>
        )}
        {estimate.project_address && (
          <div className="text-[#8B9EB3] text-xs truncate max-w-xs mt-0.5 opacity-70">
            {estimate.project_address}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <EstimateStatusPill status={estimate.status} />
        <span className="text-[#F8F9FA] text-sm font-semibold w-20 text-right">
          {formatMoney(estimate.total)}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded font-medium"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#8B9EB3' }}
        >
          {formatDate(estimate.created_at)}
        </span>
        <div
          className="flex items-center gap-1 transition-all duration-150"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          <button
            onClick={e => { e.stopPropagation(); onSelect() }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#8B9EB3]" />
          </button>
          <button
            onClick={e => e.stopPropagation()}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Archive"
          >
            <Archive className="w-3.5 h-3.5 text-[#8B9EB3]" />
          </button>
        </div>
        <ChevronRight
          className="w-4 h-4 transition-colors duration-150"
          style={{ color: hovered ? cfg.color : 'rgba(139,158,179,0.4)' }}
        />
      </div>
    </div>
  )
}

// ─── Estimate Section Group ───────────────────────────────────────────────────

interface EstimateSectionProps {
  status: EstimateStatusKey
  estimates: Estimate[]
  selectedId: string | null
  onSelect: (id: string) => void
  defaultOpen?: boolean
}

function EstimateSectionGroup({ status, estimates, selectedId, onSelect, defaultOpen = true }: EstimateSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const cfg = ESTIMATE_STATUS_CONFIG[status]

  if (estimates.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/[0.02] transition-colors duration-150 group"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <ChevronDown
          className="w-3.5 h-3.5 transition-transform duration-200"
          style={{
            color: '#8B9EB3',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        <span
          className="text-xs font-medium px-1.5 py-0.5 rounded"
          style={{ background: `${cfg.color}18`, color: cfg.color }}
        >
          {estimates.length}
        </span>
        <span className="ml-auto text-[#8B9EB3] text-xs">
          {formatMoney(estimates.reduce((s, e) => s + (e.total ?? 0), 0))}
        </span>
      </button>
      {open && estimates.map(est => (
        <EstimateRow
          key={est.id}
          estimate={est}
          isSelected={selectedId === est.id}
          onSelect={() => onSelect(est.id)}
        />
      ))}
    </div>
  )
}

// ─── Board Card ───────────────────────────────────────────────────────────────

function BoardCard({ estimate, onSelect }: { estimate: Estimate; onSelect: () => void }) {
  const cfg = getEstimateStatusCfg(estimate.status)
  return (
    <div
      onClick={onSelect}
      className="rounded-xl p-3 cursor-pointer transition-all duration-150 hover:-translate-y-0.5"
      style={{
        background: '#161b27',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px ${cfg.color}40`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)'
      }}
    >
      <div className="text-[#F8F9FA] font-semibold text-sm mb-1">{estimate.customer_name}</div>
      {estimate.project_category && (
        <div className="text-[#8B9EB3] text-xs mb-2">{estimate.project_category}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[#F8F9FA] text-sm font-bold">{formatMoney(estimate.total)}</span>
        <span
          className="text-xs px-1.5 py-0.5 rounded font-medium"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#8B9EB3' }}
        >
          {formatDate(estimate.created_at)}
        </span>
      </div>
      {estimate.contract_signed && (
        <div className="mt-2 flex items-center gap-1 text-[#37C68B] text-xs">
          <CheckCircle className="w-3 h-3" />
          <span>Contract signed</span>
        </div>
      )}
    </div>
  )
}

// ─── Board Column ─────────────────────────────────────────────────────────────

function BoardColumn({
  status, estimates, onSelect,
}: {
  status: EstimateStatusKey
  estimates: Estimate[]
  onSelect: (id: string) => void
}) {
  const cfg = ESTIMATE_STATUS_CONFIG[status]
  return (
    <div
      className="flex flex-col rounded-xl min-h-[200px]"
      style={{
        background: 'rgba(22,27,39,0.6)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderTop: `3px solid ${cfg.color}`,
      }}
    >
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        <span
          className="text-xs font-medium px-1.5 py-0.5 rounded ml-1"
          style={{ background: `${cfg.color}18`, color: cfg.color }}
        >
          {estimates.length}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        {estimates.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[#8B9EB3] text-xs opacity-50">No estimates</span>
          </div>
        ) : (
          estimates.map(est => (
            <BoardCard key={est.id} estimate={est} onSelect={() => onSelect(est.id)} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Lead Row ────────────────────────────────────────────────────────────────

interface LeadRowProps {
  lead: Lead
  isSelected: boolean
  onSelect: () => void
}

function LeadRow({ lead, isSelected, onSelect }: LeadRowProps) {
  const [hovered, setHovered] = useState(false)
  const cfg = getLeadStatusCfg(lead.status)
  const days = daysSince(lead.created_at)

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150"
      style={{
        borderLeft: `3px solid ${hovered || isSelected ? cfg.color : 'transparent'}`,
        background: isSelected
          ? `${cfg.color}0d`
          : hovered
            ? 'rgba(255,255,255,0.03)'
            : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div
        className="w-4 h-4 rounded-full border-2 flex-shrink-0"
        style={{ borderColor: hovered ? cfg.color : 'rgba(139,158,179,0.4)' }}
      />

      <div className="flex-1 min-w-0">
        <span className="text-[#F8F9FA] font-semibold text-sm">{lead.name}</span>
        {lead.category && (
          <span className="text-[#8B9EB3] text-xs ml-2">{lead.category}</span>
        )}
        {lead.city && (
          <div className="text-[#8B9EB3] text-xs truncate max-w-xs mt-0.5 opacity-70">
            {lead.city}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <LeadStatusPill status={lead.status} />
        {lead.phone && (
          <span className="text-[#8B9EB3] text-xs hidden md:inline">{lead.phone}</span>
        )}
        <span
          className="text-xs px-2 py-0.5 rounded font-medium"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#8B9EB3' }}
        >
          {days === 0 ? 'Today' : `${days}d ago`}
        </span>
        <ChevronRight
          className="w-4 h-4 transition-colors duration-150"
          style={{ color: hovered ? cfg.color : 'rgba(139,158,179,0.4)' }}
        />
      </div>
    </div>
  )
}

// ─── Lead Section Group ───────────────────────────────────────────────────────

interface LeadSectionProps {
  status: LeadStatusKey
  leads: Lead[]
  selectedId: string | null
  onSelect: (id: string) => void
  defaultOpen?: boolean
}

function LeadSectionGroup({ status, leads, selectedId, onSelect, defaultOpen = true }: LeadSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const cfg = LEAD_STATUS_CONFIG[status]

  if (leads.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/[0.02] transition-colors duration-150"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <ChevronDown
          className="w-3.5 h-3.5 transition-transform duration-200"
          style={{
            color: '#8B9EB3',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        <span
          className="text-xs font-medium px-1.5 py-0.5 rounded"
          style={{ background: `${cfg.color}18`, color: cfg.color }}
        >
          {leads.length}
        </span>
      </button>
      {open && leads.map(lead => (
        <LeadRow
          key={lead.id}
          lead={lead}
          isSelected={selectedId === lead.id}
          onSelect={() => onSelect(lead.id)}
        />
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type MainTab = 'leads' | 'estimates'

export function BobPipeline() {
  const [mainTab, setMainTab] = useState<MainTab>('leads')

  // Estimates state
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [estLoading, setEstLoading] = useState(true)
  const [estError, setEstError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [leadsError, setLeadsError] = useState<string | null>(null)

  // Shared
  const [selected, setSelected] = useState<DrawerSelection | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchEstimates() {
      setEstLoading(true)
      setEstError(null)
      try {
        const { data, error: err } = await ovb
          .from('estimates')
          .select('*')
          .order('created_at', { ascending: false })
        if (err) throw new Error(err.message)
        setEstimates(data || [])
      } catch (e) {
        setEstError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setEstLoading(false)
      }
    }
    fetchEstimates()
  }, [])

  useEffect(() => {
    async function fetchLeads() {
      setLeadsLoading(true)
      setLeadsError(null)
      try {
        const { data, error: err } = await ovb
          .from('quote_requests')
          .select('*')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
        if (err) throw new Error(err.message)
        setLeads(data || [])
      } catch (e) {
        setLeadsError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLeadsLoading(false)
      }
    }
    fetchLeads()
  }, [])

  // ── Estimate metrics ─────────────────────────────────────────────────────────
  const activeEst = estimates.filter(e => !e.is_archived && e.status !== 'rejected')
  const totalPipeline = activeEst.reduce((sum, e) => sum + (e.total || 0), 0)
  const approvedValue = estimates.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.total || 0), 0)
  const approvedCount = estimates.filter(e => e.status === 'approved').length
  const sentCount = estimates.filter(e => e.status === 'sent').length
  const progressTotal = estimates.filter(e => ['draft', 'sent', 'approved'].includes(e.status?.toLowerCase())).length
  const progressPct = progressTotal > 0 ? Math.round((approvedCount / progressTotal) * 100) : 0

  // ── Lead metrics ──────────────────────────────────────────────────────────────
  const newThisWeek = leads.filter(l => isThisWeek(l.created_at)).length
  const convertedCount = leads.filter(l => l.status === 'converted').length

  // ── Filter ────────────────────────────────────────────────────────────────────
  const filteredEstimates = estimates.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.customer_name?.toLowerCase().includes(q) ||
      e.project_category?.toLowerCase().includes(q) ||
      e.project_address?.toLowerCase().includes(q)
    )
  })

  const filteredLeads = leads.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.name?.toLowerCase().includes(q) ||
      l.category?.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q) ||
      l.phone?.toLowerCase().includes(q)
    )
  })

  const groupedEstimates = Object.fromEntries(
    ESTIMATE_STATUSES.map(s => [s, filteredEstimates.filter(e => e.status?.toLowerCase() === s)])
  ) as Record<EstimateStatusKey, Estimate[]>

  const groupedLeads = Object.fromEntries(
    LEAD_STATUSES.map(s => [s, filteredLeads.filter(l => l.status?.toLowerCase() === s)])
  ) as Record<LeadStatusKey, Lead[]>

  const loading = mainTab === 'leads' ? leadsLoading : estLoading

  if (loading && mainTab === 'estimates' && estimates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64" style={{ background: '#0f1117' }}>
        <div className="flex items-center gap-3" style={{ color: '#8B9EB3' }}>
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#4573D2', borderTopColor: 'transparent' }}
          />
          <span className="text-sm">Loading pipeline...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen" style={{ background: '#0f1117' }}>
        <div className="p-6 max-w-[1400px] mx-auto space-y-5">

          {/* ── Top Bar ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm">
              <span style={{ color: '#8B9EB3' }}>Bob</span>
              <ChevronRight className="w-3.5 h-3.5" style={{ color: '#8B9EB3' }} />
              <span className="font-semibold" style={{ color: '#F8F9FA' }}>Construction Pipeline</span>
            </div>

            <div className="flex items-center gap-2">
              {mainTab === 'estimates' && (
                <div
                  className="flex items-center rounded-lg p-1 gap-0.5"
                  style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {([
                    { mode: 'list' as ViewMode, icon: <List className="w-3.5 h-3.5" />, label: 'List' },
                    { mode: 'board' as ViewMode, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Board' },
                  ]).map(({ mode, icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
                      style={
                        viewMode === mode
                          ? { background: '#4573D2', color: '#fff' }
                          : { color: '#8B9EB3' }
                      }
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Search className="w-3.5 h-3.5" style={{ color: '#8B9EB3' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={mainTab === 'leads' ? 'Search leads...' : 'Search clients...'}
                  className="bg-transparent text-sm placeholder-[#8B9EB3] focus:outline-none w-32"
                  style={{ color: '#F8F9FA' }}
                />
              </div>

              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 hover:brightness-110 active:scale-95"
                style={{ background: '#F06A6A', color: '#fff' }}
              >
                <Plus className="w-4 h-4" />
                {mainTab === 'leads' ? 'New Lead' : 'New Estimate'}
              </button>
            </div>
          </div>

          {/* ── Main Tab Bar ─────────────────────────────────────────── */}
          <div
            className="flex rounded-xl p-1 gap-1"
            style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}
          >
            {([
              { key: 'leads' as MainTab, label: 'Leads Pipeline', icon: <PhoneCall className="w-3.5 h-3.5" /> },
              { key: 'estimates' as MainTab, label: 'Estimates', icon: <FileText className="w-3.5 h-3.5" /> },
            ]).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => { setMainTab(key); setSearch('') }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                style={
                  mainTab === key
                    ? { background: '#4573D2', color: '#fff' }
                    : { color: '#8B9EB3' }
                }
              >
                {icon}
                {label}
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: mainTab === key ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                    color: mainTab === key ? '#fff' : '#8B9EB3',
                  }}
                >
                  {key === 'leads' ? leads.length : estimates.length}
                </span>
              </button>
            ))}
          </div>

          {/* ── Metrics ─────────────────────────────────────────────── */}
          {mainTab === 'leads' ? (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <MetricCard
                label="Total Leads"
                value={leads.length}
                sub={`${filteredLeads.length} shown`}
                accentColor="#94a3b8"
                icon={<Users className="w-4 h-4" />}
              />
              <MetricCard
                label="New This Week"
                value={newThisWeek}
                sub="last 7 days"
                accentColor="#4573D2"
                icon={<PhoneCall className="w-4 h-4" />}
              />
              <MetricCard
                label="Converted"
                value={convertedCount}
                sub={leads.length > 0 ? `${Math.round((convertedCount / leads.length) * 100)}% rate` : '0% rate'}
                accentColor="#37C68B"
                icon={<CheckCircle className="w-4 h-4" />}
              />
              <MetricCard
                label="Pipeline Value"
                value={formatMoney(totalPipeline)}
                sub={`${activeEst.length} estimates`}
                accentColor="#F59E0B"
                icon={<TrendingUp className="w-4 h-4" />}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <MetricCard
                label="Total Estimates"
                value={estimates.length}
                sub={`${filteredEstimates.length} shown`}
                accentColor="#4573D2"
                icon={<FileText className="w-4 h-4" />}
              />
              <MetricCard
                label="Active Pipeline"
                value={activeEst.length}
                sub={`${sentCount} awaiting response`}
                accentColor="#8B9EB3"
                icon={<Clock className="w-4 h-4" />}
              />
              <MetricCard
                label="Approved Value"
                value={formatMoney(approvedValue)}
                sub={`${approvedCount} contracts`}
                accentColor="#37C68B"
                icon={<CheckCircle className="w-4 h-4" />}
              />
              <MetricCard
                label="Total Pipeline"
                value={formatMoney(totalPipeline)}
                sub={`${progressPct}% close rate`}
                accentColor="#F06A6A"
                icon={<TrendingUp className="w-4 h-4" />}
              />
            </div>
          )}

          {/* Progress bar (estimates only) */}
          {mainTab === 'estimates' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium" style={{ color: '#8B9EB3' }}>
                  Pipeline close rate
                </span>
                <span className="text-xs font-semibold" style={{ color: '#37C68B' }}>
                  {progressPct}%
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #4573D2, #37C68B)',
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Error Banner ──────────────────────────────────────────── */}
          {(mainTab === 'leads' ? leadsError : estError) && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(240,106,106,0.1)', border: '1px solid rgba(240,106,106,0.25)', color: '#F06A6A' }}
            >
              {mainTab === 'leads' ? leadsError : estError}
            </div>
          )}

          {/* ── Leads Tab Content ─────────────────────────────────────── */}
          {mainTab === 'leads' && (
            leadsLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="flex items-center gap-3" style={{ color: '#8B9EB3' }}>
                  <div
                    className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#94a3b8', borderTopColor: 'transparent' }}
                  />
                  <span className="text-sm">Loading leads...</span>
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {/* Table header */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-4 flex-shrink-0" />
                  <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#8B9EB3' }}>
                    Lead / Category
                  </span>
                  <div className="flex items-center gap-3 flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#8B9EB3' }}>
                    <span className="w-24 text-center">Status</span>
                    <span className="w-24 text-right">Phone</span>
                    <span className="w-16 text-center">Age</span>
                    <span className="w-4" />
                  </div>
                </div>

                {filteredLeads.length === 0 ? (
                  <div className="py-16 text-center">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8B9EB3' }} />
                    <p className="text-sm font-medium" style={{ color: '#8B9EB3' }}>No leads match your search</p>
                    <p className="text-xs mt-1 opacity-60" style={{ color: '#8B9EB3' }}>Leads from Bob's Telegram bot appear here</p>
                  </div>
                ) : (
                  LEAD_STATUSES.map(status => (
                    <LeadSectionGroup
                      key={status}
                      status={status}
                      leads={groupedLeads[status]}
                      selectedId={selected?.type === 'lead' ? selected.id : null}
                      onSelect={id => setSelected({ id, type: 'lead' })}
                      defaultOpen={status !== 'lost' && status !== 'converted'}
                    />
                  ))
                )}
              </div>
            )
          )}

          {/* ── Estimates Tab Content ─────────────────────────────────── */}
          {mainTab === 'estimates' && (
            estLoading && estimates.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <div className="flex items-center gap-3" style={{ color: '#8B9EB3' }}>
                  <div
                    className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#4573D2', borderTopColor: 'transparent' }}
                  />
                  <span className="text-sm">Loading estimates...</span>
                </div>
              </div>
            ) : viewMode === 'list' ? (
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-4 flex-shrink-0" />
                  <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#8B9EB3' }}>
                    Client / Project
                  </span>
                  <div className="flex items-center gap-3 flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#8B9EB3' }}>
                    <span className="w-20 text-center">Status</span>
                    <span className="w-20 text-right">Amount</span>
                    <span className="w-16 text-center">Date</span>
                    <span className="w-16" />
                    <span className="w-4" />
                  </div>
                </div>

                {filteredEstimates.length === 0 ? (
                  <div className="py-16 text-center">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8B9EB3' }} />
                    <p className="text-sm font-medium" style={{ color: '#8B9EB3' }}>No estimates match your search</p>
                    <p className="text-xs mt-1 opacity-60" style={{ color: '#8B9EB3' }}>Try adjusting your search query</p>
                  </div>
                ) : (
                  ESTIMATE_STATUSES.map(status => (
                    <EstimateSectionGroup
                      key={status}
                      status={status}
                      estimates={groupedEstimates[status]}
                      selectedId={selected?.type === 'estimate' ? selected.id : null}
                      onSelect={id => setSelected({ id, type: 'estimate' })}
                      defaultOpen={status !== 'rejected'}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {ESTIMATE_STATUSES.map(status => (
                  <BoardColumn
                    key={status}
                    status={status}
                    estimates={groupedEstimates[status]}
                    onSelect={id => setSelected({ id, type: 'estimate' })}
                  />
                ))}
              </div>
            )
          )}

          {/* Footer count */}
          <div className="text-xs pb-2" style={{ color: '#8B9EB3' }}>
            {mainTab === 'leads'
              ? `Showing ${filteredLeads.length} of ${leads.length} leads${search ? ` matching "${search}"` : ''} — click any row to open lead details`
              : `Showing ${filteredEstimates.length} of ${estimates.length} estimates${search ? ` matching "${search}"` : ''} — click any row to open client folder`
            }
          </div>
        </div>
      </div>

      <ClientDrawer selected={selected} onClose={() => setSelected(null)} />
    </>
  )
}
