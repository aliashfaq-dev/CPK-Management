import type { Camera } from "@/types";

/** Camera number from an id like "CAM-07" (-> 7). Ids without digits sort last. */
export function cameraNumber(camera: Camera): number {
  const digits = camera.id.replace(/\D/g, "");
  return digits ? Number(digits) : Number.POSITIVE_INFINITY;
}

/** Ascending by camera number (CAM-01, CAM-02, ... CAM-10); ties fall back to id. */
export function sortByCameraNumber(cameras: readonly Camera[]): Camera[] {
  return [...cameras].sort((a, b) => cameraNumber(a) - cameraNumber(b) || a.id.localeCompare(b.id));
}
