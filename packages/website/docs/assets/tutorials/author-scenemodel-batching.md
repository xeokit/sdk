# SceneModel Authoring with Batches and Sealing

This tutorial builds on the canonical SceneModel authoring tutorial. The first tutorial shows how to create geometry, meshes, and objects directly. This tutorial explains how to organize those same creation calls when content is built in larger steps.

By default, a `SceneModel` starts with `lifecycle: "open"`, allowing components to be added as normal application code runs. This works well for small generated overlays and simple in-memory models.

Larger imports often need clearer construction boundaries. For example, an entire file may need to be parsed before its contents are presented, while a streaming model may publish content one chunk, storey, or tile at a time.

The SDK provides three main SceneModel concepts for handling these cases:

* `building` indicates that the model is being populated as part of a single, whole-model loading operation. Loaders typically use this while parsing complete files.
* `beginBatch()`, `commitBatch()`, and `rollbackBatch()` define a component creation batch. Components created while a batch is active are tracked in `SceneModel.activeBatch`. When the batch is committed, they are published as a named `SceneModelBatch`.
* `seal()` changes the model lifecycle to `"sealed"`, preventing new topology and resources from being added. After sealing, `createGeometry()`, `createMesh()`, `createObject()`, and `beginBatch()` reject new content.

`WebGLRenderer` and `WebGPURenderer` observe these lifecycle boundaries. While a model is `building` or has an active batch, the renderers defer SceneModel registrations. Once the construction boundary is complete, they register geometry, meshes, and objects in dependency order.

---

## 1. Choose a Construction Pattern

A SceneModel can be constructed in a few different ways. The component calls are
the same in each case; what changes is how you group and publish them.

### Direct component creation

Use direct component creation for small or interactive changes. Each successful
`create*` call is available to the scene immediately.

```javascript
const modelResult = scene.createModel({id: "small-model"});

if (!modelResult.ok) {
  throw new Error(modelResult.error);
}

const model = modelResult.value;

model.createGeometry({
  id: "quadGeometry",
  primitive: TrianglesPrimitive,
  positions: [
    0, 0, 0,
    1, 0, 0,
    1, 1, 0,
    0, 1, 0
  ],
  indices: [0, 1, 2, 0, 2, 3]
});

model.createMesh({
  id: "quadMesh",
  geometryId: "quadGeometry",
  color: [0.2, 0.5, 0.9]
});

model.createObject({
  id: "quad",
  meshIds: ["quadMesh"]
});
```

This is the simplest path and is usually enough for generated helper geometry,
temporary overlays, or small in-memory models.

### Component creation batches

Use a component creation batch when a group of related components should be
published together. A batch is useful when a storey, tile, import section, or
generated chunk has internal dependencies and should not be processed by the
renderer until the group is complete.

```javascript
const batchResult = model.beginBatch({id: "storey-03"});

if (!batchResult.ok) {
  throw new Error(batchResult.error);
}

try {
  createStoreyGeometry(model, storey);
  createStoreyMeshes(model, storey);
  createStoreyObjects(model, storey);

  const commitResult = model.commitBatch();
  if (!commitResult.ok) {
    throw new Error(commitResult.error);
  }
} catch (error) {
  model.rollbackBatch();
  throw error;
}
```

While the batch is active, created components are recorded in
`SceneModel.activeBatch`. After `commitBatch()`, the returned `SceneModelBatch`
identifies the components that were created in that construction interval.

### Whole-model building

Use the `building` state when an importer or loader creates most or all of a
model during one long parsing operation. This tells renderers to defer
registration until the whole loading operation has finished.

```javascript
model.building = true;

try {
  createSharedResources(model, source);
  createMeshesAndObjects(model, source);
} finally {
  model.building = false;
}
```

The `finally` block matters because `building` is a lifecycle state. If an import
fails, the model still needs to leave the building state so renderers and
application code do not treat it as an unfinished loading operation forever.

### Sealing completed models

Use `seal()` after construction when the model should no longer accept new
topology or resources. Sealing is a lifecycle transition, not a rendering call:
it closes the SceneModel's structure while leaving runtime view state available
through `ViewObject`s.

```javascript
createSharedResources(model);
createAllObjects(model);

const sealResult = model.seal();

if (!sealResult.ok) {
  throw new Error(sealResult.error);
}
```

After `seal()` succeeds, later calls such as `createGeometry()`, `createMesh()`,
`createObject()` and `beginBatch()` return validation errors instead of adding
more content.

---

## 2. Set Lifecycle and Memory Policy

`lifecycle` and `memoryPolicy` control different aspects of model construction. For most application code, focus on `lifecycle` first and leave `memoryPolicy` at its default.

A simple rule is:

* Set `lifecycle` when **how the model is constructed** matters.
* Set `memoryPolicy` only when **renderer memory allocation** matters.

`lifecycle` is the primary authoring concept. It describes whether the model is still open for growth, receiving streamed construction units, or closed to new topology.

`memoryPolicy` is an advanced renderer hint. It describes whether renderer-side storage should remain easy to expand or can be sized more tightly around completed content.

### Lifecycle options

`lifecycle` determines whether the SceneModel can continue to grow:

* `"open"` is the default. Components can be added until the model is destroyed or sealed. Use it for direct authoring, small generated overlays, and models that may continue receiving ad-hoc additions.
* `"streaming"` is intended for incremental construction over time. New components can continue to arrive, while committed batches give renderers stable construction units to process.
* `"sealed"` means the model is closed to new topology. Normally, you reach this state by calling `seal()` after construction rather than creating an empty sealed model.

### Memory policy options

`memoryPolicy` tells renderers how to approach backing-storage allocation:

* `"stream"` is the default. Renderers may use growable or reusable storage that can accept additional content without repacking.
* `"compact"` asks renderers to minimize avoidable unused capacity for finalized models or committed streaming batches. Use it when memory footprint is more important than inexpensive future growth.

`memoryPolicy` is only a renderer allocation hint. It is not a hard heap budget, does not change public SceneModel data, and does not determine how frequently runtime values such as matrices, colors, or visibility flags change. Use `updateHint` to communicate expected upload frequency.

For the simplest setup:

* Omit both fields for normal direct authoring.
* Set `lifecycle: "streaming"` when components arrive over time.
* Set `memoryPolicy: "compact"` only for finalized content or committed batches whose contents are expected to remain immutable.
* Call `seal()` when the model is complete and should reject new topology.

For a model that receives batches over time:

```javascript
const model = scene.createModel({
  id: "batched-building",
  lifecycle: "streaming",
  memoryPolicy: "stream"
}).value;
```

This configuration favors incremental growth. The model can continue accepting component creation batches, while renderers can use append-friendly backing storage.

For a model that is built once and then sealed:

```javascript
const model = scene.createModel({
  id: "final-building",
  memoryPolicy: "compact"
}).value;
```

This configuration favors a smaller memory footprint after construction. Add all components first, then call `seal()` when the model is complete.

Common combinations include:

* `lifecycle: "open"`, `memoryPolicy: "stream"` for editable or ad-hoc generated content.
* `lifecycle: "streaming"`, `memoryPolicy: "stream"` for chunks, tiles, or storeys that continue arriving over time.
* `lifecycle: "streaming"`, `memoryPolicy: "compact"` for committed chunks that are expected to remain immutable after each commit.
* `memoryPolicy: "compact"` followed by `seal()` for one-shot generated models that are complete after construction.

These settings do not require renderers to preserve SceneModel batches as GPU draw batches. Instead, they provide `WebGLRenderer` and `WebGPURenderer` with construction and allocation information while keeping the SceneModel API renderer-neutral.

---

## 3. Commit a Batch

A component creation batch tracks all components created while that batch is active. A SceneModel can have only one active batch at a time.

```javascript
function addStorey(model, storeyIndex, boxes) {
  const beginResult = model.beginBatch({id: `storey-${storeyIndex}`});

  if (!beginResult.ok) {
    throw new Error(beginResult.error);
  }

  try {
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const objectId = `storey-${storeyIndex}-box-${i}`;
      const meshId = `${objectId}-mesh`;

      const meshResult = model.createMesh({
        id: meshId,
        geometryId: "boxGeometry",
        color: box.color,
        position: box.position,
        scale: box.scale
      });

      if (!meshResult.ok) {
        throw new Error(meshResult.error);
      }

      const objectResult = model.createObject({
        id: objectId,
        meshIds: [meshId]
      });

      if (!objectResult.ok) {
        throw new Error(objectResult.error);
      }
    }

    const commitResult = model.commitBatch();

    if (!commitResult.ok) {
      throw new Error(commitResult.error);
    }

    return commitResult.value;
  } catch (error) {
    model.rollbackBatch();
    throw error;
  }
}
```

When the batch commits, `commitBatch()` returns the resulting `SceneModelBatch`. The batch contains arrays such as `batch.geometries`, `batch.meshes`, and `batch.objects`, which can be useful for diagnostics, progress reporting, or custom indexing.

```javascript
const batch = addStorey(model, 2, [
  {
    position: [0, 0, 3],
    scale: [4, 3, 0.25],
    color: [0.65, 0.68, 0.7]
  }
]);

console.log("Committed objects:", batch.objects.map((object) => object.id));
```

---

## 4. Roll Back a Failed Batch

Use `rollbackBatch()` when content created in the active batch fails validation before the batch is committed.

```javascript
function addGeneratedChunk(model, chunkId, createContents) {
  const beginResult = model.beginBatch({id: chunkId});

  if (!beginResult.ok) {
    throw new Error(beginResult.error);
  }

  try {
    createContents();

    const commitResult = model.commitBatch();

    if (!commitResult.ok) {
      throw new Error(commitResult.error);
    }

    return commitResult.value;
  } catch (error) {
    const rollback = model.rollbackBatch();

    if (!rollback.ok) {
      console.warn(rollback.error);
    }

    throw error;
  }
}
```

Rollback destroys the components created in `SceneModel.activeBatch` in dependency order: objects, meshes, materials, transforms, geometries, and textures.

A batch can only be rolled back before `commitBatch()` succeeds.

---

## 5. Use the Building State for Whole-Model Imports

Most application code does not need to set `building` directly. It is primarily intended for loaders and custom importers that parse an entire source file into a single SceneModel.

```javascript
async function importCustomModel(scene, source) {
  const modelResult = scene.createModel({
    id: source.id,
    memoryPolicy: "compact"
  });

  if (!modelResult.ok) {
    throw new Error(modelResult.error);
  }

  const model = modelResult.value;

  model.building = true;

  try {
    createSharedResources(model, source);
    createMeshesAndObjects(model, source);
  } finally {
    model.building = false;
  }

  const sealResult = model.seal();

  if (!sealResult.ok) {
    throw new Error(sealResult.error);
  }

  return model;
}
```

While `building` is `true`, `WebGLRenderer` and `WebGPURenderer` defer registration of new geometry, meshes, and objects.

When `building` becomes `false`, the renderers process the deferred SceneModel registrations in geometry-to-mesh-to-object order. This ensures that renderer state is created only after the required dependencies are complete.

Always use a `finally` block when setting `building` manually. If a model is accidentally left in the building state, renderers cannot publish the completed content.

---

## 6. Seal a Finished Model

Call `seal()` after all topology and resources have been created:

```javascript
function finishStaticModel(model) {
  const result = model.seal();

  if (!result.ok) {
    throw new Error(result.error);
  }
}
```

A sealed model can still support runtime view state, including selection, highlighting, and visibility through `ViewObject`s. Sealing only prevents new SceneModel topology and resources from being added.

This is useful for generated models that become immutable after construction:

```javascript
const model = scene.createModel({
  id: "generated-fixture",
  memoryPolicy: "compact"
}).value;

createSharedResources(model);
createAllObjects(model);

const sealResult = model.seal();

if (!sealResult.ok) {
  throw new Error(sealResult.error);
}
```

Renderers may combine the sealed lifecycle with `memoryPolicy: "compact"` to allocate tightly sized renderer-side storage, such as VBOs, data textures, and renderer-side batch tables.

This can be particularly useful for large static models where minimizing memory usage is more important than reserving capacity for future growth.

---

## 7. How Renderers Interpret These Hints

SceneModel batches define **component creation boundaries**, not renderer draw-call boundaries.

Renderers interpret them as follows:

* If a component is created with no active batch and the model is not building, the renderer can register it immediately.
* If a component is created while `model.building` is `true`, registration is deferred until the model leaves the building state.
* If a component is created while `SceneModel.activeBatch` is active, registration is deferred until `commitBatch()` publishes the batch.
* If `rollbackBatch()` is called, the renderer discards deferred entries associated with that batch.
* Once a model is sealed, renderers can treat its topology as complete.

`WebGLRenderer` and `WebGPURenderer` follow the same high-level policy. Their internal GPU layouts differ, but both preserve the public SceneModel contract: create model components, commit component creation batches where appropriate, seal finalized models, and leave rendering details to the viewer and renderer.

---

## 8. Practical Patterns

For a **small generated overlay**, create components directly and leave the model open.

For a **large one-shot generated model**, set `model.building = true`, create all components, set `model.building = false`, and then call `seal()`.

For **streamed or paged authoring**, use `lifecycle: "streaming"` and commit one batch for each chunk, tile, storey, or import phase.

For **memory-sensitive static output**, use `memoryPolicy: "compact"` and seal the model after the final batch commits.

For **editable or frequently growing models**, keep `memoryPolicy: "stream"` and leave the model unsealed until the application has finished adding topology.
