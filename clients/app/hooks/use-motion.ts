import { useEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

/** Tracks the user's reduced-motion preference. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Fades/slides in every [data-reveal] element inside `root` once it scrolls into view. */
export function useReveal(root: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const host = root.current;
    if (!host || reduced) return;
    const ctx = gsap.context(() => {
      const els = gsap.utils.toArray<HTMLElement>("[data-reveal]", host);
      if (!els.length) return;
      gsap.set(els, { opacity: 0, y: 28 });
      ScrollTrigger.batch(els, {
        start: "top 90%", once: true,
        onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.85, ease: "power3.out", stagger: 0.08, overwrite: true }),
      });
    }, host);
    return () => ctx.revert();
  }, [root, reduced]);
}

/** Runs `draw` on a canvas while it is visible (single frame when reduced motion is on). */
export function useCanvasLoop(ref: RefObject<HTMLCanvasElement | null>, draw: (g: CanvasRenderingContext2D, w: number, h: number, t: number) => void) {
  const reduced = useReducedMotion();
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const cv = ref.current; const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let vis = false, raf = 0; const t0 = performance.now();
    const size = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0);
      if (!raf) drawRef.current(ctx, cv.clientWidth, cv.clientHeight, 0);
    };
    const tick = (ts: number) => { raf = 0; if (!vis) return; drawRef.current(ctx, cv.clientWidth, cv.clientHeight, (ts - t0) / 1000); if (!reduced) raf = requestAnimationFrame(tick); };
    size();
    const ro = new ResizeObserver(size); ro.observe(cv);
    const io = new IntersectionObserver((e) => { vis = e[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(tick); });
    io.observe(cv);
    return () => { ro.disconnect(); io.disconnect(); cancelAnimationFrame(raf); };
  }, [ref, reduced]);
}

/** ECG-style waveform sample for u in any range. */
export function heartbeat(u: number) {
  u = ((u % 1) + 1) % 1;
  if (u < 0.1) return Math.sin((u / 0.1) * Math.PI) * 0.12;
  if (u > 0.18 && u < 0.2) return -0.2;
  if (u >= 0.2 && u < 0.25) return 1 - Math.abs(u - 0.225) * 40;
  if (u >= 0.25 && u < 0.28) return -0.25 * (1 - (u - 0.25) / 0.03);
  if (u > 0.4 && u < 0.58) return Math.sin(((u - 0.4) / 0.18) * Math.PI) * 0.22;
  return 0;
}

/** True below the `lg` breakpoint; mirrors the sidebar's CSS breakpoint. */
export function useIsMobile(breakpoint = 1024): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  );
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}
