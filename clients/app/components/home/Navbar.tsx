import { Link } from "react-router";
import { Dna } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className=" flex h-20 w-full  items-center gap-4 px-4! lg:px-16!">
       
          <Link to="/" className="logo"><i><Dna aria-hidden="true" /></i>MGH</Link>
        
      

        <nav aria-label="Account" className="ml-auto flex items-center gap-2">
          <Link
            to="/login?role=patient"
            className="btn o"
          >
            Patient Login
          </Link>
          <Link
            to="/room"
            className="btn"
          >
            Room
          </Link>
        </nav>
      </div>
    </header>
  );
}
