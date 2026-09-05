// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene, procedural geometry, and rendering APIs used
// by this example.
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {buildBox, buildBoxLines, buildCylinder, buildGrid, buildSphere, buildTorus, buildVectorText} from "@xeokit/sdk/model/generation/buildGeometry";
import {buildMat4} from "@xeokit/sdk/model/scene";
import {createStandaloneRuntime, failExample, finishExample, mustOk} from "../../../utils/standaloneRuntime.js";

const {scene, view, renderer} = await createStandaloneRuntime({
  navigation: true,
  viewParams: {
    camera: {
      eye: [10, -30, 0],
      look: [10, 0, 0],
      up: [0, 0, 1]
    }
  }
});

try {
  view.linesMaterial.linePattern = "solid";
  view.effects.edges.enabled = false;
  mustOk(renderer.setInfiniteGridEnabled(false));

  // Create a SceneModel to hold the geometry, meshes, transforms, and
  // objects used by this example. The coordinate system is defined
  // explicitly to ensure consistent axis orientation and units.
  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 1, 0, // Up
        0, 0, -1 // Forward
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });

  // Ensure that the SceneModel was created successfully before continuing.
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // Build a box geometry procedurally. The generated positions and indices
  // define a solid triangle mesh that will be reused by a SceneMesh.
  const boxResult = buildBox({
    xSize: 1,
    ySize: 1,
    zSize: 1
  });

  if (!boxResult.ok) {
    throw new Error(boxResult.error);
  }

  const box = boxResult.value;

  sceneModel.createGeometry({
    id: "boxGeometry",
    primitive: TrianglesPrimitive,
    positions: box.positions,
    indices: box.indices
  });

  // Create a root transform that acts as the common parent for all meshes
  // in the example.
  sceneModel.createTransform({
    id: "rootTransform",
    position: [0, 0, 0]
  });

  // Create a mesh for the solid box geometry. The mesh is positioned at the
  // origin of the row of generated examples.
  sceneModel.createMesh({
    id: "boxMesh",
    parentTransformId: "rootTransform",
    geometryId: "boxGeometry",
    color: [1, 0, 0],
    matrix: buildMat4({
      position: [0, 0, 0]
    })
  });

  // Build a wireframe box geometry procedurally. This produces line
  // positions and indices instead of a triangle mesh.
  const boxLinesResult = buildBoxLines({
    xSize: 1,
    ySize: 1,
    zSize: 1
  });

  if (!boxLinesResult.ok) {
    throw new Error(boxLinesResult.error);
  }

  const boxLines = boxLinesResult.value;

  sceneModel.createGeometry({
    id: "boxLinesGeometry",
    primitive: LinesPrimitive,
    positions: boxLines.positions,
    indices: boxLines.indices
  });

  // Create a mesh for the wireframe box and place it a short distance
  // along the row.
  sceneModel.createMesh({
    id: "boxLinesMesh",
    parentTransformId: "rootTransform",
    geometryId: "boxLinesGeometry",
    matrix: buildMat4({
      position: [3, 0, 0]
    }),
    color: [0, 0, 1]
  });

  // Build a sphere geometry procedurally using a dense tessellation to
  // produce a smooth surface.
  const sphereResult = buildSphere({
    center: [0, 0, 0],
    radius: 1.50,
    heightSegments: 60,
    widthSegments: 60
  });

  if (!sphereResult.ok) {
    throw new Error(sphereResult.error);
  }

  const sphere = sphereResult.value;

  sceneModel.createGeometry({
    id: "sphereGeometry",
    primitive: TrianglesPrimitive,
    positions: sphere.positions,
    normals: sphere.normals,
    indices: sphere.indices
  });

  // Create a mesh for the sphere and position it further along the row.
  sceneModel.createMesh({
    id: "sphereMesh",
    parentTransformId: "rootTransform",
    geometryId: "sphereGeometry",
    matrix: buildMat4({
      position: [7, 0, 0]
    }),
    color: [0, 0.50, 1]
  });

  // Build a torus geometry procedurally. The torus is defined by its
  // major radius, tube radius, and segment counts.
  const torusResult = buildTorus({
    center: [0, 0, 0],
    radius: 1.50,
    tube: 0.50,
    radialSegments: 32,
    tubeSegments: 24,
    arc: Math.PI * 2.00
  });

  if (!torusResult.ok) {
    throw new Error(torusResult.error);
  }

  const torus = torusResult.value;

  sceneModel.createGeometry({
    id: "torusGeometry",
    primitive: TrianglesPrimitive,
    positions: torus.positions,
    normals: torus.normals,
    indices: torus.indices
  });

  // Create a mesh for the torus and position it beside the sphere.
  sceneModel.createMesh({
    id: "torusMesh",
    parentTransformId: "rootTransform",
    geometryId: "torusGeometry",
    matrix: buildMat4({
      position: [11, 0, 0]
    }),
    color: [0.70, 0, 1]
  });

  // Build a cylinder geometry procedurally. This example uses different
  // top and bottom radii to create a tapered form.
  const cylinderResult = buildCylinder({
    center: [0, 0, 0],
    radiusTop: 1.00,
    radiusBottom: 2.00,
    height: 2.50,
    radialSegments: 20,
    heightSegments: 1,
    openEnded: false
  });

  if (!cylinderResult.ok) {
    throw new Error(cylinderResult.error);
  }

  const cylinder = cylinderResult.value;

  sceneModel.createGeometry({
    id: "cylinderGeometry",
    primitive: TrianglesPrimitive,
    positions: cylinder.positions,
    normals: cylinder.normals,
    indices: cylinder.indices
  });

  // Create a mesh for the cylinder and position it further along the row.
  sceneModel.createMesh({
    id: "cylinderMesh",
    parentTransformId: "rootTransform",
    geometryId: "cylinderGeometry",
    matrix: buildMat4({
      position: [16, 0, 0]
    }),
    color: [1, 0.60, 0]
  });

  // Build a grid geometry procedurally. This produces a wireframe grid
  // composed of line segments.
  const gridResult = buildGrid({
    size: 10,
    divisions: 10
  });

  if (!gridResult.ok) {
    throw new Error(gridResult.error);
  }

  const grid = gridResult.value;

  sceneModel.createGeometry({
    id: "gridGeometry",
    primitive: LinesPrimitive,
    positions: grid.positions,
    indices: grid.indices
  });

  // Create a mesh for the grid and place it near the end of the row.
  sceneModel.createMesh({
    id: "gridMesh",
    parentTransformId: "rootTransform",
    geometryId: "gridGeometry",
    matrix: buildMat4({
      position: [25, 0, 0]
    }),
    color: [0, 1, 0]
  });

  // Build vector text geometry procedurally. The result is a wireframe
  // representation of the supplied text string.
  const textResult = buildVectorText({
    text: "An assortment of programmatically\ngenerated geometries\nwithin a SceneModel",
  });

  if (!textResult.ok) {
    throw new Error(textResult.error);
  }

  const text = textResult.value;

  sceneModel.createGeometry({
    id: "textGeometry",
    primitive: LinesPrimitive,
    positions: text.positions,
    indices: text.indices
  });

  // Create a mesh for the vector text and place it above the row of
  // generated shapes.
  sceneModel.createMesh({
    id: "textMesh",
    parentTransformId: "rootTransform",
    geometryId: "textGeometry",
    matrix: buildMat4({
      position: [0, 10.00, 0]
    }),
    color: [0, 1, 1]
  });

  // Generate a cloud of random points with per-point colors. Each unique
  // point position is stored once, and a random RGBA color is assigned.
  const positions = [];
  const colors = [];

  const map = {};

  for (let i = 0; i < 2000;) {
    const x = Math.random();
    const y = Math.random();
    const z = Math.random();

    const hash = "" + x + "." + y + "." + z;
    if (map[hash]) {
      continue;
    }

    map[hash] = true;

    positions.push(x);
    positions.push(y);
    positions.push(z);

    colors.push(Math.random());
    colors.push(Math.random());
    colors.push(Math.random());
    colors.push(Math.random());

    i++;
  }

  sceneModel.createGeometry({
    id: "pointsGeometry",
    primitive: PointsPrimitive,
    positions,
    colors
  });

  // Create a mesh for the point cloud and scale it up so that the random
  // distribution is easier to see.
  sceneModel.createMesh({
    id: "pointsMesh",
    parentTransformId: "rootTransform",
    geometryId: "pointsGeometry",
    matrix: buildMat4({
      position: [-7, 0, 0],
      scale: [4, 4, 4],
      rotation: [0, 0, 0]
    }),
  });

  // Create a SceneObject that aggregates all generated meshes so they can
  // be managed together as a single logical object.
  sceneModel.createObject({
    id: "geometriesObject",
    meshIds: [
      "boxMesh", "boxLinesMesh", "sphereMesh",
      "torusMesh", "cylinderMesh", "gridMesh",
      "textMesh", "pointsMesh"
    ]
  });

  // At this point, the View contains a corresponding ViewObject for the
  // aggregated SceneObject. That ViewObject can be used to control the
  // appearance of the generated content within the View.

  // view.objects["geometriesObject"].setStyleBin("highlighted", true);
  // view.setObjectsInStyleBin("highlighted", view.styleBins.getObjectIds("highlighted"), false);

  finishExample(renderer, view);
} catch (error) {
  failExample("geometries", error);
}
