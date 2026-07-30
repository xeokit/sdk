# Website Content Generation Scripts

This directory contains Node scripts that generate assets consumed by the
website examples. The XGF Stream scripts are intended to be readable SDK usage
examples as well as build utilities.

## XGF stream generators

- `generate-xgf-streaming-baku-example.js` converts `baku.glb` through the
  `xeoconvert` CLI into `models/BakuStadium_2000/xgfstream`.
- `generate-xgf-streaming-baku-v2-example.js` converts the same `baku.glb`
  source into `models/BakuStadium_xgfstream_200/xgfstream` with a lower chunk count.
- `generate-xgf-streaming-lyon-example.js` merges the root `Lyon*.xkt` files
  into one coordinate-system-aware XGF stream.
- `generate-xgf-streaming-archipelago-example.js` builds procedural island
  content, places existing XGF models, and exports one combined stream.
- `generate-xgf-streaming-example.js` writes the small
  `formats_xgf_streaming_chunks` fixture with explicit asset-library and
  references-only chunk membership.
- `generate-xgf-streaming-benchmark-example.js` writes the synthetic streaming
  benchmark fixture used for loader and scheduler profiling.
- `generate-xgf-streaming-otc-example.js` splits an existing OTC XGF model into
  a stream using `scripts/split-xgf-streaming.js`.
- `generate-xgf-streaming-recursive-example.js` creates a root stream index
  that references other `xgfstream` datasets recursively.

## Common pipeline

Most stream generation scripts follow the same shape:

1. Load or build a `SceneModel` and optional `DataModel`.
2. Apply source coordinate systems, placements, or model IDs.
3. Choose chunking settings such as partition mode, chunk metric, chunk budget,
   grid cell size, and asset-library policy.
4. Write `index.json`, compact `index.runtime.json`, and `chunks/*.xgf`.
5. Keep manifest URIs relative to the generated stream root so browser examples
   can load the package directly.

The CLI-based scripts demonstrate how users can call SDK tooling from their own
content pipeline. The in-process scripts demonstrate direct SDK imports from
Node when custom scene construction, merging, or placement logic is needed.

## Running

Run scripts from the repository root:

```sh
node packages/website/scripts/generate-xgf-streaming-baku-example.js
node packages/website/scripts/generate-xgf-streaming-baku-v2-example.js
node packages/website/scripts/generate-xgf-streaming-lyon-example.js
node packages/website/scripts/generate-xgf-streaming-archipelago-example.js
```

Some scripts import TypeScript SDK sources through `ts-node`; make sure
dependencies are installed before running them. CLI-based scripts may also
require a current SDK CLI build.
