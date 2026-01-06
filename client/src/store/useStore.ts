import { create } from 'zustand'

interface Balance {
  requestsAvailable: number
  requestsEarned: number
  requestsSpent: number
}

interface AppState extends Balance {
  currentReps: number
  isConnected: boolean
  lastMessage: string | null

  setBalance: (balance: Balance) => void
  incrementReps: () => void
  resetReps: () => void
  setConnected: (connected: boolean) => void
  setLastMessage: (message: string) => void
  clearMessage: () => void
}

export const useStore = create<AppState>((set) => ({
  requestsAvailable: 0,
  requestsEarned: 0,
  requestsSpent: 0,
  currentReps: 0,
  isConnected: false,
  lastMessage: null,

  setBalance: (balance) =>
    set({
      requestsAvailable: balance.requestsAvailable,
      requestsEarned: balance.requestsEarned,
      requestsSpent: balance.requestsSpent,
    }),

  incrementReps: () => set((state) => ({ currentReps: state.currentReps + 1 })),

  resetReps: () => set({ currentReps: 0 }),

  setConnected: (connected) => set({ isConnected: connected }),

  setLastMessage: (message) => set({ lastMessage: message }),

  clearMessage: () => set({ lastMessage: null }),
}))
