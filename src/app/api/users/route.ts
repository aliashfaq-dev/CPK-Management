import { NextResponse } from "next/server";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH, authorize, hashPassword } from "@/lib/auth-server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserListRow {
  id: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
  is_active: boolean;
  created_at: Date;
}

export async function GET(request: Request) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;
  const result = await query<UserListRow>("SELECT id, email, name, role, is_active, created_at FROM public.app_users ORDER BY created_at");
  return NextResponse.json({
    users: result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
    })),
  });
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

/** Admins create viewer accounts only. */
export async function POST(request: Request) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: `Enter a valid email, a name, and a password of at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  }
  const { email, name, password } = parsed.data;
  const hash = await hashPassword(password);
  const result = await query<{ id: string }>(
    "INSERT INTO public.app_users (email, name, role, password_hash) VALUES ($1, $2, 'viewer', $3) ON CONFLICT (email) DO NOTHING RETURNING id",
    [email, name, hash],
  );
  if (result.rows.length === 0) return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}
