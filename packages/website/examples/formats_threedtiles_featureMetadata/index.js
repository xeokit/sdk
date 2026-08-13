import * as xeokit from "../../js/xeokit-studio-bundle.js";

const TILESET_PATH = "../../models/ThreeDTilesExamples/FeatureIdAttributeAndPropertyTable/tileset.json";
const BASE_PATH = "../../models/ThreeDTilesExamples/FeatureIdAttributeAndPropertyTable/";

const studio = new xeokit.studio.Studio({});

const FEATURE_LABELS = ["Envelope", "Structure", "Services", "Circulation"];
const CHANNELS = ["condition", "capacity", "priority"];

function propsByName(propertySet) {
  return Object.fromEntries((propertySet?.properties || []).map((property) => [property.name, property.value]));
}

function featureIndexFromId(id) {
  const match = /-f(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function cssColor(rgb) {
  return `rgb(${rgb.map((value) => Math.round(value * 255)).join(", ")})`;
}

function vectorText(vector) {
  return `[${vector.map((value) => Number(value).toFixed(2)).join(", ")}]`;
}

function barMarkup(vector, color) {
  return `<div class="bars">${vector.map((value, index) => `
    <div class="bar">
      <span>${CHANNELS[index] || `v${index}`}</span>
      <span class="barTrack"><span class="barFill" style="width:${Math.round(value * 100)}%;background:${color}"></span></span>
      <span class="barValue">${Math.round(value * 100)}%</span>
    </div>
  `).join("")}</div>`;
}

studio.init().then(async () => {
  const {scene, data} = studio;
  const view = studio.viewManager.createView({
    camera: {eye: [5.8, -6.8, 4.1], look: [0, -0.15, 1.35], up: [0, 0, 1]},
  });

  const status = document.getElementById("status");
  const featureCount = document.getElementById("featureCount");
  const objectCount = document.getElementById("objectCount");
  const tableCount = document.getElementById("tableCount");
  const featureList = document.getElementById("featureList");
  const details = document.getElementById("details");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading feature metadata tileset...");

    const tilesetUrl = new URL(TILESET_PATH, window.location.href);
    const tileset = await (await fetch(tilesetUrl)).json();
    const sceneModel = scene.createModel({id: "featureMetadata3DTiles"}).value;
    const dataModel = data.createModel({id: "featureMetadata3DTiles"}).value;
    const baseUri = new URL(BASE_PATH, window.location.href).toString();

    await new xeokit.formats.threedtiles.ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel, dataModel},
      {baseUri},
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) studio.viewManager.fitToAabb(view, aabb);

    const featureObjects = Object.values(dataModel.objects)
      .filter((object) => object.type === "exampleMetadataClass")
      .sort((a, b) => featureIndexFromId(a.id) - featureIndexFromId(b.id));

    const records = featureObjects.map((object) => {
      const index = featureIndexFromId(object.id);
      const props = propsByName(dataModel.propertySets[`${object.id}-props`]);
      const vector = props.example_VEC3_FLOAT32 || [0.7, 0.7, 0.7];
      const color = cssColor(vector);
      const viewObject = view.objects[object.id];
      return {
        id: object.id,
        index,
        label: FEATURE_LABELS[index] || `Feature ${index}`,
        vector,
        color,
        viewObject,
        linked: Boolean(sceneModel.objects[object.id] && viewObject),
      };
    });

    for (const record of records) {
      if (record.viewObject) {
        record.viewObject.colorize = record.vector;
      }
    }

    if (featureCount) featureCount.textContent = String(records.length);
    if (objectCount) objectCount.textContent = String(records.filter((record) => record.linked).length);
    if (tableCount) tableCount.textContent = String(Object.keys(dataModel.propertySets).length);

    const recordById = new Map(records.map((record) => [record.id, record]));
    const buttonsById = new Map();
    let selectedId = null;

    function selectFeature(id) {
      const record = recordById.get(id);
      if (!record) return;
      if (selectedId && selectedId !== id) {
        const previous = recordById.get(selectedId);
        if (previous?.viewObject) previous.viewObject.highlighted = false;
        buttonsById.get(selectedId)?.classList.remove("selected");
      }
      selectedId = id;
      if (record.viewObject) record.viewObject.highlighted = true;
      buttonsById.get(id)?.classList.add("selected");
      details.innerHTML = [
        `<div class="detailHeader"><span class="swatch" style="background:${record.color}"></span><span class="detailTitle">${record.label}</span></div>`,
        barMarkup(record.vector, record.color),
        `<div>object: <code>${record.id}</code></div>`,
        `<div>property row: <code>${record.index}</code></div>`,
        `<div>example_VEC3_FLOAT32: <code>${vectorText(record.vector)}</code></div>`,
      ].join("");
    }

    if (featureList) {
      featureList.replaceChildren(...records.map((record) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "featureButton";
        button.innerHTML = [
          `<span class="swatch" style="background:${record.color}"></span>`,
          `<span><span class="featureName">${record.label}</span><br><span class="featureVector">${vectorText(record.vector)}</span></span>`,
          `<span class="linkBadge">${record.linked ? "linked" : "missing"}</span>`,
        ].join("");
        button.addEventListener("click", () => selectFeature(record.id));
        buttonsById.set(record.id, button);
        return button;
      }));
    }

    view.htmlElement.addEventListener("click", (event) => {
      const rect = view.htmlElement.getBoundingClientRect();
      const pick = studio.picking.picker.pick({
        view,
        canvasPos: [event.clientX - rect.left, event.clientY - rect.top],
      });
      if (pick?.hit && recordById.has(pick.objectId)) {
        selectFeature(pick.objectId);
      }
    });

    if (records[0]) selectFeature(records[0].id);

    setStatus("Feature metadata rows linked to visible feature blocks.");
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load feature metadata: ${err.message || err}`);
    console.error(err);
  }
});
