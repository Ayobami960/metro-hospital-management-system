import type { CSSProperties } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { portals } from "./data";

export function DepartmentWorkspaces() {
  return (
    <section id="portals" aria-labelledby="portals-heading">
      <div className="wrap">
        <SectionHeading id="portals-heading" eyebrow="Department workspaces" title={<>Eight workspaces. <em>One</em> hospital platform.</>}
          description="Each user group has a dedicated workspace designed around its everyday responsibilities, information and departmental activities." />
        <ul className="spec">
          {portals.map(({ icon: Icon, label, description, href, hue }, i) => (
            <li key={label} data-reveal>
              <Link to={href} className="sp" style={{ "--h": hue } as CSSProperties}>
                <span className="code"><span>SPECIMEN {String(i + 1).padStart(2, "0")}</span><span>{label === "Patient" ? "Patient access" : "Staff workspace"}</span></span>
                <span className="ic"><Icon aria-hidden="true" /></span>
                <h3>{label}</h3>
                <p>{description}</p>
                <span className="go"><span>OPEN</span><ArrowRight aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
