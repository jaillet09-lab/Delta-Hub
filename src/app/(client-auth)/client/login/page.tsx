'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function ClientLoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient() // auto-selects sb-client cookie namespace
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const role = user?.user_metadata?.role ?? ''

    if (role !== 'client') {
      await supabase.auth.signOut()
      setError('This portal is for clients only.')
      setLoading(false)
      return
    }

    window.location.href = '/client/dashboard'
  }

  return (
    <div className="h-screen overflow-hidden bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Image src="/logo-white.png" alt="Delta Cleaning" width={160} height={50} className="object-contain invert" priority />
          </div>
          <p className="text-gray-400 text-sm">Client portal</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-500 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black transition"
                placeholder="you@company.com.au"
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
