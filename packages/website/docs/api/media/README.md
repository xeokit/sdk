# Asset Pipeline

This directory groups scripts that author or transform model data used by
examples and tests.

## Layout

- `xgf-streaming/` generates XGF stream datasets and contains the shared
  `split-xgf-stream.js` utility.
- `catalog/` builds website model catalog metadata such as
  `packages/website/models/index.json`.
- `lod/` builds representation and shell LOD assets.
- `conversions/` contains one-off or dataset-specific conversion/generation
  scripts that write website model assets.

Scripts are still intentionally readable as SDK usage examples. Longer term,
the many dataset-specific XGF stream scripts should become presets for one
small runner instead of separate entrypoints.
