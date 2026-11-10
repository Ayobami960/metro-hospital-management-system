export type roles =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "PATIENT"
  | "RECEPTION"
  | "PHARMACY"
  | "LABORATORY"
  | "BILLING";

export type Page =
  | "landing"
  | "login"
  | "register"
  | "admin"
  | "doctor"
  | "nurse"
  | "patient"
  | "reception"
  | "pharmacy"
  | "lab"
  | "billing";

export interface NavProps {
  navigate: (page: Page, role?: roles) => void;
  dark: boolean;
  toggleDark: () => void;
}

export interface DashboardProps {
  navigate?: (page: Page, role?: roles) => void;
  activePage?: string;
}
