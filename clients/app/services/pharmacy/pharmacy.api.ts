import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { ListParams, Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/pharmacy.service.ts`. */

export type PharmacyOrderStatus = "NEW" | "PROCESSING" | "READY" | "DISPENSED" | "CANCELLED";
export type Priority = "ROUTINE" | "URGENT" | "STAT";
export type StockStatus = "OK" | "Low" | "Critical" | "Out of Stock";

export interface PharmacyOrder {
  id: string;
  prescriptionId: string;
  patientId: string;
  patientName: string;
  mrn: string;
  prescriber: string | null;
  priority: Priority;
  status: PharmacyOrderStatus;
  receivedAt: string;
  readyAt: string | null;
  dispensedAt: string | null;
  notes: string | null;
  itemCount: number;
  drugNames: string[];
  hasInteractions: boolean;
}

export interface InventoryItem {
  id: string;
  drugId: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  form: string | null;
  category: string | null;
  ndc: string | null;
  unit: string | null;
  reorderLevel: number;
  location: string | null;
  onHand: number;
  nearestExpiry: string | null;
  derivedStatus: StockStatus;
}

export interface InventoryAlerts {
  outOfStock: InventoryItem[];
  lowStock: InventoryItem[];
  nearExpiry: InventoryItem[];
  expired: InventoryItem[];
}

export interface InventoryBatch {
  id: string;
  batchNumber: string;
  expiryDate: string | null;
  quantity: number;
  itemId: string;
  drugId: string;
}

export interface DispenseVerification {
  order: { id: string; status: string; priority: string };
  items: Array<{ drugId: string; drugName: string }>;
  interactions: Array<{ drugA: string; drugB: string; severity: string; description: string | null }>;
  allergyConflicts: Array<{ allergen: string; severity: string; drugName?: string }>;
  allergy: { blocking: unknown[]; [key: string]: unknown };
  stockAvailable: boolean;
  batches: InventoryBatch[];
  checklist: {
    patientIdVerified: boolean;
    drugMatches: boolean;
    doseCorrect: boolean;
    counselingGiven: boolean;
  };
}

export interface DispenseInput {
  checklist: {
    patientIdVerified: boolean;
    drugMatches: boolean;
    doseCorrect: boolean;
    counselingGiven: boolean;
  };
  quantityOverride?: boolean;
  allergyOverride?: boolean;
  overrideReason?: string;
  note?: string;
}

export interface DispenseLogRow {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  pharmacistId: string;
  pharmacist: string | null;
  dispensedAt: string;
  drugNames: string[];
  quantity: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier: string;
  status: string;
  orderedAt: string;
  expectedDeliveryAt: string | null;
  receivedAt: string | null;
  totalMinor: number;
  currency: string;
  itemCount: number;
}

export interface PharmacyDashboard {
  stats: {
    pendingOrders: number;
    dispensedToday: number;
    lowStockCount: number;
    criticalStockCount: number;
    expiringSoon: number;
  };
  queue: Array<{
    id: string;
    patientName: string;
    priority: Priority;
    status: PharmacyOrderStatus;
    receivedAt: string;
  }>;
  lowStock: InventoryItem[];
  weeklyDispensed: Array<{ day: string; count: number }>;
}

export const pharmacyApi = {
  orders: async (
    params: ListParams & { status?: string; priority?: string } = {},
  ): Promise<Paginated<PharmacyOrder>> => {
    const response = await apiClient.get<PharmacyOrder[]>(API_ENDPOINTS.pharmacy.orders, { params });
    return unwrapPage(response.data);
  },

  process: async (orderId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.pharmacy.process(orderId), {});
  },

  ready: async (orderId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.pharmacy.ready(orderId), {});
  },

  verify: async (orderId: string): Promise<DispenseVerification> => {
    const response = await apiClient.get<DispenseVerification>(
      API_ENDPOINTS.pharmacy.verify(orderId),
    );
    return unwrap(response.data);
  },

  dispense: async (orderId: string, input: DispenseInput): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.pharmacy.dispense(orderId), input);
  },

  dispenseLog: async (
    params: ListParams & { patientId?: string; pharmacistId?: string } = {},
  ): Promise<Paginated<DispenseLogRow>> => {
    const response = await apiClient.get<DispenseLogRow[]>(
      API_ENDPOINTS.pharmacy.dispenseLog,
      { params },
    );
    return unwrapPage(response.data);
  },

  inventory: async (
    params: ListParams & { category?: string; derivedStatus?: string } = {},
  ): Promise<Paginated<InventoryItem>> => {
    const response = await apiClient.get<InventoryItem[]>(API_ENDPOINTS.pharmacy.inventory, {
      params,
    });
    return unwrapPage(response.data);
  },

  inventoryAlerts: async (): Promise<InventoryAlerts> => {
    const response = await apiClient.get<InventoryAlerts>(
      API_ENDPOINTS.pharmacy.inventoryAlerts,
    );
    return unwrap(response.data);
  },

  batches: async (drugId: string): Promise<InventoryBatch[]> => {
    const response = await apiClient.get<InventoryBatch[]>(
      API_ENDPOINTS.pharmacy.batches(drugId),
    );
    return unwrap(response.data);
  },

  updateInventoryItem: async (
    drugId: string,
    input: { reorderLevel: number; location?: string },
  ): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.pharmacy.inventoryItem(drugId), input);
  },

  receiveStock: async (input: {
    drugId: string;
    quantity: number;
    batchNumber: string;
    expiryDate: string;
    supplierId?: string;
    unit?: string;
    reorderLevel?: number;
  }): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.pharmacy.receipts, input);
  },

  adjustStock: async (input: {
    batchId: string;
    delta: number;
    reason: "ADJUSTMENT" | "COUNT_CORRECTION" | "EXPIRY" | "RETURN" | "TRANSFER";
    note?: string;
  }): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.pharmacy.adjustments, input);
  },

  purchaseOrders: async (
    params: ListParams & { status?: string; supplierId?: string } = {},
  ): Promise<Paginated<PurchaseOrder>> => {
    const response = await apiClient.get<PurchaseOrder[]>(API_ENDPOINTS.pharmacy.purchaseOrders, {
      params,
    });
    return unwrapPage(response.data);
  },

  createPurchaseOrder: async (input: {
    supplierId: string;
    expectedDeliveryAt?: string;
    notes?: string;
    items: Array<{ drugId: string; quantity: number; unitCostMinor: number }>;
  }): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.pharmacy.purchaseOrders, input);
  },

  submitPurchaseOrder: async (orderId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.pharmacy.submitPurchaseOrder(orderId), {});
  },

  shipPurchaseOrder: async (orderId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.pharmacy.shipPurchaseOrder(orderId), {});
  },

  cancelPurchaseOrder: async (orderId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.pharmacy.cancelPurchaseOrder(orderId), {});
  },

  dashboard: async (): Promise<PharmacyDashboard> => {
    const response = await apiClient.get<PharmacyDashboard>(API_ENDPOINTS.pharmacy.dashboard);
    return unwrap(response.data);
  },
};
