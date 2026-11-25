import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await sql`SELECT 1 AS connected`;
    return NextResponse.json({
      success: result[0]?.connected === 1,
      database: "connected",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    return NextResponse.json(
      { success: false, database: "unavailable" },
      { status: 503 },
    );
  }
}
