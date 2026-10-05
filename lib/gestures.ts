import type { Force, Gesture } from "@/lib/interaction"

type P = { x: number; y: number; z?: number }

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y)

// MediaPipe hand landmark indices
const WRIST = 0
const THUMB_TIP = 4
const INDEX_TIP = 8
const FINGERS = [
  { tip: 8, pip: 6 },
  { tip: 12, pip: 10 },
  { tip: 16, pip: 14 },
  { tip: 20, pip: 18 },
]
const PALM = [0, 5, 9, 13, 17]

/**
 * Classifies a hand pose. Distances are divided by the hand's own size (wrist to middle knuckle),
 * so it works whether the hand is close to the camera or far away.
 */
export function classify(points: P[]): Gesture {
  const size = dist(points[WRIST], points[9]) || 1e-3
  const pinch = dist(points[THUMB_TIP], points[INDEX_TIP]) / size
  // A finger counts as extended when its tip is further from the wrist than its middle joint.
  const extended = FINGERS.filter((f) => dist(points[f.tip], points[WRIST]) > dist(points[f.pip], points[WRIST]) * 1.1).length

  if (pinch < 0.35) return "pinch"
  if (extended >= 4) return "palm"
  if (extended === 0) return "fist"
  return "point"
}

/** Where a gesture acts, in the same 0..1 image space as the landmarks. */
export function anchor(points: P[], gesture: Gesture): P {
  if (gesture === "pinch") {
    return { x: (points[THUMB_TIP].x + points[INDEX_TIP].x) / 2, y: (points[THUMB_TIP].y + points[INDEX_TIP].y) / 2 }
  }
  if (gesture === "point") return points[INDEX_TIP]
  const c = PALM.reduce((acc, i) => ({ x: acc.x + points[i].x / PALM.length, y: acc.y + points[i].y / PALM.length }), { x: 0, y: 0 })
  return c
}

export function toForce(points: P[], gesture: Gesture): Force | null {
  if (gesture === "fist") return null // a fist lets go: particles drift home
  const a = anchor(points, gesture)
  return {
    x: a.x - 0.5,
    y: 0.5 - a.y,
    mode: gesture === "pinch" ? "attract" : gesture === "palm" ? "repel" : "swirl",
  }
}

export const GESTURE_LABELS: Record<Gesture, string> = {
  pinch: "Pinch · gather",
  palm: "Open palm · blast",
  point: "Point · swirl",
  fist: "Fist · let go",
}
