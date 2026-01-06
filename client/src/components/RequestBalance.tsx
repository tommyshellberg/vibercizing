import { useStore } from '../store/useStore'

export function RequestBalance() {
  const requestsAvailable = useStore((state) => state.requestsAvailable)
  const requestsEarned = useStore((state) => state.requestsEarned)
  const requestsSpent = useStore((state) => state.requestsSpent)
  const isConnected = useStore((state) => state.isConnected)

  return (
    <div className="bg-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-zinc-400 text-sm uppercase tracking-wide">
          Request Balance
        </h2>
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />
      </div>

      <div className="text-5xl font-bold text-white text-center mb-4">
        {requestsAvailable}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="text-center">
          <div className="text-zinc-500">Earned</div>
          <div className="text-green-400 font-medium">{requestsEarned}</div>
        </div>
        <div className="text-center">
          <div className="text-zinc-500">Spent</div>
          <div className="text-red-400 font-medium">{requestsSpent}</div>
        </div>
      </div>
    </div>
  )
}
