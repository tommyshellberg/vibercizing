/**
 * MediaPipe Pose detection setup using @mediapipe/tasks-vision.
 */

import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { Landmark } from './exercises'

let poseLandmarker: PoseLandmarker | null = null
let isInitializing = false

/**
 * Initialize the MediaPipe pose landmarker.
 * This loads the model from CDN on first call and caches it.
 */
export async function initializePoseLandmarker(): Promise<PoseLandmarker> {
  if (poseLandmarker) {
    return poseLandmarker
  }

  if (isInitializing) {
    // Wait for existing initialization
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (poseLandmarker) {
      return poseLandmarker
    }
  }

  isInitializing = true

  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    )

    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    })

    return poseLandmarker
  } finally {
    isInitializing = false
  }
}

/**
 * Convert MediaPipe result to our Landmark format.
 */
export function convertLandmarks(
  result: PoseLandmarkerResult
): Landmark[] | null {
  if (!result.landmarks || result.landmarks.length === 0) {
    return null
  }

  // Get the first pose's landmarks
  const landmarks = result.landmarks[0]
  if (!landmarks || landmarks.length < 33) {
    return null
  }

  return landmarks.map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: lm.z,
    visibility: lm.visibility ?? 1,
  }))
}

/**
 * Detect pose from a video frame.
 */
export function detectPose(
  landmarker: PoseLandmarker,
  video: HTMLVideoElement,
  timestamp: number
): Landmark[] | null {
  const result = landmarker.detectForVideo(video, timestamp)
  return convertLandmarks(result)
}
