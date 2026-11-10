
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const palette = { blue: 0x2f5bff, violet: 0x7a56ff } as const;
export type ModelName = "stethoscope" | "thermometer" | "firstAidKit";
type BuildOpts = { size?: number; accent?: number; color?: number; tube?: number; glow?: number; body?: number; digits?: string };

const isBrowser = typeof window !== "undefined";
export const prefersReducedMotion = () => isBrowser && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export const isMobile = () => isBrowser && (!!window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 720);

/* ---------- pointer (normalised -1..1, with smoothed copy) ---------- */
export const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
let pointerBound = false;
function bindPointer() {
  if (pointerBound || !isBrowser) return;
  pointerBound = true;
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
}

/* ---------- geometry helpers ---------- */
function rrShape(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function roundedBox(w: number, h: number, d: number, r: number, bevel?: number) {
  const b = bevel ?? Math.min(0.05, d / 4);
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, Math.max(0.001, r - b)), {
    depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 5, curveSegments: 18,
  });
  g.center();
  return g;
}
const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
const phys = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(o);
const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => { const x = new THREE.Mesh(g, m); x.castShadow = x.receiveShadow = true; return x; };

function normalize(group: THREE.Object3D, height: number) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  group.position.sub(c);
  wrap.add(group);
  wrap.scale.setScalar(height / Math.max(size.y, 1e-3));
  return wrap;
}
function tube(points: number[][], radius: number, mat: THREE.Material, seg = 120, rad = 18) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, "catmullrom", 0.5);
  return mesh(new THREE.TubeGeometry(curve, seg, radius, rad, false), mat);
}

/* ---------- procedural models ---------- */
export const build = {
  stethoscope(o: BuildOpts = {}) {
    const rubber = phys({ color: o.tube ?? 0x1c2a40, roughness: 0.35, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.35 });
    const chrome = std({ color: 0xe9eef5, metalness: 1, roughness: 0.16 });
    const dark = std({ color: 0x0f1623, roughness: 0.5, metalness: 0.2 });
    const acc = phys({ color: o.accent ?? 0x2f7cff, roughness: 0.3, metalness: 0.2, clearcoat: 1, emissive: o.accent ?? 0x2f7cff, emissiveIntensity: o.glow ?? 0 });
    const g = new THREE.Group();
    const prof = [[0, 0], [0.34, 0], [0.4, 0.03], [0.42, 0.09], [0.4, 0.14], [0.3, 0.17], [0.2, 0.22], [0.14, 0.3], [0.1, 0.38], [0.0, 0.38]].map((p) => new THREE.Vector2(p[0], p[1]));
    const chest = mesh(new THREE.LatheGeometry(prof, 64), chrome);
    const diaphragm = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.03, 64), dark); diaphragm.position.y = -0.005;
    const ring = mesh(new THREE.TorusGeometry(0.385, 0.028, 16, 64), acc); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
    const chestG = new THREE.Group(); chestG.add(chest, diaphragm, ring);
    chestG.position.set(0, -1.38, 0); chestG.rotation.set(Math.PI / 2, 0, 0);
    const stem = mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.26, 24), chrome); stem.position.set(0, -1.1, 0);
    g.add(chestG, stem);
    g.add(tube([[0, -1.0, 0], [0.02, -0.75, 0.02], [0.75, -0.55, 0.1], [0.85, -0.1, 0.05], [0.4, 0.22, 0], [0.02, 0.38, 0]], 0.085, rubber));
    const junction = mesh(new THREE.SphereGeometry(0.11, 24, 24), chrome); junction.position.set(0, 0.4, 0); g.add(junction);
    for (const s of [-1, 1]) {
      g.add(tube([[0, 0.42, 0], [s * 0.1, 0.65, 0], [s * 0.42, 0.88, 0], [s * 0.75, 1.2, 0]], 0.068, rubber, 60, 14));
      const joint = mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.2, 20), chrome); joint.position.set(s * 0.75, 1.2, 0); g.add(joint);
      g.add(tube([[s * 0.75, 1.22, 0], [s * 0.8, 1.6, 0.02], [s * 0.55, 1.95, 0.1], [s * 0.16, 2.06, 0.22]], 0.048, chrome, 60, 14));
      const tip = mesh(new THREE.SphereGeometry(0.115, 24, 24), rubber); tip.position.set(s * 0.14, 2.06, 0.24); g.add(tip);
    }
    return normalize(g, o.size ?? 3);
  },

  thermometer(o: BuildOpts = {}) {
    const body = phys({ color: o.body ?? 0xf6f9fd, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 });
    const accent = phys({ color: o.accent ?? 0x2f7cff, roughness: 0.3, metalness: 0.15, clearcoat: 1 });
    const chrome = std({ color: 0xdfe6ee, metalness: 1, roughness: 0.18 });
    const g = new THREE.Group();
    const shaft = mesh(roundedBox(0.62, 2.7, 0.32, 0.3, 0.06), body); shaft.position.y = 0.2; g.add(shaft);
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 140;
    const cx = cv.getContext("2d")!;
    const grad = cx.createLinearGradient(0, 0, 0, 140); grad.addColorStop(0, "#0c1c33"); grad.addColorStop(1, "#06101f");
    cx.fillStyle = grad; cx.fillRect(0, 0, 256, 140);
    const digits = o.digits ?? "#9db4ff";
    cx.fillStyle = digits; cx.font = "700 74px 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace"; cx.textBaseline = "middle"; cx.textAlign = "center";
    cx.shadowColor = digits; cx.shadowBlur = 14; cx.fillText("36.8", 108, 74);
    cx.font = "600 34px 'JetBrains Mono Variable', monospace"; cx.shadowBlur = 8; cx.fillText("°C", 218, 52);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const screenFrame = mesh(roundedBox(0.5, 0.86, 0.06, 0.1, 0.02), std({ color: 0x0b1424, roughness: 0.2, metalness: 0.4 })); screenFrame.position.set(0, 0.85, 0.17); g.add(screenFrame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.78), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    screen.position.set(0, 0.85, 0.205); g.add(screen);
    const btn = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 32), accent); btn.rotation.x = Math.PI / 2; btn.position.set(0, -0.12, 0.17); g.add(btn);
    const band = mesh(roundedBox(0.64, 0.12, 0.34, 0.05, 0.03), accent); band.position.set(0, -0.62, 0); g.add(band);
    const neck = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.24, 32), chrome); neck.position.set(0, -1.28, 0); g.add(neck);
    const probe = mesh(new THREE.CylinderGeometry(0.075, 0.17, 0.5, 32), chrome); probe.position.set(0, -1.65, 0); g.add(probe);
    const pt = mesh(new THREE.SphereGeometry(0.075, 24, 24), chrome); pt.position.set(0, -1.9, 0); g.add(pt);
    return normalize(g, o.size ?? 3);
  },

  firstAidKit(o: BuildOpts = {}) {
    const shell = phys({ color: o.color ?? palette.blue, roughness: 0.32, metalness: 0.05, clearcoat: 0.9, clearcoatRoughness: 0.18 });
    const shellDark = phys({ color: 0x2444cc, roughness: 0.4, clearcoat: 0.6 });
    const white = phys({ color: 0xffffff, roughness: 0.3, clearcoat: 0.8 });
    const chrome = std({ color: 0xdfe6ee, metalness: 1, roughness: 0.2 });
    const grey = std({ color: 0x2a3140, roughness: 0.5, metalness: 0.3 });
    const g = new THREE.Group();
    const lower = mesh(roundedBox(2.5, 1.05, 1.0, 0.18, 0.07), shell); lower.position.y = -0.25; g.add(lower);
    const lid = mesh(roundedBox(2.54, 0.72, 1.04, 0.18, 0.07), shell); lid.position.y = 0.52; g.add(lid);
    const seam = mesh(roundedBox(2.52, 0.07, 1.02, 0.02, 0.01), shellDark); seam.position.y = 0.2; g.add(seam);
    const cw = mesh(roundedBox(0.78, 0.24, 0.05, 0.04, 0.015), white); cw.position.set(0, 0.02, 0.53);
    const ch = mesh(roundedBox(0.24, 0.78, 0.05, 0.04, 0.015), white); ch.position.set(0, 0.02, 0.53);
    g.add(cw, ch);
    g.add(tube([[-0.55, 0.88, 0], [-0.5, 1.12, 0], [0, 1.22, 0], [0.5, 1.12, 0], [0.55, 0.88, 0]], 0.085, grey, 60, 14));
    for (const s of [-1, 1]) {
      const m = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 20), chrome); m.position.set(s * 0.55, 0.88, 0); g.add(m);
      const l = mesh(roundedBox(0.22, 0.34, 0.08, 0.04, 0.02), chrome); l.position.set(s * 0.95, 0.2, 0.55); g.add(l);
    }
    return normalize(g, o.size ?? 2.4);
  },

  /** Beating heart: parametric particle surface. `children[0]` is the Points object. */
  heartCloud(o: { count?: number; color?: number } = {}) {
    const n = o.count ?? 5200, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = Math.random() * Math.PI * 2, u = (Math.random() - 0.5) * Math.PI;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const k = Math.cos(u) * (0.85 + Math.random() * 0.15);
      const fill = Math.random() < 0.55 ? 1 : Math.cbrt(Math.random());
      pos[i * 3] = x * k * 0.11 * fill; pos[i * 3 + 1] = (y * 0.11 * (0.9 + 0.1 * k) + 0.1) * fill; pos[i * 3 + 2] = Math.sin(u) * (Math.abs(x) * 0.5 + 4) * 0.11 * (0.8 + Math.random() * 0.2) * fill;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.PointsMaterial({ color: o.color ?? 0x4a5cff, size: 0.04, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true });
    const points = new THREE.Points(geo, mat);
    const g = new THREE.Group(); g.add(points);
    return { group: g, points, base: pos.slice(), seed };
  },

  dna(o: { turns?: number; steps?: number; height?: number; radius?: number } = {}) {
    const g = new THREE.Group(), turns = o.turns ?? 3.2, steps = o.steps ?? 64, h = o.height ?? 4, r = o.radius ?? 0.55;
    const a = std({ color: 0x4f8cff, roughness: 0.3, metalness: 0.2, emissive: 0x4f8cff, emissiveIntensity: 0.25 });
    const b = std({ color: 0xa07bff, roughness: 0.3, metalness: 0.2, emissive: 0xa07bff, emissiveIntensity: 0.25 });
    const rung = std({ color: 0xcfd8ee, roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.55 });
    const sg = new THREE.SphereGeometry(0.075, 16, 16), rg = new THREE.CylinderGeometry(0.016, 0.016, 1, 8);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, ang = t * turns * Math.PI * 2, y = (t - 0.5) * h;
      const p1 = new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r), p2 = new THREE.Vector3(Math.cos(ang + Math.PI) * r, y, Math.sin(ang + Math.PI) * r);
      const s1 = new THREE.Mesh(sg, a); s1.position.copy(p1); const s2 = new THREE.Mesh(sg, b); s2.position.copy(p2); g.add(s1, s2);
      if (i % 2 === 0) {
        const m = new THREE.Mesh(rg, rung); m.position.copy(p1.clone().add(p2).multiplyScalar(0.5));
        m.scale.y = p1.distanceTo(p2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize()); g.add(m);
      }
    }
    return g;
  },

  /** Thin orbital ring (violet/blue line) used as a scientific orbit guide. */
  ring(radius: number, color: number, opacity = 0.35) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)); }
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  },
};

const modelFiles: Record<ModelName, string> = { stethoscope: "stethoscope.glb", thermometer: "thermometer.glb", firstAidKit: "first-aid-kit.glb" };

/** Real GLB first (lazy), procedural fallback if the file cannot be fetched/parsed. */
export function loadModel(name: ModelName, opts: BuildOpts & { forceProcedural?: boolean } = {}): Promise<{ object: THREE.Object3D; source: "glb" | "procedural" }> {
  const procedural = () => ({ object: build[name](opts), source: "procedural" as const });
  if (opts.forceProcedural) return Promise.resolve(procedural());
  return new Promise((resolve) => {
    new GLTFLoader().load(
      `${import.meta.env.BASE_URL}models/${modelFiles[name]}`,
      (gltf) => {
        const obj = normalize(gltf.scene, opts.size ?? 3);
        obj.traverse((m) => { if ((m as THREE.Mesh).isMesh) m.castShadow = m.receiveShadow = true; });
        if (name === "firstAidKit") tintToBrand(obj);
        resolve({ object: obj, source: "glb" });
      },
      undefined,
      () => resolve(procedural()),
    );
  });
}

/** The shipped kit GLB is red; re-colour red shells to the brand blue so the scene stays on-palette. */
function tintToBrand(obj: THREE.Object3D) {
  const hsl = { h: 0, s: 0, l: 0 };
  obj.traverse((m) => {
    const x = m as THREE.Mesh;
    if (!x.isMesh || !(x.material as THREE.MeshStandardMaterial).color) return;
    const mat = (x.material as THREE.MeshStandardMaterial).clone();
    mat.color.getHSL(hsl);
    if ((hsl.h < 0.04 || hsl.h > 0.94) && hsl.s > 0.4) mat.color.setHex(hsl.l < 0.4 ? 0x2444cc : palette.blue);
    x.material = mat;
  });
}

/* ---------- stage ---------- */
export type Stage = {
  container: HTMLElement; scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;
  failed: boolean; add: (o: THREE.Object3D) => void; onFrame: (cb: (dt: number, t: number) => void) => void;
  invalidate: () => void; dispose: () => void;
};

export function createStage(container: HTMLElement, o: { fov?: number; z?: number; dprMax?: number; exposure?: number } = {}): Stage | null {
  bindPointer();
  const opt = { fov: 35, z: 7, dprMax: 2, exposure: 1.05, ...o };
  const reduced = prefersReducedMotion();
  let renderer: THREE.WebGLRenderer;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile(), alpha: true, powerPreference: "high-performance" });
    if (!renderer.getContext()) throw new Error("no context");
  } catch {
    container.classList.add("no-webgl");
    return null;
  }
  container.appendChild(canvas);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opt.exposure;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opt.fov, 1, 0.1, 200); camera.position.set(0, 0, opt.z);
  const pm = new THREE.PMREMGenerator(renderer);
  const envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.environment = envTex; scene.environmentIntensity = 0.9;

  const callbacks: Array<(dt: number, t: number) => void> = [];
  let raf = 0, running = false, visible = true, dirty = true, disposed = false;
  let last = performance.now(), elapsed = 0;
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? Math.min(opt.dprMax, 1.5) : opt.dprMax));
    renderer.setSize(w, h, false);
    canvas.style.width = "100%"; canvas.style.height = "100%";
    camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  const frame = () => {
    raf = 0;
    if (disposed || !visible || document.hidden) { running = false; return; }
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; elapsed += dt; const t = elapsed;
    pointer.sx += (pointer.x - pointer.sx) * 0.06; pointer.sy += (pointer.y - pointer.sy) * 0.06;
    if (!reduced || dirty) { for (const cb of callbacks) cb(dt, t); renderer.render(scene, camera); dirty = false; }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && !running && !disposed) { last = performance.now(); running = true; raf = requestAnimationFrame(frame); } };
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) start(); }, { rootMargin: "120px" });
  io.observe(container);
  const onVis = () => { if (!document.hidden) start(); };
  document.addEventListener("visibilitychange", onVis);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); container.classList.add("no-webgl"); });
  canvas.addEventListener("webglcontextrestored", () => { container.classList.remove("no-webgl"); dirty = true; start(); });

  const stage: Stage = {
    container, scene, camera, renderer, failed: false,
    add: (obj) => { scene.add(obj); dirty = true; },
    onFrame: (cb) => { callbacks.push(cb); },
    invalidate: () => { dirty = true; if (visible) start(); },
    dispose: () => {
      if (disposed) return; disposed = true; cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis);
      scene.traverse((m) => {
        const x = m as THREE.Mesh;
        x.geometry?.dispose();
        const mats = x.material ? (Array.isArray(x.material) ? x.material : [x.material]) : [];
        mats.forEach((mt) => { for (const k in mt) { const v = (mt as unknown as Record<string, unknown>)[k]; if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose(); } mt.dispose(); });
      });
      envTex.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
  start();
  return stage;
}

/** Studio lighting rig in the blue-violet identity. */
export function addLights(stage: Stage, o: { hemi?: number; keyI?: number; rim?: number; rimI?: number } = {}) {
  stage.add(new THREE.HemisphereLight(0xffffff, 0xa9b8ff, o.hemi ?? 0.7));
  const key = new THREE.DirectionalLight(0xffffff, o.keyI ?? 2.2); key.position.set(3, 5, 5); stage.add(key);
  const rim = new THREE.DirectionalLight(o.rim ?? 0x8a6bff, o.rimI ?? 1.6); rim.position.set(-5, 2, -3); stage.add(rim);
}

/** Fractional section index from scroll (0 at the top of section 0, 1 at the top of section 1 …). */
export function sectionTracker(getEls: () => Array<HTMLElement | null>, anchor = 0.5) {
  let tops: number[] = [];
  const measure = () => { tops = getEls().map((e) => (e ? e.getBoundingClientRect().top + window.scrollY : 0)); };
  measure();
  const ro = new ResizeObserver(measure); ro.observe(document.body);
  window.addEventListener("resize", measure);
  const timers = [setTimeout(measure, 600), setTimeout(measure, 2000)];
  const read = () => {
    const y = window.scrollY + window.innerHeight * anchor;
    if (!tops.length || y <= tops[0]) return 0;
    for (let i = 0; i < tops.length - 1; i++) if (y < tops[i + 1]) return i + (y - tops[i]) / (tops[i + 1] - tops[i]);
    return tops.length - 1;
  };
  return { read, dispose: () => { ro.disconnect(); window.removeEventListener("resize", measure); timers.forEach(clearTimeout); } };
}

/** Smoothstep interpolation between keyframes at fractional index f (with optional hold at each key). */
export function keyframes(frames: number[][], hold = 0) {
  return (f: number): number[] => {
    const n = frames.length - 1;
    if (f >= n) return frames[n].slice();
    const i = Math.min(n - 1, Math.max(0, Math.floor(f)));
    let t = Math.min(1, Math.max(0, f - i));
    if (hold) t = Math.min(1, Math.max(0, (t - hold) / (1 - hold)));
    t = t * t * (3 - 2 * t);
    return frames[i].map((v, k) => v + (frames[i + 1][k] - v) * t);
  };
}

/** Pointer hover using the window pointer (the canvas may sit behind page content). Sets userData.hover 0..1. */
export function makeHoverable(stage: Stage, objects: THREE.Object3D[]) {
  const ray = new THREE.Raycaster(), v = new THREE.Vector2();
  objects.forEach((o) => (o.userData.hover = 0));
  stage.onFrame((dt) => {
    v.set(pointer.x, -pointer.y); ray.setFromCamera(v, stage.camera);
    const hit = ray.intersectObjects(objects, true)[0];
    const root = hit && objects.find((o) => { let n: THREE.Object3D | null = hit.object; while (n) { if (n === o) return true; n = n.parent; } return false; });
    objects.forEach((o) => { const tgt = o === root && !isMobile() ? 1 : 0; o.userData.hover += (tgt - o.userData.hover) * Math.min(1, dt * 6); });
  });
}
