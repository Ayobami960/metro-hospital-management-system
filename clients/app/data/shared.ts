/**
 * Navigation, role metadata and staff-portal configuration shared by every
 * portal. This is the only static scaffolding left: it describes which screens
 * exist per role, so it cannot come from the API.
 */
import {
  Activity,
  AlertCircle,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  HeartPulse,
  Home,
  LayoutDashboard,
  MessageSquare,
  Pill,
  Receipt,
  Settings,
  Stethoscope,
  TrendingUp,
  UserCircle,
  Users,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { roles } from "@/types";

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 | */
/* -------------------------------------------------------------------------- */

export interface NavItemType {
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: number;
  allowedRoles: roles[];
  items?: {
    title: string;
    url: string;
    allowedRoles?: roles[];
    isActive?: boolean;
  }[];
}

const navData: {
  patientNav: NavItemType[];
  doctorNav: NavItemType[];
  nurseNav: NavItemType[];
  receptionNav: NavItemType[];
  pharmacyNav: NavItemType[];
  labNav: NavItemType[];
  billingNav: NavItemType[];
  adminNav: NavItemType[];
} = {
  patientNav: [
    { title: "Dashboard", url: "/patient/dashboard", icon: LayoutDashboard, allowedRoles: ["PATIENT"] },
    { title: "Appointments", url: "/patient/appointments", icon: Calendar, allowedRoles: ["PATIENT"] },
    { title: "Medical Records", url: "/patient/records", icon: FileText, allowedRoles: ["PATIENT"] },
    { title: "Lab Results", url: "/patient/lab-results", icon: FlaskConical, allowedRoles: ["PATIENT"] },
    { title: "Prescriptions", url: "/patient/prescriptions", icon: Pill, allowedRoles: ["PATIENT"] },
    { title: "Bills & Payments", url: "/patient/bills", icon: CreditCard, allowedRoles: ["PATIENT"] },
    { title: "Messages", url: "/patient/messages", icon: MessageSquare, allowedRoles: ["PATIENT"] },
    { title: "Health Insights", url: "/patient/health-insights", icon: Activity, allowedRoles: ["PATIENT"] },
    { title: "Settings", url: "/patient/settings", icon: Settings, allowedRoles: ["PATIENT"] },
  ],
  doctorNav: [
    { title: "Dashboard", url: "/doctor/dashboard", icon: LayoutDashboard, allowedRoles: ["DOCTOR"] },
    { title: "Appointments", url: "/doctor/appointments", icon: Calendar, allowedRoles: ["DOCTOR"] },
    { title: "My Patients", url: "/doctor/patients", icon: Users, allowedRoles: ["DOCTOR"] },
    { title: "Prescriptions", url: "/doctor/prescriptions", icon: Pill, allowedRoles: ["DOCTOR"] },
    { title: "Lab Orders", url: "/doctor/lab-orders", icon: FlaskConical, allowedRoles: ["DOCTOR"] },
    { title: "EMR / Records", url: "/doctor/emr", icon: FileText, allowedRoles: ["DOCTOR"] },
    { title: "Messages", url: "/doctor/messages", icon: MessageSquare, allowedRoles: ["DOCTOR"] },
    { title: "Schedule", url: "/doctor/schedule", icon: Calendar, allowedRoles: ["DOCTOR"] },
    { title: "Analytics", url: "/doctor/analytics", icon: TrendingUp, allowedRoles: ["DOCTOR"] },
    { title: "Settings", url: "/doctor/settings", icon: Settings, allowedRoles: ["DOCTOR"] },
  ],
  nurseNav: [
    { title: "Dashboard", url: "/nurse/dashboard", icon: LayoutDashboard, allowedRoles: ["NURSE"] },
    { title: "Assigned Patients", url: "/nurse/patients", icon: Users, allowedRoles: ["NURSE"] },
    { title: "Vitals Entry", url: "/nurse/vitals", icon: Activity, allowedRoles: ["NURSE"] },
    { title: "Medications", url: "/nurse/medications", icon: Pill, allowedRoles: ["NURSE"] },
    { title: "Progress Notes", url: "/nurse/notes", icon: ClipboardList, allowedRoles: ["NURSE"] },
    { title: "Ward Overview", url: "/nurse/ward", icon: Home, allowedRoles: ["NURSE"] },
    { title: "Messages", url: "/nurse/messages", icon: MessageSquare, allowedRoles: ["NURSE"] },
    { title: "Settings", url: "/nurse/settings", icon: Settings, allowedRoles: ["NURSE"] },
  ],
  receptionNav: [
    { title: "Dashboard", url: "/reception/dashboard", icon: LayoutDashboard, allowedRoles: ["RECEPTION"] },
    { title: "Register Patient", url: "/reception/register", icon: UserCircle, allowedRoles: ["RECEPTION"] },
    { title: "Appointments", url: "/reception/appointments", icon: Calendar, allowedRoles: ["RECEPTION"] },
    { title: "Queue Manager", url: "/reception/queue", icon: ClipboardList, allowedRoles: ["RECEPTION"] },
    { title: "Check-In", url: "/reception/check-in", icon: Activity, allowedRoles: ["RECEPTION"] },
    { title: "Messages", url: "/reception/messages", icon: MessageSquare, allowedRoles: ["RECEPTION"] },
    { title: "Settings", url: "/reception/settings", icon: Settings, allowedRoles: ["RECEPTION"] },
  ],
  pharmacyNav: [
    { title: "Dashboard", url: "/pharmacy/dashboard", icon: LayoutDashboard, allowedRoles: ["PHARMACY"] },
    { title: "Prescriptions", url: "/pharmacy/prescriptions", icon: Pill, allowedRoles: ["PHARMACY"] },
    { title: "Inventory", url: "/pharmacy/inventory", icon: Activity, allowedRoles: ["PHARMACY"] },
    { title: "Dispense", url: "/pharmacy/dispense", icon: Activity, allowedRoles: ["PHARMACY"] },
    { title: "Drug Orders", url: "/pharmacy/drug-orders", icon: ClipboardList, allowedRoles: ["PHARMACY"] },
    { title: "Drug Interactions", url: "/pharmacy/drug-interactions", icon: AlertCircle, allowedRoles: ["PHARMACY"] },
    { title: "Messages", url: "/pharmacy/messages", icon: MessageSquare, allowedRoles: ["PHARMACY"] },
    { title: "Settings", url: "/pharmacy/settings", icon: Settings, allowedRoles: ["PHARMACY"] },
  ],
  labNav: [
    { title: "Dashboard", url: "/lab/dashboard", icon: LayoutDashboard, allowedRoles: ["LABORATORY"] },
    { title: "Test Requests", url: "/lab/test-requests", icon: FlaskConical, allowedRoles: ["LABORATORY"] },
    { title: "Results Entry", url: "/lab/results-entry", icon: FileText, allowedRoles: ["LABORATORY"] },
    { title: "Sample Tracking", url: "/lab/sample-tracking", icon: Activity, allowedRoles: ["LABORATORY"] },
    { title: "Equipment Log", url: "/lab/equipment", icon: Settings, allowedRoles: ["LABORATORY"] },
    { title: "Radiology", url: "/lab/radiology", icon: Activity, allowedRoles: ["LABORATORY"] },
    { title: "Messages", url: "/lab/messages", icon: MessageSquare, allowedRoles: ["LABORATORY"] },
    { title: "Settings", url: "/lab/settings", icon: Settings, allowedRoles: ["LABORATORY"] },
  ],
  billingNav: [
    { title: "Dashboard", url: "/billing/dashboard", icon: LayoutDashboard, allowedRoles: ["BILLING"] },
    { title: "Invoices", url: "/billing/invoices", icon: CreditCard, allowedRoles: ["BILLING"] },
    { title: "Payments", url: "/billing/payments", icon: TrendingUp, allowedRoles: ["BILLING"] },
    { title: "Insurance Claims", url: "/billing/insurance-claims", icon: FileText, allowedRoles: ["BILLING"] },
    { title: "Outstanding", url: "/billing/outstanding", icon: AlertCircle, allowedRoles: ["BILLING"] },
    { title: "Reports", url: "/billing/reports", icon: TrendingUp, allowedRoles: ["BILLING"] },
    { title: "Messages", url: "/billing/messages", icon: MessageSquare, allowedRoles: ["BILLING"] },
    { title: "Settings", url: "/billing/settings", icon: Settings, allowedRoles: ["BILLING"] },
  ],
  adminNav: [
    { title: "Dashboard", url: "/administration/dashboard", icon: LayoutDashboard, allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
    { title: "Doctors", url: "/administration/doctors", icon: Stethoscope, allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
    { title: "Patients", url: "/administration/patients", icon: Users, allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
    { title: "Departments", url: "/administration/departments", icon: Home, allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
    { title: "Appointments", url: "/administration/appointments", icon: Calendar, allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
    { title: "Billing & Finance", url: "/administration/billing", icon: CreditCard, allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
    { title: "Rooms & Beds", url: "/administration/rooms-beds", icon: Activity, allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
    { title: "Reports", url: "/administration/reports", icon: TrendingUp, allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
    { title: "System Logs", url: "/administration/system-logs", icon: FileText, allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
    { title: "Settings", url: "/administration/settings", icon: Settings, allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
  ],
};

export function getNavForRole(role: roles): NavItemType[] {
  switch (role) {
    case "PATIENT": return navData.patientNav;
    case "DOCTOR": return navData.doctorNav;
    case "NURSE": return navData.nurseNav;
    case "RECEPTION": return navData.receptionNav;
    case "PHARMACY": return navData.pharmacyNav;
    case "LABORATORY": return navData.labNav;
    case "BILLING": return navData.billingNav;
    case "SUPER_ADMIN":
    case "ADMIN": return navData.adminNav;
    default: return navData.adminNav;
  }
}

/* -------------------------------------------------------------------------- */
/* Roles                                                                      | */
/* -------------------------------------------------------------------------- */

export const roleColors: Record<roles, string> = {
  PATIENT: "#2563eb",
  DOCTOR: "#7c3aed",
  NURSE: "#0891b2",
  RECEPTION: "#ea580c",
  PHARMACY: "#16a34a",
  LABORATORY: "#0891b2",
  BILLING: "#d97706",
  SUPER_ADMIN: "#dc2626",
  ADMIN: "#dc2626",
};

export const roleLabels: Record<roles, string> = {
  PATIENT: "Patient Portal",
  DOCTOR: "Doctor Portal",
  NURSE: "Nurse Station",
  RECEPTION: "Reception Desk",
  PHARMACY: "Pharmacy",
  LABORATORY: "Laboratory",
  BILLING: "Billing Office",
  SUPER_ADMIN: "Administration",
  ADMIN: "Administration",
};

/** First screen each role lands on after signing in. */
export const roleHomeRoutes: Record<roles, string> = {
  PATIENT: "/patient/dashboard",
  DOCTOR: "/doctor/dashboard",
  NURSE: "/nurse/dashboard",
  RECEPTION: "/reception/dashboard",
  PHARMACY: "/pharmacy/dashboard",
  LABORATORY: "/lab/dashboard",
  BILLING: "/billing/dashboard",
  SUPER_ADMIN: "/administration/dashboard",
  ADMIN: "/administration/dashboard",
};

export function getRoleHomeRoute(role: roles): string {
  return roleHomeRoutes[role] ?? roleHomeRoutes.ADMIN;
}

/* -------------------------------------------------------------------------- */
/* Staff portals (the /room entry page and the ?role= query on /login)         | */
/* -------------------------------------------------------------------------- */

export type StaffPortalSlug =
  | "administration"
  | "doctor"
  | "nurse"
  | "billing"
  | "reception"
  | "pharmacy"
  | "lab";

export interface StaffPortal {
  /** Value used in the `/login?role=` query string. */
  slug: StaffPortalSlug;
  /** Role from @/types that the portal signs in as. */
  role: roles;
  /** Role name shown on the card. */
  name: string;
  /** Portal label, reused from the nav data so login headings match the portals. */
  label: string;
  /** Accent colour, reused from the nav data. */
  color: string;
  description: string;
  icon: LucideIcon;
}

const staffPortalSeed: {
  slug: StaffPortalSlug;
  role: roles;
  name: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    slug: "administration",
    role: "ADMIN",
    name: "Administration",
    description: "Hospital-wide operations, staff rosters and reporting.",
    icon: ShieldCheck,
  },
  {
    slug: "doctor",
    role: "DOCTOR",
    name: "Doctor",
    description: "Your clinic day, patient records and prescriptions.",
    icon: Stethoscope,
  },
  {
    slug: "nurse",
    role: "NURSE",
    name: "Nurse",
    description: "Ward assignments, vitals and medication rounds.",
    icon: HeartPulse,
  },
  {
    slug: "billing",
    role: "BILLING",
    name: "Billing",
    description: "Invoices, payments, insurance claims and balances.",
    icon: Receipt,
  },
  {
    slug: "reception",
    role: "RECEPTION",
    name: "Reception",
    description: "Registration, appointments and the front-desk queue.",
    icon: UserCircle,
  },
  {
    slug: "pharmacy",
    role: "PHARMACY",
    name: "Pharmacy",
    description: "Prescription queue, dispensing and stock levels.",
    icon: Pill,
  },
  {
    slug: "lab",
    role: "LABORATORY",
    name: "Lab",
    description: "Test requests, sample tracking and result entry.",
    icon: FlaskConical,
  },
];

/** Staff roles in the order they are presented on `/room`. Patients are excluded. */
export const staffPortals: StaffPortal[] = staffPortalSeed.map((portal) => ({
  ...portal,
  label: roleLabels[portal.role],
  color: roleColors[portal.role],
}));

export const roleSlugToRole: Record<StaffPortalSlug, roles> = staffPortals.reduce(
  (acc, portal) => ({ ...acc, [portal.slug]: portal.role }),
  {} as Record<StaffPortalSlug, roles>
);

export function isStaffPortalSlug(value: string | null | undefined): value is StaffPortalSlug {
  return !!value && value in roleSlugToRole;
}

export function getStaffPortal(slug: string | null | undefined): StaffPortal | undefined {
  return staffPortals.find((portal) => portal.slug === slug);
}

/** Builds the login URL a portal card should link to. */
export function getPortalLoginPath(slug: StaffPortalSlug): string {
  return `/login?role=${slug}`;
}

export const loginPath = {
  patient: "/login?role=patient",
};

/** Props every portal settings screen accepts from the shell. */
export interface SettingsPageProps {
  role?: string;
  name?: string;
  email?: string;
  specialty?: string;
}
