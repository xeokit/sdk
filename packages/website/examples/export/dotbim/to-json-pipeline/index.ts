import {ModelConverter} from "@xeokit/sdk/conversion/pipeline";
import {DataModelExporter, DataModelImporter} from "@xeokit/sdk/formats/datamodel";
import {DotBIMLoader} from "@xeokit/sdk/formats/dotbim";
import {SceneModelExporter, SceneModelImporter} from "@xeokit/sdk/formats/scenemodel";
import {Data} from "@xeokit/sdk/model/data";
import {createStandaloneRuntime, failExample, fetchJSON, finishExample, mustOk} from "../../../utils/standaloneRuntime.js";

main().catch((error) => {
  failExample("dotbim-to-json-pipeline", error);
});

async function main() {
  const data = new Data();
  const {scene, view, renderer} = await createStandaloneRuntime({
    grid: true,
    viewParams: {
      camera: {
        eye: [11.276311451067942, 16.914467176601914, 7.399026975905038],
        look: [0, 0, 0],
        up: [-0.18971864040782152, -0.28457796061173224, 0.9396926209223285]
      }
    }
  });

  const modelConverter = new ModelConverter({
    loaders: {
      dotbim: new DotBIMLoader()
    },
    exporters: {
      datamodel: new DataModelExporter(),
      scenemodel: new SceneModelExporter()
    },
    pipelines: {
      dotbim2json: {
        inputs: {
          dotbim: {
            loader: "dotbim"
          }
        },
        outputs: {
          datamodel: {
            exporter: "datamodel"
          },
          scenemodel: {
            exporter: "scenemodel"
          }
        }
      }
    }
  });

  const sceneModel = mustOk(scene.createModel({id: "demoModel"}));
  const dataModel = mustOk(data.createModel({id: "demoModel"}));
  const fileData = await fetchJSON("../../../../models/BlenderHouse/dotbim/model.bim");
  const result = await modelConverter.convert({
    pipeline: "dotbim2json",
    inputs: {
      dotbim: {
        fileData
      }
    },
    outputs: {
      datamodel: {},
      scenemodel: {}
    },
    reports: {}
  });

  await new SceneModelImporter().load({
    fileData: result.outputs.scenemodel.fileData,
    sceneModel
  });
  await new DataModelImporter().load({
    fileData: result.outputs.datamodel.fileData,
    dataModel
  });

  console.log("[dotbim to json pipeline]", {
    inputs: Object.keys(result.inputs),
    outputs: Object.keys(result.outputs)
  });
  // The view was created with an explicit camera for the imported pipeline output.
  finishExample(renderer, view);
}
