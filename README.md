# Handfield

Move tens of thousands of glowing particles with your hands, using just your webcam.

Pinch and they gather into a swirling ball at your fingertips. Open your palm and they blast away. Point and they orbit your finger. Make a fist and they drift back into shape. Works with two hands at once, and with a mouse if you don't have a camera.

Built while playing with **[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)** hand tracking and **[Three.js](https://threejs.org)** via **[React Three Fiber](https://r3f.docs.pmnd.rs)**.

---

## Controls

| With your hands | With a mouse | What happens |
| --- | --- | --- |
| Pinch (thumb + index) | Hold left click | Particles gather and swirl around that point |
| Open palm | Shift + click, or right click | Particles are pushed away from your palm |
| Point | Just move | Particles orbit your fingertip |
| Fist | Let go | Particles drift back to the shape |

Pick a shape (sphere, galaxy, knot, helix), a colour palette, and how many particles (15k, 35k or 70k).

## How it works

1. **Hand tracking.** MediaPipe's Hand Landmarker runs in the browser (WebAssembly + WebGL), finds up to two hands in each webcam frame and returns 21 points per hand. The points are mirrored so it feels like a mirror and smoothed between frames to remove jitter.
2. **Gestures.** Each pose is classified with simple geometry, divided by the size of the hand so it works near or far from the camera:
   - **pinch:** thumb tip close to index tip
   - **open palm:** all four fingertips further from the wrist than their middle joints
   - **fist:** no fingers extended
   - **point:** anything in between
3. **Forces.** Each gesture becomes a force on the screen plane: attract with a swirl, repel within a limited reach, or orbit.
4. **Particles.** Every frame, each particle is pulled toward its spot in the current shape by a spring, pushed by the forces, damped and moved. All of it runs on typed arrays. The positions go to the GPU as a buffer, and a small shader draws each particle as a soft glowing dot that brightens with speed. Additive blending plus a bloom pass gives the glow.

## Tech

| | |
| --- | --- |
| Hand tracking | [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) Hand Landmarker (Apache-2.0) |
| 3D | [Three.js](https://threejs.org), [React Three Fiber](https://r3f.docs.pmnd.rs), [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing) (bloom) |
| Rendering | Custom GLSL point shader, additive blending |
| App | Next.js, TypeScript, Tailwind CSS, shadcn/ui |

## Project structure

```
components/
  handfield-app.tsx     canvas, webcam preview + skeleton, controls, mouse input
  particle-field.tsx    particle simulation and shader
lib/
  use-hand-tracking.ts  webcam + MediaPipe, smoothing, writes forces
  gestures.ts           pinch / palm / point / fist classification
  shapes.ts             rest shapes and colour palettes
  interaction.ts        shared state between tracking and the simulation
```

## Run it locally

```bash
git clone https://github.com/jackthecoder17/handfield.git
cd handfield
npm install
npm run dev
```

Open http://localhost:3000 and click **Use my hands**. The camera only works on `localhost` or HTTPS.

**Testing without a camera:** add `?video=<url>` to the address to drive the scene from a video file instead (it must be same-origin or CORS-enabled).

## Privacy

The webcam video is processed in your browser and never leaves your device.

## License

MIT
