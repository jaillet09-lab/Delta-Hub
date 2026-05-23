'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'

interface PhotoLightboxProps {
  photos: string[]
  /** Zero-based index to open, or null = closed */
  initialIndex?: number | null
  onClose?: () => void
}

/** Standalone lightbox — pass photos + open index, handles its own open/close */
export function PhotoLightbox({ photos, initialIndex = null, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState<number | null>(initialIndex ?? null)

  // Sync if parent changes initialIndex
  useEffect(() => {
    setIndex(initialIndex ?? null)
  }, [initialIndex])

  const close = useCallback(() => {
    setIndex(null)
    onClose?.()
  }, [onClose])

  const prev = useCallback(() => {
    setIndex(i => (i == null ? null : (i - 1 + photos.length) % photos.length))
  }, [photos.length])

  const next = useCallback(() => {
    setIndex(i => (i == null ? null : (i + 1) % photos.length))
  }, [photos.length])

  // Keyboard navigation
  useEffect(() => {
    if (index == null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')       close()
      if (e.key === 'ArrowLeft')    prev()
      if (e.key === 'ArrowRight')   next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index, close, prev, next])

  // Prevent body scroll when open
  useEffect(() => {
    if (index != null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [index])

  if (index == null || photos.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onClick={close}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-white/60 text-sm font-medium tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <button
          onClick={close}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Image */}
      <div
        className="flex-1 relative flex items-center justify-center px-2"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative w-full h-full">
          <Image
            src={photos[index]}
            alt={`Photo ${index + 1}`}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        </div>
      </div>

      {/* Bottom bar — prev/next + open full */}
      <div
        className="flex items-center justify-between px-4 py-4 flex-shrink-0 gap-3"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={prev}
          disabled={photos.length <= 1}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-30 transition-colors"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        {/* Open in new tab for saving/sharing */}
        <a
          href={photos[index]}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white text-sm font-medium"
        >
          <ZoomIn className="w-4 h-4" />
          Open full size
        </a>

        <button
          onClick={next}
          disabled={photos.length <= 1}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-30 transition-colors"
          aria-label="Next photo"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  )
}

/** Drop-in photo grid with built-in lightbox */
export function PhotoGrid({ photos }: { photos: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((url, i) => (
          <button
            key={i}
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 active:opacity-80 transition-opacity"
            aria-label={`View photo ${i + 1}`}
          >
            <Image
              src={url}
              alt={`Photo ${i + 1}`}
              fill
              className="object-cover"
              sizes="33vw"
            />
          </button>
        ))}
      </div>

      <PhotoLightbox
        photos={photos}
        initialIndex={openIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  )
}
