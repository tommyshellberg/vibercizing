import { useStore } from '../store/useStore'

interface RepCounterProps {
  targetReps: number
}

export function RepCounter({ targetReps }: RepCounterProps) {
  const currentReps = useStore((state) => state.currentReps)
  const progress = Math.min((currentReps / targetReps) * 100, 100)

  return (
    <div className="bg-zinc-800 rounded-lg p-6 text-center">
      <h2 className="text-zinc-400 text-sm uppercase tracking-wide mb-2">
        Jumping Jacks
      </h2>
      <div className="text-6xl font-bold text-white mb-2">
        {currentReps}
        <span className="text-2xl text-zinc-500">/{targetReps}</span>
      </div>
      <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-zinc-500 text-sm mt-2">
        {currentReps >= targetReps
          ? 'Set complete!'
          : `${targetReps - currentReps} more to earn a request`}
      </p>
    </div>
  )
}
