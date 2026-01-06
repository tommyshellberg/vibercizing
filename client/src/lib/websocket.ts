export interface Balance {
  requestsAvailable: number
  requestsEarned: number
  requestsSpent: number
}

export interface RequestAwarded {
  exercise: string
  requests: number
  message: string
}

export interface WebSocketHandlers {
  onConnect?: () => void
  onDisconnect?: () => void
  onBalanceUpdate?: (balance: Balance) => void
  onRequestAwarded?: (data: RequestAwarded) => void
  onError?: (message: string) => void
}

export interface WebSocketClient {
  sendExerciseComplete: (exercise: string, reps: number) => void
  disconnect: () => void
}

interface ServerMessage {
  type: string
  requests_available?: number
  requests_earned?: number
  requests_spent?: number
  exercise?: string
  requests?: number
  message?: string
}

export function createWebSocketClient(
  url: string,
  handlers: WebSocketHandlers = {}
): WebSocketClient {
  const ws = new WebSocket(url)

  ws.onopen = () => {
    handlers.onConnect?.()
  }

  ws.onclose = () => {
    handlers.onDisconnect?.()
  }

  ws.onerror = () => {
    handlers.onError?.('WebSocket connection error')
  }

  ws.onmessage = (event) => {
    const data: ServerMessage = JSON.parse(event.data)

    switch (data.type) {
      case 'balance_update':
        handlers.onBalanceUpdate?.({
          requestsAvailable: data.requests_available ?? 0,
          requestsEarned: data.requests_earned ?? 0,
          requestsSpent: data.requests_spent ?? 0,
        })
        break

      case 'request_awarded':
        handlers.onRequestAwarded?.({
          exercise: data.exercise ?? '',
          requests: data.requests ?? 0,
          message: data.message ?? '',
        })
        break

      case 'error':
        handlers.onError?.(data.message ?? 'Unknown error')
        break
    }
  }

  return {
    sendExerciseComplete(exercise: string, reps: number) {
      const message = {
        type: 'exercise_complete',
        exercise,
        reps,
      }
      console.log('Sending WebSocket message:', message, 'readyState:', ws.readyState)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message))
      } else {
        console.error('WebSocket not open! State:', ws.readyState)
      }
    },

    disconnect() {
      ws.close()
    },
  }
}
