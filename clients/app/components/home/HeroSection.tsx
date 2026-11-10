import { useRef } from "react";
import { Link } from "react-router";
import { ArrowRight, CheckCircle2, UserRound } from "lucide-react";
import { heartbeat, useCanvasLoop } from "@/hooks/use-motion";
import { PATIENT_HREF, STAFF_HREF } from "./data";

/** Editorial split-screen hero: copy on the left; the shared fixed 3D scene shows through on the right. */
export function HeroSection() {
  const ecg = useRef<HTMLCanvasElement>(null);
  useCanvasLoop(ecg, (g, w, h, t) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "#2f5bff"; g.lineWidth = 1.6; g.beginPath();
    for (let i = 0; i < w; i += 2) {
      const y = h * 0.72 - heartbeat(t * 0.9 - (w - i) / 110) * h * 0.65;
      if (i) g.lineTo(i, y); else g.moveTo(i, y);
    }
    g.stroke();
  });

  return (
    <section id="hero" className="hero" aria-labelledby="hero-heading">
      <div className="wrap">
        <div className="copy">
          <span className="tag">Integrated Hospital Management Platform</span>
          <h1 id="hero-heading">
            <span>One platform.</span>
            <span><em>Every department.</em></span>
            <span>Better coordinated care.</span>
          </h1>
          <p className="lead">
            We brings hospital administration, doctors, nurses, patients, reception, pharmacy, laboratory and billing
            into one integrated management platform. Organize everyday hospital operations and connect the workflows
            that support patient care.
          </p>
          <div className="acts">
            <Link to={STAFF_HREF} className="btn">Access Staff Portal <ArrowRight aria-hidden="true" /></Link>
            <Link to={PATIENT_HREF} className="btn o">Patient Login <UserRound aria-hidden="true" /></Link>
          </div>
          <div className="tk">
            <span><CheckCircle2 aria-hidden="true" />Eight dedicated workspaces</span>
            <span><CheckCircle2 aria-hidden="true" />Connected hospital workflows</span>
          </div>
        </div>

        <div className="readouts" aria-hidden="true">
          <div className="rd a">Heart rate<b>72 <small className="mono">bpm</small></b><canvas ref={ecg} width={300} height={68} /></div>
          <div className="rd b">SpO₂<b>98 <small className="mono">%</small></b></div>
          <div className="rd c">Temperature<b>36.8 <small className="mono">°C</small></b></div>
          <div className="rd d">Illustrative preview<b className="rd-note">Not live hospital data</b></div>
        </div>
      </div>
    </section>
  );
}
