import { a as keyframes, c as palette, d as sectionTracker, i as isMobile, l as pointer, n as build, o as loadModel, r as createStage, s as makeHoverable, t as addLights, u as prefersReducedMotion } from "./medical3d-KhJUTYgL.js";
import { jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import * as THREE from "three";
//#region app/components/home/ScientificParticles.ts
/** Particle heart used as the core of the scientific scene, with a gentle shimmer. */
function createScientificParticles() {
	const { group, points, base, seed } = build.heartCloud({
		count: isMobile() ? 4200 : 9e3,
		color: 4873471
	});
	const mat = points.material;
	mat.size = .04;
	mat.opacity = .85;
	const pos = points.geometry.attributes.position;
	let phase = 0;
	return {
		group,
		points,
		/** Updates the shimmer (skipped under reduced motion) and the overall opacity. */
		update(dt, t, opacity) {
			mat.opacity = .85 * opacity;
			if (prefersReducedMotion()) return;
			phase += dt;
			if ((phase * 30 | 0) % 2 !== 0) return;
			const a = pos.array;
			for (let i = 0; i < seed.length; i++) {
				const k = i * 3, s = Math.sin(t * 1.5 + seed[i] * 40) * .012;
				a[k] = base[k] + s;
				a[k + 1] = base[k + 1] + s * .6;
			}
			pos.needsUpdate = true;
		}
	};
}
//#endregion
//#region app/components/home/MedicalScienceScene.tsx
/** Section ids the scene follows while the page scrolls. */
var SCENE_SECTIONS = [
	"hero",
	"platform",
	"portals",
	"preview",
	"operations",
	"workflow",
	"principles"
];
var ss = (x) => {
	const t = Math.min(1, Math.max(0, x));
	return t * t * (3 - 2 * t);
};
var DESKTOP = keyframes([
	[
		.52,
		0,
		1,
		1
	],
	[
		.96,
		.62,
		.38,
		.2
	],
	[
		-.96,
		.62,
		.34,
		.18
	],
	[
		.96,
		.66,
		.3,
		.14
	],
	[
		.97,
		.7,
		.3,
		.14
	],
	[
		-.97,
		.66,
		.3,
		.14
	],
	[
		.96,
		.66,
		.3,
		.16
	]
], .4);
var NARROW = keyframes([
	[
		0,
		.46,
		.72,
		1
	],
	[
		.85,
		.85,
		.26,
		.16
	],
	[
		-.85,
		.85,
		.26,
		.14
	],
	[
		.85,
		.85,
		.26,
		.12
	],
	[
		.85,
		.85,
		.26,
		.12
	],
	[
		-.85,
		.85,
		.26,
		.12
	],
	[
		.85,
		.85,
		.26,
		.12
	]
], .4);
/**
* One fixed, unified WebGL scene: a particle heart ringed by orbital guides, with the stethoscope,
* digital thermometer and first-aid kit orbiting it. Scroll progress drives position, rotation and
* the thermometer/kit transitions; the pointer tilts the camera and the heart.
*/
function MedicalScienceScene() {
	const ref = useRef(null);
	useEffect(() => {
		const host = ref.current;
		if (!host) return;
		const stage = createStage(host, {
			z: 11,
			fov: 34,
			dprMax: 1.75
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
		const heart = createScientificParticles();
		const root = new THREE.Group();
		root.add(heart.group);
		stage.add(root);
		const orbit = new THREE.Group();
		orbit.rotation.x = .28;
		root.add(orbit);
		const ring1 = build.ring(2.3, palette.violet, .4), ring2 = build.ring(3.15, palette.blue, .22);
		ring2.rotation.x = .5;
		orbit.add(ring1, ring2);
		const items = [
			{
				name: "stethoscope",
				angle: 0,
				size: 1.7,
				group: new THREE.Group()
			},
			{
				name: "thermometer",
				angle: Math.PI * 2 / 3,
				size: 1.6,
				group: new THREE.Group()
			},
			{
				name: "firstAidKit",
				angle: Math.PI * 4 / 3,
				size: 1.05,
				group: new THREE.Group()
			}
		];
		const linkGeo = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(),
			new THREE.Vector3(),
			new THREE.Vector3(),
			new THREE.Vector3(),
			new THREE.Vector3(),
			new THREE.Vector3()
		]);
		const link = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({
			color: palette.violet,
			transparent: true,
			opacity: .28
		}));
		link.frustumCulled = false;
		root.add(link);
		const loads = items.map((it) => loadModel(it.name, {
			size: it.size,
			accent: palette.violet
		}).then((r) => {
			if (cancelled) return;
			it.group.add(r.object);
			it.group.scale.setScalar(.001);
			orbit.add(it.group);
			stage.invalidate();
		}));
		Promise.all(loads).then(() => {
			if (!cancelled) makeHoverable(stage, items.map((i) => i.group));
		});
		const tracker = sectionTracker(() => SCENE_SECTIONS.map((id) => document.getElementById(id)), .4);
		const cur = [
			.52,
			0,
			1,
			1
		];
		let intro = reduced ? 1 : 0;
		const born = performance.now();
		const tmp = new THREE.Vector3(), tmpB = new THREE.Vector3();
		stage.onFrame((dt, t) => {
			const f = tracker.read(), narrow = stage.camera.aspect < .95, tg = (narrow ? NARROW : DESKTOP)(f);
			if (!reduced) intro = Math.min(1, (performance.now() - born) / 2200);
			const halfH = Math.tan(stage.camera.fov * Math.PI / 360) * stage.camera.position.z, halfW = halfH * stage.camera.aspect;
			for (let i = 0; i < 4; i++) cur[i] = reduced ? tg[i] : cur[i] + (tg[i] - cur[i]) * Math.min(1, dt * 4);
			const beat = reduced ? 1 : 1 + Math.pow(Math.max(0, Math.sin(t * 5.2)), 6) * .05 + Math.pow(Math.max(0, Math.sin(t * 5.2 - .9)), 6) * .03;
			root.position.set(cur[0] * halfW, cur[1] * halfH + (reduced ? 0 : Math.sin(t * .7) * .1), 0);
			root.scale.setScalar(cur[2] * beat * (narrow ? .9 : 1) * ss(intro * 1.4));
			heart.group.rotation.y = (reduced ? .4 : t * .3) + f * 1.6 + pointer.sx * .4;
			heart.group.rotation.x = pointer.sy * .2;
			heart.update(dt, t, cur[3]);
			orbit.rotation.y = (reduced ? 0 : t * .45) + f * 2;
			ring1.rotation.y = f * -1.2;
			ring2.rotation.y = f * .8 + (reduced ? 0 : t * .1);
			orbit.scale.setScalar(narrow ? .62 : 1);
			orbit.visible = cur[3] > .45;
			const pts = [];
			items.forEach((it, i) => {
				const drift = it.name === "thermometer" ? ss(f * 1.1) : 0;
				const enter = it.name === "firstAidKit" ? ss(intro * 1.6 - .4) * (.6 + .4 * ss(f * 1.2)) : ss(intro * 1.6 - i * .2);
				const r = 2.3 + drift * .85, a = it.angle;
				it.group.position.set(Math.cos(a) * r, drift * .7 + (reduced ? 0 : Math.sin(t * .9 + i * 2) * .1), Math.sin(a) * r);
				it.group.scale.setScalar(Math.max(.001, enter * (1 + (it.group.userData.hover ?? 0) * .12)));
				it.group.rotation.y = (reduced ? .6 : -t * .6) - f * 2 - orbit.rotation.y + (it.name === "stethoscope" ? .6 : .2) + (it.group.userData.hover ?? 0) * .6;
				const nx = items[(i + 1) % items.length].group;
				tmp.copy(it.group.position).applyEuler(orbit.rotation);
				tmpB.copy(nx.position).applyEuler(orbit.rotation);
				pts.push(tmp.x, tmp.y, tmp.z, tmpB.x, tmpB.y, tmpB.z);
			});
			const attr = linkGeo.attributes.position;
			attr.array.set(pts);
			attr.needsUpdate = true;
			link.material.opacity = .28 * cur[3];
			stage.camera.position.x = pointer.sx * .3;
			stage.camera.lookAt(0, 0, 0);
		});
		const bump = () => stage.invalidate();
		window.addEventListener("scroll", bump, { passive: true });
		window.addEventListener("pointermove", bump, { passive: true });
		window.addEventListener("pagehide", stage.dispose);
		return () => {
			cancelled = true;
			window.removeEventListener("scroll", bump);
			window.removeEventListener("pointermove", bump);
			window.removeEventListener("pagehide", stage.dispose);
			tracker.dispose();
			stage.dispose();
		};
	}, []);
	return /* @__PURE__ */ jsx("div", {
		ref,
		className: "med-scene",
		"aria-hidden": "true",
		"data-testid": "medical-scene",
		children: /* @__PURE__ */ jsx("img", {
			className: "med-scene__fallback",
			src: `/models/fallback-stethoscope.png`,
			alt: ""
		})
	});
}
//#endregion
export { MedicalScienceScene };
