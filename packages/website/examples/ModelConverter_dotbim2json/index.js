// Import the xeokit SDK bundle used by this example.
// It provides the helper, loader, and rendering APIs used in this sample.
import * as xeokit from "../../js/xeokit-demo-bundle.js";
// Create the demo helper.
// It initializes the scene, data, viewer, and renderer context for this demo.
const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const { scene, data} = demoHelper;

  // Create a ModelConverter instance configured to convert our .BIM file into SceneModelParams and DataModelParams JSON.
  // We configure the ModelConverter with a DotBIMLoader to load BIM files, a SceneModelParamsExporter, and a DataModelParamsExporter. We'll also
  // configure the ModelConveter with a single pipeline, "scenemodel", which connects our loader and exporters together into a pipeline.

  const modelConverter = new xeokit.modelconverter.ModelConverter({
    loaders: {
      "dotbim": new xeokit.formats.dotbim.DotBIMLoader()
    },
    exporters: {
      "datamodel": new xeokit.formats.datamodel.DataModelParamsExporter(),
      "scenemodel": new xeokit.formats.scenemodel.SceneModelParamsExporter()
    },
    pipelines: {
      "dotbim2json": {
        inputs: {
          "dotbim": {
            loader: "dotbim"
          }
        },
        outputs: {
          "datamodel": {
            exporter: "datamodel"
          },
          "scenemodel": {
            exporter: "scenemodel"
          }
        }
      }
    }
  });

  // Position the Camera in the scene with eye, look, and up vectors

  demoHelper.createView({
    camera: {
      eye: [11.276311451067942, 16.914467176601914, 7.399026975905038],
      look: [0, 0, 0],
      up: [-0.18971864040782152, -0.28457796061173224, 0.9396926209223285]
    }
  });

  // Create a SceneModel to store the geometry and material data for the model

  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // Create a DataModel to hold the semantic metadata for the model

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error(dataModelResult.error);
  }

  const dataModel = dataModelResult.value;

  // Create an SceneModelParamsLoader to load the geometry and materials into our Viewer's Scene

  const sceneModelParamsLoader = new xeokit.formats.scenemodel.SceneModelParamsLoader();

  // Create an DataModelParamsLoader to load semantic data into our Viewer's Data

  const dataModelParamsLoader = new xeokit.formats.datamodel.DataModelParamsLoader();

  // Fetch the .BIM file containing the source model

  fetch("../../models/BlenderHouse/dotbim/model.bim")
    .then(response => {
      response
        .json()
        .then(fileData => {

          // Convert the .BIM file into IFC (geometry) and DataModelParams (semantics) using the ModelConverter

          modelConverter.convert({
            pipeline: "dotbim2json",
            inputs: {
              dotbim: {
                fileData
              }
            }
          }).then(result => {

            // Load the geometry into the SceneModel

            sceneModelParamsLoader.load({
              fileData: result.outputs.scenemodel.fileData,
              sceneModel,
            }).then(() => {

              // Load the semantic data into the DataModel

              dataModelParamsLoader.load({
                fileData: result.outputs.datamodel.fileData,
                dataModel,
              }).then(() => {

                // The Scene and SceneModel will then contain a SceneObject for each displayable object in our model.
                // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
                // will have a corresponding DataObject with the same ID, to show semantic meaning.
                // The View will contain a ViewObject corresponding to each SceneObject, through which the
                // appearance of the object can be controlled in the View.

                const modelConverterStatsReport = xeokit.modelconverter.reporters.stats.createStatsReport(result);

           //     demoHelper.showModelConverterStatsReport(modelConverterStatsReport);

                demoHelper.finished();

              }).catch(message => {
                console.error(`Error loading DataModelParams: ${message}`);
              });

            }).catch(message => {
              console.error(`Error loading SceneModelParams: ${message}`);
            });

          }).catch(message => {
            console.error(`Error converting .BIM: ${message}`);
          });
        });
    });
});
