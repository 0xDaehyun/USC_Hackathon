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

const [schema, fixture] = await Promise.all(
  [schemaUrl, fixtureUrl].map(async (url) =>
    JSON.parse(await readFile(url, "utf8")),
  ),
);

const ajv = new Ajv2020({ allErrors: true });
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
