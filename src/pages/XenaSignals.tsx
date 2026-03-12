import { useEffect, useState } from 'react'
import { lifeos } from '../lib/supabase'
import type { XenaAlphaSignal, XenaContent, XenaPillar } from '../types'
import {
  Zap, Calendar, Edit3, Layers,
  Plus, Send, Clock, RefreshCw, ExternalLink,
  Twitter, Instagram, Linkedin, Youtube, Hash, Sparkles
} from 'lucide-react'

type Tab = 'calendar' | 'posts' | 'creator' | 'pillars' | 'alpha'

const PLATFORMS = ['twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'threads']
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  twitter: <Twitter className="w-3.5 h-3.5" />,
  instagram: <Instagram className="w-3.5 h-3.5" />,
  linkedin: <Linkedin className="w-3.5 h-3.5" />,
  youtube: <Youtube className="w-3.5 h-3.5" />,
}

function platformColor(p: string) {
  const m: Record<string, string> = {
    twitter: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    instagram: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
    linkedin: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    youtube: 'text-red-400 bg-red-500/10 border-red-500/30',
    tiktok: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    threads: 'text-gray-300 bg-gray-500/10 border-gray-500/30',
  }
  return m[p?.toLowerCase()] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'
}

function postStatusColor(s: string) {
  switch (s?.toLowerCase()) {
    case 'published': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'scheduled': return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    case 'draft': return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

function signalBadge(strength: string) {
  switch (strength?.toUpperCase()) {
    case 'STRONG': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    case 'WEAK': return 'text-red-400 bg-red-500/10 border-red-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Get the next 7 days for the calendar
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

  // Creator state
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

  const tabs = [
    { key: 'calendar' as Tab, label: 'Calendar', icon: <Calendar className="w-3.5 h-3.5" /> },
    { key: 'posts' as Tab, label: `Posts (${posts.length})`, icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'creator' as Tab, label: 'Creator', icon: <Edit3 className="w-3.5 h-3.5" /> },
    { key: 'pillars' as Tab, label: `Pillars (${pillars.length})`, icon: <Hash className="w-3.5 h-3.5" /> },
    { key: 'alpha' as Tab, label: `Alpha (${signals.length})`, icon: <Zap className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
            <span className="text-xl">🎯</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Xena Hub</h2>
            <p className="text-gray-500 text-sm">Content Engine & Alpha Intelligence</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 text-xs transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Published', value: publishedCount, color: 'text-emerald-400', dot: 'bg-emerald-500' },
          { label: 'Scheduled', value: scheduledCount, color: 'text-blue-400', dot: 'bg-blue-500' },
          { label: 'Drafts', value: draftCount, color: 'text-gray-400', dot: 'bg-gray-500' },
          { label: 'Strong Alpha', value: strongAlpha, color: 'text-pink-400', dot: 'bg-pink-500' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${s.dot} flex-shrink-0`} />
            <div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-gray-500 text-xs">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              tab === t.key
                ? 'bg-pink-500/10 text-pink-400 border border-pink-500/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* CALENDAR TAB */}
          {tab === 'calendar' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">7-Day Content Calendar</h3>
                <button
                  onClick={() => setTab('creator')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-lg text-xs font-medium hover:bg-pink-500/20 transition-colors"
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
                  return (
                    <div
                      key={dayStr}
                      className={`rounded-xl border p-3 min-h-[120px] ${
                        isToday
                          ? 'bg-pink-500/5 border-pink-500/30'
                          : 'bg-gray-900 border-gray-800'
                      }`}
                    >
                      <div className="mb-2">
                        <div className={`text-xs font-semibold ${isToday ? 'text-pink-400' : 'text-gray-400'}`}>
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-lg font-bold ${isToday ? 'text-white' : 'text-gray-400'}`}>
                          {day.getDate()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        {dayPosts.length === 0 ? (
                          <button
                            onClick={() => { setTab('creator'); setNewPost(p => ({ ...p, scheduled_at: dayStr + 'T12:00' })) }}
                            className="w-full text-center py-2 border border-dashed border-gray-700 rounded-lg text-gray-700 text-xs hover:border-pink-500/40 hover:text-pink-500/60 transition-colors"
                          >
                            +
                          </button>
                        ) : dayPosts.map(p => (
                          <div
                            key={p.id}
                            className="p-1.5 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
                            title={p.content}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-gray-500">{PLATFORM_ICONS[p.platform?.toLowerCase() ?? ''] || <Layers className="w-3 h-3" />}</span>
                              <span className={`text-xs px-1 rounded ${postStatusColor(p.status)}`}>{p.status}</span>
                            </div>
                            <p className="text-gray-400 text-xs leading-tight line-clamp-2">{p.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Posting Schedule from Pillars */}
              {pillars.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <h3 className="text-white font-semibold text-sm mb-3">Optimal Posting Times</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pillars.filter(p => p.is_active).map(pillar => (
                      <div key={pillar.id} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex-1">
                          <div className="text-pink-400 text-xs font-semibold">{pillar.pillar_name}</div>
                          <div className="text-gray-400 text-xs mt-0.5">{pillar.posting_frequency}</div>
                          {pillar.best_days && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {pillar.best_days.map(d => (
                                <span key={d} className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">{d}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {pillar.best_hours && (
                          <div className="text-gray-600 text-xs text-right">
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

          {/* POSTS TAB */}
          {tab === 'posts' && (
            <div className="space-y-3">
              {posts.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
                  <Edit3 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No content yet</p>
                  <p className="text-gray-600 text-xs mt-1">Create your first post in the Creator tab</p>
                  <button
                    onClick={() => setTab('creator')}
                    className="mt-4 px-4 py-2 bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-lg text-sm hover:bg-pink-500/20 transition-colors"
                  >
                    Go to Creator
                  </button>
                </div>
              ) : posts.map(post => (
                <div key={post.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {post.platform && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${platformColor(post.platform)}`}>
                            {PLATFORM_ICONS[post.platform.toLowerCase()]}
                            {post.platform}
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${postStatusColor(post.status)}`}>
                          {post.status}
                        </span>
                        {post.pillar_name && (
                          <span className="text-xs text-pink-400 bg-pink-500/5 px-2 py-0.5 rounded-full border border-pink-500/20">
                            {post.pillar_name}
                          </span>
                        )}
                        <span className="text-gray-600 text-xs ml-auto">
                          {post.scheduled_at ? `Scheduled: ${fmtDateTime(post.scheduled_at)}` : fmtDate(post.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {post.hashtags.map((tag, i) => (
                            <span key={i} className="text-pink-400/70 text-xs">#{tag.replace('#', '')}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CREATOR TAB */}
          {tab === 'creator' && (
            <div className="space-y-4">
              {saveMsg && (
                <div className={`px-4 py-3 rounded-lg text-sm ${saveMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                  {saveMsg}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main editor */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <label className="text-gray-400 text-xs font-medium block mb-2">Content</label>
                    <textarea
                      value={newPost.content}
                      onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                      rows={8}
                      placeholder="Write your post content here...

Start with a hook that stops the scroll.
Share the insight or story.
End with a CTA or question."
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-pink-500 resize-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-gray-600 text-xs">{newPost.content.length} chars</span>
                      {newPost.platform === 'twitter' && (
                        <span className={`text-xs ${newPost.content.length > 280 ? 'text-red-400' : 'text-gray-500'}`}>
                          {280 - newPost.content.length} left
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hashtags */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <label className="text-gray-400 text-xs font-medium block mb-2">Hashtags</label>
                    <input
                      value={newPost.hashtags}
                      onChange={e => setNewPost(p => ({ ...p, hashtags: e.target.value }))}
                      placeholder="#buildinpublic #ai #saas"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                {/* Settings Panel */}
                <div className="space-y-3">
                  {/* Platform */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <label className="text-gray-400 text-xs font-medium block mb-2">Platform</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PLATFORMS.map(p => (
                        <button
                          key={p}
                          onClick={() => setNewPost(prev => ({ ...prev, platform: p }))}
                          className={`py-2 px-2 rounded-lg text-xs font-medium capitalize transition-all ${
                            newPost.platform === p
                              ? platformColor(p)
                              : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <label className="text-gray-400 text-xs font-medium block mb-2">Status</label>
                    <select
                      value={newPost.status}
                      onChange={e => setNewPost(p => ({ ...p, status: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
                    >
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="published">Published</option>
                    </select>
                  </div>

                  {/* Schedule */}
                  {newPost.status === 'scheduled' && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <label className="text-gray-400 text-xs font-medium block mb-2">Schedule Date & Time</label>
                      <input
                        type="datetime-local"
                        value={newPost.scheduled_at}
                        onChange={e => setNewPost(p => ({ ...p, scheduled_at: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  )}

                  {/* Pillar */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <label className="text-gray-400 text-xs font-medium block mb-2">Content Pillar</label>
                    <select
                      value={newPost.pillar_name}
                      onChange={e => setNewPost(p => ({ ...p, pillar_name: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
                    >
                      <option value="">No pillar</option>
                      {pillars.map(p => (
                        <option key={p.id} value={p.pillar_name}>{p.pillar_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Save button */}
                  <button
                    onClick={createPost}
                    disabled={!newPost.content.trim() || saving}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-xl font-medium hover:bg-pink-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Post'}
                  </button>
                </div>
              </div>

              {/* Templates */}
              {newPost.pillar_name && PILLAR_TEMPLATES[newPost.pillar_name] && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    <h3 className="text-white font-semibold text-sm">Templates for {newPost.pillar_name}</h3>
                  </div>
                  <div className="space-y-2">
                    {PILLAR_TEMPLATES[newPost.pillar_name].map((tmpl, i) => (
                      <button
                        key={i}
                        onClick={() => setNewPost(p => ({ ...p, content: tmpl }))}
                        className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <p className="text-gray-300 text-xs">{tmpl}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PILLARS TAB */}
          {tab === 'pillars' && (
            <div className="space-y-4">
              {pillars.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
                  <Hash className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No pillars defined</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pillars.map(pillar => {
                    const pillarPosts = posts.filter(p => p.pillar_name === pillar.pillar_name)
                    return (
                      <div
                        key={pillar.id}
                        className={`bg-gray-900 border rounded-xl p-5 ${
                          pillar.is_active ? 'border-pink-500/20' : 'border-gray-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-white font-semibold">{pillar.pillar_name}</h3>
                            {!pillar.is_active && (
                              <span className="text-xs text-gray-600">Inactive</span>
                            )}
                          </div>
                          <span className="text-pink-400 text-xs bg-pink-500/10 px-2 py-1 rounded-lg">
                            {pillarPosts.length} posts
                          </span>
                        </div>
                        {pillar.description && (
                          <p className="text-gray-400 text-xs mb-3 leading-relaxed">{pillar.description}</p>
                        )}
                        <div className="space-y-2">
                          {pillar.posting_frequency && (
                            <div className="flex items-center gap-2 text-xs">
                              <Clock className="w-3.5 h-3.5 text-gray-600" />
                              <span className="text-gray-400">{pillar.posting_frequency}</span>
                            </div>
                          )}
                          {pillar.best_days && pillar.best_days.length > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="w-3.5 h-3.5 text-gray-600" />
                              <div className="flex gap-1 flex-wrap">
                                {pillar.best_days.map(d => (
                                  <span key={d} className="text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">{d}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {pillar.best_hours && pillar.best_hours.length > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-gray-600 w-3.5 text-center">⏰</span>
                              <span className="text-gray-400">
                                Best times: {pillar.best_hours.map(h => `${h}:00`).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                        {PILLAR_TEMPLATES[pillar.pillar_name] && (
                          <button
                            onClick={() => { setTab('creator'); setNewPost(p => ({ ...p, pillar_name: pillar.pillar_name })) }}
                            className="mt-3 w-full py-1.5 bg-pink-500/5 border border-pink-500/20 text-pink-400 rounded-lg text-xs hover:bg-pink-500/10 transition-colors"
                          >
                            Create post for this pillar →
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ALPHA TAB */}
          {tab === 'alpha' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">{signals.length} total signals</span>
                <span className="text-gray-600">·</span>
                <span className="text-emerald-400">{signals.filter(s => s.signal_strength === 'STRONG').length} strong</span>
                <span className="text-gray-600">·</span>
                <span className="text-gray-400">{signals.filter(s => s.on_chain_confirmed).length} on-chain confirmed</span>
              </div>

              {signals.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
                  <Zap className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-400">No alpha signals yet</p>
                </div>
              ) : signals.map(sig => (
                <div key={sig.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-sm">{sig.token_symbol}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${signalBadge(sig.signal_strength)}`}>
                          {sig.signal_strength}
                        </span>
                        {sig.signal_type && (
                          <span className="text-gray-500 text-xs">{sig.signal_type}</span>
                        )}
                        {sig.score != null && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-pink-500 to-emerald-500 rounded-full"
                                style={{ width: `${Math.min((sig.score / 10) * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-yellow-400 text-xs font-medium">{sig.score.toFixed(1)}</span>
                          </div>
                        )}
                        <span className="text-gray-600 text-xs ml-auto">
                          {new Date(sig.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {sig.post_content && (
                        <p className="text-gray-500 text-xs mt-2 leading-relaxed line-clamp-2">{sig.post_content}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {sig.source_account && <span className="text-gray-600 text-xs">{sig.source_account}</span>}
                        {sig.caller_win_rate != null && (
                          <span className="text-gray-500 text-xs">WR: {(sig.caller_win_rate * 100).toFixed(0)}%</span>
                        )}
                        {sig.on_chain_confirmed && <span className="text-emerald-500 text-xs">On-chain ✓</span>}
                        {sig.token_mint && (
                          <a
                            href={`https://dexscreener.com/solana/${sig.token_mint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 text-xs flex items-center gap-1 hover:underline"
                          >
                            DexScreener <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {sig.token_mint && (
                          <a
                            href={`https://birdeye.so/token/${sig.token_mint}?chain=solana`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 text-xs flex items-center gap-1 hover:underline"
                          >
                            Birdeye <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
