import { ocrFoldPlate } from "@/lib/ai-search-core";
import { MAX_PAGE_SIZE, PAGE_SIZE, isVehicleType } from "@/lib/constants";
import type {
  DetectionFilters,
  DetectionQuery,
  DetectionSortKey,
  SortDirection,
  VehicleType,
} from "@/types";

export type RawParams = Record<string, string | string[] | undefined>;

const SORT_KEYS: DetectionSortKey[] = ["plate", "vehicleType", "cameraId", "detectedAt", "confidence"];

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Uppercase A-Z0-9 only, the canonical plate form used for matching. */
export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export { ocrFoldPlate };

/** `YYYY-MM-DD` or an ISO timestamp. Returns an ISO string or undefined. */
export function parseUtcDate(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const stamp = Date.parse(
    dateOnly
      ? `${value}T00:00:00Z`
      : /Z|[+-]\d{2}:?\d{2}$/i.test(value)
        ? value
        : `${value}Z`,
  );
  if (Number.isNaN(stamp)) return undefined;
  return new Date(stamp + (dateOnly && endOfDay ? 86_400_000 : 0)).toISOString();
}

export function parseFilters(params: RawParams): DetectionFilters {
  const filters: DetectionFilters = {};
  const plate = normalizePlate(first(params.q) || first(params.plate));
  if (plate) {
    filters.plate = plate.slice(0, 15);
    const mode = first(params.plateMode);
    if (mode === "exact" || mode === "contains" || mode === "fuzzy") {
      filters.plateMode = mode;
    }
  }

  const singleType = first(params.type);
  if (isVehicleType(singleType)) filters.type = singleType;
  const multiTypesRaw = first(params.types);
  if (multiTypesRaw) {
    const parsedTypes = multiTypesRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is VehicleType => isVehicleType(s));
    if (parsedTypes.length > 0) filters.types = Array.from(new Set(parsedTypes));
  }

  const camera = first(params.camera);
  if (camera && camera !== "all" && /^[A-Za-z0-9_-]{1,60}$/.test(camera)) {
    filters.camera = camera;
  }

  const from = parseUtcDate(first(params.from));
  if (from) filters.from = from;
  const toRaw = first(params.to);
  const to = parseUtcDate(toRaw, /^\d{4}-\d{2}-\d{2}$/.test(toRaw));
  if (to) filters.to = to;

  const colour = first(params.colour);
  if (colour && colour !== "all" && /^[A-Za-z\s-]{1,30}$/.test(colour)) {
    filters.colour = colour.toLowerCase();
  }
  const coloursRaw = first(params.colours);
  if (coloursRaw) {
    const cols = coloursRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[a-z][a-z\s-]{0,29}$/.test(s));
    if (cols.length > 0) filters.colours = Array.from(new Set(cols));
  }

  const make = first(params.make);
  if (make && /^[A-Za-z0-9\s.-]{1,48}$/.test(make)) filters.make = make.toLowerCase();

  const model = first(params.model);
  if (model && /^[A-Za-z0-9\s.-]{1,48}$/.test(model)) filters.model = model.toLowerCase();

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
  const dir: SortDirection =
    dirParam === "asc" || dirParam === "desc"
      ? dirParam
      : sort === "detectedAt" || sort === "confidence"
        ? "desc"
        : "asc";
  const page = Math.max(1, Math.floor(Number(first(params.page))) || 1);
  const requested = Math.floor(Number(first(params.pageSize))) || defaults?.pageSize || PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { ...parseFilters(params), page, pageSize, sort, dir };
}

/** Serialises filters back to URL params (only non-default values). */
export function filtersToParams(
  filters: DetectionFilters & { sort?: DetectionSortKey; dir?: SortDirection; page?: number },
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.plate) {
    params.set("q", filters.plate);
    if (filters.plateMode) params.set("plateMode", filters.plateMode);
  }
  if (filters.type) params.set("type", filters.type);
  if (filters.types && filters.types.length > 0) params.set("types", filters.types.join(","));
  if (filters.camera) params.set("camera", filters.camera);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.colour) params.set("colour", filters.colour);
  if (filters.colours && filters.colours.length > 0) params.set("colours", filters.colours.join(","));
  if (filters.make) params.set("make", filters.make);
  if (filters.model) params.set("model", filters.model);
  if (filters.hasPlate !== undefined) params.set("hasPlate", filters.hasPlate ? "yes" : "no");
  if (filters.minConfidence) params.set("minConfidence", String(filters.minConfidence));
  const sort = filters.sort ?? "detectedAt";
  if (sort !== "detectedAt") params.set("sort", sort);
  const defaultDir: SortDirection = sort === "detectedAt" || sort === "confidence" ? "desc" : "asc";
  if (filters.dir && filters.dir !== defaultDir) params.set("dir", filters.dir);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params;
}
