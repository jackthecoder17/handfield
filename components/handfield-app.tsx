"use client"

import * as React from "react"
import { Canvas } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { HandIcon, Loader2Icon, Maximize2Icon, Minimize2Icon, MousePointer2Icon, VideoOffIcon } from "lucide-react"
import { toast } from "sonner"

import { GESTURE_LABELS, toScreen } from "@/lib/gestures"
import { interaction, type Gesture } from "@/lib/interaction"
import { PALETTES, SHAPES, type PaletteName, type ShapeName } from "@/lib/shapes"
import { useHandTracking } from "@/lib/use-hand-tracking"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ParticleField } from "@/components/particle-field"

const GITHUB_URL = "https://github.com/jackthecoder17/handfield"

const DENSITIES = [
  { value: 15000, label: "15k" },
  { value: 35000, label: "35k" },
  { value: 70000, label: "70k" },
]

// MediaPipe's 21-point hand skeleton
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]

const pressed = "aria-pressed:bg-white aria-pressed:text-black"

export function HandfieldApp() {
  const [shape, setShape] = React.useState<ShapeName>("sphere")
  const [palette, setPalette] = React.useState<PaletteName>("aurora")
  const [count, setCount] = React.useState(35000)
  const [gestures, setGestures] = React.useState<{ side: string; gesture: Gesture }[]>([])
  // "full" puts your mirrored camera behind the particles so you can see yourself; "corner" is a preview.
  const [camView, setCamView] = React.useState<"corner" | "full">("full")
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const skeletonRef = React.useRef<HTMLCanvasElement>(null)
  const { status, error, start, stop } = useHandTracking(videoRef)

  React.useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  // Fewer particles on small or low-core devices.
  React.useEffect(() => {
    if (window.innerWidth < 700 || (navigator.hardwareConcurrency ?? 8) <= 4) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- screen size and cores are only known in the browser
      setCount(15000)
    }
  }, [])

  // ?video=<url> drives the scene from a video file instead of the webcam (handy for demos and testing).
  const startTracking = React.useCallback(() => {
    const source = new URLSearchParams(window.location.search).get("video") ?? undefined
    start(source)
  }, [start])

  // In full-screen view the camera is cropped to fill the window (object-fit: cover). Work out that
  // crop so forces and the skeleton line up with the hand you actually see on screen.
  React.useEffect(() => {
    const video = videoRef.current
    if (camView !== "full" || status !== "on" || !video) {
      interaction.cover = null
      return
    }
    const update = () => {
      const W = window.innerWidth
      const H = window.innerHeight
      const vw = video.videoWidth || 4
      const vh = video.videoHeight || 3
      const scale = Math.max(W / vw, H / vh)
      const dw = (vw * scale) / W
      const dh = (vh * scale) / H
      interaction.cover = {
        ax: dw,
        bx: (1 - dw) / 2,
        ay: dh,
        by: (1 - dh) / 2,
      }
    }
    update()
    window.addEventListener("resize", update)
    video.addEventListener("loadedmetadata", update)
    return () => {
      window.removeEventListener("resize", update)
      video.removeEventListener("loadedmetadata", update)
      interaction.cover = null
    }
  }, [camView, status])

  // Draw the hand skeleton over the webcam preview and keep the gesture labels in sync.
  React.useEffect(() => {
    if (status !== "on") return
    let raf = 0
    let lastLabels = ""
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const canvas = skeletonRef.current
      if (!canvas) return
      // Match the canvas to its on-screen size so lines stay crisp in both views.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cw = Math.round(canvas.clientWidth * dpr)
      const ch = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }
      const ctx = canvas.getContext("2d")!
      const { width: w, height: h } = canvas
      ctx.clearRect(0, 0, w, h)
      for (const hand of interaction.hands) {
        const pts = hand.points.map((p) => toScreen(p, interaction.cover))
        const color = hand.gesture === "pinch" ? "#ffe14d" : hand.gesture === "palm" ? "#ff5c8a" : "#3cf2ff"
        ctx.strokeStyle = color
        ctx.lineWidth = 2 * dpr
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        for (const [a, b] of BONES) {
          ctx.moveTo(pts[a].x * w, pts[a].y * h)
          ctx.lineTo(pts[b].x * w, pts[b].y * h)
        }
        ctx.stroke()
        ctx.fillStyle = "#fff"
        for (const p of pts) {
          ctx.beginPath()
          ctx.arc(p.x * w, p.y * h, 2.4 * dpr, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
      const labels = interaction.hands.map((hd) => `${hd.side}:${hd.gesture}`).join("|")
      if (labels !== lastLabels) {
        lastLabels = labels
        setGestures(
          interaction.hands.map((hd) => ({
            side: hd.side,
            gesture: hd.gesture,
          })),
        )
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [status])

  // Mouse and touch fallback: move to swirl, hold to gather, Shift or right button to blast.
  function onPointer(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-ui]")) return
    const rect = e.currentTarget.getBoundingClientRect()
    const blast = (e.buttons & 2) !== 0 || ((e.buttons & 1) !== 0 && e.shiftKey)
    const gather = !blast && (e.buttons & 1) !== 0
    interaction.mouse = {
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: 0.5 - (e.clientY - rect.top) / rect.height,
      mode: blast ? "repel" : gather ? "attract" : "swirl",
    }
    interaction.mouseMovedAt = performance.now()
  }

  return (
    <div
      className="relative h-svh w-full touch-none overflow-hidden bg-black text-white select-none [--preview-w:60vw] sm:[--preview-w:min(42vw,560px)]"
      onPointerMove={onPointer}
      onPointerDown={onPointer}
      onPointerUp={onPointer}
      onPointerLeave={() => (interaction.mouse = null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 2]}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
        }}
        className="absolute inset-0 z-10"
      >
        <ParticleField count={count} shape={shape} palette={palette} size={3.2} />
        <EffectComposer>
          <Bloom intensity={0.9} luminanceThreshold={0.25} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      </Canvas>

      {/* Brand */}
      <div className="pointer-events-none absolute top-0 left-0 z-20 flex flex-col gap-1 p-5">
        <span className="font-heading text-xl font-bold tracking-tight">Handfield</span>
        <span className="text-xs text-white/60">Move particles with your hands</span>
      </div>

      {/* Your camera: behind the particles in full-screen view, or a large preview in the corner */}
      {/* One video element stays mounted the whole time: tracking attaches the camera to it on start. */}
      <div
        className={
          status !== "on" && status !== "starting"
            ? "hidden"
            : camView === "full"
              ? "pointer-events-none absolute inset-0 z-0"
              : "pointer-events-none absolute top-4 right-4 z-20 aspect-[4/3] w-[var(--preview-w)] overflow-hidden rounded-xl border border-white/15 bg-black/60 shadow-2xl"
        }
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 size-full -scale-x-100 object-cover ${camView === "full" ? "opacity-60" : "opacity-90"}`}
        />
        <canvas ref={skeletonRef} className="absolute inset-0 size-full" />
        {status === "starting" && (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        )}
      </div>

      {/* Gesture labels and view switch */}
      {(status === "on" || status === "starting") && (
        <div data-ui className={`absolute right-4 z-30 flex flex-col items-end gap-1.5 ${camView === "corner" ? "top-[calc(var(--preview-w)*0.75+1.75rem)]" : "top-4"}`}>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/10 text-white backdrop-blur hover:bg-white/20"
            onClick={() => setCamView(camView === "full" ? "corner" : "full")}
          >
            {camView === "full" ? <Minimize2Icon data-icon="inline-start" /> : <Maximize2Icon data-icon="inline-start" />}
            {camView === "full" ? "Small camera" : "Full screen camera"}
          </Button>
          {status === "on" && gestures.length === 0 && <Badge variant="secondary">Show your hand to the camera</Badge>}
          {gestures.map((g) => (
            <Badge key={g.side} variant="secondary" className="bg-white/10 text-white backdrop-blur">
              {g.side} · {GESTURE_LABELS[g.gesture]}
            </Badge>
          ))}
        </div>
      )}

      {/* Control dock */}
      <div data-ui className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-4">
        <div className="flex max-w-full flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/55 p-2.5 backdrop-blur-md">
          {status === "on" ? (
            <Button variant="secondary" onClick={stop}>
              <VideoOffIcon data-icon="inline-start" />
              Stop camera
            </Button>
          ) : (
            <Button onClick={startTracking} disabled={status === "starting"}>
              {status === "starting" ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : <HandIcon data-icon="inline-start" />}
              {status === "starting" ? "Starting camera…" : "Use my hands"}
            </Button>
          )}

          <Separator orientation="vertical" className="hidden h-6 bg-white/15 sm:block" />

          <ToggleGroup variant="outline" size="sm" value={[shape]} onValueChange={(v) => v[0] && setShape(v[0] as ShapeName)} aria-label="Shape">
            {SHAPES.map((s) => (
              <ToggleGroupItem key={s.value} value={s.value} className={pressed}>
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex items-center gap-1.5" role="group" aria-label="Colours">
            {(Object.keys(PALETTES) as PaletteName[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-label={`${PALETTES[p].label} colours`}
                aria-pressed={palette === p}
                onClick={() => setPalette(p)}
                className="size-6 rounded-full border border-white/20 aria-pressed:ring-2 aria-pressed:ring-white aria-pressed:ring-offset-2 aria-pressed:ring-offset-black"
                style={{
                  background: `linear-gradient(135deg, ${PALETTES[p].a}, ${PALETTES[p].b})`,
                }}
              />
            ))}
          </div>

          <ToggleGroup variant="outline" size="sm" value={[String(count)]} onValueChange={(v) => v[0] && setCount(Number(v[0]))} aria-label="Particle count">
            {DENSITIES.map((d) => (
              <ToggleGroupItem key={d.value} value={String(d.value)} className={pressed}>
                {d.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* Help */}
      <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 text-xs text-white/50 sm:flex">
        {status === "on" ? (
          <>
            <HandIcon className="size-3.5" /> Pinch to gather · open palm to blast · point to swirl · fist to let go
          </>
        ) : (
          <>
            <MousePointer2Icon className="size-3.5" /> Move to swirl · hold click to gather · Shift + click to blast
          </>
        )}
      </div>

      <a
        data-ui
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className="absolute top-5 left-1/2 z-20 hidden -translate-x-1/2 text-xs text-white/50 underline-offset-4 hover:text-white hover:underline sm:block"
      >
        Built with MediaPipe + Three.js · open source
      </a>
    </div>
  )
}
