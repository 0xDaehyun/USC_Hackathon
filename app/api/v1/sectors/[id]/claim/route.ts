import { NextResponse } from "next/server";
import { claimSector } from "@/lib/silos/mock/state";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    org_id?: string;
    role?: string;
  } | null;
  if (!body?.org_id) {
    return NextResponse.json({ error: "org_id is required." }, { status: 400 });
  }
  const result = claimSector(id, body.org_id, body.role ?? "coordinator");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
