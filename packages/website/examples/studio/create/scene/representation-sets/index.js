import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";

const repSetsElement = document.getElementById("repSets");
const statusElement = document.getElementById("status");
const errorElement = document.getElementById("error");

main().catch((error) => {
  errorElement.style.display = "block";
  errorElement.textContent = error instanceof Error ? error.message : String(error);
  statusElement.textContent = "Example failed to initialize.";
});

async function main() {
  // This example uses Studio only to get the usual viewer shell and controls.
  // The representation-set data still comes from a plain SceneModel JSON file.
  const studio = new xeokit.studio.Studio({
    renderer: "webgl"
  });
  await studio.init();

  const {scene} = studio;
  const view = studio.viewManager.createView({
    id: "repSetDemoView",
    backgroundColor: [0.93, 0.96, 0.97],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [38, -44, 24],
      look: [0, 0, 5],
      up: [0, 0, 1]
    }
  });

  const sceneModelResult = scene.createModel({id: "harborTransitModel"});
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }
  const sceneModel = sceneModelResult.value;

  const response = await fetch("./sceneModel.json");
  if (!response.ok) {
    throw new Error(`Unable to load sceneModel.json: ${response.status} ${response.statusText}`);
  }

  const fileData = await response.json();

  // SceneModelImporter creates SceneObjects, then creates SceneRepSets that
  // reference those objects. A representation set never owns the objects.
  await new xeokit.formats.scenemodel.SceneModelImporter().load({
    fileData,
    sceneModel
  });

  buildRepSetControls(sceneModel, view);
  view.camera.orbitYaw(8);
  statusElement.textContent = summarizeRepSets(sceneModel);

  studio.finished();
}

function buildRepSetControls(sceneModel, view) {
  // Representation sets describe alternatives for the same logical content.
  // They do not say which rep is active in a View, so this example keeps a small
  // per-view selection map beside the controls.
  const repSets = Object.values(sceneModel.repSets);
  if (repSets.length === 0) {
    statusElement.textContent = "No representation sets found in sceneModel.json.";
    return;
  }

  const activeRepIds = new Map();
  for (const repSet of repSets) {
    // defaultRepId is the fallback representation to show when no other
    // selection policy applies. It is not required to be named "detailed".
    activeRepIds.set(repSet.id, repSet.defaultRepId);

    const section = document.createElement("section");
    section.className = "repSet";

    const title = document.createElement("div");
    title.className = "repSetTitle";
    title.innerHTML = `<span>${formatId(repSet.id)}</span><span>default: ${repSet.defaultRepId}</span>`;
    section.appendChild(title);

    const buttons = document.createElement("div");
    buttons.className = "repButtons";
    for (const rep of Object.values(repSet.reps)) {
      // A representation may contain one object, many objects, or an overlap
      // with another representation. The UI treats all reps as peers.
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = formatId(rep.id);
      button.setAttribute("aria-pressed", rep.id === repSet.defaultRepId ? "true" : "false");
      button.addEventListener("click", () => {
        activeRepIds.set(repSet.id, rep.id);
        for (const sibling of buttons.querySelectorAll("button")) {
          sibling.setAttribute("aria-pressed", sibling === button ? "true" : "false");
        }
        // This manual example changes ViewObject.visible directly so the
        // relationship between reps and SceneObjects is easy to see. The LOD
        // examples use RepresentationLODSelector instead.
        applyRepSelection(sceneModel, view, activeRepIds);
        statusElement.textContent = summarizeRepSets(sceneModel, activeRepIds);
      });
      buttons.appendChild(button);
    }
    section.appendChild(buttons);
    repSetsElement.appendChild(section);
  }

  applyRepSelection(sceneModel, view, activeRepIds);
}

function applyRepSelection(sceneModel, view, activeRepIds) {
  for (const repSet of Object.values(sceneModel.repSets)) {
    // First collect every object mentioned by any rep in the set. Only those
    // objects are controlled by this representation-set selection.
    const objectIdsInSet = new Set();
    for (const rep of Object.values(repSet.reps)) {
      for (const objectId of rep.objectIds) {
        objectIdsInSet.add(objectId);
      }
    }

    const activeRep = repSet.reps[activeRepIds.get(repSet.id)];
    const activeObjectIds = new Set(activeRep ? activeRep.objectIds : []);
    for (const objectId of objectIdsInSet) {
      const viewObject = view.objects[objectId];
      if (viewObject) {
        // This is demo-only visibility switching. Production LOD selection uses
        // suppression so application visibility remains independent.
        viewObject.visible = activeObjectIds.has(objectId);
      }
    }
  }
}

function summarizeRepSets(sceneModel, activeRepIds = null) {
  // Summaries are generated from the loaded SceneModel, not from hard-coded
  // knowledge of what sceneModel.json contains.
  return Object.values(sceneModel.repSets)
    .map((repSet) => {
      const repId = activeRepIds?.get(repSet.id) || repSet.defaultRepId;
      const rep = repSet.reps[repId];
      const count = rep ? rep.objectIds.length : 0;
      return `${repSet.id}: ${repId} (${count} object${count === 1 ? "" : "s"})`;
    })
    .join("\n");
}

function formatId(id) {
  return id.replace(/[-_]/g, " ");
}
