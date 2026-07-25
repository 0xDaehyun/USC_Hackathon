import { NextResponse } from "next/server";
import { getPrediction } from "@/lib/silos/mock/state";

export const dynamic = "force-dynamic";

export function GET() {
  // The mock serves one incident; the id segment exists for contract parity.
  return NextResponse.json(getPrediction());
}
