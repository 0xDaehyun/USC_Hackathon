import { NextResponse } from "next/server";
import { postMessage } from "@/lib/silos/mock/state";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    sector_id?: string;
    org_id?: string;
    text?: string;
  } | null;
  if (!body?.sector_id || !body.org_id || !body.text?.trim()) {
    return NextResponse.json(
      { error: "sector_id, org_id, and text are required." },
      { status: 400 },
    );
  }
  const result = postMessage(body.sector_id, body.org_id, body.text.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
