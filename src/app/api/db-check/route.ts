
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    // Test 1: Database connection
    const connection = await sql`
      SELECT current_database() AS database
    `;

    // Test 2: Public schema tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `;

    // Test 3: Table columns
    const columns = await sql`
      SELECT
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;

    return NextResponse.json({
      success: true,
      database: connection[0].database,
      tables,
      columns,
    });

  } catch (error) {
    console.error("SCHEMA INSPECTION ERROR:", error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error
        ? error.message
        : String(error),
    }, { status: 500 });
  }
}
