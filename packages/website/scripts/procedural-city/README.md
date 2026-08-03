# Procedural City OSM Vertical Slice

This workflow proves one offline OSM-derived city style path:

```text
OSM extract -> profile JSON -> seeded procedural city -> XGF -> xeokit demo -> comparison report
```

## Analyse a Berlin OSM Extract

Place the source extract outside the application bundle:

```text
packages/website/scripts/procedural-city/data/berlin-sample.osm.pbf
```

Then run from `packages/website`:

```bash
npm run analyze-osm -- \
  --input ./scripts/procedural-city/data/berlin-sample.osm.pbf \
  --output ./scripts/procedural-city/profiles/berlin-inner-city.json \
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
scripts/procedural-city/profiles/amsterdam-canal-core.json
scripts/procedural-city/profiles/berlin-inner-city.json
scripts/procedural-city/profiles/central-european-inner-city.json
scripts/procedural-city/profiles/historic-european-core.json
scripts/procedural-city/profiles/london-west-end.json
scripts/procedural-city/profiles/new-york-midtown-grid.json
scripts/procedural-city/profiles/north-american-downtown-grid.json
scripts/procedural-city/profiles/paris-inner-arrondissement.json
scripts/procedural-city/profiles/tokyo-dense-mixed-use.json
```

Use a built-in name or a JSON path with `--profile`.

## Generate the Fictional Berlin-Style City

From `packages/website`:

```bash
npm run generate -- \
  --seed 42 \
  --profile ./scripts/procedural-city/profiles/berlin-inner-city.json \
  --size 1000 \
  --output ./models/ProceduralCity/xgf/model.xgf
```

The command writes:

```text
models/ProceduralCity/xgf/model.xgf
models/ProceduralCity/metadata.json
models/ProceduralCity/report.json
reports/berlin-style-42.json
```

The existing `formats_xgf_proceduralCity` example loads this XGF and displays the
profile, seed, scene stats, selected building metadata, and source-versus-
generated comparison metrics.

## Calibrate Evaluation

Run the full deterministic calibration suite from the repo root:

```bash
pnpm city-calibrate
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
pnpm city-regression
```

That command runs the same eight benchmark seeds, compares baseline against
evaluated generation, checks hard validity constraints, and fails on thresholds
from:

```text
packages/website/scripts/procedural-city/calibration/regression-thresholds.json
```

It writes its compact report under:

```text
artifacts/calibration/regression/
```

For local tuning, run a smaller suite:

```bash
pnpm --filter @xeokit/website city-calibrate -- \
  --seeds 42 \
  --size 600 \
  --buildings 240 \
  --no-ablation \
  --no-weight-search
```

Evaluation presets are available on generation and calibration commands:

```bash
pnpm --filter @xeokit/website generate -- --evaluation-preset fast
pnpm --filter @xeokit/website generate -- --evaluation-preset balanced
pnpm --filter @xeokit/website generate -- --evaluation-preset quality
```

Use `--disable-evaluation` to generate the single-pass baseline.
