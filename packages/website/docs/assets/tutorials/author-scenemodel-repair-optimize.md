---
title: Repair and Optimize Authored SceneModels
---

# Repair and Optimize Authored SceneModels

This tutorial shows how to repair and optimize a programmatically authored
`SceneModel` before exporting it or loading it into a viewer.

The validation tutorial checks whether a model is structurally sound. This
tutorial takes the next step: it uses the inspection report as a worklist for
automated fixes. The important concepts are:

- **Inspection is read-only.** `inspectSceneModel` walks the model and returns
  issues. It does not change geometry, meshes, materials, transforms or objects.
- **Fixing is explicit.** `applyFixes` consumes an `InspectionReport` and
  mutates the `SceneModel` through registered fix strategies.
- **Not every issue is fixable.** Some problems, such as malformed indices,
  dangling geometry references or transform cycles, need source-data changes.
  Other issues, such as duplicate geometries, unused resources or degenerate
  triangles, can often be fixed automatically.
- **Always re-inspect.** A repair pass changes the model. Run inspection again
  before exporting or handing the content to a renderer.

Run repair while the authored model is still open. Some fixes create, destroy
or reconnect `SceneModel` components and therefore need the same construction
phase as your authoring code.

---

## 1. Import the Repair APIs

Use the quality module alongside the normal scene and export modules.

```javascript
import {mkdir, writeFile} from "node:fs/promises";
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Scene} from "@xeokit/sdk/model/scene";
import {XGFExporter} from "@xeokit/sdk/formats/xgf";
import {
  applyFixes,
  applyFixesResultToJson,
  inspectSceneModel,
  inspectionReportToJson,
  optimizeSceneModel
} from "@xeokit/sdk/quality/sceneModel";

function valueFrom(result, operation) {
  if (!result.ok) {
    throw new Error(`${operation}: ${result.error}`);
  }
  return result.value;
}
```

`applyFixes` is the controlled repair tool. `optimizeSceneModel` is a
convenience orchestrator for the common oversized-geometry and unused-resource
cleanup path.

---

## 2. Author Content That Benefits from Cleanup

This example creates two byte-identical geometries and one unused material. The
model is valid, but it contains avoidable memory and batching cost.

```javascript
const scene = new Scene();

const sceneModel = valueFrom(scene.createModel({
  id: "repair-demo",
  coordinateSystem: {
    basis: [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ],
    origin: [0, 0, 0],
    units: "meters"
  },
  memoryPolicy: "compact"
}), "create SceneModel");

const boxPositions = [
  -0.5, -0.5, -0.5,
   0.5, -0.5, -0.5,
   0.5,  0.5, -0.5,
  -0.5,  0.5, -0.5,
  -0.5, -0.5,  0.5,
   0.5, -0.5,  0.5,
   0.5,  0.5,  0.5,
  -0.5,  0.5,  0.5
];

const boxIndices = [
  0, 1, 2, 0, 2, 3,
  4, 6, 5, 4, 7, 6,
  0, 4, 5, 0, 5, 1,
  1, 5, 6, 1, 6, 2,
  2, 6, 7, 2, 7, 3,
  3, 7, 4, 3, 4, 0
];

valueFrom(sceneModel.createGeometry({
  id: "unitBoxA",
  primitive: TrianglesPrimitive,
  positions: boxPositions,
  indices: boxIndices
}), "create unitBoxA");

valueFrom(sceneModel.createGeometry({
  id: "unitBoxB",
  primitive: TrianglesPrimitive,
  positions: boxPositions,
  indices: boxIndices
}), "create unitBoxB");

valueFrom(sceneModel.createMaterial({
  id: "concrete",
  color: [0.72, 0.72, 0.68],
  roughness: 0.85
}), "create concrete material");

valueFrom(sceneModel.createMaterial({
  id: "unused-redline",
  color: [1, 0.1, 0.05],
  roughness: 0.4
}), "create unused material");

function createBoxMeshObject(id, geometryId, position) {
  const meshId = `${id}-mesh`;

  valueFrom(sceneModel.createMesh({
    id: meshId,
    geometryId,
    materialId: "concrete",
    position,
    scale: [1, 2.5, 0.2]
  }), `create mesh ${meshId}`);

  valueFrom(sceneModel.createObject({
    id,
    meshIds: [meshId]
  }), `create object ${id}`);
}

createBoxMeshObject("wall-01", "unitBoxA", [-1.5, 1.25, 0]);
createBoxMeshObject("wall-02", "unitBoxB", [ 1.5, 1.25, 0]);
```

The two wall objects remain independently selectable because selection and
visibility belong to `SceneObject`s and `SceneMesh` instances. The duplicate
shape can still be collapsed to one reusable `SceneGeometry`.

---

## 3. Inspect with the Checks You Intend to Fix

Enable the opt-in checks that correspond to the cleanup pass you want.

```javascript
const beforeReport = inspectSceneModel({
  sceneModel,
  checkDuplicateGeometries: true,
  checkGeometryQuality: true,
  checkDenseGeometries: true,
  checkGeometryArrayLengths: true,
  maxVertices: 50000,
  maxPrimitives: 50000
});

if (beforeReport.errors.length > 0) {
  throw new Error(
    beforeReport.errors.map((issue) => issue.message).join("\n")
  );
}

for (const warning of beforeReport.warnings) {
  console.warn(`${warning.code}: ${warning.message}`);
}
```

Do not run automatic repair on a model with inspection errors. Errors indicate
broken invariants such as dangling references, malformed arrays or transform
cycles. Fix those at the source so later repair passes do not propagate bad
structure.

---

## 4. Apply a Controlled Set of Fixes

Pass the report to `applyFixes`. Use `codes` when you want to repair a known
set of issue types and leave the rest for review.

```javascript
const fixResult = applyFixes({
  sceneModel,
  report: beforeReport,
  codes: [
    "GEOMETRY_DUPLICATE",
    "GEOMETRY_UNUSED_VERTICES",
    "GEOMETRY_DUPLICATE_VERTICES",
    "GEOMETRY_DEGENERATE_TRIANGLES",
    "GEOMETRY_DUPLICATE_INDICES",
    "MATERIAL_UNUSED",
    "TEXTURE_UNUSED",
    "TRANSFORM_UNUSED"
  ],
  fixOverrides: {
    enableMergeDuplicateGeometries: true,
    enableCompactUnusedVertices: true,
    enableMergeDuplicateVertices: true,
    enableDropDegenerateTriangles: true,
    enableDropDuplicateTriangles: true,
    enableDropUnusedMaterial: true,
    enableDropUnusedTexture: true,
    enableDropUnusedTransform: true
  }
});

if (!fixResult.ok) {
  throw new Error(fixResult.error);
}

const fixSummary = fixResult.value;

if (fixSummary.errors.length > 0) {
  throw new Error(
    fixSummary.errors
      .map((outcome) => `${outcome.issue.code}: ${outcome.error}`)
      .join("\n")
  );
}

console.log(
  `fixed ${fixSummary.fixed.length}, ` +
  `skipped ${fixSummary.skipped.length}, ` +
  `errors ${fixSummary.errors.length}`
);
```

Skipped outcomes are not necessarily failures. They can mean a code was outside
your whitelist, no built-in strategy exists for that code, or the strategy
looked at the issue and declined to change it.

---

## 5. Save Repair Diagnostics

Store both the original inspection report and the fix result. Together they
show why the model changed and what each strategy did.

```javascript
await mkdir("dist/repair-demo", {recursive: true});

await writeFile(
  "dist/repair-demo/inspection-before.json",
  JSON.stringify(inspectionReportToJson(beforeReport), null, 2)
);

await writeFile(
  "dist/repair-demo/fixes.json",
  JSON.stringify(applyFixesResultToJson(fixSummary), null, 2)
);
```

These files are useful build artifacts. They let you track whether a generator
is producing cleaner models over time, and they make automatic changes
auditable when a downstream viewer or exporter behaves differently.

---

## 6. Re-Inspect After Repair

Always run a fresh inspection after `applyFixes`, because the report you used as
input describes the pre-repair model.

```javascript
const afterReport = inspectSceneModel({
  sceneModel,
  checkDuplicateGeometries: true,
  checkGeometryQuality: true,
  checkDenseGeometries: true,
  checkGeometryArrayLengths: true,
  maxVertices: 50000,
  maxPrimitives: 50000
});

await writeFile(
  "dist/repair-demo/inspection-after.json",
  JSON.stringify(inspectionReportToJson(afterReport), null, 2)
);

if (afterReport.errors.length > 0) {
  throw new Error(
    afterReport.errors.map((issue) => issue.message).join("\n")
  );
}
```

Warnings that remain after repair are the review list for your pipeline. For
example, texture-dimension warnings may require image resampling outside the
SDK, and source-data reference errors should be fixed before the model is
authored.

---

## 7. Use the Convenience Optimizer for Coarse Cleanup

`optimizeSceneModel` is useful when you want a single coarse pass before export.
It validates first, refuses to run when errors are present, splits oversized
geometries, and prunes unused resources.

```javascript
const optimizeResult = optimizeSceneModel({
  sceneModel,
  maxVertices: 50000,
  maxPrimitives: 50000
});

if (!optimizeResult.ok) {
  throw new Error(optimizeResult.error);
}
```

Use `optimizeSceneModel` for simple generation scripts. Use
`inspectSceneModel` and `applyFixes` directly when you need per-code control,
custom registries, audit logs, or a staged cleanup pipeline.

---

## 8. Export Only After the Final Gate

Make export the final step after the post-repair inspection passes.

```javascript
const finalReport = inspectSceneModel({
  sceneModel,
  checkDenseGeometries: true,
  checkGeometryArrayLengths: true,
  maxVertices: 50000,
  maxPrimitives: 50000
});

if (finalReport.errors.length > 0) {
  throw new Error("SceneModel still has blocking inspection errors");
}

const xgfBuffer = await new XGFExporter().write({
  sceneModel
});

await writeFile("dist/repair-demo/model.xgf", Buffer.from(xgfBuffer));
```

This keeps your deployment path simple: author the model, inspect it, repair
what can be repaired automatically, inspect again, then export. Anything that
survives that process is either acceptable by project policy or needs a
source-data fix rather than a renderer workaround.
