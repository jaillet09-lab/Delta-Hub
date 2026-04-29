'use client'

import { useState } from 'react'
import { addCleanerAction } from '@/actions/team'

export function ManagerAddCleanerForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [password,  setPassword]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inp = 'w-full border-b border-gray-200 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black transition-colors bg-transparent'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return setError('First and last name are required')
    if (!password)                              return setError('Password is required')
    if (password.length < 5)                   return setError('Password must be at least 5 characters')
    setSubmitting(true)
    setError(null)
    const result = await addCleanerAction({ firstName, lastName, password })
    setSubmitting(false)
    if (result.error) return setError(result.error)
    window.location.href = '/manager/team'
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <input
          className={inp}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          autoComplete="given-name"
        />
        <input
          className={inp}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          autoComplete="family-name"
        />
      </div>

      <input
        className={inp}
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="new-password"
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-black text-white text-sm font-semibold rounded-2xl py-3.5 disabled:opacity-40 active:scale-[0.98] transition-all mt-1"
      >
        {submitting ? 'Creating…' : 'Add Cleaner'}
      </button>
    </form>
  )
}
