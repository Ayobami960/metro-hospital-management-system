import { Suspense, lazy } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
const FloatingMedicalObjects = lazy(() => import("./FloatingMedicalObjects").then((m) => ({ default: m.FloatingMedicalObjects })));
import { STAFF_HREF, operationalFeatures } from "./data";

export function HospitalOperations() {
  return (
    <section id="operations" aria-labelledby="operations-heading">
      <div className="wrap ops">
        <div data-reveal>
          <div className="kick">Hospital operations</div>
          <h2 id="operations-heading">Beyond records. <em>Complete</em> visibility.</h2>
          <p className="lead">
            HOS brings together the administrative and operational processes that support a functioning hospital. From
            managing rooms and hospital departments to monitoring clinical activities and financial operations, each area
            has a dedicated workspace.
          </p>
          <Link to={STAFF_HREF} className="link">Explore staff workspaces <ArrowRight aria-hidden="true" /></Link>
          <Suspense fallback={<div className="ops-stage" aria-hidden="true" />}><FloatingMedicalObjects /></Suspense>
        </div>
        <div className="og">
          {operationalFeatures.map(({ icon: Icon, title, description }) => (
            <div key={title} data-reveal><Icon aria-hidden="true" /><h3>{title}</h3><p>{description}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}
