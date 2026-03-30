import {ContextMenu} from "../ui/contextmenu";
import {ViewObject} from "../viewer";
import {SceneAABB3Index} from "../collision/aabb";
import {XGFExporter} from "../formats/xgf";
import {type CoordinateSystemParams, SceneModel, type SceneModelParams, SceneObject} from "../scene";
import {DataModel, type DataModelContentParams, DataObject} from "../data";
import {OBJExporter} from "../formats/obj";
import {MTLExporter} from "../formats/mtl";
import {DotBIMExporter} from "../formats/dotbim";
import {saveBCFViewpoint} from "../bcf";
import {CameraFlightAnimation} from "../cameraflight";
import {DemoHelper} from "./DemoHelper";
import {WebGLRenderer} from "../webglrenderer";
import {OrthoProjectionType, PerspectiveProjectionType} from "../constants";
import {type AABB3} from "../math/boundaries";

/**
 * Shared context shape for menus that operate on a view.
 */
interface BaseViewContext {
  /**
   * Demo helper used for view and inspector actions.
   */
  demoHelper: DemoHelper;

  /**
   * WebGL renderer used for capturing screenshots and other renderer-related actions.
   */
  renderer: WebGLRenderer;

  /**
   * Camera flight controller used for framing actions.
   */
  cameraFlight: CameraFlightAnimation;

  /**
   * Active view for the context menu.
   */
  view: ViewObject["view"];

  /**
   * Scene model associated with the current view.
   */
  sceneModel: SceneModel;

  /**
   * Optional data model associated with the current scene model.
   */
  dataModel?: DataModel;

  /**
   * Spatial index used to resolve object and scene bounds.
   */
  aabb3index: SceneAABB3Index;
}

/**
 * Context object consumed by {@link ViewObjectContextMenu}.
 */
export interface ViewObjectContextMenuContext extends BaseViewContext {
  /**
   * View object currently targeted by the menu.
   */
  viewObject: ViewObject;
}

/**
 * Context object consumed by {@link CanvasContextMenu}.
 */
export interface CanvasContextMenuContext extends BaseViewContext {
}

/**
 * Context menu for interacting with a {@link ViewObject}.
 *
 * The menu is organized around the most common user goals:
 * - navigating and managing views
 * - changing object visibility, x-ray, and selection state
 * - inspecting object data and opening inspectors
 * - exporting scene/view data
 * - editing the current object
 */
export class ViewObjectContextMenu extends ContextMenu {

  /**
   * Sets the active context for this menu.
   *
   * @param context Current view-object menu context.
   */
  set context(context: ViewObjectContextMenuContext) {
    super.context = context;
  }

  /**
   * Creates a view-object context menu with predefined grouped actions.
   *
   * @param _params Constructor params placeholder.
   */
  constructor(_params: {}) {
    super({
      items: [
        [
          {
            getTitle: () => "Frame Object",
            doAction: (context: ViewObjectContextMenuContext) => {
              context.cameraFlight.jumpTo({
                aabb: context.aabb3index.getObjectAABB(context.viewObject.id),
                duration: 0.5,
                fitFOV: 40
              });
            }
          },
          {
            getTitle: () => "Frame Model",
            doAction: (context: ViewObjectContextMenuContext) => {
              context.cameraFlight.jumpTo({
                aabb: getSceneModelAABB(context),
                duration: 0.5,
                fitFOV: 40
              });
            }
          },
          {
            getTitle: () => "Frame Scene",
            doAction: (context: ViewObjectContextMenuContext) => {
              context.cameraFlight.jumpTo({
                aabb: context.aabb3index.getSceneAABB(),
                duration: 0.5,
                fitFOV: 40
              });
            }
          }
        ],
        createViewObjectNavigateGroup(),
        createViewObjectDisplayGroup(),
        createViewObjectInspectGroup(),
        createViewObjectExportGroup(),
        createViewObjectEditGroup()
      ]
    });
  }
}

/**
 * Context menu for interacting with the canvas or empty view area.
 *
 * Includes only actions that apply to the view, scene, or model as a whole,
 * and excludes actions that require a specific {@link ViewObject}.
 */
export class CanvasContextMenu extends ContextMenu {

  /**
   * Sets the active context for this menu.
   *
   * @param context Current canvas menu context.
   */
  set context(context: CanvasContextMenuContext) {
    super.context = context;
  }

  /**
   * Creates a canvas context menu with view-level and scene-level actions.
   *
   * @param _params Constructor params placeholder.
   */
  constructor(_params: {}) {
    super({
      items: [
        [{
          getTitle: () => "Frame Scene",
          doAction: (context: CanvasContextMenuContext) => {
            context.cameraFlight.jumpTo({
              aabb: context.aabb3index.getSceneAABB(),
              duration: 0.5,
              fitFOV: 40
            });
          }
        }],
        createCanvasNavigateGroup(),
        createCanvasDisplayGroup(),
        createCanvasInspectGroup(),
        createCanvasExportGroup()
      ]
    });
  }
}

/**
 * Creates the root menu group for view-object navigation and lifecycle actions.
 *
 * @returns Context-menu item group.
 */
function createViewObjectNavigateGroup() {
  return [
    {
      getTitle: () => "View Settings",
      items: [
        createCameraProjectionGroup(),
        createWebGLContextGroup()
      ]
    },
    {
      getTitle: () => "Create View",
      getEnabled: (context: ViewObjectContextMenuContext) => {
        return context.view.viewer.viewList.length < 4; // TODO
      },
      doAction: (context: ViewObjectContextMenuContext) => {
        const result = context.view.camera.toParams();
        if (result.ok === false) {
          console.error("Failed to get camera parameters:", result.error);
          return;
        }
        context.demoHelper.createView({
          camera: result.value
        });
      }
    },
    {
      getTitle: () => "Close View",
      doAction: (context: ViewObjectContextMenuContext) => {
        context.demoHelper.destroyView(context.view);
      }
    }
  ];
}

function createCanvasNavigateGroup() {
  return [
    {
      getTitle: () => "View Settings",
      items: [
        createCameraProjectionGroup(),
        createWebGLContextGroup()
      ]
    },
    {
      getTitle: () => "Create View",
      getEnabled: (context: CanvasContextMenuContext) => {
        return context.view.viewer.viewList.length < 4; // TODO
      },
      doAction: (context: CanvasContextMenuContext) => {
        const result = context.view.camera.toParams();
        if (result.ok === false) {
          console.error("Failed to get camera parameters:", result.error);
          return;
        }
        context.demoHelper.createView({
          camera: result.value
        });
      }
    },
    {
      getTitle: () => "Close View",
      doAction: (context: CanvasContextMenuContext) => {
        context.demoHelper.destroyView(context.view);
      }
    }
  ];
}

/**
 * Creates the submenu group for WebGL context actions.
 *
 * @returns Context-menu item group.
 */
function createWebGLContextGroup() {
  return [
    {
      getTitle: () => "Lose WEBGL Context",
      doAction: (context: BaseViewContext) => {
        loseWebGLContext(context.renderer);
      }
    }
  ];
}

/**
 * Forces the renderer's WebGL context to be lost.
 */
function loseWebGLContext(renderer: WebGLRenderer): void {
  // TODO
}

/**
 * Creates the submenu group for camera projection options.
 *
 * @returns Context-menu item group.
 */
function createCameraProjectionGroup() {
  return [
    {
      getTitle: () => "Perspective Projection",
      getEnabled: (context: BaseViewContext) => {
        return context.view.camera.projectionType !== PerspectiveProjectionType;
      },
      doAction: (context: BaseViewContext) => {
        context.view.camera.projectionType = PerspectiveProjectionType;
      }
    },
    {
      getTitle: () => "Orthographic Projection",
      getEnabled: (context: BaseViewContext) => {
        return context.view.camera.projectionType !== OrthoProjectionType;
      },
      doAction: (context: BaseViewContext) => {
        context.view.camera.projectionType = OrthoProjectionType;
      }
    }
  ];
}

/**
 * Creates the root menu group for view-object display actions.
 *
 * @returns Context-menu item group.
 */
function createViewObjectDisplayGroup() {
  return [
    {
      getTitle: () => "Display",
      items: [
        createViewObjectVisibilityGroup(),
        createViewObjectXRayGroup(),
        createViewObjectSelectionGroup()
      ]
    }
  ];
}

/**
 * Creates the root menu group for canvas display actions.
 *
 * @returns Context-menu item group.
 */
function createCanvasDisplayGroup() {
  return [
    {
      getTitle: () => "Display",
      items: [
        createCanvasVisibilityGroup(),
        createCanvasXRayGroup(),
        createCanvasSelectionGroup()
      ]
    }
  ];
}

/**
 * Creates the visibility submenu group for a view object.
 *
 * @returns Context-menu item group.
 */
function createViewObjectVisibilityGroup() {
  return [
    {
      getTitle: () => "Hide Object",
      getEnabled: (context: ViewObjectContextMenuContext) => {
        return context.viewObject.visible;
      },
      doAction: (context: ViewObjectContextMenuContext) => {
        context.viewObject.visible = false;
      }
    },
    {
      getTitle: () => "Isolate Object",
      doAction: (context: ViewObjectContextMenuContext) => {
        const {viewObject} = context;
        const {view} = viewObject;
        view.setObjectsVisible(view.visibleObjectIds, false);
        viewObject.visible = true;
      }
    },
    {
      getTitle: () => "Hide All Objects",
      getEnabled: (context: ViewObjectContextMenuContext) => {
        return context.view.numVisibleObjects > 0;
      },
      doAction: (context: ViewObjectContextMenuContext) => {
        context.view.setObjectsVisible(context.view.visibleObjectIds, false);
      }
    },
    {
      getTitle: () => "Show All Objects",
      getEnabled: (context: ViewObjectContextMenuContext) => {
        const {view} = context;
        return view.numVisibleObjects < view.numObjects || view.numXRayedObjects > 0;
      },
      doAction: (context: ViewObjectContextMenuContext) => {
        const {view} = context;
        view.setObjectsVisible(view.objectIds, true);
        view.setObjectsPickable(view.xrayedObjectIds, true);
        view.setObjectsXRayed(view.xrayedObjectIds, false);
      }
    }
  ];
}

/**
 * Creates the visibility submenu group for the canvas.
 *
 * @returns Context-menu item group.
 */
function createCanvasVisibilityGroup() {
  return [
    {
      getTitle: () => "Hide All Objects",
      getEnabled: (context: CanvasContextMenuContext) => {
        return context.view.numVisibleObjects > 0;
      },
      doAction: (context: CanvasContextMenuContext) => {
        context.view.setObjectsVisible(context.view.visibleObjectIds, false);
      }
    },
    {
      getTitle: () => "Show All Objects",
      getEnabled: (context: CanvasContextMenuContext) => {
        const {view} = context;
        return view.numVisibleObjects < view.numObjects || view.numXRayedObjects > 0;
      },
      doAction: (context: CanvasContextMenuContext) => {
        const {view} = context;
        view.setObjectsVisible(view.objectIds, true);
        view.setObjectsPickable(view.xrayedObjectIds, true);
        view.setObjectsXRayed(view.xrayedObjectIds, false);
      }
    }
  ];
}

/**
 * Creates the x-ray submenu group for a view object.
 *
 * @returns Context-menu item group.
 */
function createViewObjectXRayGroup() {
  return [
    {
      getTitle: () => "X-Ray Object",
      getEnabled: (context: ViewObjectContextMenuContext) => {
        return !context.viewObject.xrayed;
      },
      doAction: (context: ViewObjectContextMenuContext) => {
        context.viewObject.xrayed = true;
      }
    },
    {
      getTitle: () => "X-Ray Others",
      doAction: (context: ViewObjectContextMenuContext) => {
        const {viewObject} = context;
        const {view} = viewObject;
        view.setObjectsXRayed(view.objectIds, true);
        viewObject.xrayed = false;
      }
    },
    {
      getTitle: () => "X-Ray All Objects",
      getEnabled: (context: ViewObjectContextMenuContext) => {
        return context.view.numXRayedObjects < context.view.numObjects;
      },
      doAction: (context: ViewObjectContextMenuContext) => {
        const {view} = context;
        view.setObjectsVisible(view.objectIds, true);
        view.setObjectsXRayed(view.objectIds, true);
      }
    },
    {
      getTitle: () => "Clear X-Ray",
      getEnabled: (context: ViewObjectContextMenuContext) => {
        return context.view.numXRayedObjects > 0;
      },
      doAction: (context: ViewObjectContextMenuContext) => {
        const {view} = context;
        const {xrayedObjectIds} = view;
        view.setObjectsPickable(xrayedObjectIds, true);
        view.setObjectsXRayed(xrayedObjectIds, false);
      }
    }
  ];
}

/**
 * Creates the x-ray submenu group for the canvas.
 *
 * @returns Context-menu item group.
 */
function createCanvasXRayGroup() {
  return [
    {
      getTitle: () => "X-Ray All Objects",
      getEnabled: (context: CanvasContextMenuContext) => {
        return context.view.numXRayedObjects < context.view.numObjects;
      },
      doAction: (context: CanvasContextMenuContext) => {
        const {view} = context;
        view.setObjectsVisible(view.objectIds, true);
        view.setObjectsXRayed(view.objectIds, true);
      }
    },
    {
      getTitle: () => "Clear X-Ray",
      getEnabled: (context: CanvasContextMenuContext) => {
        return context.view.numXRayedObjects > 0;
      },
      doAction: (context: CanvasContextMenuContext) => {
        const {view} = context;
        const {xrayedObjectIds} = view;
        view.setObjectsPickable(xrayedObjectIds, true);
        view.setObjectsXRayed(xrayedObjectIds, false);
      }
    }
  ];
}

/**
 * Creates the selection submenu group for a view object.
 *
 * @returns Context-menu item group.
 */
function createViewObjectSelectionGroup() {
  return [
    {
      getTitle: () => "Select Object",
      getEnabled: (context: ViewObjectContextMenuContext) => {
        return !context.viewObject.selected;
      },
      doAction: (context: ViewObjectContextMenuContext) => {
        context.viewObject.selected = true;
      }
    },
    {
      getTitle: () => "Deselect Object",
      getEnabled: (context: ViewObjectContextMenuContext) => {
        return context.viewObject.selected;
      },
      doAction: (context: ViewObjectContextMenuContext) => {
        context.viewObject.selected = false;
      }
    },
    {
      getTitle: () => "Clear Selection",
      getEnabled: (context: ViewObjectContextMenuContext) => {
        return context.view.numSelectedObjects > 0;
      },
      doAction: (context: ViewObjectContextMenuContext) => {
        context.view.setObjectsSelected(context.view.selectedObjectIds, false);
      }
    }
  ];
}

/**
 * Creates the selection submenu group for the canvas.
 *
 * @returns Context-menu item group.
 */
function createCanvasSelectionGroup() {
  return [
    {
      getTitle: () => "Clear Selection",
      getEnabled: (context: CanvasContextMenuContext) => {
        return context.view.numSelectedObjects > 0;
      },
      doAction: (context: CanvasContextMenuContext) => {
        context.view.setObjectsSelected(context.view.selectedObjectIds, false);
      }
    }
  ];
}

/**
 * Creates the root menu group for view-object inspection actions.
 *
 * @returns Context-menu item group.
 */
function createViewObjectInspectGroup() {
  return [
    {
      getTitle: () => "Inspect",
      items: [
        [
          {
            title: "Open Inspectors",
            doAction: (context: ViewObjectContextMenuContext) => {
              context.demoHelper.toggleInspector();
            }
          }
        ],
        [
          {
            title: "View DataObject JSON",
            getEnabled: (context: ViewObjectContextMenuContext) => {
              return !!getCurrentDataObject(context);
            },
            doAction: (context: ViewObjectContextMenuContext) => {
              const dataObject = getCurrentDataObject(context);
              if (!dataObject) {
                return;
              }
              openJsonInNewTab(getDataObjectJSON(dataObject), `DataObject ${dataObject.id}`);
            }
          },
          {
            title: "View SceneObject JSON",
            doAction: (context: ViewObjectContextMenuContext) => {
              const sceneObject = getCurrentSceneObject(context);
              openJsonInNewTab(getSceneObjectJSON(sceneObject), `SceneObject ${sceneObject.id}`);
            }
          }
        ]
      ]
    }
  ];
}

/**
 * Creates the root menu group for canvas inspection actions.
 *
 * @returns Context-menu item group.
 */
function createCanvasInspectGroup() {
  return [
    {
      getTitle: () => "Inspect",
      items: [
        [
          {
            title: "Open Inspectors",
            doAction: (context: CanvasContextMenuContext) => {
              context.demoHelper.toggleInspector();
            }
          }
        ]
      ]
    }
  ];
}

/**
 * Creates the root menu group for view-object export actions.
 *
 * @returns Context-menu item group.
 */
function createViewObjectExportGroup() {
  return [
    {
      getTitle: () => "Export",
      items: [
        createSnapshotExportGroup(),
        createFileExportGroup()
      ]
    }
  ];
}

/**
 * Creates the root menu group for canvas export actions.
 *
 * Canvas export intentionally excludes model file export formats.
 *
 * @returns Context-menu item group.
 */
function createCanvasExportGroup() {
  return [
    {
      getTitle: () => "Export",
      items: [
        createSnapshotExportGroup()
      ]
    }
  ];
}

/**
 * Creates the export submenu group for screenshot and BCF viewpoint output.
 *
 * @returns Context-menu item group.
 */
function createSnapshotExportGroup() {
  return [
    {
      title: "Save Screenshot",
      doAction: async (context: BaseViewContext) => {
        await saveViewScreenshot(context);
      }
    },
    {
      title: "Export BCF Viewpoint",
      doAction: (context: BaseViewContext) => {
        const bcfViewpointResult = saveBCFViewpoint({
          view: context.view,
          includeViewLayerIds: ["default"]
        });

        if (bcfViewpointResult.ok) {
          downloadText(
            JSON.stringify(bcfViewpointResult.value, null, 2),
            "bcfViewpoint.json",
            "application/json"
          );
        }
      }
    }
  ];
}

/**
 * Creates the export submenu group for scene and model file formats.
 *
 * @returns Context-menu item group.
 */
function createFileExportGroup() {
  return [
    {
      title: "Export as OBJ + MTL",
      doAction: async (context: BaseViewContext) => {
        const {sceneModel} = context;

        try {
          const objData = await new OBJExporter().write(
            {sceneModel},
            {coordinateSystem: createExportCoordinateSystem()}
          );
          downloadText(objData, `${sceneModel.id}.obj`, "application/text");
        } catch (error) {
          console.error(error);
        }

        try {
          const mtlData = await new MTLExporter().write({sceneModel});
          downloadText(mtlData, `${sceneModel.id}.mtl`, "application/text");
        } catch (error) {
          console.error(error);
        }
      }
    },
    {
      title: "Export as XGF",
      doAction: async (context: BaseViewContext) => {
        try {
          const fileData = await new XGFExporter().write(
            {
              sceneModel: context.sceneModel,
              dataModel: context.dataModel
            },
            {
              coordinateSystem: createExportCoordinateSystem()
            }
          );
          downloadBlob(fileData, `${context.sceneModel.id}.xgf`, "application/octet-stream");
        } catch (error) {
          console.error(error);
        }
      }
    },
    {
      title: "Export as DotBIM",
      doAction: async (context: BaseViewContext) => {
        try {
          const fileData = await new DotBIMExporter().write(
            {
              sceneModel: context.sceneModel,
              dataModel: context.dataModel
            },
            {
              coordinateSystem: createExportCoordinateSystem()
            }
          );
          downloadText(
            JSON.stringify(fileData, null, 2),
            `${context.sceneModel.id}.bim`,
            "application/json"
          );
        } catch (error) {
          console.error(error);
        }
      }
    },
    {
      title: "Export as JSON",
      doAction: (context: BaseViewContext) => {
        downloadSceneAndDataJson(context);
      }
    }
  ];
}

/**
 * Creates the root menu group for edit actions.
 *
 * @returns Context-menu item group.
 */
function createViewObjectEditGroup() {
  return [
    {
      getTitle: () => "Delete Object",
      doAction: (context: ViewObjectContextMenuContext) => {
        context.viewObject.sceneObject.destroy();
      }
    },
    {
      getTitle: () => "Delete Model",
      doAction: (context: ViewObjectContextMenuContext) => {
        context.viewObject.sceneObject.model.destroy();
      }
    }
  ];
}

/**
 * Resolves an axis-aligned bounding box for the current scene model.
 *
 * @param context Current menu context.
 * @returns Scene-model AABB.
 */
function getSceneModelAABB(context: BaseViewContext): AABB3 {
  return context.aabb3index.getCombinedObjectAABB(Object.keys(context.sceneModel.objects));
}

/**
 * Returns the currently targeted scene object from the menu context.
 *
 * @param context Current menu context.
 * @returns Current scene object.
 */
function getCurrentSceneObject(context: ViewObjectContextMenuContext): SceneObject {
  return context.viewObject.sceneObject;
}

/**
 * Returns the currently targeted data object from the menu context, if any.
 *
 * @param context Current menu context.
 * @returns Matching data object, or `undefined` when unavailable.
 */
function getCurrentDataObject(context: ViewObjectContextMenuContext): DataObject | undefined {
  if (!context.dataModel) {
    return undefined;
  }
  return context.dataModel.objects[context.viewObject.sceneObject.id];
}

/**
 * Creates the shared coordinate-system configuration used by exporters.
 *
 * @returns Export coordinate-system config.
 */
function createExportCoordinateSystem(): CoordinateSystemParams {
  return {
    basis: [
      1, 0, 0, // Right
      0, 0, 1, // Up
      0, 1, 0 // Forward
    ],
    origin: [0, 0, 0] as [number, number, number],
    units: "meters"
  };
}

/**
 * Saves a PNG screenshot for the current view.
 *
 * @param context Current menu context.
 */
async function saveViewScreenshot(context: BaseViewContext): Promise<void> {
  const fileName = getScreenshotFileName(context);
  const result = context.renderer.getSnapshot(context.view);
  if (result.ok === false) {
    console.error("Failed to capture screenshot:", result.error);
    return;
  }
  downloadDataUrl(result.value, fileName);
}

/**
 * Builds a file name for a saved screenshot.
 *
 * @param context Current menu context.
 * @returns Screenshot file name.
 */
function getScreenshotFileName(context: BaseViewContext): string {
  const viewId = (context.view as any)?.id;
  const baseName = viewId
    ? `${context.sceneModel.id}-${String(viewId)}`
    : context.sceneModel.id;

  return `${sanitizeFileName(baseName)}-screenshot.png`;
}

/**
 * Downloads serialized scene-model and optional data-model JSON files.
 *
 * @param context Current menu context.
 */
function downloadSceneAndDataJson(context: BaseViewContext): void {
  const {sceneModel, dataModel} = context;
  const sceneParamsResult = sceneModel.toParams();
  if (sceneParamsResult.ok) {
    downloadText(
      JSON.stringify(sceneParamsResult.value, null, 2),
      `${sceneModel.id}-scene.json`,
      "application/json"
    );
  }

  if (!dataModel) {
    return;
  }

  const dataParamsResult = dataModel.toParams();
  if (dataParamsResult.ok) {
    downloadText(
      JSON.stringify(dataParamsResult.value, null, 2),
      `${dataModel.id}-data.json`,
      "application/json"
    );
  }
}

/**
 * Downloads binary or textual data as a file by first creating a blob URL.
 *
 * @param data File contents.
 * @param fileName Name of the downloaded file.
 * @param mimeType MIME type assigned to the created blob.
 */
function downloadBlob(data: BlobPart, fileName: string, mimeType: string): void {
  const blob = new Blob([data], {type: mimeType});
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Downloads text content as a file.
 *
 * @param text Text content to download.
 * @param fileName Name of the downloaded file.
 * @param mimeType MIME type assigned to the text blob.
 */
function downloadText(text: string, fileName: string, mimeType = "text/plain;charset=utf-8"): void {
  downloadBlob(text, fileName, mimeType);
}

/**
 * Downloads a data URL as a file.
 *
 * @param dataUrl Data URL to download.
 * @param fileName Suggested file name.
 */
function downloadDataUrl(dataUrl: string, fileName: string): void {
  triggerDownload(dataUrl, fileName);
}

/**
 * Triggers a browser download for the given URL and file name.
 *
 * @param url Object URL or downloadable URL.
 * @param fileName Suggested file name.
 */
function triggerDownload(url: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Sanitizes a string for use as a file name.
 *
 * @param value Raw file-name component.
 * @returns Safe file-name component.
 */
function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

/**
 * Serializes a {@link SceneObject} into a minimal {@link SceneModelParams} payload.
 *
 * Includes:
 * - mesh params for each mesh on the object
 * - referenced compressed geometry params
 * - referenced material params
 * - the object params itself
 *
 * @param sceneObject Scene object to serialize.
 * @returns Scene-model JSON payload containing only the object's referenced content.
 */
function getSceneObjectJSON(sceneObject: SceneObject): SceneModelParams {
  const params: SceneModelParams = {
    materials: [],
    geometriesCompressed: [],
    meshes: [],
    objects: []
  };

  for (const mesh of sceneObject.meshes) {
    const meshParamsResult = mesh.toParams();
    if (meshParamsResult.ok) {
      params.meshes.push(meshParamsResult.value);
    }

    const geometry = mesh.geometry;
    if (geometry) {
      const geometryParamsResult = geometry.toParams();
      if (geometryParamsResult.ok) {
        params.geometriesCompressed.push(geometryParamsResult.value);
      }
    }

    const material = mesh.material;
    if (material) {
      const materialParamsResult = material.toParams();
      if (materialParamsResult.ok) {
        params.materials.push(materialParamsResult.value);
      }
    }
  }

  const objectParamsResult = sceneObject.toParams();
  if (objectParamsResult.ok) {
    params.objects.push(objectParamsResult.value);
  }

  return params;
}

/**
 * Serializes a {@link DataObject} into a minimal {@link DataModelContentParams} payload.
 *
 * Includes:
 * - the data object itself
 * - its property sets
 * - an empty relationships list
 *
 * Relationship serialization is currently disabled in the implementation.
 *
 * @param dataObject Data object to serialize.
 * @returns Data-model content JSON payload for inspection.
 */
function getDataObjectJSON(dataObject: DataObject): DataModelContentParams {
  const params: DataModelContentParams = {
    objects: [],
    propertySets: [],
    relationships: []
  };

  for (const propertySet of dataObject.propertySets) {
    params.propertySets.push({
      id: propertySet.id,
      name: propertySet.name,
      type: propertySet.type,
      schema: propertySet.schema,
      properties: propertySet.properties.map(property => ({
        name: property.name,
        description: property.description,
        type: property.type,
        value: property.value
      }))
    });
  }

  // for (const relatingType in dataObject.relating) {
  //   const relationships = dataObject.relating[relatingType];
  //   for (const relationship of relationships) {
  //     const relationshipParams = {
  //       type: relationship.type,
  //       schema: relationship.schema,
  //       relatingObjectId: relationship.relatingObject.id,
  //       relatedObjectId: relationship.relatedObject.id
  //     };
  //     params.relationships.push(relationshipParams);
  //   }
  // }
  //
  // for (const relatedType in dataObject.related) {
  //   const relationships = dataObject.related[relatedType];
  //   for (const relationship of relationships) {
  //     const relationshipParams = {
  //       type: relationship.type,
  //       schema: relationship.schema,
  //       relatingObjectId: relationship.relatingObject.id,
  //       relatedObjectId: relationship.relatedObject.id
  //     };
  //     params.relationships.push(relationshipParams);
  //   }
  // }

  params.objects.push({
    id: dataObject.id,
    originalSystemId: dataObject.originalSystemId,
    name: dataObject.name,
    description: dataObject.description,
    type: dataObject.type,
    schema: dataObject.schema,
    propertySetIds: dataObject.propertySets?.map(propertySet => propertySet.id)
  });

  return params;
}

/**
 * Applies simple HTML-based syntax highlighting to a JSON string.
 *
 * The returned string is intended to be injected into trusted HTML content.
 *
 * @param json Raw JSON string.
 * @returns HTML string with span-wrapped tokens for styling.
 */
function syntaxHighlightJson(json: string): string {
  json = json.replace(/[&<>]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;"
  }[c] || c));

  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";

      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }

      return `<span class="${cls}">${match}</span>`;
    }
  );
}

/**
 * Opens a new browser tab containing syntax-highlighted JSON.
 *
 * @param obj Value to serialize and render.
 * @param title Title shown in the document and browser tab.
 */
function openJsonInNewTab(obj: any, title = "DataModel JSON"): void {
  const json = JSON.stringify(obj, null, 2);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <meta charset="utf-8"/>
  <style>
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .json-pre {
      background: #0f1116;
      border-radius: 10px;
      margin: 24px 0 24px 24px;
      padding: 24px 32px;
      max-width: 900px;
      font-size: 15px;
      box-shadow: 0 4px 24px #0001;
      color: #e7e7e7;
      text-align: left;
    }
    .json-key { color: #7ec7e6; font-weight: 600; }
    .json-string { color: #ffe7b3; }
    .json-number { color: #b3e6c7; }
    .json-boolean { color: #ffd57a; }
    .json-null { color: #888; }
    h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 24px 24px 12px 24px; }
    .meta { color: #aaa; font-size: 13px; margin: 0 24px 18px 24px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Serialized to JSON</div>
  <pre class="json-pre">${syntaxHighlightJson(json)}</pre>
</body>
</html>
  `.trim();

  const win = window.open();
  if (!win) {
    return;
  }

  win.document.write(html);
  win.document.close();
}

/**
 * Escapes a string for safe insertion into HTML text and attribute content.
 *
 * @param s Raw string.
 * @returns HTML-escaped string.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
