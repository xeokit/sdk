// Example: xeokit SDK benchmarking - matrix of colored boxes grouped into objects

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Parameters for benchmarking
const numRows = 80;      // Number of rows in the matrix
const numCols = 80;      // Number of columns in the matrix
const numObjects = 30;   // Number of objects (groups of boxes)
const boxSpacing = 2.2;  // Spacing between boxes

// Create main xeokit components
const scene = new xeokit.scene.Scene();
const data = new xeokit.data.Data();
const viewer = new xeokit.viewer.Viewer();
const renderer = new xeokit.webglrenderer.WebGLRenderer({
  memoryConfigs: xeokit.webglrenderer.createMemoryConfigs({ // Memory limits
    grossMemoryMB: 108024,
    device: "medium", // Assume mid-range device
    utilization: 0.7, // Use 70% of available memory
    user: { // No overrides
    }
  })
});

// // Log all events to the console for debugging
// new xeokit.core.EventsLogger(scene.events,    {prefix: "[Scene    ]"});
// new xeokit.core.EventsLogger(data.events,     {prefix: "[Data     ]"});
// new xeokit.core.EventsLogger(viewer.events,   {prefix: "[Viewer   ]"});
// new xeokit.core.EventsLogger(renderer.events, {prefix: "[Renderer ]"});

// Attach components together
viewer.attachScene(scene);
renderer.attachViewer(viewer);

// Create a View to render the Scene in the HTML canvas
const viewResult = viewer.createView({
  id: "benchmarkView",
  elementId: "demoCanvas",
  transparent: true,
  backgroundColor: [0.05, 0.05, 0.05]
});
if (!viewResult.ok) throw new Error("Failed to create View");
const view = viewResult.value;

// Set up the camera position to see the whole matrix
view.camera.eye  = [numCols * boxSpacing / 2, numRows * boxSpacing / 2, Math.max(numRows, numCols) * 3];
view.camera.look = [numCols * boxSpacing / 2, numRows * boxSpacing / 2, 0];
view.camera.up   = [0, 1, 0];

// Enable interactive camera controls
new xeokit.cameracontrol.CameraControl(view);

// Create a SceneModel to hold geometry and meshes
const sceneModelResult = scene.createModel({ id: "benchmarkModel" });
if (!sceneModelResult.ok) throw new Error("Failed to create SceneModel");
const sceneModel = sceneModelResult.value;

// Create a single box geometry (unit cube)
sceneModel.createGeometry({
  id: "boxGeometry",
  primitive: xeokit.constants.TrianglesPrimitive,
  positions: [
    -1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1, -1,
    -1, -1,  1,  1, -1,  1,  1,  1,  1, -1,  1,  1
  ],
  indices: [
    0, 1, 2, 0, 2, 3,    // Bottom
    4, 5, 6, 4, 6, 7,    // Top
    0, 1, 5, 0, 5, 4,    // Front
    3, 2, 6, 3, 6, 7,    // Back
    0, 3, 7, 0, 7, 4,    // Left
    1, 2, 6, 1, 6, 5     // Right
  ]
});

// Prepare mesh IDs for each object
const objectMeshIds = Array.from({length: numObjects}, () => []);

function hsvToRgb(hsv) {
  let [h, s, v] = hsv;

  h = ((h % 360) + 360) % 360; // normalize hue
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;

  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}


// Create all box meshes
for (let row = 0; row < numRows; row++) {
  for (let col = 0; col < numCols; col++) {
    // Assign each box to an object (e.g., by block, row, or column)
    // Here: group by block
    const objectIndex = Math.floor((row * numCols + col) / Math.ceil((numRows * numCols) / numObjects));
    // Color by object
    const hue = objectIndex / numObjects;
    const color = hsvToRgb([hue * 360, 0.7, 1.0]); // Returns [r,g,b]
    // Position in grid
    const x = col * boxSpacing;
    const y = row * boxSpacing;
    const z = 0;
    // Unique mesh ID
    const meshId = `boxMesh_${row}_${col}`;
    // Create mesh
    const meshResult = sceneModel.createMesh({
      id: meshId,
      geometryId: "boxGeometry",
      matrix: xeokit.scene.buildMat4({ position: [x, y, z], scale: [0.9, 0.9, 0.9] }),
      color: color
    });
    if (meshResult.ok) {
      objectMeshIds[objectIndex].push(meshId);
    }
  }
}

// Create objects, each grouping a subset of meshes
for (let i = 0; i < numObjects; i++) {
  const objectId = `boxObject_${i}`;
  sceneModel.createObject({
    id: objectId,
    meshIds: objectMeshIds[i]
  });
}

// Animate all boxes: rotate each mesh around Y axis
let r = 0;
new xeokit.core.SDKTask({
  name: "Rotate all box meshes",
  repeat: true,
  stage: xeokit.core.SDKTask.CollectInputStage,
  task: () => {
    r += 1;
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const meshId = `boxMesh_${row}_${col}`;
        const mesh = sceneModel.meshes[meshId];
        if (mesh) {

          // Position in grid
          const x = col * boxSpacing;
          const y = row * boxSpacing;
          const z = 0;

          // Optionally, offset rotation by object index for visual separation
          const objectIndex = Math.floor((row * numCols + col) / Math.ceil((numRows * numCols) / numObjects));
          mesh.matrix = xeokit.math.rotationMat4v(r + objectIndex * 0.2, [0, 1, 0]);

          mesh.matrix = xeokit.scene.buildMat4({ position: [x, y, z], scale: [0.9, 0.9, 0.9], rotation: [-r/5, r, r/3] });
        }
      }
    }
  }
});

// (Optional) Debug: access the shader view after a short delay
setTimeout(() => {
  const shaderViewResult = renderer.getShaderView();
  if (!shaderViewResult.ok) return;
  const shaderView = shaderViewResult.value;
  // new xeokit.webglrenderer.internal.ShaderDebugger(shaderView, document.getElementById("data-textures-debugger"));
  // new xeokit.webglrenderer.internal.MemoryDebugger(renderer, document.getElementById("data-textures-debugger"));
}, 2000);
