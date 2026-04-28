'use client'

export function HowItWorksButton() {
  function open() {
    window.dispatchEvent(new Event('delta:openOnboarding'))
  }

  return (
    <button
      onClick={open}
      className="text-sm font-medium text-gray-400 hover:text-black transition-colors"
    >
      How it works
    </button>
  )
}
