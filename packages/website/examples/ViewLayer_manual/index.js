// Import the xeokit SDK bundle used by this example.
// The bundle is preconfigured so we can focus on Scene, View, and ViewLayer usage.

import * as xeokit from "../../js/xeokit-demo-bundle.js";


// Create and initialize the demo helper.
// DemoHelper prepares the shared scene and rendering environment for examples.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const { scene } = demoHelper;

  // Create a View and set its initial camera.
  // Scene holds content, while View controls how content is shown.

  const view = demoHelper.createView({
    camera: {
      eye: [-19.198880324645085, 20.644412394213887, 10.270684931402508],
      look: [33.02005278082366, -35.52204955036619, -18.843578603143392],
      up: [0.2416633264296839, -0.25993204262564124, 0.9348979462355245]
    }
  });

  // Create two ViewLayers.
  // One layer shows the IFC model and another shows helper grid graphics.

  const modelLayerResult = view.createLayer({
    id: "modelLayer"
  });

  if (!modelLayerResult.ok) {
    throw new Error(`Error creating ViewLayer 'modelLayer': ${modelLayerResult.error}`);
  }

  const gridLayerResult = view.createLayer({
    id: "gridLayer"
  });

  if (!gridLayerResult.ok) {
    throw new Error(`Error creating ViewLayer 'gridLayer': ${gridLayerResult.error}`);
  }

  // Create a SceneModel for the building and assign it to modelLayer.
  // Coordinate-system settings make basis, origin, and units explicit.

  const houseModelResult = scene.createModel({
    id: "houseModel",
    layerId: "modelLayer",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 1, 0, // Up
        0, 0, 1  // Forward
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });

  if (!houseModelResult.ok) {
    throw new Error(`Error creating SceneModel 'houseModel': ${houseModelResult.error}`);
  }

  const houseModel = houseModelResult.value;

  // Create an IFC loader.
  // It parses IFC data and fills the SceneModel with renderable content.

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Fetch the IFC file and load it into the SceneModel.
  // After loading, the Scene contains building objects and the View renders them.

  fetch("../../models/IfcOpenHouse2x3/ifc/model.ifc")
    .then(response => response.arrayBuffer())
    .then(fileData => {
      return ifcLoader.load({
        fileData,
        sceneModel: houseModel
      });
    })
    .then(() => {

      // Create a second SceneModel for procedural helper geometry.
      // This keeps generated grid content separate from the building model.

      const gridModelResult = scene.createModel({
        id: "gridGroundPlane",
        layerId: "gridLayer",
        coordinateSystem: {
          basis: [
            1, 0, 0, // Right
            0, 1, 0, // Up
            0, 0, 1  // Forward
          ],
          origin: [0, 0, 0],
          units: "meters",
          scaleToMeters: 1.0
        }
      });

      if (!gridModelResult.ok) {
        throw new Error(`Error creating SceneModel 'gridGroundPlane': ${gridModelResult.error}`);
      }

      const gridModel = gridModelResult.value;

      // Build grid geometry data procedurally.
      // This creates raw positions and indices for a line grid.

      const gridGeometryResult = xeokit.procgen.buildGridGeometry({
        size: 100,
        divisions: 100
      });

      if (!gridGeometryResult.ok) {
        throw new Error(`Error creating grid geometry: ${gridGeometryResult.error}`);
      }

      const gridGeometryData = gridGeometryResult.value;

      // Create the geometry, mesh, and object for the grid.
      // Register geometry first, then build a mesh, then group it into an object.

      gridModel.createGeometry({
        id: "gridGeometry",
        primitive: xeokit.constants.LinesPrimitive,
        positions: gridGeometryData.positions,
        indices: gridGeometryData.indices
      });

      gridModel.createMesh({
        id: "gridMesh",
        geometryId: "gridGeometry",
        position: [0, -5, 0],
        color: [0.4, 0.4, 0.4]
      });

      gridModel.createObject({
        id: "grid",
        meshIds: ["gridMesh"]
      });

      // Finish the demo.
      // The scene now has an IFC model and a generated grid in separate layers.

      demoHelper.finished();
    })
    .catch(error => {
      console.error(`Error loading IFC model: ${error}`);
    });

});
