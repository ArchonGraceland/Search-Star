'use client'

import { useState } from 'react'

interface Props {
  commitmentId: string
  postId: string
  validatorToken: string
}

export function ConfirmButton({ commitmentId, postId, validatorToken }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleConfirm() {
    setStatus('loading')
    try {
      const res = await fetch(`/api/validate/${commitmentId}/posts/${postId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validator_token: validatorToken }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2d6a6a', padding: '4px 10px', border: '1px solid #2d6a6a', borderRadius: '3px' }}>
        Confirmed
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#c0392b' }}>
        Failed
      </span>
    )
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={status === 'loading'}
      style={{
        fontFamily: 'Roboto, sans-serif',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '4px 10px',
        background: status === 'loading' ? '#f0f0f0' : '#1a3a6b',
        color: status === 'loading' ? '#767676' : '#fff',
        border: 'none',
        borderRadius: '3px',
        cursor: status === 'loading' ? 'not-allowed' : 'pointer',
      }}
    >
      {status === 'loading' ? 'Confirming...' : 'Confirm'}
    </button>
  )
}
