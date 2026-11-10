import express, { type Express, type RequestHandler } from "express";
import { createRequire } from "node:module";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { env } from "./config/env.js";
import { NAV, permissionsFor } from "./config/permissions.js";
import { auth } from "./lib/auth.js";
import { checkDatabase, migrationState } from "./db/client.js";
import { authenticate, currentActor } from "./middleware/authenticate.js";
import { requestId } from "./middleware/request-id.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { UI_LABELS } from "./lib/labels.js";
import { ok } from "./lib/http.js";
import { initials } from "./lib/crypto.js";
import { patientsRouter } from "./routes/patients.routes.js";
import { receptionRouter } from "./routes/reception.routes.js";
import { appointmentsRouter } from "./routes/appointments.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { nursingRouter } from "./routes/nursing.routes.js";
import { pharmacyRouter } from "./routes/pharmacy.routes.js";
import { laboratoryRouter } from "./routes/laboratory.routes.js";
import { billingRouter } from "./routes/billing.routes.js";
import { clinicalRouter } from "./routes/clinical.routes.js";
import { filesRouter } from "./routes/files.routes.js";
import { exportsRouter } from "./routes/exports.routes.js";
import { documentsRouter } from "./routes/documents.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { messagingRouter } from "./routes/messaging.routes.js";
import { profileRouter } from "./routes/profile.routes.js";
import { reportRouter } from "./routes/report.routes.js";
import { prescribingRouter } from "./routes/prescribing.routes.js";
import { diagnosticsRouter } from "./routes/diagnostics.routes.js";
import { schedulingRouter } from "./routes/scheduling.routes.js";
import { directoryRouter } from "./routes/directory.routes.js";
import { accountRouter } from "./routes/account.routes.js";
import { usersRouter } from "./routes/users.routes.js";
import { invitationsRouter } from "./routes/invitations.routes.js";
import { roomAccessRouter } from "./routes/room-access.routes.js";
import { openApiDocument } from "./openapi.js";

const API = "/api/v1";
const helmet = createRequire(import.meta.url)("helmet") as (
  options: { crossOriginResourcePolicy: { policy: "cross-origin" } },
) => RequestHandler;

export const createApp = (): Express => {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxy);

  app.use(requestId);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: [env.frontendOrigin], credentials: true, methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] }));
  app.use(compression());

  // better-auth must receive the unparsed body.
  app.use(`${API}/auth`, toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use(
    rateLimit({
      windowMs: env.rateLimit.windowMs,
      max: env.rateLimit.max,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      skip: () => env.isTest,
    }),
  );

  app.get(`${API}/health`, (_req, res) => {
    ok(res, { status: "ok", uptimeSeconds: Math.round(process.uptime()), version: "1.0.0" });
  });

  app.get(`${API}/health/ready`, async (_req, res) => {
    const dbOk = await checkDatabase();
    const migrations = await migrationState();
    const ready = dbOk && migrations.applied > 0;
    res.status(ready ? 200 : 503).json({
      data: { ready, database: dbOk ? "ok" : "unreachable", migrations },
      meta: null,
    });
  });

  app.get(`${API}/meta/enums`, (_req, res) => {
    ok(res, { labels: UI_LABELS, roles: Object.keys(NAV) }, { timezone: env.clinicTimezone, currency: env.currency });
  });

  app.get(`${API}/openapi.json`, (_req, res) => {
    res.json(openApiDocument());
  });

  app.get(
    `${API}/me`,
    authenticate,
    (req, res) => {
      const actor = currentActor(req);
      ok(res, {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
        avatarInitials: initials(actor.name),
        subtitle: actor.role === "DOCTOR" ? "Physician" : actor.role === "PATIENT" ? `MRN account` : actor.role,
        nav: NAV[actor.role],
        permissions: permissionsFor(actor.role),
        patientId: actor.patientId,
        doctorId: actor.doctorId,
      });
    },
  );

  // Module routers declare prefix-free paths (`/patients`); the API prefix is
  // applied once, here. Mounting them at `/` would 404 every module route.
  app.use(API, roomAccessRouter);
  app.use(API, accountRouter);
  app.use(API, usersRouter);
  app.use(API, invitationsRouter);
  app.use(API, patientsRouter);
  app.use(API, clinicalRouter);
  app.use(API, filesRouter);
  app.use(API, exportsRouter);
  app.use(API, documentsRouter);
  app.use(API, receptionRouter);
  app.use(API, appointmentsRouter);
  app.use(API, adminRouter);
  app.use(API, nursingRouter);
  app.use(API, pharmacyRouter);
  app.use(API, laboratoryRouter);
  app.use(API, billingRouter);
  app.use(API, dashboardRouter);
  app.use(API, messagingRouter);
  app.use(API, profileRouter);
  app.use(API, reportRouter);
  app.use(API, prescribingRouter);
  app.use(API, diagnosticsRouter);
  app.use(API, schedulingRouter);
  app.use(API, directoryRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

export default createApp;
