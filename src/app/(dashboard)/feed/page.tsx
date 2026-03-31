'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Message = {
  id: string
  recipient_id: string
  sender_id: string | null
  type: 'marketing' | 'feed' | 'system'
  subject: string | null
  body: string | null
  price_paid: number | null
  feed_item_id: string | null
  feed_source_profile_id: string | null
  feed_item_title: string | null
  feed_item_summary: string | null
  feed_item_type: string | null
  read: boolean
  blocked: boolean
  created_at: string
  // Joined fields
  sender_display_name?: string
  sender_handle?: string
  feed_source_display_name?: string
  feed_source_handle?: string
}

type FilterTab = 'all' | 'marketing' | 'feed' | 'system'

export default function Feed() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchMessages = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!profile) return
    setProfileId(profile.id)

    // Fetch messages for this profile, excluding blocked
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*')
      .eq('recipient_id', profile.id)
      .eq('blocked', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching messages:', error)
      setLoading(false)
      return
    }

    if (msgs && msgs.length > 0) {
      // Collect sender IDs and feed source IDs for display names
      const senderIds = [...new Set(msgs.filter(m => m.sender_id).map(m => m.sender_id!))]
      const feedSourceIds = [...new Set(msgs.filter(m => m.feed_source_profile_id).map(m => m.feed_source_profile_id!))]
      const allProfileIds = [...new Set([...senderIds, ...feedSourceIds])]

      let profileMap: Record<string, { display_name: string; handle: string | null }> = {}
      if (allProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, handle')
          .in('id', allProfileIds)

        if (profiles) {
          profiles.forEach(p => {
            profileMap[p.id] = { display_name: p.display_name, handle: p.handle }
          })
        }
      }

      const enriched: Message[] = msgs.map(m => ({
        ...m,
        sender_display_name: m.sender_id ? profileMap[m.sender_id]?.display_name : undefined,
        sender_handle: m.sender_id ? profileMap[m.sender_id]?.handle : undefined,
        feed_source_display_name: m.feed_source_profile_id ? profileMap[m.feed_source_profile_id]?.display_name : undefined,
        feed_source_handle: m.feed_source_profile_id ? profileMap[m.feed_source_profile_id]?.handle : undefined,
      }))

      setMessages(enriched)
    } else {
      setMessages([])
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Subscribe to realtime changes on messages table
  useEffect(() => {
    if (!profileId) return

    const channel = supabase
      .channel('messages-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${profileId}`,
        },
        () => {
          fetchMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${profileId}`,
        },
        () => {
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profileId, supabase, fetchMessages])

  const toggleRead = async (msg: Message) => {
    const { error } = await supabase
      .from('messages')
      .update({ read: !msg.read })
      .eq('id', msg.id)

    if (!error) {
      setMessages(prev =>
        prev.map(m => m.id === msg.id ? { ...m, read: !m.read } : m)
      )
    }
  }

  const blockSender = async (msg: Message) => {
    if (!msg.sender_id) return

    // Block all messages from this sender
    const { error } = await supabase
      .from('messages')
      .update({ blocked: true })
      .eq('recipient_id', profileId!)
      .eq('sender_id', msg.sender_id)

    if (!error) {
      setMessages(prev => prev.filter(m => m.sender_id !== msg.sender_id))
    }
  }

  const filtered = messages.filter(m => {
    if (activeTab === 'all') return true
    return m.type === activeTab
  })

  const unreadCount = (tab: FilterTab) => {
    const msgs = tab === 'all' ? messages : messages.filter(m => m.type === tab)
    return msgs.filter(m => !m.read).length
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'marketing', label: 'Marketing' },
    { key: 'feed', label: 'Feed' },
    { key: 'system', label: 'System' },
  ]

  return (
    <div className="p-8">
      <div className="max-w-[960px]">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-[32px] font-bold mb-1">Feed</h1>
          <p className="font-body text-sm text-[#767676]">
            Marketing messages, content subscriptions, and system notifications.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mb-4 border-b border-[#d4d4d4]">
          {tabs.map(tab => {
            const count = unreadCount(tab.key)
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  font-body text-sm font-medium px-4 py-2.5 border-b-2 transition-all cursor-pointer
                  ${activeTab === tab.key
                    ? 'border-[#1a3a6b] text-[#1a3a6b]'
                    : 'border-transparent text-[#767676] hover:text-[#1a1a1a] hover:border-[#d4d4d4]'
                  }
                `}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`
                    ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
                    ${activeTab === tab.key ? 'bg-[#1a3a6b] text-white' : 'bg-[#e5e5e5] text-[#767676]'}
                  `}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Messages */}
        {loading ? (
          <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-8">
            <div className="text-center py-12">
              <p className="font-body text-sm text-[#b8b8b8]">Loading messages...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-8">
            <div className="text-center py-12">
              <p className="font-body text-sm text-[#b8b8b8] mb-4">
                {activeTab === 'all'
                  ? 'Your feed is empty.'
                  : `No ${activeTab} messages yet.`}
              </p>
              <p className="font-body text-sm text-[#767676]">
                {activeTab === 'all'
                  ? 'Paid messages from platforms, content from your subscriptions, and system notifications will appear here.'
                  : activeTab === 'marketing'
                    ? 'Paid messages from platforms and recruiters will appear here.'
                    : activeTab === 'feed'
                      ? 'Content from your subscriptions will appear here.'
                      : 'System notifications about earnings, profile views, and settlements will appear here.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {filtered.map(msg => (
              <MessageCard
                key={msg.id}
                message={msg}
                expanded={expandedId === msg.id}
                onToggleExpand={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
                onToggleRead={() => toggleRead(msg)}
                onBlock={() => blockSender(msg)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Message Card Component ─── */

function MessageCard({
  message,
  expanded,
  onToggleExpand,
  onToggleRead,
  onBlock,
}: {
  message: Message
  expanded: boolean
  onToggleExpand: () => void
  onToggleRead: () => void
  onBlock: () => void
}) {
  const typeConfig = {
    marketing: {
      icon: '📨',
      label: 'Marketing',
      color: '#92400e',
      bg: '#fffbeb',
      borderColor: '#f0d9b8',
    },
    feed: {
      icon: '📰',
      label: 'Feed',
      color: '#1a3a6b',
      bg: '#eef2f8',
      borderColor: '#c5d3e8',
    },
    system: {
      icon: '⚙️',
      label: 'System',
      color: '#166534',
      bg: '#f0fdf4',
      borderColor: '#bbf7d0',
    },
  }

  const config = typeConfig[message.type]
  const timeAgo = getTimeAgo(message.created_at)

  return (
    <div
      className={`
        bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm mb-2 transition-all
        ${!message.read ? 'border-l-[3px]' : ''}
        cursor-pointer hover:shadow-md
      `}
      style={{
        borderLeftColor: !message.read ? config.color : undefined,
      }}
      onClick={() => {
        onToggleExpand()
        if (!message.read) onToggleRead()
      }}
    >
      {/* Compact Row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Unread dot */}
        <div className="w-2 flex-shrink-0">
          {!message.read && (
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: config.color }}
            />
          )}
        </div>

        {/* Type badge */}
        <span
          className="label-grace px-2 py-0.5 rounded-[2px] flex-shrink-0"
          style={{
            background: config.bg,
            color: config.color,
            fontSize: '9px',
            border: `1px solid ${config.borderColor}`,
          }}
        >
          {config.icon} {config.label}
        </span>

        {/* Subject / Title */}
        <div className="flex-1 min-w-0">
          <span className={`font-body text-sm truncate block ${!message.read ? 'font-medium text-[#1a1a1a]' : 'text-[#555]'}`}>
            {message.type === 'feed'
              ? message.feed_item_title || 'Untitled'
              : message.subject || 'No subject'}
          </span>
        </div>

        {/* Sender / Source */}
        <div className="flex-shrink-0 text-right hidden sm:block">
          {message.type === 'marketing' && (
            <span className="font-body text-xs text-[#767676]">
              {message.sender_display_name || 'Unknown sender'}
            </span>
          )}
          {message.type === 'feed' && (
            <span className="font-body text-xs text-[#767676]">
              {message.feed_source_display_name || 'Unknown source'}
            </span>
          )}
        </div>

        {/* Price (marketing only) */}
        {message.type === 'marketing' && message.price_paid && (
          <span className="font-mono text-xs text-[#166534] flex-shrink-0 bg-[#f0fdf4] px-1.5 py-0.5 rounded-[2px]">
            ${Number(message.price_paid).toFixed(2)}
          </span>
        )}

        {/* Timestamp */}
        <span className="font-body text-xs text-[#b8b8b8] flex-shrink-0 w-16 text-right">
          {timeAgo}
        </span>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[#f0f0f0] mx-4">
          {/* Marketing message body */}
          {message.type === 'marketing' && (
            <div className="mt-3">
              {message.sender_display_name && (
                <div className="font-body text-xs text-[#767676] mb-2">
                  From: <span className="font-medium text-[#1a1a1a]">{message.sender_display_name}</span>
                  {message.sender_handle && (
                    <span className="text-[#b8b8b8]"> · {message.sender_handle}</span>
                  )}
                </div>
              )}
              <p className="font-body text-sm text-[#333] leading-relaxed">
                {message.body}
              </p>
              {message.price_paid && (
                <div className="mt-3 font-body text-xs text-[#767676]">
                  Paid <span className="font-mono font-medium text-[#166534]">${Number(message.price_paid).toFixed(2)}</span> to send this message · No refunds
                </div>
              )}
            </div>
          )}

          {/* Feed item content */}
          {message.type === 'feed' && (
            <div className="mt-3">
              <div className="font-body text-xs text-[#767676] mb-2">
                From: <span className="font-medium text-[#1a1a1a]">{message.feed_source_display_name || 'Unknown'}</span>
                {message.feed_item_type && (
                  <span
                    className="ml-2 label-grace px-1.5 py-0.5 rounded-[2px]"
                    style={{ background: '#eef2f8', color: '#1a3a6b', fontSize: '9px' }}
                  >
                    {message.feed_item_type}
                  </span>
                )}
              </div>
              {message.feed_item_summary && (
                <p className="font-body text-sm text-[#333] leading-relaxed">
                  {message.feed_item_summary}
                </p>
              )}
              {message.body && (
                <p className="font-body text-sm text-[#555] leading-relaxed mt-2">
                  {message.body}
                </p>
              )}
            </div>
          )}

          {/* System message body */}
          {message.type === 'system' && (
            <div className="mt-3">
              <p className="font-body text-sm text-[#333] leading-relaxed">
                {message.body}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-4 pt-3 border-t border-[#f0f0f0]">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleRead() }}
              className="font-body text-xs text-[#767676] hover:text-[#1a3a6b] cursor-pointer transition-colors"
            >
              {message.read ? 'Mark as unread' : 'Mark as read'}
            </button>
            {message.sender_id && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Block this sender? All messages from them will be hidden.')) {
                    onBlock()
                  }
                }}
                className="font-body text-xs text-[#767676] hover:text-[#991b1b] cursor-pointer transition-colors"
              >
                Block sender
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Time Ago Helper ─── */

function getTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
