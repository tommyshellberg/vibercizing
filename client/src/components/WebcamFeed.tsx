import { useEffect, useRef, useState, useCallback } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { initializePoseLandmarker, detectPose } from '../lib/mediapipe'
import {
  createJumpingJackDetector,
  getDebugInfo,
  type Landmark,
  type DebugInfo,
} from '../lib/exercises'
import { useStore } from '../store/useStore'

interface WebcamFeedProps {
  onExerciseComplete: (exercise: string, reps: number) => void
  targetReps: number
}

export function WebcamFeed({ onExerciseComplete, targetReps }: WebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const detectorRef = useRef(createJumpingJackDetector())
  const animationRef = useRef<number | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)

  const { incrementReps, resetReps } = useStore()

  const processFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current

    if (!video || !canvas || !landmarker || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(processFrame)
      return
    }

    const timestamp = performance.now()
    const pose = detectPose(landmarker, video, timestamp)

    if (pose) {
      setLandmarks(pose)
      setDebugInfo(getDebugInfo(pose))
      const prevReps = detectorRef.current.getReps()
      detectorRef.current.processFrame(pose)
      const newReps = detectorRef.current.getReps()

      if (newReps > prevReps) {
        incrementReps()

        // Check if target reached
        if (newReps >= targetReps) {
          onExerciseComplete('jumping_jacks', newReps)
          detectorRef.current.reset()
          resetReps()
        }
      }
    }

    // Draw video to canvas
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Draw pose overlay
      if (pose) {
        drawPoseOverlay(ctx, pose, canvas.width, canvas.height)
      }
    }

    animationRef.current = requestAnimationFrame(processFrame)
  }, [incrementReps, resetReps, onExerciseComplete, targetReps])

  useEffect(() => {
    let stream: MediaStream | null = null
    let mounted = true

    async function setup() {
      try {
        // Initialize MediaPipe
        landmarkerRef.current = await initializePoseLandmarker()

        // Check if still mounted after async operation
        if (!mounted) return

        // Get webcam
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        })

        // Check if still mounted after async operation
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // Handle play() promise - it can be interrupted if component unmounts
          try {
            await videoRef.current.play()
          } catch (playError) {
            // AbortError is expected if component unmounts during play()
            if (playError instanceof Error && playError.name === 'AbortError') {
              return
            }
            throw playError
          }
        }

        if (!mounted) return

        setIsLoading(false)
        animationRef.current = requestAnimationFrame(processFrame)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to initialize')
        setIsLoading(false)
      }
    }

    setup()

    return () => {
      mounted = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [processFrame])

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-900/20 rounded-lg">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        width={640}
        height={480}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="w-full max-w-2xl rounded-lg shadow-lg transform scale-x-[-1]"
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <p className="text-white">Loading pose detection...</p>
        </div>
      )}
      {landmarks && debugInfo && (
        <div className="absolute top-4 left-4 bg-black/70 px-3 py-2 rounded text-xs text-white font-mono space-y-1">
          <div className="text-lg font-bold">
            State:{' '}
            <span
              className={
                detectorRef.current.getState() === 'up'
                  ? 'text-green-400'
                  : detectorRef.current.getState() === 'down'
                    ? 'text-blue-400'
                    : 'text-yellow-400'
              }
            >
              {detectorRef.current.getState()}
            </span>
          </div>
          <div>Arms up: {debugInfo.armsUp === null ? '?' : debugInfo.armsUp ? '✓' : '✗'}</div>
          <div>Feet apart: {debugInfo.feetApart === null ? '? (not visible)' : debugInfo.feetApart ? '✓' : '✗'}</div>
          <div className="text-zinc-400 text-[10px] mt-1">
            Ankles: {debugInfo.leftAnkleVisible ? 'L✓' : 'L✗'} {debugInfo.rightAnkleVisible ? 'R✓' : 'R✗'}
          </div>
        </div>
      )}
    </div>
  )
}

function drawPoseOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number
) {
  // Draw key landmarks
  const keyPoints = [11, 12, 15, 16, 23, 24, 27, 28] // shoulders, wrists, hips, ankles
  ctx.fillStyle = '#00ff00'

  for (const idx of keyPoints) {
    const lm = landmarks[idx]
    if (lm && lm.visibility > 0.5) {
      ctx.beginPath()
      ctx.arc(lm.x * width, lm.y * height, 8, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  // Draw connections
  ctx.strokeStyle = '#00ff00'
  ctx.lineWidth = 3

  const connections = [
    [11, 12], // shoulders
    [11, 23], // left torso
    [12, 24], // right torso
    [23, 24], // hips
    [11, 15], // left arm (simplified)
    [12, 16], // right arm (simplified)
    [23, 27], // left leg (simplified)
    [24, 28], // right leg (simplified)
  ]

  for (const [start, end] of connections) {
    const startLm = landmarks[start]
    const endLm = landmarks[end]
    if (startLm?.visibility > 0.5 && endLm?.visibility > 0.5) {
      ctx.beginPath()
      ctx.moveTo(startLm.x * width, startLm.y * height)
      ctx.lineTo(endLm.x * width, endLm.y * height)
      ctx.stroke()
    }
  }
}
