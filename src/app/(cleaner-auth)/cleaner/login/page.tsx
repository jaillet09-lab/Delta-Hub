'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function CleanerLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Cleaners log in with just their username (e.g. "john.smith")
    const email = username.includes('@') ? username : `${username}@delta-cleaner.internal`

    const supabase = createClient() // auto-selects sb-cleaner cookie namespace
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid username or password. Please try again.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const role = user?.user_metadata?.role ?? ''

    if (role !== 'cleaner') {
      await supabase.auth.signOut()
      setError('This portal is for cleaners only.')
      setLoading(false)
      return
    }

    window.location.href = '/cleaner/dashboard'
  }

  return (
    <div className="h-screen overflow-hidden bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Image src="/logo-white.png" alt="Delta Cleaning" width={160} height={50} className="object-contain invert" priority />
          </div>
          <p className="text-gray-400 text-sm">Cleaner portal</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-500 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black transition"
                placeholder="john.smith"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-500 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Delta Cleaning · Brisbane, QLD</p>
      </div>
    </div>
  )
}
