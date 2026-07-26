import { NextResponse } from "next/server";
import { resetDemo } from "@/lib/silos/mock/state";

export const dynamic = "force-dynamic";

/** Demo-only helper (not part of the backend contract): restart the scripted timeline. */
export function POST() {
  return NextResponse.json(resetDemo());
}
