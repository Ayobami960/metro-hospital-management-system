import { env } from "./config/env.js";

const json = (schema: Record<string, unknown>) => ({ "application/json": { schema } });
const envelope = (data: Record<string, unknown>) => ({
  type: "object",
  properties: { data, meta: { type: ["object", "null"] } },
});
const errorEnvelope = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: {},
      },
    },
  },
};

const listMeta = {
  type: "object",
  properties: {
    page: { type: "integer" },
    pageSize: { type: "integer" },
    total: { type: "integer" },
    totalPages: { type: "integer" },
    hasMore: { type: "boolean" },
  },
};

const patient = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    mrn: { type: "string", example: "MRN-2026-001000" },
    name: { type: "string" },
    dateOfBirth: { type: "string", format: "date" },
    age: { type: "integer" },
    sexAtBirth: { type: "string" },
    status: { type: "string" },
  },
};

const listResponses = (item: Record<string, unknown>) => ({
  200: {
    description: "Paginated list",
    content: json({ type: "object", properties: { data: { type: "array", items: item }, meta: listMeta } }),
  },
  401: { description: "Unauthenticated", content: json(errorEnvelope) },
  403: { description: "Forbidden", content: json(errorEnvelope) },
});

/** Route table kept beside the handlers; docs/api.md narrates the same contract. */
export const openApiDocument = () => ({
  openapi: "3.1.0",
  info: {
    title: "Hospital Management System API",
    version: "1.0.0",
    description:
      "Single-hospital HMS backend. Envelope: { data, meta } / { error: { code, message, details } }. " +
      "Auth is better-auth (cookie session); RBAC and ownership scoping are enforced per route.",
  },
  servers: [{ url: `${env.betterAuthUrl}/api/v1` }],
  tags: [
    { name: "Health" },
    { name: "Identity" },
    { name: "Patients" },
    { name: "Reception" },
    { name: "Appointments" },
    { name: "Administration" },
    { name: "Nursing" },
    { name: "Pharmacy" },
    { name: "Laboratory" },
    { name: "Billing" },
    { name: "Clinical" },
    { name: "Files" },
    { name: "Exports" },
    { name: "Documents" },
  ],
  components: {
    securitySchemes: { session: { type: "apiKey", in: "cookie", name: "better-auth.session_token" } },
    schemas: { Patient: patient, Error: errorEnvelope },
  },
  paths: {
    "/health": {
      get: { tags: ["Health"], summary: "Liveness", responses: { 200: { description: "Process alive" } } },
    },
    "/health/ready": {
      get: {
        tags: ["Health"],
        summary: "Readiness (DB + migrations)",
        responses: { 200: { description: "Ready" }, 503: { description: "Not ready" } },
      },
    },
    "/me": {
      get: {
        tags: ["Identity"],
        summary: "Session user, nav allowlist and permissions",
        security: [{ session: [] }],
        responses: { 200: { description: "Current user" }, 401: { description: "Unauthenticated" } },
      },
    },
    "/patients": {
      get: {
        tags: ["Patients"],
        summary: "Master patient index",
        security: [{ session: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["createdAt", "lastName", "mrn", "dateOfBirth"] } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
        ],
        responses: listResponses(patient),
      },
      post: {
        tags: ["Patients"],
        summary: "Register a patient (server MRN, duplicate check, Idempotency-Key)",
        security: [{ session: [] }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["firstName", "lastName", "dateOfBirth"],
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              dateOfBirth: { type: "string", format: "date" },
              sexAtBirth: { type: "string" },
              bloodType: { type: "string" },
              phone: { type: "string" },
              email: { type: "string", format: "email" },
              ssnLast4: { type: "string", pattern: "^\\d{4}$" },
              allowDuplicate: { type: "boolean", default: false },
            },
          }),
        },
        responses: {
          201: { description: "Created", content: json(envelope(patient)) },
          409: { description: "DUPLICATE_PATIENT_SUSPECTED", content: json(errorEnvelope) },
        },
      },
    },
    "/patients/check-duplicates": {
      post: {
        tags: ["Patients"],
        summary: "Check name + DOB for an existing record",
        security: [{ session: [] }],
        responses: { 200: { description: "Candidate records" } },
      },
    },
    "/patients/{id}": {
      get: {
        tags: ["Patients"],
        summary: "Patient detail (writes a PHI access row)",
        security: [{ session: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Patient", content: json(envelope(patient)) },
          404: { description: "Not found or out of scope", content: json(errorEnvelope) },
        },
      },
    },
    "/patients/{id}/eligibility": {
      post: {
        tags: ["Patients"],
        summary: "Insurance eligibility from stored policy data",
        security: [{ session: [] }],
        responses: { 200: { description: "Eligibility result" } },
      },
    },
    "/queue": {
      get: {
        tags: ["Reception"],
        summary: "Live queue with computed positions and wait times",
        security: [{ session: [] }],
        responses: { 200: { description: "Queue" } },
      },
      post: {
        tags: ["Reception"],
        summary: "Add a patient to the queue",
        security: [{ session: [] }],
        responses: { 201: { description: "Ticket" } },
      },
    },
    "/queue/call-next": {
      post: {
        tags: ["Reception"],
        summary: "Atomically call the next waiting patient (FOR UPDATE SKIP LOCKED)",
        security: [{ session: [] }],
        responses: {
          200: { description: "Called entry" },
          412: { description: "Queue empty", content: json(errorEnvelope) },
        },
      },
    },
    "/appointments": {
      get: {
        tags: ["Appointments"],
        summary: "Appointment list scoped to the caller's role",
        security: [{ session: [] }],
        responses: listResponses({ type: "object" }),
      },
      post: {
        tags: ["Appointments"],
        summary: "Book an appointment (patient bookings are REQUESTED until approved)",
        security: [{ session: [] }],
        responses: {
          201: { description: "Booked" },
          409: { description: "SLOT_TAKEN", content: json(errorEnvelope) },
        },
      },
    },
    "/appointments/availability": {
      get: {
        tags: ["Appointments"],
        summary: "Free slots for a doctor on a date",
        security: [{ session: [] }],
        parameters: [
          { name: "doctorId", in: "query", required: true, schema: { type: "string", format: "uuid" } },
          { name: "date", in: "query", required: true, schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Slots" } },
      },
    },
    "/appointments/{id}/approve": {
      post: { tags: ["Appointments"], summary: "Approve a requested appointment", security: [{ session: [] }], responses: { 200: { description: "Approved" } } },
    },
    "/appointments/{id}/cancel": {
      post: { tags: ["Appointments"], summary: "Cancel (releases the slot)", security: [{ session: [] }], responses: { 200: { description: "Cancelled" } } },
    },
    "/departments": {
      get: {
        tags: ["Administration"],
        summary: "Departments with derived staff, bed and occupancy figures",
        security: [{ session: [] }],
        responses: listResponses({ type: "object" }),
      },
      post: {
        tags: ["Administration"],
        summary: "Create a department (reference:write)",
        security: [{ session: [] }],
        responses: {
          201: { description: "Created" },
          409: { description: "Duplicate name", content: json(errorEnvelope) },
        },
      },
    },
    "/departments/{id}": {
      get: {
        tags: ["Administration"],
        summary: "Department detail with doctors and rooms",
        security: [{ session: [] }],
        responses: { 200: { description: "Department" }, 404: { description: "Not found", content: json(errorEnvelope) } },
      },
      patch: {
        tags: ["Administration"],
        summary: "Update a department",
        security: [{ session: [] }],
        responses: { 200: { description: "Updated" } },
      },
    },
    "/specialties": {
      get: { tags: ["Administration"], summary: "Specialties with doctor counts", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
      post: { tags: ["Administration"], summary: "Create a specialty", security: [{ session: [] }], responses: { 201: { description: "Created" } } },
    },
    "/doctors": {
      get: {
        tags: ["Administration"],
        summary: "Doctor roster with derived panel size and initials",
        security: [{ session: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "specialtyId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "departmentId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "ON_LEAVE", "INACTIVE"] } },
        ],
        responses: listResponses({ type: "object" }),
      },
      post: {
        tags: ["Administration"],
        summary: "Create a doctor: invited staff account + clinical profile",
        security: [{ session: [] }],
        responses: {
          201: { description: "Created" },
          409: { description: "Email or licence already registered", content: json(errorEnvelope) },
        },
      },
    },
    "/doctors/{id}": {
      get: { tags: ["Administration"], summary: "Doctor profile and patient panel", security: [{ session: [] }], responses: { 200: { description: "Doctor" } } },
      patch: { tags: ["Administration"], summary: "Update profile or employment status", security: [{ session: [] }], responses: { 200: { description: "Updated" } } },
    },
    "/rooms": {
      get: {
        tags: ["Administration"],
        summary: "Rooms with derived bed counts, status and occupants",
        security: [{ session: [] }],
        parameters: [
          { name: "floor", in: "query", schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string" } },
          { name: "departmentId", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: listResponses({ type: "object" }),
      },
      post: { tags: ["Administration"], summary: "Create a room, optionally with its beds", security: [{ session: [] }], responses: { 201: { description: "Created" } } },
    },
    "/rooms/{id}": {
      get: { tags: ["Administration"], summary: "Room with individual beds and occupants", security: [{ session: [] }], responses: { 200: { description: "Room" } } },
      patch: { tags: ["Administration"], summary: "Update a room", security: [{ session: [] }], responses: { 200: { description: "Updated" } } },
    },
    "/rooms/{id}/beds": {
      post: { tags: ["Administration"], summary: "Add a bed to a room", security: [{ session: [] }], responses: { 201: { description: "Created" } } },
    },
    "/beds": {
      get: {
        tags: ["Administration"],
        summary: "Bed list with current occupant",
        security: [{ session: [] }],
        parameters: [
          { name: "roomId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "floor", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: listResponses({ type: "object" }),
      },
    },
    "/beds/{id}": {
      patch: {
        tags: ["Administration"],
        summary: "Change bed status (OCCUPIED is only reachable via assign)",
        security: [{ session: [] }],
        responses: { 200: { description: "Updated" }, 412: { description: "Open assignment", content: json(errorEnvelope) } },
      },
    },
    "/beds/{id}/assign": {
      post: {
        tags: ["Administration"],
        summary: "Assign a patient to a bed (row-locked, atomic)",
        security: [{ session: [] }],
        responses: { 201: { description: "Assigned" }, 412: { description: "Bed not available", content: json(errorEnvelope) } },
      },
    },
    "/beds/{id}/release": {
      post: {
        tags: ["Administration"],
        summary: "Release the current occupant; bed goes to CLEANING",
        security: [{ session: [] }],
        responses: { 200: { description: "Released" }, 404: { description: "No active occupant", content: json(errorEnvelope) } },
      },
    },

    "/nursing/assigned-patients": {
      get: { tags: ["Nursing"], summary: "Patients assigned to the signed-in nurse", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
    },
    "/vitals": {
      post: {
        tags: ["Nursing"],
        summary: "Record an append-only vitals observation",
        security: [{ session: [] }],
        responses: { 200: { description: "Vital" }, 422: { description: "Validation failed", content: json(errorEnvelope) } },
      },
    },
    "/vitals/{patientId}": {
      get: { tags: ["Nursing"], summary: "Vitals history, newest first", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
    },
    "/notes": {
      post: { tags: ["Nursing"], summary: "Create a draft clinical note", security: [{ session: [] }], responses: { 201: { description: "Created" } } },
    },
    "/notes/{patientId}": {
      get: { tags: ["Nursing"], summary: "Clinical notes for a patient", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
    },
    "/medications/{patientId}": {
      get: { tags: ["Nursing"], summary: "MAR entries with drug, dose, route", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
    },
    "/medications/{id}/administer": {
      post: {
        tags: ["Nursing"],
        summary: "Record a MAR administration (GIVEN/HELD/REFUSED/MISSED)",
        security: [{ session: [] }],
        responses: { 200: { description: "Updated" }, 409: { description: "Illegal transition", content: json(errorEnvelope) } },
      },
    },

    "/pharmacy/orders": {
      get: {
        tags: ["Pharmacy"],
        summary: "Dispensing queue with drug names, prescriber and interaction flag",
        security: [{ session: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "priority", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: listResponses({ type: "object" }),
      },
    },
    "/pharmacy/orders/{id}/process": {
      post: {
        tags: ["Pharmacy"],
        summary: "Claim an order (NEW to PROCESSING); 409 if already claimed",
        security: [{ session: [] }],
        responses: { 200: { description: "Updated" }, 409: { description: "Invalid transition", content: json(errorEnvelope) } },
      },
    },
    "/pharmacy/orders/{id}/ready": {
      post: { tags: ["Pharmacy"], summary: "Mark an order READY for collection", security: [{ session: [] }], responses: { 200: { description: "Updated" } } },
    },
    "/pharmacy/orders/{id}/verify": {
      get: {
        tags: ["Pharmacy"],
        summary: "Dispense pre-check: interactions, allergy conflicts, FEFO batches",
        security: [{ session: [] }],
        responses: { 200: { description: "Verification" } },
      },
    },
    "/pharmacy/orders/{id}/dispense": {
      post: {
        tags: ["Pharmacy"],
        summary: "Atomic dispense: FEFO decrement, stock ledger, dispense log, Rx status",
        security: [{ session: [] }],
        responses: {
          201: { description: "Dispensed" },
          409: { description: "INSUFFICIENT_STOCK", content: json(errorEnvelope) },
          412: { description: "Checklist incomplete", content: json(errorEnvelope) },
        },
      },
    },
    "/pharmacy/dispense-log": {
      get: { tags: ["Pharmacy"], summary: "Dispense history by patient, drug and pharmacist", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
    },
    "/inventory": {
      get: {
        tags: ["Pharmacy"],
        summary: "Stock on hand with derived status (OK/Low/Critical/Out of Stock)",
        security: [{ session: [] }],
        parameters: [
          { name: "derivedStatus", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
        ],
        responses: listResponses({ type: "object" }),
      },
    },
    "/inventory/alerts": {
      get: { tags: ["Pharmacy"], summary: "Out of stock, low stock, near-expiry and expired lists", security: [{ session: [] }], responses: { 200: { description: "Alerts" } } },
    },
    "/inventory/{drugId}/batches": {
      get: { tags: ["Pharmacy"], summary: "Batches for one drug, earliest expiry first", security: [{ session: [] }], responses: { 200: { description: "Batches" } } },
    },
    "/inventory/{drugId}": {
      patch: { tags: ["Pharmacy"], summary: "Update reorder level and location", security: [{ session: [] }], responses: { 200: { description: "Updated" } } },
    },
    "/inventory/receipts": {
      post: { tags: ["Pharmacy"], summary: "Receive stock into a batch (creates item if absent)", security: [{ session: [] }], responses: { 201: { description: "Received" } } },
    },
    "/inventory/adjustments": {
      post: {
        tags: ["Pharmacy"],
        summary: "Append a stock adjustment to the ledger; reason required",
        security: [{ session: [] }],
        responses: { 201: { description: "Adjusted" }, 412: { description: "Would go negative", content: json(errorEnvelope) } },
      },
    },
    "/purchase-orders": {
      get: { tags: ["Pharmacy"], summary: "Purchase orders with supplier and computed total", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
      post: { tags: ["Pharmacy"], summary: "Create a DRAFT purchase order with server-computed total", security: [{ session: [] }], responses: { 201: { description: "Created" } } },
    },
    "/purchase-orders/{id}/submit": {
      post: { tags: ["Pharmacy"], summary: "Submit a draft purchase order", security: [{ session: [] }], responses: { 200: { description: "Submitted" } } },
    },
    "/purchase-orders/{id}/ship": {
      post: { tags: ["Pharmacy"], summary: "Mark a submitted order as shipped", security: [{ session: [] }], responses: { 200: { description: "Shipped" } } },
    },
    "/purchase-orders/{id}/cancel": {
      post: { tags: ["Pharmacy"], summary: "Cancel an open purchase order", security: [{ session: [] }], responses: { 200: { description: "Cancelled" } } },
    },
    "/purchase-orders/{id}/receive": {
      post: {
        tags: ["Pharmacy"],
        summary: "Receive lines into batches; supports partial delivery",
        security: [{ session: [] }],
        responses: { 200: { description: "Received" }, 412: { description: "Over-receipt", content: json(errorEnvelope) } },
      },
    },
    "/pharmacy/dashboard": {
      get: { tags: ["Pharmacy"], summary: "Queue, stock alerts and seven-day dispense series", security: [{ session: [] }], responses: { 200: { description: "Dashboard" } } },
    },

    "/lab/orders": {
      get: {
        tags: ["Laboratory"],
        summary: "Lab orders with test names, specimen barcode and critical flag",
        security: [{ session: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "priority", in: "query", schema: { type: "string" } },
          { name: "patientId", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: listResponses({ type: "object" }),
      },
      post: { tags: ["Laboratory"], summary: "Order one or more tests for a patient", security: [{ session: [] }], responses: { 201: { description: "Created" } } },
    },
    "/lab/orders/{id}": {
      get: { tags: ["Laboratory"], summary: "Order with items, specimens, results and custody", security: [{ session: [] }], responses: { 200: { description: "Order" } } },
    },
    "/lab/orders/{id}/cancel": {
      post: { tags: ["Laboratory"], summary: "Cancel an order that has not been released", security: [{ session: [] }], responses: { 200: { description: "Cancelled" } } },
    },
    "/lab/orders/{id}/assign": {
      patch: { tags: ["Laboratory"], summary: "Assign the order's items to a technician", security: [{ session: [] }], responses: { 200: { description: "Assigned" } } },
    },
    "/lab/orders/{id}/specimens": {
      post: { tags: ["Laboratory"], summary: "Register a specimen (barcode auto-issued)", security: [{ session: [] }], responses: { 201: { description: "Created" } } },
    },
    "/lab/orders/{id}/results": {
      post: {
        tags: ["Laboratory"],
        summary: "Enter analyte values; flags and criticality are derived server-side",
        security: [{ session: [] }],
        responses: { 201: { description: "Results" }, 404: { description: "Analyte not on the ordered test", content: json(errorEnvelope) } },
      },
    },
    "/lab/orders/{id}/release": {
      post: {
        tags: ["Laboratory"],
        summary: "Sign and release results; blocked until critical values are acknowledged",
        security: [{ session: [] }],
        responses: {
          200: { description: "Released" },
          409: { description: "CRITICAL_VALUE_UNACKNOWLEDGED", content: json(errorEnvelope) },
          412: { description: "Results missing", content: json(errorEnvelope) },
        },
      },
    },
    "/lab/results": {
      get: {
        tags: ["Laboratory"],
        summary: "Results, released-only for patients, scoped for doctors",
        security: [{ session: [] }],
        parameters: [
          { name: "patientId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "critical", in: "query", schema: { type: "boolean" } },
          { name: "flag", in: "query", schema: { type: "string" } },
        ],
        responses: listResponses({ type: "object" }),
      },
    },
    "/lab/results/critical": {
      get: { tags: ["Laboratory"], summary: "Critical results with their notification state", security: [{ session: [] }], responses: { 200: { description: "Critical results" } } },
    },
    "/lab/results/{id}/amend": {
      post: { tags: ["Laboratory"], summary: "Amend a released result, versioned and audited", security: [{ session: [] }], responses: { 201: { description: "Amended" } } },
    },
    "/specimens": {
      get: { tags: ["Laboratory"], summary: "Specimen tracking list", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
    },
    "/specimens/lookup": {
      get: {
        tags: ["Laboratory"],
        summary: "Barcode lookup with custody chain",
        security: [{ session: [] }],
        parameters: [{ name: "barcode", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Specimen" }, 404: { description: "Unknown barcode", content: json(errorEnvelope) } },
      },
    },
    "/specimens/{id}/status": {
      patch: {
        tags: ["Laboratory"],
        summary: "Move a specimen along the legal custody chain; appends an event",
        security: [{ session: [] }],
        responses: { 200: { description: "Updated" }, 409: { description: "Illegal transition", content: json(errorEnvelope) } },
      },
    },
    "/specimens/{id}/custody": {
      get: { tags: ["Laboratory"], summary: "Append-only custody events", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
    },
    "/critical-notifications": {
      post: { tags: ["Laboratory"], summary: "Record that a physician was told about a critical value", security: [{ session: [] }], responses: { 201: { description: "Notified" } } },
    },
    "/critical-notifications/{id}/acknowledge": {
      post: { tags: ["Laboratory"], summary: "Physician acknowledgement of a critical value", security: [{ session: [] }], responses: { 200: { description: "Acknowledged" }, 409: { description: "Already acknowledged", content: json(errorEnvelope) } } },
    },
    "/patients/{id}/lab-results": {
      get: { tags: ["Laboratory"], summary: "Released results grouped into panels with trends", security: [{ session: [] }], responses: { 200: { description: "Panels" } } },
    },
    "/lab/dashboard": {
      get: { tags: ["Laboratory"], summary: "Pending, in-progress, completed and critical counts", security: [{ session: [] }], responses: { 200: { description: "Dashboard" } } },
    },

    "/invoices": {
      get: {
        tags: ["Billing"],
        summary: "Invoices with derived balance and overdue state",
        security: [{ session: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "patientId", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: listResponses({ type: "object" }),
      },
      post: { tags: ["Billing"], summary: "Create and issue an invoice with server-computed totals", security: [{ session: [] }], responses: { 201: { description: "Created" } } },
    },
    "/invoices/{id}": {
      get: { tags: ["Billing"], summary: "Invoice with items, allocations and claims", security: [{ session: [] }], responses: { 200: { description: "Invoice" } } },
    },
    "/invoices/{id}/void": {
      post: {
        tags: ["Billing"],
        summary: "Void an unpaid invoice",
        security: [{ session: [] }],
        responses: { 200: { description: "Voided" }, 412: { description: "Payments must be refunded first", content: json(errorEnvelope) } },
      },
    },
    "/payments": {
      get: { tags: ["Billing"], summary: "Payment ledger with allocated totals", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
      post: {
        tags: ["Billing"],
        summary: "Record a payment; allocates explicitly or FIFO across open invoices",
        security: [{ session: [] }],
        responses: { 201: { description: "Recorded" }, 412: { description: "Allocation exceeds balance", content: json(errorEnvelope) } },
      },
    },
    "/payments/{id}/refund": {
      post: { tags: ["Billing"], summary: "Refund as a negative ledger row and reverse allocations", security: [{ session: [] }], responses: { 201: { description: "Refunded" } } },
    },
    "/billing/outstanding": {
      get: { tags: ["Billing"], summary: "Outstanding invoices with ageing buckets", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
    },
    "/claims": {
      get: { tags: ["Billing"], summary: "Insurance claims", security: [{ session: [] }], responses: listResponses({ type: "object" }) },
      post: { tags: ["Billing"], summary: "Open a claim against an invoice", security: [{ session: [] }], responses: { 201: { description: "Created" }, 409: { description: "Open claim exists", content: json(errorEnvelope) } } },
    },
    "/claims/{id}": {
      patch: { tags: ["Billing"], summary: "Advance a claim; approval requires approvedMinor", security: [{ session: [] }], responses: { 200: { description: "Updated" }, 422: { description: "Missing decision fields", content: json(errorEnvelope) } } },
    },
    "/billing/dashboard": {
      get: { tags: ["Billing"], summary: "Collections, outstanding, claims and 30-day revenue", security: [{ session: [] }], responses: { 200: { description: "Dashboard" } } },
    },
    "/billing/reports": {
      get: {
        tags: ["Billing"],
        summary: "Revenue by day and method, claim outcomes, ageing",
        security: [{ session: [] }],
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: { 200: { description: "Report" }, 422: { description: "Bad range", content: json(errorEnvelope) } },
      },
    },

    "/patients/{id}/allergies": {
      get: {
        tags: ["Clinical"],
        summary: "Allergy list (active by default; includeInactive=true for retracted rows)",
        security: [{ session: [] }],
        responses: { 200: { description: "Allergies" }, 404: { description: "Out of scope" } },
      },
      post: {
        tags: ["Clinical"],
        summary: "Record an allergy; nurse/patient entries are stored unverified",
        security: [{ session: [] }],
        responses: { 201: { description: "Created" }, 404: { description: "Out of scope" } },
      },
    },
    "/patients/{id}/allergy-flag": {
      get: {
        tags: ["Clinical"],
        summary: "Reception-safe allergy flag (counts only, never the allergen)",
        security: [{ session: [] }],
        responses: { 200: { description: "Flag" }, 404: { description: "Patient not found" } },
      },
    },
    "/patients/{id}/allergies/{allergyId}": {
      patch: {
        tags: ["Clinical"],
        summary: "Edit or retract an allergy; deactivation requires a reason and appends history",
        security: [{ session: [] }],
        responses: { 200: { description: "Updated" }, 412: { description: "Reason required" } },
      },
    },
    "/patients/{id}/allergies/{allergyId}/verify": {
      post: {
        tags: ["Clinical"],
        summary: "Clinician verification (allergy:verify)",
        security: [{ session: [] }],
        responses: { 200: { description: "Verified" }, 403: { description: "Not a clinician" } },
      },
    },
    "/patients/{id}/allergies/no-known": {
      post: {
        tags: ["Clinical"],
        summary: "Set NKDA; 412 while an active allergy exists",
        security: [{ session: [] }],
        responses: { 200: { description: "Updated" }, 412: { description: "Active allergy present" } },
      },
    },
    "/patients/{id}/problems": {
      get: { tags: ["Clinical"], summary: "Problem list", security: [{ session: [] }], responses: { 200: { description: "Problems" } } },
      post: { tags: ["Clinical"], summary: "Create an ICD-10 coded problem", security: [{ session: [] }], responses: { 201: { description: "Created" }, 422: { description: "Unknown ICD-10 code" } } },
    },
    "/patients/{id}/problems/{problemId}": {
      patch: { tags: ["Clinical"], summary: "Update/monitor/resolve a problem", security: [{ session: [] }], responses: { 200: { description: "Updated" }, 412: { description: "Resolution reason required" } } },
    },
    "/patients/{id}/clinical-summary": {
      get: { tags: ["Clinical"], summary: "Allergies, problems, active meds, latest vitals, encounters", security: [{ session: [] }], responses: { 200: { description: "Summary" } } },
    },
    "/me/clinical-summary": {
      get: { tags: ["Clinical"], summary: "Patient's own clinical summary", security: [{ session: [] }], responses: { 200: { description: "Summary" } } },
    },
    "/prescriptions": {
      post: {
        tags: ["Clinical"],
        summary: "Prescribe; severe allergy conflicts require an audited override",
        security: [{ session: [] }],
        responses: { 201: { description: "Signed prescription + pharmacy order" }, 409: { description: "ALLERGY_CONFLICT" } },
      },
    },
    "/me/access-log": {
      get: { tags: ["Clinical"], summary: "Caller's PHI access log (patient: reads of their chart)", security: [{ session: [] }], responses: { 200: { description: "Access log" } } },
    },
    "/audit-logs": {
      get: { tags: ["Clinical"], summary: "Audit viewer (audit:read)", security: [{ session: [] }], responses: { 200: { description: "Audit rows" } } },
    },
    "/reference/allergens": {
      get: { tags: ["Clinical"], summary: "Curated allergen pick-list", security: [{ session: [] }], responses: { 200: { description: "Allergens" } } },
    },
    "/reference/icd10": {
      get: { tags: ["Clinical"], summary: "ICD-10 search", security: [{ session: [] }], responses: { 200: { description: "Codes" } } },
    },
    "/reference/drugs": {
      get: { tags: ["Clinical"], summary: "Drug picker", security: [{ session: [] }], responses: { 200: { description: "Drugs" } } },
    },

    "/files": {
      post: {
        tags: ["Files"],
        summary: "Multipart upload to Cloudinary (private, random UUID key)",
        security: [{ session: [] }],
        responses: { 201: { description: "File metadata" }, 422: { description: "Unsupported file type" } },
      },
    },
    "/files/{id}": {
      get: { tags: ["Files"], summary: "File metadata", security: [{ session: [] }], responses: { 200: { description: "File" }, 404: { description: "Out of scope" } } },
      delete: { tags: ["Files"], summary: "Soft-delete and destroy the provider object", security: [{ session: [] }], responses: { 200: { description: "Deleted" } } },
    },
    "/files/{id}/download": {
      get: { tags: ["Files"], summary: "302 to a short-lived signed URL", security: [{ session: [] }], responses: { 302: { description: "Redirect" }, 404: { description: "Out of scope" } } },
    },
    "/me/avatar": {
      post: { tags: ["Files"], summary: "Replace the caller's avatar (image only)", security: [{ session: [] }], responses: { 201: { description: "Avatar" }, 422: { description: "Not an image" } } },
      get: { tags: ["Files"], summary: "Current avatar metadata", security: [{ session: [] }], responses: { 200: { description: "Avatar" }, 404: { description: "None" } } },
    },
    "/patients/{id}/documents": {
      get: { tags: ["Files"], summary: "Patient documents (paginated, soft deletes excluded)", security: [{ session: [] }], responses: { 200: { description: "Documents" } } },
    },
    ...Object.fromEntries(
      ["patients", "appointments", "invoices", "lab-results", "audit-logs"].map((dataset) => [
        `/exports/${dataset}`,
        {
          get: {
            tags: ["Exports"],
            summary: `CSV/XLSX export of ${dataset}`,
            security: [{ session: [] }],
            parameters: [
              { name: "format", in: "query", schema: { type: "string", enum: ["csv", "xlsx"], default: "csv" } },
              { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
              { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
            ],
            responses: { 200: { description: "File download" }, 403: { description: "Missing permission" } },
          },
        },
      ]),
    ),
    "/documents/invoices/{id}.pdf": {
      get: { tags: ["Documents"], summary: "Invoice PDF", security: [{ session: [] }], responses: { 200: { description: "PDF" } } },
    },
    "/documents/lab-orders/{id}.pdf": {
      get: { tags: ["Documents"], summary: "Laboratory report PDF (patient copy is released-only)", security: [{ session: [] }], responses: { 200: { description: "PDF" }, 404: { description: "Not released / out of scope" } } },
    },
    "/documents/prescriptions/{id}.pdf": {
      get: { tags: ["Documents"], summary: "Prescription PDF", security: [{ session: [] }], responses: { 200: { description: "PDF" } } },
    },
    "/documents/patients/{id}/summary.pdf": {
      get: { tags: ["Documents"], summary: "Patient clinical summary PDF", security: [{ session: [] }], responses: { 200: { description: "PDF" } } },
    },
  },
});
