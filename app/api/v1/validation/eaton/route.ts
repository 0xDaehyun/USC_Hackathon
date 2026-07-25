import { NextResponse } from "next/server";
import { EATON_AFT_OBSERVED_VALIDATION } from "@/lib/silos/model/validation";

export async function GET() {
  return NextResponse.json(EATON_AFT_OBSERVED_VALIDATION);
}
