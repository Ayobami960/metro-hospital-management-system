import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  advanceOrder,
  createPurchaseOrder,
  dispenseOrder,
  inventoryAlerts,
  listDispenseLog,
  listDrugBatches,
  listInventory,
  listPharmacyOrders,
  listPurchaseOrders,
  pharmacyDashboard,
  receivePurchaseOrder,
  recordAdjustment,
  recordReceipt,
  transitionPurchaseOrder,
  updateInventorySettings,
  verifyOrder,
} from "../services/pharmacy.service.js";

const str = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);
const date = (value: unknown): Date | undefined =>
  typeof value === "string" && value && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : undefined;

/* Orders */

export const getPharmacyOrders = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const q = parseListQuery(req.query, ["receivedAt", "priority"], "receivedAt");
  const result = await listPharmacyOrders(actor, q, {
    status: str(req.query.status),
    priority: str(req.query.priority),
  });
  paginated(res, result.rows, result.total, q.page, q.pageSize);
});

export const postProcessOrder = handle(async (req: Request, res: Response) => {
  ok(res, await advanceOrder(currentActor(req), String(req.params.id), "PROCESSING", ["NEW"], req.ip));
});

export const postReadyOrder = handle(async (req: Request, res: Response) => {
  ok(res, await advanceOrder(currentActor(req), String(req.params.id), "READY", ["PROCESSING"], req.ip));
});

export const getVerifyOrder = handle(async (req: Request, res: Response) => {
  ok(res, await verifyOrder(currentActor(req), String(req.params.id), req.ip));
});

export const postDispenseOrder = handle(async (req: Request, res: Response) => {
  created(res, await dispenseOrder(currentActor(req), String(req.params.id), req.body, req.ip));
});

export const getDispenseLog = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const q = parseListQuery(req.query, ["dispensedAt"], "dispensedAt");
  const result = await listDispenseLog(actor, q, {
    from: date(req.query.from),
    to: date(req.query.to),
    pharmacistId: str(req.query.pharmacistId),
    patientId: str(req.query.patientId),
  });
  paginated(res, result.rows, result.total, q.page, q.pageSize);
});

/* Inventory */

export const getInventory = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const q = parseListQuery(req.query, ["name", "onHand"], "name");
  const result = await listInventory(actor, q, {
    category: str(req.query.category),
    derivedStatus: str(req.query.derivedStatus),
  });
  paginated(res, result.rows, result.total, q.page, q.pageSize);
});

export const getInventoryAlerts = handle(async (req: Request, res: Response) => {
  ok(res, await inventoryAlerts(currentActor(req)));
});

export const getDrugBatches = handle(async (req: Request, res: Response) => {
  ok(res, await listDrugBatches(currentActor(req), String(req.params.drugId)));
});

export const patchInventoryItem = handle(async (req: Request, res: Response) => {
  ok(res, await updateInventorySettings(currentActor(req), String(req.params.drugId), req.body, req.ip));
});

export const postReceipt = handle(async (req: Request, res: Response) => {
  created(res, await recordReceipt(currentActor(req), req.body, req.ip));
});

export const postAdjustment = handle(async (req: Request, res: Response) => {
  created(res, await recordAdjustment(currentActor(req), req.body, req.ip));
});

/* Purchase orders */

export const getPurchaseOrders = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const q = parseListQuery(req.query, ["orderedAt", "status"], "orderedAt");
  const result = await listPurchaseOrders(actor, q, {
    status: str(req.query.status),
    supplierId: str(req.query.supplierId),
  });
  paginated(res, result.rows, result.total, q.page, q.pageSize);
});

export const postPurchaseOrder = handle(async (req: Request, res: Response) => {
  created(res, await createPurchaseOrder(currentActor(req), req.body, req.ip));
});

export const postSubmitPurchaseOrder = handle(async (req: Request, res: Response) => {
  ok(
    res,
    await transitionPurchaseOrder(currentActor(req), String(req.params.id), "SUBMITTED", ["DRAFT"], "submit", req.ip),
  );
});

export const postShipPurchaseOrder = handle(async (req: Request, res: Response) => {
  ok(
    res,
    await transitionPurchaseOrder(currentActor(req), String(req.params.id), "SHIPPED", ["SUBMITTED"], "ship", req.ip),
  );
});

export const postCancelPurchaseOrder = handle(async (req: Request, res: Response) => {
  ok(
    res,
    await transitionPurchaseOrder(
      currentActor(req),
      String(req.params.id),
      "CANCELLED",
      ["DRAFT", "SUBMITTED", "SHIPPED", "PARTIALLY_RECEIVED"],
      "cancel",
      req.ip,
    ),
  );
});

export const postReceivePurchaseOrder = handle(async (req: Request, res: Response) => {
  ok(res, await receivePurchaseOrder(currentActor(req), String(req.params.id), req.body, req.ip));
});

/* Dashboard */

export const getPharmacyDashboard = handle(async (req: Request, res: Response) => {
  ok(res, await pharmacyDashboard(currentActor(req)));
});
