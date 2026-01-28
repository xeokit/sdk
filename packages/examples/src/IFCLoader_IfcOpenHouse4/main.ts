import * as xeokit from "@xeokit/sdk"

const model = "https://sos-ch-gva-2.exo.io/creoox-public/xeokit-sdk/models/IfcOpenHouse4/ifc/model.ifc"

// Create an IFCLoader to load IFC files

const ifcLoader = new xeokit.ifc.IFCLoader();

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Data to hold semantic data

const data = new xeokit.data.Data();

// Create a WebGLRenderer to use the browser's WebGL graphics API for rendering

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that will use the WebGLRenderer to draw the Scene

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

// Give the Viewer a single View to draw the Scene in our HTML canvas element

const view = viewer.createView({
  id: "demoView",
  elementId: "demoCanvas"
});

if (view instanceof xeokit.core.SDKError) {
  throw new Error(`Error creating View: ${view.message}`);
}

// Arrange the View's Camera

view.camera.eye = [-6.01, 4.85, 9.11];
view.camera.look = [3.93, -2.65, -12.51];
view.camera.up = [0.12, 0.95, -0.27];

// Add a CameraControl to interactively control the View's Camera with keyboard,
// mouse and touch input

new xeokit.cameracontrol.CameraControl(view, {});

// Create a SceneModel to hold our model's geometry and materials

const sceneModel = scene.createModel({
  id: "demoModel"
});

if (sceneModel instanceof xeokit.core.SDKError) {
  throw new Error(`Error creating SceneModel: ${sceneModel.message}`);
}

// Create a DataModel to hold semantic data for our model
const dataModel = data.createModel({
  id: "demoModel"
});

if (dataModel instanceof xeokit.core.SDKError) {
  throw new Error(`Error creating DataModel: ${dataModel.message}`);
}





fetch(model)
  .then(response => {
    response
      .arrayBuffer()
      .then(fileData => {

        ifcLoader.load({
          fileData,
          sceneModel,
          dataModel

        }).then(() => { // IFC file loaded

          // Build the SceneModel.
          // The IFC model now appears in our Viewer.

          sceneModel.build();

          // Build the DataModel.
          // The DataModel and the Data will then contain DataObject,
          // Relationship and PropertySet components that represent the IFC data as an
          // entity-relationship graph.

          dataModel.build();

          // Using the searchObjects function, query the Data for all the
          // IfcMember elements within a given IfcBuildingStorey.

          const resultObjectIds: string[] = [];

          const result = xeokit.data.searchObjects(data, {
            startObjectId: "38aOKO8_DDkBd1FHm_lVXz",
            includeObjects: [xeokit.ifctypes.IfcMember],
            includeRelated: [xeokit.ifctypes.IfcRelAggregates],
            resultObjectIds
          });

          // Check if the query was valid.

          if (result instanceof xeokit.core.SDKError) {
            throw new Error(`Error searching Data: ${result.message}`);
          }

          // If the query succeeded, go ahead and mark whatever
          // objects we found as selected. In this case, it will set the window
          // frames as selected in the View.

          view.setObjectsSelected(resultObjectIds, true);

        }).catch(e => {
          console.error(e);
        });
      });
  });


