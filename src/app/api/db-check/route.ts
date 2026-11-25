
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false },
      { status: 404 }
    );
  }

  try {
    const [cameras, events, runs, vehicles, samples] =
      await Promise.all([
        sql`SELECT COUNT(*) AS total FROM public.cameras`,

        sql`SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE has_plate = true) AS with_plate,
          COUNT(DISTINCT vehicle_key) AS unique_vehicles
          FROM public.events`,

        sql`SELECT COUNT(*) AS total FROM public.runs`,

        sql`SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (
            WHERE make IS NOT NULL OR model IS NOT NULL
          ) AS identified,
          COUNT(DISTINCT vehicle_key) AS unique_vehicles
          FROM public.v_events_dashboard`,

        sql`SELECT
          event_time,
          camera_id,
          make,
          model,
          colour,
          has_plate,
          analysis_status
          FROM public.v_events_dashboard
          ORDER BY event_time DESC
          LIMIT 10`
      ]);

    return NextResponse.json({
      success: true,
      summary: {
        cameras: cameras[0],
        events: events[0],
        runs: runs[0],
        vehicles: vehicles[0]
      },
      latestEvents: samples
    });

  } catch (error) {
    console.error("DATABASE INSPECTION ERROR:", error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error
        ? error.message
        : String(error)
    }, { status: 500 });
  }
}