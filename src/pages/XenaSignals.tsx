import { useEffect, useState } from 'react'
import { lifeos } from '../lib/supabase'
import type { XenaAlphaSignal, XenaContent, XenaPillar } from '../types'
import {
  Zap, Calendar, Edit3, Layers,
  Plus, Send, Clock, RefreshCw, ExternalLink,
  Twitter, Instagram, Linkedin, Youtube, Hash, Sparkles, Search
} from 'lucide-react'

type Tab = 'calendar' | 'posts' | 'creator' | 'pillars' | 'alpha'

const PLATFORMS = ['twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'threads']

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  twitter: <Twitter className="w-3.5 h-3.5" />,
  instagram: <Instagram className="w-3.5 h-3.5" />,
  linkedin: <Linkedin className="w-3.5 h-3.5" />,
  youtube: <Youtube className="w-3.5 h-3.5" />,
}

// Platform gradient thumbnails for post cards
function platformGradient(p: string): string {
  const m: Record<string, string> = {
    twitter: 'from-sky-600 to-blue-700',
    instagram: 'from-pink-600 to-purple-700',
    linkedin: 'from-blue-700 to-blue-900',
    youtube: 'from-red-600 to-red-800',
    tiktok: 'from-purple-600 to-pink-700',
    threads: 'from-gray-600 to-gray-800',
  }
  return m[p?.toLowerCase()] || 'from-purple-700 to-indigo-800'
}

// Platform circle color for selector buttons
function platformCircle(p: string): string {
  const m: Record<string, string> = {
    twitter: 'bg-sky-500 ring-sky-400',
    instagram: 'bg-gradient-to-br from-pink-500 to-purple-600 ring-pink-400',
    linkedin: 'bg-blue-600 ring-blue-400',
    youtube: 'bg-red-600 ring-red-400',
    tiktok: 'bg-purple-600 ring-purple-400',
    threads: 'bg-gray-600 ring-gray-400',
  }
  return m[p?.toLowerCase()] || 'bg-gray-600 ring-gray-400'
}


function postStatusBadge(s: string): string {
  switch (s?.toLowerCase()) {
    case 'published': return 'bg-gradient-to-r from-purple-600 to-teal-500 text-white border-0'
    case 'scheduled': return 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
    case 'draft': return 'bg-gray-700/60 text-gray-400 border border-gray-600/40'
    default: return 'bg-gray-700/60 text-gray-400 border border-gray-600/40'
  }
}

function signalStrengthGradient(strength: string): string {
  switch (strength?.toUpperCase()) {
    case 'STRONG': return 'from-emerald-500 to-green-400'
    case 'MEDIUM': return 'from-amber-500 to-yellow-400'
    case 'WEAK': return 'from-red-500 to-rose-400'
    default: return 'from-gray-600 to-gray-500'
  }
}

function signalBadgeStyle(strength: string): string {
  switch (strength?.toUpperCase()) {
    case 'STRONG': return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
    case 'MEDIUM': return 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
    case 'WEAK': return 'bg-red-500/15 text-red-300 border border-red-500/30'
    default: return 'bg-gray-700/40 text-gray-400 border border-gray-600/30'
  }
}

// Pillar gradient icon backgrounds
const PILLAR_GRADIENTS = [
  'from-purple-600 to-indigo-600',
  'from-teal-500 to-cyan-600',
  'from-pink-600 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-blue-600 to-sky-500',
  'from-emerald-500 to-green-600',
]

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getWeekDays() {
  const days = []
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d)
  }
  return days
}

const PILLAR_TEMPLATES: Record<string, string[]> = {
  BUILD_LOG: [
    "Just shipped {feature} to {project}. Here's what I learned...",
    "Day {n} of building {project} in public. Progress update:",
    "The biggest mistake I made building {feature} (and how I fixed it):",
  ],
  REVENUE: [
    "Monthly revenue update: {month} results",
    "How we grew from {old} to {new} in {time}:",
    "The {strategy} that doubled our revenue:",
  ],
  AI_TOOLS: [
    "This AI workflow saves me {hours} hours per week:",
    "I tested every AI tool for {task}. Here's the winner:",
    "How I use AI to {outcome} in my business:",
  ],
}

export function XenaSignals() {
  const [tab, setTab] = useState<Tab>('calendar')
  const [posts, setPosts] = useState<XenaContent[]>([])
  const [pillars, setPillars] = useState<XenaPillar[]>([])
  const [signals, setSignals] = useState<XenaAlphaSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [newPost, setNewPost] = useState({
    content: '',
    platform: 'twitter',
    status: 'draft',
    scheduled_at: '',
    pillar_name: '',
    hashtags: '',
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [postsRes, pillarsRes, sigRes] = await Promise.all([
      lifeos.from('xena_content').select('*').order('created_at', { ascending: false }).limit(100),
      lifeos.from('xena_pillars').select('*').order('pillar_name'),
      lifeos.from('xena_alpha_signals').select('*').order('score', { ascending: false }).limit(30),
    ])
    setPosts(postsRes.data || [])
    setPillars(pillarsRes.data || [])
    setSignals(sigRes.data || [])
    setLoading(false)
  }

  async function createPost() {
    if (!newPost.content.trim()) return
    setSaving(true)
    const { error } = await lifeos.from('xena_content').insert({
      content: newPost.content,
      platform: newPost.platform,
      status: newPost.status,
      scheduled_at: newPost.scheduled_at || null,
      pillar_name: newPost.pillar_name || null,
      hashtags: newPost.hashtags ? newPost.hashtags.split(' ').filter(Boolean) : null,
    })
    setSaving(false)
    if (!error) {
      setSaveMsg('Post saved!')
      setNewPost({ content: '', platform: 'twitter', status: 'draft', scheduled_at: '', pillar_name: '', hashtags: '' })
      await load()
      setTimeout(() => setSaveMsg(''), 2000)
    } else {
      setSaveMsg('Error: ' + error.message)
    }
  }

  const weekDays = getWeekDays()
  const publishedCount = posts.filter(p => p.status === 'published').length
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length
  const draftCount = posts.filter(p => p.status === 'draft').length
  const strongAlpha = signals.filter(s => s.signal_strength === 'STRONG').length

  const filteredPosts = posts.filter(p =>
    !searchQuery || p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.platform?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const tabs = [
    { key: 'calendar' as Tab, label: 'Calendar', emoji: '📅' },
    { key: 'posts' as Tab, label: `Posts (${posts.length})`, emoji: '📝' },
    { key: 'creator' as Tab, label: 'Creator', emoji: '✏️' },
    { key: 'pillars' as Tab, label: `Pillars (${pillars.length})`, emoji: '🏛️' },
    { key: 'alpha' as Tab, label: `Alpha (${signals.length})`, emoji: '⚡' },
  ]

  return (
    <div
      className="min-h-screen p-6 space-y-5"
      style={{ background: 'linear-gradient(135deg, #111120 0%, #1a1a2e 50%, #0f0f1e 100%)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #7B2FBE, #00C4CC)' }}
          >
            🎯
          </div>
          <div>
            <h2
              className="text-3xl font-bold bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #a78bfa, #2dd4bf)' }}
            >
              Xena Hub
            </h2>
            <p style={{ color: '#9090B0' }} className="text-sm">Content Engine & Alpha Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-xs transition-colors"
            style={{ background: '#1e1e30', border: '1px solid #2e2e45', color: '#9090B0' }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => setTab('creator')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
            style={{ background: 'linear-gradient(to right, #7B2FBE, #00C4CC)', boxShadow: '0 4px 20px rgba(123,47,190,0.4)' }}
          >
            <Plus className="w-4 h-4" /> Create Post
          </button>
        </div>
      </div>

      {/* Stats Chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Published', value: publishedCount, gradient: 'linear-gradient(to right, #7B2FBE, #00C4CC)', textColor: '#fff' },
          { label: 'Scheduled', value: scheduledCount, bg: '#2a2010', border: '#d97706', textColor: '#fbbf24' },
          { label: 'Drafts', value: draftCount, bg: '#1e1e30', border: '#2e2e45', textColor: '#9090B0' },
          { label: 'Strong Alpha', value: strongAlpha, bg: '#0d2010', border: '#059669', textColor: '#34d399' },
        ].map(s => (
          <div
            key={s.label}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={
              s.gradient
                ? { background: s.gradient, color: s.textColor, boxShadow: '0 2px 12px rgba(123,47,190,0.3)' }
                : { background: s.bg, border: `1px solid ${s.border}`, color: s.textColor }
            }
          >
            <span className="text-lg font-bold">{s.value}</span>
            <span className="opacity-80 text-xs">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div
        className="flex gap-1 p-1 rounded-full overflow-x-auto"
        style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
      >
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
            style={
              tab === t.key
                ? {
                    background: 'linear-gradient(to right, #7B2FBE, #00C4CC)',
                    color: '#fff',
                    boxShadow: '0 2px 12px rgba(123,47,190,0.5)',
                  }
                : { color: '#9090B0' }
            }
          >
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#7B2FBE', borderTopColor: 'transparent' }}
          />
          <p style={{ color: '#9090B0' }} className="text-xs">Loading your content...</p>
        </div>
      ) : (
        <>
          {/* ─── CALENDAR TAB ─── */}
          {tab === 'calendar' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base" style={{ color: '#F0F0FF' }}>7-Day Content Calendar</h3>
                <button
                  onClick={() => setTab('creator')}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white transition-transform hover:scale-105"
                  style={{ background: 'linear-gradient(to right, #7B2FBE, #00C4CC)' }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Post
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, i) => {
                  const dayStr = day.toISOString().split('T')[0]
                  const dayPosts = posts.filter(p => {
                    const postDate = (p.scheduled_at || p.published_at || p.created_at)?.split('T')[0]
                    return postDate === dayStr
                  })
                  const isToday = i === 0
                  const hasContent = dayPosts.length > 0
                  return (
                    <div
                      key={dayStr}
                      className="rounded-2xl p-3 min-h-[140px] flex flex-col transition-all"
                      style={{
                        background: isToday ? 'rgba(123,47,190,0.08)' : '#1e1e30',
                        border: isToday
                          ? '1.5px solid transparent'
                          : hasContent
                          ? '1px solid #2e2e45'
                          : '1px dashed #2e2e45',
                        backgroundImage: isToday
                          ? 'linear-gradient(#1e1e30, #1e1e30), linear-gradient(to bottom right, #7B2FBE, #00C4CC)'
                          : undefined,
                        backgroundOrigin: isToday ? 'border-box' : undefined,
                        backgroundClip: isToday ? 'padding-box, border-box' : undefined,
                      }}
                    >
                      {/* Day header */}
                      <div
                        className="rounded-xl px-2 py-1.5 mb-2 text-center"
                        style={
                          hasContent
                            ? { background: 'linear-gradient(to right, #7B2FBE40, #00C4CC30)' }
                            : {}
                        }
                      >
                        <div
                          className="text-xs font-semibold uppercase tracking-wide"
                          style={{ color: isToday ? '#a78bfa' : '#9090B0' }}
                        >
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div
                          className="text-xl font-bold"
                          style={{ color: isToday ? '#F0F0FF' : '#9090B0' }}
                        >
                          {day.getDate()}
                        </div>
                      </div>

                      <div className="flex-1 space-y-1">
                        {dayPosts.length === 0 ? (
                          <button
                            onClick={() => {
                              setTab('creator')
                              setNewPost(p => ({ ...p, scheduled_at: dayStr + 'T12:00' }))
                            }}
                            className="w-full flex items-center justify-center gap-1 py-3 rounded-xl text-xs transition-all hover:scale-105"
                            style={{ border: '1px dashed #3e3e55', color: '#3e3e55' }}
                            onMouseEnter={e => {
                              const t = e.currentTarget
                              t.style.borderColor = '#7B2FBE'
                              t.style.color = '#a78bfa'
                            }}
                            onMouseLeave={e => {
                              const t = e.currentTarget
                              t.style.borderColor = '#3e3e55'
                              t.style.color = '#3e3e55'
                            }}
                          >
                            <Plus className="w-3 h-3" /> Create
                          </button>
                        ) : dayPosts.map(p => (
                          <div
                            key={p.id}
                            className={`p-1.5 rounded-xl cursor-pointer transition-all hover:scale-105`}
                            style={{ background: `linear-gradient(to right, ${p.platform?.toLowerCase() === 'twitter' ? '#0369a120' : p.platform?.toLowerCase() === 'instagram' ? '#be185d20' : '#7B2FBE20'}, #1e1e30)`, border: '1px solid #2e2e45' }}
                            title={p.content}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <span style={{ color: '#9090B0' }}>
                                {PLATFORM_ICONS[p.platform?.toLowerCase() ?? ''] || <Layers className="w-3 h-3" />}
                              </span>
                              <span
                                className={`text-xs px-1.5 py-0 rounded-full font-medium ${postStatusBadge(p.status)}`}
                                style={{ fontSize: '9px' }}
                              >
                                {p.status}
                              </span>
                            </div>
                            <p className="text-xs leading-tight line-clamp-2" style={{ color: '#9090B0' }}>{p.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Optimal posting times */}
              {pillars.length > 0 && (
                <div
                  className="rounded-2xl p-5"
                  style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                >
                  <h3 className="font-semibold text-sm mb-3" style={{ color: '#F0F0FF' }}>Optimal Posting Times</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pillars.filter(p => p.is_active).map(pillar => (
                      <div
                        key={pillar.id}
                        className="flex items-start gap-3 p-3 rounded-xl"
                        style={{ background: '#232336', border: '1px solid #2e2e45' }}
                      >
                        <div className="flex-1">
                          <div
                            className="text-xs font-semibold bg-clip-text text-transparent"
                            style={{ backgroundImage: 'linear-gradient(to right, #a78bfa, #2dd4bf)' }}
                          >
                            {pillar.pillar_name}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: '#9090B0' }}>{pillar.posting_frequency}</div>
                          {pillar.best_days && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {pillar.best_days.map(d => (
                                <span
                                  key={d}
                                  className="text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ background: '#2e2e45', color: '#9090B0' }}
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {pillar.best_hours && (
                          <div className="text-xs text-right" style={{ color: '#9090B0' }}>
                            {pillar.best_hours.map(h => `${h}:00`).join(' · ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── POSTS TAB ─── */}
          {tab === 'posts' && (
            <div className="space-y-4">
              {/* Search bar */}
              <div
                className="flex items-center gap-3 px-4 py-2.5 rounded-full"
                style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
              >
                <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#9090B0' }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search posts, platforms..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder-gray-600"
                  style={{ color: '#F0F0FF' }}
                />
              </div>

              {filteredPosts.length === 0 ? (
                <div
                  className="rounded-2xl p-16 text-center"
                  style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'linear-gradient(135deg, #7B2FBE20, #00C4CC20)', border: '1px solid #2e2e45' }}
                  >
                    <Edit3 className="w-8 h-8" style={{ color: '#7B2FBE' }} />
                  </div>
                  <p className="font-semibold mb-1" style={{ color: '#F0F0FF' }}>No content yet</p>
                  <p className="text-xs mb-4" style={{ color: '#9090B0' }}>Create your first post in the Creator tab</p>
                  <button
                    onClick={() => setTab('creator')}
                    className="px-5 py-2 rounded-full text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(to right, #7B2FBE, #00C4CC)' }}
                  >
                    Open Creator
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPosts.map(post => (
                    <div
                      key={post.id}
                      className="rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02] cursor-pointer group"
                      style={{
                        background: '#1e1e30',
                        border: '1px solid #2e2e45',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(123,47,190,0.3)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
                      }}
                    >
                      {/* Gradient thumbnail */}
                      <div
                        className={`h-24 bg-gradient-to-br ${platformGradient(post.platform ?? '')} relative flex items-center justify-center`}
                      >
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_white_0%,_transparent_70%)]" />
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
                        >
                          <span className="text-white">
                            {PLATFORM_ICONS[post.platform?.toLowerCase() ?? ''] || <Layers className="w-5 h-5 text-white" />}
                          </span>
                        </div>
                        {post.pillar_name && (
                          <span
                            className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', backdropFilter: 'blur(4px)' }}
                          >
                            {post.pillar_name}
                          </span>
                        )}
                      </div>

                      {/* Card body */}
                      <div className="p-4">
                        <p
                          className="text-sm leading-relaxed line-clamp-3 mb-3"
                          style={{ color: '#F0F0FF' }}
                        >
                          {post.content}
                        </p>
                        {post.hashtags && post.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {post.hashtags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="text-xs" style={{ color: '#a78bfa' }}>
                                #{tag.replace('#', '')}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Bottom bar */}
                        <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid #2e2e45' }}>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${postStatusBadge(post.status)}`}>
                            {post.status}
                          </span>
                          <span className="text-xs" style={{ color: '#9090B0' }}>
                            {post.scheduled_at ? fmtDateTime(post.scheduled_at) : fmtDate(post.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── CREATOR TAB ─── */}
          {tab === 'creator' && (
            <div className="space-y-4">
              {saveMsg && (
                <div
                  className="px-4 py-3 rounded-2xl text-sm font-medium"
                  style={
                    saveMsg.startsWith('Error')
                      ? { background: '#2d0a0a', border: '1px solid #ef444440', color: '#f87171' }
                      : { background: 'linear-gradient(to right, #7B2FBE20, #00C4CC20)', border: '1px solid #7B2FBE40', color: '#a78bfa' }
                  }
                >
                  {saveMsg}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Editor — 2/3 width */}
                <div className="lg:col-span-2 space-y-4">
                  <div
                    className="rounded-2xl p-5"
                    style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                  >
                    <label className="text-xs font-semibold uppercase tracking-wide block mb-3" style={{ color: '#9090B0' }}>
                      Content
                    </label>
                    <textarea
                      value={newPost.content}
                      onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                      rows={10}
                      placeholder={`Write your post content here...\n\nStart with a hook that stops the scroll.\nShare the insight or story.\nEnd with a CTA or question.`}
                      className="w-full rounded-xl px-4 py-3 text-sm resize-none leading-relaxed outline-none transition-all"
                      style={{
                        background: '#232336',
                        border: '1.5px solid #2e2e45',
                        color: '#F0F0FF',
                      }}
                      onFocus={e => {
                        e.target.style.border = '1.5px solid rgba(123,47,190,0.6)'
                        e.target.style.boxShadow = '0 0 0 3px rgba(123,47,190,0.15)'
                      }}
                      onBlur={e => {
                        e.target.style.border = '1.5px solid #2e2e45'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs" style={{ color: '#9090B0' }}>{newPost.content.length} chars</span>
                      {newPost.platform === 'twitter' && (
                        <span
                          className="text-xs font-medium"
                          style={{ color: newPost.content.length > 280 ? '#f87171' : '#9090B0' }}
                        >
                          {280 - newPost.content.length} left
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Platform selector — colored circles */}
                  <div
                    className="rounded-2xl p-4"
                    style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                  >
                    <label className="text-xs font-semibold uppercase tracking-wide block mb-3" style={{ color: '#9090B0' }}>
                      Platform
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {PLATFORMS.map(p => (
                        <button
                          key={p}
                          onClick={() => setNewPost(prev => ({ ...prev, platform: p }))}
                          className="flex flex-col items-center gap-1.5 transition-all hover:scale-110"
                          title={p}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${platformCircle(p)} transition-all`}
                            style={
                              newPost.platform === p
                                ? { boxShadow: '0 0 0 3px rgba(167,139,250,0.6)', transform: 'scale(1.15)' }
                                : { opacity: 0.6 }
                            }
                          >
                            {PLATFORM_ICONS[p] || <Hash className="w-4 h-4" />}
                          </div>
                          <span
                            className="text-xs capitalize"
                            style={{ color: newPost.platform === p ? '#a78bfa' : '#9090B0' }}
                          >
                            {p}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hashtags */}
                  <div
                    className="rounded-2xl p-4"
                    style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                  >
                    <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: '#9090B0' }}>
                      Hashtags
                    </label>
                    <input
                      value={newPost.hashtags}
                      onChange={e => setNewPost(p => ({ ...p, hashtags: e.target.value }))}
                      placeholder="#buildinpublic #ai #saas"
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{
                        background: '#232336',
                        border: '1.5px solid #2e2e45',
                        color: '#F0F0FF',
                      }}
                      onFocus={e => {
                        e.target.style.border = '1.5px solid rgba(123,47,190,0.6)'
                      }}
                      onBlur={e => {
                        e.target.style.border = '1.5px solid #2e2e45'
                      }}
                    />
                  </div>

                  {/* Templates section */}
                  {newPost.pillar_name && PILLAR_TEMPLATES[newPost.pillar_name] && (
                    <div
                      className="rounded-2xl p-4"
                      style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4" style={{ color: '#a78bfa' }} />
                        <h3 className="font-semibold text-sm" style={{ color: '#F0F0FF' }}>
                          Templates for {newPost.pillar_name}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {PILLAR_TEMPLATES[newPost.pillar_name].map((tmpl, i) => (
                          <button
                            key={i}
                            onClick={() => setNewPost(p => ({ ...p, content: tmpl }))}
                            className="text-left p-3 rounded-xl transition-all hover:scale-[1.02]"
                            style={{
                              background: `linear-gradient(to right, ${i === 0 ? '#7B2FBE' : i === 1 ? '#00C4CC' : '#6366f1'}20, #232336)`,
                              border: '1px solid #2e2e45',
                            }}
                          >
                            <p className="text-xs leading-relaxed" style={{ color: '#9090B0' }}>{tmpl}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Settings Panel — 1/3 width */}
                <div className="space-y-3">
                  {/* Status */}
                  <div
                    className="rounded-2xl p-4"
                    style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                  >
                    <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: '#9090B0' }}>
                      Status
                    </label>
                    <select
                      value={newPost.status}
                      onChange={e => setNewPost(p => ({ ...p, status: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none appearance-none"
                      style={{
                        background: '#232336',
                        border: '1.5px solid #2e2e45',
                        color: '#F0F0FF',
                      }}
                    >
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="published">Published</option>
                    </select>
                  </div>

                  {/* Schedule datetime */}
                  {newPost.status === 'scheduled' && (
                    <div
                      className="rounded-2xl p-4"
                      style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                    >
                      <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: '#9090B0' }}>
                        Schedule Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={newPost.scheduled_at}
                        onChange={e => setNewPost(p => ({ ...p, scheduled_at: e.target.value }))}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={{
                          background: '#232336',
                          border: '1.5px solid #2e2e45',
                          color: '#F0F0FF',
                        }}
                      />
                    </div>
                  )}

                  {/* Content Pillar */}
                  <div
                    className="rounded-2xl p-4"
                    style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                  >
                    <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: '#9090B0' }}>
                      Content Pillar
                    </label>
                    <select
                      value={newPost.pillar_name}
                      onChange={e => setNewPost(p => ({ ...p, pillar_name: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none appearance-none"
                      style={{
                        background: '#232336',
                        border: '1.5px solid #2e2e45',
                        color: '#F0F0FF',
                      }}
                    >
                      <option value="">No pillar</option>
                      {pillars.map(p => (
                        <option key={p.id} value={p.pillar_name}>{p.pillar_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Post preview info */}
                  <div
                    className="rounded-2xl p-4"
                    style={{ background: 'linear-gradient(135deg, #7B2FBE15, #00C4CC10)', border: '1px solid #7B2FBE30' }}
                  >
                    <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#9090B0' }}>Preview</div>
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${platformCircle(newPost.platform)}`}
                        style={{ fontSize: 10 }}
                      >
                        {PLATFORM_ICONS[newPost.platform] || <Hash className="w-3 h-3" />}
                      </div>
                      <span className="text-xs capitalize font-medium" style={{ color: '#F0F0FF' }}>{newPost.platform}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ml-auto font-medium ${postStatusBadge(newPost.status)}`}
                      >
                        {newPost.status}
                      </span>
                    </div>
                    {newPost.pillar_name && (
                      <span
                        className="inline-block text-xs px-2 py-0.5 rounded-full mt-1"
                        style={{ background: '#7B2FBE25', color: '#a78bfa', border: '1px solid #7B2FBE40' }}
                      >
                        {newPost.pillar_name}
                      </span>
                    )}
                  </div>

                  {/* Save button */}
                  <button
                    onClick={createPost}
                    disabled={!newPost.content.trim() || saving}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      background: 'linear-gradient(to right, #7B2FBE, #00C4CC)',
                      boxShadow: '0 4px 20px rgba(123,47,190,0.4)',
                    }}
                  >
                    <Send className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Post'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── PILLARS TAB ─── */}
          {tab === 'pillars' && (
            <div className="space-y-4">
              {pillars.length === 0 ? (
                <div
                  className="rounded-2xl p-16 text-center"
                  style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'linear-gradient(135deg, #7B2FBE, #00C4CC)' }}
                  >
                    <Hash className="w-8 h-8 text-white" />
                  </div>
                  <p className="font-semibold" style={{ color: '#F0F0FF' }}>No pillars defined</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pillars.map((pillar, idx) => {
                    const pillarPosts = posts.filter(p => p.pillar_name === pillar.pillar_name)
                    const gradientClass = PILLAR_GRADIENTS[idx % PILLAR_GRADIENTS.length]
                    return (
                      <div
                        key={pillar.id}
                        className="rounded-2xl p-5 transition-all hover:scale-[1.01]"
                        style={{
                          background: '#1e1e30',
                          border: `1px solid ${pillar.is_active ? '#7B2FBE40' : '#2e2e45'}`,
                          opacity: pillar.is_active ? 1 : 0.6,
                        }}
                      >
                        {/* Icon + Title */}
                        <div className="flex items-start gap-3 mb-4">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${gradientClass} flex-shrink-0`}
                          >
                            <Hash className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate" style={{ color: '#F0F0FF' }}>{pillar.pillar_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  pillar.is_active
                                    ? 'text-white'
                                    : 'bg-gray-700 text-gray-400'
                                }`}
                                style={pillar.is_active ? { background: 'linear-gradient(to right, #7B2FBE, #00C4CC)' } : {}}
                              >
                                {pillar.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: '#7B2FBE20', color: '#a78bfa', border: '1px solid #7B2FBE30' }}
                              >
                                {pillarPosts.length} posts
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {pillar.description && (
                          <p className="text-xs leading-relaxed mb-4 line-clamp-2" style={{ color: '#9090B0' }}>
                            {pillar.description}
                          </p>
                        )}

                        {/* Stats */}
                        <div className="space-y-2">
                          {pillar.posting_frequency && (
                            <div className="flex items-center gap-2 text-xs">
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#7B2FBE' }} />
                              <span style={{ color: '#9090B0' }}>{pillar.posting_frequency}</span>
                            </div>
                          )}
                          {pillar.best_days && pillar.best_days.length > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#00C4CC' }} />
                              <div className="flex gap-1 flex-wrap">
                                {pillar.best_days.map(d => (
                                  <span
                                    key={d}
                                    className="px-1.5 py-0.5 rounded-full"
                                    style={{ background: '#2e2e45', color: '#9090B0' }}
                                  >
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {pillar.best_hours && pillar.best_hours.length > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <span style={{ color: '#00C4CC' }}>⏰</span>
                              <span style={{ color: '#9090B0' }}>
                                Best: {pillar.best_hours.map(h => `${h}:00`).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* CTA */}
                        {PILLAR_TEMPLATES[pillar.pillar_name] && (
                          <button
                            onClick={() => {
                              setTab('creator')
                              setNewPost(p => ({ ...p, pillar_name: pillar.pillar_name }))
                            }}
                            className="mt-4 w-full py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                            style={{
                              background: 'transparent',
                              border: '1px solid #7B2FBE60',
                              color: '#a78bfa',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#7B2FBE20'
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                            }}
                          >
                            Create content for this pillar →
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── ALPHA TAB ─── */}
          {tab === 'alpha' && (
            <div className="space-y-4">
              {/* Summary chips */}
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="text-xs px-3 py-1.5 rounded-full"
                  style={{ background: '#1e1e30', border: '1px solid #2e2e45', color: '#9090B0' }}
                >
                  {signals.length} total signals
                </span>
                <span
                  className="text-xs px-3 py-1.5 rounded-full"
                  style={{ background: '#0d2010', border: '1px solid #059669', color: '#34d399' }}
                >
                  {signals.filter(s => s.signal_strength === 'STRONG').length} strong
                </span>
                <span
                  className="text-xs px-3 py-1.5 rounded-full"
                  style={{ background: '#1e1e30', border: '1px solid #2e2e45', color: '#9090B0' }}
                >
                  {signals.filter(s => s.on_chain_confirmed).length} on-chain confirmed
                </span>
              </div>

              {signals.length === 0 ? (
                <div
                  className="rounded-2xl p-16 text-center"
                  style={{ background: '#1e1e30', border: '1px solid #2e2e45' }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'linear-gradient(135deg, #7B2FBE, #00C4CC)' }}
                  >
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <p style={{ color: '#9090B0' }}>No alpha signals yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {signals.map(sig => {
                    const scorePercent = sig.score != null ? Math.min((sig.score / 10) * 100, 100) : 0
                    const gradientClass = signalStrengthGradient(sig.signal_strength)
                    return (
                      <div
                        key={sig.id}
                        className="rounded-2xl overflow-hidden transition-all hover:scale-[1.02]"
                        style={{
                          background: '#1e1e30',
                          border: '1px solid #2e2e45',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(123,47,190,0.25)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
                        }}
                      >
                        {/* Gradient accent bar based on signal strength */}
                        <div
                          className={`h-1.5 bg-gradient-to-r ${gradientClass}`}
                        />

                        <div className="p-4">
                          {/* Header row */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="text-xl font-bold" style={{ color: '#F0F0FF' }}>
                                {sig.token_symbol}
                              </div>
                              {sig.signal_type && (
                                <div className="text-xs mt-0.5" style={{ color: '#9090B0' }}>{sig.signal_type}</div>
                              )}
                            </div>

                            {/* Score circle */}
                            {sig.score != null && (
                              <div className="relative w-12 h-12 flex-shrink-0">
                                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                                  <circle
                                    cx="18" cy="18" r="15.9"
                                    fill="none"
                                    stroke="#2e2e45"
                                    strokeWidth="3"
                                  />
                                  <circle
                                    cx="18" cy="18" r="15.9"
                                    fill="none"
                                    stroke="url(#scoreGrad)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeDasharray={`${scorePercent} 100`}
                                  />
                                  <defs>
                                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                      <stop offset="0%" stopColor="#7B2FBE" />
                                      <stop offset="100%" stopColor="#00C4CC" />
                                    </linearGradient>
                                  </defs>
                                </svg>
                                <div
                                  className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                                  style={{ color: '#F0F0FF' }}
                                >
                                  {sig.score.toFixed(1)}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Signal strength badge */}
                          <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-semibold mb-3 ${signalBadgeStyle(sig.signal_strength)}`}>
                            {sig.signal_strength}
                          </span>

                          {/* Post content preview */}
                          {sig.post_content && (
                            <p
                              className="text-xs leading-relaxed line-clamp-2 mb-3"
                              style={{ color: '#9090B0' }}
                            >
                              {sig.post_content}
                            </p>
                          )}

                          {/* Footer */}
                          <div
                            className="flex items-center gap-2 flex-wrap pt-3"
                            style={{ borderTop: '1px solid #2e2e45' }}
                          >
                            {sig.source_account && (
                              <span className="text-xs" style={{ color: '#9090B0' }}>{sig.source_account}</span>
                            )}
                            {sig.caller_win_rate != null && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: '#2e2e45', color: '#9090B0' }}
                              >
                                WR: {(sig.caller_win_rate * 100).toFixed(0)}%
                              </span>
                            )}
                            {sig.on_chain_confirmed && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full ml-auto"
                                style={{ background: '#0d2010', border: '1px solid #059669', color: '#34d399' }}
                              >
                                On-chain ✓
                              </span>
                            )}
                          </div>

                          {/* Links */}
                          {sig.token_mint && (
                            <div className="flex gap-3 mt-2">
                              <a
                                href={`https://dexscreener.com/solana/${sig.token_mint}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
                                style={{ color: '#00C4CC' }}
                              >
                                DexScreener <ExternalLink className="w-3 h-3" />
                              </a>
                              <a
                                href={`https://birdeye.so/token/${sig.token_mint}?chain=solana`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
                                style={{ color: '#a78bfa' }}
                              >
                                Birdeye <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          {/* Timestamp */}
                          <div className="mt-2 text-xs" style={{ color: '#9090B0' }}>
                            {new Date(sig.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
