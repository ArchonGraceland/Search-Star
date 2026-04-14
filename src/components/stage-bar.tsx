'use client'

const STAGES = [
  { n: 1, label: 'Practice' },
  { n: 2, label: 'Validator' },
  { n: 3, label: 'Mentor' },
  { n: 4, label: 'Commitment' },
  { n: 5, label: 'Launch' },
  { n: 6, label: 'Begin' },
  { n: 7, label: 'Active' },
]

export default function StageBar({ current }: { current: number }) {
  return (
    <div style={{
      background: '#ffffff',
      borderBottom: '1px solid #e8e8e8',
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
      }}>
        {STAGES.map((stage, i) => {
          const done = stage.n < current
          const active = stage.n === current
          return (
            <div key={stage.n} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 4px 10px',
              position: 'relative',
            }}>
              {/* Connector line */}
              {i > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '19px',
                  left: 0,
                  width: '50%',
                  height: '2px',
                  background: done || active ? '#1a3a6b' : '#e8e8e8',
                }} />
              )}
              {i < STAGES.length - 1 && (
                <div style={{
                  position: 'absolute',
                  top: '19px',
                  right: 0,
                  width: '50%',
                  height: '2px',
                  background: done ? '#1a3a6b' : '#e8e8e8',
                }} />
              )}
              {/* Dot */}
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: done ? '#1a3a6b' : active ? '#1a3a6b' : '#e8e8e8',
                border: active ? '3px solid #1a3a6b' : done ? 'none' : '2px solid #d4d4d4',
                boxSizing: 'border-box',
                position: 'relative',
                zIndex: 1,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {done && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              {/* Label */}
              <span style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '9px',
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: active ? '#1a3a6b' : done ? '#5a5a5a' : '#b8b8b8',
                marginTop: '5px',
                whiteSpace: 'nowrap',
              }}>
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
