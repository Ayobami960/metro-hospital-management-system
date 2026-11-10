import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { PATIENT_HREF, STAFF_HREF } from "./data";

export function FinalCTA() {
  return (
    <section className="cta" aria-labelledby="cta-heading">
      <div className="wrap">
        <div className="cb" data-reveal>
          <h2 id="cta-heading">Everything starts with a connected hospital.</h2>
          <p>Access the MGH platform through your designated workspace and explore the tools designed for your hospital responsibilities.</p>
          <div className="acts">
            <Link to={STAFF_HREF} className="btn">Enter Staff Portal <ArrowRight aria-hidden="true" /></Link>
            <Link to={PATIENT_HREF} className="btn o">Patient Login</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
