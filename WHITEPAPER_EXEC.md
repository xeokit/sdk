---
title: xeokit SDK — Executive Whitepaper
---

# xeokit SDK — Executive Overview

*A non-technical summary of what the SDK does, why it matters, and where it creates business value.*

---

## Executive Summary

xeokit SDK is a web-native foundation for AECO applications: BIM viewers, digital twins, coordination tools, facilities dashboards, and model analytics products.

Its value is concentrated in three areas:

- **Scale** — large BIM and infrastructure models stay interactive in the browser.
- **Accuracy** — surveyed engineering coordinates remain meaningful instead of being flattened into viewer-local space.
- **BIM semantics** — model geometry and business data stay connected, so products can filter, select, inspect, and report on real building entities.

This makes xeokit more than a viewer. It is reusable infrastructure for products that need high-performance 3D, BIM data, model loading, interaction, measurements, sectioning, spatial queries, and standards-based interoperability.

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
- WebGL rendering
- camera navigation and multi-view layouts
- object selection, hiding, x-ray, highlighting, and sectioning
- measurements and snapping
- semantic BIM search and inspection
- spatial queries and picking
- BCF viewpoint interoperability
- import/export workflows

It supports the formats commonly needed in AECO products, including IFC, glTF/GLB, XGF, XKT, DWG, DXF, PDF, SVG, LAS/LAZ, E57, CityJSON, 3D Tiles, OBJ, FBX, USDZ, DotBIM, 3DXML, and scene/data JSON.

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
