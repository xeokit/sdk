# City Generator

`city-generator` is an offline authoring tool for producing plausible city-scale
test content for xeokit website examples. It is not a live map renderer and does
not try to exactly reconstruct an OSM extract. Instead, it uses source city data
or committed profile JSON to derive an urban style: block sizes, street rhythm,
parcel density, building height distribution, facade variety, landmark frequency,
parks, waterways, and district character.

The generator then applies that style to a deterministic synthetic city. This
keeps examples reproducible, small enough to check in or regenerate, and free to
exercise rendering scenarios that are hard to get from one real dataset: dense
downtown geometry, varied materials, long sight lines, navigation corridors,
streaming chunks, LOD transitions, and selection/metadata behavior.

Conceptually the workflow separates three concerns:

```text
analysis profile     compact description of an urban pattern
procedural generator seeded geometry and metadata from that pattern
example asset        XGF/data/report output consumed by website demos
```

This keeps the SDK examples focused on consuming authored SceneModel/DataModel
assets, while the website tool owns the non-SDK authoring pipeline that creates
those assets.

This workflow proves one offline OSM-derived city style path:

```text
OSM extract -> profile JSON -> seeded procedural city -> XGF -> xeokit demo -> comparison report
```

## Analyse a Berlin OSM Extract

Place the source extract outside the application bundle:

```text
packages/website/tools/city-generator/data/berlin-sample.osm.pbf
```

Then run from the repo root:

```bash
pnpm city -- analyze-osm \
  --input ./packages/website/tools/city-generator/data/berlin-sample.osm.pbf \
  --output ./packages/website/tools/city-generator/profiles/berlin-inner-city.json \
  --name berlin-inner-city
```

The committed `profiles/berlin-inner-city.json` is the offline demo profile used
when the extract is not available locally.

## Available Profiles

Built-in profile names:

```text
central-european
historic-european
north-american-grid
london
paris
berlin
amsterdam
new-york
tokyo
chicago-river
```

Path-loadable district profiles:

```text
packages/website/tools/city-generator/profiles/amsterdam-canal-core.json
packages/website/tools/city-generator/profiles/berlin-inner-city.json
packages/website/tools/city-generator/profiles/central-european-inner-city.json
packages/website/tools/city-generator/profiles/historic-european-core.json
packages/website/tools/city-generator/profiles/london-west-end.json
packages/website/tools/city-generator/profiles/new-york-midtown-grid.json
packages/website/tools/city-generator/profiles/north-american-downtown-grid.json
packages/website/tools/city-generator/profiles/paris-inner-arrondissement.json
packages/website/tools/city-generator/profiles/tokyo-dense-mixed-use.json
```

Use a built-in name or a JSON path with `--profile`.

## Generate the Fictional Berlin-Style City

From the repo root:

```bash
pnpm city -- generate \
  --seed 42 \
  --profile ./packages/website/tools/city-generator/profiles/berlin-inner-city.json \
  --size 1000 \
  --output ./models/ProceduralCity/xgf/model.xgf
```

The command writes:

```text
models/ProceduralCity/xgf/model.xgf
models/ProceduralCity/metadata.json
models/ProceduralCity/report.json
artifacts/evaluation/berlin-style-42.json
```

The existing `formats_xgf_proceduralCity` example loads this XGF and displays the
profile, seed, scene stats, selected building metadata, and source-versus-
generated comparison metrics.

## Calibrate Evaluation

Run the full deterministic calibration suite from the repo root:

```bash
pnpm city -- calibrate
```

This generates baseline and evaluated cities for seeds `7,19,42,73,101,256,512,1024`,
runs evaluator ablations, searches a small fixed set of weight presets, and writes:

```text
artifacts/calibration/calibration-report.json
artifacts/calibration/calibration-report.html
artifacts/calibration/visual-comparison.html
artifacts/calibration/seed-42/
artifacts/calibration/seed-73/
```

The visual comparison artifacts are fixed SVG views for full-city aerial,
downtown, historic district, arterial street, residential street, courtyard
block, central park, and skyline silhouette.

Use the fast regression gate in CI or before committing:

```bash
pnpm city -- regression
```

That command runs the same eight benchmark seeds, compares baseline against
evaluated generation, checks hard validity constraints, and fails on thresholds
from:

```text
packages/website/tools/city-generator/calibration/regression-thresholds.json
```

It writes its compact report under:

```text
artifacts/calibration/regression/
```

For local tuning, run a smaller suite:

```bash
pnpm city -- calibrate \
  --seeds 42 \
  --size 600 \
  --buildings 240 \
  --no-ablation \
  --no-weight-search
```

Evaluation presets are available on generation and calibration commands:

```bash
pnpm city -- generate --evaluation-preset fast
pnpm city -- generate --evaluation-preset balanced
pnpm city -- generate --evaluation-preset quality
```

Use `--disable-evaluation` to generate the single-pass baseline.
