import { useStore } from '../store/useStore'

const REPS_PER_REQUEST = 20
const CALORIES_PER_REP = 0.2

export function LifetimeStats() {
  const requestsEarned = useStore((state) => state.requestsEarned)

  const totalJumpingJacks = requestsEarned * REPS_PER_REQUEST
  const caloriesBurned = totalJumpingJacks * CALORIES_PER_REP

  return (
    <div className="bg-zinc-800 rounded-lg p-6">
      <h2 className="text-zinc-400 text-sm uppercase tracking-wide mb-4">
        Lifetime Stats
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-white">
            {totalJumpingJacks.toLocaleString()}
          </div>
          <div className="text-zinc-500 text-sm">Jumping Jacks</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-orange-400">
            {caloriesBurned.toLocaleString()}
          </div>
          <div className="text-zinc-500 text-sm">Calories Burned</div>
        </div>
      </div>
    </div>
  )
}
