'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { submitJobAction, uploadJobPhotoAction } from '@/actions/jobs'
import { Camera, Video, X, CheckCircle2, Circle, Loader2, RotateCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MIN_PHOTOS = 0
const MAX_PHOTOS = 10

// A stalled upload on a phone/patchy data must NEVER freeze the Submit button.
// If an upload takes longer than this it's marked failed (with a Retry), which
// frees the cleaner to retry or submit without it.
const UPLOAD_TIMEOUT_MS = 120_000
const SUBMIT_TIMEOUT_MS = 60_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

interface ChecklistItem {
  id: string
  label: string
  required?: boolean
}

interface Props {
  jobId: string
  checklist: ChecklistItem[]
}

interface PhotoEntry {
  id: string          // local key
  file: File          // kept so a failed upload can be retried
  localUrl: string    // blob URL — shown immediately
  remoteUrl: string | null  // Supabase URL — set after upload
  uploading: boolean
  error: string | null
}

interface VideoEntry {
  id: string
  file: File
  localUrl: string    // blob URL — shown immediately in player
  remoteUrl: string | null  // Supabase URL
  name: string
  uploading: boolean
  error: string | null
}

/** Burns a neat AEST timestamp onto a photo and returns a stamped Blob */
async function stampPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const now = new Date()
      const stamp = now.toLocaleString('en-AU', {
        timeZone:   'Australia/Brisbane',
        day:        '2-digit',
        month:      '2-digit',
        year:       'numeric',
        hour:       '2-digit',
        minute:     '2-digit',
        second:     '2-digit',
        hour12:     false,
      }) + ' AEST'

      const fontSize = Math.max(20, Math.round(canvas.width * 0.033))
      const padding  = Math.round(fontSize * 0.6)

      ctx.font      = `bold ${fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`
      ctx.textAlign = 'right'

      const textW = ctx.measureText(stamp).width
      const boxW  = textW + padding * 2
      const boxH  = fontSize + padding * 1.4
      const boxX  = canvas.width  - boxW - padding
      const boxY  = canvas.height - boxH - padding

      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.beginPath()
      const r = fontSize * 0.35
      ctx.roundRect(boxX, boxY, boxW, boxH, r)
      ctx.fill()

      ctx.fillStyle    = '#ffffff'
      ctx.shadowColor  = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur   = 3
      ctx.fillText(stamp, canvas.width - padding * 2, boxY + boxH - padding * 0.7)

      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/jpeg',
        0.88,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image')) }
    img.src = objectUrl
  })
}

export function SubmitJobForm({ jobId, checklist }: Props) {
  const router        = useRouter()
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const [photos,     setPhotos]     = useState<PhotoEntry[]>([])
  const [videos,     setVideos]     = useState<VideoEntry[]>([])
  const [checked,    setChecked]    = useState<Record<string, boolean>>({})
  const [notes,      setNotes]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Revoke blob URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.localUrl))
      videos.forEach((v) => URL.revokeObjectURL(v.localUrl))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const uploadedPhotos   = photos.filter((p) => p.remoteUrl)
  const requiredItems    = checklist.filter((i) => i.required)
  const allRequiredChecked = requiredItems.every((i) => checked[i.id])
  const anyUploading     = photos.some((p) => p.uploading) || videos.some((v) => v.uploading)
  const anyFailed        = photos.some((p) => p.error) || videos.some((v) => v.error)
  const canSubmit        = uploadedPhotos.length >= MIN_PHOTOS
    && !anyUploading
    && (requiredItems.length === 0 || allRequiredChecked)

  // Stamp + upload a single photo entry (also used by Retry).
  async function uploadPhotoEntry(id: string, file: File) {
    setPhotos((p) => p.map((x) => x.id === id ? { ...x, uploading: true, error: null } : x))
    try {
      const stamped     = await stampPhoto(file)
      const stampedFile = new File([stamped], file.name, { type: 'image/jpeg' })
      const fd          = new FormData()
      fd.append('photo', stampedFile)
      const result = await withTimeout(uploadJobPhotoAction(jobId, fd), UPLOAD_TIMEOUT_MS)
      if (result.error) {
        setPhotos((p) => p.map((x) => x.id === id ? { ...x, uploading: false, error: result.error! } : x))
      } else {
        setPhotos((p) => p.map((x) => x.id === id ? { ...x, uploading: false, remoteUrl: result.url! } : x))
      }
    } catch (e: any) {
      const msg = e?.message === 'timeout' ? 'Timed out' : 'Failed'
      setPhotos((p) => p.map((x) => x.id === id ? { ...x, uploading: false, error: msg } : x))
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos allowed`)
      return
    }
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''

    for (const file of files) {
      const localUrl = URL.createObjectURL(file)
      const id       = `${Date.now()}-${Math.random()}`
      setPhotos((p) => [...p, { id, file, localUrl, remoteUrl: null, uploading: true, error: null }])
      // Fire the upload; it manages its own state and can never hang forever.
      void uploadPhotoEntry(id, file)
    }
  }

  // Upload a single video entry (also used by Retry).
  async function uploadVideoEntry(id: string, file: File) {
    setVideos((v) => v.map((x) => x.id === id ? { ...x, uploading: true, error: null } : x))
    try {
      const supabase = createClient()
      const path     = `videos/${jobId}/${Date.now()}.mp4`
      const { error: upErr } = await withTimeout<any>(
        (supabase as any).storage.from('job-photos').upload(path, file, { contentType: file.type || 'video/mp4', upsert: false }),
        UPLOAD_TIMEOUT_MS,
      )
      if (upErr) {
        setVideos((v) => v.map((x) => x.id === id ? { ...x, uploading: false, error: upErr.message } : x))
      } else {
        const { data } = (supabase as any).storage.from('job-photos').getPublicUrl(path)
        setVideos((v) => v.map((x) => x.id === id ? { ...x, uploading: false, remoteUrl: data.publicUrl as string } : x))
      }
    } catch (e: any) {
      const msg = e?.message === 'timeout' ? 'Timed out' : 'Upload failed'
      setVideos((v) => v.map((x) => x.id === id ? { ...x, uploading: false, error: msg } : x))
    }
  }

  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (videoInputRef.current) videoInputRef.current.value = ''

    const localUrl = URL.createObjectURL(file)
    const id       = `${Date.now()}-${Math.random()}`
    setVideos((v) => [...v, { id, file, localUrl, remoteUrl: null, name: file.name, uploading: true, error: null }])
    void uploadVideoEntry(id, file)
  }

  function removePhoto(id: string) {
    setPhotos((p) => {
      const entry = p.find((x) => x.id === id)
      if (entry) URL.revokeObjectURL(entry.localUrl)
      return p.filter((x) => x.id !== id)
    })
  }

  function removeVideo(id: string) {
    setVideos((v) => {
      const entry = v.find((x) => x.id === id)
      if (entry) URL.revokeObjectURL(entry.localUrl)
      return v.filter((x) => x.id !== id)
    })
  }

  function toggleCheck(id: string) {
    setChecked((c) => ({ ...c, [id]: !c[id] }))
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await withTimeout(submitJobAction({
        jobId,
        photoUrls:          uploadedPhotos.map((p) => p.remoteUrl!),
        videoUrls:          videos.filter((v) => v.remoteUrl).map((v) => v.remoteUrl!),
        checklistCompleted: checked,
        notes,
      }), SUBMIT_TIMEOUT_MS)
      if (result?.error) {
        setError(result.error)
        setSubmitting(false)
        return
      }
      router.push('/cleaner/dashboard')
    } catch (e: any) {
      setError(e?.message === 'timeout'
        ? 'Submitting is taking too long — check your connection and try again.'
        : 'Could not submit. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Photos ── */}
      <div className="bg-white rounded-2xl px-5 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-black">Photos</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Optional · Max {MAX_PHOTOS} · Auto-timestamped if uploaded
            </p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            uploadedPhotos.length >= MIN_PHOTOS ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            {uploadedPhotos.length}/{MAX_PHOTOS}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
              {/* Instant local preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.localUrl}
                alt="Photo preview"
                className="w-full h-full object-cover"
              />
              {/* Uploading spinner overlay */}
              {p.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
              {/* Error overlay — tap to retry */}
              {p.error && !p.uploading && (
                <button
                  onClick={() => uploadPhotoEntry(p.id, p.file)}
                  className="absolute inset-0 bg-red-500/75 flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-transform"
                >
                  <RotateCw className="w-5 h-5 text-white" />
                  <span className="text-white text-[10px] font-semibold px-1 text-center">{p.error} · Retry</span>
                </button>
              )}
              {/* Uploaded tick */}
              {p.remoteUrl && (
                <div className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
              <button
                onClick={() => removePhoto(p.id)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center active:scale-90 transition-transform"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-all"
            >
              <Camera className="w-6 h-6 text-gray-400" />
              <span className="text-xs text-gray-400 font-medium">Add</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelect}
        />
      </div>

      {/* ── Videos (optional) ── */}
      <div className="bg-white rounded-2xl px-5 py-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-black">
            Videos <span className="text-gray-400 font-normal">(optional)</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Add a short video to show completed work, an issue, or anything important
          </p>
        </div>

        {videos.length > 0 && (
          <div className="space-y-3 mb-4">
            {videos.map((v) => (
              <div key={v.id} className="rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                {/* Instant local video preview — plays from blob URL immediately */}
                <div className="relative">
                  <video
                    src={v.localUrl}
                    controls
                    playsInline
                    preload="auto"
                    className="w-full max-h-52 bg-black"
                  >
                    <track kind="captions" />
                  </video>
                  {v.uploading && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/60 rounded-full px-3 py-1.5 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                        <span className="text-white text-xs font-medium">Uploading…</span>
                      </div>
                    </div>
                  )}
                  {v.error && !v.uploading && (
                    <button
                      onClick={() => uploadVideoEntry(v.id, v.file)}
                      className="absolute inset-0 bg-red-500/55 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                      <RotateCw className="w-4 h-4 text-white" />
                      <span className="text-white text-xs font-semibold">{v.error} · Tap to retry</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <Video className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600 font-medium truncate flex-1">{v.name}</span>
                  {v.remoteUrl && <CheckCircle2 className="w-4 h-4 text-black flex-shrink-0" />}
                  <button
                    onClick={() => removeVideo(v.id)}
                    className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                  >
                    <X className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {/* Record new */}
          <button
            onClick={() => {
              if (videoInputRef.current) {
                videoInputRef.current.removeAttribute('capture')
                videoInputRef.current.setAttribute('capture', 'environment')
                videoInputRef.current.click()
              }
            }}
            disabled={videos.some((v) => v.uploading)}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 border border-dashed border-gray-200 rounded-xl px-3 py-3 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Video className="w-4 h-4 text-gray-400" />
            Record
          </button>
          {/* Pick from library */}
          <button
            onClick={() => {
              if (videoInputRef.current) {
                videoInputRef.current.removeAttribute('capture')
                videoInputRef.current.click()
              }
            }}
            disabled={videos.some((v) => v.uploading)}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 border border-dashed border-gray-200 rounded-xl px-3 py-3 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Video className="w-4 h-4 text-gray-400" />
            Choose
          </button>
        </div>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoSelect}
        />
      </div>

      {/* ── Checklist ── */}
      {checklist.length > 0 && (
        <div className="bg-white rounded-2xl px-5 py-5">
          <p className="text-sm font-semibold text-black mb-4">Checklist</p>
          <ul className="space-y-1">
            {checklist.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => toggleCheck(item.id)}
                  className="flex items-center gap-3 w-full py-3 text-left border-b border-gray-50 last:border-0 active:scale-[0.98] transition-all"
                >
                  {checked[item.id]
                    ? <CheckCircle2 className="w-5 h-5 text-black flex-shrink-0" />
                    : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  }
                  <span className={`text-sm ${checked[item.id] ? 'text-black font-medium' : 'text-gray-700'}`}>
                    {item.label}
                  </span>
                  {item.required && !checked[item.id] && (
                    <span className="ml-auto text-xs text-gray-400">Required</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Notes ── */}
      <div className="bg-white rounded-2xl px-5 py-5">
        <p className="text-sm font-semibold text-black mb-3">
          Notes <span className="text-gray-400 font-normal">(optional)</span>
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes about this job…"
          rows={3}
          className="w-full text-sm text-black placeholder-gray-400 resize-none focus:outline-none"
        />
      </div>

      {/* ── Submit ── */}
      <div className="space-y-2 pt-2 pb-4">
        {anyUploading && (
          <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Uploading media, please wait…
          </p>
        )}
        {!anyUploading && anyFailed && (
          <p className="text-xs text-center text-amber-600">
            Some media didn&apos;t upload. Tap a red one to retry, remove it, or submit without it.
          </p>
        )}
        {!canSubmit && !anyUploading && requiredItems.length > 0 && !allRequiredChecked && (
          <p className="text-xs text-center text-gray-400">
            Complete all required checklist items.
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-black text-white font-semibold text-sm rounded-2xl py-4 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : 'Submit Job'}
        </button>
      </div>
    </div>
  )
}
