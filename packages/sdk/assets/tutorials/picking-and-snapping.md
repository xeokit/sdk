---
title: Picking and Snapping with xeokit SDK
---

# Picking and Snapping with xeokit SDK

Picking is the bridge between a 2D pointer event and the 3D model behind the
canvas. A pick can answer several related questions:

- Which `SceneObject` or `SceneMesh` is under this canvas pixel?
- Where did the pointer ray hit the model in world space?
- Which triangle was hit, and what is the surface normal there?
- Is there a nearby vertex or edge that should receive a precise measurement,
  markup or construction point?

Those questions are not all solved the same way. Object and surface picking are
ray queries: the SDK projects the pointer through the camera, intersects the ray
with the scene, and returns the nearest visible and pickable hit. Vertex and edge
snapping is a screen-space proximity query: the best target might be a few pixels
away from the pointer and can still be valid even when the ray misses the model
surface.

The SDK therefore exposes both CPU and renderer-backed picking:

- BVH picking for fast CPU-side ray and surface queries.
- Renderer picking for GPU-backed mesh, vertex and edge queries.

The usual application pattern is to use `RoutingPickStrategy`. It keeps a BVH
picker and a renderer picker behind one API, then chooses the backend that can
answer each request. You get cheap BVH picks for hover, filtered and ray-driven
tools, and GPU snapping only when you ask for vertex or edge precision.

[![Pointer snapping on triangle meshes](https://xeokit.github.io/sdk/examples/studio/interact/snapping/table/index.png)](https://xeokit.github.io/sdk/examples/index.html#studio/interact/snapping/table)

The live
[Pointer Snapping on Triangle Meshes](https://xeokit.github.io/sdk/examples/index.html#studio/interact/snapping/table)
example shows vertex, edge and surface snap feedback on authored triangle
geometry.

---

## 1. Pick the Right API

Use these entry points for the common cases:

| Task | API | Backend |
| --- | --- | --- |
| Object or mesh under the pointer | `RoutingPickStrategy.pick({ view, canvasPos })` | BVH for triangle scenes; GPU for point/splat-only picks |
| Triangle hit point and normal | `RoutingPickStrategy.pick({ view, canvasPos, pickSurfaceNormal: true })` | BVH |
| Filtered picking | `RoutingPickStrategy.pick({ filter })` | BVH |
| Ray picking from application code | `RoutingPickStrategy.pick({ ray })` | BVH |
| Vertex or edge snapping | `RoutingPickStrategy.pick({ snapToVertex, snapToEdge })` | GPU when ready, BVH fallback without snap |
| Renderer-specific mesh details | `renderer.pick(view, params)` | Renderer GPU path |

The routing result exposes `strategyUsed`, so diagnostics can tell whether a pick
came from `"bvh"` or `"gpu"`.

---

## 2. Create a Routing Picker

Create one picker after you have a `Scene`, `View` and renderer:

```javascript
import {RoutingPickStrategy, MemoisingPickStrategy} from "@xeokit/sdk/spatial/picking";

// renderer can be a WebGLRenderer or WebGPURenderer.
const routingPicker = new RoutingPickStrategy(scene, renderer);

// Optional for pointermove handlers: avoid repeated identical picks in one frame.
const picker = new MemoisingPickStrategy(routingPicker, {
  maxAgeMs: 16
});
```

If you construct `RoutingPickStrategy` before the renderer starts, it will notice
renderer lifecycle changes and enable GPU snapping once the renderer is ready.
If no renderer is supplied, the picker remains BVH-only.

---

## 3. Convert Pointer Events to Canvas Pixels

Always calculate canvas-relative coordinates from the canvas bounding rectangle.
This survives page layout, overlays and event bubbling better than `offsetX` and
`offsetY`.

```javascript
function getCanvasPos(view, event) {
  const rect = view.htmlElement.getBoundingClientRect();
  return [
    event.clientX - rect.left,
    event.clientY - rect.top
  ];
}
```

---

## 4. Pick an Object or Mesh

For hover selection, ask the routing picker for the object under the cursor:

```javascript
let highlightedObjectId = null;

view.htmlElement.addEventListener("pointermove", (event) => {
  const canvasPos = getCanvasPos(view, event);
  const result = picker.pick({
    view,
    canvasPos
  });

  const objectId = result.hit ? result.objectId : null;
  if (objectId === highlightedObjectId) {
    return;
  }

  if (highlightedObjectId && view.objects[highlightedObjectId]) {
    view.objects[highlightedObjectId].setStyleBin("highlighted", false);
  }

  highlightedObjectId = objectId;

  if (objectId && view.objects[objectId]) {
    view.objects[objectId].setStyleBin("highlighted", true);
  }
});
```

`result.objectId` is the picked `SceneObject` ID. `result.meshId` is populated
when the backend can identify the picked `SceneMesh`.

---

## 5. Pick a Surface Point and Normal

Set `pickSurfaceNormal: true` when tools need a triangle hit position and normal,
for example placing a marker on a wall or orienting an annotation.

```javascript
view.htmlElement.addEventListener("click", (event) => {
  const result = picker.pick({
    view,
    canvasPos: getCanvasPos(view, event),
    pickSurfaceNormal: true
  });

  if (!result.hit || !result.worldPos) {
    return;
  }

  console.log("object", result.objectId);
  console.log("mesh", result.meshId);
  console.log("world position", Array.from(result.worldPos));
  console.log("world normal", result.worldNormal ? Array.from(result.worldNormal) : null);
  console.log("triangle index", result.triangleIndex);
  console.log("backend", result.strategyUsed);
});
```

Surface-normal and filtered picks route to the BVH backend. That avoids a GPU
readback in high-frequency handlers and keeps callback filtering available.

---

## 6. Snap to Vertices and Edges

Enable `snapToVertex`, `snapToEdge` or both. Snapping is a screen-space query:
the cursor can snap to a nearby vertex or edge even when the surface ray itself
misses the model.

```javascript
const SNAP_RADIUS = 30;

view.htmlElement.addEventListener("pointermove", (event) => {
  const result = picker.pick({
    view,
    canvasPos: getCanvasPos(view, event),
    snapToVertex: true,
    snapToEdge: true,
    snapRadius: SNAP_RADIUS
  });

  if (result.snap) {
    drawMarker({
      canvasPos: result.snap.canvasPos,
      worldPos: result.snap.worldPos,
      kind: result.snap.type
    });
    return;
  }

  if (result.hit && result.worldPos) {
    drawMarker({
      canvasPos: result.canvasPos,
      worldPos: result.worldPos,
      kind: "surface"
    });
    return;
  }

  hideMarker();
});
```

When both vertex and edge snapping are requested, the renderer returns the nearest
candidate and prefers the vertex on ties. A missing `result.snap` does not mean
the pick failed; it can also mean that GPU snapping was unavailable or no vertex
or edge was inside the radius. Check `result.hit`, `result.worldPos` and
`result.strategyUsed` separately.

---

## 7. Use BVH Directly for Ray Tools

When you already have a world-space ray, skip renderer picking and use the BVH
path directly. This is useful for measurements, section tools, custom gizmos and
server-driven queries.

```javascript
import {BVHPickStrategy} from "@xeokit/sdk/spatial/picking";

const bvhPicker = new BVHPickStrategy(scene);

const result = bvhPicker.pick({
  view,
  ray: {
    origin: [10, 10, 10],
    dir: [-1, -1, -0.5]
  },
  filter: (objectId) => objectId.startsWith("IfcWall"),
  tMin: 0,
  tMax: 1000,
  pickSurfaceNormal: true
});

if (result.hit) {
  console.log(result.objectId, result.worldPos, result.worldNormal);
}
```

BVH picks support `canvasPos`, `ray` and `matrix` inputs. They honor `filter`,
`tMin`, `tMax` and visible/pickable state. They do not perform vertex or edge
snapping.

---

## 8. Use Renderer Picking for Mesh Details

The renderer API returns the renderer-owned `PickResult`. Use it when you need
fields that are specific to the renderer path, such as `sceneMesh`, `sceneObject`,
`viewObject`, local coordinates or UVs.

```javascript
const pick = renderer.pick(view, {
  canvasPos,
  snapToVertex: true,
  snapToEdge: true,
  snapRadius: 30
});

if (!pick.ok) {
  console.error(pick.error);
  return;
}

const value = pick.value;
if (!value) {
  return;
}

console.log("object", value.viewObject?.id);
console.log("mesh", value.sceneMesh?.id);
console.log("local", value.localPos);
console.log("world", value.worldPos);
console.log("uv", value.uv);
console.log("snapped", value.snappedToVertex, value.snappedToEdge, value.snappedCanvasPos);
```

`renderer.pick(view, params)` is synchronous. WebGL uses framebuffer readback for
the renderer pick and snap pass. WebGPU exposes the same public synchronous
renderer API and also has an internal asynchronous GPU pick bridge used by the
WebGPU examples and diagnostics. Application code should prefer
`RoutingPickStrategy` or `renderer.pick` unless it is intentionally working with
renderer internals.

---

## 9. Combine BVH and GPU Picks

A practical tool often uses both backends:

1. Run cheap BVH picking on every pointer move to highlight the object under the
   cursor.
2. Run GPU snapping only while the user is placing a measurement point, drawing a
   line or dragging a construction handle.
3. Use `pickSurfaceNormal` or `filter` when semantic or geometric constraints are
   more important than snap enrichment.

```javascript
let placementMode = false;

view.htmlElement.addEventListener("pointermove", (event) => {
  const canvasPos = getCanvasPos(view, event);

  const result = picker.pick(placementMode
    ? {
        view,
        canvasPos,
        snapToVertex: true,
        snapToEdge: true,
        snapRadius: 24
      }
    : {
        view,
        canvasPos,
        pickSurfaceNormal: false
      });

  updateHoverUI(result);
});
```

This keeps hover interaction cheap while still getting accurate vertex and edge
targets when precision matters.

---

## 10. Troubleshooting

If picking misses unexpectedly:

- Check that the model has finished loading before creating interactive tools.
- Check `view.objects[id].visible` and `view.objects[id].pickable`.
- Use `pickInvisible: true` only when the tool intentionally needs hidden objects.
- For snapping, make sure the call supplies `canvasPos`; ray and matrix picks are
  BVH-only and cannot snap.
- Inspect `result.strategyUsed`. `"bvh"` with `snapToVertex` or `snapToEdge`
  means snapping was requested but the GPU path was not used.
- Increase `snapRadius` for touch input or dense high-DPI displays.
- For WebGPU examples, require a browser with `navigator.gpu`; otherwise create a
  WebGL renderer or use BVH-only picking.

Existing examples worth comparing against:

- `packages/website/examples/studio/interact/collision/hover`
- `packages/website/examples/studio/interact/collision/hit-point`
- `packages/website/examples/studio/interact/snapping/table`
- `packages/website/examples/studio/interact/snapping/thick-lines`
- `packages/website/examples/sdk/view/webgpu/pick-surface`
- `packages/website/examples/sdk/view/webgpu/snap-vertex`
- `packages/website/examples/sdk/view/webgpu/snap-edge`
