import { useEffect, useRef } from "react";
import * as THREE from "three";
import { addLights, build, createStage, isMobile, keyframes, loadModel, makeHoverable, palette, pointer, prefersReducedMotion, sectionTracker, type ModelName } from "@/lib/medical3d";
import { createScientificParticles } from "./ScientificParticles";

/** Section ids the scene follows while the page scrolls. */
export const SCENE_SECTIONS = ["hero", "platform", "portals", "preview", "operations", "workflow", "principles"] as const;

const ss = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
// [x, y, scale, opacity] of the heart per section (desktop / narrow)
const DESKTOP = keyframes([[0.52, 0, 1, 1], [0.96, 0.62, 0.38, 0.2], [-0.96, 0.62, 0.34, 0.18], [0.96, 0.66, 0.3, 0.14], [0.97, 0.7, 0.3, 0.14], [-0.97, 0.66, 0.3, 0.14], [0.96, 0.66, 0.3, 0.16]], 0.4);
const NARROW = keyframes([[0, 0.46, 0.72, 1], [0.85, 0.85, 0.26, 0.16], [-0.85, 0.85, 0.26, 0.14], [0.85, 0.85, 0.26, 0.12], [0.85, 0.85, 0.26, 0.12], [-0.85, 0.85, 0.26, 0.12], [0.85, 0.85, 0.26, 0.12]], 0.4);

type Item = { name: ModelName; angle: number; size: number; group: THREE.Group; hover?: number };

/**
 * One fixed, unified WebGL scene: a particle heart ringed by orbital guides, with the stethoscope,
 * digital thermometer and first-aid kit orbiting it. Scroll progress drives position, rotation and
 * the thermometer/kit transitions; the pointer tilts the camera and the heart.
 */
export function MedicalScienceScene() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const stage = createStage(host, { z: 11, fov: 34, dprMax: 1.75 });
    if (!stage) return; // CSS fallback image is shown via .no-webgl
    const reduced = prefersReducedMotion();
    let cancelled = false;
    addLights(stage, { hemi: 0.9, keyI: 2, rim: palette.violet, rimI: 2 });

    const heart = createScientificParticles();
    const root = new THREE.Group(); root.add(heart.group); stage.add(root);
    const orbit = new THREE.Group(); orbit.rotation.x = 0.28; root.add(orbit);
    // orbital guides + a faint connecting line between the objects
    const ring1 = build.ring(2.3, palette.violet, 0.4), ring2 = build.ring(3.15, palette.blue, 0.22);
    ring2.rotation.x = 0.5; orbit.add(ring1, ring2);

    const items: Item[] = [
      { name: "stethoscope", angle: 0, size: 1.7, group: new THREE.Group() },
      { name: "thermometer", angle: (Math.PI * 2) / 3, size: 1.6, group: new THREE.Group() },
      { name: "firstAidKit", angle: (Math.PI * 4) / 3, size: 1.05, group: new THREE.Group() },
    ];
    const linkGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    const link = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ color: palette.violet, transparent: true, opacity: 0.28 }));
    link.frustumCulled = false; root.add(link);

    const loads = items.map((it) =>
      loadModel(it.name, { size: it.size, accent: palette.violet }).then((r) => {
        if (cancelled) return;
        it.group.add(r.object); it.group.scale.setScalar(0.001); orbit.add(it.group); stage.invalidate();
      }),
    );
    void Promise.all(loads).then(() => { if (!cancelled) makeHoverable(stage, items.map((i) => i.group)); });

    const tracker = sectionTracker(() => SCENE_SECTIONS.map((id) => document.getElementById(id)), 0.4);
    const cur = [0.52, 0, 1, 1];
    let intro = reduced ? 1 : 0; const born = performance.now();
    const tmp = new THREE.Vector3(), tmpB = new THREE.Vector3();

    stage.onFrame((dt, t) => {
      const f = tracker.read(), narrow = stage.camera.aspect < 0.95, tg = (narrow ? NARROW : DESKTOP)(f);
      if (!reduced) intro = Math.min(1, (performance.now() - born) / 2200);
      const halfH = Math.tan((stage.camera.fov * Math.PI) / 360) * stage.camera.position.z, halfW = halfH * stage.camera.aspect;
      for (let i = 0; i < 4; i++) cur[i] = reduced ? tg[i] : cur[i] + (tg[i] - cur[i]) * Math.min(1, dt * 4); // reduced motion: snap, no easing
      const beat = reduced ? 1 : 1 + Math.pow(Math.max(0, Math.sin(t * 5.2)), 6) * 0.05 + Math.pow(Math.max(0, Math.sin(t * 5.2 - 0.9)), 6) * 0.03;
      root.position.set(cur[0] * halfW, cur[1] * halfH + (reduced ? 0 : Math.sin(t * 0.7) * 0.1), 0);
      root.scale.setScalar(cur[2] * beat * (narrow ? 0.9 : 1) * ss(intro * 1.4));
      heart.group.rotation.y = (reduced ? 0.4 : t * 0.3) + f * 1.6 + pointer.sx * 0.4; heart.group.rotation.x = pointer.sy * 0.2;
      heart.update(dt, t, cur[3]);

      orbit.rotation.y = (reduced ? 0 : t * 0.45) + f * 2;
      ring1.rotation.y = f * -1.2; ring2.rotation.y = f * 0.8 + (reduced ? 0 : t * 0.1);
      orbit.scale.setScalar(narrow ? 0.62 : 1);
      orbit.visible = cur[3] > 0.45;
      const pts: number[] = [];
      items.forEach((it, i) => {
        // thermometer drifts outward/upward as the page scrolls; the kit scales in after the hero
        const drift = it.name === "thermometer" ? ss(f * 1.1) : 0;
        const enter = it.name === "firstAidKit" ? ss(intro * 1.6 - 0.4) * (0.6 + 0.4 * ss(f * 1.2)) : ss(intro * 1.6 - i * 0.2);
        const r = 2.3 + drift * 0.85, a = it.angle;
        it.group.position.set(Math.cos(a) * r, drift * 0.7 + (reduced ? 0 : Math.sin(t * 0.9 + i * 2) * 0.1), Math.sin(a) * r);
        it.group.scale.setScalar(Math.max(0.001, enter * (1 + (it.group.userData.hover ?? 0) * 0.12)));
        it.group.rotation.y = (reduced ? 0.6 : -t * 0.6) - f * 2 - orbit.rotation.y + (it.name === "stethoscope" ? 0.6 : 0.2) + (it.group.userData.hover ?? 0) * 0.6;
        // connector lines between neighbouring objects (world-local to root)
        const nx = items[(i + 1) % items.length].group;
        tmp.copy(it.group.position).applyEuler(orbit.rotation); tmpB.copy(nx.position).applyEuler(orbit.rotation);
        pts.push(tmp.x, tmp.y, tmp.z, tmpB.x, tmpB.y, tmpB.z);
      });
      const attr = linkGeo.attributes.position as THREE.BufferAttribute; (attr.array as Float32Array).set(pts); attr.needsUpdate = true;
      (link.material as THREE.LineBasicMaterial).opacity = 0.28 * cur[3];
      stage.camera.position.x = pointer.sx * 0.3; stage.camera.lookAt(0, 0, 0);
    });

    const bump = () => stage.invalidate();
    window.addEventListener("scroll", bump, { passive: true });
    window.addEventListener("pointermove", bump, { passive: true });
    window.addEventListener("pagehide", stage.dispose);
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", bump); window.removeEventListener("pointermove", bump); window.removeEventListener("pagehide", stage.dispose);
      tracker.dispose(); stage.dispose();
    };
  }, []);

  return (
    <div ref={ref} className="med-scene" aria-hidden="true" data-testid="medical-scene">
      {/* Fallback if WebGL is unavailable — shown by app.css when the container has .no-webgl */}
      <img className="med-scene__fallback" src={`${import.meta.env.BASE_URL}models/fallback-stethoscope.png`} alt="" />
    </div>
  );
}
