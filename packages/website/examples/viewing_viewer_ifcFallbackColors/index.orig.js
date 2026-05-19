// Import the xeokit SDK bundle used by this example.
// This includes the rendering engine plus format loaders and demo helpers.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

//------------------------------------------------------------------------------------------------------------------
// Fallback colour map for the architectural model (FM_ARC).
//------------------------------------------------------------------------------------------------------------------

const arcColorMap = {
  GltfWall:                 { colorize: [0.741, 0.741, 0.741] },
  GltfSlab:                 { colorize: [0.549, 0.549, 0.549] },
  GltfRoof:                 { colorize: [0.431, 0.431, 0.431] },
  GltfColumn:               { colorize: [0.620, 0.620, 0.620] },
  GltfBeam:                 { colorize: [0.498, 0.498, 0.498] },
  GltfMember:               { colorize: [0.498, 0.498, 0.498] },

  GltfDoor:                 { colorize: [0.835, 0.369, 0.000] },
  GltfWindow:               { colorize: [0.337, 0.706, 0.914], opacity: 0.4 },
  GltfOpeningElement:       { colorize: [0.902, 0.624, 0.000] },
  GltfStair:                { colorize: [0.800, 0.475, 0.655] },
  GltfStairFlight:          { colorize: [0.800, 0.475, 0.655] },
  GltfRamp:                 { colorize: [0.800, 0.475, 0.655] },
  GltfRailing:              { colorize: [0.000, 0.620, 0.451] },

  GltfCurtainWall:          { colorize: [0.000, 0.447, 0.698], opacity: 0.5 },
  GltfPlate:                { colorize: [0.000, 0.447, 0.698], opacity: 0.5 },

  GltfCovering:             { colorize: [0.941, 0.894, 0.259] },
  GltfFurnishingElement:    { colorize: [0.800, 0.475, 0.655] },

  GltfBuildingElementProxy: { colorize: [0.780, 0.780, 0.780] },
  GltfSpace:                { colorize: [0.780, 0.780, 0.780], opacity: 0.1 },

  DEFAULT:                  { colorize: [0.780, 0.780, 0.780] }
};

const arcNameColorMap = [
  {
    pattern: /baum|tree|plant|shrub|hedge|hecke|strauch|pflanz/i,
    colorize: [0.22, 0.42, 0.18]
  }
];

const hzgColorMap = {
  GltfPipeSegment:      { colorize: [0.000, 0.620, 0.451] },
  GltfPipeFitting:      { colorize: [0.000, 0.620, 0.451] },
  GltfDistributionPort: { colorize: [0.000, 0.620, 0.451] },

  GltfValve:            { colorize: [0.902, 0.624, 0.000] },
  GltfPump:             { colorize: [0.902, 0.624, 0.000] },
  GltfSpaceHeater:      { colorize: [0.902, 0.624, 0.000] },
  GltfTank:             { colorize: [0.902, 0.624, 0.000] },
  GltfUnitaryEquipment: { colorize: [0.902, 0.624, 0.000] },

  GltfSensor:           { colorize: [0.941, 0.894, 0.259] },

  DEFAULT:              { colorize: [0.000, 0.620, 0.451] }
};

function hasDefinedColor(mesh) {
  const c = mesh.color;
  return ((Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])) / 255 > 0.05);
}

function applyFallbackColors(dataModel, sceneModel, colorMap, nameColorMap = null) {
  for (const id of Object.keys(dataModel.objects)) {
    const dataObject = dataModel.objects[id];
    const sceneObject = sceneModel.objects[id];

    if (!sceneObject) {
      continue;
    }

    let props = null;

    if (nameColorMap) {
      const nameEntry = nameColorMap.find(e => e.pattern.test(dataObject.name));
      if (nameEntry) {
        props = nameEntry;
      }
    }

    if (!props) {
      if (sceneObject.meshes.length > 0 && hasDefinedColor(sceneObject.meshes[0])) {
        continue;
      }
      props = colorMap[dataObject.type] || colorMap.DEFAULT;
    }

    if (!props) {
      continue;
    }

    if (props.colorize) {
      for (const mesh of sceneObject.meshes) {
        mesh.color = [
          props.colorize[0] * 255,
          props.colorize[1] * 255,
          props.colorize[2] * 255
        ];
      }
    }

    if (props.opacity !== undefined) {
      for (const mesh of sceneObject.meshes) {
        mesh.opacity = props.opacity;
      }
    }
  }
}

async function main() {
  const studio = new xeokit.studio.Studio({});
  await studio.init();

  const { scene, data } = studio;

  // Optional: only keep these if you actually use them
  // const gltfLoader = new xeokit.formats.gltf.GLTFLoader();
  // const dataLoader = new xeokit.formats.datamodel.DataModelParamsLoader();

  studio.viewManager.createView({
    camera: {
      "eye": [-16.383975302039776,-20.90090956270501,34.64315481555981],
      "look": [11.596502984703388,-0.7479630905370414,10.83197660816235],
      "up": [0.4610748523588048,0.33208926104069153,0.8228770887707068]
    },
    autoLayers: false,
    layers: [
      {
        id: "arc",
        visible: true,
        autoDestroy: false
      }
    ],
  });

  studio.viewManager.createView({
    camera: {
      "eye": [-16.383975302039776,-20.90090956270501,34.64315481555981],
      "look": [11.596502984703388,-0.7479630905370414,10.83197660816235],
      "up": [0.4610748523588048,0.33208926104069153,0.8228770887707068]
    },
    autoLayers: false,
    layers: [
      {
        id: "lft",
        visible: true,
        autoDestroy: false
      }
    ],
  });

  const dataModelRes = data.createModel({ id: "demoModel" });
  if (!dataModelRes.ok) {
    throw new Error("Failed to create DataModel: " + dataModelRes.error);
  }
  const dataModel = dataModelRes.value;

  const sceneModelRes = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, -1
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  });

  if (!sceneModelRes.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }
  const sceneModel = sceneModelRes.value;

  await studio.loadModel({
    src: "../../models/FM_ARC/metamodel/model.json",
    type: "metamodel",
    dataModel
  });

  await studio.loadModel({
    src: "../../models/FM_ARC/xgf/model.xgf",
    type: "xgf",
    sceneModel
  }, {
    layerId: "arc"
  });

  // await studio.loadModel({
  //   src: "../../models/FM_HGZ/metamodel/model.json",
  //   type: "metamodel",
  //   dataModel
  // });
  //
  // await studio.loadModel({
  //   src: "../../models/FM_HGZ/gltf/model.glb",
  //   type: "gltf",
  //   sceneModel
  // });

  await studio.loadModel({
    src: "../../models/FM_LFT/metamodel/model.json",
    type: "metamodel",
    dataModel
  });

  await studio.loadModel({
    src: "../../models/FM_LFT/gltf/model.xgf",
    type: "xgf",
    sceneModel
  }, {
    layerId: "lft"
  });

  // await studio.loadModel({
  //   src: "../../models/FM_SAN/metamodel/model.json",
  //   type: "metamodel",
  //   dataModel
  // });
  //
  // await studio.loadModel({
  //   src: "../../models/FM_SAN/gltf/model.glb",
  //   type: "gltf",
  //   sceneModel
  // });

  // applyFallbackColors(dataModel, sceneModel, arcColorMap, arcNameColorMap);

  // const exploder = new xeokit.studio.SceneModelExploder({
  //   scene,
  //   sceneModel,
  //   collisionIndex: studio.collisionIndex
  // });
  // exploder.rebuild();

  studio.finished();
}

main().catch((err) => {
  console.error("Error initializing demo:", err);
});
