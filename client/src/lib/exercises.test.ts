import { describe, it, expect } from 'vitest'
import {
  type Landmark,
  detectJumpingJackPosition,
  createJumpingJackDetector,
} from './exercises'

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
  pose[11] = { x: 0.4, y: overrides.leftShoulderY ?? 0.3, z: 0, visibility: 1 }
  pose[12] = { x: 0.6, y: overrides.rightShoulderY ?? 0.3, z: 0, visibility: 1 }

  // Wrists (15, 16)
  pose[15] = { x: 0.3, y: overrides.leftWristY ?? 0.5, z: 0, visibility: 1 }
  pose[16] = { x: 0.7, y: overrides.rightWristY ?? 0.5, z: 0, visibility: 1 }

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
      leftWristY: 0.5, // below shoulders (0.3)
      rightWristY: 0.5,
      leftAnkleX: 0.48, // close together
      rightAnkleX: 0.52,
    })
    expect(detectJumpingJackPosition(pose)).toBe('down')
  })

  it('returns "up" when arms are up and feet apart', () => {
    const pose = createPose({
      leftWristY: 0.1, // above shoulders (0.3)
      rightWristY: 0.1,
      leftAnkleX: 0.2, // spread apart
      rightAnkleX: 0.8,
    })
    expect(detectJumpingJackPosition(pose)).toBe('up')
  })

  it('returns "transition" when only arms are up but feet together', () => {
    const pose = createPose({
      leftWristY: 0.1,
      rightWristY: 0.1,
      leftAnkleX: 0.48, // still close
      rightAnkleX: 0.52,
    })
    expect(detectJumpingJackPosition(pose)).toBe('transition')
  })

  it('returns "transition" when only feet are apart but arms down', () => {
    const pose = createPose({
      leftWristY: 0.5,
      rightWristY: 0.5,
      leftAnkleX: 0.2,
      rightAnkleX: 0.8,
    })
    expect(detectJumpingJackPosition(pose)).toBe('transition')
  })

  it('returns "unknown" for empty pose', () => {
    expect(detectJumpingJackPosition([])).toBe('unknown')
  })
})

describe('createJumpingJackDetector', () => {
  it('starts with zero reps', () => {
    const detector = createJumpingJackDetector()
    expect(detector.getReps()).toBe(0)
  })

  it('counts a rep on down → up → down cycle', () => {
    const detector = createJumpingJackDetector()

    // Start in down position
    const downPose = createPose({
      leftWristY: 0.5,
      rightWristY: 0.5,
      leftAnkleX: 0.48,
      rightAnkleX: 0.52,
    })
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(0)

    // Move to up position
    const upPose = createPose({
      leftWristY: 0.1,
      rightWristY: 0.1,
      leftAnkleX: 0.2,
      rightAnkleX: 0.8,
    })
    detector.processFrame(upPose)
    expect(detector.getReps()).toBe(0)

    // Return to down position - rep completes
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(1)
  })

  it('does not count partial movements', () => {
    const detector = createJumpingJackDetector()

    const downPose = createPose({
      leftWristY: 0.5,
      rightWristY: 0.5,
      leftAnkleX: 0.48,
      rightAnkleX: 0.52,
    })

    // Just down positions should not count
    detector.processFrame(downPose)
    detector.processFrame(downPose)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(0)
  })

  it('counts multiple reps', () => {
    const detector = createJumpingJackDetector()

    const downPose = createPose({
      leftWristY: 0.5,
      rightWristY: 0.5,
      leftAnkleX: 0.48,
      rightAnkleX: 0.52,
    })
    const upPose = createPose({
      leftWristY: 0.1,
      rightWristY: 0.1,
      leftAnkleX: 0.2,
      rightAnkleX: 0.8,
    })

    // First rep
    detector.processFrame(downPose)
    detector.processFrame(upPose)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(1)

    // Second rep
    detector.processFrame(upPose)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(2)

    // Third rep
    detector.processFrame(upPose)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(3)
  })

  it('resets rep count', () => {
    const detector = createJumpingJackDetector()

    const downPose = createPose({
      leftWristY: 0.5,
      rightWristY: 0.5,
      leftAnkleX: 0.48,
      rightAnkleX: 0.52,
    })
    const upPose = createPose({
      leftWristY: 0.1,
      rightWristY: 0.1,
      leftAnkleX: 0.2,
      rightAnkleX: 0.8,
    })

    detector.processFrame(downPose)
    detector.processFrame(upPose)
    detector.processFrame(downPose)
    expect(detector.getReps()).toBe(1)

    detector.reset()
    expect(detector.getReps()).toBe(0)
  })

  it('reports current state', () => {
    const detector = createJumpingJackDetector()

    const downPose = createPose({
      leftWristY: 0.5,
      rightWristY: 0.5,
      leftAnkleX: 0.48,
      rightAnkleX: 0.52,
    })
    detector.processFrame(downPose)
    expect(detector.getState()).toBe('down')

    const upPose = createPose({
      leftWristY: 0.1,
      rightWristY: 0.1,
      leftAnkleX: 0.2,
      rightAnkleX: 0.8,
    })
    detector.processFrame(upPose)
    expect(detector.getState()).toBe('up')
  })
})
