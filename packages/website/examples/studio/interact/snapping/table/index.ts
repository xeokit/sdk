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

import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {PickResult, Viewer} from "@xeokit/sdk/viewing/viewer";
import {failExample, finishExample, mustElement, mustOk, toNavigationPick} from "../../../../utils/standaloneRuntime.js";

const SNAP_RADIUS_PX = 30;
const TABLE_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 0, 1,
    0, 1, 0
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("studio/interact/snapping/table", error));

async function main() {
  // Create the Scene, Viewer, View and WebGL renderer explicitly. This example
  // is about the WebGL snap framebuffer path, so it intentionally fixes the
  // renderer instead of offering a WebGPU switch.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "tableSnapView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.96, 0.97, 0.98],
    camera: {
      eye:  [12, 12, 15],
      look: [0,  0, 3],
      up:   [0,  0, 1]
    },
    effects: {
      sky: {enabled: true},
      edges: {enabled: false},
      sao: {enabled: true, intensity: 0.08, scale: 0.8},
      tonemap: {enabled: true, sRGBEncode: true}
    }
  }));
  const renderer = new WebGLRenderer({viewer});
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Keep normal model navigation available while sharing the same renderer pick
  // result conversion that the import examples use.
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = renderer.pick(view, {canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.ok && pickResult.value ? toNavigationPick(view, pickResult.value as PickResult, pickParams.canvasPos) : null};
    }
  });

  // The table vertex data below is authored with +Z as vertical. Declare that
  // source basis on the model so the SDK transforms it into the View's world
  // basis instead of interpreting the legs as lying sideways.
  const sceneModel = mustOk(scene.createModel({
    id: "table",
    coordinateSystem: TABLE_COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  mustOk(sceneModel.fromParams({
    geometries: [
      {
        id: "box",
        primitive: TrianglesPrimitive,
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
    // Canvas-relative coords via getBoundingClientRect — survives
    // floating panels and any layout that shifts the canvas off the
    // page origin. `e.offsetX/Y` is target-relative and goes wrong as
    // soon as the event bubbles from a child or the canvas isn't at
    // (0,0) on the page.
    const rect = view.htmlElement.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const result = renderer.pick(view, {
      canvasPos:    [canvasX, canvasY],
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
    // point; surface picks don't, so fall back to the cursor. Both
    // are canvas-relative — convert back to viewport coords for the
    // marker, which is position:absolute on <body>.
    const x = snappedCanvasPos ? snappedCanvasPos[0] : canvasX;
    const y = snappedCanvasPos ? snappedCanvasPos[1] : canvasY;

    markerEl.style.display = "block";
    markerEl.style.left = `${x + rect.left}px`;
    markerEl.style.top  = `${y + rect.top}px`;
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

  finishExample(renderer, view);
  window.tableSnappingExample = {scene, viewer, view, renderer, inputController, sceneModel};
}
