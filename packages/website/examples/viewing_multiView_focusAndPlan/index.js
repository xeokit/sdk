// Import the xeokit SDK bundle used by this example.
// It provides the helper, loader, and rendering APIs used in this sample.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({
  maxViews: 3
});

studio.init().then(() => {

  const { scene, data, renderer } = studio;

  const state = {
    selectedObjectIds: [],
    xrayContext: true
  };

  // ---------------------------------------------------------------------------
  // Create three auto-laid-out Views
  // ---------------------------------------------------------------------------

  const view1 = studio.viewManager.createView({
    id: "mainView",
    camera: {
      projection: "perspective",
      eye: [14, 18, 10],
      look: [4, 8, 0],
      up: [0, 0, 1]
    }
  });

  const view2 = studio.viewManager.createView({
    id: "planView",
    camera: {
      projectionType: xeokit.base.constants.OrthoProjectionType,
      eye: [4, 8, 35],
      look: [4, 8, 0],
      up: [1, 0, 0],
      orthoProjection: {
        scale: 80
      }
    }
  });

  const view3 = studio.viewManager.createView({
    id: "detailView",
    camera: {
      projection: "perspective",
      eye: [-8, 16, 6],
      look: [4, 8, 2],
      up: [0, 0, 1]
    }
  });

  // Optional labels for clarity
  addViewLabel(view1, "Main View · Perspective");
  addViewLabel(view2, "Plan View · Orthographic");
  addViewLabel(view3, "Detail View · Focus");

  // ---------------------------------------------------------------------------
  // SceneModel
  // ---------------------------------------------------------------------------

  const sceneModelRes = scene.createModel({
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
  });

  if (!sceneModelRes.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;

  // ---------------------------------------------------------------------------
  // DataModel
  // ---------------------------------------------------------------------------

  const dataModelRes = data.createModel({
    id: "demoModel"
  });

  if (!dataModelRes.ok) {
    throw new Error("Failed to create DataModel: " + dataModelRes.error);
  }

  const dataModel = dataModelRes.value;

  // ---------------------------------------------------------------------------
  // Load model once, show in all three views
  // ---------------------------------------------------------------------------

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  fetch("../../models/Duplex/ifc/model.ifc")
    .then(response => response.arrayBuffer())
    .then(fileData => {
      return ifcLoader.load({
        fileData,
        sceneModel,
        dataModel
      });
    })
    .then(() => {

      hookPicking(view1);
      hookPicking(view2);
      hookPicking(view3);

      applyViewStates();

      studio.openInfoPanelFromMeta();
      studio.finished();
    })
    .catch(err => {
      console.error(err);
    });

  // ---------------------------------------------------------------------------
  // Picking
  // ---------------------------------------------------------------------------

  function hookPicking(view) {
    view.htmlElement.style.cursor = "pointer";

    view.htmlElement.addEventListener("click", (e) => {
      const rect = view.htmlElement.getBoundingClientRect();

      const canvasPos = [
        e.clientX - rect.left,
        e.clientY - rect.top
      ];

      const pickResult = renderer.pick(view, { canvasPos });

      if (!pickResult || !pickResult.ok || !pickResult.value || !pickResult.value.viewObject) {
        state.selectedObjectIds = [];
        applyViewStates();
        return;
      }

      const objectId = pickResult.value.viewObject.id;
      state.selectedObjectIds = [objectId];
      applyViewStates();
    });
  }

  // ---------------------------------------------------------------------------
  // Per-view state application
  // ---------------------------------------------------------------------------

  function resetView(view) {
    if (view.selectedObjectIds?.length) {
      view.setObjectsSelected(view.selectedObjectIds, false);
    }
    if (view.highlightedObjectIds?.length) {
      view.setObjectsHighlighted(view.highlightedObjectIds, false);
    }
    if (view.xrayedObjectIds?.length) {
      view.setObjectsXRayed(view.xrayedObjectIds, false);
    }
    if (view.visibleObjectIds?.length) {
      view.setObjectsVisible(view.visibleObjectIds, true);
    }
  }

  function applyViewStates() {
    resetView(view1);
    resetView(view2);
    resetView(view3);

    const ids = state.selectedObjectIds;
    if (ids.length === 0) {
      return;
    }

    // View 1: normal selection/highlight
    view1.setObjectsSelected(ids, true);
    view1.setObjectsHighlighted(ids, true);

    // View 2: top-down minimap behavior
    view2.setObjectsHighlighted(ids, true);

    // View 3: focus behavior
    const otherIds = view3.objectIds.filter(id => !ids.includes(id));

    view3.setObjectsSelected(ids, true);
    view3.setObjectsHighlighted(ids, true);

    if (state.xrayContext) {
      view3.setObjectsXRayed(otherIds, true);
    } else {
      view3.setObjectsVisible(otherIds, false);
    }
  }

  // ---------------------------------------------------------------------------
  // Small helper to show titles over each auto-created view
  // ---------------------------------------------------------------------------

  function addViewLabel(view, text) {
    const wrapper = view.htmlElement.parentElement || view.htmlElement;

    wrapper.style.position = "relative";

    const label = document.createElement("div");
    label.textContent = text;
    label.style.position = "absolute";
    label.style.left = "12px";
    label.style.top = "12px";
    label.style.zIndex = "10";
    label.style.padding = "6px 8px";
    label.style.borderRadius = "6px";
    label.style.background = "rgba(0, 0, 0, 0.65)";
    label.style.color = "white";
    label.style.fontFamily = "system-ui, sans-serif";
    label.style.fontSize = "12px";
    label.style.pointerEvents = "none";

    wrapper.appendChild(label);
  }
});
