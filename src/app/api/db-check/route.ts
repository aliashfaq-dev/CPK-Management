import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// A minimal health check: never expose table names, records, or credentials.
export async function GET() {
  try {
    await sql`SELECT 1`;
    return NextResponse.json({ success: true, databaseConnected: true });
  } catch (error) {
    console.error("Neon health check failed:", error);
    return NextResponse.json(
      { success: false, databaseConnected: false, message: "Database connection failed" },
      { status: 503 },
    );
  }
}
