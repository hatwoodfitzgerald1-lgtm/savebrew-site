// THE LOOM (TEX-008, Art Direction 3.6, 3.7, 3.9): the signature scene. Three.js r128 from cdnjs, loaded after
// first paint behind the 1600px poster; Line2 fat lines for the five warp threads at world x positions solved
// from the real DOM column centres (recomputed on resize), the weft as a Line2, tori for knots, unlit
// MeshBasicMaterial flat colours, a 256 by 16 canvas thread alpha map with fibre noise, a transparent background
// over the butter ground. Alive on load: a 7s warp sag cycle with per thread phase, the weft creeping across the
// near edge on an 11s loop knotting each warp with a tiny overshoot, a 1 degree drift toward the pointer.
// Scroll choreography (native scroll, the GSAP ScrollTrigger scrub from home.ts, 1.3 viewport heights, not pinned):
//   0 to 0.45 the reed sweeps from depth toward the camera revealing the ten woven rows, newest last;
//   0.45 to 0.6 the held beat: today's five knots pull tight (Knot, 1.12 overshoot), the weft snaps taut, a 90ms butter flash;
//   0.6 to 0.9 the gravity flip: the camera pitches from 12 to 88 degrees while the cloth lays flat, and Today's pass docks;
//   0.9 to 1.0 the handoff: the five threads shorten into the thread strip at the head of the row (GSAP Flip onto the SVG twin), the canvas fades.
// Fallbacks: reduced motion keeps the poster with the cells docked; init failure or over 3s keeps the poster; low power
// (under 30fps after two seconds) drops to the poster while the DOM docking still runs; context loss swaps the poster
// and rebuilds on restore; one context per page, dpr capped at 1.5, render paused offscreen and on hidden tabs, disposed on pagehide.
import { KNOT, SHUTTLE, DUR, motionReduced } from '../../scripts/ease';
import type { DockGeometry } from './home';

declare const THREE: any;
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const LINES_URL = '/assets/js/three-lines-r128.js';

export interface LoomOptions {
  hero: HTMLElement;
  onProgress: (fn: (p: number) => void) => void;
  setThreadProjection: (fn: ((i: number, y: number, p: number) => number) | null) => void;
  dockGeometry: () => DockGeometry | null;
  reduced: boolean;
  qa: string;
}

const COLOUR = {
  undyed: 0xf9efc1,      // #FBF3CF at 70 percent over the butter ground
  indigo: 0x2b2f8f,
  deep: 0x1b1e5c,
  butter: 0xf6e7a1,
  butterDeep: 0xebd77a
};
const ROWS = 10;
const ROW_Z0 = -1.6, ROW_DZ = -0.55;   // the ten woven rows, the newest nearest the weft
const DEPTH = 7.4;                     // how far the warp runs into depth
const WARP_N = 40;                     // points per warp thread (the sag is a vertex sine)
const WEFT_N = 48;
const TILT = 8 * Math.PI / 180;        // the cloth climbs 8 degrees toward the back beam until it lays flat
const PITCH_A = 12 * Math.PI / 180, PITCH_B = 88 * Math.PI / 180;
const CAM_D = 7.7, TARGET_Z = -4.13;   // the camera orbits the cloth at a fixed distance from a fixed target

function loadScript(src: string, timeout = 9000): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing && existing.dataset.loaded) return resolve();
    const s = existing || document.createElement('script');
    const timer = setTimeout(() => reject(new Error('timeout ' + src)), timeout);
    s.addEventListener('load', () => { s.dataset.loaded = '1'; clearTimeout(timer); resolve(); });
    s.addEventListener('error', () => { clearTimeout(timer); reject(new Error('failed ' + src)); });
    if (!existing) { s.src = src; s.async = true; document.head.appendChild(s); }
  });
}

/** The thread alpha map: 256 by 16, fibre noise along the thread, a soft edge across it. */
function threadMap(): any {
  const c = document.createElement('canvas'); c.width = 256; c.height = 16;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(256, 16);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const noise = new Float32Array(256);
  for (let x = 0; x < 256; x++) noise[x] = rnd();
  for (let y = 0; y < 16; y++) {
    const across = 1 - Math.pow(Math.abs((y + 0.5) / 16 - 0.5) * 2, 3) * 0.55;
    for (let x = 0; x < 256; x++) {
      const n = (noise[x] * 0.5 + noise[(x + 1) % 256] * 0.3 + noise[(x + 255) % 256] * 0.2);
      const fibre = 0.78 + 0.22 * n;
      const v = Math.round(255 * Math.min(1, across * fibre));
      const i = (y * 256 + x) * 4;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  return tex;
}

/** A LineMaterial that reads the thread alpha map along the line (vLineDistance) and across it (vUv.x). */
function threadMaterial(opts: { color: number; linewidth: number; opacity?: number; vertexColors?: boolean; map: any; resolution: any }): any {
  const m = new THREE.LineMaterial({ color: opts.color, linewidth: opts.linewidth, transparent: true, opacity: opts.opacity ?? 1, vertexColors: !!opts.vertexColors, depthTest: false, depthWrite: false });
  m.resolution = opts.resolution;   // copied into the uniform: resize() sets it again on every line material
  lineMaterials.push(m);
  const v = m.vertexShader as string, f = m.fragmentShader as string;
  const v2 = v
    .replace(/#ifdef USE_DASH\s*uniform float dashScale;\s*attribute float instanceDistanceStart;\s*attribute float instanceDistanceEnd;\s*varying float vLineDistance;\s*#endif/, 'uniform float dashScale; attribute float instanceDistanceStart; attribute float instanceDistanceEnd; varying float vLineDistance;')
    .replace(/#ifdef USE_DASH\s*vLineDistance = [^;]+;\s*#endif/, 'vLineDistance = ( position.y < 0.5 ) ? instanceDistanceStart : instanceDistanceEnd;');
  const f2 = f
    .replace('varying float vLineDistance;', 'varying float vLineDistance; uniform sampler2D threadMap;')
    .replace('float alpha = opacity;', 'float alpha = opacity * texture2D( threadMap, vec2( fract( vLineDistance * 0.45 ), vUv.x * 0.5 + 0.5 ) ).r;');
  if (v2 !== v && f2 !== f) {
    m.vertexShader = v2; m.fragmentShader = f2;
    m.uniforms.threadMap = { value: opts.map };
    m.needsUpdate = true;
  }
  return m;
}

/** Writes new positions into a Line2's existing interleaved buffer (no reallocation per frame). */
function writePositions(line: any, pts: Float32Array) {
  const geo = line.geometry;
  const attr = geo.attributes.instanceStart;
  if (!attr) { geo.setPositions(pts); line.computeLineDistances(); return; }
  const arr = attr.data.array as Float32Array;
  const n = pts.length / 3;
  for (let i = 0; i < n - 1; i++) {
    const o = i * 6;
    arr[o] = pts[i * 3]; arr[o + 1] = pts[i * 3 + 1]; arr[o + 2] = pts[i * 3 + 2];
    arr[o + 3] = pts[i * 3 + 3]; arr[o + 4] = pts[i * 3 + 4]; arr[o + 5] = pts[i * 3 + 5];
  }
  attr.data.needsUpdate = true;
}
function writeColors(line: any, cols: Float32Array) {
  const geo = line.geometry;
  const attr = geo.attributes.instanceColorStart;
  if (!attr) { geo.setColors(cols); return; }
  const arr = attr.data.array as Float32Array;
  const n = cols.length / 3;
  for (let i = 0; i < n - 1; i++) {
    const o = i * 6;
    arr[o] = cols[i * 3]; arr[o + 1] = cols[i * 3 + 1]; arr[o + 2] = cols[i * 3 + 2];
    arr[o + 3] = cols[i * 3 + 3]; arr[o + 4] = cols[i * 3 + 4]; arr[o + 5] = cols[i * 3 + 5];
  }
  attr.data.needsUpdate = true;
}
const lineMaterials: any[] = [];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

class Loom {
  o: LoomOptions;
  root: HTMLElement;
  poster: HTMLImageElement | null;
  proxies: HTMLElement;
  canvas!: HTMLCanvasElement;
  renderer: any; scene: any; camera: any; cloth: any;
  warps: any[] = []; warpPts: Float32Array[] = []; warpCols: Float32Array[] = [];
  weft: any; weftPts = new Float32Array(WEFT_N * 3);
  knots: any[] = []; knotMat: any; flashMat: any;
  rows: { knots: any[]; line: any; mat: any; z: number; dye: number }[] = [];
  reed: any;
  map: any; resolution: any;
  x = [0, 0, 0, 0, 0];           // world x per thread (solved from the DOM)
  phase = [0, 1.3, 2.1, 3.6, 4.9];
  p = 0;                          // the scroll progress (smoothed by the scrub)
  t0 = performance.now();
  running = false; raf = 0; disposed = false; live = false; lost = false; dropped = false;
  pointerX = 0; drift = 0;
  flashAt = -1; flashArmed = true; weftStarted = false; firstPassDone = false; firstPassAt = 0; loopAt = 0;
  fpsFrames = 0; fpsStart = 0; fpsChecked = false;
  handoff: { tl: any; from: number } | null = null;
  twin: SVGSVGElement | null = null;
  proxyEls: HTMLElement[] = [];
  vw = 0; vh = 0; dpr = 1;
  private onVis = () => { if (document.hidden) this.stop(); else this.start(); };
  private onHide = () => this.dispose();
  private onResize = () => this.resize();
  private onPointer = (e: PointerEvent) => { this.pointerX = (e.clientX / (this.vw || 1)) * 2 - 1; };

  constructor(o: LoomOptions) {
    this.o = o;
    this.root = o.hero.querySelector<HTMLElement>('[data-loom]')!;
    this.poster = this.root.querySelector<HTMLImageElement>('[data-loom-poster]');
    this.proxies = this.root.querySelector<HTMLElement>('[data-loom-proxies]')!;
  }

  async init() {
    const started = performance.now();
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.root.appendChild(this.canvas);
    this.dpr = Math.min(1.5, window.devicePixelRatio || 1);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: 'high-performance', premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(this.dpr);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 10, 0.1, 60);
    this.cloth = new THREE.Group();
    this.scene.add(this.cloth);
    this.map = threadMap();
    this.resolution = new THREE.Vector2(1, 1);
    this.build();
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.setLive(false); }, false);
    this.canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.resize(); this.setLive(true); }, false);
    this.resize();
    this.render(performance.now());
    if (performance.now() - started > 3000) throw new Error('init over 3s');
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVis);
    window.addEventListener('pagehide', this.onHide, { once: true });
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    this.buildTwin();
    this.o.setThreadProjection((i, y, p) => this.threadScreenX(i, y, p));
    this.o.onProgress((p) => { this.p = p; if (!this.running) this.start(); });
    this.firstPassAt = (performance.now() - this.t0) / 1000 + 0.3;   // the weft sets off 0.3s after the cross dissolve begins
    this.setLive(true);
    this.start();
  }

  build() {
    const undyed = new THREE.Color(COLOUR.undyed);
    // the five warp threads, per vertex colours so the dye takes as the reed passes
    for (let i = 0; i < 5; i++) {
      const pts = new Float32Array(WARP_N * 3);
      const cols = new Float32Array(WARP_N * 3);
      for (let j = 0; j < WARP_N; j++) { cols[j * 3] = undyed.r; cols[j * 3 + 1] = undyed.g; cols[j * 3 + 2] = undyed.b; }
      const geo = new THREE.LineGeometry();
      const mat = threadMaterial({ color: 0xffffff, linewidth: 2.5, vertexColors: true, map: this.map, resolution: this.resolution });
      const line = new THREE.Line2(geo, mat);
      line.frustumCulled = false;
      this.warps.push(line); this.warpPts.push(pts); this.warpCols.push(cols);
      this.cloth.add(line);
    }
    // the weft along the near edge
    const wgeo = new THREE.LineGeometry();
    const wmat = threadMaterial({ color: COLOUR.indigo, linewidth: 2.5, map: this.map, resolution: this.resolution });
    this.weft = new THREE.Line2(wgeo, wmat);
    this.weft.frustumCulled = false;
    this.cloth.add(this.weft);
    // today's five knots at the near edge
    const torus = new THREE.TorusGeometry(0.045, 0.017, 8, 28);
    this.knotMat = new THREE.MeshBasicMaterial({ color: COLOUR.deep });
    this.flashMat = new THREE.MeshBasicMaterial({ color: COLOUR.butter });
    for (let i = 0; i < 5; i++) {
      const k = new THREE.Mesh(torus, this.knotMat);
      k.rotation.x = Math.PI / 2;
      k.scale.setScalar(0.7);
      this.knots.push(k);
      this.cloth.add(k);
    }
    // the ten woven rows behind: five knots joined by a faint weft line, receding
    const smallTorus = new THREE.TorusGeometry(0.04, 0.015, 8, 24);
    for (let r = 0; r < ROWS; r++) {
      const z = ROW_Z0 + r * ROW_DZ;
      const mat = new THREE.MeshBasicMaterial({ color: COLOUR.deep, transparent: true, opacity: 0.22 });
      const knots: any[] = [];
      for (let i = 0; i < 5; i++) {
        const k = new THREE.Mesh(smallTorus, mat);
        k.rotation.x = Math.PI / 2;
        k.position.set(0, 0, z);
        knots.push(k);
        this.cloth.add(k);
      }
      const lmat = threadMaterial({ color: COLOUR.undyed, linewidth: 1.25, opacity: 0.9, map: this.map, resolution: this.resolution });
      const line = new THREE.Line2(new THREE.LineGeometry(), lmat);
      line.frustumCulled = false;
      this.cloth.add(line);
      this.rows.push({ knots, line, mat, z, dye: 0 });
    }
    // the reed: a thin butter plane that sweeps through the rows
    this.reed = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.34), new THREE.MeshBasicMaterial({ color: COLOUR.butterDeep, transparent: true, opacity: 0.9, depthTest: false }));
    this.reed.position.set(0, 0.16, ROW_Z0 + (ROWS - 1) * ROW_DZ - 0.6);
    this.reed.visible = false;
    this.cloth.add(this.reed);
    this.cloth.rotation.x = TILT;
  }

  buildTwin() {
    // the SVG twin over the thread strip at the head of Today's pass, drawn from the same five positions
    const strip = document.querySelector<HTMLElement>('[data-dock-board] .board__strip');
    if (!strip) return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'loom-twin'); svg.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 5; i++) {
      const l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', `${10 + 20 * i}%`); l.setAttribute('x2', `${10 + 20 * i}%`); l.setAttribute('y1', '2'); l.setAttribute('y2', '34');
      svg.appendChild(l);
    }
    strip.appendChild(svg);
    this.twin = svg;
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div');
      d.className = 'hm-loom__proxy';
      this.proxies.appendChild(d);
      this.proxyEls.push(d);
    }
  }

  setLive(on: boolean) {
    this.live = on && !this.lost && !this.dropped;
    this.root.classList.toggle('is-live', this.live);
  }

  resize() {
    if (this.disposed) return;
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.renderer.setSize(this.vw, this.vh, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.resolution.set(this.vw * this.dpr, this.vh * this.dpr);
    for (const m of lineMaterials) m.resolution = this.resolution;
    this.camera.aspect = this.vw / this.vh;
    this.camera.updateProjectionMatrix();
    this.placeCamera(this.pitch(this.p));
    this.solveX();
  }

  pitch(p: number) {
    const f = KNOT(clamp01((p - 0.6) / 0.3));
    return lerp(PITCH_A, PITCH_B, f);
  }
  placeCamera(pitch: number) {
    this.camera.position.set(0, CAM_D * Math.sin(pitch), TARGET_Z + CAM_D * Math.cos(pitch));
    this.camera.lookAt(0, 0, TARGET_Z);
    this.camera.updateMatrixWorld();
  }

  /** Screen x (px) of the cloth local point (x, 0, z) through the current camera. */
  projectX(x: number, z: number, out?: { y: number }): number {
    const v = new THREE.Vector3(x, 0, z).applyMatrix4(this.cloth.matrixWorld).project(this.camera);
    if (out) out.y = (1 - v.y) / 2 * this.vh;
    return (v.x + 1) / 2 * this.vw;
  }
  /** Solves the cloth local x whose near edge projection lands on screen x, at depth z. */
  worldXFor(screenX: number, z = 0): number {
    const x0 = this.projectX(0, z), x1 = this.projectX(1, z);
    if (Math.abs(x1 - x0) < 1e-6) return 0;
    return (screenX - x0) / (x1 - x0);
  }
  /** The thread world x from the DOM: the column centres at the near edge before the flip, the cells' left edges as the cloth lays flat. */
  solveX() {
    const g = this.o.dockGeometry();
    if (!g) return;
    const f = KNOT(clamp01((this.p - 0.6) / 0.3));
    this.cloth.updateMatrixWorld(true);
    const zc = f > 0 ? this.zAtScreenY(g.headY[0]) : 0;
    for (let i = 0; i < 5; i++) {
      const target = lerp(g.centre[i], g.left[i], f);
      this.x[i] = this.worldXFor(target, lerp(0, zc, f));
    }
  }
  /** The cloth depth z whose projection sits at screen y (along the warp's straight run). */
  zAtScreenY(y: number): number {
    const a = { y: 0 }, b = { y: 0 };
    this.projectX(0, 0, a); this.projectX(0, -DEPTH, b);
    if (Math.abs(b.y - a.y) < 1e-6) return 0;
    const t = clamp01((y - a.y) / (b.y - a.y));
    return -DEPTH * t;
  }
  /** The per frame projection for the docking: thread i's screen x at screen y. */
  threadScreenX(i: number, y: number, _p: number): number {
    if (!this.live && !this.dropped) { const g = this.o.dockGeometry(); return g ? lerp(g.centre[i], g.left[i], KNOT(clamp01((_p - 0.6) / 0.3))) : 0; }
    const a = { y: 0 }, b = { y: 0 };
    const xa = this.projectX(this.x[i], 0, a), xb = this.projectX(this.x[i], -DEPTH, b);
    if (Math.abs(b.y - a.y) < 1e-6) return xa;
    const t = clamp01((y - a.y) / (b.y - a.y));
    return lerp(xa, xb, t);
  }

  start() {
    if (this.running || this.disposed || this.dropped || this.lost || document.hidden) return;
    this.running = true;
    const loop = (now: number) => { if (!this.running) return; this.render(now); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  render(now: number) {
    if (this.disposed || this.lost) return;
    const p = this.p;
    const reduced = motionReduced();
    const t = (now - this.t0) / 1000;
    // offscreen: past the handoff the canvas is faded, so stop rendering until the visitor scrolls back
    const poster = this.o.qa === 'poster';   // the poster render keeps the canvas at progress 1.0 without the fade
    if (p >= 1 && !poster) { this.updateHandoff(1); this.root.classList.add('is-fading'); this.stop(); return; }
    if (!poster) this.root.classList.toggle('is-fading', p >= 0.999);
    // the camera pitches from 12 to 88 degrees over the flip while the cloth lays flat
    const flip = KNOT(clamp01((p - 0.6) / 0.3));
    this.cloth.rotation.x = TILT * (1 - flip);
    const driftTarget = reduced ? 0 : this.pointerX * (Math.PI / 180) * (1 - flip);
    this.drift += (driftTarget - this.drift) * 0.05;
    this.cloth.rotation.y = this.drift;
    this.cloth.updateMatrixWorld(true);
    this.placeCamera(this.pitch(p));
    this.solveX();
    // the reed sweep, 0 to 0.45: from depth toward the camera, each row it passes snaps from faint to dyed, newest last
    const sweep = SHUTTLE(clamp01(p / 0.45));
    const zFar = ROW_Z0 + (ROWS - 1) * ROW_DZ - 0.5, zNear = ROW_Z0 + 0.35;
    const reedZ = lerp(zFar, zNear, sweep);
    this.reed.visible = p > 0.002 && p < 0.47;
    this.reed.position.z = reedZ;
    this.reed.material.opacity = 0.9 * (1 - clamp01((p - 0.42) / 0.05));
    const undyed = new THREE.Color(COLOUR.undyed), indigo = new THREE.Color(COLOUR.indigo);
    const tmp = new THREE.Color();
    for (const row of this.rows) {
      const target = reedZ > row.z - 0.05 ? 1 : 0;   // dyed once the reed has passed it coming toward the camera
      row.dye += (target - row.dye) * (reduced ? 1 : 0.22);
      const d = KNOT(clamp01(row.dye));
      // as the cloth lays flat under the docking cells the woven weeks recede to a faint matrix so the items stay readable
      const recede = 1 - 0.8 * flip;
      row.mat.opacity = lerp(0.22, 1, d) * recede;
      tmp.copy(undyed).lerp(indigo, d);
      row.line.material.color.copy(tmp);
      row.line.material.opacity = lerp(0.9, 1, d) * recede;
      const s = lerp(0.65, 1, d);
      const pts = new Float32Array(5 * 3);
      for (let i = 0; i < 5; i++) {
        const k = row.knots[i];
        k.position.x = this.x[i]; k.scale.setScalar(s);
        pts[i * 3] = this.x[i]; pts[i * 3 + 1] = 0; pts[i * 3 + 2] = row.z;
      }
      writePositions(row.line, pts);
    }
    // the warp threads: a vertex sine sag on a 7s cycle with per thread phase, dyed behind the reed
    const dyeAll = clamp01((p - 0.45) / 0.15);
    const taut = KNOT(dyeAll);
    for (let i = 0; i < 5; i++) {
      const pts = this.warpPts[i], cols = this.warpCols[i];
      const sag = reduced ? 0 : 0.11 * (0.5 + 0.5 * Math.sin((t / 7) * Math.PI * 2 + this.phase[i])) * (1 - taut);
      for (let j = 0; j < WARP_N; j++) {
        const s = j / (WARP_N - 1);
        const z = -DEPTH * s;
        pts[j * 3] = this.x[i]; pts[j * 3 + 1] = -sag * Math.sin(Math.PI * s); pts[j * 3 + 2] = z;
        const dyed = Math.max(dyeAll, z < reedZ + 0.2 ? 1 : 0);
        tmp.copy(undyed).lerp(indigo, dyed);
        cols[j * 3] = tmp.r; cols[j * 3 + 1] = tmp.g; cols[j * 3 + 2] = tmp.b;
      }
      writePositions(this.warps[i], pts);
      writeColors(this.warps[i], cols);
    }
    // the weft: at idle it creeps across the near edge on an 11s loop, knotting each warp with a tiny overshoot;
    // in the held beat (0.45 to 0.6) it passes fully and snaps taut while the knots pull tight
    const xL = this.worldXFor(-8), xR = this.worldXFor(this.vw + 8);
    const beat = clamp01((p - 0.45) / 0.15);
    let head: number, weftOpacity = 1, sagW: number;
    if (beat > 0 || p >= 0.6) {
      head = lerp(xL, xR, KNOT(beat));
      sagW = 0.06 * (1 - KNOT(beat));
    } else if (!reduced && !this.firstPassDone) {
      // the first pass is the one The Tightening is timed to: it crosses in 1.6s (the H1 pulls tight glyph by glyph behind it, finishing as the fifth warp is knotted)
      const local = clamp01((t - this.firstPassAt) / 1.6);
      if (!this.weftStarted && local > 0.01) { this.weftStarted = true; document.dispatchEvent(new CustomEvent('sb:loom-weft')); }
      head = lerp(xL, xR, SHUTTLE(local));
      sagW = 0.05;
      if (local >= 1) { this.firstPassDone = true; this.loopAt = t - 0.78 * 11; }
    } else {
      const tau = reduced ? 0.78 : (((t - this.loopAt) % 11) / 11);
      const travel = SHUTTLE(clamp01(tau / 0.78));
      head = lerp(xL, xR, travel);
      weftOpacity = tau < 0.86 ? 1 : 1 - clamp01((tau - 0.86) / 0.1);
      if (tau > 0.97) weftOpacity = clamp01((tau - 0.97) / 0.03);
      sagW = 0.05;
    }
    for (let j = 0; j < WEFT_N; j++) {
      const s = j / (WEFT_N - 1);
      const x = lerp(xL, head, s);
      this.weftPts[j * 3] = x; this.weftPts[j * 3 + 1] = -sagW * Math.sin(Math.PI * s) * 0.6; this.weftPts[j * 3 + 2] = 0;
    }
    writePositions(this.weft, this.weftPts);
    this.weft.material.opacity = weftOpacity;
    // today's knots: tied as the weft passes; at the beat they pull tight with a 1.12 overshoot and a 90ms butter flash
    const bump = beat > 0 ? Math.sin(Math.PI * clamp01((beat - 0.35) / 0.5)) * 0.12 : 0;
    for (let i = 0; i < 5; i++) {
      const k = this.knots[i];
      k.position.x = this.x[i];
      const tie = clamp01((head - this.x[i]) / 0.35);
      const idle = (beat > 0 || p >= 0.6) ? 1 : lerp(0.7, 1, KNOT(tie)) * (weftOpacity < 1 ? lerp(0.7, 1, weftOpacity) : 1);
      const s = beat > 0 ? lerp(0.85, 1, KNOT(beat)) + bump : idle;
      k.scale.setScalar(s);
    }
    if (beat > 0.62 && this.flashArmed) { this.flashArmed = false; this.flashAt = now; }
    if (beat < 0.3) this.flashArmed = true;
    const flashing = this.flashAt > 0 && now - this.flashAt < 90;
    for (const k of this.knots) k.material = flashing ? this.flashMat : this.knotMat;
    // the handoff, 0.9 to 1.0: the five threads shorten into the thread strip (Flip onto the SVG twin), the canvas fades
    this.updateHandoff(p);
    this.renderer.render(this.scene, this.camera);
    // low power: under 30fps after two seconds of sampling drops to the poster while the DOM docking still runs
    if (!this.fpsChecked && !reduced) {
      if (!this.fpsStart) this.fpsStart = now;
      this.fpsFrames++;
      if (now - this.fpsStart > 2000) {
        this.fpsChecked = true;
        const fps = this.fpsFrames / ((now - this.fpsStart) / 1000);
        const keep = this.o.qa === 'loom' || this.o.qa === 'poster';   // the QA hooks that must keep the scene alive on a machine without a GPU
        if (fps < 30 && !keep) { this.dropped = true; this.setLive(false); this.o.setThreadProjection(null); this.stop(); console.info('[loom] low power: under 30fps after two seconds, the poster stays and the docking runs on the static table'); }
      }
    }
  }

  updateHandoff(p: number) {
    if (!this.twin || !this.proxyEls.length) return;
    const local = clamp01((p - 0.9) / 0.1);
    if (local <= 0) {
      if (this.handoff) { this.handoff.tl.kill(); this.handoff = null; this.proxies.classList.remove('is-on'); this.twin.classList.remove('is-on'); this.proxyEls.forEach((d) => { d.style.transform = ''; }); }
      return;
    }
    const strip = this.twin.parentElement as HTMLElement;
    if (!this.handoff) {
      // the proxies sit on the projected thread lines, then Flip (GSAP) onto the twin's five threads at the head of the row
      const a = { y: 0 }, b = { y: 0 };
      this.proxyEls.forEach((d, i) => {
        const xa = this.projectX(this.x[i], 0, a), xb = this.projectX(this.x[i], -DEPTH, b);
        const top = Math.max(0, Math.min(a.y, b.y)), bottom = Math.min(this.vh, Math.max(a.y, b.y));
        d.style.left = `${Math.round(lerp(xa, xb, 0.5))}px`; d.style.top = `${Math.round(top)}px`; d.style.height = `${Math.max(2, Math.round(bottom - top))}px`; d.style.transform = '';
      });
      this.proxies.classList.add('is-on');
      const g = (window as any).gsap, Flip = (window as any).Flip;
      const place = () => {
        const r = strip.getBoundingClientRect();
        this.proxyEls.forEach((d, i) => { d.style.left = `${Math.round(r.left + r.width * (0.1 + 0.2 * i))}px`; d.style.top = `${Math.round(r.top + 2)}px`; d.style.height = '32px'; });
      };
      if (g && Flip) {
        const state = Flip.getState(this.proxyEls);
        place();
        const tl = Flip.from(state, { duration: 1, ease: 'knot', scale: true, absolute: false, paused: true, simple: true });
        this.handoff = { tl, from: p };
      } else {
        place();
        this.handoff = { tl: { progress: () => {}, kill: () => {} }, from: p };
      }
    }
    this.handoff.tl.progress(local);
    this.twin.classList.toggle('is-on', local >= 0.98);
    if (local >= 0.98) this.proxies.classList.remove('is-on'); else this.proxies.classList.add('is-on');
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('pointermove', this.onPointer);
    try { this.renderer.dispose(); this.renderer.forceContextLoss?.(); } catch { /* already gone */ }
  }
}

let loom: Loom | null = null;
export async function mountLoom(o: LoomOptions) {
  if (loom) return loom;
  if (o.reduced) { o.hero.querySelector('[data-loom]')?.classList.add('is-poster'); return null; }
  // the fetch is tracked by the loader so the selvedge stitch follows it; the scene initialises behind the poster
  const fetching = (async () => { await loadScript(THREE_URL); await loadScript(LINES_URL); })();
  window.sbLoader?.track(fetching, 'three');
  const started = performance.now();
  try {
    await fetching;
    if (performance.now() - started > 3000) throw new Error('three.js took over 3s');
    if (typeof THREE === 'undefined' || !THREE.Line2) throw new Error('three.js did not load');
    loom = new Loom(o);
    await loom.init();
    (window as any).sbLoom = loom;
    return loom;
  } catch (err) {
    console.warn('[loom] the poster stays:', (err as Error).message);
    o.setThreadProjection(null);
    return null;
  }
}
