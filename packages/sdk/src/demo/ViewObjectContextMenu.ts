import {ContextMenu} from "../ui/contextmenu";
import {SceneHealthPanel} from "./sceneHealthPanel/SceneHealthPanel";
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
import {ViewObject} from "../viewer";
import {SceneCollisionIndex} from "../collision/bvh";
import {XGFExporter} from "../formats/xgf";
import {type CoordinateSystemParams, SceneModel, type SceneModelParams, SceneObject} from "../scene";
import {DataModel, type DataModelContentParams, DataObject} from "../data";
import {OBJExporter} from "../formats/obj";
import {MTLExporter} from "../formats/mtl";
import {DotBIMExporter} from "../formats/dotbim";
import {GLTFExporter} from "../formats/gltf";
import {saveBCFViewpoint} from "../bcf";
import {CameraFlightAnimation} from "../cameraflight";
import {DemoHelper} from "./DemoHelper";
import {WebGLRenderer} from "../webglrenderer";
import {
  DetailedRender,
  NavigationRender,
  OrthoProjectionType,
  PerspectiveProjectionType,
  RealisticRender
} from "../constants";
import {type AABB3} from "../math/boundaries";
import {IFCExporter} from "../formats/ifc";
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
   * @param _params Constructor params placeholder.
   */
  constructor(_params: {}) {
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
        // Inspect ▶ split by user intent: "I have a problem" lands
        // under Diagnose, "I want a fact" lands under Examine.
        // Viewer Configuration + Toolbar moved into View ▶ (they're
        // viewer settings, not inspections); Schema Materials moved
        // into Modify ▶ (it mutates).
        createViewObjectDiagnoseGroup(),
        createViewObjectExamineGroup(),
        [createViewObjectModifyGroup()],
        [createViewObjectViewGroup()],
        createViewObjectImportGroup(),
        createViewObjectExportGroup(),
        createViewObjectDeleteGroup(),
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
        // Inspect split — see ViewObjectContextMenu for rationale.
        [createCanvasDiagnoseGroup()],
        [createCanvasExamineGroup()],
        [createCanvasViewGroup()],
        createCanvasImportGroup(),
        createCanvasExportGroup(),
      ]
    });
  }
}

/**
 * Builds the **View** submenu — viewer / renderer settings the
 * user is most likely reaching for in a context menu: render
 * mode, camera projection, view lifecycle. Replaces the old
 * scattered set ("Render Mode" at top level, "View Settings",
 * "Create View", "Close View" each as separate top-level rows).
 */
function createViewObjectViewGroup() {
  return {
    getTitle: () => "View",
    items: [
      // Renderer / camera settings — the everyday toggles.
      [
        {
          getTitle: () => "Render Mode",
          items: [createRenderModeGroup()],
        },
        {
          getTitle: () => "Camera Projection",
          items: [createCameraProjectionGroup()],
        },
      ],
      // Viewer configuration panels (relocated from the old Inspect
      // submenu — these mutate viewer settings, so they belong with
      // the other View toggles).
      [
        {
          title: "Viewer Configuration",
          icon: ViewerConfigPanel.iconSvg(),
          doAction: (context: ViewObjectContextMenuContext) => {
            context.demoHelper.openViewerConfigPanel();
          }
        },
        {
          getTitle: (context: ViewObjectContextMenuContext) => {
            const tb = Toolbar.getFor(context.demoHelper.viewer);
            return tb && tb.visible ? "Hide Toolbar" : "Show Toolbar";
          },
          icon: Toolbar.iconSvg(),
          doAction: (context: ViewObjectContextMenuContext) => {
            context.demoHelper.toggleToolbar();
          }
        },
      ],
      // View lifecycle + low-level renderer actions (less common,
      // separated visually).
      [
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
            context.demoHelper.createView({camera: result.value});
          }
        },
        {
          getTitle: () => "Close View",
          doAction: (context: ViewObjectContextMenuContext) => {
            context.demoHelper.destroyView(context.view);
          }
        },
        {
          getTitle: () => "Lose WebGL Context",
          doAction: (context: ViewObjectContextMenuContext) => {
            loseWebGLContext(context.renderer);
          }
        },
      ],
    ],
  };
}

/** Canvas-side counterpart of {@link createViewObjectViewGroup}. */
function createCanvasViewGroup() {
  return {
    getTitle: () => "View",
    items: [
      [
        {
          getTitle: () => "Render Mode",
          items: [createRenderModeGroup()],
        },
        {
          getTitle: () => "Camera Projection",
          items: [createCameraProjectionGroup()],
        },
      ],
      [
        {
          title: "Viewer Configuration",
          icon: ViewerConfigPanel.iconSvg(),
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.openViewerConfigPanel();
          }
        },
        {
          getTitle: (context: CanvasContextMenuContext) => {
            const tb = Toolbar.getFor(context.demoHelper.viewer);
            return tb && tb.visible ? "Hide Toolbar" : "Show Toolbar";
          },
          icon: Toolbar.iconSvg(),
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.toggleToolbar();
          }
        },
      ],
      [
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
            context.demoHelper.createView({camera: result.value});
          }
        },
        {
          getTitle: () => "Close View",
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.destroyView(context.view);
          }
        },
        {
          getTitle: () => "Lose WebGL Context",
          doAction: (context: CanvasContextMenuContext) => {
            loseWebGLContext(context.renderer);
          }
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
 * Builds the **Diagnose** submenu — issue-finding workflows: the
 * Model Inspector, debug-viz panels (Scene Boundaries, GPU
 * Tiles), and the GPU Memory monitor. Cleanly separated from
 * **Examine** (read-only stats / JSON dumps) so the menu reads
 * as goal-paths: "I have a problem" → Diagnose, "I want a fact"
 * → Examine.
 */
function createViewObjectDiagnoseGroup() {
  return [
    {
      getTitle: () => "Diagnose",
      items: [
        [
          {
            title: "Scene Health",
            icon: SceneHealthPanel.iconSvg(),
            doAction: (context: ViewObjectContextMenuContext) => {
              // Pass the clicked object's SceneModel as initial
              // focus — the panel opens with that model selected
              // in the tab strip, even if it was previously
              // showing another model.
              context.demoHelper.getSceneHealthPanel(
                context.viewObject.sceneObject.model
              );
            }
          },
          {
            title: "Scene Boundaries",
            icon: BoundariesPanel.iconSvg(),
            doAction: (context: ViewObjectContextMenuContext) => {
              context.demoHelper.openBoundariesPanel();
            }
          },
          {
            title: "GPU Tiles",
            icon: TilesPanel.iconSvg(),
            doAction: (context: ViewObjectContextMenuContext) => {
              context.demoHelper.openTilesPanel();
            }
          },
          {
            title: "GPU Memory",
            icon: GPUMemoryPanel.iconSvg(),
            doAction: (context: ViewObjectContextMenuContext) => {
              context.demoHelper.getGPUMemoryPanel();
            }
          },
          {
            title: "Events",
            icon: EventsPanel.iconSvg(),
            doAction: (context: ViewObjectContextMenuContext) => {
              context.demoHelper.getEventsPanel();
            }
          },
        ],
      ]
    }
  ];
}

/**
 * Builds the **Examine** submenu — read-only "tell me about
 * this" surfaces: Scene / Data statistics, plus per-object JSON
 * dumps for the active SceneObject and matching DataObject.
 */
function createViewObjectExamineGroup() {
  return [
    {
      getTitle: () => "Examine",
      items: [
        [
          {
            title: "Explorer",
            icon: ExplorerPanel.iconSvg(),
            doAction: (context: ViewObjectContextMenuContext) => {
              context.demoHelper.getExplorer();
            }
          },
          {
            title: "Scene Statistics",
            icon: SceneStatsPanel.iconSvg(),
            doAction: (context: ViewObjectContextMenuContext) => {
              context.demoHelper.openSceneStatsPanel();
            }
          },
          {
            title: "Data Statistics",
            icon: DataStatsPanel.iconSvg(),
            doAction: (context: ViewObjectContextMenuContext) => {
              context.demoHelper.openDataStatsPanel();
            }
          },
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
 * Canvas-side **Diagnose** submenu — Scene Boundaries / GPU
 * Tiles / GPU Memory. Per-object Inspector is omitted (canvas
 * menu fires on empty space, no SceneModel context).
 */
function createCanvasDiagnoseGroup() {
  return {
    getTitle: () => "Diagnose",
    items: [
      [
        {
          title: "Scene Health",
          icon: SceneHealthPanel.iconSvg(),
          doAction: (context: CanvasContextMenuContext) => {
            // No specific SceneModel — the panel falls back to
            // its first loaded model (or empty state).
            context.demoHelper.getSceneHealthPanel();
          }
        },
        {
          title: "Scene Boundaries",
          icon: BoundariesPanel.iconSvg(),
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.openBoundariesPanel();
          }
        },
        {
          title: "GPU Tiles",
          icon: TilesPanel.iconSvg(),
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.openTilesPanel();
          }
        },
        {
          title: "GPU Memory",
          icon: GPUMemoryPanel.iconSvg(),
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.getGPUMemoryPanel();
          }
        },
        {
          title: "Events",
          icon: EventsPanel.iconSvg(),
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.getEventsPanel();
          }
        },
      ],
    ],
  };
}

/**
 * Canvas-side **Examine** submenu — Scene / Data statistics.
 * JSON dumps are dropped on the canvas variant (no specific
 * resource to serialise from an empty-space click).
 */
function createCanvasExamineGroup() {
  return {
    getTitle: () => "Examine",
    items: [
      [
        {
          title: "Explorer",
          icon: ExplorerPanel.iconSvg(),
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.getExplorer();
          }
        },
        {
          title: "Scene Statistics",
          icon: SceneStatsPanel.iconSvg(),
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.openSceneStatsPanel();
          }
        },
        {
          title: "Data Statistics",
          icon: DataStatsPanel.iconSvg(),
          doAction: (context: CanvasContextMenuContext) => {
            context.demoHelper.openDataStatsPanel();
          }
        },
      ],
    ],
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
 * Builds the view-object **Export** submenu — snapshots + a
 * nested "Export As" submenu for the six file formats. Three
 * levels deep but the file formats are similar enough that the
 * extra click is well worth the reduced clutter at the top
 * Export menu.
 */
function createViewObjectExportGroup() {
  return [
    {
      getTitle: () => "Export",
      items: [
        createSnapshotExportGroup(),
        [
          {
            getTitle: () => "Export As",
            items: [createFileExportGroup()],
          },
        ],
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
      title: "OBJ + MTL",
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
      title: "XGF",
      doAction: async (context: BaseViewContext) => {
        try {
          const fileData = await new XGFExporter().write(
            {
              sceneModel: context.sceneModel,
              dataModel: context.dataModel,
              version: "1.1.0"
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
      title: "glTF",
      doAction: async (context: BaseViewContext) => {
        try {
          const fileData = await new GLTFExporter().write(
            {
              sceneModel: context.sceneModel,
              dataModel: context.dataModel
            },
            {
              coordinateSystem: createExportCoordinateSystem()
            }
          );
          downloadBlob(fileData, `${context.sceneModel.id}.glb`, "model/gltf-binary");
        } catch (error) {
          console.error(error);
        }
      }
    },
    {
      title: "DotBIM",
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
      title: "IFC",
      doAction: async (context: BaseViewContext) => {
        try {
          const fileData = await new IFCExporter().write(
            {
              sceneModel: context.sceneModel,
              dataModel: context.dataModel
            },
            {
              coordinateSystem: createExportCoordinateSystem()
            }
          );
          downloadText(
            fileData,
            `${context.sceneModel.id}.ifc`,
            "application/text"
          );
        } catch (error) {
          console.error(error);
        }
      }
    },
    {
      title: "JSON",
      doAction: (context: BaseViewContext) => {
        downloadSceneAndDataJson(context);
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
