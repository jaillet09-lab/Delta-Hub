'use client'

import { useState } from 'react'
import { submitExitSurveyAction } from '@/actions/survey-email'

const REASONS = [
  'Cost / budget',
  'Moved or closed premises',
  'Service didn’t meet expectations',
  'Switched to another provider',
  'No longer need cleaning',
  'Other',
]

function ScoreSelector({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const selected = value === n
          const color = n <= 4 ? '#ef4444' : n <= 6 ? '#f59e0b' : '#22c55e'
          return (
            <button key={n} type="button" onClick={() => onChange(n)}
              style={{ width: 46, height: 46, borderRadius: 8, border: selected ? `2px solid ${color}` : '2px solid #e5e7eb', background: selected ? color : '#fff', color: selected ? '#fff' : '#374151', fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.1s', flexShrink: 0 }}>
              {n}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
        <span>0 — Poor</span>
        <span>10 — Excellent</span>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24, marginBottom: 12 }
const qStyle: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 16, lineHeight: 1.4 }

export function ExitSurveyForm({ token }: { token: string }) {
  const [service, setService] = useState<number | null>(null)
  const [value, setValue] = useState<number | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const canSubmit = service !== null && value !== null && !!reason

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return setError('Please answer the three questions before submitting.')
    setSubmitting(true); setError(null)
    const res = await submitExitSurveyAction({ token, service: service!, value: value!, reason: reason!, comments: comments.trim() || undefined })
    setSubmitting(false)
    if (res.error) return setError(res.error)
    setDone(true)
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', ...card }}>
        <p style={{ fontSize: 52, marginBottom: 16 }}>🙏</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 8 }}>Thank you</h2>
        <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6 }}>We really appreciate you taking a moment. It genuinely helps us improve, and the door is always open if you’d like us back.</p>
        <p style={{ fontSize: 14, color: '#999', marginTop: 16 }}>— Jackson &amp; the Delta Cleaning team</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={card}>
        <p style={qStyle}>How would you rate our cleaning service overall?</p>
        <ScoreSelector value={service} onChange={setService} />
      </div>

      <div style={card}>
        <p style={qStyle}>How would you rate the value for what you paid?</p>
        <ScoreSelector value={value} onChange={setValue} />
      </div>

      <div style={card}>
        <p style={qStyle}>What’s the main reason you’re moving on?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {REASONS.map((r) => {
            const selected = reason === r
            return (
              <button key={r} type="button" onClick={() => setReason(r)}
                style={{ textAlign: 'left', padding: '13px 16px', borderRadius: 10, border: selected ? '2px solid #1e3a5f' : '2px solid #e5e7eb', background: selected ? '#1e3a5f' : '#fff', color: selected ? '#fff' : '#374151', fontSize: 14.5, fontWeight: selected ? 600 : 500, cursor: 'pointer', transition: 'all 0.1s' }}>
                {r}
              </button>
            )
          })}
        </div>
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} placeholder="Anything else you’d like us to know? (optional)"
          style={{ width: '100%', marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111', resize: 'vertical', outline: 'none', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }} />
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 14 }}>{error}</div>}

      <button type="submit" disabled={submitting || !canSubmit}
        style={{ width: '100%', padding: 16, background: canSubmit ? '#111' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'Arial, sans-serif', transition: 'background 0.2s' }}>
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>Your response is confidential and only shared with the Delta Cleaning team.</p>
    </form>
  )
}
