import { readFile } from "node:fs/promises";
import process from "node:process";
import Ajv2020 from "ajv/dist/2020.js";

const schemaUrl = new URL(
  "../data/contracts/zone-priority.schema.json",
  import.meta.url,
);
const fixtureUrl = new URL(
  "../data/sample/eaton-priority.json",
  import.meta.url,
);
const firePredictionSchemaUrl = new URL(
  "../data/contracts/fire-prediction.schema.json",
  import.meta.url,
);
const firePredictionFixtureUrl = new URL(
  "../data/sample/fire-prediction.example.json",
  import.meta.url,
);
const firePredictionModelUrl = new URL(
  "../data/model/eaton-aft-prediction.json",
  import.meta.url,
);
const aftObservedValidationSchemaUrl = new URL(
  "../data/contracts/aft-observed-validation.schema.json",
  import.meta.url,
);
const aftObservedValidationFixtureUrl = new URL(
  "../data/sample/aft-observed-validation.example.json",
  import.meta.url,
);
const aftObservedValidationModelUrl = new URL(
  "../data/model/eaton-aft-observed-validation.json",
  import.meta.url,
);

const [
  schema,
  fixture,
  firePredictionSchema,
  firePredictionFixture,
  firePredictionModel,
  aftObservedValidationSchema,
  aftObservedValidationFixture,
  aftObservedValidationModel,
] = await Promise.all(
  [
    schemaUrl,
    fixtureUrl,
    firePredictionSchemaUrl,
    firePredictionFixtureUrl,
    firePredictionModelUrl,
    aftObservedValidationSchemaUrl,
    aftObservedValidationFixtureUrl,
    aftObservedValidationModelUrl,
  ].map(async (url) =>
    JSON.parse(await readFile(url, "utf8")),
  ),
);

const ajv = new Ajv2020({ allErrors: true });
ajv.addFormat("date-time", {
  type: "string",
  validate: (value) => !Number.isNaN(Date.parse(value)),
});
const validate = ajv.compile(schema);

if (!validate(fixture)) {
  console.error(validate.errors);
  process.exit(1);
}

const { weights } = fixture.scoringModel;
const weightTotal =
  weights.dynamicThreat + weights.evacuationFriction + weights.supportNeed;

if (Math.abs(weightTotal - 1) > Number.EPSILON * 10) {
  console.error(`Scoring weights must sum to 1; received ${weightTotal}.`);
  process.exit(1);
}

for (const zone of fixture.zones) {
  const calculatedScore = Math.round(
    zone.components.dynamicThreat * weights.dynamicThreat +
      zone.components.evacuationFriction * weights.evacuationFriction +
      zone.components.supportNeed * weights.supportNeed,
  );

  if (calculatedScore !== zone.priorityScore) {
    console.error(
      `${zone.zoneId}: expected score ${calculatedScore}, received ${zone.priorityScore}.`,
    );
    process.exit(1);
  }
}

console.log(
  `Validated ${fixture.zones.length} zones against schema ${fixture.schemaVersion}.`,
);

const validateFirePrediction = ajv.compile(firePredictionSchema);
for (const [label, prediction] of [
  ["example", firePredictionFixture],
  ["generated Eaton pilot", firePredictionModel],
]) {
  if (!validateFirePrediction(prediction)) {
    console.error(validateFirePrediction.errors);
    process.exit(1);
  }
  const expectedHours = [1, 3, 6];
  const expectedLeads = [0, 2, 5];
  const reachedCounts = [];
  for (const [index, step] of prediction.hourly_steps.entries()) {
    if (
      step.hour_offset !== expectedHours[index] ||
      step.lead_hours_after_initialization !== expectedLeads[index]
    ) {
      console.error(`${label}: prediction horizon semantics do not match.`);
      process.exit(1);
    }
    if (
      step.connected_grid_cell_count +
        step.discarded_disconnected_grid_cell_count !==
      step.reached_grid_cell_count
    ) {
      console.error(`${label}: prediction grid counts do not add up.`);
      process.exit(1);
    }
    reachedCounts.push(step.reached_grid_cell_count);
  }
  if (
    reachedCounts.some(
      (count, index) => index > 0 && count < reachedCounts[index - 1],
    )
  ) {
    console.error(`${label}: cumulative prediction shrinks over time.`);
    process.exit(1);
  }
  console.log(
    `Validated ${label} fire prediction at T+${expectedHours.join("/")}h.`,
  );
}

const validateAftObserved = ajv.compile(aftObservedValidationSchema);
for (const [label, validation] of [
  ["example", aftObservedValidationFixture],
  ["generated Eaton", aftObservedValidationModel],
]) {
  if (!validateAftObserved(validation)) {
    console.error(validateAftObserved.errors);
    process.exit(1);
  }
  const expectedHours = [1, 3, 6];
  const expectedLeads = [0, 2, 5];
  for (const [index, horizon] of validation.horizons.entries()) {
    if (
      horizon.hour_offset !== expectedHours[index] ||
      horizon.lead_hours_after_initialization !== expectedLeads[index]
    ) {
      console.error(`${label}: validation horizon semantics do not match.`);
      process.exit(1);
    }
    if (
      horizon.counts.connected_student_grid_cells +
        horizon.counts.discarded_disconnected_student_grid_cells !==
      horizon.counts.selected_student_grid_cells
    ) {
      console.error(`${label}: validation grid counts do not add up.`);
      process.exit(1);
    }
  }
  if (label === "generated Eaton") {
    for (const horizon of validation.horizons.filter(
      (item) => item.comparisons,
    )) {
      for (const comparison of Object.values(horizon.comparisons)) {
        for (const metrics of Object.values(comparison)) {
          const union =
            metrics.true_positive +
            metrics.false_positive +
            metrics.false_negative;
          const calculatedIou =
            union === 0 ? 0 : metrics.true_positive / union;
          if (
            Math.abs(
              calculatedIou - metrics.intersection_over_union,
            ) > 1e-9
          ) {
            console.error(`${label}: validation IoU does not reconcile.`);
            process.exit(1);
          }
        }
      }
    }
  }
  console.log(
    `Validated ${label} AFT observed comparison at T+1/3/6h.`,
  );
}
