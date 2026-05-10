import {ContextMenu} from "../ui/contextmenu";
import {SceneHealthPanel} from "./sceneHealthPanel/SceneHealthPanel";
import {DataHealthPanel} from "./dataHealthPanel/DataHealthPanel";
import {SceneStatsPanel} from "./sceneStats/SceneStatsPanel";
import {SchemaMaterialsPanel} from "./schemaMaterialsPanel/SchemaMaterialsPanel";
import {ViewerConfigPanel} from "./viewerPanel/ViewerConfigPanel";
import {GPUMemoryPanel} from "./gpuMemoryUsage/GPUMemoryUsage";
import {Toolbar} from "./toolbar/Toolbar";
import {ExportDialog} from "./exportDialog/ExportDialog";
import {ExplorerPanel} from "./explorerPanel/ExplorerPanel";
import {EventsPanel} from "./eventsPanel/EventsPanel";
import {DataStatsPanel} from "./dataStats/DataStatsPanel";
import {BoundariesPanel} from "./boundariesPanel/BoundariesPanel";
import {TilesPanel} from "./tilesPanel/TilesPanel";
import {SampleModelsPanel} from "./sampleModelsPanel/SampleModelsPanel";
import {ExportBCFPanel} from "./exportBCF/ExportBCFPanel";
import {ViewObject} from "../viewer";
import {SceneCollisionIndex} from "../collision";
import {SceneModel, type SceneModelParams, SceneObject} from "../scene";
import {DataModel, type DataModelContentParams, DataObject} from "../data";
import {CameraFlightAnimation} from "../cameraFlight";
import {DemoHelper} from "./DemoHelper";
import {WebGLRenderer} from "../webGLRenderer";
import {
  DetailedRender,
  NavigationRender,
  OrthoProjectionType,
  PerspectiveProjectionType,
  RealisticRender
} from "../constants";
import {type AABB3} from "../math/boundaries";
import {applyIFCMaterials} from "./applyIFCMaterials";
import {MaterialsPalette, type PainterCatalogEntry} from "./materials";

/**
 * Lazily-initialised, module-scoped MaterialsPalette shared by every
 * ViewObjectContextMenu instance. Built on first menu invocation;
 * subsequent invocations re-use it so the per-(SceneModel, painter)
 * material cache survives across right-clicks.
 */
let _materialsPalette: MaterialsPalette | undefined;

function getMaterialsPalette(): MaterialsPalette {
  if (!_materialsPalette) {
    _materialsPalette = new MaterialsPalette();
  }
  return _materialsPalette;
}

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
  collisionIndex: SceneCollisionIndex;
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
   * @param params Optional params. `debug: true` exposes the
   *   engineer-only Debug submenu (currently the WebGL
   *   context-loss simulator). Default `false`.
   */
  constructor(params: { debug?: boolean } = {}) {
    const debug = params.debug === true;
    const debugSub = createDebugSubmenu(debug);
    super({
      // Verb-led structure, two-level nesting max:
      //   Frame ▶ — three flat actions, the most-used at the top.
      //   Show  ▶ — visibility, x-ray, selection (was a 3-deep Display
      //             tree, flattened to one submenu with separators).
      //   Inspect ▶ — read-only diagnostic surfaces (panel openers +
      //               JSON dumps).
      //   Modify ▶ — non-destructive mutations (Change Material,
      //              IFC Materials, Demolish — was the old Effects
      //              + standalone Change Material).
      //   View ▶ — viewer / renderer settings (Render Mode + Camera
      //            Projection + Create / Close View, was scattered).
      //   Export ▶ — snapshots + file-format export.
      //   Delete — last group, with the natural separator above acting
      //            as a visual moat against the destructive actions.
      items: [
        [
          {
            getTitle: () => "Frame Object",
            doAction: (context: ViewObjectContextMenuContext) => {
              context.cameraFlight.jumpTo({
                aabb: context.collisionIndex.getObjectAABB(context.viewObject.id),
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
                aabb: context.collisionIndex.getSceneAABB(),
                duration: 0.5,
                fitFOV: 40
              });
            }
          }
        ],
        [createViewObjectShowGroup()],
        [createInspectGroup(true)],
        [createViewObjectModifyGroup()],
        [createVisualStyleEntry(), createCameraProjectionEntry()],
        createViewObjectImportGroup(),
        createViewObjectExportGroup(),
        createViewObjectDeleteGroup(),
        ...(debugSub ? [[debugSub]] : []),
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
   * @param params Optional params. `debug: true` exposes the
   *   engineer-only Debug submenu. Default `false`.
   */
  constructor(params: { debug?: boolean } = {}) {
    const debug = params.debug === true;
    const debugSub = createDebugSubmenu(debug);
    super({
      // Same verb-led structure as the per-object menu, slimmed
      // down for a click into empty canvas: no per-object actions,
      // and the JSON dumps are dropped (no specific resource to
      // serialize).
      items: [
        [
          {
            getTitle: () => "Frame Scene",
            doAction: (context: CanvasContextMenuContext) => {
              context.cameraFlight.jumpTo({
                aabb: context.collisionIndex.getSceneAABB(),
                duration: 0.5,
                fitFOV: 40
              });
            }
          },
        ],
        [createCanvasShowGroup()],
        [createInspectGroup(false)],
        [createCanvasModifyGroup()],
        [createVisualStyleEntry(), createCameraProjectionEntry()],
        createCanvasImportGroup(),
        createCanvasExportGroup(),
        [createSettingsEntry()],
        ...(debugSub ? [[debugSub]] : []),
      ]
    });
  }
}


/**
 * Builds the **Modify** submenu for the canvas context menu —
 * scene-level mutators that don't need a specific object pick.
 * Mirrors the entries in {@link createViewObjectModifyGroup} that
 * make sense without a {@link ViewObject} target.
 */
function createCanvasModifyGroup() {
  return {
    getTitle: () => "Modify",
    items: [
      [
        {
          title: "Schema Materials…",
          icon: SchemaMaterialsPanel.iconSvg(),
          getEnabled: (context: CanvasContextMenuContext) => !!context.dataModel,
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.openSchemaMaterialsPanel(context.sceneModel);
          }
        }
      ]
    ]
  };
}

/**
 * Builds the **View** submenu — viewer / renderer settings the
 * user is most likely reaching for in a context menu: render
 * mode, camera projection, view lifecycle. Replaces the old
 * scattered set ("Render Mode" at top level, "View Settings",
 * "Create View", "Close View" each as separate top-level rows).
 */
/**
 * Visual Style submenu — promoted from the old `View ▶ Render
 * Mode ▶` to a top-level entry. Vocabulary aligned with the AEC
 * convention (Revit, Navisworks both call this "Visual Style").
 * The internal API still references `view.renderMode`; only the
 * label changes.
 */
function createVisualStyleEntry() {
  return {
    getTitle: () => "Visual Style",
    items: [createRenderModeGroup()],
  };
}

/**
 * Camera Projection submenu — promoted from the old
 * `View ▶ Camera Projection ▶` to a top-level entry.
 */
function createCameraProjectionEntry() {
  return {
    getTitle: () => "Camera Projection",
    items: [createCameraProjectionGroup()],
  };
}

/**
 * Settings entry — opens the {@link ViewerConfigPanel}. Sits at
 * the top level of the canvas menu near the bottom; not in the
 * object menu, since settings are not object-scoped.
 */
function createSettingsEntry() {
  return {
    title: "Settings…",
    icon: ViewerConfigPanel.iconSvg(),
    doAction: (context: BaseViewContext) => {
      context.demoHelper.openViewerConfigPanel();
    },
  };
}

/**
 * Debug submenu — gated on {@link DemoHelperConfig.debug}.
 * Hosts engineer-only entries (currently just the WebGL
 * context-loss simulator). Returns `null` when the debug flag
 * is unset, so the caller filters it out of the menu.
 */
function createDebugSubmenu(debug: boolean) {
  if (!debug) return null;
  return {
    getTitle: () => "Debug",
    items: [
      [
        {
          getTitle: () => "Lose WebGL Context",
          doAction: (context: BaseViewContext) => {
            loseWebGLContext(context.renderer);
          },
        },
      ],
    ],
  };
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
 * Creates the submenu group for render-mode preset switching.
 *
 * Each item drives `view.renderMode` to one of the three preset
 * constants. `getEnabled` returns `false` for the currently-active
 * mode so the menu disables it (matching the camera-projection
 * group's idiom).
 */
function createRenderModeGroup() {
  return [
    {
      getTitle: () => "Navigation Render",
      getEnabled: (context: BaseViewContext) => {
        return context.view.renderMode !== NavigationRender;
      },
      doAction: (context: BaseViewContext) => {
        context.view.renderMode = NavigationRender;
      }
    },
    {
      getTitle: () => "Detailed Render",
      getEnabled: (context: BaseViewContext) => {
        return context.view.renderMode !== DetailedRender;
      },
      doAction: (context: BaseViewContext) => {
        context.view.renderMode = DetailedRender;
      }
    },
    {
      getTitle: () => "Realistic Render",
      getEnabled: (context: BaseViewContext) => {
        return context.view.renderMode !== RealisticRender;
      },
      doAction: (context: BaseViewContext) => {
        context.view.renderMode = RealisticRender;
      }
    }
  ];
}

/**
 * Builds the **Show** submenu — visibility / x-ray / selection
 * actions, flattened from the old 3-deep `Display → {Visibility,
 * X-Ray, Selection}` tree into one submenu with a separator
 * between per-object actions and scene-wide resets.
 *
 * Per-object actions read as a vertical menu of toggles; the
 * Select / Deselect entry uses a dynamic title rather than two
 * mutually-disabled rows so the user always sees the action that
 * actually applies right now.
 */
function createViewObjectShowGroup() {
  return {
    getTitle: () => "Show",
    items: [
      // Per-object actions.
      [
        {
          getTitle: () => "Hide",
          getEnabled: (context: ViewObjectContextMenuContext) => context.viewObject.visible,
          doAction: (context: ViewObjectContextMenuContext) => {
            context.viewObject.visible = false;
          }
        },
        {
          getTitle: () => "Isolate",
          doAction: (context: ViewObjectContextMenuContext) => {
            const {viewObject} = context;
            const {view} = viewObject;
            view.setObjectsVisible(view.visibleObjectIds, false);
            viewObject.visible = true;
          }
        },
        {
          getTitle: () => "X-Ray Object",
          getEnabled: (context: ViewObjectContextMenuContext) => !context.viewObject.xrayed,
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
          // Single dynamic toggle instead of two rows where one
          // is always disabled — fewer visual distractions.
          getTitle: (context: ViewObjectContextMenuContext) =>
            context.viewObject.selected ? "Deselect" : "Select",
          doAction: (context: ViewObjectContextMenuContext) => {
            context.viewObject.selected = !context.viewObject.selected;
          }
        },
      ],
      // Scene-wide resets.
      [
        {
          getTitle: () => "Show All",
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
        },
        {
          getTitle: () => "Clear X-Ray",
          getEnabled: (context: ViewObjectContextMenuContext) => context.view.numXRayedObjects > 0,
          doAction: (context: ViewObjectContextMenuContext) => {
            const {view} = context;
            const {xrayedObjectIds} = view;
            view.setObjectsPickable(xrayedObjectIds, true);
            view.setObjectsXRayed(xrayedObjectIds, false);
          }
        },
        {
          getTitle: () => "Clear Selection",
          getEnabled: (context: ViewObjectContextMenuContext) => context.view.numSelectedObjects > 0,
          doAction: (context: ViewObjectContextMenuContext) => {
            context.view.setObjectsSelected(context.view.selectedObjectIds, false);
          }
        },
      ],
    ],
  };
}

/**
 * Canvas-side counterpart of {@link createViewObjectShowGroup} —
 * scene-wide resets only since there's no specific
 * {@link ViewObject} to act on.
 */
function createCanvasShowGroup() {
  return {
    getTitle: () => "Show",
    items: [
      [
        {
          getTitle: () => "Show All",
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
        },
        {
          getTitle: () => "Hide All",
          getEnabled: (context: CanvasContextMenuContext) => context.view.numVisibleObjects > 0,
          doAction: (context: CanvasContextMenuContext) => {
            context.view.setObjectsVisible(context.view.visibleObjectIds, false);
          }
        },
        {
          getTitle: () => "X-Ray All",
          getEnabled: (context: CanvasContextMenuContext) =>
            context.view.numXRayedObjects < context.view.numObjects,
          doAction: (context: CanvasContextMenuContext) => {
            const {view} = context;
            view.setObjectsVisible(view.objectIds, true);
            view.setObjectsXRayed(view.objectIds, true);
          }
        },
        {
          getTitle: () => "Clear X-Ray",
          getEnabled: (context: CanvasContextMenuContext) => context.view.numXRayedObjects > 0,
          doAction: (context: CanvasContextMenuContext) => {
            const {view} = context;
            const {xrayedObjectIds} = view;
            view.setObjectsPickable(xrayedObjectIds, true);
            view.setObjectsXRayed(xrayedObjectIds, false);
          }
        },
        {
          getTitle: () => "Clear Selection",
          getEnabled: (context: CanvasContextMenuContext) => context.view.numSelectedObjects > 0,
          doAction: (context: CanvasContextMenuContext) => {
            context.view.setObjectsSelected(context.view.selectedObjectIds, false);
          }
        },
      ],
    ],
  };
}

/**
 * Creates the root menu group for view-object inspection actions.
 *
 * @returns Context-menu item group.
 */
/**
 * Builds the **Inspect** submenu shared between the object
 * and canvas menus — every read-only diagnostic and metadata
 * panel in one flat list, separated by usage cluster:
 *
 *   1. Health checks (problem-finding, top-billed because
 *      that is the most common reason to open Inspect).
 *   2. Browsing / statistics surfaces.
 *   3. Debug-viz panels (Boundaries, Tiles, GPU Memory) and
 *      the Events log.
 *   4. Object-scoped JSON dumps (object menu only).
 *
 * The previous Diagnose / Examine split is gone — users do
 * not predictably know which submenu hosts which panel, and
 * the two-level nesting added a click without aiding recall.
 */
function createInspectGroup(forObject: boolean) {

  const healthGroup: any[] = [
    {
      title: "Scene Health",
      icon: SceneHealthPanel.iconSvg(),
      doAction: (context: any) => {
        // For the object menu, pass the clicked object's
        // SceneModel as initial focus so the panel opens on the
        // right model in its tab strip. For the canvas menu,
        // there is no specific SceneModel; the panel falls back
        // to its first loaded model.
        const focus = forObject
          ? (context as ViewObjectContextMenuContext).viewObject.sceneObject.model
          : undefined;
        context.demoHelper.getSceneHealthPanel(focus);
      },
    },
    {
      title: "Data Health",
      icon: DataHealthPanel.iconSvg(),
      doAction: (context: any) => {
        const focus = forObject
          ? getCurrentDataObject(context as ViewObjectContextMenuContext)?.models[0]
          : undefined;
        context.demoHelper.getDataHealthPanel(focus);
      },
    },
  ];

  const browseGroup: any[] = [
    {
      title: "Explorer",
      icon: ExplorerPanel.iconSvg(),
      doAction: (context: any) => context.demoHelper.getExplorer(),
    },
    {
      title: "Scene Statistics",
      icon: SceneStatsPanel.iconSvg(),
      doAction: (context: any) => context.demoHelper.openSceneStatsPanel(),
    },
    {
      title: "Data Statistics",
      icon: DataStatsPanel.iconSvg(),
      doAction: (context: any) => context.demoHelper.openDataStatsPanel(),
    },
  ];

  const debugGroup: any[] = [
    {
      title: "Scene Boundaries",
      icon: BoundariesPanel.iconSvg(),
      doAction: (context: any) => context.demoHelper.openBoundariesPanel(),
    },
    {
      title: "GPU Tiles",
      icon: TilesPanel.iconSvg(),
      doAction: (context: any) => context.demoHelper.openTilesPanel(),
    },
    {
      title: "GPU Memory",
      icon: GPUMemoryPanel.iconSvg(),
      doAction: (context: any) => context.demoHelper.getGPUMemoryPanel(),
    },
    {
      title: "Events",
      icon: EventsPanel.iconSvg(),
      doAction: (context: any) => context.demoHelper.getEventsPanel(),
    },
  ];

  // JSON dumps are object-scoped — there is no per-object
  // resource to serialise from an empty-space canvas click.
  const jsonGroup: any[] = forObject
    ? [
        {
          title: "View DataObject JSON",
          getEnabled: (context: ViewObjectContextMenuContext) =>
            !!getCurrentDataObject(context),
          doAction: (context: ViewObjectContextMenuContext) => {
            const dataObject = getCurrentDataObject(context);
            if (!dataObject) return;
            openJsonInNewTab(getDataObjectJSON(dataObject), `DataObject ${dataObject.id}`);
          },
        },
        {
          title: "View SceneObject JSON",
          doAction: (context: ViewObjectContextMenuContext) => {
            const sceneObject = getCurrentSceneObject(context);
            openJsonInNewTab(getSceneObjectJSON(sceneObject), `SceneObject ${sceneObject.id}`);
          },
        },
      ]
    : [];

  const items = jsonGroup.length > 0
    ? [healthGroup, browseGroup, debugGroup, jsonGroup]
    : [healthGroup, browseGroup, debugGroup];

  return {
    getTitle: () => "Inspect",
    items,
  };
}

/**
 * Builds the **Import** submenu — sits next to **Export** in
 * both the view-object and canvas menus and currently exposes
 * the **Sample Models** entry (the floating
 * {@link SampleModelsPanel}, which lists every demo model the
 * helper can load). Kept as a submenu so future import sources
 * (drag-drop, file picker, URL prompt) drop in without
 * reshuffling the top-level layout.
 */
function createViewObjectImportGroup() {
  return [
    {
      getTitle: () => "Import",
      items: [
        [
          {
            title: "Sample Models",
            icon: SampleModelsPanel.iconSvg(),
            doAction: (context: ViewObjectContextMenuContext) => {
              context.demoHelper.showSampleModels();
            }
          },
        ],
      ]
    }
  ];
}

/** Canvas-side counterpart of {@link createViewObjectImportGroup}. */
function createCanvasImportGroup() {
  return [
    {
      getTitle: () => "Import",
      items: [
        [
          {
            title: "Sample Models",
            icon: SampleModelsPanel.iconSvg(),
            doAction: (context: CanvasContextMenuContext) => {
              context.demoHelper.showSampleModels();
            }
          },
        ],
      ]
    }
  ];
}

/**
 * Builds the view-object **Export** submenu — snapshots plus the
 * "Export Models…" launcher for the full ExportDialog (which
 * supersedes the old per-format "Export As" cascade).
 */
function createViewObjectExportGroup() {
  return [
    {
      getTitle: () => "Export",
      items: [
        createSnapshotExportGroup(),
        [
          {
            title: "Export Models…",
            icon: ExportDialog.iconSvg(),
            doAction: (context: ViewObjectContextMenuContext) => {
              context.demoHelper.openExportDialog();
            }
          },
        ],
      ]
    }
  ];
}

/**
 * Canvas-side **Export** submenu — snapshots only. File-format
 * exports require a specific SceneModel and don't make sense
 * from a generic canvas right-click.
 */
function createCanvasExportGroup() {
  return [
    {
      getTitle: () => "Export",
      items: [
        createSnapshotExportGroup(),
        [
          {
            title: "Export Models…",
            icon: ExportDialog.iconSvg(),
            doAction: (context: CanvasContextMenuContext) => {
              context.demoHelper.openExportDialog();
            }
          },
        ],
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
      icon: screenshotIconSvg(),
      doAction: async (context: BaseViewContext) => {
        await saveViewScreenshot(context);
      }
    },
    {
      title: "Export BCF Viewpoint…",
      icon: ExportBCFPanel.iconSvg(),
      doAction: (context: BaseViewContext) => {
        context.demoHelper.openExportBCFPanel();
      }
    }
  ];
}

/**
 * Builds the **Modify** submenu — non-destructive mutations on
 * the targeted object's parent SceneModel. Replaces the old
 * "Effects" submenu (which was a junk drawer with IFC materials
 * + demolish) and the standalone top-level "Change Material"
 * item.
 *
 * "Modify" is honest about what these do (mutate scene state);
 * the old "Effects" name suggested visual filters.
 */
function createViewObjectModifyGroup() {
  return {
    getTitle: () => "Modify",
    items: [
      [
        {
          getTitle: () => "Change Material",
          items: [createCategorySubmenus()],
        },
      ],
      [
        {
          getTitle: () => "Add IFC Materials",
          getEnabled: (context: ViewObjectContextMenuContext) => !!context.dataModel,
          doAction: async (context: ViewObjectContextMenuContext) => {
            const sceneModel = context.viewObject.sceneObject.model;
            const dataModel = context.dataModel;
            if (!dataModel) {
              console.warn("[ViewObjectContextMenu] Add IFC Materials: no DataModel in context");
              return;
            }
            const result = await applyIFCMaterials({sceneModel, dataModel});
            if (result.ok === false) {
              console.error("[ViewObjectContextMenu] Add IFC Materials failed:", result.error);
            }
          }
        },
        {
          title: "Schema Materials…",
          icon: SchemaMaterialsPanel.iconSvg(),
          getEnabled: (context: ViewObjectContextMenuContext) => !!context.dataModel,
          doAction: (context: ViewObjectContextMenuContext) => {
            context.demoHelper.openSchemaMaterialsPanel(
              context.viewObject.sceneObject.model
            );
          }
        },
        {
          getTitle: () => "Demolish Model",
          doAction: async (context: ViewObjectContextMenuContext) => {
            const result = await context.demoHelper.demolishModel(context.viewObject.sceneObject.model);
            if (result.ok === false) {
              console.error(result.error);
            }
          }
        }
      ]
    ]
  };
}

/**
 * Builds the per-category submenu list used by the "Change
 * Material" entry inside the **Modify** submenu.
 *
 * Walks the shared {@link MaterialsPalette} catalog, groups entries
 * by their {@link PainterCatalogEntry.category}, and emits one
 * submenu item per non-empty category with the painters as actions
 * inside it. Display order is fixed (Masonry → Interior → Metals →
 * Glass) so the menu reads the same regardless of catalog
 * declaration order.
 */
function createCategorySubmenus() {
  const palette = getMaterialsPalette();
  const byCategory: Record<string, PainterCatalogEntry[]> = {};
  for (const entry of palette.catalog) {
    (byCategory[entry.category] ||= []).push(entry);
  }

  // Catalog enum values are singular; the user-visible labels follow
  // the more natural plural for "Metals". Order is fixed so menu
  // structure stays stable across catalog reshuffling.
  const order: ReadonlyArray<{cat: PainterCatalogEntry["category"]; label: string}> = [
    {cat: "Masonry",  label: "Masonry"},
    {cat: "Interior", label: "Interior"},
    {cat: "Metal",    label: "Metals"},
    {cat: "Glass",    label: "Glass"},
  ];

  return order
    .filter(({cat}) => byCategory[cat] && byCategory[cat].length > 0)
    .map(({cat, label}) => ({
      getTitle: () => label,
      items: [
        byCategory[cat].map(entry => ({
          getTitle: () => entry.label,
          doAction: (context: ViewObjectContextMenuContext) => {
            const sceneObject = context.viewObject.sceneObject;
            const meshIds = sceneObject.meshes.map(m => m.id);
            const sceneModel = sceneObject.model;
            for (const meshId of meshIds) {
              const mesh = sceneModel.meshes[meshId];
              if (!mesh) {
                continue;
              }
              const result = palette.paintMaterial(mesh, entry.id);
              if (result.ok === false) {
                console.error(`[ViewObjectContextMenu] Change Material '${entry.id}' on mesh '${meshId}' failed:`, result.error);
              }
            }
          },
        })),
      ],
    }));
}

/**
 * Builds the trailing **Delete** group — destructive actions
 * placed last so the implicit group-separator above them acts as
 * a visual moat against accidental clicks. Two flat items rather
 * than a submenu so the click count stays low when the user
 * really wants to delete.
 */
function createViewObjectDeleteGroup() {
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
        // Defer to DemoHelper so the matching DataModel goes
        // away too — destroying just the SceneModel here would
        // leave its DataObjects hanging around in `Data` and
        // every panel that walks the data graph would still
        // show them.
        const id = context.viewObject.sceneObject.model.id;
        context.demoHelper.destroyModel(id);
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
  return context.collisionIndex.getCombinedObjectAABB(Object.keys(context.sceneModel.objects));
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
 * SVG markup for the Save-Screenshot menu glyph — a camera body
 * with a centred lens. Strokes use `currentColor`, so the
 * context menu's accent shows through.
 */
function screenshotIconSvg(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
    // Body shell.
    `<path d="M 4 8 H 8 L 9.5 6 H 14.5 L 16 8 H 20 A 1.5 1.5 0 0 1 21.5 9.5 V 17.5 A 1.5 1.5 0 0 1 20 19 H 4 A 1.5 1.5 0 0 1 2.5 17.5 V 9.5 A 1.5 1.5 0 0 1 4 8 Z" ` +
          `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
    // Lens.
    `<circle cx="12" cy="13.5" r="3.5" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
    // Lens highlight (small dot).
    `<circle cx="18.4" cy="10.4" r="0.6" fill="currentColor"/>` +
  `</svg>`;
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
