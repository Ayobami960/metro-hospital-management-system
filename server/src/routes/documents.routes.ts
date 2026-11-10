import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  getInvoiceDocument,
  getLabOrderDocument,
  getPatientSummaryDocument,
  getPrescriptionDocument,
} from "../controllers/documents.controller.js";

export const documentsRouter = Router();

documentsRouter.get("/documents/invoices/:id.pdf", authenticate, getInvoiceDocument);
documentsRouter.get("/documents/lab-orders/:id.pdf", authenticate, getLabOrderDocument);
documentsRouter.get("/documents/prescriptions/:id.pdf", authenticate, getPrescriptionDocument);
documentsRouter.get("/documents/patients/:id/summary.pdf", authenticate, getPatientSummaryDocument);
