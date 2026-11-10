import { useEffect, useRef, useState } from "react";
import { Workflow } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { heartbeat, useCanvasLoop, useReducedMotion } from "@/hooks/use-motion";
import { SectionHeading } from "./SectionHeading";
import { coordination, previewGauges } from "./data";

const WAVES = ["#6f8dff", "#a98bff", "#8fb0ff"];

/** Dashboard-inspired illustrative preview — values are decorative, never live hospital data. */
export function DiagnosticsPreview() {
  const reduced = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const waves = useRef<HTMLCanvasElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (reduced) { setSeen(true); return; }
    const el = host.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: "0px 0px -20% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  useCanvasLoop(waves, (g, w, h, t) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 1;
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(0, (h / 5) * i); g.lineTo(w, (h / 5) * i); g.stroke(); }
    WAVES.forEach((c, k) => {
      g.beginPath(); g.strokeStyle = c; g.lineWidth = 2; g.shadowColor = c; g.shadowBlur = 8;
      for (let i = 0; i <= w; i += 3) {
        const x = i / w;
        const y = h * (0.28 + k * 0.22) - (k === 0 ? heartbeat(t * 0.6 + x * 3) * h * 0.2 : Math.sin(x * (7 + k * 4) + t * (1.2 + k * 0.5)) * h * 0.06 * (1 + Math.sin(t * 0.4 + k)));
        if (i) g.lineTo(i, y); else g.moveTo(i, y);
      }
      g.stroke(); g.shadowBlur = 0;
    });
  });

  const C = 251.3;
  return (
    <section id="preview" aria-labelledby="preview-heading">
      <div className="wrap">
        <SectionHeading id="preview-heading" eyebrow="Connected hospital operations" title={<>Diagnostics, <em>visualised.</em></>} description="Explore the departments within one platform." />
        <div className="diag" ref={host} data-reveal>
          <div className="panel">
            <h3><span>PATIENT CARE · APPOINTMENTS · LABORATORY · BILLING</span><span className="live">● PREVIEW</span></h3>
            <canvas ref={waves} height={210} aria-hidden="true" />
            <div className="gauges">
              {previewGauges.map((g) => (
                <div className={`g${seen ? " in" : ""}`} key={g.label} style={{ ["--v" as string]: g.value, ["--c" as string]: C }}>
                  <div className="gauge-ring">
                    <svg viewBox="0 0 100 100" aria-hidden="true">
                      <defs><linearGradient id="hos-gauge-grad"><stop offset="0" stopColor="#4f7bff" /><stop offset="1" stopColor="#a98bff" /></linearGradient></defs>
                      <circle className="bgc" cx="50" cy="50" r="40" /><circle className="fg" cx="50" cy="50" r="40" />
                    </svg>
                    <b>{Math.round(g.value * 100)}</b>
                  </div>
                  <small>{g.label}<br />{g.detail}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h3><span>DEPARTMENT COORDINATION</span><Workflow aria-hidden="true" /></h3>
            <div className="dept2">
              {coordination.map((c) => (
                <div key={c.label}>
                  <div className="t"><span>{c.label}</span><CheckCircle2 aria-hidden="true" /></div>
                  <div className="tr"><i style={{ width: seen ? `${c.width}%` : 0 }} /></div>
                </div>
              ))}
            </div>
            <p className="panel-note">Illustrative interface preview · Not live hospital data</p>
          </div>
        </div>
      </div>
    </section>
  );
}
