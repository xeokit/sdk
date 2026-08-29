---
title: xeokit SDK — Executive Whitepaper
---

# xeokit SDK — Executive Overview

*A non-technical summary of what the SDK does, why it matters, and where it creates business value.*

---

## Executive Summary

xeokit SDK is a web-native foundation for AECO applications: BIM viewers, digital twins, coordination tools, facilities dashboards, model analytics products, and large-scale model conversion pipelines.

Its value is concentrated in three areas:

- **Scale** — large BIM and infrastructure models stay interactive in the browser.
- **Accuracy** — surveyed engineering coordinates remain meaningful instead of being flattened into viewer-local space.
- **BIM semantics** — model geometry and business data stay connected, so products can filter, select, inspect, and report on real building entities.

This makes xeokit more than a viewer. It is reusable infrastructure for products that need high-performance 3D, BIM data, model loading, interaction, measurements, sectioning, spatial queries, standards-based interoperability, and repeatable dataset preparation.

---

## What Makes It Different

Most browser 3D engines come from games, product visualization, or lightweight CAD. They can render simple scenes well, but AECO workloads are different:

- models can contain hundreds of thousands of objects
- coordinates may sit on national survey grids
- users need fast selection, filtering, hiding, sectioning, and recoloring
- geometry must remain linked to IFC-style semantic data
- projects often combine BIM, drawings, point clouds, GIS-style data, and reality capture

xeokit was designed around those constraints.

---

## Core Advantages

### Real-World Coordinate Accuracy

AECO models often use large real-world coordinates from surveys, GIS systems, or infrastructure alignments. Many viewers avoid precision problems by moving geometry near the origin, which can break federation, round-tripping, and integration with other systems.

xeokit keeps source-coordinate meaning in the scene graph and lets the renderer handle precision automatically with fine-grained RTC placement. Applications do not need to manually rebase geometry or manage renderer coordinate tiles.

Business impact:

- fewer alignment problems in federated models
- better fit for GIS, infrastructure, and digital-twin workflows
- less custom coordinate handling in product code

### Large-Model Interaction

Large AECO models are not just viewed; they are queried, filtered, sectioned, recolored, and inspected. Traditional browser renderers often stall when many object states change.

xeokit stores per-object render state in GPU data textures. Visibility, selection, x-ray, opacity, and color changes are lightweight state updates rather than geometry rebuilds.

Business impact:

- responsive interaction on large models
- lower hardware requirements
- better user experience for cloud-delivered applications

### WebGL and WebGPU Rendering

xeokit V3 treats rendering as a replaceable backend behind the same viewer-facing API.
Applications can use the established WebGL renderer or the newer WebGPU renderer without
rewriting their scene, data, camera, or interaction code.

WebGPU is now a first-class renderer backend. It is designed for large BIM, CAD, city,
point cloud, Gaussian splat, and streaming workloads, with WebGPU-native buffer
management, render passes, post-processing, picking, snapping, memory diagnostics, and
frame diagnostics.

Business impact:

- a forward path to modern browser GPU APIs
- renderer choice without changing the product's scene/data model
- better visibility into rendering cost, memory pressure, and streaming behavior

### BIM Data Model

xeokit separates the visual model from the semantic data model while keeping them joined by object ID. A product can ask BIM-level questions and immediately reflect the answer in the viewer.

Examples:

- show all HVAC equipment on Level 3
- isolate fire-rated walls
- highlight objects linked to an issue
- inspect data relationships without touching renderer internals

Business impact:

- faster development of BIM-aware tools
- cleaner integration with data panels, search, analytics, and reporting
- less glue code between geometry and metadata

---

## Product Capabilities

xeokit provides reusable building blocks for:

- model loading and conversion
- WebGL and WebGPU rendering
- camera navigation and multi-view layouts
- object selection, hiding, x-ray, highlighting, and sectioning
- measurements and snapping
- semantic BIM search and inspection
- spatial queries and picking
- BCF viewpoint interoperability
- import/export workflows

It supports the formats commonly needed in AECO products, including IFC, glTF/GLB, XGF, XKT, DWG, DXF, PDF, SVG, LAS/LAZ, E57, CityJSON, 3D Tiles, OBJ, FBX, USDZ, DotBIM, 3DXML, and scene/data JSON.

---

## Examples and Validation Surface

The SDK is backed by a broad website example suite rather than isolated code snippets.
The current generated catalog contains more than 140 examples covering getting-started
flows, direct model authoring, import/export, streaming, renderer benchmarks, WebGPU
comparison pages, picking, snapping, sectioning, LOD, drawing workflows, heatmaps, sun
studies, schedules, and presentation tools.

These examples serve two purposes:

- they show product teams how to compose SDK modules into real browser workflows
- they continuously exercise renderer, loader, exporter, interaction, and workflow paths

Some example functionality is intentionally kept outside the SDK as website support code.
Reusable browser helpers live under website libraries for examples, authoring, UI,
presentations, and Studio. That keeps the SDK API focused while still demonstrating
complete application workflows.

Business impact:

- faster evaluation by product and engineering teams
- concrete reference implementations for common AECO workflows
- lower risk when adopting newer capabilities such as WebGPU, XGF Stream, splats, and
  drawing-sheet workflows

---

## Dataset Generation and Pipelines

Modern AECO applications need more than file loading. They also need repeatable ways to
prepare, split, convert, validate, benchmark, and regenerate datasets.

V3's headless scene and data architecture supports that directly. The repository includes
website-side tools for:

- converting model assets and building XGF/XGF Stream datasets
- generating procedural cities and buildings for repeatable stress tests
- building Natural Earth globe streams
- authoring LOD assets and 3D Tiles example datasets
- rebuilding model catalogs, screenshots, docs, and benchmark assets

The strategic point is not that every product should copy those exact scripts. The value
is that the same SDK concepts used in the browser viewer can also run in Node.js asset
pipelines. That reduces the split between "offline conversion code" and "online viewer
code".

Business impact:

- repeatable dataset preparation for CI, demos, benchmarks, and customer content
- less duplicated logic between conversion tooling and viewer runtime
- clearer path from raw source data to streamable browser-ready assets

---

## Strategic Positioning

xeokit sits between three less suitable options:

| Option | Limitation |
|---|---|
| Desktop BIM tools | Powerful, but heavy and difficult to deploy broadly |
| Generic WebGL/game engines | Fast, but not built around BIM semantics or engineering coordinates |
| Simple web BIM viewers | Easy to embed, but limited as a product foundation |

xeokit is positioned as a web-native, AECO-specific SDK for teams building their own products rather than embedding a fixed viewer.

---

## Commercial Value

For product teams, xeokit can reduce the amount of infrastructure they need to build before they can deliver workflow-specific value.

Potential advantages:

- faster product development
- better support for large enterprise models
- less risk around coordinate precision and model federation
- reusable visualization infrastructure across multiple products
- stronger foundation for SaaS, digital twin, coordination, and operations workflows

---

## Engineering Model

The SDK builds on years of prior xeokit engine work and the mature xeokit V2 codebase. Its core architecture was designed by experienced engineers; AI assistance was used to accelerate implementation of additional capabilities within that architecture.

All AI-assisted work was reviewed, tested, and integrated deliberately. The result is not a generated prototype, but an engineered SDK with human-owned architecture and verification.

---

## Plain English Summary

xeokit is a high-performance browser SDK for BIM and AECO applications.

Its main strengths are:

1. handling massive engineering models efficiently
2. preserving real-world coordinate accuracy
3. keeping geometry connected to BIM data
4. enabling rich interaction in the browser
5. serving as a reusable foundation for larger products
