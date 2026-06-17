---
title: xeokit SDK — Executive Whitepaper
---

# xeokit SDK — Executive Overview

*A non-technical guide for understanding what the SDK does, why it matters, and where it creates business value.*

---

# Executive Summary

The xeokit SDK is a platform for building high-performance 3D applications for Architecture, Engineering, Construction,
and Operations (AECO).

In simple terms:

- It allows extremely large building and infrastructure models to run smoothly in a browser.
- It preserves real-world engineering coordinates accurately.
- It enables rich interaction with BIM data at scale.
- It supports both 3D models and 2D drawings in the same environment.
- It is designed as an extensible foundation for products, not just a viewer.

The SDK is optimized for the types of workflows modern AECO software increasingly depends on:

- BIM coordination
- Digital twins
- Construction planning
- Facility operations
- Clash detection
- Model federation
- Interactive drawings
- Spatial analytics
- Multi-user visualization
- Cloud delivery

The core strategic advantage of xeokit is that it solves several deep technical problems that many browser-based BIM
platforms struggle with.

---

# What Makes xeokit Different

Most 3D web viewers are originally designed for:

- games
- product visualization
- simple CAD scenes

Those systems often break down when handling:

- million-object BIM models
- real-world survey coordinates
- interactive filtering and selection
- federated infrastructure scenes
- engineering-scale datasets

xeokit was designed specifically around AECO problems from the beginning.

Two architectural decisions are especially important.

---

# 1. Accurate Real-World Coordinates

## The Industry Problem

Most BIM viewers silently move models closer to the origin of the world to avoid graphics precision problems.

That works for small isolated models.

But it creates major issues for:

- GIS integration
- surveyed infrastructure
- multiple federated models
- infrastructure corridors
- rail
- utilities
- airports
- city-scale digital twins

These workflows require preserving exact engineering coordinates.

## xeokit’s Approach

xeokit keeps native engineering coordinates intact internally while still rendering smoothly in the browser.

Business impact:

- models align correctly without manual adjustment
- easier integration with GIS and surveying systems
- more reliable coordination workflows
- scalable to infrastructure and city-scale projects

This is one of the platform’s strongest differentiators for enterprise and infrastructure use cases.

---

# 2. High-Performance Interaction at Massive Scale

## The Industry Problem

Traditional browser renderers slow down dramatically when users:

- hide/show objects
- select thousands of elements
- isolate systems
- apply filters
- recolor models
- create section views

Many systems require expensive geometry rebuilding whenever visual states change.

This creates lag and poor user experience.

## xeokit’s Approach

xeokit uses a highly optimized GPU-driven rendering architecture.

Instead of rebuilding geometry constantly, the SDK updates lightweight GPU state tables.

Result:

- instant visibility changes
- fast selection highlighting
- responsive filtering
- scalable interaction with very large BIM datasets

Business impact:

- smoother user experience
- lower hardware requirements
- better performance on integrated GPUs and laptops
- improved scalability for cloud delivery

---

# What This Means for Products

The SDK is not just a viewer.

It is a platform for building:

- BIM viewers
- digital twins
- coordination tools
- construction planning tools
- facilities dashboards
- engineering review systems
- model analytics platforms
- simulation environments

It provides:

- rendering
- interaction
- model loading
- semantic BIM data
- measurements
- sectioning
- drawing generation
- camera systems
- spatial queries
- visual effects
- interoperability standards

as reusable building blocks.

---

# Core Product Capabilities

## BIM + Semantic Data

xeokit separates:

- what the model *looks like*
  from
- what the model *means*

This is important because AECO workflows depend heavily on semantic BIM information.

Example:

- “Show all HVAC systems on Level 3”
- “Highlight all fire-rated walls”
- “Select all objects related to this issue”

The SDK is built to support these workflows efficiently.

---

# Large Model Performance

The SDK is designed for:

- millions of triangles
- hundreds of thousands of objects
- federated BIM scenes

while maintaining responsive interaction.

This is critical for:

- enterprise BIM
- infrastructure projects
- digital twins
- operations platforms

---

# Multi-View Architecture

Multiple synchronized views can exist simultaneously:

- perspective 3D
- plan views
- section views
- elevations
- mini-maps
- comparison views

without duplicating geometry in memory.

This enables professional workflows similar to desktop BIM tools.

---

# Drawings + 3D Together

xeokit supports:

- IFC
- glTF
- DWG
- DXF
- PDF
- SVG
- point clouds
- 3D Gaussian Splatting (reality capture)
- CityJSON
- STEP
- OBJ

This allows combining:

- 3D BIM
- engineering drawings
- documentation
- scanned data
- GIS-style content

inside one platform.

---

# Interoperability

The SDK supports industry workflows and standards such as:

- IFC
- BCF
- glTF
- STEP
- CAD formats
- point cloud formats

This reduces vendor lock-in and improves ecosystem compatibility.

---

# Presentation & Visualization Features

The platform includes advanced visualization systems:

- section planes
- section caps
- exploded views
- heatmaps
- hidden-line rendering
- x-ray modes
- edge rendering
- lighting and materials
- ambient occlusion
- bloom and post-processing

This allows products built on xeokit to look polished and modern without requiring a game engine.

---

# Strategic Positioning

xeokit occupies a valuable middle ground between:

| Category | Limitation |
|---|---|
| Traditional desktop BIM tools | Heavy, difficult to deploy, not web-native |
| Generic WebGL/game engines | Not optimized for AECO workflows |
| Simple BIM viewers | Limited scalability and extensibility |

xeokit is positioned as:

- web-native
- scalable
- AECO-specific
- extensible
- developer-focused

This makes it suitable as foundational infrastructure for SaaS products.

---

# How the SDK Was Built

The SDK's core architecture was designed and built by an experienced engineer, drawing on years of prior work building
browser-based 3D engines. AI tools were then used to accelerate delivery of additional capabilities — such as model
format support and visual effects — within that established architecture, using the mature xeokit V2 codebase as a
proven reference.

Every AI-assisted contribution was reviewed, tested, and inspected by a human before being accepted. The result is a
codebase produced deliberately and verified throughout.

Business impact:

- a foundation built on proven engineering experience, rather than unchecked code generation
- lower long-term maintenance and reliability risk
- faster delivery of capabilities without sacrificing quality
- confidence for products that depend on the SDK over many years

---

# Why This Matters Commercially

The market is moving toward:

- browser-based workflows
- cloud collaboration
- digital twins
- remote coordination
- operational analytics
- lightweight deployment
- integrated BIM ecosystems

Performance and scalability increasingly determine product viability.

xeokit’s architecture enables:

- lower friction deployment
- reduced client hardware requirements
- faster interaction
- support for larger datasets
- more sophisticated workflows

These become meaningful competitive advantages over time.

---

# Potential Business Advantages

## Faster Product Development

Because the SDK already solves:

- rendering
- BIM loading
- navigation
- measurements
- selection
- sectioning
- spatial queries
- camera systems

teams can focus on product-specific workflows rather than rebuilding infrastructure.

---

## Enterprise Readiness

The architecture is well suited to:

- large models
- infrastructure projects
- federated BIM
- digital twins
- multi-user systems
- long-lived operational platforms

---

## Platform Potential

The SDK is broad enough to become:

- a product platform
- an internal standard
- a reusable visualization layer across multiple applications

rather than a single-purpose viewer.

---

# In Plain English

The easiest way to think about xeokit is:

> “A high-performance web engine specifically designed for BIM and AECO applications.”

Its biggest strengths are:

1. handling massive engineering models efficiently
2. preserving real-world spatial accuracy
3. enabling rich BIM interaction in the browser
4. supporting both 2D and 3D workflows
5. acting as a foundation for larger products

The technical architecture is unusually specialized for AECO needs, which is where much of its long-term value comes
from.