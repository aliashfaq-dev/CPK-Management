import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getLoginSetupNotice, getSessionUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

function sanitizeNext(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/login")) {
    return "/";
  }
  return candidate;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const user = await getSessionUser();
  if (user) redirect("/");

  const [params, setupNotice] = await Promise.all([searchParams, getLoginSetupNotice()]);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <LoginForm setupNotice={setupNotice} nextPath={sanitizeNext(params.next)} />
    </main>
  );
}
