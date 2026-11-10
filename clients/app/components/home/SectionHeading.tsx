import type { ReactNode } from "react";

/** Two-column editorial heading: kicker + title on the left, supporting text on the right. */
export function SectionHeading({ eyebrow, title, description, id }: { eyebrow: string; title: ReactNode; description: string; id?: string }) {
  return (
    <div className="sh">
      <div data-reveal><div className="kick">{eyebrow}</div><h2 id={id}>{title}</h2></div>
      <p data-reveal>{description}</p>
    </div>
  );
}
