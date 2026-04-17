'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  email: string
}

const label: React.CSSProperties = {
  fontFamily: 'Roboto, sans-serif',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#767676',
  display: 'block',
  marginBottom: '6px',
}

const input: React.CSSProperties = {
  width: '100%',
  fontFamily: 'Roboto, sans-serif',
  fontSize: '14px',
  color: '#1a1a1a',
  background: '#f5f5f5',
  border: '1px solid #e8e8e8',
  borderRadius: '3px',
  padding: '10px 12px',
  outline: 'none',
  boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 20px',
  background: '#1a3a6b',
  color: '#ffffff',
  border: 'none',
  borderRadius: '3px',
  fontFamily: 'Roboto, sans-serif',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  padding: '10px 20px',
  background: 'transparent',
  color: '#5a5a5a',
  border: '1px solid #d4d4d4',
  borderRadius: '3px',
  fontFamily: 'Roboto, sans-serif',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const dangerBtn: React.CSSProperties = {
  padding: '10px 20px',
  background: 'transparent',
  color: '#991b1b',
  border: '1px solid #fca5a5',
  borderRadius: '3px',
  fontFamily: 'Roboto, sans-serif',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #d4d4d4',
  borderRadius: '3px',
  padding: '28px',
  marginBottom: '16px',
}

export default function AccountManagement({ email }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Email change
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Notifications
  const [notifySponsor, setNotifySponsor] = useState(true)
  const [notifySaving, setNotifySaving] = useState(false)
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null)

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleEmailChange = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailMsg({ text: 'Enter a valid email address.', ok: false })
      return
    }
    setEmailSaving(true)
    setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailSaving(false)
    if (error) {
      setEmailMsg({ text: error.message, ok: false })
    } else {
      setEmailMsg({ text: 'Confirmation sent to your new address. Check your inbox.', ok: true })
      setNewEmail('')
    }
  }

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      setPwMsg({ text: 'Password must be at least 8 characters.', ok: false })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: 'Passwords do not match.', ok: false })
      return
    }
    setPwSaving(true)
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    if (error) {
      setPwMsg({ text: error.message, ok: false })
    } else {
      setPwMsg({ text: 'Password updated.', ok: true })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const handleNotificationsSave = async () => {
    setNotifySaving(true)
    // Stored in user metadata for now
    const { error } = await supabase.auth.updateUser({
      data: {
        notify_sponsor: notifySponsor,
      }
    })
    setNotifySaving(false)
    setNotifyMsg(error ? 'Failed to save.' : 'Preferences saved.')
    setTimeout(() => setNotifyMsg(null), 3000)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)
    const res = await fetch('/api/account/delete', { method: 'POST' })
    if (res.ok) {
      await supabase.auth.signOut()
      router.push('/')
    } else {
      setDeleteError('Failed to delete account. Contact support if this persists.')
      setDeleting(false)
    }
  }

  const Toggle = ({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) => (
    <button
      id={id}
      onClick={() => onChange(!checked)}
      style={{
        width: '40px',
        height: '22px',
        borderRadius: '11px',
        background: checked ? '#1a3a6b' : '#d4d4d4',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: '#fff',
        position: 'absolute',
        top: '3px',
        left: checked ? '21px' : '3px',
        transition: 'left 0.2s',
      }} />
    </button>
  )

  const msgStyle = (ok: boolean): React.CSSProperties => ({
    fontFamily: 'Roboto, sans-serif',
    fontSize: '12px',
    color: ok ? '#166534' : '#991b1b',
    background: ok ? '#f0fdf4' : '#fef2f2',
    border: `1px solid ${ok ? '#86efac' : '#fca5a5'}`,
    borderRadius: '3px',
    padding: '8px 12px',
    marginTop: '10px',
  })

  return (
    <>
      {/* Email */}
      <div style={card}>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>
          Email address
        </h2>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676', marginBottom: '20px' }}>
          Current: <strong style={{ color: '#1a1a1a' }}>{email}</strong>
        </p>
        <div style={{ marginBottom: '12px' }}>
          <label style={label} htmlFor="new-email">New email address</label>
          <input
            id="new-email"
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="new@example.com"
            style={input}
          />
        </div>
        {emailMsg && <p style={msgStyle(emailMsg.ok)}>{emailMsg.text}</p>}
        <div style={{ marginTop: '14px' }}>
          <button
            onClick={handleEmailChange}
            disabled={emailSaving || !newEmail.trim()}
            style={{ ...primaryBtn, opacity: emailSaving || !newEmail.trim() ? 0.5 : 1 }}
          >
            {emailSaving ? 'Saving…' : 'Update email'}
          </button>
        </div>
      </div>

      {/* Password */}
      <div style={card}>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>
          Password
        </h2>
        <div style={{ marginBottom: '12px' }}>
          <label style={label} htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            style={input}
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={label} htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
            style={input}
          />
        </div>
        {pwMsg && <p style={msgStyle(pwMsg.ok)}>{pwMsg.text}</p>}
        <div style={{ marginTop: '14px' }}>
          <button
            onClick={handlePasswordChange}
            disabled={pwSaving || !newPassword || !confirmPassword}
            style={{ ...primaryBtn, opacity: pwSaving || !newPassword || !confirmPassword ? 0.5 : 1 }}
          >
            {pwSaving ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div style={card}>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>
          Email notifications
        </h2>
        {[
          { id: 'notify-sponsor', checked: notifySponsor, onChange: setNotifySponsor, label: 'New sponsor pledge', sub: 'Email when someone pledges to your commitment' },
        ].map((item, i, arr) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', paddingBottom: i < arr.length - 1 ? '16px' : '0', marginBottom: i < arr.length - 1 ? '16px' : '0', borderBottom: i < arr.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
            <div>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 500, color: '#1a1a1a', margin: '0 0 2px' }}>{item.label}</p>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', margin: 0 }}>{item.sub}</p>
            </div>
            <Toggle id={item.id} checked={item.checked} onChange={item.onChange} />
          </div>
        ))}
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleNotificationsSave} disabled={notifySaving} style={{ ...primaryBtn, opacity: notifySaving ? 0.5 : 1 }}>
            {notifySaving ? 'Saving…' : 'Save preferences'}
          </button>
          {notifyMsg && <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#166534' }}>{notifyMsg}</span>}
        </div>
      </div>

      {/* Sign out */}
      <div style={card}>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
          Sign out
        </h2>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676', marginBottom: '20px' }}>
          Sign out of your account on this device.
        </p>
        <button onClick={handleSignOut} style={ghostBtn}>Sign out</button>
      </div>

      {/* Delete account */}
      <div style={{ ...card, border: '1px solid #fca5a5', marginBottom: 0 }}>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#991b1b', marginBottom: '8px' }}>
          Delete account
        </h2>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676', marginBottom: '20px' }}>
          Permanently deletes your account, profile, practice record, and all session data. This cannot be undone.
        </p>
        <button onClick={() => setDeleteModal(true)} style={dangerBtn}>Delete my account</button>
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '6px', padding: '32px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>
              Delete your account?
            </h3>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a', lineHeight: 1.6, marginBottom: '20px' }}>
              This will permanently delete your profile, all practice sessions, and sponsorship history. This cannot be undone.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...label, color: '#991b1b' }} htmlFor="delete-confirm">Type DELETE to confirm</label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                style={{ ...input, border: '1px solid #fca5a5' }}
              />
            </div>
            {deleteError && <p style={msgStyle(false)}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                style={{ ...dangerBtn, background: deleteConfirm === 'DELETE' ? '#991b1b' : undefined, color: deleteConfirm === 'DELETE' ? '#fff' : undefined, opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
              <button onClick={() => { setDeleteModal(false); setDeleteConfirm(''); setDeleteError(null) }} style={ghostBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
