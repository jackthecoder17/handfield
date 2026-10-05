// Shared, mutable interaction state. Written by the hand tracker and the mouse, read every
// frame by the particle simulation, so it lives outside React to avoid re-rendering.

export type ForceMode = "attract" | "repel" | "swirl"

export type Force = {
  /** Position on the z = 0 plane, in normalized screen units (-0.5..0.5, y up). */
  x: number
  y: number
  mode: ForceMode
}

export type Gesture = "pinch" | "palm" | "point" | "fist"

export type TrackedHand = {
  /** 21 landmarks, normalized to the (mirrored) camera image, 0..1. */
  points: { x: number; y: number }[]
  gesture: Gesture
  side: "Left" | "Right"
}

export const interaction = {
  forces: [] as Force[],
  hands: [] as TrackedHand[],
  mouse: null as Force | null,
  /**
   * When the camera fills the screen (object-fit: cover), maps camera-image coordinates to
   * screen coordinates so forces land exactly under the hand you see: screen = a * camera + b.
   */
  cover: null as { ax: number; bx: number; ay: number; by: number } | null,
  mouseMovedAt: 0,
}
