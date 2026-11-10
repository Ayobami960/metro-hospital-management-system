import * as THREE from "three";
import { build, isMobile, prefersReducedMotion } from "@/lib/medical3d";

/** Particle heart used as the core of the scientific scene, with a gentle shimmer. */
export function createScientificParticles() {
  const { group, points, base, seed } = build.heartCloud({ count: isMobile() ? 4200 : 9000, color: 0x4a5cff });
  const mat = points.material as THREE.PointsMaterial;
  mat.size = 0.04; mat.opacity = 0.85;
  const pos = points.geometry.attributes.position as THREE.BufferAttribute;
  let phase = 0;
  return {
    group, points,
    /** Updates the shimmer (skipped under reduced motion) and the overall opacity. */
    update(dt: number, t: number, opacity: number) {
      mat.opacity = 0.85 * opacity;
      if (prefersReducedMotion()) return;
      phase += dt;
      if (((phase * 30) | 0) % 2 !== 0) return;
      const a = pos.array as Float32Array;
      for (let i = 0; i < seed.length; i++) {
        const k = i * 3, s = Math.sin(t * 1.5 + seed[i] * 40) * 0.012;
        a[k] = base[k] + s; a[k + 1] = base[k + 1] + s * 0.6;
      }
      pos.needsUpdate = true;
    },
  };
}
