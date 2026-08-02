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
