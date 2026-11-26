import { MAX_PAGE_SIZE, PAGE_SIZE, isVehicleType } from "@/lib/constants";
import type { DetectionFilters, DetectionQuery, DetectionSortKey, SortDirection } from "@/types";

export type RawParams = Record<string, string | string[] | undefined>;

const SORT_KEYS: DetectionSortKey[] = ["plate", "vehicleType", "cameraId", "detectedAt", "confidence"];

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Uppercase A-Z0-9 only, the canonical plate form used for matching. */
export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** `YYYY-MM-DD` or a datetime-local value, read as UTC. Returns an ISO string or undefined. */
export function parseUtcDate(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const stamp = Date.parse(dateOnly ? `${value}T00:00:00Z` : /Z|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(stamp)) return undefined;
  return new Date(stamp + (dateOnly && endOfDay ? 86_400_000 : 0)).toISOString();
}

export function parseFilters(params: RawParams): DetectionFilters {
  const filters: DetectionFilters = {};
  const plate = normalizePlate(first(params.q) || first(params.plate));
  if (plate) filters.plate = plate.slice(0, 12);
  const type = first(params.type);
  if (isVehicleType(type)) filters.type = type;
  const camera = first(params.camera);
  if (camera && camera !== "all") filters.camera = camera.slice(0, 80);
  const from = parseUtcDate(first(params.from));
  if (from) filters.from = from;
  const to = parseUtcDate(first(params.to), true);
  if (to) filters.to = to;
  const colour = first(params.colour);
  if (colour && colour !== "all") filters.colour = colour.slice(0, 40);
  const hasPlate = first(params.hasPlate);
  if (hasPlate === "yes") filters.hasPlate = true;
  else if (hasPlate === "no") filters.hasPlate = false;
  const min = Number(first(params.minConfidence));
  if (Number.isFinite(min) && min > 0) filters.minConfidence = Math.min(100, min);
  return filters;
}

export function parseDetectionQuery(params: RawParams, defaults?: { pageSize?: number }): DetectionQuery {
  const sortParam = first(params.sort) as DetectionSortKey;
  const sort = SORT_KEYS.includes(sortParam) ? sortParam : "detectedAt";
  const dirParam = first(params.dir);
  const dir: SortDirection = dirParam === "asc" || dirParam === "desc" ? dirParam : sort === "detectedAt" || sort === "confidence" ? "desc" : "asc";
  const page = Math.max(1, Math.floor(Number(first(params.page))) || 1);
  const requested = Math.floor(Number(first(params.pageSize))) || defaults?.pageSize || PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { ...parseFilters(params), page, pageSize, sort, dir };
}

/** Serialises filters back to URL params (only non-default values). */
export function filtersToParams(filters: DetectionFilters & { sort?: DetectionSortKey; dir?: SortDirection; page?: number }): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.plate) params.set("q", filters.plate);
  if (filters.type) params.set("type", filters.type);
  if (filters.camera) params.set("camera", filters.camera);
  if (filters.from) params.set("from", filters.from.slice(0, 10));
  if (filters.to) params.set("to", new Date(Date.parse(filters.to) - 86_400_000).toISOString().slice(0, 10));
  if (filters.colour) params.set("colour", filters.colour);
  if (filters.hasPlate !== undefined) params.set("hasPlate", filters.hasPlate ? "yes" : "no");
  if (filters.minConfidence) params.set("minConfidence", String(filters.minConfidence));
  if (filters.sort && filters.sort !== "detectedAt") params.set("sort", filters.sort);
  const sort = filters.sort ?? "detectedAt";
  const defaultDir: SortDirection = sort === "detectedAt" || sort === "confidence" ? "desc" : "asc";
  if (filters.dir && filters.dir !== defaultDir) params.set("dir", filters.dir);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params;
}
