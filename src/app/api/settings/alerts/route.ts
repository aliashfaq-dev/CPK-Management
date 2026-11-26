import { NextResponse } from "next/server";
import { z } from "zod";
import { getAlertRuleSettings, saveAlertRuleSettings } from "@/lib/alerts";
import { authorize } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ rules: await getAlertRuleSettings() });
}

const schema = z.object({
  alertNoPlate: z.boolean(),
  alertLowConfidence: z.boolean(),
  lowConfidenceThreshold: z.number().min(10).max(99),
});

export async function PUT(request: Request) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid alert rule settings." }, { status: 400 });
  }
  const rules = await saveAlertRuleSettings(parsed.data);
  return NextResponse.json({ rules });
}
