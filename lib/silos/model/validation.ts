import validationJson from "@/data/model/eaton-aft-observed-validation.json";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export type ValidationGeometry = Feature<Polygon | MultiPolygon>;

export type ValidationBinaryMetrics = {
  true_positive: number;
  false_positive: number;
  false_negative: number;
  true_negative: number;
  truth_cell_count: number;
  prediction_cell_count: number;
  intersection_over_union: number;
  precision: number;
  recall: number;
  f1_score: number;
  truth_area_acres?: number;
  prediction_area_acres?: number;
  area_bias_acres?: number;
};

export type ValidationComparison = {
  footprint_30m: ValidationBinaryMetrics;
  native_grid_240m: ValidationBinaryMetrics;
};

export type ValidationHorizon = {
  hour_offset: 1 | 3 | 6;
  lead_hours_after_initialization: 0 | 2 | 5;
  role: "initialization-not-scored" | "calibration" | "holdout";
  observed: ValidationGeometry;
  teacher: ValidationGeometry;
  student: ValidationGeometry;
  counts: {
    selected_student_grid_cells: number;
    connected_student_grid_cells: number;
    discarded_disconnected_student_grid_cells: number;
  };
  comparisons?: {
    student_vs_observed: ValidationComparison;
    teacher_vs_observed: ValidationComparison;
    student_vs_teacher: ValidationComparison;
  };
};

export type ArrivalValidationMetrics = {
  reference_cell_count: number;
  supported_reference_cell_count: number;
  support_coverage_share: number;
  jointly_reached_by_hour_6_cell_count: number;
  joint_reach_share: number;
  jointly_reached_mean_absolute_error_hours: number;
  jointly_reached_median_absolute_error_hours: number;
  jointly_reached_p90_absolute_error_hours: number;
  horizon_capped_mean_absolute_error_hours: number;
  horizon_capped_interpretation: string;
};

export type AftObservedValidation = {
  schema_version: "1.0";
  incident: {
    id: string;
    name: string;
    ignition_time_utc: string;
  };
  mode: "historical-validation";
  generated_at: string;
  methodology: {
    selected_teacher_case: string;
    selected_teacher_case_rule: string;
    common_evaluation_grid: {
      crs: string;
      cell_size_meters: number;
      width: number;
      height: number;
    };
    student_native_grid: {
      cell_size_meters: number;
      block_pixels: number;
      candidate_cell_count: number;
    };
  };
  sources: Record<string, string>;
  model: {
    family: "xgboost-aft";
    teacher: "ELMFIRE";
    assessment: string;
    prediction_unit: string;
  };
  horizons: ValidationHorizon[];
  arrival_time: {
    student_vs_observed: ArrivalValidationMetrics;
    teacher_vs_observed: ArrivalValidationMetrics;
    student_vs_teacher: ArrivalValidationMetrics;
  };
  summary: {
    status: "share-with-caveats";
    holdout_hour: 6;
    student_vs_observed: ValidationComparison;
    teacher_vs_observed: ValidationComparison;
    student_vs_teacher: ValidationComparison;
  };
  warnings: string[];
};

export const EATON_AFT_OBSERVED_VALIDATION =
  validationJson as unknown as AftObservedValidation;
