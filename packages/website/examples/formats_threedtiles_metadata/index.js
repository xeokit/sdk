import * as xeokit from "../../js/xeokit-studio-bundle.js";

const TILESET_PATH = "../../models/ProceduralCity3DTiles/threedtiles/tileset.json";
const BASE_PATH = "../../models/ProceduralCity3DTiles/threedtiles/";

const studio = new xeokit.studio.Studio({});

function propsByName(propertySet) {
  return Object.fromEntries((propertySet?.properties || []).map((property) => [property.name, property.value]));
}

function childRecords(tileset) {
  return (tileset.root.children || []).map((tile, index) => {
    const content = tile.content || {};
    return {
      index: index + 1,
      dataObjectId: `tile-${index + 1}`,
      tile: tile.metadata?.properties || {},
      content: content.metadata?.properties || {},
      group: content.group,
      uri: content.uri,
    };
  });
}

function groupColor(group) {
  const [r, g, b] = group.properties.color || [160, 160, 160];
  return `rgb(${r}, ${g}, ${b})`;
}

function groupColorVec(group) {
  const [r, g, b] = group.properties.color || [160, 160, 160];
  return [r / 255, g / 255, b / 255];
}

function metric(label, value) {
  return `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`;
}

function formatRecord(record, dataModel) {
  const tileProps = propsByName(dataModel.propertySets[`${record.dataObjectId}-metadata`]);
  const contentProps = propsByName(dataModel.propertySets[`${record.dataObjectId}-content-metadata`]);
  const groupProps = propsByName(dataModel.propertySets[`group-${record.group}-metadata`]);
  return JSON.stringify({
    dataObject: record.dataObjectId,
    tile: tileProps,
    content: contentProps,
    group: groupProps,
  }, null, 2);
}

studio.init().then(async () => {
  const {scene, data} = studio;
  const view = studio.viewManager.createView({
    camera: {eye: [760, -980, 620], look: [80, 120, 58], up: [0, 0, 1]},
  });

  const status = document.getElementById("status");
  const summary = document.getElementById("summary");
  const groups = document.getElementById("groups");
  const tiles = document.getElementById("tiles");
  const details = document.getElementById("details");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading metadata tileset...");

    const tilesetUrl = new URL(TILESET_PATH, window.location.href);
    const tileset = await (await fetch(tilesetUrl)).json();
    const sceneModel = scene.createModel({id: "metadata3DTiles"}).value;
    const dataModel = data.createModel({id: "metadata3DTiles"}).value;
    const baseUri = new URL(BASE_PATH, window.location.href).toString();
    const objectIdsByUri = new Map();
    let loadingUri = "";
    const originalCreateObject = sceneModel.createObject.bind(sceneModel);
    sceneModel.createObject = (params) => {
      const result = originalCreateObject(params);
      if (result.ok && loadingUri) {
        const ids = objectIdsByUri.get(loadingUri) || [];
        ids.push(params.id);
        objectIdsByUri.set(loadingUri, ids);
      }
      return result;
    };
    const fetchArrayBuffer = async (url) => {
      const resolved = new URL(url, window.location.href);
      const base = new URL(baseUri);
      loadingUri = decodeURIComponent(resolved.pathname.slice(base.pathname.length));
      const response = await fetch(resolved);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${resolved}`);
      }
      return response.arrayBuffer();
    };

    try {
      await new xeokit.formats.threedtiles.ThreeDTilesLoader().load(
        {fileData: tileset, sceneModel, dataModel},
        {baseUri, fetchArrayBuffer},
      );
    } finally {
      loadingUri = "";
      sceneModel.createObject = originalCreateObject;
    }

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) studio.viewManager.fitToAabb(view, aabb);

    const tilesetProps = propsByName(dataModel.propertySets["tileset-metadata"]);
    const records = childRecords(tileset).map((record) => ({
      ...record,
      objectIds: objectIdsByUri.get(record.uri) || [],
      colorize: groupColorVec(tileset.groups[record.group] || {}),
    }));
    const recordByObjectId = new Map();
    for (const record of records) {
      for (const objectId of record.objectIds) {
        recordByObjectId.set(objectId, record);
      }
    }

    const districtCounts = new Map();
    for (const record of records) {
      const district = record.tile.district || "Unassigned";
      districtCounts.set(district, (districtCounts.get(district) || 0) + 1);
    }

    summary.innerHTML = [
      metric("Buildings", tilesetProps.buildingCount || "-"),
      metric("City tiles", tilesetProps.tileCount || records.length),
      metric("Property sets", Object.keys(dataModel.propertySets).length),
    ].join("");

    groups.innerHTML = tileset.groups.map((group, index) => `
      <div class="group">
        <span class="swatch" style="background:${groupColor(group)}"></span>
        <div>${group.properties.name}<br>${districtCounts.get(group.properties.name) || 0} tiles, ${group.properties.landUse}</div>
      </div>
    `).join("");

    let selectedRecord = null;
    function selectRecord(index, options = {}) {
      const record = records[index];
      if (!record) {
        return;
      }
      if (selectedRecord?.objectIds?.length) {
        view.setObjectsHighlighted(selectedRecord.objectIds, false);
        view.setObjectsColorized(selectedRecord.objectIds, null);
      }
      selectedRecord = record;
      if (record.objectIds.length) {
        view.setObjectsColorized(record.objectIds, record.colorize);
        view.setObjectsHighlighted(record.objectIds, true);
      }
      [...tiles.querySelectorAll(".tileButton")].forEach((button) => {
        button.classList.toggle("selected", Number(button.dataset.index) === index + 1);
      });
      details.textContent = formatRecord(record, dataModel);
      if (options.scroll) {
        tiles.querySelector(`[data-index="${record.index}"]`)?.scrollIntoView({block: "nearest"});
      }
    }

    tiles.innerHTML = records.map((record) => `
      <button class="tileButton" type="button" data-index="${record.index}">
        <span>
          <b>${record.tile.district}</b>
          <span>${record.tile.tileId}: ${record.tile.objectCount} objects, ${record.tile.density} density</span>
        </span>
        <em>${Math.round((record.tile.triangleCount || 0) / 100) / 10}k tris</em>
      </button>
    `).join("");
    tiles.addEventListener("click", (event) => {
      const button = event.target.closest(".tileButton");
      if (button) selectRecord(Number(button.dataset.index) - 1);
    });
    view.htmlElement.addEventListener("click", (event) => {
      const rect = view.htmlElement.getBoundingClientRect();
      const pick = studio.picking.picker.pick({
        view,
        canvasPos: [event.clientX - rect.left, event.clientY - rect.top],
      });
      const record = pick?.hit ? recordByObjectId.get(pick.objectId) : null;
      if (record) {
        selectRecord(record.index - 1, {scroll: true});
      }
    });
    selectRecord(0);
    window.xeokitExample = {studio, view, sceneModel, dataModel, records, selectRecord};

    setStatus("Procedural city tile, district and content metadata loaded into DataModel.");
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load 3D Tiles metadata: ${err.message || err}`);
    console.error(err);
  }
});
