/**
 * Every backend path the frontend calls, in one place.
 *
 * Paths mirror `server/src/routes/*.routes.ts`; the `/api/v1` prefix is applied
 * by the Axios client. Never hardcode a path in a component or hook.
 */
const id = (value: string) => encodeURIComponent(value);

export const API_ENDPOINTS = {
  health: "/health",
  me: "/me",

  auth: {
    session: "/auth/get-session",
    signIn: "/auth/sign-in/email",
    signUp: "/auth/sign-up/email",
    signOut: "/auth/sign-out",
  },

  /** Account-progress endpoints; reachable while a session is mid-challenge. */
  account: {
    status: "/account/status",
    verifyEmail: "/account/verification/email",
    resendEmailVerification: "/account/verification/email/resend",
    verifyPatientOtp: "/account/verification/patient-otp",
    resendPatientOtp: "/account/verification/patient-otp/resend",
    verifyTotp: "/account/verification/totp",
    verifyRecoveryCode: "/account/verification/recovery-code",
    enrollTotp: "/account/totp/enroll",
    confirmTotp: "/account/totp/enroll/confirm",
    disableTotp: "/account/totp/disable",
    regenerateRecoveryCodes: "/account/totp/recovery-codes",
    onboarding: "/account/onboarding",
    onboardingAvatar: "/account/onboarding/avatar",
    patientRegistration: "/account/patient-registration",
    patientProfileDraft: "/account/patient-profile/draft",
    documents: "/account/documents",
    document: (fileId: string) => `/account/documents/${id(fileId)}`,
  },

  /** Public Room Access verification for hospital staff (no login session). */
  roomAccess: {
    send: "/room-access/send",
    verify: "/room-access/verify",
    session: "/room-access/session",
  },

  staffUsers: {
    list: "/users",
    statistics: "/users/statistics",
    roles: "/users/roles",
    create: "/users",
    invite: "/users/invite",
    invitations: "/users/invitations",
    user: (userId: string) => `/users/${id(userId)}`,
    role: (userId: string) => `/users/${id(userId)}/role`,
    status: (userId: string) => `/users/${id(userId)}/status`,
    resendInvitation: (invitationId: string) => `/users/invitations/${id(invitationId)}/resend`,
    revokeInvitation: (invitationId: string) => `/users/invitations/${id(invitationId)}`,
  },

  invitations: {
    validate: (token: string) => `/invitations/${id(token)}`,
    accept: "/invitations/accept",
  },

  patients: {
    list: "/patients",
    create: "/patients",
    byId: (patientId: string) => `/patients/${id(patientId)}`,
    duplicates: "/patients/check-duplicates",
    eligibility: (patientId: string) => `/patients/${patientId}/eligibility`,
    timeline: (patientId: string) => `/patients/${patientId}/timeline`,
    labResults: (patientId: string) => `/patients/${patientId}/lab-results`,
    documents: (patientId: string) => `/patients/${patientId}/documents`,
    clinicalSummary: (patientId: string) => `/patients/${patientId}/clinical-summary`,
  },

  clinical: {
    allergies: (patientId: string) => `/patients/${patientId}/allergies`,
    allergy: (patientId: string, allergyId: string) =>
      `/patients/${patientId}/allergies/${allergyId}`,
    verifyAllergy: (patientId: string, allergyId: string) =>
      `/patients/${patientId}/allergies/${allergyId}/verify`,
    noKnownAllergies: (patientId: string) => `/patients/${patientId}/allergies/no-known`,
    allergyFlag: (patientId: string) => `/patients/${patientId}/allergy-flag`,
    problems: (patientId: string) => `/patients/${patientId}/problems`,
    problem: (patientId: string, problemId: string) =>
      `/patients/${patientId}/problems/${problemId}`,
    mySummary: "/me/clinical-summary",
    myAllergies: "/me/allergies",
    myProblems: "/me/problems",
    myAccessLog: "/me/access-log",
    auditLogs: "/audit-logs",
    allergens: "/reference/allergens",
    icd10: "/reference/icd10",
    drugsReference: "/reference/drugs",
    prescriptions: "/prescriptions",
    prescription: (prescriptionId: string) => `/prescriptions/${prescriptionId}`,
    cancelPrescription: (prescriptionId: string) => `/prescriptions/${prescriptionId}/cancel`,
    prescriptionMar: (prescriptionId: string) => `/prescriptions/${prescriptionId}/mar`,
    marBoard: "/mar",
    refills: "/refills",
    decideRefill: (refillId: string) => `/refills/${refillId}/decide`,
  },

  appointments: {
    list: "/appointments",
    create: "/appointments",
    availability: "/appointments/availability",
    approve: (appointmentId: string) => `/appointments/${appointmentId}/approve`,
    cancel: (appointmentId: string) => `/appointments/${appointmentId}/cancel`,
  },

  reception: {
    queue: "/queue",
    addToQueue: "/queue",
    callNext: "/queue/call-next",
    start: (queueId: string) => `/queue/${queueId}/start`,
    complete: (queueId: string) => `/queue/${queueId}/complete`,
    remove: (queueId: string) => `/queue/${queueId}/remove`,
  },

  administration: {
    departments: "/departments",
    department: (departmentId: string) => `/departments/${departmentId}`,
    specialties: "/specialties",
    doctors: "/doctors",
    doctor: (doctorId: string) => `/doctors/${doctorId}`,
    rooms: "/rooms",
    room: (roomId: string) => `/rooms/${roomId}`,
    roomBeds: (roomId: string) => `/rooms/${roomId}/beds`,
    beds: "/beds",
    bed: (bedId: string) => `/beds/${bedId}`,
    assignBed: (bedId: string) => `/beds/${bedId}/assign`,
    releaseBed: (bedId: string) => `/beds/${bedId}/release`,
    users: "/users",
    user: (userId: string) => `/users/${userId}`,
  },

  reference: {
    departments: "/reference/departments",
    specialties: "/reference/specialties",
    insurers: "/reference/insurers",
    insurancePlans: "/reference/insurance-plans",
    cpt: "/reference/cpt",
    drugs: "/drugs",
    drugInteractions: "/drugs/interactions",
    checkInteractions: "/drugs/interactions/check",
  },

  nursing: {
    assignedPatients: "/nursing/assigned-patients",
    vitals: "/vitals",
    patientVitals: (patientId: string) => `/vitals/${patientId}`,
    notes: "/notes",
    patientNotes: (patientId: string) => `/notes/${patientId}`,
    medications: (patientId: string) => `/medications/${patientId}`,
    administer: (medicationId: string) => `/medications/${medicationId}/administer`,
    wardOverview: "/ward/overview",
  },

  pharmacy: {
    orders: "/pharmacy/orders",
    process: (orderId: string) => `/pharmacy/orders/${orderId}/process`,
    ready: (orderId: string) => `/pharmacy/orders/${orderId}/ready`,
    verify: (orderId: string) => `/pharmacy/orders/${orderId}/verify`,
    dispense: (orderId: string) => `/pharmacy/orders/${orderId}/dispense`,
    dispenseLog: "/pharmacy/dispense-log",
    dashboard: "/pharmacy/dashboard",
    inventory: "/inventory",
    inventoryAlerts: "/inventory/alerts",
    batches: (drugId: string) => `/inventory/${drugId}/batches`,
    inventoryItem: (drugId: string) => `/inventory/${drugId}`,
    receipts: "/inventory/receipts",
    adjustments: "/inventory/adjustments",
    purchaseOrders: "/purchase-orders",
    submitPurchaseOrder: (orderId: string) => `/purchase-orders/${orderId}/submit`,
    shipPurchaseOrder: (orderId: string) => `/purchase-orders/${orderId}/ship`,
    cancelPurchaseOrder: (orderId: string) => `/purchase-orders/${orderId}/cancel`,
    receivePurchaseOrder: (orderId: string) => `/purchase-orders/${orderId}/receive`,
  },

  laboratory: {
    orders: "/lab/orders",
    order: (orderId: string) => `/lab/orders/${orderId}`,
    cancelOrder: (orderId: string) => `/lab/orders/${orderId}/cancel`,
    assignOrder: (orderId: string) => `/lab/orders/${orderId}/assign`,
    specimens: (orderId: string) => `/lab/orders/${orderId}/specimens`,
    results: (orderId: string) => `/lab/orders/${orderId}/results`,
    release: (orderId: string) => `/lab/orders/${orderId}/release`,
    allResults: "/lab/results",
    criticalResults: "/lab/results/critical",
    amendResult: (resultId: string) => `/lab/results/${resultId}/amend`,
    specimenList: "/specimens",
    specimenLookup: "/specimens/lookup",
    specimenStatus: (specimenId: string) => `/specimens/${specimenId}/status`,
    specimenCustody: (specimenId: string) => `/specimens/${specimenId}/custody`,
    tests: "/lab/tests",
    testRanges: (testId: string) => `/lab/tests/${testId}/ranges`,
    criticalNotification: "/critical-notifications",
    acknowledgeCritical: (notificationId: string) =>
      `/critical-notifications/${notificationId}/acknowledge`,
    dashboard: "/lab/dashboard",
  },

  diagnostics: {
    radiologyOrders: "/radiology/orders",
    radiologyStatus: (orderId: string) => `/radiology/orders/${orderId}/status`,
    radiologyReport: (orderId: string) => `/radiology/orders/${orderId}/report`,
    equipment: "/equipment",
    maintenance: "/equipment/maintenance",
    equipmentMaintenance: (equipmentId: string) => `/equipment/${equipmentId}/maintenance`,
    equipmentStatus: (equipmentId: string) => `/equipment/${equipmentId}/status`,
  },

  billing: {
    invoices: "/invoices",
    invoice: (invoiceId: string) => `/invoices/${invoiceId}`,
    voidInvoice: (invoiceId: string) => `/invoices/${invoiceId}/void`,
    payments: "/payments",
    refund: (paymentId: string) => `/payments/${paymentId}/refund`,
    outstanding: "/billing/outstanding",
    claims: "/claims",
    claim: (claimId: string) => `/claims/${claimId}`,
    dashboard: "/billing/dashboard",
    reports: "/billing/reports",
  },

  dashboards: {
    admin: "/dashboards/admin",
    doctor: "/dashboards/doctor",
    nurse: "/dashboards/nurse",
    patient: "/dashboards/patient",
    reception: "/dashboards/reception",
    operationsCounts: "/operations/counts",
    operationsHealth: "/operations/health",
  },

  messaging: {
    conversations: "/conversations",
    messages: (conversationId: string) => `/conversations/${conversationId}/messages`,
    directory: "/messages/directory",
    unread: "/messages/unread",
    notifications: "/notifications",
    readNotification: (notificationId: string) => `/notifications/${notificationId}/read`,
    readAllNotifications: "/notifications/read-all",
  },

  profile: {
    profile: "/me/profile",
    preferences: "/me/preferences",
    sessions: "/me/sessions",
    session: (sessionId: string) => `/me/sessions/${sessionId}`,
    hospital: "/settings/hospital",
    avatar: "/me/avatar",
  },

  files: {
    upload: "/files",
    byId: (fileId: string) => `/files/${fileId}`,
    download: (fileId: string) => `/files/${fileId}/download`,
    myDocuments: "/me/documents",
  },

  reports: {
    overview: "/reports/overview",
    financial: "/reports/financial",
    clinical: "/reports/clinical",
    operational: "/reports/operational",
    staff: "/reports/staff",
    catalogue: "/reports/catalogue",
    doctorAnalytics: "/reports/doctor-analytics",
  },

  scheduling: {
    doctors: "/schedule/doctors",
    board: "/schedule/board",
    availability: "/schedule/availability",
    timeOff: "/schedule/time-off",
    timeOffById: (entryId: string) => `/schedule/time-off/${entryId}`,
  },

  exports: (dataset: "patients" | "appointments" | "invoices" | "lab-results" | "audit-logs") =>
    `/exports/${dataset}`,

  documents: {
    invoice: (invoiceId: string) => `/documents/invoices/${invoiceId}.pdf`,
    labOrder: (orderId: string) => `/documents/lab-orders/${orderId}.pdf`,
    prescription: (prescriptionId: string) => `/documents/prescriptions/${prescriptionId}.pdf`,
    patientSummary: (patientId: string) => `/documents/patients/${patientId}/summary.pdf`,
  },
} as const;
