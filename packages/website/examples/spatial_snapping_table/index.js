// WebGLRenderer — snap-to-vertex and snap-to-edge picking demo.
//
// Builds a small "table" SceneModel (four legs + a top), then pipes
// every `mousemove` through `renderer.pick(view, params)` with
// `snapToVertex` / `snapToEdge` enabled. The renderer's snap
// pipeline rasterises every pickable mesh's vertices and edges into
// a tiny RGBA32F framebuffer centred on the cursor, scans it for
// the nearest non-empty texel, and reports the world-space snap
// target.
//
// The snap target is shown as a small HTML <div> that we position
// over the canvas — vertex hits are red, edge hits are amber, plain
// surface picks are teal.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const SNAP_RADIUS_PX = 30;

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene, renderer} = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [12, 12, 15],
      look: [0,  0, 3],
      up:   [0,  0, 1],
    },
  });

  // NavCube widget — mirrors the View camera and lets us click a
  // face / edge / corner to fly to that canonical view. Wrapped
  // in the floating-panel chrome (draggable header + close button
  // + reopen pill + layout persistence) so it composes with the
  // other demo panels.
  new xeokit.studio.navCube.NavCube({
    view,
    cameraFlight: studio.views[view.id].cameraFlight,
    cameraFly: false,
    size: 110,
  });

  // ── SceneModel: a 4-legged table built from one shared box
  //    geometry instanced as five meshes. Plenty of vertices and
  //    edges for the snap pipeline to land on.
  const sceneModel = mustCreate(scene.createModel({id: "table"}));

  mustCreate(sceneModel.fromParams({
    geometries: [
      {
        id: "box",
        primitive: xeokit.base.constants.TrianglesPrimitive,
        positions: [
           1,  1,  1,  -1,  1,  1,  -1, -1,  1,   1, -1,  1,
           1,  1,  1,   1, -1,  1,   1, -1, -1,   1,  1, -1,
           1,  1,  1,   1,  1, -1,  -1,  1, -1,  -1,  1,  1,
          -1,  1,  1,  -1,  1, -1,  -1, -1, -1,  -1, -1,  1,
          -1, -1, -1,   1, -1, -1,   1, -1,  1,  -1, -1,  1,
           1, -1, -1,  -1, -1, -1,  -1,  1, -1,   1,  1, -1,
        ],
        indices: [
          0, 1, 2,    0, 2, 3,
          4, 5, 6,    4, 6, 7,
          8, 9, 10,   8, 10, 11,
          12, 13, 14, 12, 14, 15,
          16, 17, 18, 16, 18, 19,
          20, 21, 22, 20, 22, 23,
        ],
      },
    ],
    meshes: [
      {id: "leg-NW",  geometryId: "box", position: [-4, -4, 3], scale: [1, 1, 3], color: [0.78, 0.55, 0.35]},
      {id: "leg-NE",  geometryId: "box", position: [ 4, -4, 3], scale: [1, 1, 3], color: [0.78, 0.55, 0.35]},
      {id: "leg-SE",  geometryId: "box", position: [ 4,  4, 3], scale: [1, 1, 3], color: [0.78, 0.55, 0.35]},
      {id: "leg-SW",  geometryId: "box", position: [-4,  4, 3], scale: [1, 1, 3], color: [0.78, 0.55, 0.35]},
      {id: "top",     geometryId: "box", position: [0,   0, 6], scale: [6, 6, 0.4], color: [0.95, 0.85, 0.65]},
    ],
    objects: [
      {id: "leg-NW", meshIds: ["leg-NW"]},
      {id: "leg-NE", meshIds: ["leg-NE"]},
      {id: "leg-SE", meshIds: ["leg-SE"]},
      {id: "leg-SW", meshIds: ["leg-SW"]},
      {id: "top",    meshIds: ["top"]},
    ],
  }));

  const markerEl = document.getElementById("marker");
  const statusEl = document.getElementById("status");

  view.htmlElement.addEventListener("mousemove", (e) => {
    const result = renderer.pick(view, {
      canvasPos:    [e.offsetX, e.offsetY],
      snapToVertex: true,
      snapToEdge:   true,
      snapRadius:   SNAP_RADIUS_PX,
    });

    // Accept the result if there's any positioning signal — a
    // surface worldPos, OR a snappedCanvasPos from a vertex/edge
    // hit. The latter survives even when the cursor is just off
    // the silhouette and surface pick misses.
    const value = result.ok ? result.value : null;
    const snappedCanvasPos = value ? value.snappedCanvasPos : undefined;
    const hasWorldPos = !!(value && value.worldPos);
    if (!value || (!hasWorldPos && !snappedCanvasPos)) {
      hideMarker();
      return;
    }

    const {snappedToVertex, snappedToEdge} = value;

    let mode, label;
    if      (snappedToVertex) { mode = "vertex";  label = "Snap → Vertex"; }
    else if (snappedToEdge)   { mode = "edge";    label = "Snap → Edge";   }
    else                      { mode = "surface"; label = "Surface pick";  }

    // Snap hits give us a projected canvas position for the snapped
    // point; surface picks don't, so fall back to the cursor.
    const x = snappedCanvasPos ? snappedCanvasPos[0] : e.offsetX;
    const y = snappedCanvasPos ? snappedCanvasPos[1] : e.offsetY;

    markerEl.style.display = "block";
    markerEl.style.left = `${x}px`;
    markerEl.style.top  = `${y}px`;
    markerEl.dataset.mode = mode;

    statusEl.textContent  = label;
    statusEl.dataset.mode = mode;
  });

  view.htmlElement.addEventListener("mouseleave", hideMarker);

  function hideMarker() {
    markerEl.style.display = "none";
    markerEl.dataset.mode = "none";
    statusEl.textContent = "No snap";
    statusEl.dataset.mode = "none";
  }

  studio.finished();
});


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
