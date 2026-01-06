import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createWebSocketClient, type WebSocketClient } from './websocket'

let mockInstance: MockWebSocket | null = null

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null

  sentMessages: string[] = []

  constructor(_url: string) {
    mockInstance = this
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

describe('WebSocket client', () => {
  let client: WebSocketClient

  beforeEach(() => {
    mockInstance = null
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function getMockWs(): MockWebSocket {
    if (!mockInstance) throw new Error('WebSocket not created')
    return mockInstance
  }

  it('connects to the server', () => {
    client = createWebSocketClient('ws://localhost:8000/ws')
    expect(getMockWs()).toBeDefined()
  })

  it('calls onConnect when connection opens', () => {
    const onConnect = vi.fn()
    client = createWebSocketClient('ws://test', { onConnect })
    getMockWs().simulateOpen()
    expect(onConnect).toHaveBeenCalled()
  })

  it('calls onBalanceUpdate on balance message', () => {
    const onBalanceUpdate = vi.fn()
    client = createWebSocketClient('ws://test', { onBalanceUpdate })
    getMockWs().simulateOpen()
    getMockWs().simulateMessage({
      type: 'balance_update',
      requests_available: 5,
      requests_earned: 10,
      requests_spent: 5,
    })
    expect(onBalanceUpdate).toHaveBeenCalledWith({
      requestsAvailable: 5,
      requestsEarned: 10,
      requestsSpent: 5,
    })
  })

  it('calls onRequestAwarded on request_awarded message', () => {
    const onRequestAwarded = vi.fn()
    client = createWebSocketClient('ws://test', { onRequestAwarded })
    getMockWs().simulateOpen()
    getMockWs().simulateMessage({
      type: 'request_awarded',
      exercise: 'jumping_jacks',
      requests: 1,
      message: 'Nice! +1 request',
    })
    expect(onRequestAwarded).toHaveBeenCalledWith({
      exercise: 'jumping_jacks',
      requests: 1,
      message: 'Nice! +1 request',
    })
  })

  it('calls onError on error message', () => {
    const onError = vi.fn()
    client = createWebSocketClient('ws://test', { onError })
    getMockWs().simulateOpen()
    getMockWs().simulateMessage({
      type: 'error',
      message: 'Something went wrong',
    })
    expect(onError).toHaveBeenCalledWith('Something went wrong')
  })

  it('sends exercise complete message', () => {
    client = createWebSocketClient('ws://test')
    getMockWs().simulateOpen()
    client.sendExerciseComplete('jumping_jacks', 20)
    expect(getMockWs().sentMessages).toEqual([
      JSON.stringify({
        type: 'exercise_complete',
        exercise: 'jumping_jacks',
        reps: 20,
      }),
    ])
  })

  it('calls onDisconnect when connection closes', () => {
    const onDisconnect = vi.fn()
    client = createWebSocketClient('ws://test', { onDisconnect })
    getMockWs().simulateOpen()
    getMockWs().close()
    expect(onDisconnect).toHaveBeenCalled()
  })
})
