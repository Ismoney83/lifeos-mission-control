import { useEffect, useRef, useState } from 'react'
import { lifeos, ovb } from '../lib/supabase'
import type { Estimate, CustomerFile, ClientProject, Lead } from '../types'
import {
  X, FileText, FolderOpen, Briefcase, Edit2, Save, ExternalLink,
  Mail, MapPin, CheckCircle, Clock,
  Image, FileIcon, Upload, Phone, User
} from 'lucide-react'

interface DrawerSelection {
  id: string
  type: 'estimate' | 'lead'
}

interface Props {
  selected: DrawerSelection | null
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
    case 'new': return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
    case 'contacted': return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    case 'site_visit_scheduled': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    case 'estimate_sent': return 'text-purple-400 bg-purple-500/10 border-purple-500/30'
    case 'negotiating': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
    case 'converted': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'lost': return 'text-red-400 bg-red-500/10 border-red-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(n: number | null | undefined) {
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

// ─── Estimate Drawer ──────────────────────────────────────────────────────────

type EstimateTab = 'overview' | 'files' | 'projects'

function EstimateDrawerContent({
  estimateId,
  onClose,
}: {
  estimateId: string
  onClose: () => void
}) {
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [files, setFiles] = useState<CustomerFile[]>([])
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [relatedEstimates, setRelatedEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<EstimateTab>('overview')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Estimate>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (files.length === 0) return
    async function genUrls() {
      const urls: Record<string, string> = {}
      for (const f of files) {
        if (f.file_path) {
          const { data } = await ovb.storage.from('customer-files').createSignedUrl(f.file_path, 3600)
          if (data?.signedUrl) {
            urls[f.id] = data.signedUrl
          } else if (f.file_url) {
            urls[f.id] = f.file_url
          }
        } else if (f.file_url) {
          urls[f.id] = f.file_url
        }
      }
      setSignedUrls(urls)
    }
    genUrls()
  }, [files])

  async function loadData() {
    setLoading(true)
    setTab('overview')
    setEditing(false)

    const { data: est } = await ovb
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .single()
    if (!est) { setLoading(false); return }
    setEstimate(est)
    setEditForm(est)

    const firstName = est.customer_name?.split(' ')[0]?.trim() || ''
    const [filesRes, projectsRes, relEstRes] = await Promise.all([
      firstName
        ? ovb.from('customer_files').select('*')
            .ilike('file_name', `%${firstName}%`)
            .order('created_at', { ascending: false })
            .limit(50)
        : ovb.from('customer_files').select('*')
            .order('created_at', { ascending: false })
            .limit(50),
      ovb.from('client_projects').select('*').order('created_at', { ascending: false }).limit(20),
      ovb.from('estimates')
        .select('*')
        .ilike('customer_name', `%${est.customer_name?.split(',')[0]?.trim() || ''}%`)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    setFiles(filesRes.data || [])
    setProjects(projectsRes.data || [])
    setRelatedEstimates((relEstRes.data || []).filter((e: Estimate) => e.id !== estimateId))
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await lifeos.from('harness_tasks').insert({
        task_id: `BOB-UPDATE-${Date.now()}`,
        title: `Client record updated: ${editForm.customer_name}`,
        description: `Mission Control updated estimate for ${editForm.customer_name}. Status: ${editForm.status}. Notes: ${editForm.notes || 'none'}`,
        owner_agent: 'ralph',
        routed_to: 'ralph',
        status: 'pending',
        priority: 'normal',
      })
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadFiles = e.target.files
    if (!uploadFiles || uploadFiles.length === 0) return
    setUploading(true)
    setUploadMsg('')
    const customerName = estimate?.customer_name || 'unknown'

    for (const file of Array.from(uploadFiles)) {
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${customerName}/${timestamp}-${safeName}`

      const { error: upErr } = await ovb.storage
        .from('customer-files')
        .upload(path, file, { upsert: false })

      if (upErr) {
        setUploadMsg(`Upload failed: ${upErr.message}`)
        setUploading(false)
        return
      }

      const { data: urlData } = await ovb.storage
        .from('customer-files')
        .createSignedUrl(path, 3600)

      const signedUrl = urlData?.signedUrl || ''

      await ovb.from('customer_files').insert({
        file_name: file.name,
        file_path: path,
        file_url: signedUrl,
        file_type: file.type || null,
        file_size: file.size,
        category: 'uploaded',
        created_at: new Date().toISOString(),
      })
    }

    setUploadMsg(`${uploadFiles.length} file(s) uploaded!`)
    setTimeout(() => setUploadMsg(''), 3000)
    setUploading(false)
    // Refresh files
    const firstName = estimate?.customer_name?.split(' ')[0]?.trim() || ''
    const { data: refreshed } = firstName
      ? await ovb.from('customer_files').select('*')
          .ilike('file_name', `%${firstName}%`)
          .order('created_at', { ascending: false })
          .limit(50)
      : await ovb.from('customer_files').select('*')
          .order('created_at', { ascending: false })
          .limit(50)
    setFiles(refreshed || [])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-sm leading-tight">
                {loading ? 'Loading...' : estimate?.customer_name || 'Client'}
              </h2>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Estimate
              </span>
            </div>
            <p className="text-gray-500 text-xs">
              {estimate?.project_category || 'Project'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center transition-colors">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0">
        {([
          { key: 'overview', label: 'Overview', icon: <FileText className="w-3.5 h-3.5" /> },
          { key: 'files', label: `Files (${files.length})`, icon: <FolderOpen className="w-3.5 h-3.5" /> },
          { key: 'projects', label: `Projects (${projects.length})`, icon: <Briefcase className="w-3.5 h-3.5" /> },
        ] as { key: EstimateTab; label: string; icon: React.ReactNode }[]).map(t => (
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
          <div className="p-6 space-y-4">
            {/* Upload section */}
            <div
              className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: '#1a2035', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div>
                <div className="text-white text-sm font-medium">Upload Files</div>
                <div className="text-gray-500 text-xs mt-0.5">Add documents, photos, or contracts</div>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {uploadMsg && (
              <div className={`px-3 py-2 rounded-lg text-sm ${uploadMsg.startsWith('Upload failed') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {uploadMsg}
              </div>
            )}

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
                    href={signedUrls[file.id] || file.file_url}
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
    </>
  )
}

// ─── Lead Drawer ──────────────────────────────────────────────────────────────

type LeadTab = 'overview' | 'photos' | 'estimates'

function LeadDrawerContent({
  leadId,
  onClose,
}: {
  leadId: string
  onClose: () => void
}) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [linkedEstimates, setLinkedEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<LeadTab>('overview')
  const [editing, setEditing] = useState(false)
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  useEffect(() => {
    async function loadLead() {
      setLoading(true)
      setTab('overview')
      setEditing(false)

      const { data: l } = await ovb
        .from('quote_requests')
        .select('*')
        .eq('id', leadId)
        .single()

      if (!l) { setLoading(false); return }
      setLead(l as Lead)
      setEditStatus((l as Lead).status || 'new')
      setEditNotes(((l as Lead).intake_data as Record<string, unknown> | null)?.notes as string || '')

      const { data: ests } = await ovb
        .from('estimates')
        .select('*')
        .eq('converted_from_quote_id', leadId)
        .order('created_at', { ascending: false })
      setLinkedEstimates(ests || [])
      setLoading(false)
    }
    loadLead()
  }, [leadId])

  async function saveLead() {
    if (!lead) return
    setSaving(true)
    const newIntakeData = { ...(lead.intake_data || {}), notes: editNotes }
    const { error } = await ovb
      .from('quote_requests')
      .update({ status: editStatus, intake_data: newIntakeData })
      .eq('id', lead.id)
    setSaving(false)
    if (error) {
      setSaveMsg('Error: ' + error.message)
    } else {
      setLead({ ...lead, status: editStatus, intake_data: newIntakeData })
      setSaveMsg('Saved!')
      setEditing(false)
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  const photos = lead?.images || []

  return (
    <>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-500/10 border border-slate-500/30 flex items-center justify-center">
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-sm leading-tight">
                {loading ? 'Loading...' : lead?.name || 'Lead'}
              </h2>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30">
                Lead
              </span>
            </div>
            <p className="text-gray-500 text-xs">
              {lead?.category || 'Inquiry'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center transition-colors">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0">
        {([
          { key: 'overview', label: 'Overview', icon: <FileText className="w-3.5 h-3.5" /> },
          { key: 'photos', label: `Photos (${photos.length})`, icon: <Image className="w-3.5 h-3.5" /> },
          { key: 'estimates', label: `Estimates (${linkedEstimates.length})`, icon: <Briefcase className="w-3.5 h-3.5" /> },
        ] as { key: LeadTab; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors border-b-2 ${
              tab === t.key
                ? 'border-slate-400 text-slate-300'
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
            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !lead ? (
          <div className="p-8 text-center text-gray-500">Could not load lead</div>
        ) : tab === 'overview' ? (
          <div className="p-6 space-y-5">
            {saveMsg && (
              <div className={`px-3 py-2 rounded-lg text-sm ${saveMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {saveMsg}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyle(lead.status)}`}>
                {lead.status.replace(/_/g, ' ')}
              </span>
              <button
                onClick={() => editing ? saveLead() : setEditing(true)}
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

            {/* Contact info */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
              <h3 className="text-white text-sm font-semibold">Contact</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <User className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-gray-500 text-xs">Name</div>
                    <div className="text-gray-200 text-sm">{lead.name || '—'}</div>
                  </div>
                </div>
                {lead.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-gray-500 text-xs">Phone</div>
                      <a href={`tel:${lead.phone}`} className="text-blue-400 text-sm hover:underline">{lead.phone}</a>
                    </div>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-start gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-gray-500 text-xs">Email</div>
                      <a href={`mailto:${lead.email}`} className="text-blue-400 text-sm hover:underline">{lead.email}</a>
                    </div>
                  </div>
                )}
                {(lead.street_address || lead.city) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-gray-500 text-xs">Address</div>
                      <div className="text-gray-200 text-sm">
                        {[lead.street_address, lead.city, lead.state].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Project details */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
              <h3 className="text-white text-sm font-semibold">Project Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500 text-xs mb-1">Category</div>
                  <div className="text-gray-200">{lead.category || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">Created</div>
                  <div className="text-gray-200">{fmtDate(lead.created_at)}</div>
                </div>
              </div>
              {lead.details && (
                <div>
                  <div className="text-gray-500 text-xs mb-1">Details</div>
                  <div className="text-gray-300 text-sm whitespace-pre-wrap">{lead.details}</div>
                </div>
              )}
            </div>

            {/* Status edit */}
            {editing && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                <h3 className="text-white text-sm font-semibold">Edit Status</h3>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  {['new', 'contacted', 'site_visit_scheduled', 'estimate_sent', 'negotiating', 'converted', 'lost'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    rows={3}
                    placeholder="Add notes..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Notes from intake_data */}
            {!editing && (lead.intake_data as Record<string, unknown> | null)?.notes && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="text-white text-sm font-semibold mb-2">Notes</h3>
                <p className="text-gray-400 text-sm whitespace-pre-wrap">
                  {String((lead.intake_data as Record<string, unknown>).notes)}
                </p>
              </div>
            )}

            {/* Intake data summary */}
            {lead.intake_data && Object.keys(lead.intake_data).filter(k => k !== 'notes').length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="text-white text-sm font-semibold mb-3">Intake Data</h3>
                <div className="space-y-1.5">
                  {Object.entries(lead.intake_data)
                    .filter(([k]) => k !== 'notes')
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <span className="text-gray-500 capitalize min-w-[100px]">{k.replace(/_/g, ' ')}</span>
                        <span className="text-gray-300">{String(v)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : tab === 'photos' ? (
          <div className="p-6">
            {photos.length === 0 ? (
              <div className="text-center py-12">
                <Image className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No photos attached</p>
                <p className="text-gray-600 text-xs mt-1">Photos sent by the client via Telegram appear here</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 text-xs mb-4">{photos.length} photo{photos.length !== 1 ? 's' : ''} — click to enlarge</p>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxUrl(url)}
                      className="relative aspect-square rounded-xl overflow-hidden bg-gray-900 border border-gray-800 hover:border-blue-500/50 transition-all group"
                    >
                      <img
                        src={url}
                        alt={`Photo ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={e => {
                          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Estimates tab */
          <div className="p-6">
            {linkedEstimates.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No estimates linked</p>
                <p className="text-gray-600 text-xs mt-1">Estimates created from this lead appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {linkedEstimates.map(est => (
                  <div key={est.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-white font-medium text-sm">{est.project_category || 'Project'}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{fmtDate(est.created_at)}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyle(est.status)}`}>
                        {est.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-gray-400 text-xs">{est.project_address || '—'}</span>
                      <span className="text-emerald-400 font-bold text-sm">{fmtMoney(est.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main Drawer Wrapper ──────────────────────────────────────────────────────

export function ClientDrawer({ selected, onClose }: Props) {
  if (!selected) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-gray-950 border-l border-gray-800 z-50 flex flex-col shadow-2xl">
        {selected.type === 'estimate' ? (
          <EstimateDrawerContent estimateId={selected.id} onClose={onClose} />
        ) : (
          <LeadDrawerContent leadId={selected.id} onClose={onClose} />
        )}
      </div>
    </>
  )
}

// ─── Field Component ──────────────────────────────────────────────────────────

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
