# Procedural Buildings

This directory contains a small SDK-in-Node pipeline for deriving a procedural
building style from existing website model samples, then generating new building
geometry from that profile.

The pipeline is deliberately rule-based. It does not train a neural model; it
extracts dimensions, storey/facade heuristics, material palette and density
statistics from source models, then uses those statistics to generate new
SceneModel content.

## Analyze

```bash
node packages/website/scripts/procedural-buildings/analyze-building-style.js
```

By default this writes:

```text
packages/website/scripts/procedural-buildings/building-style.json
```

Use a subset of the built-in sample list:

```bash
node packages/website/scripts/procedural-buildings/analyze-building-style.js \
  --models OTCConferenceCenter,ResidentialBuilding,Duplex
```

## Generate

```bash
node packages/website/scripts/procedural-buildings/generate-procedural-buildings.js
```

By default this writes:

```text
packages/website/models/ProceduralBuildings/xgf/model.xgf
packages/website/models/ProceduralBuildings/xgfstream/
packages/website/models/ProceduralBuildings/procedural-buildings.json
```

Useful options:

```bash
node packages/website/scripts/procedural-buildings/generate-procedural-buildings.js \
  --count 16 \
  --seed 7 \
  --profile packages/website/scripts/procedural-buildings/building-style.json
```

The source fallback order is XGF, XKT, glTF/GLB, then IFC. USDZ packages can be
recorded as training sources, including their archive metadata, but these Node
scripts use a configured analysis fallback for geometry statistics because the
current USDZ scene decoder path is browser-only.
