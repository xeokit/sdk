// Demonstrates WebGLRenderer.createMarkerOcclusionTester() with HTML
// annotations pinned to world-space marker positions. The annotations are
// regular DOM nodes; every camera update projects them to canvas space and
// uses the BVH-backed tester to hide labels whose anchors are behind model
// geometry.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const XGF_URL = "../../models/Duplex/xgf/model.xgf";

const MARKER_COLORS = {
  front: "#2f80ed",
  rear: "#d04f3a",
  east: "#1d8f6f",
  west: "#a15fc7",
  roof: "#d69a1d"
};

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const {scene, renderer, viewer} = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [24.40, 23.70, 27.04],
      look: [4.39,  8.90,  2.54],
      up:   [-0.56, -0.41, 0.71]
    },
    renderMode: xeokit.base.constants.DetailedRender
  });

  const sceneModel = must(scene.createModel({
    id: "duplex",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right:   source +X
        0, 1, 0, // Up:      source +Y
        0, 0, 1  // Forward: source +Z
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));
  const xgfResp = await fetch(XGF_URL);
  if (!xgfResp.ok) {
    throw new Error(`HTTP ${xgfResp.status} fetching ${XGF_URL}`);
  }
  const fileData = await xgfResp.arrayBuffer();
  await new xeokit.formats.xgf.XGFLoader().load({fileData, sceneModel});

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

  const placementRaycaster = new xeokit.spatial.collision.SceneRaycaster(scene);
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
  hideStudioLoadingSpinner(studio);
  studio.finished();
});

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

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
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

function hideStudioLoadingSpinner(studio) {
  if (studio._loadingSpinner && typeof studio._loadingSpinner.hide === "function") {
    studio._loadingSpinner.hide();
  }
}
