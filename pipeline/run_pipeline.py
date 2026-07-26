"""Unattended orchestrator for the LA wildfire risk-mapping pipeline.

Runs phases 1-4 in order. Every phase is wrapped in the fail-safe protocol:
errors are logged to execution_log.txt, partial data is preserved, and
independent phases still run. Phases 3-4 depend on phases 1-2 outputs, but
those always exist (real or clearly-labeled dummy placeholders).
"""

from __future__ import annotations

import json
import sys

from common import LOG_FILE, OUTPUT_DIR, log, log_exception

import phase1_burn
import phase2_smoke
import phase3_risk
import phase4_viz

PHASES = [
    ("PHASE 1 (burn segmentation)", phase1_burn.run),
    ("PHASE 2 (smoke exposure)", phase2_smoke.run),
    ("PHASE 3 (risk scoring)", phase3_risk.run),
    ("PHASE 4 (visualization)", phase4_viz.run),
]


def main() -> int:
    log("=" * 60)
    log("PIPELINE START: LA Wildfire & Smoke Vulnerability Risk Mapping")
    log(f"Log file: {LOG_FILE}")

    results: dict[str, dict] = {}
    failures = 0
    for name, runner in PHASES:
        try:
            results[name] = runner()
        except Exception as error:  # noqa: BLE001 - fail-safe: log, halt phase, continue
            failures += 1
            log_exception(f"{name} HALTED (unrecoverable in-phase error)", error)
            results[name] = {"status": "failed", "error": repr(error)}

    summary_path = OUTPUT_DIR / "pipeline_summary.json"
    summary_path.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")
    log(f"PIPELINE SUMMARY written to {summary_path}")
    for name, result in results.items():
        log(f"  {name}: {result.get('status')}")

    if failures:
        log(f"PIPELINE FINISHED WITH {failures} FAILED PHASE(S); human review required", level="WARN")
    else:
        log("PIPELINE FINISHED: all phases completed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
