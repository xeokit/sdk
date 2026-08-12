import * as xeokit from "../../js/xeokit-studio-bundle.js";

const TILESET_PATH = "../../models/ThreeDTilesExamples/MetadataGranularities/tileset.json";
const BASE_PATH = "../../models/ThreeDTilesExamples/MetadataGranularities/";

const studio = new xeokit.studio.Studio({});

function propsByName(propertySet) {
  return Object.fromEntries((propertySet?.properties || []).map((property) => [property.name, property.value]));
}

function childRecords(tileset) {
  return (tileset.root.children || []).map((tile, index) => {
    const content = tile.content || {};
    return {
      index,
      dataObjectId: `tile-${index + 1}`,
      tile: tile.metadata?.properties || {},
      content: content.metadata?.properties || {},
      group: content.group,
    };
  });
}

function groupColor(group) {
  const [r, g, b] = group.properties.color;
  return `rgb(${r}, ${g}, ${b})`;
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
    camera: {eye: [33, -42, 28], look: [0, 0, 2.5], up: [0, 0, 1]},
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

    await new xeokit.formats.threedtiles.ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel, dataModel},
      {baseUri},
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) studio.viewManager.fitToAabb(view, aabb);

    const tilesetProps = propsByName(dataModel.propertySets["tileset-metadata"]);
    const records = childRecords(tileset);

    summary.innerHTML = [
      metric("Author", tilesetProps.author || "-"),
      metric("Tile count", tilesetProps.tileCount || records.length),
      metric("Property sets", Object.keys(dataModel.propertySets).length),
    ].join("");

    groups.innerHTML = tileset.groups.map((group, index) => `
      <div class="group">
        <span class="swatch" style="background:${groupColor(group)}"></span>
        <div>Group ${index}<br>priority ${group.properties.priority}</div>
      </div>
    `).join("");

    function selectRecord(index) {
      [...tiles.querySelectorAll(".tileButton")].forEach((button) => {
        button.classList.toggle("selected", Number(button.dataset.index) === index);
      });
      details.textContent = formatRecord(records[index], dataModel);
    }

    tiles.innerHTML = records.map((record) => `
      <button class="tileButton" type="button" data-index="${record.index}">
        <span>
          <b>${record.tile.district}</b>
          <span>${record.content.instances} instanced residences, ${record.content.vertices} vertices</span>
        </span>
        <em>${record.tile.population} residents</em>
      </button>
    `).join("");
    tiles.addEventListener("click", (event) => {
      const button = event.target.closest(".tileButton");
      if (button) selectRecord(Number(button.dataset.index));
    });
    selectRecord(0);

    setStatus("3D Tiles metadata loaded into DataModel.");
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load 3D Tiles metadata: ${err.message || err}`);
    console.error(err);
  }
});
