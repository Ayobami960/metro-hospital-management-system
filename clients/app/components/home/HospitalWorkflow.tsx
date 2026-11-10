import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, useReducedMotion } from "@/hooks/use-motion";
import { SectionHeading } from "./SectionHeading";
import { workflows } from "./data";

/** Five connected stages. A line fills as the section scrolls and each stage lights up when reached; hover/focus also selects a stage. */
export function HospitalWorkflow() {
  const reduced = useReducedMotion();
  const wf = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(reduced ? workflows.length - 1 : 0);

  useEffect(() => {
    const el = wf.current; if (!el) return;
    if (reduced) { el.style.setProperty("--p", "1"); setActive(workflows.length - 1); return; }
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el, start: "top 70%", end: "bottom 65%",
        onUpdate: (s) => { el.style.setProperty("--p", String(s.progress)); setActive(Math.min(workflows.length - 1, Math.floor(s.progress * workflows.length))); },
      });
    }, el);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section id="workflow" aria-labelledby="workflow-heading">
      <div className="wrap">
        <SectionHeading id="workflow-heading" eyebrow="Connected workflows" title={<>From registration to <em>coordinated care.</em></>}
          description="Hospital activities involve multiple departments. HOS organizes these responsibilities into a connected workflow that supports the patient journey." />
        <div className="wf" ref={wf}>
          <span className="wf-line" aria-hidden="true" />
          {workflows.map(({ number, icon: Icon, title, description }, i) => (
            <div className={`ws${i <= active ? " on" : ""}${i === active ? " cur" : ""}`} key={number} data-reveal tabIndex={0}
              onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}>
              <span className="orb"><Icon aria-hidden="true" /></span>
              <small>STEP {number}</small>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
