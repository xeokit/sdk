![APHS Model](https://xeokit.github.io/sdk/images/holterTower.png "BIM Model Viewed with xeokit SDK")

# Abstract

This whitepaper presents the architectural and functional advancements introduced in **xeokit V3**, a major evolution of the xeokit WebGL-based 3D engine driven by real-world requirements from xeokit V2 users. The new version introduces a redesigned rendering and data architecture that improves precision, scalability, interoperability, and developer ergonomics for large-scale 3D and AEC applications.

A central innovation is the decoupling of **RTC (relative-to-center) precision management from geometry batching**, enabling stable rendering across large coordinate spaces while allowing objects to move freely throughout the scene. Combined with a double-precision world model and GPU-friendly data textures, this approach preserves numerical stability without restricting object mobility or scene complexity. xeokit V3 also introduces **automatic reconciliation of multiple coordinate systems**, allowing models authored with different axis conventions, units, and spatial definitions to coexist seamlessly in a single scene without altering their source geometry.

The engine architecture has been significantly refactored to support **fully dynamic scenes**, where objects, meshes, materials, and transforms can be created, modified, or removed at runtime. This capability is complemented by a **strongly typed event system** and an explicit **monadic error model**, enabling predictable control flow, improved debugging, and compile-time guarantees in TypeScript environments.

Beyond rendering improvements, xeokit V3 introduces a flexible **Entity–Relationship semantic data model** capable of representing complex graph-based relationships across multiple AEC schemas such as IFC and CityGML. A unified **loader, exporter, and conversion API** further supports cross-platform workflows in both browser and Node.js environments, enabling composable pipelines for model ingestion and transformation.

Architecturally, xeokit V3 emphasizes **separation of concerns**, clearly distinguishing the roles of scene data structures, viewers, and renderers within an event-driven pipeline. This modular design enables features such as multi-canvas synchronized views, extensible rendering implementations, and advanced inspection tooling. The renderer itself is intentionally exposed as a **transparent, inspectable system**, allowing developers to analyze performance, debug rendering behavior, and build custom diagnostic interfaces.

Together, these improvements establish xeokit V3 as a more modular, precise, and extensible platform for building high-performance 3D visualization applications, particularly in domains requiring large-scale spatial data, heterogeneous model integration, and robust runtime interaction.



# xeokit V2 -> V3 Features Overview

* Features overview
* All features are driven by use real cases defined by users of xeokit 2

## RTC coordinate system

* GPU math is typically limited to 32-bit floating point, which means precision drops off as world coordinates get
  large (you start to see jittering, z-fighting, and unstable transforms far from the origin).

* The standard workaround is an **RTC (relative-to-center) tiled coordinate system**. The world is partitioned into
  tiles, and geometry inside each tile is rendered in a local coordinate frame relative to that tile’s center. At draw
  time, we adjust the view matrix for the tile by applying a translation equal to the vector from the global origin to
  the tile center, effectively “recentering” the numbers the GPU operates on.

* In **xeokit V2**, we apply RTC by:

  * Storing vertex positions **relative to the tile center**.
  * **Batching** many objects together to reduce draw calls.
  * Typically combining everything in a tile into a single mesh, so the whole tile can be drawn in one draw call, with
    the view matrix RTC-adjusted per tile just before the draw.

  The downside is that batching ties objects to their tile. Because batches are implemented as VBOs, it’s not practical
  to move objects between batches (and therefore between tiles). You can push objects around with transforms to a point,
  but once they drift too far from the tile center, precision degrades again.

* In **xeokit V3**, we remove that coupling between batching and tiling. Objects can move freely across the full world
  space:

  * We still batch for performance, but batches are **not tile-owned**.
  * Batch data lives in **data textures**, which the shader can index from anywhere.
  * Each object effectively points to the RTC frame (and associated RTC-adjusted view matrix) it should use. When an
    object crosses into a new tile, we update a lightweight pointer in a data texture, rather than physically moving
    geometry between VBOs.

* The result in **xeokit V3** is a transparent, internally managed tiled RTC system: the user doesn’t need to think
  about tiles, yet transforms remain robust and dynamic across the whole scene, while the engine maintains a
  double-precision world model under the hood.

## Import Models from Multiple Coordinate Systems

* In xeokit V3, we support loading models authored in different coordinate systems into the same scene — without
  modifying their original geometry or transforms.

* Each model retains its native coordinate system along with associated metadata, such as:

  * Axis orientation (eg. Y-up vs Z-up)
  * Units
  * Scale
  * Other spatial conventions

* The scene itself is configured with its own coordinate system definition. This might differ from the systems used by
  the models being loaded.

* When a model is added to the scene, xeokit automatically performs the necessary conversions to align it with the
  scene’s coordinate system. These adjustments happen at the transform level — the underlying vertex data remains in the
  model’s original coordinate frame.

* The important design principle is that we preserve the source data. As long as we have metadata (explicit or inferred)
  describing the coordinate system a model was authored in, xeokit can reconcile multiple coordinate systems
  transparently and render them together in a single, coherent scene.

## Dynamically Editable Scene Models

* In xeokit V3, the scene is designed to be fully dynamic and editable at runtime. You can create, modify, and delete
  objects, meshes, geometries, materials, and transforms on the fly. As we do this, the viewer automatically reacts to
 these changes and updates the rendered view accordingly. In conjunction to pre-allocated data textures, this allows for
 streaming since the allocation overhead is minimized.

## Handle Error Conditions Explicitly Using Monads

* In xeokit V3, we do not throw exceptions as part of normal control flow.

* Instead, any operation that may fail or produce side effects returns an **SDKResult** — a monadic wrapper that
  represents either:

  * A successful result, or
  * An explicit error state.

* This makes error handling part of the type system rather than something implicit or optional.

* Because SDKResult is expressed in TypeScript, callers are required to acknowledge and handle the possibility of
  failure. You can’t accidentally ignore an error — it’s encoded in the return type.

* The result is a more predictable and explicit error model:

  * No hidden control flow through exceptions
  * Clear success/error branching
  * Stronger guarantees enforced at compile time

## Strongly-Typed Events

* In xeokit V3, each major subsystem — such as the scene, data model, and viewer — exposes its own well-defined set of
  event emitters.

* These emitters produce events for every state change within their subsystem. When combined with TypeScript, this
  means:

  * Event channels are strongly typed
  * Payloads are explicit and self-documenting
  * Consumers get compile-time guarantees about what each event carries

* For example, the scene graph — which manages objects, meshes, geometries, materials, and transforms — emits events
  whenever elements are created, updated, or destroyed.

* When a scene is attached to a viewer, the viewer subscribes to the scene’s events and reacts accordingly. This
  event-driven boundary allows subsystems to remain loosely coupled:

  * The scene does not need to know about the viewer
  * The viewer derives its state purely from observable changes

* Because all state transitions flow through typed events, it also becomes straightforward to inspect and trace system
  behavior. You can observe event streams directly, making debugging and state analysis much more transparent.

## Entity–Relationship Data Model

* In xeokit V2, semantic data is modeled as an aggregation hierarchy: meta objects arranged in a tree and linked to
  property sets. This works well for IFC-style structures and assemblies, but it assumes a strict parent–child tree and
  cannot represent richer graph relationships.

* In xeokit V3, we replace this with a generalized **Entity–Relationship (ER) graph**:

  * Entities connected by typed relationships
  * Not limited to aggregation
  * Structured as a graph, not just a tree

* The ER graph can still represent IFC hierarchies, making it compatible with xeokit V2 metadata, but it also supports
  many-to-many relationships, cross-links, and arbitrary semantic structures.

* Multiple semantic models can coexist in the same graph — for example IFC4, IFC2x3, CityGML, or custom schemas —
  enabling xeokit V3 to support a much broader range of AEC semantic data.

## Cohesive Loaders, Exporters, and Converters API

* In xeokit V3, loaders and exporters for different file formats all implement a shared, standardized interface. This
  gives them a consistent API and makes them interchangeable components.

* These classes operate on scenes and semantic data models, which are themselves usable in both Node.js and the browser.
  As a result:

  * You can load, transform, and export models in Node.js
  * You can load and download models directly in the browser
  * The same APIs apply in both environments

* Because the interfaces are standardized, loaders and exporters can be easily composed into pipelines. This makes
  format conversion straightforward.

* To formalize that workflow, xeokit V3 includes a **ModelConverter**:

  * It aggregates all available loaders and exporters
  * It can convert datasets consisting of multiple files and formats
  * It runs in both Node.js and the browser

* ModelConverter is also exposed as a Node.js CLI tool, allowing you to convert files (or groups of files) via a defined
  pipeline of loaders and exporters directly from the command line.

The result is a coherent, composable I/O layer: load, transform, and export using the same abstractions everywhere.

## Separation of Concerns

* Good software design aims to divide systems into components with clear, single responsibilities.

* In xeokit V2, some responsibilities were coupled. For example, the scene representation and the renderer were tightly
  integrated — the scene effectively rendered itself. This meant:

  * The scene could not be rendered by alternative rendering strategies
  * The scene representation could not easily be reused for non-rendering purposes

* In xeokit V3, these concerns are cleanly separated.

  * The **scene** is purely a data structure.
    It manages objects, meshes, geometries, materials, and transforms.
    It emits strongly-typed events whenever state changes occur.
    It has no knowledge of viewers, renderers, loaders, or exporters.

  * A **viewer** subscribes to the scene’s events and maintains its own rendering state accordingly.
    The scene does not know who is listening — it simply publishes changes.

* Another example is spatial boundary tracking. Rather than embedding 3D boundary logic directly into the scene, xeokit
  V3 factors it out into a separate `SceneAABBIndex` component:

  * It listens to scene events
  * It maintains a synchronized index of object bounds
  * It remains independent of the scene’s core responsibilities

The result is a more modular architecture: components are decoupled, responsibilities are explicit, and systems can
evolve or be replaced independently.

## Viewer and Renderer

* In xeokit V3, the **viewer** and the **renderer** are distinct components with clearly separated responsibilities.

* The **viewer** subscribes to a scene’s events and maintains a visual state derived from the scene. It acts as a
  mediator:

  * It exposes an API for controlling visual aspects such as visibility, x-ray, slicing, camera movement, and other
    presentation states.
  * It publishes its own events when those visual states change.
  * It does not perform low-level rendering itself.

* The **renderer** sits behind the viewer. It subscribes to the viewer’s events and renders the resulting visual state
  to one or more canvases.

* This layering creates a clean pipeline:

  * Scene → Viewer → Renderer
    Each layer reacts to events from the one above it, without tight coupling.

* Currently, xeokit V3 provides a `WebGLRenderer` implementation of the renderer interface.

## Multiple Views

* In xeokit V3, the viewer can render an independent view of the same scene to multiple canvases. In one canvas, you
  could have a perspective view, while in another canvas you have an orthographic top-down view. Both views are derived
  from the same scene and remain synchronized as the scene changes. Through the viewer, you can set different camera
 parameters, clipping planes, and other visual states for each view, including the visibilities aand effects applied to the objects,
 while the underlying scene data remains consistent and shared across all views.

## Renderer Internal API

* Building a 3D engine presents two recurring challenges:

  * Understanding why nothing is rendering, or why an image looks incorrect
  * Ensuring performance remains optimal and detecting hidden inefficiencies

* To address this, the xeokit V3 renderer is designed as a **“white box” system** rather than a black box.

  * Key internal components are exposed as `@internal` TypeScript APIs.
  * These APIs allow inspection of renderer state and subsystems.
  * They are fully documented and explain how the renderer works internally.

* This internal surface enables:

  * Deep inspection via browser developer tools
  * Custom debugging dashboards
  * Performance analysis tooling

* All live examples include an **“Open Inspectors”** button, which launches an overlay dashboard.
  The dashboard contains inspector panels that visualize:

  * Renderer performance and resource usage
  * Scene and data model summaries
  * Other internal SDK subsystems

The goal is transparency: the renderer can be observed, profiled, and reasoned about while it is running.


## Data-Driven Components

- Scene, Data, Viewer - can be serialized to and from JSON. 
- Ability to save and restore Viewer setup supports reproduction of bugs.




