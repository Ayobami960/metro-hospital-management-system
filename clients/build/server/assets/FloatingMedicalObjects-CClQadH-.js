import { c as palette, l as pointer, n as build, o as loadModel, r as createStage, t as addLights, u as prefersReducedMotion } from "./medical3d-KhJUTYgL.js";
import { jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import * as THREE from "three";
//#region app/components/home/FloatingMedicalObjects.tsx
/** Compact second scene for the operations section: rotating DNA helix beside the first-aid kit. */
function FloatingMedicalObjects() {
	const ref = useRef(null);
	useEffect(() => {
		const host = ref.current;
		if (!host) return;
		const stage = createStage(host, {
			z: 11,
			fov: 32,
			dprMax: 2
		});
		if (!stage) return;
		const reduced = prefersReducedMotion();
		let cancelled = false;
		addLights(stage, {
			hemi: .9,
			keyI: 2,
			rim: palette.violet,
			rimI: 2
		});
		const dna = build.dna({
			height: 5.2,
			radius: .75
		});
		dna.position.x = -1.1;
		stage.add(dna);
		let kit = null;
		loadModel("firstAidKit", { size: 2 }).then((r) => {
			if (cancelled) return;
			kit = new THREE.Group();
			kit.add(r.object);
			kit.position.set(2, 0, 0);
			stage.add(kit);
		});
		stage.onFrame((_dt, t) => {
			dna.rotation.y = reduced ? .6 : t * .5;
			dna.rotation.z = .35;
			dna.position.y = reduced ? 0 : Math.sin(t * .7) * .1;
			if (kit) {
				kit.rotation.y = (reduced ? .5 : -t * .45) + pointer.sx;
				kit.rotation.x = .15;
				kit.position.y = reduced ? 0 : Math.sin(t * .9) * .12;
			}
		});
		return () => {
			cancelled = true;
			stage.dispose();
		};
	}, []);
	return /* @__PURE__ */ jsx("div", {
		ref,
		className: "ops-stage",
		"aria-hidden": "true",
		children: /* @__PURE__ */ jsx("img", {
			className: "med-scene__fallback",
			src: `/models/fallback-thermometer.png`,
			alt: ""
		})
	});
}
//#endregion
export { FloatingMedicalObjects };
