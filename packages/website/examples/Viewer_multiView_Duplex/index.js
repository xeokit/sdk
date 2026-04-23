// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene, data, loader, and rendering APIs used by this example.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({
  maxViews: 2
});

function must(result, what) {
  if (!result.ok) {
    throw new Error(`Failed to create ${what}: ${result.error}`);
  }
  return result.value;
}

function subtractVec3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scaleVec3(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function addVec3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function crossVec3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function lengthVec3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalizeVec3(v) {
  const len = lengthVec3(v);
  if (len < 1e-8) {
    return [0, 0, 1];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

function composeBasisMatrix4(origin, xAxis, yAxis, zAxis, scale) {
  return [
    xAxis[0] * scale[0], xAxis[1] * scale[0], xAxis[2] * scale[0], 0,
    yAxis[0] * scale[1], yAxis[1] * scale[1], yAxis[2] * scale[1], 0,
    zAxis[0] * scale[2], zAxis[1] * scale[2], zAxis[2] * scale[2], 0,
    origin[0], origin[1], origin[2], 1
  ];
}

function getCameraBasis(camera) {
  const eye = camera.eye;
  const look = camera.look;
  const forward = normalizeVec3(subtractVec3(look, eye));
  let right = normalizeVec3(crossVec3(forward, camera.up));

  if (lengthVec3(right) < 1e-6) {
    right = [1, 0, 0];
  }

  const up = normalizeVec3(crossVec3(right, forward));
  return { eye, forward, right, up };
}

function createFrustumGeometry({ near = 0.35, far = 1.0, nearHalfWidth = 0.08, nearHalfHeight = 0.08, farHalfWidth = 0.45, farHalfHeight = 0.28 }) {
  // Local +Y is camera-forward. The frustum is truncated: no apex.
  // Near plane is close to the camera eye, far plane points away from it.
  const positions = [
    // Near plane, y = near
    -nearHalfWidth, near, -nearHalfHeight,
    nearHalfWidth, near, -nearHalfHeight,
    nearHalfWidth, near,  nearHalfHeight,
    -nearHalfWidth, near,  nearHalfHeight,

    // Far plane, y = far
    -farHalfWidth, far, -farHalfHeight,
    farHalfWidth, far, -farHalfHeight,
    farHalfWidth, far,  farHalfHeight,
    -farHalfWidth, far,  farHalfHeight
  ];

  const indices = [
    // near cap
    0, 1, 2, 0, 2, 3,
    // far cap
    4, 6, 5, 4, 7, 6,
    // sides
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0
  ];

  return { positions, indices };
}

function createCameraMarker(sceneModel, idPrefix, color, layerId) {
  const bodyId = `${idPrefix}.body`;
  const frustumId = `${idPrefix}.frustum`;
  const objectId = `${idPrefix}.object`;

  sceneModel.createMesh({
    id: bodyId,
    geometryId: "cameraBodyGeometry",
    matrix: xeokit.scene.buildMat4({
      position: [0, 0, 0],
      scale: [1, 1, 1]
    }),
    color,
    opacity: 0.95
  });

  sceneModel.createMesh({
    id: frustumId,
    geometryId: "cameraFrustumGeometry",
    matrix: xeokit.scene.buildMat4({
      position: [0, 0, 0],
      scale: [1, 1, 1]
    }),
    color,
    opacity: 0.22
  });

  sceneModel.createObject({
    id: objectId,
    meshIds: [bodyId, frustumId],
    layerId
  });

  return { bodyId, frustumId, objectId };
}

function updateCameraMarker(sceneModel, marker, camera, markerSize = 0.45, frustumLength = 4.0) {
  const { eye, forward, right, up } = getCameraBasis(camera);

  const fovDeg = camera.perspectiveProjection?.fov ?? 60;
  const fovRad = fovDeg * Math.PI / 180;

  // Use the view canvas aspect ratio when available, otherwise fall back to 16:9.
  const canvas = camera.view?.canvasElement;
  const aspect = canvas && canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 16 / 9;

  const farHalfHeight = Math.tan(fovRad * 0.5) * frustumLength;
  const farHalfWidth = farHalfHeight * aspect;
  const nearHalfHeight = farHalfHeight * 0.12;
  const nearHalfWidth = farHalfWidth * 0.12;

  const bodyMatrix = composeBasisMatrix4(
    eye,
    right,
    forward,
    up,
    [markerSize, markerSize, markerSize]
  );

  // The generated frustum is normalized to: near=0.35, far=1.0,
  // nearHalfWidth/Height=0.08, farHalfWidth=0.45, farHalfHeight=0.28.
  // Scale it so local +Y follows the camera forward vector, with the wide end
  // away from the camera. This is the "flipped" direction requested.
  const frustumMatrix = composeBasisMatrix4(
    eye,
    right,
    forward,
    up,
    [farHalfWidth / 0.45, frustumLength, farHalfHeight / 0.28]
  );

  sceneModel.meshes[marker.bodyId].matrix = bodyMatrix;
  sceneModel.meshes[marker.frustumId].matrix = frustumMatrix;
}

function syncCameraMarkers(sceneModel, viewA, viewB, markerA, markerB) {
  // In view B we show view A's camera marker.
  updateCameraMarker(sceneModel, markerA, viewA.camera);

  // In view A we show view B's camera marker.
  updateCameraMarker(sceneModel, markerB, viewB.camera);
}

function mustLayer(view, layerId) {
  const layer = view.layers[layerId];
  if (!layer) {
    throw new Error(`Expected ViewLayer "${layerId}" in View "${view.id}"`);
  }
  return layer;
}

function setViewLayerVisible(view, layerId, visible) {
  const layer = mustLayer(view, layerId);
  layer.setObjectsVisible(layer.objectIds, visible);
}

async function main() {
  await demoHelper.init();

  const { scene, data, viewer } = demoHelper;

  // Two views of the same building. Each view shows a 3D marker for the other
  // view's camera. The marker is a small sphere plus a truncated frustum that
  // indicates the camera's position, orientation, and perspective field of view.
  const viewA = demoHelper.createView({
    id: "viewA",
    camera: {
      projection: "perspective",
      eye: [-16, -14, 10],
      look: [4, 4, 4],
      up: [0, 0, 1]
    }
  });

  const viewB = demoHelper.createView({
    id: "viewB",
    camera: {
      projection: "perspective",
      eye: [22, 4, 8],
      look: [4, 4, 4],
      up: [0, 0, 1]
    }
  });

  const sceneModel = must(scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }), "SceneModel");

  const dataModel = must(data.createModel({
    id: "demoModel"
  }), "DataModel");

  const sphere = must(xeokit.procgen.buildSphereGeometry({
    radius: 1,
    widthSegments: 16,
    heightSegments: 12
  }), "sphere geometry");

  const frustum = createFrustumGeometry({
    near: 0.35,
    far: 1.0,
    nearHalfWidth: 0.08,
    nearHalfHeight: 0.08,
    farHalfWidth: 0.45,
    farHalfHeight: 0.28
  });

  sceneModel.createGeometry({
    id: "cameraBodyGeometry",
    primitive: xeokit.constants.TrianglesPrimitive,
    positions: sphere.positions,
    indices: sphere.indices
  });

  sceneModel.createGeometry({
    id: "cameraFrustumGeometry",
    primitive: xeokit.constants.TrianglesPrimitive,
    positions: frustum.positions,
    indices: frustum.indices
  });

  // Load one building and show it in both views.
  await demoHelper.loadModel({
    id: "demoModel",
    src: "../../models/Duplex/datamodel/model.json",
    format: "datamodel",
    dataModel
  });

  await demoHelper.loadModel({
    id: "demoModel",
    src: "../../models/Duplex/xgf/model.xgf",
    format: "xgf",
    sceneModel
  });

  const cameraALayerId = "cameraAIndicator";
  const cameraBLayerId = "cameraBIndicator";

  // Each marker SceneObject gets its own layerId. Because ViewLayers group
  // ViewObjects by SceneObject.layerId, each View can independently show or
  // hide each marker layer.
  const markerA = createCameraMarker(sceneModel, "cameraAMarker", [0.98, 0.40, 0.12], cameraALayerId);
  const markerB = createCameraMarker(sceneModel, "cameraBMarker", [0.18, 0.48, 0.95], cameraBLayerId);

  sceneModel.finalize();

  const syncMarkers = () => {
    syncCameraMarkers(sceneModel, viewA, viewB, markerA, markerB);
  };

  syncMarkers();

  // Marker visibility is per-view:
  // - view A shows only view B's camera indicator
  // - view B shows only view A's camera indicator
  setViewLayerVisible(viewA, cameraALayerId, false);
  setViewLayerVisible(viewA, cameraBLayerId, true);
  setViewLayerVisible(viewB, cameraALayerId, true);
  setViewLayerVisible(viewB, cameraBLayerId, false);

  // Sync marker transforms via Viewer#events instead of a requestAnimationFrame loop.
  viewer.events.onCameraViewMatrixUpdated.subscribe(() => {
    syncMarkers();
  });

  viewer.events.onCameraProjMatrixUpdated.subscribe(() => {
    syncMarkers();
  });

  viewer.events.onCameraProjectionTypeChanged.subscribe(() => {
    syncMarkers();
  });

  viewer.events.onViewCanvasBoundaryChanged.subscribe(() => {
    syncMarkers();
  });

  demoHelper.finished();
}

main().catch((err) => {
  console.error(err);
});
