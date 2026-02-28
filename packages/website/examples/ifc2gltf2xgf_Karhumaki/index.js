// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data, renderer} = demoHelper;

  const drawInspectorResult = renderer.getRenderInspector();

  if (!drawInspectorResult.ok) {
    throw new Error("Failed to get RenderInspector: " + drawInspectorResult.error);
  }

// Create a SceneModel to hold our model's geometry and materials

  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // Create a DataModel to hold semantic data for our model

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const dataModel = dataModelResult.value;

  // Fetch the ModelChunksManifestParams for the model. This file was output by ifc2gltf2xgf.

  fetch(`../../models/KarhumakiBridge/ifc2gltf2xgf/model.manifest.json`)
    .then(response => {
      response
        .json()
        .then(modelChunksManifest => {

          // Create a ModelChunksLoader, equipped with an XGFLoader and a DataModelParamsLoader.

          const modelChunksLoader = new xeokit.modelchunksloader.ModelChunksLoader({
            sceneModelLoader: new xeokit.formats.xgf.XGFLoader(),
            dataModelLoader: new xeokit.formats.datamodel.DataModelParamsLoader()
          });

          // Use the ModelChunksLoader to load the glTF
          // and JSON files listed in the ModelChunksManifestParams. The ModelChunksLoader will use XGFLoader to
          // load each XGF file into the SceneModel, and DataModelParamsLoader to load each JSON DataModelParams
          // file into the DataModel.

          modelChunksLoader.load({
            modelChunksManifest,
            baseDir: "../../models/KarhumakiBridge/ifc2gltf2xgf/",
            sceneModel,
            dataModel

          }).then(() => { // XGF and JSON files loaded

            // The Karhumaki Bridge model now appears in our Viewer.

            demoHelper.viewFit();

            demoHelper.finished();

          }).catch(e => {
            console.error(e);
            demoHelper.finished();

          });
        });
    });
});

