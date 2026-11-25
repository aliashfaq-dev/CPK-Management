import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured. Add it to .env.local and Vercel Environment Variables.");
}

export const sql = neon(databaseUrl);
