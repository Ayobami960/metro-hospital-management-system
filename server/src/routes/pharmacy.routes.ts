import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  getDispenseLog,
  getDrugBatches,
  getInventory,
  getInventoryAlerts,
  getPharmacyDashboard,
  getPharmacyOrders,
  getPurchaseOrders,
  getVerifyOrder,
  patchInventoryItem,
  postAdjustment,
  postCancelPurchaseOrder,
  postDispenseOrder,
  postProcessOrder,
  postPurchaseOrder,
  postReadyOrder,
  postReceipt,
  postReceivePurchaseOrder,
  postShipPurchaseOrder,
  postSubmitPurchaseOrder,
} from "../controllers/pharmacy.controller.js";

export const pharmacyRouter = Router();

const idObject = z.object({ id: z.string().uuid() });
const drugParams = z.object({ drugId: z.string().uuid() });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* Orders */

pharmacyRouter.get("/pharmacy/orders", authenticate, getPharmacyOrders);
pharmacyRouter.post("/pharmacy/orders/:id/process", authenticate, validate({ params: idObject }), postProcessOrder);
pharmacyRouter.post("/pharmacy/orders/:id/ready", authenticate, validate({ params: idObject }), postReadyOrder);
pharmacyRouter.get("/pharmacy/orders/:id/verify", authenticate, validate({ params: idObject }), getVerifyOrder);
pharmacyRouter.post(
  "/pharmacy/orders/:id/dispense",
  authenticate,
  validate({
    params: idObject,
    body: z.object({
      checklist: z.object({
        patientIdVerified: z.boolean(),
        drugMatches: z.boolean(),
        doseCorrect: z.boolean(),
        counselingGiven: z.boolean(),
      }),
      quantityOverride: z.boolean().default(false),
      /** Required when a SEVERE/LIFE_THREATENING allergy matches a prescribed drug. */
      allergyOverride: z.boolean().default(false),
      overrideReason: z.string().max(300).optional(),
      note: z.string().max(1000).optional(),
    }),
  }),
  postDispenseOrder,
);
pharmacyRouter.get("/pharmacy/dispense-log", authenticate, getDispenseLog);
pharmacyRouter.get("/pharmacy/dashboard", authenticate, getPharmacyDashboard);

/* Inventory */

pharmacyRouter.get("/inventory", authenticate, getInventory);
pharmacyRouter.get("/inventory/alerts", authenticate, getInventoryAlerts);
pharmacyRouter.get("/inventory/:drugId/batches", authenticate, validate({ params: drugParams }), getDrugBatches);
pharmacyRouter.patch(
  "/inventory/:drugId",
  authenticate,
  validate({
    params: drugParams,
    body: z.object({
      reorderLevel: z.number().int().min(0).max(1_000_000),
      location: z.string().max(120).optional(),
    }),
  }),
  patchInventoryItem,
);
pharmacyRouter.post(
  "/inventory/receipts",
  authenticate,
  validate({
    body: z.object({
      drugId: z.string().uuid(),
      quantity: z.number().int().positive().max(1_000_000),
      batchNumber: z.string().trim().min(1).max(60),
      expiryDate: dateOnly,
      supplierId: z.string().uuid().optional(),
      unit: z.string().max(40).optional(),
      reorderLevel: z.number().int().min(0).optional(),
    }),
  }),
  postReceipt,
);
pharmacyRouter.post(
  "/inventory/adjustments",
  authenticate,
  validate({
    body: z.object({
      batchId: z.string().uuid(),
      delta: z.number().int().refine((n) => n !== 0, "delta must not be zero"),
      reason: z.enum(["ADJUSTMENT", "COUNT_CORRECTION", "EXPIRY", "RETURN", "TRANSFER"]),
      note: z.string().max(500).optional(),
    }),
  }),
  postAdjustment,
);

/* Purchase orders */

pharmacyRouter.get("/purchase-orders", authenticate, getPurchaseOrders);
pharmacyRouter.post(
  "/purchase-orders",
  authenticate,
  validate({
    body: z.object({
      supplierId: z.string().uuid(),
      expectedDeliveryAt: z.string().datetime().optional(),
      notes: z.string().max(1000).optional(),
      items: z
        .array(
          z.object({
            drugId: z.string().uuid(),
            quantity: z.number().int().positive(),
            unitCostMinor: z.number().int().min(0),
          }),
        )
        .min(1),
    }),
  }),
  postPurchaseOrder,
);
pharmacyRouter.post("/purchase-orders/:id/submit", authenticate, validate({ params: idObject }), postSubmitPurchaseOrder);
pharmacyRouter.post("/purchase-orders/:id/ship", authenticate, validate({ params: idObject }), postShipPurchaseOrder);
pharmacyRouter.post("/purchase-orders/:id/cancel", authenticate, validate({ params: idObject }), postCancelPurchaseOrder);
pharmacyRouter.post(
  "/purchase-orders/:id/receive",
  authenticate,
  validate({
    params: idObject,
    body: z.object({
      items: z
        .array(
          z.object({
            itemId: z.string().uuid(),
            quantityReceived: z.number().int().positive(),
            batchNumber: z.string().trim().min(1).max(60),
            expiryDate: dateOnly,
          }),
        )
        .min(1),
    }),
  }),
  postReceivePurchaseOrder,
);
