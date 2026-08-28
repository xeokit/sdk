---
title: Tutorial Index
---

# Tutorial Index

This page orders the xeokit SDK tutorials as a learning path. Start with data
conversion and viewing, then move into interaction, streaming and SceneModel
authoring.

---

## 1. Conversion and Loading

Use this section to choose the right conversion entry point. `xeoconvert` is
the command-line file format converter for shell, CI and asset-pipeline work;
`ModelConverter` is the same loader/exporter pipeline driven directly from
TypeScript or JavaScript.

1. **[Convert IFC to XGF and View It with xeokit V3](https://xeokit.github.io/sdk/docs/assets/tutorials/ifc-to-xgf.md)**
   `ifc-to-xgf.md`
   Convert an IFC file to XGF assets and load the result in a viewer.

2. **[Convert IFC to XGF and DataModel JSON with Loaders and Exporters](https://xeokit.github.io/sdk/docs/assets/tutorials/ifc-to-xgf-with-loaders-exporters.md)**
   `ifc-to-xgf-with-loaders-exporters.md`
   Use SDK loaders and exporters to produce both visual XGF data and semantic
   DataModel JSON.

3. **[Use the xeoconvert CLI](https://xeokit.github.io/sdk/docs/assets/tutorials/xeoconvert-cli.md)**
   `xeoconvert-cli.md`
   Convert, inspect, repair and report on model assets from a terminal or CI
   pipeline.

4. **[Use ModelConverter Programmatically](https://xeokit.github.io/sdk/docs/assets/tutorials/modelconverter.md)**
   `modelconverter.md`
   Configure loaders, exporters and pipelines from TypeScript and handle
   converted output data in code.

5. **[Load a glTF Model with Realistic Rendering](https://xeokit.github.io/sdk/docs/assets/tutorials/gltf-realistic-house-plan.md)**
   `gltf-realistic-house-plan.md`
   Load a glTF house-plan model and configure lighting, materials, tone mapping
   and environment maps for realistic presentation.

6. **[Fast Rendering for Many Objects](https://xeokit.github.io/sdk/docs/assets/tutorials/fast-rendering-many-objects.md)**
   `fast-rendering-many-objects.md`
   Configure loading, model construction and view settings for high
   interactivity with many objects.

---

## 2. Interaction and Views

7. **[Picking and Snapping with xeokit SDK](https://xeokit.github.io/sdk/docs/assets/tutorials/picking-and-snapping.md)**
   `picking-and-snapping.md`
   Perform object, mesh, vertex and edge picking with BVH and renderer-backed
   strategies.

8. **[Create and Stream an XGF Dataset](https://xeokit.github.io/sdk/docs/assets/tutorials/xgf-streaming-dataset.md)**
   `xgf-streaming-dataset.md`
   Create a streamed XGF dataset and load it with frustum-prioritized streaming
   and model navigation.

9. **[View a Model in Two Views](https://xeokit.github.io/sdk/docs/assets/tutorials/two-views.md)**
   `two-views.md`
   Display one loaded model in two independent views with shared scene content
   and separate view state.

10. **[Load Federated SceneModels](https://xeokit.github.io/sdk/docs/assets/tutorials/load-federated-scenemodels.md)**
   `load-federated-scenemodels.md`
   Load multiple XGF/DataModel JSON pairs into one viewer as a federated
   project.

---

## 3. SceneModel Authoring

11. **[Programmatically Author and View a SceneModel](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel.md)**
   `author-scenemodel.md`
   Create a simple authored model with geometry, meshes, objects, a viewer and
   view state.

12. **[SceneModel Authoring with Batches and Sealing](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-batching.md)**
    `author-scenemodel-batching.md`
    Understand direct creation, construction batching, whole-model building,
    lifecycle hints and sealed models.

13. **[Author Reusable Geometry and Mesh Instances](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-reusable-geometry.md)**
    `author-scenemodel-reusable-geometry.md`
    Reuse one geometry across many meshes and objects for efficient authored
    content.

14. **[Author SceneModel Objects and DataModel Semantics](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-semantics.md)**
    `author-scenemodel-semantics.md`
    Pair renderable `SceneObject`s with semantic `DataObject`s, property sets
    and relationships.

15. **[Author SceneModel Layers and View State](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-layers-view-state.md)**
    `author-scenemodel-layers-view-state.md`
    Use layers and per-view `ViewObject` state for visibility, selection,
    highlighting and presentation control.

16. **[Author SceneModel Transforms and Hierarchies](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-transforms.md)**
    `author-scenemodel-transforms.md`
    Build transform hierarchies and place meshes with reusable local transforms.

17. **[Author SceneModel Materials and Textures](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-materials-textures.md)**
    `author-scenemodel-materials-textures.md`
    Author reusable materials, texture slots and mesh-local appearance.

18. **[Author SceneModel Lines, Points and Overlays](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-lines-points-overlays.md)**
    `author-scenemodel-lines-points-overlays.md`
    Add line primitives, point primitives and overlay-style authored content.

19. **[Export an Authored SceneModel to XGF](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-export-xgf.md)**
    `author-scenemodel-export-xgf.md`
    Persist authored visual content as XGF and export matching DataModel JSON.

20. **[Validate and Inspect Authored SceneModels](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-validate-inspect.md)**
    `author-scenemodel-validate-inspect.md`
    Check authored models with `SDKResult` handling, stats, inspection reports
    and export/reload round-trips.

21. **[Repair and Optimize Authored SceneModels](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-repair-optimize.md)**
    `author-scenemodel-repair-optimize.md`
    Use scene-model inspection reports, fix strategies and optimizer passes
    before export.

22. **[Author SceneModel Metadata and Property Workflows](https://xeokit.github.io/sdk/docs/assets/tutorials/author-scenemodel-metadata-properties.md)**
    `author-scenemodel-metadata-properties.md`
    Define stable IDs, property sets, semantic relationships, schema checks and
    paired visual/semantic exports.
