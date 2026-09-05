// Demonstrates WebGLRenderer.createMarkerOcclusionTester() with HTML
// annotations pinned to world-space marker positions. The annotations are
// regular DOM nodes; every camera update projects them to canvas space and
// uses the BVH-backed tester to hide labels whose anchors are behind model
// geometry.

import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {PickResult, Viewer} from "@xeokit/sdk/viewing/viewer";
import {SceneRaycaster} from "@xeokit/sdk/spatial/collision";
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

const MARKER_COLORS = {
  front: "#2f80ed",
  rear: "#d04f3a",
  east: "#1d8f6f",
  west: "#a15fc7",
  roof: "#d69a1d"
};

main().catch((error) => failExample("studio/interact/marker-occlusion/duplex", error));

async function main() {
  // Marker occlusion is currently a WebGLRenderer API. Create the renderer
  // directly so the occlusion tester and its options are visible in the example.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "duplexMarkerOcclusionView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.86, 0.9, 0.94],
    camera: {
      eye:  [24.40, 23.70, 27.04],
      look: [4.39,  8.90,  2.54],
      up:   [-0.56, -0.41, 0.71]
    },
    effects: {
      edges: {enabled: true, useMeshColor: true, edgeWidth: 1},
      sao: {enabled: true, intensity: 0.08, scale: 0.8},
      tonemap: {enabled: true, sRGBEncode: true},
      sky: {enabled: true}
    }
  }));
  const renderer = new WebGLRenderer({viewer});
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Load the Duplex XGF into the same coordinate system declared by its model
  // sidecar, inlined here because that is the placement contract readers need.
  const sceneModel = mustOk(scene.createModel({
    id: "duplex",
    coordinateSystem: DUPLEX_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const fileData = await fetchArrayBuffer(XGF_URL);
  const loadResult = await new XGFLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // Reuse renderer picking for ordinary model navigation; the marker occlusion
  // probe below is separate and tracks the fixed marker list.
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = renderer.pick(view, {canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.ok && pickResult.value ? toNavigationPick(view, pickResult.value as PickResult, pickParams.canvasPos) : null};
    }
  });

  // Create the occlusion tester after the model is loaded, then provide stable
  // marker ids and world positions. `mode: "auto"` lets the renderer select the
  // fastest available backend for the current scene.
  const testerResult = renderer.createMarkerOcclusionTester(view, {
    mode: "auto",
    depthBias: 0.08,
    hideDelayFrames: 2,
    showDelayFrames: 1,
    includeTransparent: false,
    includeXRayed: false
  });
  if (!testerResult.ok) {
    throw new Error(testerResult.error);
  }
  const occlusionTester = testerResult.value;

  const placementRaycaster = new SceneRaycaster(scene);
  const markers = createMarkers(placementRaycaster);
  occlusionTester.setMarkers(markers);

  const markerLayer = document.getElementById("markerLayer");
  const markerNodes = new Map();
  for (const marker of markers) {
    const node = createMarkerNode(marker);
    markerLayer.appendChild(node);
    markerNodes.set(marker.id, node);
  }

  const status = {
    backend: document.getElementById("backend"),
    visible: document.getElementById("visibleCount"),
    hidden:  document.getElementById("hiddenCount"),
    update:  document.getElementById("updateMs")
  };
  status.backend.textContent = occlusionTester.mode.toUpperCase();

  let updateScheduled = false;
  const requestMarkerUpdate = () => {
    if (updateScheduled) return;
    updateScheduled = true;
    requestAnimationFrame(updateMarkers);
  };

  function updateMarkers() {
    updateScheduled = false;

    const t0 = performance.now();
    const result = occlusionTester.update();
    const t1 = performance.now();
    if (!result.ok) {
      console.error(result.error);
      return;
    }

    const rect = view.htmlElement.getBoundingClientRect();
    let visible = 0;
    let hidden = 0;

    for (const markerResult of result.value) {
      const node = markerNodes.get(markerResult.markerId);
      if (!node) continue;

      const isVisible = markerResult.visible && markerResult.inFrustum && !!markerResult.canvasPos;
      if (markerResult.canvasPos) {
        node.style.left = `${rect.left + markerResult.canvasPos[0]}px`;
        node.style.top  = `${rect.top + markerResult.canvasPos[1]}px`;
      }
      node.dataset.visible = isVisible ? "true" : "false";
      node.dataset.occluded = markerResult.occluded ? "true" : "false";

      if (isVisible) {
        visible++;
      } else {
        hidden++;
      }
    }

    status.visible.textContent = String(visible);
    status.hidden.textContent = String(hidden);
    status.update.textContent = (t1 - t0).toFixed(2);
  }

  viewer.events.onCameraViewMatrixUpdated.subscribe((eventView) => {
    if (eventView === view) requestMarkerUpdate();
  });
  viewer.events.onCameraProjMatrixUpdated.subscribe((eventView) => {
    if (eventView === view) requestMarkerUpdate();
  });
  viewer.events.onViewCanvasBoundaryChanged.subscribe((eventView) => {
    if (eventView === view) requestMarkerUpdate();
  });
  window.addEventListener("resize", requestMarkerUpdate);

  updateMarkers();
  finishExample(renderer, view);
  window.duplexMarkerOcclusionExample = {scene, viewer, view, renderer, inputController, sceneModel, occlusionTester, markers};
}

function createMarkers(raycaster) {
  const aabb = raycaster.collisionIndex.getSceneAABB();
  const minX = aabb[0];
  const minY = aabb[1];
  const minZ = aabb[2];
  const maxX = aabb[3];
  const maxY = aabb[4];
  const maxZ = aabb[5];

  const width = Math.max(1, maxX - minX);
  const depth = Math.max(1, maxY - minY);
  const height = Math.max(1, maxZ - minZ);
  const rayPad = Math.max(1, Math.max(width, depth, height) * 0.10);
  const surfaceBias = 0.035;
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const zLow = minZ + height * 0.32;
  const zMid = minZ + height * 0.52;

  return [
    {
      id: "front",
      label: "Front Entry",
      worldPos: markerSurfacePos(raycaster, {
        origin: [cx, maxY + rayPad, zLow],
        dir: [0, -1, 0],
        tMax: depth + rayPad * 2,
        fallback: [cx, maxY + surfaceBias, zLow]
      }, surfaceBias)
    },
    {
      id: "rear",
      label: "Rear Deck",
      worldPos: markerSurfacePos(raycaster, {
        origin: [cx, minY - rayPad, zLow],
        dir: [0, 1, 0],
        tMax: depth + rayPad * 2,
        fallback: [cx, minY - surfaceBias, zLow]
      }, surfaceBias)
    },
    {
      id: "east",
      label: "East Rooms",
      worldPos: markerSurfacePos(raycaster, {
        origin: [maxX + rayPad, cy, zMid],
        dir: [-1, 0, 0],
        tMax: width + rayPad * 2,
        fallback: [maxX + surfaceBias, cy, zMid]
      }, surfaceBias)
    },
    {
      id: "west",
      label: "West Rooms",
      worldPos: markerSurfacePos(raycaster, {
        origin: [minX - rayPad, cy, zMid],
        dir: [1, 0, 0],
        tMax: width + rayPad * 2,
        fallback: [minX - surfaceBias, cy, zMid]
      }, surfaceBias)
    },
    {
      id: "roof",
      label: "Roof Line",
      worldPos: markerSurfacePos(raycaster, {
        origin: [cx, cy, maxZ + rayPad],
        dir: [0, 0, -1],
        tMax: height + rayPad * 2,
        fallback: [cx, cy, maxZ + surfaceBias]
      }, surfaceBias)
    }
  ];
}

function markerSurfacePos(raycaster, params, surfaceBias) {
  const result = raycaster.pick({
    ray: {
      origin: params.origin,
      dir: params.dir
    },
    tMin: 0,
    tMax: params.tMax,
    visiblePickableOnly: false
  });
  if (!result.ok || !result.value.hit || !result.value.worldPos) {
    return params.fallback;
  }
  const hit = result.value.worldPos;
  return [
    hit[0] - params.dir[0] * surfaceBias,
    hit[1] - params.dir[1] * surfaceBias,
    hit[2] - params.dir[2] * surfaceBias
  ];
}

function createMarkerNode(marker) {
  const color = MARKER_COLORS[marker.id] || "#2f80ed";
  const node = document.createElement("div");
  node.className = "marker";
  node.dataset.visible = "false";
  node.dataset.occluded = "false";
  node.innerHTML = `
    <div class="label">
      <span class="swatch"></span>
      <span>${escapeHtml(marker.label)}</span>
    </div>
    <span class="leader"></span>
    <span class="pin"></span>`;

  const swatch = node.querySelector(".swatch");
  const pin = node.querySelector(".pin");
  swatch.style.background = color;
  pin.style.background = color;
  return node;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[ch]);
}
