import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("room", "routes/room.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("login/verify", "routes/login-verify.tsx"),
  route("complete-profile", "routes/complete-profile.tsx"),
  route("activate-account", "routes/activate-account.tsx"),

  layout("routes/protected/layout.tsx", [
    // Administration
    route("administration/dashboard", "routes/protected/administration/AdminDashboard.tsx"),
    route("administration/doctors", "routes/protected/administration/DoctorsPage.tsx"),
    route("administration/patients", "routes/protected/administration/PatientsPage.tsx"),
    route("administration/departments", "routes/protected/administration/DepartmentsPage.tsx"),
    route("administration/appointments", "routes/protected/administration/AppointmentsPage.tsx"),
    route("administration/reports", "routes/protected/administration/ReportsPage.tsx"),
    route("administration/rooms-beds", "routes/protected/administration/RoomsBedsPage.tsx"),
    route("administration/system-logs", "routes/protected/administration/SystemLogsPage.tsx"),
    route("administration/settings", "routes/protected/administration/SettingsPage.tsx"),
    route("administration/users", "routes/protected/administration/UsersPage.tsx"),

    // Doctor
    route("doctor/dashboard", "routes/protected/doctor/DoctorDashboard.tsx"),
    route("doctor/appointments", "routes/protected/doctor/AppointmentsPage.tsx"),
    route("doctor/patients", "routes/protected/doctor/PatientsPage.tsx"),
    route("doctor/prescriptions", "routes/protected/doctor/PrescriptionsPage.tsx"),
    route("doctor/lab-orders", "routes/protected/doctor/LabOrdersPage.tsx"),
    route("doctor/emr", "routes/protected/doctor/EMRPage.tsx"),
    route("doctor/messages", "routes/protected/doctor/MessagesPage.tsx"),
    route("doctor/schedule", "routes/protected/doctor/SchedulePage.tsx"),
    route("doctor/analytics", "routes/protected/doctor/AnalyticsPage.tsx"),
    route("doctor/settings", "routes/protected/doctor/SettingsPage.tsx"),

    // Nurse
    route("nurse/dashboard", "routes/protected/nurse/NurseDashboard.tsx"),
    route("nurse/patients", "routes/protected/nurse/AssignedPatientsPage.tsx"),
    route("nurse/vitals", "routes/protected/nurse/VitalsEntryPage.tsx"),
    route("nurse/medications", "routes/protected/nurse/MedicationsPage.tsx"),
    route("nurse/notes", "routes/protected/nurse/ProgressNotesPage.tsx"),
    route("nurse/ward", "routes/protected/nurse/WardOverviewPage.tsx"),
    route("nurse/messages", "routes/protected/nurse/MessagesPage.tsx"),
    route("nurse/settings", "routes/protected/nurse/SettingsPage.tsx"),

    // Patient
    route("patient/dashboard", "routes/protected/patient/PatientDashboard.tsx"),
    route("patient/appointments", "routes/protected/patient/AppointmentsPage.tsx"),
    route("patient/records", "routes/protected/patient/MedicalRecordsPage.tsx"),
    route("patient/lab-results", "routes/protected/patient/LabResultsPage.tsx"),
    route("patient/prescriptions", "routes/protected/patient/PrescriptionsPage.tsx"),
    route("patient/bills", "routes/protected/patient/BillsPage.tsx"),
    route("patient/messages", "routes/protected/patient/MessagesPage.tsx"),
    route("patient/health-insights", "routes/protected/patient/HealthInsightsPage.tsx"),
    route("patient/settings", "routes/protected/patient/SettingsPage.tsx"),

    // Reception
    route("reception/dashboard", "routes/protected/reception/ReceptionDashboard.tsx"),
    route("reception/register", "routes/protected/reception/RegisterPatientPage.tsx"),
    route("reception/appointments", "routes/protected/reception/AppointmentsPage.tsx"),
    route("reception/queue", "routes/protected/reception/QueueManagerPage.tsx"),
    route("reception/check-in", "routes/protected/reception/CheckInPage.tsx"),
    route("reception/messages", "routes/protected/reception/MessagesPage.tsx"),
    route("reception/settings", "routes/protected/reception/SettingsPage.tsx"),

    // Pharmacy
    route("pharmacy/dashboard", "routes/protected/pharmacy/PharmacyDashboard.tsx"),
    route("pharmacy/prescriptions", "routes/protected/pharmacy/PrescriptionsPage.tsx"),
    route("pharmacy/inventory", "routes/protected/pharmacy/InventoryPage.tsx"),
    route("pharmacy/dispense", "routes/protected/pharmacy/DispensePage.tsx"),
    route("pharmacy/drug-orders", "routes/protected/pharmacy/DrugOrdersPage.tsx"),
    route("pharmacy/drug-interactions", "routes/protected/pharmacy/DrugInteractionsPage.tsx"),
    route("pharmacy/messages", "routes/protected/pharmacy/MessagesPage.tsx"),
    route("pharmacy/settings", "routes/protected/pharmacy/SettingsPage.tsx"),

    // Laboratory
    route("lab/dashboard", "routes/protected/lab/LabDashboard.tsx"),
    route("lab/test-requests", "routes/protected/lab/TestRequestsPage.tsx"),
    route("lab/results-entry", "routes/protected/lab/ResultsEntryPage.tsx"),
    route("lab/sample-tracking", "routes/protected/lab/SampleTrackingPage.tsx"),
    route("lab/equipment", "routes/protected/lab/EquipmentLogPage.tsx"),
    route("lab/radiology", "routes/protected/lab/RadiologyPage.tsx"),
    route("lab/messages", "routes/protected/lab/MessagesPage.tsx"),
    route("lab/settings", "routes/protected/lab/SettingsPage.tsx"),

    // Billing
    route("billing/dashboard", "routes/protected/billing/BillingDashboard.tsx"),
    route("billing/invoices", "routes/protected/billing/InvoicesPage.tsx"),
    route("billing/payments", "routes/protected/billing/PaymentsPage.tsx"),
    route("billing/insurance-claims", "routes/protected/billing/InsuranceClaimsPage.tsx"),
    route("billing/outstanding", "routes/protected/billing/OutstandingPage.tsx"),
    route("billing/reports", "routes/protected/billing/ReportsPage.tsx"),
    route("billing/messages", "routes/protected/billing/MessagesPage.tsx"),
    route("billing/settings", "routes/protected/billing/SettingsPage.tsx"),
  ]),
] satisfies RouteConfig;
