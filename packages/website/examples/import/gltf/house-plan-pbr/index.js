
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const HOUSE_PLAN_URL = "../../../../models/HousePlan/gltf/model.glb";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;


  const sceneModel = mustCreate(scene.createModel({
    id: "housePlan",
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
  }));

  const view = studio.viewManager.createView({
    adaptiveQuality: false,
    camera: {
      "eye": [1396.192488512606,-228.91295922593062,7.605782942380627],
      "look": [1389.9821022363608,-234.97883380249922,1.9956860109231078],
      "up": [-0.3882818817391334,-0.3792467944611508,0.8398863311210985]
    },
    effects: {
      tonemap: {
        sRGBEncode: true
      }
    }
  });

  const status = document.getElementById("status");

  const gltfLoader = new xeokit.formats.gltf.GLTFLoader();

  fetch(HOUSE_PLAN_URL)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${HOUSE_PLAN_URL}`);
      return response.arrayBuffer();
    })
    .then(fileData => gltfLoader.load({ fileData, sceneModel }))
    .then(() => {

      studio.openInfoPanelFromMeta();
      studio.finished();
      document.querySelectorAll(".xeokit-loading-overlay").forEach(el => {
        el.style.display = "none";
      });
    })
    .catch(err => {
      status.textContent = `Failed to load HousePlan: ${err.message || err}`;
      console.error(err);
    });
});

function mustCreate(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
