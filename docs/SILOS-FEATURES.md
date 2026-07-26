# SILOS — Feature Guide

SILOS is the live wildfire relief coordination demo in this repo. It overlays
predicted fire spread with vulnerable-population and coverage data so civilian
relief orgs can see **where aid will be needed before requests arrive**, claim
sectors, and hand work off in one shared ops room.

> Eaton Fire / Altadena historical-reconstruction demo for the hackathon pitch.
> T+1 is an observation-derived initialization footprint and T+3/T+6 are
> XGBoost AFT approximations of ELMFIRE Teacher runs. They are **prototype model
> geometry**, not official CAL FIRE products or real-fire probabilities.
> Official vs. model data is labeled in the UI.

## Entry points

| Route | Purpose |
| --- | --- |
| `/` | Onboarding / role entry into the ops room |
| `/map` | Live map: fire, prediction, sectors, claim |
| `/validation` | Eaton observed vs ELMFIRE Teacher vs XGBoost Student |
| `/dashboard` | Coverage index + partner org roster |
| `/community` | Sector threads: claims, gaps, messages |
| `/pitch` | Legacy EmberAid pitch surface (kept) |
| `/legacy` | Previous EmberAid explorer (kept) |

Deep-link any sector across tabs with `?sector=S7`.

## Shared shell (every SILOS tab)

- **Register strip** — incident name, wind, containment %, grid, live UTC clock
- **Top nav** — MAP / DASHBOARD / COMMUNITY + desk role switcher
  (Coordinator / Emergency Manager / Volunteer)
- **Live ticker** — scripted breaking wire that advances with the demo clock
- **KPI strip** — households in spread path, critical sectors, coverage gaps,
  debris-search certified orgs
- **Left sector rail** — sectors ranked by priority; click selects + deep-links
- **Live wire panel** — optional right drawer of alert feed events

On first load the shell calls `POST /api/v1/demo/reset` so the scripted timeline
restarts cleanly for each presenter session.

## Map (`/map`)

### Layers (toggle panel)

| Layer | Default | What you see |
| --- | --- | --- |
| Observed initialization | On | Solid **red** T+1 observation-derived initialization footprint |
| Spread prediction | On | **Red-family** rings for model T+3 / T+6 affected regions |
| Population vuln. | Off | Choropleth by dominant vulnerability class |
| Facilities | Off | Nursing homes, schools, shelters, etc. |
| Road access | Off | Single-access / constrained egress roads |
| 3D buildings | On | Extruded blocks tinted by the observed T+1 and modeled T+6 footprints |

### Interactions

- Click a sector polygon (or a rail card) → fly-in, red selection outline, dossier panel
- Dossier shows summary, vulnerability stats, aid needed, road access, facilities
- **Claim** an unassigned sector for the acting org + current desk role
- **Show on map** for a single-access road → highlights the road and flies to it
- Bottom ribbon: live wind / containment / coverage counts

Geometry is seeded locally so fire, prediction, sectors, and 3D buildings paint
immediately; polled API data refreshes the same sources.

## Model validation (`/validation`)

- T+1 observation-derived initialization, not scored
- T+3 calibration comparison
- T+6 temporal holdout comparison
- Toggleable observed, ELMFIRE Teacher, and XGBoost AFT Student boundaries
- 30 m footprint and native 240 m IoU, precision, recall, F1, area bias, and
  jointly reached arrival-time MAE
- Explicit `Historical validation` and `Share with caveats` labels
- API: `GET /api/v1/validation/eaton`

The T+6 Student-vs-observed footprint IoU is `0.642`. The Student/Teacher
native-grid observed-IoU difference is only `0.009`, so the larger 30 m
footprint difference is labeled as partly a 240 m block-expansion effect.

## Dashboard (`/dashboard`)

- **Gap alert** — critical sectors with no org assigned (hazard stripes)
- **Index of sectors** — print-index table: priority, coverage, predicted aid,
  households, coverage horizon (`NEEDS COVER ~Nh` when ETA is tight)
- **Partner organizations** — capacity, certifications, active sector links

## Community (`/community`)

- Sector thread index sorted by priority
- Feed of claims, gap detections, predictive alerts, and free-text messages
- Post a message as the acting org; claim from the thread header when unassigned

## Demo data & API (`/api/v1`)

In-memory mock behind same-origin routes (swap later via
`NEXT_PUBLIC_SILOS_API_BASE`):

| Method | Path | Role |
| --- | --- | --- |
| GET | `/fires/current` | Active fire + boundary |
| GET | `/fires/:id/prediction` | Hourly spread polygons |
| GET | `/sectors` | Ranked sector list + boundaries |
| GET | `/sectors/:id` | Sector dossier detail |
| POST | `/sectors/:id/claim` | Claim sector for an org/role |
| GET | `/orgs` | Partner org roster |
| GET | `/community/feed` | Live wire events |
| POST | `/community/messages` | Post to a sector thread |
| POST | `/demo/reset` | Restart the scripted clock |

A demo clock unlocks scripted feed events and sector-state changes over time so
the pitch plays the same way every run. Live claims/messages override the script
for the same sector.

`/fires/:id/prediction` now serves
`data/model/eaton-aft-prediction.json`. The artifact is generated by the ML
repository's `pipeline:export-frontend-prediction` command and contains the
model version, scenario offsets, grid counts, time basis, warnings, and T+1/T+3/T+6
GeoJSON. The frontend does not execute XGBoost in the browser.

## Desk roles

| Role | Intent in the demo |
| --- | --- |
| Coordinator | Claim/hand-off sectors, watch coverage gaps |
| Emergency Manager | Prioritize critical / unassigned zones |
| Volunteer | Follow community threads and claimed work |

Acting org is chosen in the UI context and sent with claim/message POSTs.

## What this is / is not

**Is:** coordination overlay — predicted need + who is covering which sector.

**Is not:** an official evacuation order system, a CAL FIRE perimeter product, or
a replacement for Watch Duty / Crisis Cleanup incident feeds.
