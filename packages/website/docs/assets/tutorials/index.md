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

1. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/ifc-to-xgf.md" target="_blank" rel="noopener noreferrer">Convert IFC to XGF and View It with xeokit V3</a>**
   `ifc-to-xgf.md`
   Convert an IFC file to XGF assets and load the result in a viewer.

2. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/ifc-to-xgf-with-loaders-exporters.md" target="_blank" rel="noopener noreferrer">Convert IFC to XGF and DataModel JSON with Loaders and Exporters</a>**
   `ifc-to-xgf-with-loaders-exporters.md`
   Use SDK loaders and exporters to produce both visual XGF data and semantic
   DataModel JSON.

3. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/xeoconvert-cli.md" target="_blank" rel="noopener noreferrer">Use the xeoconvert CLI</a>**
   `xeoconvert-cli.md`
   Convert, inspect, repair and report on model assets from a terminal or CI
   pipeline.

4. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/modelconverter.md" target="_blank" rel="noopener noreferrer">Use ModelConverter Programmatically</a>**
   `modelconverter.md`
   Configure loaders, exporters and pipelines from TypeScript and handle
   converted output data in code.

5. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/gltf-realistic-house-plan.md" target="_blank" rel="noopener noreferrer">Load a glTF Model with Realistic Rendering</a>**
   `gltf-realistic-house-plan.md`
   Load a glTF house-plan model and configure lighting, materials, tone mapping
   and environment maps for realistic presentation.

6. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/fast-rendering-many-objects.md" target="_blank" rel="noopener noreferrer">Fast Rendering for Many Objects</a>**
   `fast-rendering-many-objects.md`
   Configure loading, model construction and view settings for high
   interactivity with many objects.

---

## 2. Interaction and Views

7. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/picking-and-snapping.md" target="_blank" rel="noopener noreferrer">Picking and Snapping with xeokit SDK</a>**
   `picking-and-snapping.md`
   Perform object, mesh, vertex and edge picking with BVH and renderer-backed
   strategies.

8. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/xgf-streaming-dataset.md" target="_blank" rel="noopener noreferrer">Create and Stream an XGF Dataset</a>**
   `xgf-streaming-dataset.md`
   Create a streamed XGF dataset and load it with frustum-prioritized streaming
   and model navigation.

9. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/two-views.md" target="_blank" rel="noopener noreferrer">View a Model in Two Views</a>**
   `two-views.md`
   Display one loaded model in two independent views with shared scene content
   and separate view state.

10. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/load-federated-scenemodels.md" target="_blank" rel="noopener noreferrer">Load Federated SceneModels</a>**
   `load-federated-scenemodels.md`
   Load multiple XGF/DataModel JSON pairs into one viewer as a federated
   project.

---

## 3. SceneModel Authoring

11. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel.md" target="_blank" rel="noopener noreferrer">Programmatically Author and View a SceneModel</a>**
   `author-scenemodel.md`
   Create a simple authored model with geometry, meshes, objects, a viewer and
   view state.

12. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-batching.md" target="_blank" rel="noopener noreferrer">SceneModel Authoring with Batches and Sealing</a>**
    `author-scenemodel-batching.md`
    Understand direct creation, construction batching, whole-model building,
    lifecycle hints and sealed models.

13. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-reusable-geometry.md" target="_blank" rel="noopener noreferrer">Author Reusable Geometry and Mesh Instances</a>**
    `author-scenemodel-reusable-geometry.md`
    Reuse one geometry across many meshes and objects for efficient authored
    content.

14. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-semantics.md" target="_blank" rel="noopener noreferrer">Author SceneModel Objects and DataModel Semantics</a>**
    `author-scenemodel-semantics.md`
    Pair renderable `SceneObject`s with semantic `DataObject`s, property sets
    and relationships.

15. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-layers-view-state.md" target="_blank" rel="noopener noreferrer">Author SceneModel Layers and View State</a>**
    `author-scenemodel-layers-view-state.md`
    Use layers and per-view `ViewObject` state for visibility, selection,
    highlighting and presentation control.

16. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-transforms.md" target="_blank" rel="noopener noreferrer">Author SceneModel Transforms and Hierarchies</a>**
    `author-scenemodel-transforms.md`
    Build transform hierarchies and place meshes with reusable local transforms.

17. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-materials-textures.md" target="_blank" rel="noopener noreferrer">Author SceneModel Materials and Textures</a>**
    `author-scenemodel-materials-textures.md`
    Author reusable materials, texture slots and mesh-local appearance.

18. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-lines-points-overlays.md" target="_blank" rel="noopener noreferrer">Author SceneModel Lines, Points and Overlays</a>**
    `author-scenemodel-lines-points-overlays.md`
    Add line primitives, point primitives and overlay-style authored content.

19. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-export-xgf.md" target="_blank" rel="noopener noreferrer">Export an Authored SceneModel to XGF</a>**
    `author-scenemodel-export-xgf.md`
    Persist authored visual content as XGF and export matching DataModel JSON.

20. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-validate-inspect.md" target="_blank" rel="noopener noreferrer">Validate and Inspect Authored SceneModels</a>**
    `author-scenemodel-validate-inspect.md`
    Check authored models with `SDKResult` handling, stats, inspection reports
    and export/reload round-trips.

21. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-repair-optimize.md" target="_blank" rel="noopener noreferrer">Repair and Optimize Authored SceneModels</a>**
    `author-scenemodel-repair-optimize.md`
    Use scene-model inspection reports, fix strategies and optimizer passes
    before export.

22. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/tutorials/author-scenemodel-metadata-properties.md" target="_blank" rel="noopener noreferrer">Author SceneModel Metadata and Property Workflows</a>**
    `author-scenemodel-metadata-properties.md`
    Define stable IDs, property sets, semantic relationships, schema checks and
    paired visual/semantic exports.

---

## 4. Reference Notes

23. **<a href="https://github.com/xeokit/sdk/blob/develop/packages/sdk/assets/whitepapers/scene-update-hints.md" target="_blank" rel="noopener noreferrer">SceneModel updateHint - Runtime Value Uploads</a>**
    `scene-update-hints.md`
    Understand static and dynamic `SceneModel.updateHint` behavior, including
    how the hints affect renderer-side storage and runtime value uploads.
