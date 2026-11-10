import { Link } from "react-router";
import { Dna } from "lucide-react";
import { PATIENT_HREF, STAFF_HREF, portals } from "./data";

export function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="wrap">
        <div className="foot2">
          <div>
            <Link to="/" className="logo"><i><Dna aria-hidden="true" /></i>MGH</Link>
            <p className="foot-blurb">An integrated hospital management platform designed to coordinate patient care, clinical services, departmental operations and hospital administration.</p>
          </div>
          <div>
            <h4>Platform</h4>
            <ul>
              <li><Link to={STAFF_HREF}>Staff Portal</Link></li>
              <li><Link to={PATIENT_HREF}>Patient Portal</Link></li>
              <li><Link to="/#portals">Department Workspaces</Link></li>
            </ul>
          </div>
          <div>
            <h4>Workspaces</h4>
            <ul className="two">{portals.map(({ label, href }) => <li key={label}><Link to={href}>{label}</Link></li>)}</ul>
          </div>
        </div>
        <div className="copy-r"><span>© {new Date().getFullYear()} {" "} Metro General Hospital </span><span>Designed to bring hospital operations together.</span></div>
      </div>
    </footer>
  );
}
