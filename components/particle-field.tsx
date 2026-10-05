"use client"

import * as React from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

import { interaction } from "@/lib/interaction"
import { makeShape, PALETTES, rng, SPIN_AXIS, type PaletteName, type ShapeName } from "@/lib/shapes"

const vertexShader = /* glsl */ `
  attribute float aRand;
  attribute float aSpeed;
  uniform float uSize;
  uniform float uPixelRatio;
  varying float vRand;
  varying float vSpeed;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = uSize * (0.55 + aRand * 0.9) * (1.0 + min(aSpeed, 6.0) * 0.18);
    gl_PointSize = s * uPixelRatio * (6.0 / -mv.z);
    vRand = aRand;
    vSpeed = aSpeed;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uDensity;
  varying float vRand;
  varying float vSpeed;
  void main() {
    // Soft round sprite: bright core, fading halo.
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d);
    alpha *= alpha;
    vec3 color = mix(uColorA, uColorB, vRand);
    color = mix(color, vec3(1.0), clamp(vSpeed * 0.06, 0.0, 0.35));
    // Additive blending: dim each particle when there are many, so dense clusters glow instead of clipping to white.
    gl_FragColor = vec4(color, alpha * uDensity * (0.5 + clamp(vSpeed * 0.06, 0.0, 0.3)));
  }
`

type Props = { count: number; shape: ShapeName; palette: PaletteName; size: number }

type Sim = { pos: Float32Array; vel: Float32Array; speed: Float32Array; rand: Float32Array; geometry: THREE.BufferGeometry }

export function ParticleField({ count, shape, palette, size }: Props) {
  const { viewport, gl } = useThree()
  const pointsRef = React.useRef<THREE.Points>(null)
  const simRef = React.useRef<Sim | null>(null)
  const homeRef = React.useRef<Float32Array | null>(null)
  const axisRef = React.useRef<"y" | "z">("y")
  const materialRef = React.useRef<THREE.ShaderMaterial | null>(null)

  // One material for the lifetime of the scene; colours and size are updated in place.
  React.useEffect(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSize: { value: 3 },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
        uColorA: { value: new THREE.Color() },
        uColorB: { value: new THREE.Color() },
        uDensity: { value: 1 },
      },
    })
    materialRef.current = material
    if (pointsRef.current) pointsRef.current.material = material
    return () => material.dispose()
  }, [gl])

  React.useEffect(() => {
    const m = materialRef.current
    if (!m) return
    m.uniforms.uColorA.value.set(PALETTES[palette].a)
    m.uniforms.uColorB.value.set(PALETTES[palette].b)
    m.uniforms.uSize.value = size
  }, [palette, size])

  // Particle buffers are rebuilt only when the count changes; a new shape just gives them a new home.
  React.useEffect(() => {
    const random = rng(count)
    const pos = new Float32Array(count * 3)
    // Start scattered so the first frame is a satisfying "assemble" moment.
    for (let i = 0; i < count * 3; i++) pos[i] = (random() - 0.5) * 9
    const rand = new Float32Array(count)
    for (let i = 0; i < count; i++) rand[i] = random()
    const speed = new Float32Array(count)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 1))
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50)
    simRef.current = { pos, vel: new Float32Array(count * 3), speed, rand, geometry }
    if (materialRef.current) materialRef.current.uniforms.uDensity.value = Math.min(1, Math.sqrt(15000 / count)) * 0.75
    if (pointsRef.current) pointsRef.current.geometry = geometry
    return () => geometry.dispose()
  }, [count])

  React.useEffect(() => {
    homeRef.current = makeShape(shape, count)
    axisRef.current = SPIN_AXIS[shape]
  }, [shape, count])

  useFrame((state, delta) => {
    const sim = simRef.current
    const home = homeRef.current
    if (!sim || !home || home.length !== sim.pos.length) return
    const dt = Math.min(delta, 1 / 30)
    const t = state.clock.elapsedTime
    const { pos, vel, speed, rand } = sim
    const n = speed.length

    // Hands win over the mouse; the mouse only counts if it moved in the last couple of seconds.
    const forces = interaction.forces.length
      ? interaction.forces
      : interaction.mouse && performance.now() - interaction.mouseMovedAt < 2500
        ? [interaction.mouse]
        : []
    const fx = forces.map((f) => f.x * viewport.width)
    const fy = forces.map((f) => f.y * viewport.height)
    const active = forces.length > 0

    // The rest shape slowly turns; springs are weaker while you're interacting so gestures feel strong.
    const rot = t * 0.15
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const spring = active ? 0.9 : 2.2
    // Shapes are designed for a ~5.4-unit-wide view; shrink them on narrow (portrait) screens.
    const fit = Math.min(1, viewport.width / 5.4)
    const spinZ = axisRef.current === "z"
    const damping = Math.pow(0.08, dt) // fraction of velocity kept after dt seconds

    for (let i = 0; i < n; i++) {
      const ix = i * 3
      const px = pos[ix]
      const py = pos[ix + 1]
      const pz = pos[ix + 2]
      const ox = home[ix]
      const oy = home[ix + 1]
      const oz = home[ix + 2]
      const hx = (spinZ ? ox * cos - oy * sin : ox * cos - oz * sin) * fit
      const hy = (spinZ ? ox * sin + oy * cos : oy) * fit
      const hz = (spinZ ? oz : ox * sin + oz * cos) * fit

      let ax = (hx - px) * spring
      let ay = (hy - py) * spring
      let az = (hz - pz) * spring

      for (let k = 0; k < forces.length; k++) {
        const dx = fx[k] - px
        const dy = fy[k] - py
        const dz = -pz
        const d2 = dx * dx + dy * dy + dz * dz + 0.05
        const d = Math.sqrt(d2)
        const mode = forces[k].mode
        if (mode === "attract") {
          // Pull in hard, plus a sideways component so the cluster swirls instead of collapsing.
          const pull = 28 / (d + 0.35)
          ax += (dx / d) * pull - (dy / d) * pull * 0.55
          ay += (dy / d) * pull + (dx / d) * pull * 0.55
          az += (dz / d) * pull
        } else if (mode === "repel") {
          // Strong up close, zero beyond ~2.4 units: a held palm carves a hole instead of emptying the screen.
          const reach = Math.max(0, 1 - d / 2.4)
          const push = (70 * reach * reach) / (d2 + 0.2)
          ax -= (dx / d) * push
          ay -= (dy / d) * push
          az -= (dz / d) * push * 0.6 - (rand[i] - 0.5) * push * 0.4
        } else {
          // Swirl: orbit the fingertip, strongest nearby.
          const s = 14 / (d2 + 0.6)
          ax += -dy * s + dx * s * 0.25
          ay += dx * s + dy * s * 0.25
        }
      }

      // A little drift keeps the shape alive when nothing is happening.
      ax += Math.sin(py * 1.7 + t * 0.6) * 0.18
      ay += Math.cos(pz * 1.9 + t * 0.5) * 0.18
      az += Math.sin(px * 1.3 + t * 0.7) * 0.18

      let vx = (vel[ix] + ax * dt) * damping
      let vy = (vel[ix + 1] + ay * dt) * damping
      let vz = (vel[ix + 2] + az * dt) * damping
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz)
      if (sp > 14) {
        const k = 14 / sp
        vx *= k
        vy *= k
        vz *= k
      }
      vel[ix] = vx
      vel[ix + 1] = vy
      vel[ix + 2] = vz
      pos[ix] = px + vx * dt
      pos[ix + 1] = py + vy * dt
      pos[ix + 2] = pz + vz * dt
      speed[i] = sp
    }

    sim.geometry.attributes.position.needsUpdate = true
    sim.geometry.attributes.aSpeed.needsUpdate = true
  })

  return <points ref={pointsRef} frustumCulled={false} />
}
