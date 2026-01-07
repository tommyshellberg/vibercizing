import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  type Landmark,
  detectJumpingJackPosition,
  createJumpingJackDetector,
  THRESHOLDS,
} from './exercises'

const { STATE_CHANGE_DEBOUNCE_MS, ARMS_UP_MARGIN } = THRESHOLDS

// Semantic constants for test poses - derived from thresholds
const SHOULDER_Y = 0.3

// Arms must be ARMS_UP_MARGIN above shoulders to count as "up"
// Using shoulder Y - margin - 0.05 buffer ensures we're clearly above threshold
const WRIST_Y_UP = SHOULDER_Y - ARMS_UP_MARGIN - 0.05
const WRIST_Y_DOWN = 0.5 // Clearly below shoulders

// Feet positions
const ANKLE_X_TOGETHER_LEFT = 0.48
const ANKLE_X_TOGETHER_RIGHT = 0.52
const ANKLE_X_APART_LEFT = 0.2
const ANKLE_X_APART_RIGHT = 0.8

// Helper to create a minimal pose with just the landmarks we need
function createPose(overrides: {
  leftWristY?: number
  rightWristY?: number
  leftShoulderY?: number
  rightShoulderY?: number
  leftAnkleX?: number
  rightAnkleX?: number
  leftHipX?: number
  rightHipX?: number
}): Landmark[] {
  const pose: Landmark[] = new Array(33).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }))

  // Shoulders (11, 12)
  pose[11] = { x: 0.4, y: overrides.leftShoulderY ?? SHOULDER_Y, z: 0, visibility: 1 }
  pose[12] = { x: 0.6, y: overrides.rightShoulderY ?? SHOULDER_Y, z: 0, visibility: 1 }

  // Wrists (15, 16)
  pose[15] = { x: 0.3, y: overrides.leftWristY ?? WRIST_Y_DOWN, z: 0, visibility: 1 }
  pose[16] = { x: 0.7, y: overrides.rightWristY ?? WRIST_Y_DOWN, z: 0, visibility: 1 }

  // Hips (23, 24) - used for reference
  pose[23] = { x: overrides.leftHipX ?? 0.45, y: 0.6, z: 0, visibility: 1 }
  pose[24] = { x: overrides.rightHipX ?? 0.55, y: 0.6, z: 0, visibility: 1 }

  // Ankles (27, 28)
  pose[27] = { x: overrides.leftAnkleX ?? 0.45, y: 0.9, z: 0, visibility: 1 }
  pose[28] = { x: overrides.rightAnkleX ?? 0.55, y: 0.9, z: 0, visibility: 1 }

  return pose
}

describe('detectJumpingJackPosition', () => {
  it('returns "down" when arms are down and feet together', () => {
    const pose = createPose({
      leftWristY: WRIST_Y_DOWN,
      rightWristY: WRIST_Y_DOWN,
      leftAnkleX: ANKLE_X_TOGETHER_LEFT,
      rightAnkleX: ANKLE_X_TOGETHER_RIGHT,
    })
    expect(detectJumpingJackPosition(pose)).toBe('down')
  })

  it('returns "up" when BOTH arms are up and feet apart', () => {
    const pose = createPose({
      leftWristY: WRIST_Y_UP,
      rightWristY: WRIST_Y_UP,
      leftAnkleX: ANKLE_X_APART_LEFT,
      rightAnkleX: ANKLE_X_APART_RIGHT,
    })
    expect(detectJumpingJackPosition(pose)).toBe('up')
  })

  it('returns "down" when only ONE arm is up (requires both)', () => {
    // Left arm up, right arm down - should NOT be 'up'
    const poseLeftOnly = createPose({
      leftWristY: WRIST_Y_UP,
      rightWristY: WRIST_Y_DOWN,
      leftAnkleX: ANKLE_X_APART_LEFT,
      rightAnkleX: ANKLE_X_APART_RIGHT,
    })
    expect(detectJumpingJackPosition(poseLeftOnly)).toBe('transition')

    // Right arm up, left arm down - should NOT be 'up'
    const poseRightOnly = createPose({
      leftWristY: WRIST_Y_DOWN,
      rightWristY: WRIST_Y_UP,
      leftAnkleX: ANKLE_X_APART_LEFT,
      rightAnkleX: ANKLE_X_APART_RIGHT,
    })
    expect(detectJumpingJackPosition(poseRightOnly)).toBe('transition')
  })

  it('returns "transition" when only arms are up but feet together', () => {
    const pose = createPose({
      leftWristY: WRIST_Y_UP,
      rightWristY: WRIST_Y_UP,
      leftAnkleX: ANKLE_X_TOGETHER_LEFT,
      rightAnkleX: ANKLE_X_TOGETHER_RIGHT,
    })
    expect(detectJumpingJackPosition(pose)).toBe('transition')
  })

  it('returns "transition" when only feet are apart but arms down', () => {
    const pose = createPose({
      leftWristY: WRIST_Y_DOWN,
      rightWristY: WRIST_Y_DOWN,
      leftAnkleX: ANKLE_X_APART_LEFT,
      rightAnkleX: ANKLE_X_APART_RIGHT,
    })
    expect(detectJumpingJackPosition(pose)).toBe('transition')
  })

  it('returns "unknown" for empty pose', () => {
    expect(detectJumpingJackPosition([])).toBe('unknown')
  })
})

describe('createJumpingJackDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with zero reps', () => {
    const detector = createJumpingJackDetector()
    expect(detector.getReps()).toBe(0)
  })

  it('counts a rep on down → up → down cycle', () => {
    const detector = createJumpingJackDetector()

    // Start in down position
    const downPose = createPose({
      leftWristY: WRIST_Y_DOWN,
      rightWristY: WRIST_Y_DOWN,
      leftAnkleX: ANKLE_X_TOGETHER_LEFT,
      rightAnkleX: ANKLE_X_TOGETHER_RIGHT,
    })
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(0)

    // Move to up position (advance time to pass debounce)
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    const upPose = createPose({
      leftWristY: WRIST_Y_UP,
      rightWristY: WRIST_Y_UP,
      leftAnkleX: ANKLE_X_APART_LEFT,
      rightAnkleX: ANKLE_X_APART_RIGHT,
    })
    detector.processFrame(upPose)
    expect(detector.getReps()).toBe(0)

    // Return to down position - rep completes
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(1)
  })

  it('does not count partial movements', () => {
    const detector = createJumpingJackDetector()

    const downPose = createPose({
      leftWristY: WRIST_Y_DOWN,
      rightWristY: WRIST_Y_DOWN,
      leftAnkleX: ANKLE_X_TOGETHER_LEFT,
      rightAnkleX: ANKLE_X_TOGETHER_RIGHT,
    })

    // Just down positions should not count (even with time passing)
    detector.processFrame(downPose)
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(downPose)
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(0)
  })

  it('debounces rapid state changes to prevent gaming', () => {
    const detector = createJumpingJackDetector()

    const downPose = createPose({
      leftWristY: WRIST_Y_DOWN,
      rightWristY: WRIST_Y_DOWN,
      leftAnkleX: ANKLE_X_TOGETHER_LEFT,
      rightAnkleX: ANKLE_X_TOGETHER_RIGHT,
    })
    const upPose = createPose({
      leftWristY: WRIST_Y_UP,
      rightWristY: WRIST_Y_UP,
      leftAnkleX: ANKLE_X_APART_LEFT,
      rightAnkleX: ANKLE_X_APART_RIGHT,
    })

    // Start down
    detector.processFrame(downPose)

    // Rapid state changes without enough time passing should be ignored
    vi.advanceTimersByTime(100) // Only 100ms - not enough
    detector.processFrame(upPose)
    expect(detector.getState()).toBe('down') // Should still be down

    vi.advanceTimersByTime(100) // Only 200ms total - still not enough
    detector.processFrame(downPose)
    expect(detector.getState()).toBe('down')

    // After enough time, state change should work
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(upPose)
    expect(detector.getState()).toBe('up')
  })

  it('counts multiple reps', () => {
    const detector = createJumpingJackDetector()

    const downPose = createPose({
      leftWristY: WRIST_Y_DOWN,
      rightWristY: WRIST_Y_DOWN,
      leftAnkleX: ANKLE_X_TOGETHER_LEFT,
      rightAnkleX: ANKLE_X_TOGETHER_RIGHT,
    })
    const upPose = createPose({
      leftWristY: WRIST_Y_UP,
      rightWristY: WRIST_Y_UP,
      leftAnkleX: ANKLE_X_APART_LEFT,
      rightAnkleX: ANKLE_X_APART_RIGHT,
    })

    // First rep
    detector.processFrame(downPose)
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(upPose)
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(1)

    // Second rep
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(upPose)
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(2)

    // Third rep
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(upPose)
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(3)
  })

  it('resets rep count', () => {
    const detector = createJumpingJackDetector()

    const downPose = createPose({
      leftWristY: WRIST_Y_DOWN,
      rightWristY: WRIST_Y_DOWN,
      leftAnkleX: ANKLE_X_TOGETHER_LEFT,
      rightAnkleX: ANKLE_X_TOGETHER_RIGHT,
    })
    const upPose = createPose({
      leftWristY: WRIST_Y_UP,
      rightWristY: WRIST_Y_UP,
      leftAnkleX: ANKLE_X_APART_LEFT,
      rightAnkleX: ANKLE_X_APART_RIGHT,
    })

    detector.processFrame(downPose)
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(upPose)
    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(1)

    detector.reset()
    expect(detector.getReps()).toBe(0)
  })

  it('reports current state', () => {
    const detector = createJumpingJackDetector()

    const downPose = createPose({
      leftWristY: WRIST_Y_DOWN,
      rightWristY: WRIST_Y_DOWN,
      leftAnkleX: ANKLE_X_TOGETHER_LEFT,
      rightAnkleX: ANKLE_X_TOGETHER_RIGHT,
    })
    detector.processFrame(downPose)
    expect(detector.getState()).toBe('down')

    vi.advanceTimersByTime(STATE_CHANGE_DEBOUNCE_MS)
    const upPose = createPose({
      leftWristY: WRIST_Y_UP,
      rightWristY: WRIST_Y_UP,
      leftAnkleX: ANKLE_X_APART_LEFT,
      rightAnkleX: ANKLE_X_APART_RIGHT,
    })
    detector.processFrame(upPose)
    expect(detector.getState()).toBe('up')
  })
})
