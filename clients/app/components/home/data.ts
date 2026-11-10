import {
  Activity, Bed, Building2, CalendarCheck, ChartNoAxesCombined, ClipboardList, Clock3, FileText, FlaskConical,
  HeartPulse, LayoutDashboard, Package, Pill, Receipt, ShieldCheck, Stethoscope, UserRound, Users, Wallet,
  type LucideIcon,
} from "lucide-react";

/** Single source for homepage content (preserved verbatim from the original home.tsx). */
export type Feature = { icon: LucideIcon; title: string; description: string };
export type Portal = { icon: LucideIcon; label: string; description: string; href: string; hue: number };
export type WorkflowStep = { number: string; icon: LucideIcon; title: string; description: string };

export const STAFF_HREF = "/room";
export const PATIENT_HREF = "/login?role=patient";

export const highlights: Feature[] = [
  { icon: CalendarCheck, title: "Appointments & admissions", description: "Coordinate appointment scheduling, patient check-in, admissions, queues and hospital bed assignments." },
  { icon: ClipboardList, title: "Electronic medical records", description: "Organize patient histories, clinical notes, diagnoses, allergies, medications and vital signs." },
  { icon: FlaskConical, title: "Laboratory & diagnostics", description: "Manage test requests, specimen tracking, laboratory processing, results entry and clinical reporting." },
  { icon: Pill, title: "Pharmacy management", description: "Coordinate prescriptions, medication dispensing, drug interactions and pharmaceutical inventory." },
  { icon: Receipt, title: "Billing & insurance", description: "Organize invoices, payments, insurance claims, outstanding balances and financial reporting." },
  { icon: ChartNoAxesCombined, title: "Analytics & reporting", description: "Present operational insights across hospital departments, clinical activities and financial operations." },
];

// `hue` stays inside the blue-violet range of the brand palette (no orange/green accents).
export const portals: Portal[] = [
  { icon: ShieldCheck, label: "Administration", description: "Hospital operations, staff, departments and reporting.", href: "/room", hue: 262 },
  { icon: Stethoscope, label: "Doctor", description: "Appointments, patient charts, diagnoses and prescriptions.", href: "/room", hue: 226 },
  { icon: HeartPulse, label: "Nurse", description: "Ward assignments, vital signs and medication administration.", href: "/room", hue: 280 },
  { icon: UserRound, label: "Patient", description: "Appointments, medical records, prescriptions and bills.", href: "/login?role=patient", hue: 208 },
  { icon: Users, label: "Reception", description: "Patient registration, appointments and queue management.", href: "/room", hue: 244 },
  { icon: Package, label: "Pharmacy", description: "Prescriptions, dispensing, drug inventory and orders.", href: "/room", hue: 270 },
  { icon: FlaskConical, label: "Laboratory", description: "Test requests, specimen tracking and laboratory results.", href: "/room", hue: 236 },
  { icon: Wallet, label: "Billing", description: "Invoices, payments, insurance claims and collections.", href: "/room", hue: 252 },
];

export const workflows: WorkflowStep[] = [
  { number: "01", icon: UserRound, title: "Patient registration", description: "Reception manages patient registration, demographic information, insurance details and appointment check-in." },
  { number: "02", icon: Stethoscope, title: "Clinical consultation", description: "Doctors review medical histories, record diagnoses, document clinical notes and issue prescriptions." },
  { number: "03", icon: FlaskConical, title: "Diagnostic services", description: "Laboratory teams process test requests, track samples and enter results for clinical review." },
  { number: "04", icon: Pill, title: "Treatment & medication", description: "Nurses coordinate patient care while pharmacy teams review prescriptions and manage medication dispensing." },
  { number: "05", icon: Receipt, title: "Billing & administration", description: "Billing teams manage invoices and claims while administrators oversee hospital operations and reporting." },
];

export const operationalFeatures: Feature[] = [
  { icon: Bed, title: "Rooms & bed management", description: "Organize hospital rooms, bed availability, occupancy, reservations and maintenance." },
  { icon: Activity, title: "Clinical monitoring", description: "Record vital signs, monitor patient conditions, document progress notes and identify clinical alerts." },
  { icon: FileText, title: "Medical documentation", description: "Organize prescriptions, laboratory reports, patient documents and electronic medical records." },
  { icon: Building2, title: "Department coordination", description: "Provide dedicated workspaces for hospital departments with workflows tailored to their responsibilities." },
  { icon: Clock3, title: "Appointment & queue tracking", description: "Coordinate patient scheduling, check-in, waiting lists and appointment status." },
  { icon: LayoutDashboard, title: "Hospital oversight", description: "Bring operational summaries, department activity, staff information and performance reporting together." },
];

export const platformPrinciples = [
  { title: "Role-based workspaces", description: "Each department has a dedicated interface organized around its responsibilities." },
  { title: "Connected patient information", description: "The platform is designed around a consistent patient identity across clinical and administrative workflows." },
  { title: "Coordinated workflows", description: "Appointments, clinical care, diagnostics, pharmacy and billing are represented as connected hospital processes." },
  { title: "Operational visibility", description: "Dashboards and reporting screens provide a structured overview of departmental activities." },
];

/** Illustrative preview values only — not live hospital data. */
export const previewGauges = [
  { label: "Patient care", detail: "Clinical records", value: 0.82 },
  { label: "Appointments", detail: "Scheduling", value: 0.68 },
  { label: "Laboratory", detail: "Diagnostic results", value: 0.9 },
];
export const coordination = [
  { label: "Reception", width: 100 }, { label: "Clinical services", width: 82 },
  { label: "Diagnostics", width: 68 }, { label: "Pharmacy & billing", width: 90 },
];
