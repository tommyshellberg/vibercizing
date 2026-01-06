import { useEffect, useRef, useCallback } from 'react'
import { WebcamFeed } from './components/WebcamFeed'
import { RepCounter } from './components/RepCounter'
import { RequestBalance } from './components/RequestBalance'
import { Toast } from './components/Toast'
import { createWebSocketClient, type WebSocketClient } from './lib/websocket'
import { useStore } from './store/useStore'

const TARGET_REPS = 20
const WS_URL = 'ws://localhost:8000/ws'

function App() {
  const wsRef = useRef<WebSocketClient | null>(null)
  const { setBalance, setConnected, setLastMessage } = useStore()

  const handleExerciseComplete = useCallback(
    (exercise: string, reps: number) => {
      console.log('Exercise complete!', { exercise, reps })
      if (wsRef.current) {
        console.log('Sending to WebSocket...')
        wsRef.current.sendExerciseComplete(exercise, reps)
      } else {
        console.error('WebSocket not connected!')
      }
    },
    []
  )

  useEffect(() => {
    const ws = createWebSocketClient(WS_URL, {
      onConnect: () => {
        console.log('WebSocket connected!')
        setConnected(true)
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected!')
        setConnected(false)
      },
      onBalanceUpdate: (balance) => {
        console.log('Balance update:', balance)
        setBalance(balance)
      },
      onRequestAwarded: (data) => {
        console.log('Request awarded!', data)
        setLastMessage(data.message)
      },
      onError: (message) => {
        console.error('WebSocket error:', message)
        setLastMessage(`Error: ${message}`)
      },
    })

    wsRef.current = ws

    return () => {
      ws.disconnect()
    }
  }, [setBalance, setConnected, setLastMessage])

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Vibercizing</h1>
          <p className="text-zinc-400">
            Earn Claude Code requests through exercise
          </p>
        </header>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <WebcamFeed
              onExerciseComplete={handleExerciseComplete}
              targetReps={TARGET_REPS}
            />
          </div>

          <div className="space-y-6">
            <RequestBalance />
            <RepCounter targetReps={TARGET_REPS} />
          </div>
        </div>

        <footer className="mt-8 text-center text-zinc-500 text-sm">
          <p>Complete {TARGET_REPS} jumping jacks to earn 1 request</p>
        </footer>
      </div>

      <Toast />
    </div>
  )
}

export default App
