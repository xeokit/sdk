import type {SceneModel} from "../../model/scene";
import type {DataModel} from "../../model/data";
import type {View} from "../../viewing/viewer";
import type {DataFormatSchema} from "../../inspect/dataModel";
import {getGlobalTaskRunner} from "../../base/core";

import {ModelsPanel} from "./modelsPanel/ModelsPanel";
import {SceneHealthPanel} from "./sceneHealthPanel/SceneHealthPanel";
import {DataHealthPanel} from "./dataHealthPanel/DataHealthPanel";
import {BoundariesPanel} from "./boundariesPanel/BoundariesPanel";
import {TilesPanel} from "./tilesPanel/TilesPanel";
import {SceneStatsPanel} from "./sceneStats/SceneStatsPanel";
import {DataStatsPanel} from "./dataStats/DataStatsPanel";
import {SampleModelsPanel} from "./sampleModelsPanel/SampleModelsPanel";
import {SchemaMaterialsPanel} from "./schemaMaterialsPanel/SchemaMaterialsPanel";
import {ViewerConfigPanel} from "./viewerPanel/ViewerConfigPanel";
import {GPUMemoryPanel} from "./gpuMemoryUsage/GPUMemoryUsage";
import {Toolbar} from "./toolbar/Toolbar";
import {ExportDialog} from "./exportDialog/ExportDialog";
import {ExportBCFPanel} from "./exportBCF/ExportBCFPanel";
import {ExplorerPanel} from "./explorerPanel/ExplorerPanel";
import {IssuesPanel} from "./issuesPanel/IssuesPanel";
import {TasksPanel} from "./tasksPanel/TasksPanel";
import {ShadersPanel} from "./shadersPanel/ShadersPanel";
import {DataTexturesPanel} from "./dataTexturesPanel/DataTexturesPanel";
import {CameraTourPanel} from "./cameraTour/CameraTourPanel";
import {DrawingsPanel} from "./drawings/DrawingsPanel";
import {RendererPanel} from "./rendererPanel/RendererPanel";
import {CullingPanel} from "./cullingPanel/CullingPanel";
import {AdaptiveQualityPanel} from "./adaptiveQualityPanel/AdaptiveQualityPanel";
import {PdfImportPanel} from "./pdfImport/PdfImportPanel";
import {NavCube} from "./navCube/NavCube";
import type {NavCubeParams} from "./navCube/NavCubeParams";
import {DistanceMeasurementsPanel} from "./distanceMeasurementsPanel/DistanceMeasurementsPanel";
import {AngleMeasurementsPanel} from "./angleMeasurementsPanel/AngleMeasurementsPanel";
import {SectionPlanesPanel} from "./sectionPlanesPanel/SectionPlanesPanel";
import {SchedulePanel} from "./schedulePanel/SchedulePanel";
import type {SchedulePlayer} from "../../presentations/schedule";
import {SunStudyPanel} from "./sunStudyPanel/SunStudyPanel";
import {SunStudy, type AnnualSunPlayer} from "../../presentations/sunStudy";
import {DaylightAnalysisPanel} from "./daylightAnalysisPanel/DaylightAnalysisPanel";
import {VolumeOverlayPanel} from "./volumeOverlayPanel/VolumeOverlayPanel";
import type {VoxelGrid, VectorGrid, SliceAxis} from "../../presentations/volumeOverlay";
import {makeDemoScalarField, makeDemoVectorField} from "../../presentations/volumeOverlay";
import type {AnalysisGrid, SkyModel} from "../../presentations/daylightAnalysis";
import type {Scene} from "../../model/scene";

import {DistanceMeasurementTool} from "../../tools/measurements/distance/DistanceMeasurementTool";
import type {DistanceMeasurementToolParams} from "../../tools/measurements/distance/DistanceMeasurementToolParams";
import {AngleMeasurementsTool} from "../../tools/measurements/angle/AngleMeasurementsTool";
import type {AngleMeasurementsToolParams} from "../../tools/measurements/angle/AngleMeasurementsToolParams";
import {TransformControls} from "../../viewing/transformControls";
import type {TransformControlsParams} from "../../viewing/transformControls";
import {asWebGLRenderer} from "./resolveWebGLRenderer";

import type {PanelRegistry, PanelContext} from "./PanelRegistry";

declare module "./PanelRegistry" {
  interface PanelMap {
    modelsPanel:               {panel: ModelsPanel;                params: void};
    sceneHealth:               {panel: SceneHealthPanel;           params: {focusSceneModel?: SceneModel; initialTop?: number; initialRight?: number}};
    dataHealth:                {panel: DataHealthPanel;            params: {focusDataModel?: DataModel; schema?: DataFormatSchema; initialTop?: number; initialRight?: number}};
    boundariesPanel:           {panel: BoundariesPanel;            params: void};
    tilesPanel:                {panel: TilesPanel;                 params: void};
    sceneStats:                {panel: SceneStatsPanel;            params: void};
    dataStats:                 {panel: DataStatsPanel;             params: void};
    tasksPanel:                {panel: TasksPanel;                 params: void};
    shadersPanel:              {panel: ShadersPanel;               params: void};
    dataTexturesPanel:         {panel: DataTexturesPanel;          params: void};
    drawingsPanel:             {panel: DrawingsPanel;              params: void};
    cameraTourPanel:           {panel: CameraTourPanel;            params: void};
    exportDialog:              {panel: ExportDialog;               params: void};
    exportBCFPanel:            {panel: ExportBCFPanel;             params: void};
    explorerPanel:             {panel: ExplorerPanel;              params: void};
    issuesPanel:               {panel: IssuesPanel;                params: void};
    toolbar:                   {panel: Toolbar;                    params: void};
    viewerConfig:              {panel: ViewerConfigPanel;          params: void};
    gpuMemory:                 {panel: GPUMemoryPanel;             params: void};
    rendererPanel:             {panel: RendererPanel;              params: void};
    cullingPanel:              {panel: CullingPanel;               params: void};
    adaptiveQualityPanel:      {panel: AdaptiveQualityPanel;       params: void};
    pdfImport:                 {panel: PdfImportPanel;             params: void};
    schemaMaterials:           {panel: SchemaMaterialsPanel;       params: {focusSceneModel?: SceneModel}};
    sampleModels:              {panel: SampleModelsPanel;          params: void};

    // per-player entry — `params.player` mandatory, since the panel
    // is two-way-bound to a SchedulePlayer that the application
    // constructed earlier.
    schedulePanel:             {panel: SchedulePanel;              params: {player: SchedulePlayer; title?: string; x?: number; y?: number; storageKey?: string}};

    // per-sun-study entry — `params.sunStudy` mandatory; `player`
    // optional (without it the panel is scrub-only).
    sunStudyPanel:             {panel: SunStudyPanel;              params: {sunStudy: SunStudy; player?: AnnualSunPlayer}};

    // per-sun-study + scene entry — the analysis raycasts the scene
    // for occluders, so it needs the Scene as well as the SunStudy.
    daylightAnalysisPanel:     {panel: DaylightAnalysisPanel;      params: {sunStudy: SunStudy; scene: Scene; initialGrid?: AnalysisGrid; initialYear?: number; initialDaysPerYear?: number; initialHoursPerDay?: number; initialSkyModel?: SkyModel}};

    // per-VoxelGrid entry — slice-plane visualisation of a 3D
    // scalar field. The panel takes the grid by reference, the
    // scene as the SceneModel host. No application-side setup
    // is mandatory: there's no toolbar button for this one (yet),
    // and creating one without a grid wouldn't have anything to
    // visualise.
    volumeOverlayPanel:        {panel: VolumeOverlayPanel;         params: {grid: VoxelGrid; vectorGrid?: VectorGrid; scene: Scene; initialTechnique?: "slice" | "isosurface" | "streamlines"; initialAxis?: SliceAxis; initialPosition?: number; initialIsovalue?: number; initialColormap?: string; initialSeedDensity?: number}};

    // per-view entries — `params.view` mandatory
    navCube:                   {panel: NavCube;                    params: {view: View} & Partial<NavCubeParams>};
    distanceMeasurements:      {panel: DistanceMeasurementTool;    params: {view: View} & Partial<DistanceMeasurementToolParams>};
    distanceMeasurementsPanel: {panel: DistanceMeasurementsPanel;  params: {view: View}};
    angleMeasurements:         {panel: AngleMeasurementsTool;      params: {view: View} & Partial<AngleMeasurementsToolParams>};
    angleMeasurementsPanel:    {panel: AngleMeasurementsPanel;     params: {view: View}};
    sectionPlanesPanel:        {panel: SectionPlanesPanel;         params: {view: View}};
    transformControls:         {panel: TransformControls;          params: {view: View} & Partial<TransformControlsParams>};
  }
}

/**
 * Returns the first live View in the Studio's ViewManager, or
 * `undefined` if none exist yet. Used by the Toolbar-cold-start
 * path of `sunStudyPanel` / `daylightAnalysisPanel` to pick a
 * View to attach an auto-constructed SunStudy to.
 */
function firstView(ctx: PanelContext): View | undefined {
  const views = ctx.studio.viewManager?.views;
  if (!views) return undefined;
  for (const id in views) {
    const rec = views[id];
    if (rec?.view) return rec.view;
  }
  return undefined;
}


/**
 * Registers every built-in panel and tool with the supplied registry.
 * Called by Studio's constructor; SDK consumers who want a slimmer
 * panel surface can construct their own {@link PanelRegistry} and
 * register a subset (or none) instead.
 */
export function registerBuiltinPanels(registry: PanelRegistry): void {

  // ── plain panels keyed off Studio components ────────────────────────────

  registry.register("modelsPanel", {
    find:   (ctx)         => ModelsPanel.getFor(ctx.studio),
    create: (ctx)         => ModelsPanel.openFor({studio: ctx.studio}),
  });

  registry.register("sceneHealth", {
    find:   (ctx)         => SceneHealthPanel.getFor(ctx.studio.scene),
    create: (ctx, params) => SceneHealthPanel.openFor({
      scene:            ctx.studio.scene,
      focusSceneModel:  params?.focusSceneModel,
      initialTop:       params?.initialTop,
      initialRight:     params?.initialRight,
      view:             ctx.studio.viewer?.viewList?.[0],
      studio:           ctx.studio,
    }),
    onReveal: (panel, _ctx, params) => {
      if (params?.focusSceneModel) panel.focusModel(params.focusSceneModel);
    },
  });

  registry.register("dataHealth", {
    find:   (ctx)         => DataHealthPanel.getFor(ctx.studio.data),
    create: (ctx, params) => DataHealthPanel.openFor({
      data:             ctx.studio.data,
      focusDataModel:   params?.focusDataModel,
      schema:           params?.schema,
      initialTop:       params?.initialTop,
      initialRight:     params?.initialRight,
    }),
    onReveal: (panel, _ctx, params) => {
      if (params?.focusDataModel) panel.focusModel(params.focusDataModel);
    },
  });

  registry.register("boundariesPanel", {
    find: (ctx) => BoundariesPanel.getFor(ctx.studio.scene),
    create: (ctx) => {
      const view = ctx.studio.viewer?.viewList?.[0];
      if (!view) {
        ctx.studio.reportWarning("[PanelRegistry/boundariesPanel] No View available — needs a View for the camera-pose pointer.");
        return undefined;
      }
      // CameraFlight is owned by the View's ViewRecord, not the
      // View itself — pass it through explicitly so the panel's
      // click-to-jump uses the cinematic flyTo path instead of
      // falling back to an instant cam.eye / cam.look snap.
      const cameraFlight = ctx.studio.viewManager?.views?.[view.id]?.cameraFlight;
      return BoundariesPanel.openFor({scene: ctx.studio.scene, view, cameraFlight});
    },
  });

  registry.register("tilesPanel", {
    find: (ctx) => asWebGLRenderer(ctx.studio.renderer) ? TilesPanel.getFor(ctx.studio.scene) : undefined,
    create: (ctx) => {
      const view = ctx.studio.viewer?.viewList?.[0];
      if (!view) {
        ctx.studio.reportWarning("[PanelRegistry/tilesPanel] No View available — needs a View for the camera-pose pointer.");
        return undefined;
      }
      const webGLRenderer = asWebGLRenderer(ctx.studio.renderer);
      if (!webGLRenderer) {
        ctx.studio.reportWarning("[PanelRegistry/tilesPanel] Requires WebGLRenderer.");
        return undefined;
      }
      const inspectorRes = webGLRenderer.getRenderInspector();
      if (inspectorRes.ok === false) {
        ctx.studio.reportWarning(`[PanelRegistry/tilesPanel] Renderer doesn't expose a RenderInspector:: ${inspectorRes.error}`);
        return undefined;
      }
      inspectorRes.value.enabled = true;
      return TilesPanel.openFor({
        renderStats: inspectorRes.value.renderStats,
        scene:       ctx.studio.scene,
        view,
      });
    },
  });

  registry.register("sceneStats", {
    find:   (ctx) => SceneStatsPanel.getFor(ctx.studio.scene),
    create: (ctx) => SceneStatsPanel.openFor({scene: ctx.studio.scene}),
  });

  registry.register("dataStats", {
    find:   (ctx) => DataStatsPanel.getFor(ctx.studio.data),
    create: (ctx) => DataStatsPanel.openFor({data: ctx.studio.data}),
  });

  registry.register("tasksPanel", {
    find:   ()    => TasksPanel.getFor(getGlobalTaskRunner()),
    create: ()    => TasksPanel.openFor({runner: getGlobalTaskRunner()}),
  });

  registry.register("shadersPanel", {
    find: (ctx) => {
      const webGLRenderer = asWebGLRenderer(ctx.studio.renderer);
      if (!webGLRenderer) return undefined;
      const res = webGLRenderer.getShaderInspector();
      return res.ok ? ShadersPanel.getFor(res.value) : undefined;
    },
    create: (ctx) => {
      const webGLRenderer = asWebGLRenderer(ctx.studio.renderer);
      if (!webGLRenderer) {
        ctx.studio.reportWarning("[PanelRegistry/shadersPanel] Requires WebGLRenderer.");
        return undefined;
      }
      const res = webGLRenderer.getShaderInspector();
      if (res.ok === false) {
        ctx.studio.reportWarning(`[PanelRegistry/shadersPanel] Renderer doesn't expose a ShaderInspector:: ${res.error}`);
        return undefined;
      }
      return ShadersPanel.openFor({inspector: res.value});
    },
  });

  registry.register("dataTexturesPanel", {
    find: (ctx) => {
      const webGLRenderer = asWebGLRenderer(ctx.studio.renderer);
      if (!webGLRenderer) return undefined;
      const res = webGLRenderer.getMemoryInspector();
      if (res.ok === false) return undefined;
      const dt = res.value.gpuResources ?? res.value.dataTextures;
      return dt ? DataTexturesPanel.getFor(dt) : undefined;
    },
    create: (ctx) => {
      const webGLRenderer = asWebGLRenderer(ctx.studio.renderer);
      if (!webGLRenderer) {
        ctx.studio.reportWarning("[PanelRegistry/dataTexturesPanel] Requires WebGLRenderer.");
        return undefined;
      }
      const res = webGLRenderer.getMemoryInspector();
      if (res.ok === false) {
        ctx.studio.reportWarning(`[PanelRegistry/dataTexturesPanel] Renderer doesn't expose a MemoryInspector:: ${res.error}`);
        return undefined;
      }
      const dt = res.value.gpuResources ?? res.value.dataTextures;
      if (!dt) {
        ctx.studio.reportWarning("[PanelRegistry/dataTexturesPanel] MemoryInspector has no GPU resources bundle.");
        return undefined;
      }
      return DataTexturesPanel.openFor({dataTextures: dt});
    },
  });

  registry.register("drawingsPanel", {
    find:   (ctx) => DrawingsPanel.getFor(ctx.studio),
    create: (ctx) => DrawingsPanel.openFor({studio: ctx.studio}),
  });

  registry.register("cameraTourPanel", {
    find:   (ctx) => CameraTourPanel.getFor(ctx.studio),
    create: (ctx) => CameraTourPanel.openFor({studio: ctx.studio}),
  });

  registry.register("exportDialog", {
    find:   (ctx) => ExportDialog.getFor(ctx.studio),
    create: (ctx) => ExportDialog.openFor({studio: ctx.studio}),
  });

  registry.register("exportBCFPanel", {
    find: (ctx) => {
      const view = ctx.studio.viewer?.viewList?.[0];
      return view ? ExportBCFPanel.getFor(view) : undefined;
    },
    create: (ctx) => {
      const view = ctx.studio.viewer?.viewList?.[0];
      if (!view) {
        ctx.studio.reportWarning("[PanelRegistry/exportBCFPanel] No View available — BCF export needs a View to capture state from.");
        return undefined;
      }
      return ExportBCFPanel.openFor({view, renderer: ctx.studio.renderer});
    },
  });

  registry.register("explorerPanel", {
    find:   (ctx) => ExplorerPanel.getFor(ctx.studio.data),
    create: (ctx) => {
      const view = ctx.studio.viewer?.viewList?.[0];
      if (!view) {
        ctx.studio.reportWarning("[PanelRegistry/explorerPanel] No View available — Explorer needs a View for visibility checkboxes.");
        return undefined;
      }
      const cameraFlight = ctx.studio.viewManager.views?.[view.id]?.cameraFlight;
      return ExplorerPanel.openFor({data: ctx.studio.data, view, cameraFlight});
    },
  });

  registry.register("issuesPanel", {
    find:   (ctx) => ctx.studio.viewer ? IssuesPanel.getFor(ctx.studio.viewer) : undefined,
    create: (ctx) => {
      const {viewer, scene, data, renderer} = ctx.studio;
      if (!viewer || !scene || !data || !renderer) {
        ctx.studio.reportError(
          "[PanelRegistry/issuesPanel] Studio not fully initialised yet — " +
          "Viewer/Scene/Data/renderer must exist.",
        );
        return undefined;
      }
      return IssuesPanel.openFor({
        viewer, scene, data, renderer,
        studioEvents: ctx.studio.events,
        visible: true,
      });
    },
  });

  registry.register("toolbar", {
    find:   (ctx) => Toolbar.getFor(ctx.studio.viewer),
    // Initial mount starts hidden — only the reopen pill in the
    // bottom-right rail is visible by default. Subsequent
    // `panels.open("toolbar")` calls (from menus, hotkeys, etc.)
    // hit the existing-instance branch in `PanelRegistry.open` and
    // call `show()` as expected, so this only changes first-mount
    // behaviour. The user clicks the pill to reveal the toolbar.
    create: (ctx) => Toolbar.openFor({viewer: ctx.studio.viewer, studio: ctx.studio, visible: false}),
  });

  registry.register("viewerConfig", {
    find:   (ctx) => ViewerConfigPanel.getFor(ctx.studio.viewer),
    create: (ctx) => ViewerConfigPanel.openFor({viewer: ctx.studio.viewer, studio: ctx.studio}),
  });

  registry.register("gpuMemory", {
    find: (ctx) => {
      const webGLRenderer = asWebGLRenderer(ctx.studio.renderer);
      return webGLRenderer ? GPUMemoryPanel.getFor(ctx.studio.renderer) : undefined;
    },
    create: (ctx) => {
      if (!asWebGLRenderer(ctx.studio.renderer)) {
        ctx.studio.reportWarning("[PanelRegistry/gpuMemory] Requires WebGLRenderer.");
        return undefined;
      }
      return GPUMemoryPanel.openFor({renderer: ctx.studio.renderer});
    },
  });

  registry.register("rendererPanel", {
    find: (ctx) => {
      const webGLRenderer = asWebGLRenderer(ctx.studio.renderer);
      return webGLRenderer ? RendererPanel.getFor(ctx.studio.renderer) : undefined;
    },
    create: (ctx) => {
      if (!asWebGLRenderer(ctx.studio.renderer)) {
        ctx.studio.reportWarning("[PanelRegistry/rendererPanel] Requires WebGLRenderer.");
        return undefined;
      }
      return RendererPanel.openFor({renderer: ctx.studio.renderer});
    },
  });

  registry.register("cullingPanel", {
    find: (ctx) => ctx.studio.viewer && asWebGLRenderer(ctx.studio.renderer) ? CullingPanel.getFor(ctx.studio.viewer) : undefined,
    create: (ctx) => {
      const {viewer, renderer} = ctx.studio;
      if (!viewer || !renderer) {
        ctx.studio.reportWarning("[PanelRegistry/cullingPanel] Needs a Viewer and WebGLRenderer.");
        return undefined;
      }
      if (!asWebGLRenderer(renderer)) {
        ctx.studio.reportWarning("[PanelRegistry/cullingPanel] Requires WebGLRenderer.");
        return undefined;
      }
      return CullingPanel.openFor({viewer, renderer});
    },
  });

  registry.register("adaptiveQualityPanel", {
    find: (ctx) => ctx.studio.viewer && asWebGLRenderer(ctx.studio.renderer) ? AdaptiveQualityPanel.getFor(ctx.studio.viewer) : undefined,
    create: (ctx) => {
      const {viewer, renderer} = ctx.studio;
      if (!viewer || !renderer) {
        ctx.studio.reportWarning("[PanelRegistry/adaptiveQualityPanel] Needs a Viewer and WebGLRenderer.");
        return undefined;
      }
      if (!asWebGLRenderer(renderer)) {
        ctx.studio.reportWarning("[PanelRegistry/adaptiveQualityPanel] Requires WebGLRenderer.");
        return undefined;
      }
      return AdaptiveQualityPanel.openFor({viewer, renderer});
    },
  });

  registry.register("pdfImport", {
    find:   (ctx) => PdfImportPanel.getFor(ctx.studio),
    create: (ctx) => PdfImportPanel.openFor({studio: ctx.studio}),
  });

  registry.register("schemaMaterials", {
    find:   (ctx) => SchemaMaterialsPanel.getFor(ctx.studio.scene),
    create: (ctx, params) => SchemaMaterialsPanel.openFor({
      scene:           ctx.studio.scene,
      data:            ctx.studio.data,
      focusSceneModel: params?.focusSceneModel,
    }),
    onReveal: (panel, _ctx, params) => {
      if (params?.focusSceneModel && !params.focusSceneModel.destroyed) {
        panel.focusModel(params.focusSceneModel);
      }
    },
  });

  registry.register("sampleModels", {
    find:   (ctx) => SampleModelsPanel.getFor(ctx.studio),
    create: (ctx) => SampleModelsPanel.openFor({studio: ctx.studio}),
  });

  // ── per-player panel ────────────────────────────────────────────────────
  //
  // SchedulePanel is two-way-bound to a SchedulePlayer the application
  // constructed earlier — Studio doesn't own the player, so the
  // registry can't synthesise one. Callers must pass `params.player`;
  // the panel's per-player WeakMap registry handles idempotence.
  registry.register("schedulePanel", {
    find: (_ctx, params) => params?.player
      ? SchedulePanel.getFor(params.player)
      : undefined,
    create: (ctx, params) => {
      if (!params?.player) {
        ctx.studio.reportWarning("[PanelRegistry/schedulePanel] missing required params.player");
        return undefined;
      }
      return SchedulePanel.openFor({
        player:     params.player,
        title:      params.title,
        x:          params.x,
        y:          params.y,
        storageKey: params.storageKey,
      });
    },
  });

  // Same per-SunStudy contract — the panel is two-way bound to a
  // SunStudy the application constructed; Studio can't synthesise
  // one because it'd need the site coordinates. Optional `player`
  // unlocks the play/pause/mode chrome.
  registry.register("sunStudyPanel", {
    // `find` falls back to the latest-opened panel when no
    // sunStudy is in params — that's the Toolbar "Sun Study"
    // button toggling whichever panel the application has
    // already set up. With a sunStudy in params, find the
    // specific per-SunStudy instance as usual.
    find: (_ctx, params) => params?.sunStudy
      ? SunStudyPanel.getFor(params.sunStudy)
      : SunStudyPanel.getLatest(),
    create: (ctx, params) => {
      // Cold-start fallback chain:
      //   params.sunStudy → existing SunStudy.getLatest() → auto-
      //   construct a default one on the first available View.
      // The auto-construct path lets the Toolbar's Sun Study button
      // open the panel from a completely cold scene, with no
      // application-side SunStudy setup required. Defaults to
      // Greenwich (51.48°N, 0°) — a recognisable solar-reference
      // site — and the SunStudy's own default solstice-noon cursor.
      // Both are user-editable through the panel inputs.
      let sunStudy = params?.sunStudy ?? SunStudy.getLatest();
      if (!sunStudy) {
        const view = firstView(ctx);
        if (!view) {
          ctx.studio.reportWarning(
            "[PanelRegistry/sunStudyPanel] No View available to attach a SunStudy to. " +
            "Create a View first (e.g. `studio.viewManager.createView({...})`)."
          );
          return undefined;
        }
        sunStudy = new SunStudy({
          view,
          latitude:  51.48,
          longitude: 0,
        });
      }
      return SunStudyPanel.openFor({sunStudy, player: params?.player});
    },
  });

  // The daylight-analysis panel is also per-SunStudy (it derives the
  // site location from there), and additionally takes the Scene as
  // the source of occluder geometry for the raycast pass. Application
  // supplies both — Studio doesn't know which Scene the caller wants
  // to analyse against.
  registry.register("daylightAnalysisPanel", {
    // Same latest-fallback shape as sunStudyPanel — lets the
    // Toolbar's Daylight Analysis button toggle whichever panel
    // the application has already set up, without needing to
    // carry direct SunStudy / Scene references through the Toolbar.
    find: (_ctx, params) => params?.sunStudy
      ? DaylightAnalysisPanel.getFor(params.sunStudy)
      : DaylightAnalysisPanel.getLatest(),
    create: (ctx, params) => {
      // Same cold-start fallback chain as `sunStudyPanel` above:
      //   params.sunStudy → SunStudy.getLatest() → auto-construct
      //   on the first View with Greenwich defaults. Scene falls
      //   back to the Studio's own. Both paths make the Toolbar
      //   "Daylight Analysis" button work from a completely cold
      //   scene with zero application-side setup.
      const scene = params?.scene ?? ctx.studio.scene;
      if (!scene) {
        ctx.studio.reportWarning("[PanelRegistry/daylightAnalysisPanel] No Scene available.");
        return undefined;
      }
      let sunStudy = params?.sunStudy ?? SunStudy.getLatest();
      if (!sunStudy) {
        const view = firstView(ctx);
        if (!view) {
          ctx.studio.reportWarning(
            "[PanelRegistry/daylightAnalysisPanel] No View available to attach a SunStudy to. " +
            "Create a View first (e.g. `studio.viewManager.createView({...})`)."
          );
          return undefined;
        }
        sunStudy = new SunStudy({
          view,
          latitude:  51.48,
          longitude: 0,
        });
      }
      return DaylightAnalysisPanel.openFor({
        sunStudy,
        scene,
        initialGrid:         params?.initialGrid,
        initialYear:         params?.initialYear,
        initialDaysPerYear:  params?.initialDaysPerYear,
        initialHoursPerDay:  params?.initialHoursPerDay,
        initialSkyModel:     params?.initialSkyModel,
      });
    },
  });

  // The volume-overlay panel is per-VoxelGrid (it takes a direct
  // reference to the field) and per-Scene (to host the slice
  // SceneModel). No cold-start fallback path — there's nothing
  // for the panel to visualise without a grid, so the application
  // must always pass one.
  registry.register("volumeOverlayPanel", {
    find: (_ctx, params) => params?.grid
      ? VolumeOverlayPanel.getFor(params.grid)
      : VolumeOverlayPanel.getLatest(),
    create: (ctx, params) => {
      const scene = params?.scene ?? ctx.studio.scene;
      if (!scene) {
        ctx.studio.reportWarning("[PanelRegistry/volumeOverlayPanel] No Scene available.");
        return undefined;
      }
      // Cold-start fallback: when no `grid` was supplied, synthesise
      // a demo thermal field (+ matching natural-convection vector
      // field) covering the scene's AABB. The toolbar uses this path
      // so a click on "Volume Overlay" always produces something
      // visible, even when the application hasn't set up a real
      // CFD result. Padded slightly outside the scene's bounds so
      // the field surrounds the model rather than clipping it.
      let grid       = params?.grid;
      let vectorGrid = params?.vectorGrid;
      if (!grid) {
        const aabb = ctx.studio.picking?.collisionIndex?.getSceneAABB?.();
        const pad  = 3;
        const min: [number, number, number] = aabb
          ? [aabb[0] - pad, aabb[1] - pad, aabb[2]]
          : [-10, -10,  0];
        const max: [number, number, number] = aabb
          ? [aabb[3] + pad, aabb[4] + pad, aabb[5] + pad]
          : [ 10,  10, 10];
        grid       = makeDemoScalarField(min, max);
        vectorGrid = vectorGrid ?? makeDemoVectorField(min, max);
        console.info(
          "[PanelRegistry/volumeOverlayPanel] No grid supplied — opened with a demo " +
          "thermal field + convection vectors over the scene AABB. Pass `grid` and " +
          "`vectorGrid` to `studio.panels.open(\"volumeOverlayPanel\", …)` to visualise real data."
        );
      }
      return VolumeOverlayPanel.openFor({
        grid,
        vectorGrid,
        scene,
        studio:             ctx.studio,
        initialTechnique:   params?.initialTechnique,
        initialAxis:        params?.initialAxis,
        initialPosition:    params?.initialPosition,
        initialIsovalue:    params?.initialIsovalue,
        initialColormap:    params?.initialColormap,
        initialSeedDensity: params?.initialSeedDensity,
      });
    },
  });

  // ── per-view panels / tools ─────────────────────────────────────────────

  registry.register("navCube", {
    find:   (_ctx, params) => NavCube.getFor(params.view),
    create: (ctx, params)  => NavCube.openFor({
      view:         params.view,
      cameraFlight: ctx.studio.viewManager.views?.[params.view.id]?.cameraFlight,
      ...params,
    }),
  });

  registry.register("distanceMeasurements", {
    find:   (_ctx, params) => DistanceMeasurementTool.getFor(params.view),
    create: (ctx, params)  => DistanceMeasurementTool.openFor({
      view:   params.view,
      picker: ctx.studio.picking.picker,
      ...params,
    }),
  });

  registry.register("distanceMeasurementsPanel", {
    find:   (_ctx, params) => DistanceMeasurementsPanel.getFor(params.view),
    create: (ctx,  params) => {
      // Ensure the underlying tool exists so wires + side panel land in one call.
      const tool = ctx.studio.panels.open("distanceMeasurements", {view: params.view});
      if (!tool) return undefined;
      return DistanceMeasurementsPanel.openFor({tool});
    },
  });

  registry.register("angleMeasurements", {
    find:   (_ctx, params) => AngleMeasurementsTool.getFor(params.view),
    create: (ctx, params)  => AngleMeasurementsTool.openFor({
      view:   params.view,
      picker: ctx.studio.picking.picker,
      ...params,
    }),
  });

  registry.register("angleMeasurementsPanel", {
    find:   (_ctx, params) => AngleMeasurementsPanel.getFor(params.view),
    create: (ctx,  params) => {
      const tool = ctx.studio.panels.open("angleMeasurements", {view: params.view});
      if (!tool) return undefined;
      return AngleMeasurementsPanel.openFor({tool});
    },
  });

  registry.register("sectionPlanesPanel", {
    find:   (_ctx, params) => SectionPlanesPanel.getFor(params.view),
    create: (_ctx, params) => SectionPlanesPanel.openFor({view: params.view}),
  });

  registry.register("transformControls", {
    find:   (_ctx, params) => TransformControls.getFor(params.view),
    create: (ctx,  params) => TransformControls.openFor({
      view:           params.view,
      picker:         ctx.studio.picking.picker,
      viewController: (ctx.studio.viewManager.views as any)?.[params.view.id]?.viewController,
      ...params,
    }),
  });
}
