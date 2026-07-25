import type { Metadata } from "next";
import { ValidationWorkbench } from "@/components/silos/ValidationWorkbench";
import { EATON_AFT_OBSERVED_VALIDATION } from "@/lib/silos/model/validation";

export const metadata: Metadata = {
  title: "Eaton model validation — SILOS",
  description:
    "Historical comparison of observed Eaton Fire progression, ELMFIRE, and the XGBoost AFT surrogate.",
};

export default function ValidationPage() {
  return (
    <ValidationWorkbench validation={EATON_AFT_OBSERVED_VALIDATION} />
  );
}
