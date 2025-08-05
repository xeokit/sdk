// Import the xeokit SDK bundle built specifically for the example environment
import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";

// Create a ModelConverter instance configured to convert IFC files into XGF and DataModelParams formats.
// We configure the ModelConverter with an IFCLoader to load IFC files, an XGFExporter to export the geometry to XGF format,
// and a DataModelParamsExporter to export semantic data. We'll also configure the ModelConveter with a single pipeline, "ifc2xgf",
// which connects our loader and exporters together into a pipeline.

const modelConverter = new xeokit.modelconverter.ModelConverter({
  loaders: {
    "ifc": new xeokit.ifc.IFCLoader()
  },
  exporters: {
    "xgf": new xeokit.xgf.XGFExporter(),
    "datamodel": new xeokit.data.DataModelParamsExporter()
  },
  pipelines: {
    "ifc2xgf": {
      inputs: {
        "ifc": {
          loader: "ifc",
          options: {}
        }
      },
      outputs: {
        "xgf": {
          exporter: "xgf",
          version: "1.0",
          options: {}
        },
        "datamodel": {
          exporter: "datamodel",
          version: "1.0",
          options: {}
        }
      }
    }
  }
});

// Create a Scene to manage geometry, materials, and scene structure
const scene = new xeokit.scene.Scene();

// Create a Data instance to manage semantic information (like IFC metadata)
const data = new xeokit.data.Data();

// Initialize a WebGLRenderer to use the browser’s WebGL API for 3D rendering
const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer to visualize the Scene using the WebGLRenderer
const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

// Create a single View within the Viewer, linked to an HTML canvas
const view = viewer.createView({
  id: "demoView",
  elementId: "demoCanvas"
});

// Arrange the View's Camera

view.camera.eye = [-6.01, 4.85, 9.11];
view.camera.look = [3.93, -2.65, -12.51];
view.camera.up = [0.12, 0.95, -0.27];

// Add interactive controls for navigating the View using mouse, keyboard, and touch
new xeokit.cameracontrol.CameraControl(view, {});

// Create a SceneModel to store the geometry and material data for the model
const sceneModel = scene.createModel({
  id: "demoModel"
});

// Create a DataModel to hold the semantic metadata for the model
const dataModel = data.createModel({
  id: "demoModel"
});

// Create a DataModelParamsLoader to load the converted semantic data

const dataModelParamsLoader = new xeokit.data.DataModelParamsLoader();

// Create an XGFLoader to load the XGF into our Viewer's Scene

const xgfLoader = new xeokit.xgf.XGFLoader();

// Ignore the DemoHelper—used only to signal example completion
const demoHelper = new DemoHelper({});

demoHelper.init()
  .then(() => {

    // Fetch the IFC file containing the source model
    fetch("../../models/IfcOpenHouse4/ifc/model.ifc").then(response => {
      response
        .arrayBuffer()
        .then(fileData => {

          // Convert the IFC file into XGF (geometry) and DataModelParams (semantics) using the ModelConverter
          modelConverter.convert({
            pipeline: "ifc2xgf",
            inputs: {
              "ifc": {
                fileData
              }
            }
          }).then(result => {

            // Load the XGF geometry into the SceneModel
            xgfLoader.load({
              fileData: result.outputs["xgf"].fileData,
              sceneModel
            }).then(() => {

              // Load the DataModelParams into the DataModel
              dataModelParamsLoader.load({
                fileData: result.outputs["datamodel"].fileData,
                dataModel
              }).then(() => {

                // The Scene and SceneModel will then contain a SceneObject for each displayable object in our model.
                // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
                // will have a corresponding DataObject with the same ID, to attach semantic meaning.
                // The View will contain a ViewObject corresponding to each SceneObject, through which the
                // appearance of the object can be controlled in the View.

                demoHelper.finished();

              }).catch(message => {
                console.error(`Error loading DataModel: ${message}`);
              });
            }).catch(message => {
              console.error(`Error loading XGF: ${message}`);
            });
          }).catch(message => {
            console.error(`Error converting IFC to XGF+DataModel: ${message}`);
          });
        });
    });
  });
