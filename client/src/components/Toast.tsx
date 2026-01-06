import { useEffect } from 'react'
import { useStore } from '../store/useStore'

export function Toast() {
  const lastMessage = useStore((state) => state.lastMessage)
  const clearMessage = useStore((state) => state.clearMessage)

  useEffect(() => {
    if (lastMessage) {
      const timer = setTimeout(() => {
        clearMessage()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [lastMessage, clearMessage])

  if (!lastMessage) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in">
      {lastMessage}
    </div>
  )
}
