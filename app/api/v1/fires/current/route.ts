import { NextResponse } from "next/server";
import { getFire } from "@/lib/silos/mock/state";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getFire());
}
