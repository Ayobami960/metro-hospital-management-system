import { SectionHeading } from "./SectionHeading";
import { platformPrinciples } from "./data";

export function PlatformPrinciples() {
  return (
    <section id="principles" aria-labelledby="principles-heading">
      <div className="wrap">
        <SectionHeading id="principles-heading" eyebrow="Designed for coordination" title={<>A unified approach to <em>hospital management.</em></>}
          description="A shared platform structure helps organize departmental responsibilities and the information needed throughout hospital operations." />
        <div className="pr">
          {platformPrinciples.map(({ title, description }, i) => (
            <div key={title} data-reveal><span className="k">P/0{i + 1}</span><h3>{title}</h3><p>{description}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}
