'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'delta_portal_onboarding_v1'

const SCREENS = [
  {
    eyebrow: '01',
    title: 'Welcome to your portal',
    body: 'Everything you need to stay across your cleaning service, in one place.',
    bullets: null,
  },
  {
    eyebrow: '02',
    title: 'Everything in one place',
    body: null,
    bullets: [
      'View recent cleans and your service history',
      'Access compliance documents, insurance, and agreements',
      'See when your next clean is scheduled',
    ],
  },
  {
    eyebrow: '03',
    title: 'Need something?',
    body: 'You can request additional services or report an issue directly from the portal.',
    bullets: [
      'Request a one-off or additional service',
      'Report an issue — we follow up within one business day',
    ],
  },
  {
    eyebrow: '04',
    title: "You're all set",
    body: 'Your portal updates after each visit. If you ever need to reach us, use the Contact tab.',
    bullets: null,
  },
]

export function ClientOnboardingModal() {
  const [open, setOpen]       = useState(false)
  const [step, setStep]       = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) setOpen(true)

    function handleOpen() {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener('delta:openOnboarding', handleOpen)
    return () => window.removeEventListener('delta:openOnboarding', handleOpen)
  }, [])

  if (!mounted || !open) return null

  const screen     = SCREENS[step]
  const isLast     = step === SCREENS.length - 1
  const isFirst    = step === 0

  function next() {
    if (isLast) { setOpen(false) } else { setStep((s) => s + 1) }
  }

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] px-0 sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="flex h-0.5 bg-gray-100">
          {SCREENS.map((_, i) => (
            <div
              key={i}
              className="flex-1 transition-colors duration-300"
              style={{ background: i <= step ? '#1e3a5f' : 'transparent' }}
            />
          ))}
        </div>

        <div className="px-8 pt-8 pb-7">

          {/* Eyebrow */}
          <p className="text-[10px] font-semibold tracking-[0.15em] text-gray-300 uppercase mb-5">
            {screen.eyebrow} / {String(SCREENS.length).padStart(2, '0')}
          </p>

          {/* Title */}
          <h2 className="text-2xl font-bold text-black tracking-tight leading-snug mb-3">
            {screen.title}
          </h2>

          {/* Body */}
          {screen.body && (
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              {screen.body}
            </p>
          )}

          {/* Bullets */}
          {screen.bullets && (
            <ul className="space-y-2.5 mb-4">
              {screen.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-[#1e3a5f] flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex flex-col gap-3">
          <button
            onClick={next}
            className="w-full py-3 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#162d4a] transition-colors"
          >
            {isLast ? 'Get started' : 'Next'}
          </button>

          {isLast ? (
            <button
              onClick={dismiss}
              className="w-full py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              Never show again
            </button>
          ) : (
            !isFirst && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="w-full py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Back
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
