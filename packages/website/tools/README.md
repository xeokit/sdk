# Website Tools

This directory contains tooling that authors, converts, validates, or profiles
assets consumed by the website examples and model catalog.

## Layout

- `asset-pipeline/` contains model conversion, XGF stream generation, catalog
  indexing, and LOD authoring utilities.
- `earth-generator/` builds Natural Earth globe XGF stream datasets and its diagnostic
  viewer.
- `city-generator/` contains procedural city generation, OSM profile analysis,
  calibration, and report tooling.
- `building-generator/` contains procedural building style analysis and
  generation.
- `render-benchmarks/` contains browser-driven renderer, streaming, and visual
  comparison benchmarks.

Website page/docs/lib build scripts remain in `packages/website/scripts/`.
