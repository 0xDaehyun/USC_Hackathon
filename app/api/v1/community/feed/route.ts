import { NextResponse } from "next/server";
import { getFeed } from "@/lib/silos/mock/state";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getFeed());
}
