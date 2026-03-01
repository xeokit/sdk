// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper
  .init()
  .then(() => {

    const {view, scene} = demoHelper;

    view.camera.eye = [ -19.198880324645085,
      20.644412394213887,
      10.270684931402508];
    view.camera.look = [   33.02005278082366,
      -35.52204955036619,
      -18.843578603143392];
    view.camera.up = [0.2416633264296839,
      -0.25993204262564124,
      0.9348979462355245];

    // Manually create two ViewLayers in our View

    const result1 = view.createLayer({
      id: "modelLayer"
    });

    if (!result1.ok) {
      throw new Error(`Error creating ViewLayer 'modelLayer': ${result1.error}`);
    }

    const viewLayer1 = result1.value;

    const result2 = view.createLayer({
      id: "gridLayer"
    });

    if (!result2.ok) {
      throw new Error(`Error creating ViewLayer 'gridLayer': ${result2.error}`);
    }

    const viewLayer2 = result2.value;

    // Create a SceneModel and load a building model into it.
    //
    // The SceneModel specifies that its SceneObject instances will
    // belong to ViewLayer "modelLayer".
    //
    // The "modelLayer" ViewLayer is expected to already exist in our View, because we
    // configured the View with autoLayers: false (true is the default).

    const result3 = scene.createModel({
      id: "houseModel",
      layerId: "modelLayer",
      coordinateSystem: {
        basis: [
          1, 0, 0, // Right
          0, 1, 0, // Up
          0, 0, 1  // Forward
        ],
        origin: [0,0,0],
        units: "meters",
        scaleToMeters: 1
      }
    });

    if (!result3.ok) {
      throw new Error(`Error creating SceneModel: ${result3.error}`);
    }

    const sceneModel = result3.value;

    const ifcLoader = new xeokit.formats.ifc.IFCLoader();

    // Load our IFC data into the SceneModel

    fetch(`../../models/IfcOpenHouse2x3/ifc/model.ifc`)
      .then(response => {
        response
          .arrayBuffer()
          .then(fileData => {

            ifcLoader.load({
              fileData,
              sceneModel

            }).then(() => { // IFC file loaded

              // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.
              // The View will contain a ViewObject corresponding to each SceneObject, through which the
              // appearance of the object can be controlled in the View.

              // Create another SceneModel and programmatically
              // construct a wireframe ground plane grid.
              //
              // The SceneModel specifies that its SceneObject instances will
              // belong to ViewLayer "gridLayer".
              //
              // The "gridLayer" ViewLayer is expected to already exist in our View, because we
              // configured the View with autoLayers: false (true is the default).

              const gridSceneModelResult = scene.createModel({
                id: "gridGroundPlane",
                layerId: "gridLayer",
                coordinateSystem: {
                  basis: [
                    1, 0, 0, // Right
                    0, 1, 0, // Up
                    0, 0, 1  // Forward
                  ],
                  origin: [0,0,0],
                  units: "meters",
                  scaleToMeters: 1.0
                }
              });

              if (!gridSceneModelResult.ok) {
                throw new Error(`Error creating SceneModel: ${gridSceneModelResult.error}`);
              }

              const gridSceneModel = gridSceneModelResult.value;

              const gridResult = xeokit.procgen.buildGridGeometry({
                size: 100,
                divisions: 100
              });

              if (!gridResult.ok) {
                throw new Error(`Error creating grid geometry: ${gridResult.error}`);
              }

              const grid = gridResult.value;

              gridSceneModel.createGeometry({
                id: "gridGeometry",
                primitive: xeokit.constants.LinesPrimitive,
                positions: grid.positions,
                indices: grid.indices
              });

              gridSceneModel.createMesh({
                id: "gridMesh",
                geometryId: "gridGeometry",
                position: [0, -5, 0],
                color: [.4, .4, .4]
              });

              gridSceneModel.createObject({
                id: "grid",
                meshIds: ["gridMesh"]
              });

              // Highlight the ViewObjects in ViewLayer "gridLayer"

           //   view.layers["gridLayer"].setObjectsHighlighted(["grid"], true);

              demoHelper.finished();

            }).catch(message => {
              console.error(`Error loading glTF: ${message}`);
            });
          });
      });


  });
