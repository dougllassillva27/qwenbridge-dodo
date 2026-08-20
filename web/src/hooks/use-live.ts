import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type Overview } from '@/lib/api'

type LiveMode = 'live' | 'poll' | 'connecting'

const LIVE_STALE_MS = 15000 // no SSE message for this long → fall back to polling

/**
 * Subscribes to the /admin/api/live SSE stream (one long-lived request) for
 * real-time dashboard updates. If the stream fails or stalls, it transparently
 * falls back to 4s HTTP polling so the dashboard never freezes.
 */
export function useLiveOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [mode, setMode] = useState<LiveMode>('live')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const connectedRef = useRef(false)
  const lastPushRef = useRef(0)

  const apply = useCallback((o: Overview) => {
    setData(o)
    lastPushRef.current = Date.now()
    setLastUpdate(new Date())
  }, [])

  useEffect(() => {
    let es: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let watchdog: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (pollTimer) return
      setMode('poll')
      pollTimer = setInterval(() => {
        api
          .overview()
          .then(apply)
          .catch(() => {})
      }, 4000)
    }

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    if (typeof EventSource !== 'undefined') {
      es = new EventSource('/admin/api/live')
      es.onmessage = (e) => {
        connectedRef.current = true
        setMode('live')
        try {
          apply(JSON.parse(e.data))
        } catch {
          /* bad frame */
        }
      }
      es.onerror = () => {
        // EventSource reconnects on its own; if it never opens, fall back.
        if (!connectedRef.current) startPolling()
      }
      es.onopen = () => {
        connectedRef.current = true
        setMode('live')
        stopPolling()
      }
    } else {
      startPolling()
    }

    // Watchdog: if the live stream stalls (no push for LIVE_STALE_MS), poll.
    watchdog = setInterval(() => {
      if (connectedRef.current && Date.now() - lastPushRef.current > LIVE_STALE_MS) {
        connectedRef.current = false
        try {
          es?.close()
        } catch { /* ignore */ }
        startPolling()
      }
    }, 3000)

    return () => {
      try {
        es?.close()
      } catch { /* ignore */ }
      stopPolling()
      if (watchdog) clearInterval(watchdog)
    }
  }, [apply])

  return { data, mode, lastUpdate }
}