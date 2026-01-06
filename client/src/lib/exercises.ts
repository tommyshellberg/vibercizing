/**
 * Exercise detection using MediaPipe pose landmarks.
 *
 * MediaPipe Pose returns 33 landmarks with normalized coordinates (0-1).
 * Y-axis: 0 = top, 1 = bottom
 * X-axis: 0 = left, 1 = right (from camera's perspective, mirrored for user)
 */

export interface Landmark {
  x: number
  y: number
  z: number
  visibility: number
}

export type JumpingJackState = 'up' | 'down' | 'transition' | 'unknown'

// MediaPipe landmark indices
const LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const

// Thresholds for detection
const THRESHOLDS = {
  // How much higher (in Y) wrists must be above shoulders for "arms up"
  ARMS_UP_MARGIN: 0.05,
  // Minimum X distance between ankles relative to hip width for "feet apart"
  FEET_SPREAD_RATIO: 2.0,
  // Minimum visibility to trust a landmark
  MIN_VISIBILITY: 0.3, // Lowered to be more forgiving
}

export interface DebugInfo {
  armsUp: boolean | null
  feetApart: boolean | null
  leftWristY: number | null
  rightWristY: number | null
  avgShoulderY: number | null
  leftAnkleVisible: boolean
  rightAnkleVisible: boolean
}

function getLandmark(pose: Landmark[], index: number): Landmark | null {
  const landmark = pose[index]
  if (!landmark || landmark.visibility < THRESHOLDS.MIN_VISIBILITY) {
    return null
  }
  return landmark
}

function areArmsUp(pose: Landmark[]): boolean | null {
  const leftShoulder = getLandmark(pose, LANDMARKS.LEFT_SHOULDER)
  const rightShoulder = getLandmark(pose, LANDMARKS.RIGHT_SHOULDER)
  const leftWrist = getLandmark(pose, LANDMARKS.LEFT_WRIST)
  const rightWrist = getLandmark(pose, LANDMARKS.RIGHT_WRIST)

  if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) {
    return null
  }

  const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2
  const avgWristY = (leftWrist.y + rightWrist.y) / 2

  // Wrists should be above shoulders (lower Y value)
  return avgWristY < avgShoulderY - THRESHOLDS.ARMS_UP_MARGIN
}

function areFeetApart(pose: Landmark[]): boolean | null {
  const leftHip = getLandmark(pose, LANDMARKS.LEFT_HIP)
  const rightHip = getLandmark(pose, LANDMARKS.RIGHT_HIP)
  const leftAnkle = getLandmark(pose, LANDMARKS.LEFT_ANKLE)
  const rightAnkle = getLandmark(pose, LANDMARKS.RIGHT_ANKLE)

  if (!leftHip || !rightHip || !leftAnkle || !rightAnkle) {
    return null
  }

  const hipWidth = Math.abs(rightHip.x - leftHip.x)
  const ankleSpread = Math.abs(rightAnkle.x - leftAnkle.x)

  // Ankles should be spread wider than hip width
  return ankleSpread > hipWidth * THRESHOLDS.FEET_SPREAD_RATIO
}

/**
 * Get debug information about pose detection.
 */
export function getDebugInfo(pose: Landmark[]): DebugInfo {
  const leftWrist = getLandmark(pose, LANDMARKS.LEFT_WRIST)
  const rightWrist = getLandmark(pose, LANDMARKS.RIGHT_WRIST)
  const leftShoulder = getLandmark(pose, LANDMARKS.LEFT_SHOULDER)
  const rightShoulder = getLandmark(pose, LANDMARKS.RIGHT_SHOULDER)
  const leftAnkle = pose[LANDMARKS.LEFT_ANKLE]
  const rightAnkle = pose[LANDMARKS.RIGHT_ANKLE]

  return {
    armsUp: areArmsUp(pose),
    feetApart: areFeetApart(pose),
    leftWristY: leftWrist?.y ?? null,
    rightWristY: rightWrist?.y ?? null,
    avgShoulderY:
      leftShoulder && rightShoulder
        ? (leftShoulder.y + rightShoulder.y) / 2
        : null,
    leftAnkleVisible: (leftAnkle?.visibility ?? 0) > THRESHOLDS.MIN_VISIBILITY,
    rightAnkleVisible: (rightAnkle?.visibility ?? 0) > THRESHOLDS.MIN_VISIBILITY,
  }
}

/**
 * Detect the current jumping jack position from a pose.
 * Supports upper-body-only mode if legs aren't visible.
 */
export function detectJumpingJackPosition(pose: Landmark[]): JumpingJackState {
  if (!pose || pose.length < 33) {
    return 'unknown'
  }

  const armsUp = areArmsUp(pose)
  const feetApart = areFeetApart(pose)

  // If we can't detect arms at all, return unknown
  if (armsUp === null) {
    return 'unknown'
  }

  // Upper-body-only mode: if legs aren't visible, use arms only
  if (feetApart === null) {
    return armsUp ? 'up' : 'down'
  }

  // Full-body mode: require both arms and legs
  if (armsUp && feetApart) {
    return 'up'
  }

  if (!armsUp && !feetApart) {
    return 'down'
  }

  return 'transition'
}

export interface JumpingJackDetector {
  processFrame: (pose: Landmark[]) => void
  getReps: () => number
  getState: () => JumpingJackState
  reset: () => void
}

/**
 * Create a jumping jack detector that counts reps.
 *
 * A rep is counted on completing a full cycle: down → up → down
 */
export function createJumpingJackDetector(): JumpingJackDetector {
  let reps = 0
  let currentState: JumpingJackState = 'unknown'
  let hasReachedUp = false

  return {
    processFrame(pose: Landmark[]): void {
      const newState = detectJumpingJackPosition(pose)

      // Ignore unknown states
      if (newState === 'unknown') {
        return
      }

      // Track if we've reached the up position
      if (newState === 'up') {
        hasReachedUp = true
      }

      // Count rep when returning to down after reaching up
      if (newState === 'down' && hasReachedUp && currentState !== 'down') {
        reps++
        hasReachedUp = false
      }

      currentState = newState
    },

    getReps(): number {
      return reps
    },

    getState(): JumpingJackState {
      return currentState
    },

    reset(): void {
      reps = 0
      currentState = 'unknown'
      hasReachedUp = false
    },
  }
}
