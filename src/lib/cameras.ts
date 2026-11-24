import type { Camera } from "@/types";

const CAMERA_NUMBER = /^(?:cam)?[\s-]*0*(\d+)$/;

/** Manual camera search: matches camera number ("CAM-01", "cam 1", "1"), name, or address/area. */
export function matchesCamera(camera: Camera, rawQuery: string): boolean {
  const needle = rawQuery.trim().toLowerCase();
  if (!needle) return true;
  if (`${camera.id} ${camera.name} ${camera.location}`.toLowerCase().includes(needle)) return true;
  const number = needle.match(CAMERA_NUMBER);
  return number !== null && Number(camera.id.replace(/\D/g, "")) === Number(number[1]);
}

/** Camera number from an id like "CAM-07" (-> 7). Ids without digits sort last. */
export function cameraNumber(camera: Camera): number {
  const digits = camera.id.replace(/\D/g, "");
  return digits ? Number(digits) : Number.POSITIVE_INFINITY;
}

/** Ascending by camera number (CAM-01, CAM-02, ... CAM-10); ties fall back to id. */
export function sortByCameraNumber(cameras: readonly Camera[]): Camera[] {
  return [...cameras].sort((a, b) => cameraNumber(a) - cameraNumber(b) || a.id.localeCompare(b.id));
}
