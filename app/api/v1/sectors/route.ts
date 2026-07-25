import { NextResponse } from "next/server";
import { getSectors } from "@/lib/silos/mock/state";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getSectors());
}
