// Rest positions for the particles. Each returns a Float32Array of xyz triples.

export type ShapeName = "sphere" | "galaxy" | "knot" | "helix"

/** The galaxy spins in its own plane; everything else turns around the vertical axis. */
export const SPIN_AXIS: Record<ShapeName, "y" | "z"> = { sphere: "y", galaxy: "z", knot: "y", helix: "y" }

export const SHAPES: { value: ShapeName; label: string }[] = [
  { value: "sphere", label: "Sphere" },
  { value: "galaxy", label: "Galaxy" },
  { value: "knot", label: "Knot" },
  { value: "helix", label: "Helix" },
]

// A small seeded random so shapes look the same on every load.
export function rng(seed = 7) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())

export function makeShape(name: ShapeName, count: number): Float32Array {
  const out = new Float32Array(count * 3)
  const r = rng(name.length * 97 + 13)

  for (let i = 0; i < count; i++) {
    let x = 0
    let y = 0
    let z = 0
    const t = i / count

    if (name === "sphere") {
      // Fibonacci sphere with a little thickness, so it reads as a glowing shell.
      const phi = Math.acos(1 - 2 * (i + 0.5) / count)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const rad = 1.55 + gauss(r) * 0.04
      x = rad * Math.sin(phi) * Math.cos(theta)
      y = rad * Math.cos(phi)
      z = rad * Math.sin(phi) * Math.sin(theta)
    } else if (name === "galaxy") {
      // Spiral disc in the x–y plane, tipped back a little; it spins in its own plane (see SPIN_AXIS).
      if (r() < 0.18) {
        // bright central bulge
        x = gauss(r) * 0.28
        y = gauss(r) * 0.28
        z = gauss(r) * 0.18
      } else {
        const arms = 3
        const arm = i % arms
        const d = 0.25 + Math.pow(r(), 0.85) * 2.1
        const angle = (arm / arms) * Math.PI * 2 + d * 2.6
        const spread = 0.05 + d * 0.06
        x = Math.cos(angle) * d + gauss(r) * spread
        y = Math.sin(angle) * d + gauss(r) * spread
        z = gauss(r) * 0.05 * (2.5 - d)
      }
      const tilt = 0.55
      const ny = y * Math.cos(tilt) - z * Math.sin(tilt)
      z = y * Math.sin(tilt) + z * Math.cos(tilt)
      y = ny
    } else if (name === "knot") {
      // (2,3) torus knot with a fuzzy tube
      const a = t * Math.PI * 2
      const p = 2
      const q = 3
      const rr = Math.cos(q * a) + 2
      const cx = rr * Math.cos(p * a) * 0.55
      const cy = rr * Math.sin(p * a) * 0.55
      const cz = -Math.sin(q * a) * 0.55
      x = cx + gauss(r) * 0.07
      y = cy + gauss(r) * 0.07
      z = cz + gauss(r) * 0.07
    } else {
      // Double helix with rungs
      const strands = 2
      const strand = i % strands
      const along = t * 2 - 1
      const a = along * Math.PI * 4 + strand * Math.PI
      const onRung = r() < 0.18
      const k = onRung ? r() * 2 - 1 : strand === 0 ? 1 : -1
      x = Math.cos(a) * 0.7 * k + gauss(r) * 0.03
      z = Math.sin(a) * 0.7 * k + gauss(r) * 0.03
      y = along * 2.1
    }

    out[i * 3] = x
    out[i * 3 + 1] = y
    out[i * 3 + 2] = z
  }
  return out
}

export type PaletteName = "aurora" | "ember" | "ice" | "toxic"

export const PALETTES: Record<PaletteName, { label: string; a: string; b: string }> = {
  aurora: { label: "Aurora", a: "#3cf2ff", b: "#9b5cff" },
  ember: { label: "Ember", a: "#ffb347", b: "#ff3d7f" },
  ice: { label: "Ice", a: "#ffffff", b: "#4d8bff" },
  toxic: { label: "Toxic", a: "#c6ff3d", b: "#18c3a5" },
}
