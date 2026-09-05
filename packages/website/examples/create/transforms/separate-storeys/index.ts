import {Data, searchObjects} from "@xeokit/sdk/model/data";
import {DataModelImporter} from "@xeokit/sdk/formats/datamodel";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {addSlider, createStandaloneRuntime, failExample, finishExample, mustOk} from "../../../utils/standaloneRuntime.js";

main().catch((error) => {
  failExample("separate-storeys", error);
});

async function main() {
  const data = new Data();
  const {scene, view, renderer} = await createStandaloneRuntime({
    grid: true,
    viewParams: {
      camera: {
        eye: [31.38663988418555, 32.115413398051004, 14.796097980600416],
        look: [0.6121272273206806, 6.666971960818746, 2.5235511335317735],
        up: [-0.2263867800274616, -0.18720656464184895, 0.9558779880213767]
      },
      effects: {
        edges: {
          enabled: true,
          useMeshColor: true,
          edgeWidth: 2
        }
      }
    }
  });

  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));
  const dataModel = mustOk(data.createModel({id: "demoModel"}));

  await new DataModelImporter().load({
    fileData: await fetchJSON("../../../../models/Duplex/datamodel/model.json"),
    dataModel
  });
  await new XGFLoader().load({
    fileData: await fetchArrayBuffer("../../../../models/Duplex/xgf/model.xgf"),
    sceneModel
  });

  const ifcBuildingStoreys = data.objectsByType["IfcBuildingStorey"];
  if (!ifcBuildingStoreys) {
    throw new Error("No IfcBuildingStorey objects found in this model");
  }

  const storeyEntries = Object.values(ifcBuildingStoreys);
  storeyEntries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const storeyTransforms = [];
  for (let i = 0; i < storeyEntries.length; i++) {
    const storey = storeyEntries[i];
    const resultObjectIds = [];
    const searchResult = searchObjects(data, {
      startObjectId: storey.id,
      resultObjectIds
    });
    if (!searchResult.ok) {
      console.warn(`Search failed for storey ${storey.id}`, searchResult);
      continue;
    }

    const transformId = `storeyTransform_${storey.id}`;
    const sceneTransform = mustOk(sceneModel.createTransform({
      id: transformId,
      position: [0, 0, 0]
    }));

    for (const objectId of resultObjectIds) {
      const sceneObject = scene.objects[objectId];
      if (!sceneObject || !sceneObject.meshes) {
        continue;
      }
      for (const sceneMesh of sceneObject.meshes) {
        sceneMesh.setParentTransformId(transformId);
      }
    }

    const center = (storeyEntries.length - 1) * 0.5;
    storeyTransforms.push({
      storeyId: storey.id,
      transform: sceneTransform,
      basePos: [0, 0, 0],
      dirY: i - center
    });
  }

  if (storeyTransforms.length === 0) {
    throw new Error("No storey transforms were created; nothing to separate.");
  }

  const applySeparation = (amount) => {
    for (const s of storeyTransforms) {
      const x = s.dirY * 3.5 * amount * 3;
      s.transform.position = [s.basePos[0] + x, s.basePos[1], s.basePos[2]];
    }
  };

  const panel = createPanel();
  addSlider(panel, {
    label: "Separation",
    min: 0,
    max: 100,
    step: 1,
    value: 100,
    digits: 0,
    onChange: (value) => applySeparation(value / 100)
  });
  applySeparation(1);
  finishExample(renderer, view);
}

async function fetchJSON(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Unable to load ${src}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchArrayBuffer(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Unable to load ${src}: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

function createPanel() {
  const panel = document.createElement("section");
  panel.id = "storeyPanel";
  panel.innerHTML = `
    <style>
      #storeyPanel {
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 200000050;
        width: min(300px, calc(100vw - 32px));
        box-sizing: border-box;
        padding: 14px;
        border: 1px solid rgba(15, 23, 42, 0.14);
        border-radius: 8px;
        background: rgba(248, 250, 252, 0.92);
        color: #1f2937;
        font: 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      #storeyPanel label {
        display: grid;
        grid-template-columns: 82px minmax(0, 1fr) 34px;
        gap: 8px;
        align-items: center;
      }
      #storeyPanel input { width: 100%; min-width: 0; }
      #storeyPanel output { text-align: right; font-variant-numeric: tabular-nums; }
    </style>`;
  document.body.appendChild(panel);
  return panel;
}
