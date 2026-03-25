// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {scene, data, renderer} = demoHelper;


  // Create a styled container for the TreeView
  const treePanel = document.createElement("div");
  treePanel.id = "treeViewPanel";
  treePanel.innerHTML = `
    <div class="tree-panel-header">
      <div class="tree-panel-title">IfcOpenHouse4</div>
      <div class="tree-panel-subtitle">Browse IFC structure</div>
    </div>
    <div id="treeViewContainer" class="tree-panel-body"></div>
  `;
  document.body.appendChild(treePanel);

  const treeContainer = treePanel.querySelector("#treeViewContainer");

  const style = document.createElement("style");

  style.textContent = `
    :root {
      --tree-bg: rgba(255, 255, 255, 0.94);
      --tree-border: rgba(15, 23, 42, 0.08);
      --tree-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
      --tree-text: #1f2937;
      --tree-muted: #6b7280;
      --tree-hover: #f3f4f6;
      --tree-accent: #2563eb;
      --tree-accent-soft: #dbeafe;
      --tree-line: rgba(15, 23, 42, 0.06);
    }

    #treeViewPanel {
      position: absolute;
      left: 16px;
      top: 76px;
      width: 640px;
      max-height: calc(100vh - 32px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--tree-bg);
      border: 1px solid var(--tree-border);
      border-radius: 16px;
      box-shadow: var(--tree-shadow);
      backdrop-filter: blur(10px);
      color: var(--tree-text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      z-index: 100000;
    }

    .tree-panel-header {
      padding: 14px 16px 12px 16px;
      border-bottom: 1px solid var(--tree-line);
      background:
        linear-gradient(to bottom, rgba(255,255,255,0.75), rgba(255,255,255,0.55));
    }

    .tree-panel-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.01em;
      color: #111827;
      margin-bottom: 2px;
    }

    .tree-panel-subtitle {
      font-size: 12px;
      color: var(--tree-muted);
    }

    .tree-panel-body {
      overflow: auto;
      padding: 10px 10px 14px 10px;
    }

    .tree-panel-body::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    .tree-panel-body::-webkit-scrollbar-thumb {
      background: rgba(100, 116, 139, 0.28);
      border-radius: 999px;
      border: 2px solid transparent;
      background-clip: content-box;
    }

    .tree-panel-body ul {
      list-style: none;
      margin: 0;
      padding-left: 18px;
    }

    .tree-panel-body > ul {
      padding-left: 0;
    }

    .tree-panel-body li {
      position: relative;
      display: block;
      white-space: nowrap;
      line-height: 1.45;
      margin: 2px 0;
      padding: 3px 0;
      border-radius: 10px;
    }

    .tree-panel-body li::before {
      content: "";
      position: absolute;
      left: -10px;
      top: 0;
      bottom: 0;
      width: 1px;
      background: transparent;
    }

    .tree-panel-body a.plus,
    .tree-panel-body a.minus {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      margin-right: 6px;
      border-radius: 999px;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.25);
      vertical-align: middle;
      transition: all 120ms ease;
      box-sizing: border-box;
    }

    .tree-panel-body a.plus:hover,
    .tree-panel-body a.minus:hover {
      background: #eef2ff;
      border-color: rgba(37, 99, 235, 0.28);
      color: var(--tree-accent);
      transform: translateY(-1px);
    }

    .tree-panel-body input[type="checkbox"] {
      appearance: none;
      -webkit-appearance: none;
      width: 15px;
      height: 15px;
      margin: 0 8px 0 0;
      border-radius: 4px;
      border: 1px solid rgba(100, 116, 139, 0.4);
      background: white;
      vertical-align: -2px;
      position: relative;
      cursor: pointer;
      transition: all 120ms ease;
    }

    .tree-panel-body input[type="checkbox"]:checked {
      background: var(--tree-accent);
      border-color: var(--tree-accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }

    .tree-panel-body input[type="checkbox"]:checked::after {
      content: "";
      position: absolute;
      left: 4px;
      top: 1px;
      width: 4px;
      height: 8px;
      border: solid white;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    .tree-panel-body span {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 8px;
      cursor: pointer;
      color: var(--tree-text);
      font-size: 13px;
      font-weight: 500;
      transition: background 120ms ease, color 120ms ease;
    }

    .tree-panel-body span:hover {
      background: var(--tree-hover);
      color: #111827;
    }

    .tree-panel-body .highlighted-node > span {
      background: var(--tree-accent-soft);
      color: #1d4ed8;
      font-weight: 600;
    }

    .tree-panel-body .xrayed-node > span {
      opacity: 0.62;
      font-style: italic;
    }


      /* ----------------------------------------------------------------------------------------------------------*/
        /* ContextMenu */
        /* ----------------------------------------------------------------------------------------------------------*/

        .xeokit-context-menu {
            font-family: 'Roboto', sans-serif;
            font-size: 15px;
            display: none;
            z-index: 300000;
            background: rgba(255, 255, 255, 0.46);
            border: 1px solid black;
            border-radius: 6px;
            padding: 0;
            width: 200px;
        }

        .xeokit-context-menu ul {
            list-style: none;
            margin-left: 0;
            padding: 0;
        }

        .xeokit-context-menu-item {
            list-style-type: none;
            padding-left: 10px;
            padding-right: 20px;
            padding-top: 8px;
            padding-bottom: 8px;
            color: black;
            background: rgba(255, 255, 255, 0.46);
            cursor: pointer;
            width: calc(100% - 30px);
        }

        .xeokit-context-menu-item:hover {
            background: black;
            color: white;
            font-weight: normal;
        }

        .xeokit-context-menu-item span {
            display: inline-block;
        }

        .xeokit-context-menu .disabled {
            display: inline-block;
            color: gray;
            cursor: default;
            font-weight: normal;
        }

        .xeokit-context-menu .disabled:hover {
            color: gray;
            cursor: default;
            background: #eeeeee;
            font-weight: normal;
        }

        .xeokit-context-menu-item-separator {
            background: rgba(0, 0, 0, 1);
            height: 1px;
            width: 100%;
        }

  `;
  document.head.appendChild(style);

  // Create an IFCLoader to load IFC files
  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Arrange the View's Camera

  const view = demoHelper.createView({
    camera: {
      "eye": [-28.61121936096161,13.521426697632066,19.058116784372952],
      "look": [-0.0015259021896687486,0.0015259021896687486,-1.1749992675781256],
      "up": [0.4870560392709646,-0.23016497899858748,0.8424965857807737],
    }
  });

  // Create a SceneModel to hold our model's geometry and materials
  const sceneModelResult = scene.createModel({
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

  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  // Create a DataModel to hold semantic data for our model
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  // Load our IFC data into the SceneModel and DataModel
  fetch(`../../models/IfcOpenHouse4/ifc/model.ifc`)
    .then(response => response.arrayBuffer())
    .then(fileData => {

      ifcLoader.load({
        fileData,
        sceneModel,
        dataModel
      }).then(() => {


        // Create a TreeView to show the model hierarchy. We'll use the "IfcRelAggregates" relationship to
        // determine the hierarchy, and we'll set it to auto-expand to a depth of 4 levels.

        const treeView = new xeokit.ui.treeview.TreeView({
          containerElement: treeContainer,
          data,
          view,
          hierarchy: xeokit.ui.treeview.TreeView.AggregationHierarchy,
          linkType: "IfcRelAggregates",
          autoExpandDepth: 4,
          sortNodes: true,
          pruneEmptyNodes: true,
          rootName: "IfcOpenHouse4"
        });

        treeView.events.onNodeTitleClicked.subscribe((treeViewInstance, event) => {

          const objectId = event.treeViewNode.objectId;

          //   treeView.showNode(objectId);

          const resultObjectIds = [];

          const result = xeokit.data.searchObjects(data, {
            startObjectId: objectId,
            resultObjectIds
          });

          // Check if the query was valid.

          if (!result.ok) {
            console.error("Error querying IFC data: " + result.error);
            return;
          }

          // If the query succeeded, go ahead and mark whatever
          // objects we found as selected. In this case, it will set the window
          // frames as selected in the View.

          view.setObjectsSelected(view.selectedObjectIds, false);
          view.setObjectsSelected(resultObjectIds, true);

          console.log("Tree node clicked:", event.treeViewNode);
        });

        treeView.events.onContextMenu.subscribe((treeViewInstance, event) => {
          console.log("Tree node context menu:", event.treeViewNode);
        });


        demoHelper.finished();

      }).catch(e => {
        console.error(e);
      });
    })
    .catch(e => {
      console.error(e);
    });
});
