// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data, renderer} = demoHelper;

  const aabb3Index = new xeokit.collision.aabb.SceneAABB3Index(scene);
  const cameraFlight = new xeokit.cameraflight.CameraFlightAnimation(view, {
    duration: 1.0
  });

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
  view.camera.eye = [-10, 10, 10];
  view.camera.look = [0, 0, 0];
  view.camera.up = [0, 0, 1];

  view.camera.perspectiveProjection.far = 1000000;

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

        demoHelper.viewFit();

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

        // Create a ContextMenu that will show when the user right-clicks on the View's canvas, but not on any object
        // in the View. This ContextMenu will have options to hide and show all objects in the View, as well as an
        // option to view fit the whole model.

        const canvasContextMenu = new xeokit.ui.contextmenu.ContextMenu({
          enabled: true,
          context: {
            view
          },
          items: [
            [
              {
                title: "Hide All",
                getEnabled: function (context) {
                  return (context.view.numVisibleObjects > 0);
                },
                doAction: function (context) {
                  context.view.setObjectsVisible(context.view.visibleObjectIds, false);
                }
              },
              {
                title: "Show All",
                getEnabled: function (context) {
                  return (context.view.numVisibleObjects < context.view.numObjects);
                },
                doAction: function (context) {
                  const view = context.view;
                  view.setObjectsVisible(view.objectIds, true);
                  view.setObjectsXRayed(view.xrayedObjectIds, false);
                  view.setObjectsSelected(view.selectedObjectIds, false);
                }
              }
            ],
            [
              {
                title: "View Fit All",
                doAction: function (context) {
                  cameraFlight.flyTo({
                    aabb: aabb3Index.getSceneAABB(),
                    duration: 0.5
                  });
                }
              }
            ]
          ]
        });

        // Create a ContextMenu that will show when the user right-clicks on an object in a View. This ContextMenu
        // will have options to view fit, hide, x-ray, and select the clicked object, as well as options to perform
        // those actions on all other objects in the same subtree of the model hierarchy.

        const objectContextMenu2 = new xeokit.ui.contextmenu.ContextMenu({

          context: {
            pickResult: null
          },

          items: [
            [
              {
                title: "View Fit",
                doAction: function (context) {
                  const sceneObject = context.pickResult.sceneObject;
                    cameraFlight.flyTo({
                      aabb: aabb3Index.getObjectAABB(sceneObject.id),
                      duration: 0.5
                    });
                }
              },
              {
                title: "View Fit All",
                doAction: function (context) {
                  cameraFlight.flyTo({
                    aabb: aabb3Index.getSceneAABB(),
                    duration: 0.5
                  });
                }
              },
              {
                title: "Show in Tree",
                doAction: function (context) {
                  // const objectId = context.entity.id;
                  // context.treeViewPlugin.showNode(objectId);
                }
              }
            ],
            [
              {
                title: "Hide",
                getEnabled: function (context) {
                  return context.pickResult.viewObject.visible;
                },
                doAction: function (context) {
                  context.pickResult.viewObject.visible = false;
                }
              },
              {
                title: "Hide Others",
                doAction: function (context) {
                  // const viewer = context.viewer;
                  // const scene = viewer.scene;
                  // const entity = context.entity;
                  // const metaObject = viewer.metaScene.metaObjects[entity.id];
                  // if (!metaObject) {
                  //   return;
                  // }
                  // scene.setObjectsVisible(scene.visibleObjectIds, false);
                  // scene.setObjectsXRayed(scene.xrayedObjectIds, false);
                  // scene.setObjectsSelected(scene.selectedObjectIds, false);
                  // scene.setObjectsHighlighted(scene.highlightedObjectIds, false);
                  // metaObject.withMetaObjectsInSubtree((metaObject) => {
                  //   const entity = scene.objects[metaObject.id];
                  //   if (entity) {
                  //     entity.visible = true;
                  //   }
                  // });
                }
              },
              {
                title: "Hide All",
                getEnabled: function (context) {
                  return (context.pickResult.viewObject.view.numVisibleObjects > 0);
                },
                doAction: function (context) {
                  context.pickResult.viewObject.view.setObjectsVisible(
                    context.pickResult.viewObject.view.visibleObjectIds, false);
                }
              },
              {
                title: "Show All",
                getEnabled: function (context) {
                  const view = context.pickResult.viewObject.view;
                  return (view.numVisibleObjects < view.numObjects);
                },
                doAction: function (context) {
                  const view = context.pickResult.viewObject.view;
                  view.setObjectsVisible(view.objectIds, true);
                }
              }
            ],
            [
              {
                title: "X-Ray",
                getEnabled: function (context) {
                  return (!context.pickResult.viewObject.xrayed);
                },
                doAction: function (context) {
                  context.pickResult.viewObject.xrayed = true;
                }
              },
              {
                title: "Undo X-Ray",
                getEnabled: function (context) {
                  return context.pickResult.viewObject.xrayed;
                },
                doAction: function (context) {
                  context.pickResult.viewObject.xrayed = false;
                }
              },
              {
                title: "X-Ray Others",
                doAction: function (context) {
                  // const viewer = context.viewer;
                  // const scene = viewer.scene;
                  // const entity = context.entity;
                  // const metaObject = viewer.metaScene.metaObjects[entity.id];
                  // if (!metaObject) {
                  //   return;
                  // }
                  // scene.setObjectsVisible(scene.objectIds, true);
                  // scene.setObjectsXRayed(scene.objectIds, true);
                  // scene.setObjectsSelected(scene.selectedObjectIds, false);
                  // scene.setObjectsHighlighted(scene.highlightedObjectIds, false);
                  // metaObject.withMetaObjectsInSubtree((metaObject) => {
                  //   const entity = scene.objects[metaObject.id];
                  //   if (entity) {
                  //     entity.xrayed = false;
                  //   }
                  // });
                }
              },
              {
                title: "Reset X-Ray",
                getEnabled: function (context) {
                  return (context.pickResult.viewObject.view.numXRayedObjects > 0);
                },
                doAction: function (context) {
                  context.pickResult.viewObject.view.setObjectsXRayed(context.pickResult.viewObject.view.xrayedObjectIds, false);
                }
              }
            ],
            [
              {
                title: "Select",
                getEnabled: function (context) {
                  return (!context.pickResult.viewObject.selected);
                },
                doAction: function (context) {
                  context.pickResult.viewObject.selected = true;
                }
              },
              {
                title: "Undo Select",
                getEnabled: function (context) {
                  return context.pickResult.viewObject.selected;
                },
                doAction: function (context) {
                  context.pickResult.viewObject.selected = false;
                }
              },
              {
                title: "Clear Selection",
                getEnabled: function (context) {
                  return (context.pickResult.viewObject.view.numSelectedObjects > 0);
                },
                doAction: function (context) {
                  context.pickResult.viewObject.view.setObjectsSelected(context.pickResult.viewObject.view.selectedObjectIds, false);
                }
              }
            ]

          ],
          enabled: true
        });


        const objectContextMenu = new xeokit.ui.contextmenu.ContextMenu({

          items: [

            [ // Group

              // Per-object emphasis effects

              { // Item

                getTitle: (context) => {
                  return "Effects..";
                },

                doAction: function (context) {
                  // Does nothing
                },

                items: [ // Sub-menu

                  [ // Group

                    // Show/hide object

                    {
                      getTitle: (context) => {
                        return context.pickResult.viewObject.visible ? "Hide Object" : "Show Object";
                      },

                      doAction: function (context) {
                        context.pickResult.viewObject.visible = !context.pickResult.viewObject.visible;
                      }
                    },

                    //Select/deselect object

                    {
                      getTitle: (context) => {
                        return context.pickResult.viewObject.selected ? "Undo Select Object" : "Select Object";
                      },

                      doAction: function (context) {
                        context.pickResult.viewObject.selected = !context.pickResult.viewObject.selected;
                      }
                    },

                    // Highlight/unhighlight object

                    {
                      getTitle: (context) => {
                        return context.pickResult.viewObject.highlighted ? "Undo Highlight Object" : "Highlight Object";
                      },

                      doAction: function (context) {
                        context.pickResult.viewObject.highlighted = !context.pickResult.viewObject.highlighted;
                      }
                    },

                    // X-ray / un-X-ray object

                    {
                      getTitle: (context) => {
                        return context.pickResult.viewObject.xrayed ? "Undo X-Ray Object" : "X-Ray Object";
                      },

                      doAction: function (context) {
                        context.pickResult.viewObject.xrayed = !context.pickResult.viewObject.xrayed;
                      }
                    }
                  ]
                ]
              },

              { // Item

                getTitle: (context) => {
                  return "Edit";
                },

                doAction: function (context) {
                  // Does nothing
                },

                items: [ // Sub-menu

                  [ // Group

                    // Show/hide object

                    {
                      getTitle: (context) => {
                        return "Destroy Object";
                      },

                      doAction: function (context) {
                        context.pickResult.viewObject.sceneObject.destroy();
                      }
                    }
                  ]
                ]
              },

              // Camera navigation

              {
                getTitle: (context) => {
                  return "Camera";
                },

                doAction: function (context) {

                },

                items: [ // Submenu
                  [ // Group
                    {
                      title: "View Fit",
                      doAction: function (context) {
                        const sceneObject = context.pickResult.sceneObject;
                        cameraFlight.flyTo({
                          aabb: aabb3Index.getObjectAABB(sceneObject.id),
                          duration: 0.5
                        });
                      }
                    },
                    {
                      title: "View Fit All",
                      doAction: function (context) {
                        cameraFlight.flyTo({
                          aabb: aabb3Index.getSceneAABB(),
                          duration: 0.5
                        });
                      }
                    }
                  ]
                ]
              }
            ]
          ],

          enabled: true
        });


        // Attach a mouse click listener to the View's canvas, and show our ContextMenu
        // when the user right-clicks on an object in the View.

        view.htmlElement.addEventListener("contextmenu", (e) => {

          const result = renderer.pick(view, {
            canvasPos: [e.offsetX, e.offsetY]
          });

          if (result) {
            if (result.ok) {

              const pickResult = result.value;

              if (pickResult && pickResult.viewObject) {

                objectContextMenu.context = {
                  pickResult
                };

                const dataObject = data.objects[pickResult.viewObject.id];
                if (dataObject) {
                  objectContextMenu.setTitle(dataObject.name || dataObject.id);
                }

                objectContextMenu.show(e.clientX, e.clientY);

              } else {

                canvasContextMenu.context = {
                  view
                };

                canvasContextMenu.show(e.clientX, e.clientY);
              }
            } else {
              console.error("Picking failed: " + result.error);
            }
          } else {

            // TODO: Open empty canmvas menu

            console.log("Nothing picked");
          }
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
