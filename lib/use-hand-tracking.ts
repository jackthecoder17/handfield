"use client"

import * as React from "react"
import type { HandLandmarker } from "@mediapipe/tasks-vision"

import { classify, toForce } from "@/lib/gestures"
import { interaction, type TrackedHand } from "@/lib/interaction"

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

export type TrackingStatus = "off" | "starting" | "on" | "error"

async function createLandmarker(): Promise<HandLandmarker> {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision")
  const vision = await FilesetResolver.forVisionTasks(WASM)
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO" as const,
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
  })
  try {
    return await HandLandmarker.createFromOptions(vision, options("GPU"))
  } catch (err) {
    console.warn("GPU hand tracking unavailable, using CPU", err)
    return HandLandmarker.createFromOptions(vision, options("CPU"))
  }
}

/**
 * Tracks up to two hands from the webcam (or a video file) and writes forces into `interaction`.
 * Landmarks are smoothed between frames to take the jitter out of the particle motion.
 */
export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = React.useState<TrackingStatus>("off")
  const [error, setError] = React.useState<string | null>(null)
  const stopRef = React.useRef<() => void>(() => {})

  const start = React.useCallback(
    async (source?: string) => {
      const video = videoRef.current
      if (!video) return
      setStatus("starting")
      setError(null)
      let stream: MediaStream | null = null
      try {
        if (source) {
          video.srcObject = null
          // The tracker reads pixels through WebGL, which needs a CORS-enabled video.
          video.crossOrigin = "anonymous"
          video.src = source
          video.loop = true
          video.muted = true
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          })
          video.srcObject = stream
        }
        const [landmarker] = await Promise.all([createLandmarker(), video.play()])

        let raf = 0
        let lastTime = -1
        const smooth: Record<string, { x: number; y: number }[]> = {}

        const loop = () => {
          raf = requestAnimationFrame(loop)
          if (video.readyState < 2 || video.currentTime === lastTime) return
          lastTime = video.currentTime
          const result = landmarker.detectForVideo(video, performance.now())

          const hands: TrackedHand[] = result.landmarks.map((lm, i) => {
            const side = (result.handedness[i]?.[0]?.categoryName ?? "Right") as "Left" | "Right"
            // Mirror horizontally so it behaves like a mirror, then ease toward the new position.
            const raw = lm.map((p) => ({ x: 1 - p.x, y: p.y }))
            const prev = smooth[side]
            const pts = prev ? raw.map((p, j) => ({ x: prev[j].x + (p.x - prev[j].x) * 0.55, y: prev[j].y + (p.y - prev[j].y) * 0.55 })) : raw
            smooth[side] = pts
            return { points: pts, gesture: classify(pts), side }
          })
          for (const key of Object.keys(smooth)) if (!hands.some((h) => h.side === key)) delete smooth[key]

          interaction.hands = hands
          interaction.forces = hands.map((h) => toForce(h.points, h.gesture, interaction.cover)).filter((f) => f !== null)
        }
        loop()
        setStatus("on")

        stopRef.current = () => {
          cancelAnimationFrame(raf)
          landmarker.close()
          stream?.getTracks().forEach((t) => t.stop())
          video.pause()
          video.srcObject = null
          video.removeAttribute("src")
          interaction.hands = []
          interaction.forces = []
          setStatus("off")
        }
      } catch (err) {
        stream?.getTracks().forEach((t) => t.stop())
        const e = err as Error
        const message =
          e.name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser's site settings, then try again."
            : e.name === "NotFoundError"
              ? "No camera was found. You can still play with the mouse."
              : e.message || "Hand tracking couldn't start."
        setError(message)
        setStatus("error")
      }
    },
    [videoRef]
  )

  const stop = React.useCallback(() => stopRef.current(), [])
  React.useEffect(() => () => stopRef.current(), [])

  return { status, error, start, stop }
}
