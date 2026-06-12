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
    // Admins/managers use their full email address
    const email = login.includes('@') ? login : `${login}@delta-cleaner.internal`

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Invalid username or password. Please try again.')
      setLoading(false)
      return
    }

    // Get the user's role and redirect to the correct portal
    const { data: { user } } = await supabase.auth.getUser()
    const role = user?.user_metadata?.role ?? 'admin'

    const roleHome: Record<string, string> = {
      admin:   '/dashboard',
      manager: '/manager/dashboard',
      cleaner: '/cleaner/dashboard',
      client:  '/client/dashboard',
    }

    // Hard navigation ensures session cookies are sent fresh on the next request
    window.location.href = roleHome[role] ?? '/dashboard'
  }

  return (
    <div className="min-h-[100dvh] flex">
      {/* ── Ink panel ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden bg-[#0b1320] p-12">
        {/* Glow + watermark */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 110%, rgba(30,58,95,0.9), transparent 65%)' }}
        />
        <span
          aria-hidden
          className="font-display absolute -right-24 -bottom-44 text-[34rem] font-black leading-none select-none text-white/[0.04]"
        >
          Δ
        </span>

        <Image
          src="/logo-white.png"
          alt="Delta Cleaning"
          width={150}
          height={46}
          className="object-contain relative"
          priority
        />

        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400/80 mb-4">
            Operations Hub
          </p>
          <h2 className="font-display text-4xl xl:text-5xl font-extrabold text-white leading-[1.08] tracking-tight">
            Every site.<br />Every clean.<br />One system.
          </h2>
          <p className="text-sm text-slate-400 mt-5 leading-relaxed">
            Clients, jobs, surveys and financials for Delta Cleaning — in one place.
          </p>
        </div>

        <p className="relative text-xs text-slate-500">Brisbane, QLD · deltacleaning.com.au</p>
      </div>

      {/* ── Form panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-[#f5f6f8] p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Image
              src="/logo-white.png"
              alt="Delta Cleaning"
              width={150}
              height={46}
              className="object-contain invert"
              priority
            />
          </div>

          <h1 className="font-display text-[28px] font-extrabold text-gray-900 tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-gray-400 mt-1 mb-8">Sign in to your account to continue</p>

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
                className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder-gray-400 shadow-[0_1px_2px_rgba(16,24,40,0.05)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f] transition"
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
                className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder-gray-400 shadow-[0_1px_2px_rgba(16,24,40,0.05)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f] transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl shadow-[0_4px_14px_rgba(30,58,95,0.35)] transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            Delta Cleaning · Brisbane, QLD
          </p>
        </div>
      </div>
    </div>
  )
}
