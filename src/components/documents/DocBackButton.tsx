'use client'

// A fixed "Back" control for full-screen document views (which have no app chrome,
// so in the installed app there's otherwise no way back without closing it).
// Goes back in history when there's somewhere to go, otherwise tries to close the
// tab (for links opened in a new tab). Screen-only so it never prints.
export function DocBackButton({ fallbackHref }: { fallbackHref?: string }) {
  function handleBack() {
    if (window.history.length > 1) {
      window.history.back()
    } else if (fallbackHref) {
      window.location.href = fallbackHref
    } else {
      window.close()
    }
  }
  return (
    <div data-screen-only style={{ position: 'fixed', top: 18, left: 18, zIndex: 60 }}>
      <button
        onClick={handleBack}
        style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.04em', background: '#fff', color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: 999, padding: '11px 20px 11px 16px', cursor: 'pointer', boxShadow: '0 6px 18px rgba(15,23,42,.16)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Back
      </button>
    </div>
  )
}
