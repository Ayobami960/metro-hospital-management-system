import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
//#region app/lib/medical3d.ts
var palette = {
	blue: 3103743,
	violet: 8017663
};
var isBrowser = typeof window !== "undefined";
var prefersReducedMotion = () => isBrowser && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
var isMobile = () => isBrowser && (!!window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 720);
var pointer = {
	x: 0,
	y: 0,
	sx: 0,
	sy: 0
};
var pointerBound = false;
function bindPointer() {
	if (pointerBound || !isBrowser) return;
	pointerBound = true;
	window.addEventListener("pointermove", (e) => {
		pointer.x = e.clientX / window.innerWidth * 2 - 1;
		pointer.y = e.clientY / window.innerHeight * 2 - 1;
	}, { passive: true });
}
function rrShape(w, h, r) {
	const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
	r = Math.min(r, w / 2, h / 2);
	s.moveTo(x + r, y);
	s.lineTo(x + w - r, y);
	s.quadraticCurveTo(x + w, y, x + w, y + r);
	s.lineTo(x + w, y + h - r);
	s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	s.lineTo(x + r, y + h);
	s.quadraticCurveTo(x, y + h, x, y + h - r);
	s.lineTo(x, y + r);
	s.quadraticCurveTo(x, y, x + r, y);
	return s;
}
function roundedBox(w, h, d, r, bevel) {
	const b = bevel ?? Math.min(.05, d / 4);
	const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, Math.max(.001, r - b)), {
		depth: Math.max(.001, d - 2 * b),
		bevelEnabled: true,
		bevelThickness: b,
		bevelSize: b,
		bevelSegments: 5,
		curveSegments: 18
	});
	g.center();
	return g;
}
var std = (o) => new THREE.MeshStandardMaterial(o);
var phys = (o) => new THREE.MeshPhysicalMaterial(o);
var mesh = (g, m) => {
	const x = new THREE.Mesh(g, m);
	x.castShadow = x.receiveShadow = true;
	return x;
};
function normalize(group, height) {
	const box = new THREE.Box3().setFromObject(group);
	const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
	const wrap = new THREE.Group();
	group.position.sub(c);
	wrap.add(group);
	wrap.scale.setScalar(height / Math.max(size.y, .001));
	return wrap;
}
function tube(points, radius, mat, seg = 120, rad = 18) {
	const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, "catmullrom", .5);
	return mesh(new THREE.TubeGeometry(curve, seg, radius, rad, false), mat);
}
var build = {
	stethoscope(o = {}) {
		const rubber = phys({
			color: o.tube ?? 1845824,
			roughness: .35,
			metalness: .05,
			clearcoat: .6,
			clearcoatRoughness: .35
		});
		const chrome = std({
			color: 15331061,
			metalness: 1,
			roughness: .16
		});
		const dark = std({
			color: 988707,
			roughness: .5,
			metalness: .2
		});
		const acc = phys({
			color: o.accent ?? 3112191,
			roughness: .3,
			metalness: .2,
			clearcoat: 1,
			emissive: o.accent ?? 3112191,
			emissiveIntensity: o.glow ?? 0
		});
		const g = new THREE.Group();
		const prof = [
			[0, 0],
			[.34, 0],
			[.4, .03],
			[.42, .09],
			[.4, .14],
			[.3, .17],
			[.2, .22],
			[.14, .3],
			[.1, .38],
			[0, .38]
		].map((p) => new THREE.Vector2(p[0], p[1]));
		const chest = mesh(new THREE.LatheGeometry(prof, 64), chrome);
		const diaphragm = mesh(new THREE.CylinderGeometry(.31, .31, .03, 64), dark);
		diaphragm.position.y = -.005;
		const ring = mesh(new THREE.TorusGeometry(.385, .028, 16, 64), acc);
		ring.rotation.x = Math.PI / 2;
		ring.position.y = .06;
		const chestG = new THREE.Group();
		chestG.add(chest, diaphragm, ring);
		chestG.position.set(0, -1.38, 0);
		chestG.rotation.set(Math.PI / 2, 0, 0);
		const stem = mesh(new THREE.CylinderGeometry(.075, .09, .26, 24), chrome);
		stem.position.set(0, -1.1, 0);
		g.add(chestG, stem);
		g.add(tube([
			[
				0,
				-1,
				0
			],
			[
				.02,
				-.75,
				.02
			],
			[
				.75,
				-.55,
				.1
			],
			[
				.85,
				-.1,
				.05
			],
			[
				.4,
				.22,
				0
			],
			[
				.02,
				.38,
				0
			]
		], .085, rubber));
		const junction = mesh(new THREE.SphereGeometry(.11, 24, 24), chrome);
		junction.position.set(0, .4, 0);
		g.add(junction);
		for (const s of [-1, 1]) {
			g.add(tube([
				[
					0,
					.42,
					0
				],
				[
					s * .1,
					.65,
					0
				],
				[
					s * .42,
					.88,
					0
				],
				[
					s * .75,
					1.2,
					0
				]
			], .068, rubber, 60, 14));
			const joint = mesh(new THREE.CylinderGeometry(.095, .095, .2, 20), chrome);
			joint.position.set(s * .75, 1.2, 0);
			g.add(joint);
			g.add(tube([
				[
					s * .75,
					1.22,
					0
				],
				[
					s * .8,
					1.6,
					.02
				],
				[
					s * .55,
					1.95,
					.1
				],
				[
					s * .16,
					2.06,
					.22
				]
			], .048, chrome, 60, 14));
			const tip = mesh(new THREE.SphereGeometry(.115, 24, 24), rubber);
			tip.position.set(s * .14, 2.06, .24);
			g.add(tip);
		}
		return normalize(g, o.size ?? 3);
	},
	thermometer(o = {}) {
		const body = phys({
			color: o.body ?? 16185853,
			roughness: .28,
			metalness: .05,
			clearcoat: 1,
			clearcoatRoughness: .12
		});
		const accent = phys({
			color: o.accent ?? 3112191,
			roughness: .3,
			metalness: .15,
			clearcoat: 1
		});
		const chrome = std({
			color: 14673646,
			metalness: 1,
			roughness: .18
		});
		const g = new THREE.Group();
		const shaft = mesh(roundedBox(.62, 2.7, .32, .3, .06), body);
		shaft.position.y = .2;
		g.add(shaft);
		const cv = document.createElement("canvas");
		cv.width = 256;
		cv.height = 140;
		const cx = cv.getContext("2d");
		const grad = cx.createLinearGradient(0, 0, 0, 140);
		grad.addColorStop(0, "#0c1c33");
		grad.addColorStop(1, "#06101f");
		cx.fillStyle = grad;
		cx.fillRect(0, 0, 256, 140);
		const digits = o.digits ?? "#9db4ff";
		cx.fillStyle = digits;
		cx.font = "700 74px 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace";
		cx.textBaseline = "middle";
		cx.textAlign = "center";
		cx.shadowColor = digits;
		cx.shadowBlur = 14;
		cx.fillText("36.8", 108, 74);
		cx.font = "600 34px 'JetBrains Mono Variable', monospace";
		cx.shadowBlur = 8;
		cx.fillText("°C", 218, 52);
		const tex = new THREE.CanvasTexture(cv);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 4;
		const screenFrame = mesh(roundedBox(.5, .86, .06, .1, .02), std({
			color: 726052,
			roughness: .2,
			metalness: .4
		}));
		screenFrame.position.set(0, .85, .17);
		g.add(screenFrame);
		const screen = new THREE.Mesh(new THREE.PlaneGeometry(.42, .78), new THREE.MeshBasicMaterial({
			map: tex,
			toneMapped: false
		}));
		screen.position.set(0, .85, .205);
		g.add(screen);
		const btn = mesh(new THREE.CylinderGeometry(.1, .1, .06, 32), accent);
		btn.rotation.x = Math.PI / 2;
		btn.position.set(0, -.12, .17);
		g.add(btn);
		const band = mesh(roundedBox(.64, .12, .34, .05, .03), accent);
		band.position.set(0, -.62, 0);
		g.add(band);
		const neck = mesh(new THREE.CylinderGeometry(.17, .2, .24, 32), chrome);
		neck.position.set(0, -1.28, 0);
		g.add(neck);
		const probe = mesh(new THREE.CylinderGeometry(.075, .17, .5, 32), chrome);
		probe.position.set(0, -1.65, 0);
		g.add(probe);
		const pt = mesh(new THREE.SphereGeometry(.075, 24, 24), chrome);
		pt.position.set(0, -1.9, 0);
		g.add(pt);
		return normalize(g, o.size ?? 3);
	},
	firstAidKit(o = {}) {
		const shell = phys({
			color: o.color ?? palette.blue,
			roughness: .32,
			metalness: .05,
			clearcoat: .9,
			clearcoatRoughness: .18
		});
		const shellDark = phys({
			color: 2376908,
			roughness: .4,
			clearcoat: .6
		});
		const white = phys({
			color: 16777215,
			roughness: .3,
			clearcoat: .8
		});
		const chrome = std({
			color: 14673646,
			metalness: 1,
			roughness: .2
		});
		const grey = std({
			color: 2765120,
			roughness: .5,
			metalness: .3
		});
		const g = new THREE.Group();
		const lower = mesh(roundedBox(2.5, 1.05, 1, .18, .07), shell);
		lower.position.y = -.25;
		g.add(lower);
		const lid = mesh(roundedBox(2.54, .72, 1.04, .18, .07), shell);
		lid.position.y = .52;
		g.add(lid);
		const seam = mesh(roundedBox(2.52, .07, 1.02, .02, .01), shellDark);
		seam.position.y = .2;
		g.add(seam);
		const cw = mesh(roundedBox(.78, .24, .05, .04, .015), white);
		cw.position.set(0, .02, .53);
		const ch = mesh(roundedBox(.24, .78, .05, .04, .015), white);
		ch.position.set(0, .02, .53);
		g.add(cw, ch);
		g.add(tube([
			[
				-.55,
				.88,
				0
			],
			[
				-.5,
				1.12,
				0
			],
			[
				0,
				1.22,
				0
			],
			[
				.5,
				1.12,
				0
			],
			[
				.55,
				.88,
				0
			]
		], .085, grey, 60, 14));
		for (const s of [-1, 1]) {
			const m = mesh(new THREE.CylinderGeometry(.12, .12, .08, 20), chrome);
			m.position.set(s * .55, .88, 0);
			g.add(m);
			const l = mesh(roundedBox(.22, .34, .08, .04, .02), chrome);
			l.position.set(s * .95, .2, .55);
			g.add(l);
		}
		return normalize(g, o.size ?? 2.4);
	},
	/** Beating heart: parametric particle surface. `children[0]` is the Points object. */
	heartCloud(o = {}) {
		const n = o.count ?? 5200, pos = new Float32Array(n * 3), seed = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			const t = Math.random() * Math.PI * 2, u = (Math.random() - .5) * Math.PI;
			const x = 16 * Math.pow(Math.sin(t), 3);
			const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
			const k = Math.cos(u) * (.85 + Math.random() * .15);
			const fill = Math.random() < .55 ? 1 : Math.cbrt(Math.random());
			pos[i * 3] = x * k * .11 * fill;
			pos[i * 3 + 1] = (y * .11 * (.9 + .1 * k) + .1) * fill;
			pos[i * 3 + 2] = Math.sin(u) * (Math.abs(x) * .5 + 4) * .11 * (.8 + Math.random() * .2) * fill;
			seed[i] = Math.random();
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
		geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
		const mat = new THREE.PointsMaterial({
			color: o.color ?? 4873471,
			size: .04,
			transparent: true,
			opacity: .85,
			depthWrite: false,
			sizeAttenuation: true
		});
		const points = new THREE.Points(geo, mat);
		const g = new THREE.Group();
		g.add(points);
		return {
			group: g,
			points,
			base: pos.slice(),
			seed
		};
	},
	dna(o = {}) {
		const g = new THREE.Group(), turns = o.turns ?? 3.2, steps = o.steps ?? 64, h = o.height ?? 4, r = o.radius ?? .55;
		const a = std({
			color: 5213439,
			roughness: .3,
			metalness: .2,
			emissive: 5213439,
			emissiveIntensity: .25
		});
		const b = std({
			color: 10517503,
			roughness: .3,
			metalness: .2,
			emissive: 10517503,
			emissiveIntensity: .25
		});
		const rung = std({
			color: 13621486,
			roughness: .4,
			metalness: .3,
			transparent: true,
			opacity: .55
		});
		const sg = new THREE.SphereGeometry(.075, 16, 16), rg = new THREE.CylinderGeometry(.016, .016, 1, 8);
		for (let i = 0; i <= steps; i++) {
			const t = i / steps, ang = t * turns * Math.PI * 2, y = (t - .5) * h;
			const p1 = new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r), p2 = new THREE.Vector3(Math.cos(ang + Math.PI) * r, y, Math.sin(ang + Math.PI) * r);
			const s1 = new THREE.Mesh(sg, a);
			s1.position.copy(p1);
			const s2 = new THREE.Mesh(sg, b);
			s2.position.copy(p2);
			g.add(s1, s2);
			if (i % 2 === 0) {
				const m = new THREE.Mesh(rg, rung);
				m.position.copy(p1.clone().add(p2).multiplyScalar(.5));
				m.scale.y = p1.distanceTo(p2);
				m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
				g.add(m);
			}
		}
		return g;
	},
	/** Thin orbital ring (violet/blue line) used as a scientific orbit guide. */
	ring(radius, color, opacity = .35) {
		const pts = [];
		for (let i = 0; i <= 160; i++) {
			const a = i / 160 * Math.PI * 2;
			pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
		}
		return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({
			color,
			transparent: true,
			opacity
		}));
	}
};
var modelFiles = {
	stethoscope: "stethoscope.glb",
	thermometer: "thermometer.glb",
	firstAidKit: "first-aid-kit.glb"
};
/** Real GLB first (lazy), procedural fallback if the file cannot be fetched/parsed. */
function loadModel(name, opts = {}) {
	const procedural = () => ({
		object: build[name](opts),
		source: "procedural"
	});
	if (opts.forceProcedural) return Promise.resolve(procedural());
	return new Promise((resolve) => {
		new GLTFLoader().load(`/models/${modelFiles[name]}`, (gltf) => {
			const obj = normalize(gltf.scene, opts.size ?? 3);
			obj.traverse((m) => {
				if (m.isMesh) m.castShadow = m.receiveShadow = true;
			});
			if (name === "firstAidKit") tintToBrand(obj);
			resolve({
				object: obj,
				source: "glb"
			});
		}, void 0, () => resolve(procedural()));
	});
}
/** The shipped kit GLB is red; re-colour red shells to the brand blue so the scene stays on-palette. */
function tintToBrand(obj) {
	const hsl = {
		h: 0,
		s: 0,
		l: 0
	};
	obj.traverse((m) => {
		const x = m;
		if (!x.isMesh || !x.material.color) return;
		const mat = x.material.clone();
		mat.color.getHSL(hsl);
		if ((hsl.h < .04 || hsl.h > .94) && hsl.s > .4) mat.color.setHex(hsl.l < .4 ? 2376908 : palette.blue);
		x.material = mat;
	});
}
function createStage(container, o = {}) {
	bindPointer();
	const opt = {
		fov: 35,
		z: 7,
		dprMax: 2,
		exposure: 1.05,
		...o
	};
	const reduced = prefersReducedMotion();
	let renderer;
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	try {
		renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: !isMobile(),
			alpha: true,
			powerPreference: "high-performance"
		});
		if (!renderer.getContext()) throw new Error("no context");
	} catch {
		container.classList.add("no-webgl");
		return null;
	}
	container.appendChild(canvas);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = opt.exposure;
	renderer.setClearColor(0, 0);
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(opt.fov, 1, .1, 200);
	camera.position.set(0, 0, opt.z);
	const pm = new THREE.PMREMGenerator(renderer);
	const envTex = pm.fromScene(new RoomEnvironment(), .04).texture;
	pm.dispose();
	scene.environment = envTex;
	scene.environmentIntensity = .9;
	const callbacks = [];
	let raf = 0, running = false, visible = true, dirty = true, disposed = false;
	let last = performance.now(), elapsed = 0;
	const resize = () => {
		const w = container.clientWidth || 1, h = container.clientHeight || 1;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? Math.min(opt.dprMax, 1.5) : opt.dprMax));
		renderer.setSize(w, h, false);
		canvas.style.width = "100%";
		canvas.style.height = "100%";
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		dirty = true;
	};
	const ro = new ResizeObserver(resize);
	ro.observe(container);
	resize();
	const frame = () => {
		raf = 0;
		if (disposed || !visible || document.hidden) {
			running = false;
			return;
		}
		const now = performance.now(), dt = Math.min((now - last) / 1e3, .05);
		last = now;
		elapsed += dt;
		const t = elapsed;
		pointer.sx += (pointer.x - pointer.sx) * .06;
		pointer.sy += (pointer.y - pointer.sy) * .06;
		if (!reduced || dirty) {
			for (const cb of callbacks) cb(dt, t);
			renderer.render(scene, camera);
			dirty = false;
		}
		raf = requestAnimationFrame(frame);
	};
	const start = () => {
		if (!raf && !running && !disposed) {
			last = performance.now();
			running = true;
			raf = requestAnimationFrame(frame);
		}
	};
	const io = new IntersectionObserver((e) => {
		visible = e[0].isIntersecting;
		if (visible) start();
	}, { rootMargin: "120px" });
	io.observe(container);
	const onVis = () => {
		if (!document.hidden) start();
	};
	document.addEventListener("visibilitychange", onVis);
	canvas.addEventListener("webglcontextlost", (e) => {
		e.preventDefault();
		container.classList.add("no-webgl");
	});
	canvas.addEventListener("webglcontextrestored", () => {
		container.classList.remove("no-webgl");
		dirty = true;
		start();
	});
	const stage = {
		container,
		scene,
		camera,
		renderer,
		failed: false,
		add: (obj) => {
			scene.add(obj);
			dirty = true;
		},
		onFrame: (cb) => {
			callbacks.push(cb);
		},
		invalidate: () => {
			dirty = true;
			if (visible) start();
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			cancelAnimationFrame(raf);
			ro.disconnect();
			io.disconnect();
			document.removeEventListener("visibilitychange", onVis);
			scene.traverse((m) => {
				const x = m;
				x.geometry?.dispose();
				(x.material ? Array.isArray(x.material) ? x.material : [x.material] : []).forEach((mt) => {
					for (const k in mt) {
						const v = mt[k];
						if (v && v.isTexture) v.dispose();
					}
					mt.dispose();
				});
			});
			envTex.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
			canvas.remove();
		}
	};
	start();
	return stage;
}
/** Studio lighting rig in the blue-violet identity. */
function addLights(stage, o = {}) {
	stage.add(new THREE.HemisphereLight(16777215, 11122943, o.hemi ?? .7));
	const key = new THREE.DirectionalLight(16777215, o.keyI ?? 2.2);
	key.position.set(3, 5, 5);
	stage.add(key);
	const rim = new THREE.DirectionalLight(o.rim ?? 9071615, o.rimI ?? 1.6);
	rim.position.set(-5, 2, -3);
	stage.add(rim);
}
/** Fractional section index from scroll (0 at the top of section 0, 1 at the top of section 1 …). */
function sectionTracker(getEls, anchor = .5) {
	let tops = [];
	const measure = () => {
		tops = getEls().map((e) => e ? e.getBoundingClientRect().top + window.scrollY : 0);
	};
	measure();
	const ro = new ResizeObserver(measure);
	ro.observe(document.body);
	window.addEventListener("resize", measure);
	const timers = [setTimeout(measure, 600), setTimeout(measure, 2e3)];
	const read = () => {
		const y = window.scrollY + window.innerHeight * anchor;
		if (!tops.length || y <= tops[0]) return 0;
		for (let i = 0; i < tops.length - 1; i++) if (y < tops[i + 1]) return i + (y - tops[i]) / (tops[i + 1] - tops[i]);
		return tops.length - 1;
	};
	return {
		read,
		dispose: () => {
			ro.disconnect();
			window.removeEventListener("resize", measure);
			timers.forEach(clearTimeout);
		}
	};
}
/** Smoothstep interpolation between keyframes at fractional index f (with optional hold at each key). */
function keyframes(frames, hold = 0) {
	return (f) => {
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
function makeHoverable(stage, objects) {
	const ray = new THREE.Raycaster(), v = new THREE.Vector2();
	objects.forEach((o) => o.userData.hover = 0);
	stage.onFrame((dt) => {
		v.set(pointer.x, -pointer.y);
		ray.setFromCamera(v, stage.camera);
		const hit = ray.intersectObjects(objects, true)[0];
		const root = hit && objects.find((o) => {
			let n = hit.object;
			while (n) {
				if (n === o) return true;
				n = n.parent;
			}
			return false;
		});
		objects.forEach((o) => {
			const tgt = o === root && !isMobile() ? 1 : 0;
			o.userData.hover += (tgt - o.userData.hover) * Math.min(1, dt * 6);
		});
	});
}
//#endregion
export { keyframes as a, palette as c, sectionTracker as d, isMobile as i, pointer as l, build as n, loadModel as o, createStage as r, makeHoverable as s, addLights as t, prefersReducedMotion as u };
