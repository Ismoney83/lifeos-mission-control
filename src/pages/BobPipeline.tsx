import { useEffect, useState } from 'react'
import { ovb } from '../lib/supabase'
import type { Estimate } from '../types'
import { ClientDrawer } from '../components/ClientDrawer'
import {
  FileText, CheckCircle, Clock,
  ChevronRight, ChevronDown, Search, List, LayoutGrid,
  Plus, Edit2, Archive, TrendingUp
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────────────────────

type StatusKey = 'draft' | 'sent' | 'approved' | 'rejected'
type ViewMode = 'list' | 'board'

const STATUS_CONFIG: Record<StatusKey, {
  label: string
  color: string        // left-border / dot
  pill: string         // pill bg + text
  border: string       // pill border
  colHeader: string    // board column header tint
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

const STATUSES: StatusKey[] = ['draft', 'sent', 'approved', 'rejected']

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status?.toLowerCase() as StatusKey] ?? STATUS_CONFIG.draft
}

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
        borderLeft: `3px solid ${accentColor}`,
        border: `1px solid rgba(255,255,255,0.06)`,
        borderLeftWidth: '3px',
        borderLeftColor: accentColor,
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

// ─── Status Pill ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cfg = getStatusCfg(status)
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.pill} ${cfg.border}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </span>
  )
}

// ─── List Row ────────────────────────────────────────────────────────────────

interface RowProps {
  estimate: Estimate
  isSelected: boolean
  onSelect: () => void
}

function EstimateRow({ estimate, isSelected, onSelect }: RowProps) {
  const [hovered, setHovered] = useState(false)
  const cfg = getStatusCfg(estimate.status)
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
      {/* Checkbox circle */}
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

      {/* Client + project */}
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

      {/* Right side — always visible */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusPill status={estimate.status} />

        <span className="text-[#F8F9FA] text-sm font-semibold w-20 text-right">
          {formatMoney(estimate.total)}
        </span>

        <span
          className="text-xs px-2 py-0.5 rounded font-medium"
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: '#8B9EB3',
          }}
        >
          {formatDate(estimate.created_at)}
        </span>

        {/* Hover actions */}
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

// ─── Section Group ────────────────────────────────────────────────────────────

interface SectionProps {
  status: StatusKey
  estimates: Estimate[]
  selectedId: string | null
  onSelect: (id: string) => void
  defaultOpen?: boolean
}

function SectionGroup({ status, estimates, selectedId, onSelect, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const cfg = STATUS_CONFIG[status]

  if (estimates.length === 0) return null

  return (
    <div>
      {/* Section header */}
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
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: cfg.color }}
        />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        <span
          className="text-xs font-medium px-1.5 py-0.5 rounded"
          style={{
            background: `${cfg.color}18`,
            color: cfg.color,
          }}
        >
          {estimates.length}
        </span>
        {/* Section total */}
        <span className="ml-auto text-[#8B9EB3] text-xs">
          {formatMoney(estimates.reduce((s, e) => s + (e.total ?? 0), 0))}
        </span>
      </button>

      {/* Rows */}
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
  const cfg = getStatusCfg(estimate.status)
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
  status: StatusKey
  estimates: Estimate[]
  onSelect: (id: string) => void
}) {
  const cfg = STATUS_CONFIG[status]
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function BobPipeline() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await ovb
          .from('estimates')
          .select('*')
          .order('created_at', { ascending: false })
        if (err) throw new Error(err.message)
        setEstimates(data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const active = estimates.filter(e => !e.is_archived && e.status !== 'rejected')
  const totalPipeline = active.reduce((sum, e) => sum + (e.total || 0), 0)
  const approvedValue = estimates
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + (e.total || 0), 0)
  const approvedCount = estimates.filter(e => e.status === 'approved').length
  const sentCount = estimates.filter(e => e.status === 'sent').length

  const filtered = estimates.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.customer_name?.toLowerCase().includes(q) ||
      e.project_category?.toLowerCase().includes(q) ||
      e.project_address?.toLowerCase().includes(q)
    )
  })

  // Group by status
  const grouped = Object.fromEntries(
    STATUSES.map(s => [s, filtered.filter(e => e.status?.toLowerCase() === s)])
  ) as Record<StatusKey, Estimate[]>

  // Progress: approved / (approved + sent + draft)
  const progressTotal = estimates.filter(e => ['draft', 'sent', 'approved'].includes(e.status?.toLowerCase())).length
  const progressPct = progressTotal > 0 ? Math.round((approvedCount / progressTotal) * 100) : 0

  if (loading) {
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
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              <span style={{ color: '#8B9EB3' }}>Bob</span>
              <ChevronRight className="w-3.5 h-3.5" style={{ color: '#8B9EB3' }} />
              <span className="font-semibold" style={{ color: '#F8F9FA' }}>Construction Pipeline</span>
            </div>

            <div className="flex items-center gap-2">
              {/* View toggle */}
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

              {/* Search */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Search className="w-3.5 h-3.5" style={{ color: '#8B9EB3' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients..."
                  className="bg-transparent text-sm placeholder-[#8B9EB3] focus:outline-none w-32"
                  style={{ color: '#F8F9FA' }}
                />
              </div>

              {/* New estimate button */}
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 hover:brightness-110 active:scale-95"
                style={{ background: '#F06A6A', color: '#fff' }}
              >
                <Plus className="w-4 h-4" />
                New Estimate
              </button>
            </div>
          </div>

          {error && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(240,106,106,0.1)', border: '1px solid rgba(240,106,106,0.25)', color: '#F06A6A' }}
            >
              {error}
            </div>
          )}

          {/* ── Metrics ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard
              label="Total Estimates"
              value={estimates.length}
              sub={`${filtered.length} shown`}
              accentColor="#4573D2"
              icon={<FileText className="w-4 h-4" />}
            />
            <MetricCard
              label="Active Pipeline"
              value={active.length}
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

          {/* Progress bar */}
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

          {/* ── Content Area ─────────────────────────────────────────── */}
          {viewMode === 'list' ? (
            /* LIST VIEW */
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: '#161b27',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* Table header row */}
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

              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8B9EB3' }} />
                  <p className="text-sm font-medium" style={{ color: '#8B9EB3' }}>No estimates match your search</p>
                  <p className="text-xs mt-1 opacity-60" style={{ color: '#8B9EB3' }}>Try adjusting your search query</p>
                </div>
              ) : (
                STATUSES.map(status => (
                  <SectionGroup
                    key={status}
                    status={status}
                    estimates={grouped[status]}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    defaultOpen={status !== 'rejected'}
                  />
                ))
              )}
            </div>
          ) : (
            /* BOARD VIEW */
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {STATUSES.map(status => (
                <BoardColumn
                  key={status}
                  status={status}
                  estimates={grouped[status]}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          )}

          {/* Footer count */}
          <div className="text-xs pb-2" style={{ color: '#8B9EB3' }}>
            Showing {filtered.length} of {estimates.length} estimates
            {search && ` matching "${search}"`}
            {' '}— click any row to open client folder
          </div>
        </div>
      </div>

      <ClientDrawer estimateId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  )
}
