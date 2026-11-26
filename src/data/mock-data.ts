/**
 * Deterministic sample data for tests and offline experiments ONLY.
 * No component or page imports this file: the app reads the database through
 * `src/lib/data-service.ts`. (`scripts/mock-pipeline.mjs` is the mock for the pipeline.)
 */
import type { Camera, Detection, VehicleType } from "@/types";

export const BASE_TIME = Date.parse("2026-11-22T09:30:00Z");
const MINUTE = 60_000;

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export const mockCameras: Camera[] = [
  { id: "CAM-01", name: "Karsaz Junction", location: "Shahrah-e-Faisal, Karsaz", status: "online", lastActivity: new Date(BASE_TIME - MINUTE).toISOString(), detectionsToday: 214 },
  { id: "CAM-02", name: "Clifton Bridge", location: "Do Talwar, Clifton", status: "online", lastActivity: new Date(BASE_TIME - 2 * MINUTE).toISOString(), detectionsToday: 187 },
];

const TYPES: VehicleType[] = ["car", "rickshaw", "htv", "van", "pickup", "bike"];
const PLATES = ["BKL-2847", "ARZ-9013", "KTN-5526", "KDL-3092", "TKA-9132", "AXM-7342"];

export function buildMockDetections(count = 24): Detection[] {
  const rand = createRng(20261122);
  return Array.from({ length: count }, (_, index) => {
    const camera = mockCameras[Math.floor(rand() * mockCameras.length)];
    const hasPlate = rand() > 0.2;
    return {
      id: `MOCK-${9000 - index}`,
      plate: hasPlate ? PLATES[Math.floor(rand() * PLATES.length)] : "",
      hasPlate,
      vehicleType: TYPES[Math.floor(rand() * TYPES.length)],
      make: null,
      color: null,
      analysisStatus: null,
      cameraId: camera.id,
      cameraName: camera.name,
      location: camera.location,
      detectedAt: new Date(BASE_TIME - index * 23 * MINUTE).toISOString(),
      confidence: Math.round((82 + rand() * 17.8) * 10) / 10,
      plateDetectionConfidence: null,
      hasVehicleImage: false,
      hasPlateImage: false,
    };
  });
}
