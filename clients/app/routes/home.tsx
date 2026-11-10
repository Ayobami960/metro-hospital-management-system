import { Suspense, lazy, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import type { Route } from "./+types/home";


import { HeroSection } from "@/components/home/HeroSection";
import { PlatformOverview } from "@/components/home/PlatformOverview";
import { DepartmentWorkspaces } from "@/components/home/DepartmentWorkspaces";
import { DiagnosticsPreview } from "@/components/home/DiagnosticsPreview";
import { HospitalOperations } from "@/components/home/HospitalOperations";
import { HospitalWorkflow } from "@/components/home/HospitalWorkflow";
import { PlatformPrinciples } from "@/components/home/PlatformPrinciples";
import { FinalCTA } from "@/components/home/FinalCTA";
import { HomeFooter } from "@/components/home/Footer";
import { Navbar } from "@/components/home/Navbar";
import { useReveal } from "@/hooks/use-motion";


const MedicalScienceScene = lazy(() => import("@/components/home/MedicalScienceScene").then((m) => ({ default: m.MedicalScienceScene })));

export function meta({}: Route.MetaArgs) {
  return [
    { title: "HOS — Hospital Management System" },
    {
      name: "description",
      content:
        "HOS is an integrated hospital management platform connecting administration, doctors, nurses, patients, reception, pharmacy, laboratory and billing through one coordinated system.",
    },
  ];
}

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  useReveal(root);

  // Router links such as /#portals should scroll to their section.
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 80);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <div className="hos-home" ref={root}>
      <div className="gridbg" aria-hidden="true" />
      <Suspense fallback={null}><MedicalScienceScene /></Suspense>
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <PlatformOverview />
        <DepartmentWorkspaces />
        <DiagnosticsPreview />
        <HospitalOperations />
        <HospitalWorkflow />
        <PlatformPrinciples />
        <FinalCTA />
      </main>
      <HomeFooter />
    </div>
  );
}
