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
//      tEnter ascending) and routes it through view.objects[id].highlighted.
//
// Highlighting is at AABB granularity, not triangle precision — fast enough
// for every-frame hover, and it doesn't need the GPU pick framebuffer.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const { scene, data, renderer } = studio;

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  const view = studio.viewManager.createView({
    camera: {
      eye:  [24.40, 23.70, 27.04],
      look: [4.39,  8.90,  2.54],
      up:   [-0.56, -0.41, 0.71]
    }
  });

  // Configure highlight so the hovered object reads clearly against the
  // standard IFC palette.
  view.highlightMaterial.fillColor   = [1.0, 0.78, 0.25];
  view.highlightMaterial.fillAlpha   = 0.8;
  view.highlightMaterial.fill        = true;
  view.highlightMaterial.edgeColor   = [0.55, 0.35, 0.05];
  view.highlightMaterial.edgeAlpha   = 1.0;

  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });
  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }
  const sceneModel = sceneModelResult.value;

  const dataModelResult = data.createModel({ id: "demoModel" });
  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }
  const dataModel = dataModelResult.value;

  fetch(`../../models/Duplex/ifc/model.ifc`)
    .then(response => response.arrayBuffer())
    .then(fileData => {

      ifcLoader.load({ fileData, sceneModel, dataModel }).then(() => {

        // Self-maintaining BVH over scene.objects. Subscribed to
        // create/destroy/move events; first query rebuilds in O(N log N).
        const collisionIndex =
          xeokit.spatial.collision.getSceneCollisionIndex(scene);

        // Trigger an initial build so the BVH stat in the status overlay is
        // populated before the first mouse move. Touching `.size` runs the
        // pending rebuild.
        const indexedCount = collisionIndex.size;

        const statusObjectId = document.getElementById("hoverObjectId");
        const statusHitCount = document.getElementById("hoverHitCount");
        const statusBvhSize  = document.getElementById("hoverBvhSize");
        const statusQueryUs  = document.getElementById("hoverQueryUs");
        statusBvhSize.textContent = String(indexedCount);

        // Persistent ID of the object currently highlighted, so a fresh hit
        // can clear the previous one without a full sweep through view.objects.
        let highlightedId = null;

        // Reusable scratch for unproject() — avoids per-event allocation.
        const canvasPos    = [0, 0];
        const screenPos    = [0, 0, 0];
        const viewPos      = [0, 0, 0];
        const worldPosFar  = [0, 0, 0];
        const rayOrigin    = [0, 0, 0];
        const rayDir       = [0, 0, 0];

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
            if (prev) prev.highlighted = false;
          }

          highlightedId = pickedId;

          if (pickedId !== null) {
            view.objects[pickedId].highlighted = true;
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
            if (prev) prev.highlighted = false;
            highlightedId = null;
          }
          statusObjectId.textContent = "— move mouse over model —";
          statusObjectId.className   = "nohit";
          statusHitCount.textContent = "0";
        });

        studio.finished();

      }).catch(e => console.error(e));
    });
});
