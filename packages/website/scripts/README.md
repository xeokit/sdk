# Website Scripts

This directory is for website build and maintenance scripts only. It should not
contain reusable model converters, generated-data pipelines, procedural
generators, or performance benchmarks.

## Layout

- `build/` builds website artifacts such as pages, SDK docs, example libraries,
  documentation helper content, and the bundled xeokit library.
- `snapshots/` captures example and model screenshots, plus render-path gallery
  assets.
- `browser-tests/` serves browser-based SDK test pages.

Model conversion, XGF stream generation, procedural city/building generation,
and renderer benchmarks live under `packages/website/tools/`.
