import { SectionHeading } from "./SectionHeading";
import { highlights } from "./data";

export function PlatformOverview() {
  return (
    <section id="platform" aria-labelledby="platform-heading">
      <div className="wrap">
        <SectionHeading id="platform-heading" eyebrow="The HOS Platform" title={<>Everything your hospital needs, <em>in one place.</em></>}
          description="A hospital management platform designed to bring essential clinical, administrative and operational activities into a coordinated digital environment." />
        <div className="cap">
          {highlights.map(({ icon: Icon, title, description }, i) => (
            <article className="cell" key={title} data-reveal>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <div className="fig"><Icon strokeWidth={1.15} aria-hidden="true" /></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
