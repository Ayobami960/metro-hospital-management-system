import { useEffect, useRef } from "react";
import * as THREE from "three";
import { addLights, build, createStage, loadModel, palette, pointer, prefersReducedMotion } from "@/lib/medical3d";

/** Compact second scene for the operations section: rotating DNA helix beside the first-aid kit. */
export function FloatingMedicalObjects() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current; if (!host) return;
    const stage = createStage(host, { z: 11, fov: 32, dprMax: 2 });
    if (!stage) return;
    const reduced = prefersReducedMotion(); let cancelled = false;
    addLights(stage, { hemi: 0.9, keyI: 2, rim: palette.violet, rimI: 2 });
    const dna = build.dna({ height: 5.2, radius: 0.75 }); dna.position.x = -1.1; stage.add(dna);
    let kit: THREE.Group | null = null;
    void loadModel("firstAidKit", { size: 2.0 }).then((r) => { if (cancelled) return; kit = new THREE.Group(); kit.add(r.object); kit.position.set(2.0, 0, 0); stage.add(kit); });
    stage.onFrame((_dt, t) => {
      dna.rotation.y = reduced ? 0.6 : t * 0.5; dna.rotation.z = 0.35; dna.position.y = reduced ? 0 : Math.sin(t * 0.7) * 0.1;
      if (kit) { kit.rotation.y = (reduced ? 0.5 : -t * 0.45) + pointer.sx; kit.rotation.x = 0.15; kit.position.y = reduced ? 0 : Math.sin(t * 0.9) * 0.12; }
    });
    return () => { cancelled = true; stage.dispose(); };
  }, []);
  return (
    <div ref={ref} className="ops-stage" aria-hidden="true">
      <img className="med-scene__fallback" src={`${import.meta.env.BASE_URL}models/fallback-thermometer.png`} alt="" />
    </div>
  );
}
