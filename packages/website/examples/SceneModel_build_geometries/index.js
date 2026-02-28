// Import the SDK from a bundle built for these examples.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene} = demoHelper;


    // Position the View's Camera

    // view.camera.eye = [10, 5, 20];
    // view.camera.look = [10, 5, 0];
    // view.camera.up = [0, 1, 0];

    view.camera.orbitPitch(20);

    // Within the Scene, create a SceneModel to hold geometry and materials for our model

    const sceneModelResult = scene.createModel({
      id: "demoModel",
      coordinateSystem: {
        basis: [
          1, 0, 0, // Right
          0, 1, 0, // Up
          0, 0, -1  // Forward
        ],
        origin: [0, 0, 0],
        units: "meters",
        scaleToMeters: 1
      }
    });

    if (!sceneModelResult.ok) {
      throw new Error(sceneModelResult.error);
    }

    const sceneModel = sceneModelResult.value;

      // Create a SceneMesh that represents a red box. The SceneMesh gets a
      // box-shaped SceneGeometry, for which we use buildBoxGeometry to
      // generate the triangle mesh positions and indices. Each SceneMesh
      // we create in this example also has a 4x4 matrix, composed using
      // buildMat4, to specify the modeling transformation that it applies
      // to the SceneGeometry vertex positions to position them within the
      // World coordinate system.

      const boxResult = xeokit.procgen.buildBoxGeometry({
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
        primitive: xeokit.constants.TrianglesPrimitive,
        positions: box.positions,
        indices: box.indices
      });

      sceneModel.createTransform({
        id: "rootTransform",
        position:[0,0,0]
      });

      sceneModel.createMesh({
        id: "boxMesh",
        parentTransformId: "rootTransform",
        geometryId: "boxGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [0, 0, 0],
          color: [1, 0, 0]
        })
      });

      // Create a SceneMesh that represents a blue wireframe box. The
      // SceneMesh gets a box-shaped wireframe SceneGeometry, for which we
      // use buildBoxLinesGeometry to generate the wire mesh positions and indices.

      const boxLinesResult = xeokit.procgen.buildBoxLinesGeometry({
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
        primitive: xeokit.constants.LinesPrimitive,
        positions: boxLines.positions,
        indices: boxLines.indices
      });

      sceneModel.createMesh({
        id: "boxLinesMesh",
        parentTransformId: "rootTransform",
        geometryId: "boxLinesGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [3, 0, 0]
        }),
        color: [0, 0, 1]
      });

      // Create a SceneMesh that represents a green-blue sphere. The
      // SceneMesh gets a sphere-shaped wireframe SceneGeometry, for which we
      // use buildSphereGeometry to generate the triangle mesh positions and indices.

      const sphereResult = xeokit.procgen.buildSphereGeometry({
        center: [0, 0, 0],
        radius: 1.5,
        heightSegments: 60,
        widthSegments: 60
      });

      if (!sphereResult.ok) {
        throw new Error(sphereResult.error);
      }

      const sphere = sphereResult.value;

      sceneModel.createGeometry({
        id: "sphereGeometry",
        primitive: xeokit.constants.TrianglesPrimitive,
        positions: sphere.positions,
        normals: sphere.normals,
        indices: sphere.indices
      });

      sceneModel.createMesh({
        id: "sphereMesh",
        parentTransformId: "rootTransform",
        geometryId: "sphereGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [7, 0, 0]
        }),
        color: [0, 0.5, 1]
      });

      // Create a SceneMesh that represents a purple torus. The
      // SceneMesh gets a torus-shaped wireframe SceneGeometry, for which we
      // use buildTorusGeometry to generate the triangle mesh positions and indices.

      const torusResult = xeokit.procgen.buildTorusGeometry({
        center: [0, 0, 0],
        radius: 1.5,
        tube: 0.5,
        radialSegments: 32,
        tubeSegments: 24,
        arc: Math.PI * 2.0
      });

      if (!torusResult.ok) {
        throw new Error(torusResult.error);
      }

      const torus = torusResult.value;

      sceneModel.createGeometry({
        id: "torusGeometry",
        primitive: xeokit.constants.TrianglesPrimitive,
        positions: torus.positions,
        normals: torus.normals,
        indices: torus.indices
      });

      sceneModel.createMesh({
        id: "torusMesh",
        parentTransformId: "rootTransform",
        geometryId: "torusGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [11, 0, 0]
        }),
        color: [0.7, 0, 1]
      });

      // Create a SceneMesh that represents a yellow cylinder. The
      // SceneMesh gets a cylinder-shaped triangle mesh SceneGeometry, for which we
      // use buildCylinderGeometry to generate the triangle mesh positions and indices.

      const cylinderResult = xeokit.procgen.buildCylinderGeometry({
        center: [0, 0, 0],
        radiusTop: 1.0,
        radiusBottom: 2.0,
        height: 2.5,
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
        primitive: xeokit.constants.TrianglesPrimitive,
        positions: cylinder.positions,
        normals: cylinder.normals,
        indices: cylinder.indices
      });

      sceneModel.createMesh({
        id: "cylinderMesh",
        parentTransformId: "rootTransform",
        geometryId: "cylinderGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [16, 0, 0]
        }),
        color: [1, .6, 0]
      });

      // Create a SceneMesh that represents a green grid. The
      // SceneMesh gets a grid-shaped wireframe SceneGeometry, for which we
      // use buildGridGeometry to generate the wireframe mesh positions and indices.

      const gridResult = xeokit.procgen.buildGridGeometry({
        size: 10,
        divisions: 10
      });

      if (!gridResult.ok) {
        throw new Error(gridResult.error);
      }

      const grid = gridResult.value;

      sceneModel.createGeometry({
        id: "gridGeometry",
        primitive: xeokit.constants.LinesPrimitive,
        positions: grid.positions,
        indices: grid.indices
      });

      sceneModel.createMesh({
        id: "gridMesh",
        parentTransformId: "rootTransform",
        geometryId: "gridGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [25, 0, 0]
        }),
        color: [0, 1, 0]
      });

      // Create a SceneMesh that represents green wireframe text. The
      // SceneMesh gets a text-shaped wireframe SceneGeometry, for which we
      // use buildVectorTextGeometry to generate the wireframe mesh positions
      // and indices.

      const textResult = xeokit.procgen.buildVectorTextGeometry({
        text: "An assortment of geometry\nprogrammatically generated\nwithin a SceneModel\nusing instanced geometry",
      });

      if (!textResult.ok) {
        throw new Error(textResult.error);
      }

      const text = textResult.value;

      sceneModel.createGeometry({
        id: "textGeometry",
        primitive: xeokit.constants.LinesPrimitive,
        positions: text.positions,
        indices: text.indices
      });

      sceneModel.createMesh({
        id: "textMesh",
        parentTransformId: "rootTransform",
        geometryId: "textGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [0, 10.0, 0]
        }),
        color: [0, 1, 1]
      });

      // Create a SceneMesh that represents a cloud of points. The
      // SceneMesh gets a SceneGeometry that contains an array that provides
      // the 3D position of each point.

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
        primitive: xeokit.constants.PointsPrimitive,
        positions,
        colors
      });

      sceneModel.createMesh({
        id: "pointsMesh",
        parentTransformId: "rootTransform",
        geometryId: "pointsGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [-7, 0, 0],
          scale: [4, 4, 4],
          rotation: [0, 0, 0]
        }),
      });

      // Create a SceneObject that aggregates all of our SceneMeshes.

      sceneModel.createObject({
        id: "geometriesObject",
        meshIds: [
          "boxMesh", "boxLinesMesh", "sphereMesh",
          "torusMesh", "cylinderMesh", "gridMesh",
          "textMesh", "pointsMesh"
        ]
      });

    // At this point, the View will contain a single ViewObject that has the same ID as the SceneObject. Through
    // the ViewObject, we can update the appearance of our geometries in that View.

    // view.objects["geometriesObject"].highlighted = true;
    // view.setObjectsHighlighted(view.highlightedObjectIds, false);

  demoHelper.viewFit();

  demoHelper.orbit();

  demoHelper.finished();
  });
