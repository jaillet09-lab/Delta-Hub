import 'server-only'

// Thin wrapper over Upstash QStash for delayed HTTP jobs (used to send a call
// follow-up email exactly N minutes after the call). Dormant if QSTASH_TOKEN is
// unset — enqueue() returns false and callers can fall back or skip.

export function qstashConfigured(): boolean {
  return !!process.env.QSTASH_TOKEN?.trim()
}

/**
 * Publish a delayed POST to `targetUrl`. `delaySeconds` schedules it into the
 * future (QStash holds and delivers it). The target authenticates the call with
 * the CRON_SECRET bearer we forward here. Returns true on a successful enqueue.
 */
export async function enqueue(
  targetUrl: string,
  body: Record<string, unknown>,
  opts: { delaySeconds?: number } = {},
): Promise<boolean> {
  const token = process.env.QSTASH_TOKEN?.trim()
  if (!token) return false
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Forwarded to the target so it can authenticate the job.
      'Upstash-Forward-Authorization': `Bearer ${process.env.CRON_SECRET ?? ''}`,
    }
    if (opts.delaySeconds && opts.delaySeconds > 0) {
      headers['Upstash-Delay'] = `${Math.round(opts.delaySeconds)}s`
    }
    const res = await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}
