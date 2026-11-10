import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { handle } from "../lib/http.js";
import {
  renderInvoicePdf,
  renderLabReportPdf,
  renderPatientSummaryPdf,
  renderPrescriptionPdf,
  type RenderedDocument,
} from "../services/documents.service.js";

/** Streams a rendered PDF back to the client. */
const sendPdf = (res: Response, document: RenderedDocument): void => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${document.fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(document.buffer);
};

export const getInvoiceDocument = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  sendPdf(res, await renderInvoicePdf(actor, String(req.params.id), req.ip));
});

export const getLabOrderDocument = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  sendPdf(res, await renderLabReportPdf(actor, String(req.params.id), req.ip));
});

export const getPrescriptionDocument = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  sendPdf(res, await renderPrescriptionPdf(actor, String(req.params.id), req.ip));
});

export const getPatientSummaryDocument = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  sendPdf(res, await renderPatientSummaryPdf(actor, String(req.params.id), req.ip));
});
