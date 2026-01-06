import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'

describe('useStore', () => {
  beforeEach(() => {
    useStore.setState({
      requestsAvailable: 0,
      requestsEarned: 0,
      requestsSpent: 0,
      currentReps: 0,
      isConnected: false,
      lastMessage: null,
    })
  })

  describe('balance state', () => {
    it('starts with zero balance', () => {
      const state = useStore.getState()
      expect(state.requestsAvailable).toBe(0)
      expect(state.requestsEarned).toBe(0)
      expect(state.requestsSpent).toBe(0)
    })

    it('updates balance', () => {
      useStore.getState().setBalance({
        requestsAvailable: 5,
        requestsEarned: 10,
        requestsSpent: 5,
      })
      const state = useStore.getState()
      expect(state.requestsAvailable).toBe(5)
      expect(state.requestsEarned).toBe(10)
      expect(state.requestsSpent).toBe(5)
    })
  })

  describe('rep tracking', () => {
    it('starts with zero reps', () => {
      expect(useStore.getState().currentReps).toBe(0)
    })

    it('increments reps', () => {
      useStore.getState().incrementReps()
      expect(useStore.getState().currentReps).toBe(1)
    })

    it('resets reps', () => {
      useStore.getState().incrementReps()
      useStore.getState().incrementReps()
      useStore.getState().resetReps()
      expect(useStore.getState().currentReps).toBe(0)
    })
  })

  describe('connection state', () => {
    it('starts disconnected', () => {
      expect(useStore.getState().isConnected).toBe(false)
    })

    it('tracks connection state', () => {
      useStore.getState().setConnected(true)
      expect(useStore.getState().isConnected).toBe(true)
    })
  })

  describe('messages', () => {
    it('stores last message', () => {
      useStore.getState().setLastMessage('Test message')
      expect(useStore.getState().lastMessage).toBe('Test message')
    })

    it('clears message', () => {
      useStore.getState().setLastMessage('Test')
      useStore.getState().clearMessage()
      expect(useStore.getState().lastMessage).toBeNull()
    })
  })
})
