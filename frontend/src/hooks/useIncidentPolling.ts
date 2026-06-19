'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { IncidentStatusResponse, IncidentStatus } from '@/lib/types'

interface UseIncidentPollingOptions {
  incidentId: string
  enabled?: boolean
  onResolved?: (status: IncidentStatusResponse) => void
}

interface UseIncidentPollingReturn {
  statusData: IncidentStatusResponse | null
  isPolling: boolean
  error: string | null
}

const TERMINAL_STATES: IncidentStatus[] = ['RESOLVED', 'FAILED']
const POLL_INTERVAL_MS = 3_000

export function useIncidentPolling({
  incidentId,
  enabled = true,
  onResolved,
}: UseIncidentPollingOptions): UseIncidentPollingReturn {
  const [statusData, setStatusData] = useState<IncidentStatusResponse | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const onResolvedRef = useRef(onResolved)
  onResolvedRef.current = onResolved

  const poll = useCallback(async () => {
    if (!mountedRef.current) return

    try {
      const data = await api.incidents.getStatus(incidentId)
      if (!mountedRef.current) return

      setStatusData(data)
      setError(null)

      if (TERMINAL_STATES.includes(data.status)) {
        setIsPolling(false)
        onResolvedRef.current?.(data)
        return
      }

      // Schedule next poll
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
    } catch (err) {
      if (!mountedRef.current) return
      setError((err as Error).message)
      // Retry after interval even on error
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
    }
  }, [incidentId])

  useEffect(() => {
    mountedRef.current = true
    if (!enabled) return

    setIsPolling(true)
    poll()

    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, poll])

  return { statusData, isPolling, error }
}
