'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { WsMessage } from '@/lib/types'

interface UseWebSocketOptions {
  incidentId: string
  enabled?: boolean
  onMessage: (msg: WsMessage) => void
}

export function useWebSocket({ incidentId, enabled = true, onMessage }: UseWebSocketOptions) {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const clientRef = useRef<unknown>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(async () => {
    if (!enabled || !mountedRef.current) return

    try {
      const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080/ws'

      // Dynamic import to avoid SSR issues
      const [{ Client }, SockJS] = await Promise.all([
        import('@stomp/stompjs'),
        import('sockjs-client'),
      ])

      const client = new Client({
        webSocketFactory: () => new (SockJS as unknown as new (url: string) => WebSocket)(WS_URL),
        reconnectDelay: 5000,
        onConnect: () => {
          if (!mountedRef.current) return
          client.subscribe(`/topic/incidents/${incidentId}`, (frame) => {
            try {
              const msg: WsMessage = JSON.parse(frame.body)
              onMessageRef.current(msg)
            } catch {
              // Ignore malformed messages
            }
          })
        },
        onStompError: () => {
          // Silently handle STOMP errors — polling is the fallback
        },
      })

      client.activate()
      clientRef.current = client
    } catch {
      // WebSocket not available — polling covers this case
    }
  }, [incidentId, enabled])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      const c = clientRef.current as { deactivate?: () => void } | null
      if (c?.deactivate) c.deactivate()
    }
  }, [connect])
}
