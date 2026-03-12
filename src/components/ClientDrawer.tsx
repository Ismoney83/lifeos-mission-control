import { useEffect, useState } from 'react'
import { ovb } from '../lib/supabase'
import type { Estimate, CustomerFile, ClientProject } from '../types'
import {
  X, FileText, FolderOpen, Briefcase, Edit2, Save, ExternalLink,
  Mail, MapPin, CheckCircle, Clock,
  Image, FileIcon
} from 'lucide-react'

interface Props {
  estimateId: string | null
  onClose: () => void
}

function statusStyle(status: string) {
  switch (status?.toLowerCase()) {
    case 'draft': return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    case 'sent': return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    case 'approved': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'rejected': return 'text-red-400 bg-red-500/10 border-red-500/30'
    case 'planning': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    case 'active': return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    case 'complete': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(n: number | null) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fileIcon(_fileType: string | null, fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext || ''))
    return <Image className="w-4 h-4 text-blue-400" />
  if (ext === 'pdf')
    return <FileText className="w-4 h-4 text-red-400" />
  return <FileIcon className="w-4 h-4 text-gray-400" />
}

type Tab = 'overview' | 'files' | 'projects'

export function ClientDrawer({ estimateId, onClose }: Props) {
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [files, setFiles] = useState<CustomerFile[]>([])
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [relatedEstimates, setRelatedEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Estimate>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    if (!estimateId) return
    setLoading(true)
    setTab('overview')
    setEditing(false)

    async function load() {
      // Load estimate
      const { data: est } = await ovb
        .from('estimates')
        .select('*')
        .eq('id', estimateId)
        .single()
      if (!est) { setLoading(false); return }
      setEstimate(est)
      setEditForm(est)

      // Load files by customer name match (customer_id not always set)
      // First try to find customer by name
      const [filesRes, projectsRes, relEstRes] = await Promise.all([
        ovb.from('customer_files').select('*').order('created_at', { ascending: false }).limit(50),
        ovb.from('client_projects').select('*').order('created_at', { ascending: false }).limit(20),
        ovb.from('estimates')
          .select('*')
          .ilike('customer_name', `%${est.customer_name?.split(',')[0]?.trim()}%`)
          .order('created_at', { ascending: false })
          .limit(10),
      ])
      setFiles(filesRes.data || [])
      setProjects(projectsRes.data || [])
      setRelatedEstimates((relEstRes.data || []).filter((e: Estimate) => e.id !== estimateId))
      setLoading(false)
    }
    load()
  }, [estimateId])

  async function saveEstimate() {
    if (!estimate) return
    setSaving(true)
    const { error } = await ovb
      .from('estimates')
      .update({
        status: editForm.status,
        notes: editForm.notes,
        customer_name: editForm.customer_name,
        customer_email: editForm.customer_email,
        project_address: editForm.project_address,
        start_date: editForm.start_date,
      })
      .eq('id', estimate.id)
    setSaving(false)
    if (error) {
      setSaveMsg('Error: ' + error.message)
    } else {
      setEstimate({ ...estimate, ...editForm } as Estimate)
      setSaveMsg('Saved!')
      setEditing(false)
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  if (!estimateId) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-gray-950 border-l border-gray-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm leading-tight">
                {loading ? 'Loading...' : estimate?.customer_name || 'Client'}
              </h2>
              <p className="text-gray-500 text-xs">
                {estimate?.project_category || 'Project'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 flex-shrink-0">
          {([
            { key: 'overview', label: 'Overview', icon: <FileText className="w-3.5 h-3.5" /> },
            { key: 'files', label: `Files (${files.length})`, icon: <FolderOpen className="w-3.5 h-3.5" /> },
            { key: 'projects', label: `Projects (${projects.length})`, icon: <Briefcase className="w-3.5 h-3.5" /> },
          ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors border-b-2 ${
                tab === t.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !estimate ? (
            <div className="p-8 text-center text-gray-500">Could not load estimate</div>
          ) : tab === 'overview' ? (
            <div className="p-6 space-y-5">
              {saveMsg && (
                <div className={`px-3 py-2 rounded-lg text-sm ${saveMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {saveMsg}
                </div>
              )}

              {/* Estimate Header */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyle(estimate.status)}`}>
                  {estimate.status}
                </span>
                <button
                  onClick={() => editing ? saveEstimate() : setEditing(true)}
                  disabled={saving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    editing
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {editing ? <><Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}</> : <><Edit2 className="w-3.5 h-3.5" /> Edit</>}
                </button>
              </div>

              {/* Contact Info */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                <h3 className="text-white text-sm font-semibold">Contact</h3>
                <div className="grid grid-cols-1 gap-2">
                  <Field
                    icon={<Briefcase className="w-3.5 h-3.5" />}
                    label="Name"
                    value={editForm.customer_name || ''}
                    editing={editing}
                    onChange={v => setEditForm(f => ({ ...f, customer_name: v }))}
                  />
                  <Field
                    icon={<Mail className="w-3.5 h-3.5" />}
                    label="Email"
                    value={editForm.customer_email || ''}
                    editing={editing}
                    onChange={v => setEditForm(f => ({ ...f, customer_email: v }))}
                    href={estimate.customer_email ? `mailto:${estimate.customer_email}` : undefined}
                  />
                  <Field
                    icon={<MapPin className="w-3.5 h-3.5" />}
                    label="Address"
                    value={editForm.project_address || ''}
                    editing={editing}
                    onChange={v => setEditForm(f => ({ ...f, project_address: v }))}
                  />
                </div>
              </div>

              {/* Financials */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="text-white text-sm font-semibold mb-3">Financials</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-gray-500 text-xs mb-1">Subtotal</div>
                    <div className="text-white font-semibold text-sm">{fmtMoney(estimate.subtotal)}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-gray-500 text-xs mb-1">Tax</div>
                    <div className="text-white font-semibold text-sm">{fmtMoney(estimate.tax_amount)}</div>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 text-center">
                    <div className="text-gray-500 text-xs mb-1">Total</div>
                    <div className="text-emerald-400 font-bold text-sm">{fmtMoney(estimate.total)}</div>
                  </div>
                </div>
              </div>

              {/* Project Info */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                <h3 className="text-white text-sm font-semibold">Project</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Category</div>
                    <div className="text-gray-200">{estimate.project_category || '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Start Date</div>
                    <div className="text-gray-200">{fmtDate(estimate.start_date)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Contract Signed</div>
                    <div className={estimate.contract_signed ? 'text-emerald-400' : 'text-gray-500'}>
                      {estimate.contract_signed ? `Signed ${fmtDate(estimate.contract_signed_date)}` : 'Not signed'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Client Viewed</div>
                    <div className="text-gray-200">{fmtDate(estimate.client_viewed_at)}</div>
                  </div>
                </div>

                {editing && (
                  <div className="pt-2 border-t border-gray-800">
                    <label className="text-xs text-gray-500 block mb-1">Status</label>
                    <select
                      value={editForm.status || ''}
                      onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      {['draft', 'sent', 'approved', 'rejected'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Notes */}
              {(editing || estimate.notes) && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white text-sm font-semibold mb-2">Notes</h3>
                  {editing ? (
                    <textarea
                      value={editForm.notes || ''}
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      placeholder="Add notes..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                    />
                  ) : (
                    <p className="text-gray-400 text-sm whitespace-pre-wrap">{estimate.notes}</p>
                  )}
                </div>
              )}

              {/* Other Estimates */}
              {relatedEstimates.length > 0 && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white text-sm font-semibold mb-3">Other Estimates</h3>
                  <div className="space-y-2">
                    {relatedEstimates.map(e => (
                      <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div>
                          <div className="text-gray-300 text-xs">{e.project_category || 'Project'}</div>
                          <div className="text-gray-500 text-xs">{fmtDate(e.created_at)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs font-semibold">{fmtMoney(e.total)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyle(e.status)}`}>{e.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="text-white text-sm font-semibold mb-3">Timeline</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Created', date: estimate.created_at, icon: <Clock className="w-3 h-3" />, color: 'text-gray-400' },
                    { label: 'Sent to Client', date: estimate.sent_to_client_at, icon: <Mail className="w-3 h-3" />, color: 'text-blue-400' },
                    { label: 'Client Viewed', date: estimate.client_viewed_at, icon: <CheckCircle className="w-3 h-3" />, color: 'text-yellow-400' },
                    { label: 'Contract Signed', date: estimate.contract_signed_date, icon: <CheckCircle className="w-3 h-3" />, color: 'text-emerald-400' },
                  ].filter(e => e.date).map(e => (
                    <div key={e.label} className="flex items-center gap-2 text-xs">
                      <span className={e.color}>{e.icon}</span>
                      <span className="text-gray-500">{e.label}</span>
                      <span className="text-gray-300 ml-auto">{fmtDate(e.date!)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : tab === 'files' ? (
            <div className="p-6">
              {files.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No files uploaded</p>
                  <p className="text-gray-600 text-xs mt-1">Files uploaded by Bob will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map(file => (
                    <a
                      key={file.id}
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-500/40 hover:bg-gray-800/50 transition-all group"
                    >
                      <div className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        {fileIcon(file.file_type, file.file_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{file.file_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {file.category && (
                            <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{file.category}</span>
                          )}
                          {file.file_size && (
                            <span className="text-xs text-gray-600">{(file.file_size / 1024).toFixed(0)}KB</span>
                          )}
                          <span className="text-xs text-gray-600">{fmtDate(file.created_at)}</span>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              {projects.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No projects yet</p>
                  <p className="text-gray-600 text-xs mt-1">Active projects will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map(proj => (
                    <div key={proj.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-white font-medium text-sm">{proj.project_name}</div>
                          <div className="text-gray-500 text-xs mt-0.5">{proj.project_type || '—'}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyle(proj.status)}`}>
                          {proj.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                          <div className="text-gray-500 text-xs">Estimated</div>
                          <div className="text-white text-xs font-semibold mt-0.5">{fmtMoney(proj.estimated_cost)}</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                          <div className="text-gray-500 text-xs">Contract</div>
                          <div className="text-white text-xs font-semibold mt-0.5">{fmtMoney(proj.contract_value)}</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                          <div className="text-gray-500 text-xs">Actual</div>
                          <div className="text-white text-xs font-semibold mt-0.5">{fmtMoney(proj.actual_cost)}</div>
                        </div>
                      </div>
                      {proj.current_phase && (
                        <div className="mt-2 text-xs text-gray-500">
                          Phase: <span className="text-gray-300">{proj.current_phase}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Field({
  icon, label, value, editing, onChange, href
}: {
  icon: React.ReactNode
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
  href?: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-600 mt-2 flex-shrink-0">{icon}</span>
      <div className="flex-1">
        <div className="text-gray-600 text-xs mb-0.5">{label}</div>
        {editing ? (
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        ) : value ? (
          href ? (
            <a href={href} className="text-blue-400 text-sm hover:underline">{value}</a>
          ) : (
            <span className="text-gray-200 text-sm">{value}</span>
          )
        ) : (
          <span className="text-gray-600 text-sm">—</span>
        )}
      </div>
    </div>
  )
}
