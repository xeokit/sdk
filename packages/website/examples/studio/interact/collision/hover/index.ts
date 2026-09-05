// Hover-to-highlight demo driven by SceneCollisionIndex's BVH.
//
// Each mousemove event:
//   1. converts the cursor to canvas-pixel coordinates via
//      getBoundingClientRect() — robust against CSS layout / event-target
//      quirks that make e.offsetX/Y unreliable in some browsers;
//   2. takes camera.eye as the ray origin and unprojects the cursor at a
//      forward NDC z to derive a direction. Mirrors how the SDK's
//      PivotController computes its world-space pick ray, which avoids the
//      Y-flip subtleties of unproject()'s near/far behaviour.
//   3. asks the BVH for every object whose world AABB intersects that ray;
//   4. picks the nearest visible+pickable hit (BVH returns hits sorted by
//      tEnter ascending) and routes it through the "highlighted" style bin.
//
// Highlighting is at AABB granularity, not triangle precision — fast enough
// for every-frame hover, and it doesn't need the GPU pick framebuffer.

import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, toNavigationPick} from "../../../../utils/standaloneRuntime.js";

const XGF_URL = "../../../../../models/Duplex/xgf/model.xgf";
const DUPLEX_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("studio/interact/collision/hover", error));

async function main() {
  // Build the SDK runtime directly. Scene owns renderable objects, Viewer owns
  // Views, and WebGLRenderer draws the model this CPU collision example queries.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "duplexHoverCollisionView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.96, 0.97, 0.98],
    camera: {
      eye:  [24.40, 23.70, 27.04],
      look: [4.39,  8.90,  2.54],
      up:   [-0.56, -0.41, 0.71]
    },
    effects: {
      edges: {enabled: true, useMeshColor: true, edgeWidth: 1},
      sao: {enabled: true, intensity: 0.08, scale: 0.8},
      tonemap: {enabled: true, sRGBEncode: true}
    }
  }));
  const renderer = new WebGLRenderer({viewer});

  // Standalone View instances do not create semantic style bins for you. Create
  // the bin that hover uses to render one object with temporary highlight
  // styling, then toggle membership on individual ViewObjects below.
  view.styleBins.get("highlighted") ?? mustOk(view.styleBins.create({
    id: "highlighted",
    priority: 200,
    fill: true,
    fillColor: [1.0, 0.78, 0.25],
    fillAlpha: 0.8,
    edges: true,
    edgeColor: [0.55, 0.35, 0.05],
    edgeAlpha: 1.0
  }));

  // The Duplex sidecar declares an identity, meter-based coordinate system.
  // Pass it at SceneModel creation so the loaded XGF lands in scene coordinates.
  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: DUPLEX_COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  // Decode the xeokit-native XGF into the prepared SceneModel. The collision
  // index below observes the Scene, so it sees the loaded objects immediately.
  const fileData = await fetchArrayBuffer(XGF_URL);
  const loadResult = await new XGFLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // Self-maintaining BVH over scene.objects. Subscribed to create/destroy/move
  // events; first query rebuilds in O(N log N).
  const collisionIndex = getSceneCollisionIndex(scene);

  // Trigger an initial build so the BVH stat in the status overlay is populated
  // before the first mouse move. Touching `.size` runs the pending rebuild.
  const indexedCount = collisionIndex.size;

  const statusObjectId = document.getElementById("hoverObjectId");
  const statusHitCount = document.getElementById("hoverHitCount");
  const statusBvhSize  = document.getElementById("hoverBvhSize");
  const statusQueryUs  = document.getElementById("hoverQueryUs");
  statusBvhSize.textContent = String(indexedCount);

  // Persistent ID of the object currently highlighted, so a fresh hit can clear
  // the previous one without a full sweep through view.objects.
  let highlightedId = null;

  // Reusable scratch for unproject() — avoids per-event allocation.
  const canvasPos    = [0, 0];
  const screenPos    = [0, 0, 0];
  const viewPos      = [0, 0, 0];
  const worldPosFar  = [0, 0, 0];
  const rayOrigin    = [0, 0, 0];
  const rayDir       = [0, 0, 0];

  // Keep orbit/pan/dolly navigation active; hover highlighting remains a
  // separate CPU BVH query so it can run every mousemove without a GPU pick.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  const canvas = view.htmlElement;

  canvas.addEventListener("mousemove", (e) => {

          // Canvas-relative pixel coordinates. getBoundingClientRect() works
          // even when the event target is a child element or when CSS
          // transforms shift the canvas.
          const rect = canvas.getBoundingClientRect();
          canvasPos[0] = e.clientX - rect.left;
          canvasPos[1] = e.clientY - rect.top;

          const camera     = view.camera;
          const projection = camera.projection;

          // Unproject at NDC z = +1 (far plane). The actual NDC value picked
          // here doesn't matter for ray-direction purposes — any positive
          // value gives a world point ahead of the camera through the cursor.
          projection.unproject(canvasPos, 1, screenPos, viewPos, worldPosFar);

          // Ray origin at the eye, direction toward the unprojected far point
          // — same construction as PivotController.setCanvasPivotPos so we
          // inherit its proven canvas-pos → world-ray mapping.
          const eye = camera.eye;
          rayOrigin[0] = eye[0];
          rayOrigin[1] = eye[1];
          rayOrigin[2] = eye[2];

          rayDir[0] = worldPosFar[0] - eye[0];
          rayDir[1] = worldPosFar[1] - eye[1];
          rayDir[2] = worldPosFar[2] - eye[2];

          const t0 = performance.now();
          const hits = collisionIndex.intersectRay(rayOrigin, rayDir);
          const t1 = performance.now();
          statusQueryUs.textContent = ((t1 - t0) * 1000).toFixed(1);

          // Only the visible-and-pickable subset counts. Walk hits in BVH
          // order (already nearest-first) and stop at the first qualifier.
          let pickedId = null;
          for (let i = 0; i < hits.length; i++) {
            const candidate = view.objects[hits[i].objectId];
            if (candidate && candidate.visible && candidate.pickable !== false) {
              pickedId = hits[i].objectId;
              break;
            }
          }

          statusHitCount.textContent = String(hits.length);

          if (pickedId === highlightedId) return;

          if (highlightedId !== null) {
            const prev = view.objects[highlightedId];
            if (prev) prev.setStyleBin("highlighted", false);
          }

          highlightedId = pickedId;

          if (pickedId !== null) {
            view.objects[pickedId].setStyleBin("highlighted", true);
            statusObjectId.textContent = pickedId;
            statusObjectId.className   = "value";
          } else {
            statusObjectId.textContent = "— no hit —";
            statusObjectId.className   = "nohit";
          }
  });

        // Clear highlight when the cursor leaves the canvas, so we don't
        // strand a hover state from the last in-canvas position.
  canvas.addEventListener("mouseleave", () => {
          if (highlightedId !== null) {
            const prev = view.objects[highlightedId];
            if (prev) prev.setStyleBin("highlighted", false);
            highlightedId = null;
          }
          statusObjectId.textContent = "— move mouse over model —";
          statusObjectId.className   = "nohit";
          statusHitCount.textContent = "0";
  });

  finishExample(renderer, view);
  window.duplexHoverCollisionExample = {scene, viewer, view, renderer, picker, inputController, sceneModel, collisionIndex};
}
