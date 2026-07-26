import { NextResponse } from "next/server";
import { getSectorDetail } from "@/lib/silos/mock/state";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = getSectorDetail(id);
  if (!detail) {
    return NextResponse.json({ error: `Unknown sector ${id}.` }, { status: 404 });
  }
  return NextResponse.json(detail);
}
