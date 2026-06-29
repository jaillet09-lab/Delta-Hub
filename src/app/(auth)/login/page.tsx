'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Cleaners log in with just their username (e.g. "john.smith")
    // Admins/managers/clients use their full email address
    const email = login.includes('@') ? login : `${login}@delta-cleaner.internal`

    // First sign-in (admin namespace) just discovers the user's role
    const supabase = createClient('admin')
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Login incorrect. Please check your username and password and try again.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const role = (user?.user_metadata?.role ?? 'admin') as 'admin' | 'manager' | 'cleaner' | 'client'

    const roleHome: Record<string, string> = {
      admin:   '/dashboard',
      manager: '/manager/dashboard',
      cleaner: '/cleaner/dashboard',
      client:  '/client/dashboard',
    }

    // Non-admin roles read a different cookie namespace. Sign in again with the
    // correct portal client so the session lands in that namespace's cookie.
    // We do NOT sign out the discovery session: the two clients can share auth
    // storage, so signing one out wipes the freshly-created portal session and
    // bounces the user back to login. The leftover admin-namespace session is
    // harmless — middleware role-gates it, and a later admin login overwrites it.
    if (role !== 'admin') {
      const portalClient = createClient(role)
      const { error: portalError } = await portalClient.auth.signInWithPassword({ email, password })
      if (portalError) {
        setError('Login incorrect. Please check your username and password and try again.')
        setLoading(false)
        return
      }
    }

    // Hard navigation ensures session cookies are sent fresh on the next request
    window.location.href = roleHome[role] ?? '/dashboard'
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-3">
          <Image
            src="/logo-mark-white.png"
            alt="Delta Cleaning"
            width={52}
            height={52}
            className="object-contain invert"
            priority
          />
        </div>
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400 mb-10">
          Client &amp; Team Portal
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login" className="block text-xs font-semibold text-gray-600 mb-1.5">
              Username or Email
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value.trim())}
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f] transition"
              placeholder="john.smith or you@deltacleaning.com.au"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-600 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f] transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl shadow-[0_4px_14px_rgba(30,58,95,0.25)] transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          Delta Cleaning · Brisbane, QLD
        </p>
      </div>
    </div>
  )
}
