import { useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  laboratoryApi,
  type CreateLabOrderInput,
  type SpecimenStatus,
} from "@/services/laboratory/laboratory.api";
import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/types/api.types";

export const useLabOrders = (
  params: ListParams & { status?: string; priority?: string; patientId?: string } = {},
) =>
  useQuery({
    queryKey: queryKeys.laboratory.orders(params),
    queryFn: () => laboratoryApi.orders(params),
  });

export const useLabOrder = (orderId: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.laboratory.order(orderId ?? ""),
    queryFn: () => laboratoryApi.order(orderId as string),
    enabled: Boolean(orderId),
  });

export const useLabResults = (
  params: ListParams & { patientId?: string; critical?: boolean; flag?: string } = {},
) =>
  useQuery({
    queryKey: queryKeys.laboratory.results(params),
    queryFn: () => laboratoryApi.results(params),
  });

export const useCriticalResults = () =>
  useQuery({ queryKey: queryKeys.laboratory.critical, queryFn: laboratoryApi.criticalResults });

export const useSpecimens = (params: ListParams & { status?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.laboratory.specimens(params),
    queryFn: () => laboratoryApi.specimens(params),
  });

export const useSpecimenLookup = (barcode: string | null) =>
  useQuery({
    queryKey: [...queryKeys.laboratory.specimens({}), "lookup", barcode ?? ""],
    queryFn: () => laboratoryApi.lookupSpecimen(barcode as string),
    enabled: Boolean(barcode),
  });

export const useSpecimenCustody = (specimenId: string | null) =>
  useQuery({
    queryKey: queryKeys.laboratory.custody(specimenId ?? ""),
    queryFn: () => laboratoryApi.specimenCustody(specimenId as string),
    enabled: Boolean(specimenId),
  });

export const useLabTests = (search?: string) =>
  useQuery({
    queryKey: queryKeys.laboratory.tests(search),
    queryFn: () => laboratoryApi.tests({ search }),
    staleTime: 10 * 60_000,
  });

export const useTestRanges = (testId: string | null) =>
  useQuery({
    queryKey: queryKeys.laboratory.ranges(testId ?? ""),
    queryFn: () => laboratoryApi.testRanges(testId as string),
    enabled: Boolean(testId),
  });

export const useLabDashboard = () =>
  useQuery({ queryKey: queryKeys.laboratory.dashboard, queryFn: laboratoryApi.dashboard });

export interface AnalyteIndexEntry {
  analyteId: string;
  name: string;
  unit: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  testId: string;
  testName: string;
}

/**
 * Lab result rows only carry `analyteId`, so the analyte/test label and reference
 * range are resolved from the catalogue (`/lab/tests`) plus its per-test ranges.
 */
export const useAnalyteIndex = () => {
  const tests = useLabTests();
  const rangeQueries = useQueries({
    queries: (tests.data ?? []).map((test) => ({
      queryKey: queryKeys.laboratory.ranges(test.id),
      queryFn: () => laboratoryApi.testRanges(test.id),
      staleTime: 10 * 60_000,
    })),
  });

  const data = useMemo(() => {
    const index = new Map<string, AnalyteIndexEntry>();
    for (const test of tests.data ?? []) {
      for (const analyte of test.analytes ?? []) {
        index.set(analyte.id, {
          analyteId: analyte.id,
          name: analyte.name,
          unit: analyte.unit,
          referenceLow: null,
          referenceHigh: null,
          testId: test.id,
          testName: test.name,
        });
      }
    }

    for (const query of rangeQueries) {
      for (const range of query.data ?? []) {
        const existing = index.get(range.analyteId);
        const low = range.referenceLow === null ? null : Number(range.referenceLow);
        const high = range.referenceHigh === null ? null : Number(range.referenceHigh);
        if (existing) {
          index.set(range.analyteId, {
            ...existing,
            name: range.analyteName || existing.name,
            unit: existing.unit ?? range.unit,
            referenceLow: Number.isFinite(low) ? low : null,
            referenceHigh: Number.isFinite(high) ? high : null,
          });
        } else {
          index.set(range.analyteId, {
            analyteId: range.analyteId,
            name: range.analyteName,
            unit: range.unit,
            referenceLow: Number.isFinite(low) ? low : null,
            referenceHigh: Number.isFinite(high) ? high : null,
            testId: "",
            testName: "",
          });
        }
      }
    }

    return index;
  }, [tests.data, rangeQueries]);

  return { data, isLoading: tests.isLoading };
};

const useLabInvalidation = () => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.laboratory.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.admin });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.doctor });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.patient });
  };
};

export const useCreateLabOrder = () => {
  const invalidate = useLabInvalidation();
  return useMutation({
    mutationFn: (input: CreateLabOrderInput) => laboratoryApi.createOrder(input),
    onSuccess: invalidate,
  });
};

export const useAssignLabOrder = () => {
  const invalidate = useLabInvalidation();
  return useMutation({
    mutationFn: ({ orderId, technicianId }: { orderId: string; technicianId: string }) =>
      laboratoryApi.assignOrder(orderId, technicianId),
    onSuccess: invalidate,
  });
};

export const useCollectSpecimen = () => {
  const invalidate = useLabInvalidation();
  return useMutation({
    mutationFn: ({
      orderId,
      input,
    }: {
      orderId: string;
      input: { specimenType?: string; barcode?: string; collectedAt?: string; location?: string };
    }) => laboratoryApi.collectSpecimen(orderId, input),
    onSuccess: invalidate,
  });
};

export const useEnterLabResults = () => {
  const invalidate = useLabInvalidation();
  return useMutation({
    mutationFn: ({
      orderId,
      input,
    }: {
      orderId: string;
      input: Parameters<typeof laboratoryApi.enterResults>[1];
    }) => laboratoryApi.enterResults(orderId, input),
    onSuccess: invalidate,
  });
};

export const useReleaseLabOrder = () => {
  const invalidate = useLabInvalidation();
  return useMutation({
    mutationFn: ({
      orderId,
      input,
    }: {
      orderId: string;
      input: { itemIds?: string[]; acknowledgedCriticalIds: string[] };
    }) => laboratoryApi.release(orderId, input),
    onSuccess: invalidate,
  });
};

export const useUpdateSpecimenStatus = () => {
  const invalidate = useLabInvalidation();
  return useMutation({
    mutationFn: ({
      specimenId,
      input,
    }: {
      specimenId: string;
      input: { status: SpecimenStatus; location?: string; notes?: string };
    }) => laboratoryApi.updateSpecimenStatus(specimenId, input),
    onSuccess: invalidate,
  });
};

export const useCancelLabOrder = () => {
  const invalidate = useLabInvalidation();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      laboratoryApi.cancelOrder(orderId, reason),
    onSuccess: invalidate,
  });
};
