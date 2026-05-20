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
import {DrawingsPanel} from "./drawings/DrawingsPanel";
import {RendererPanel} from "./rendererPanel/RendererPanel";
import {NavCube} from "./navCube/NavCube";
import type {NavCubeParams} from "./navCube/NavCubeParams";
import {DistanceMeasurementsPanel} from "./distanceMeasurementsPanel/DistanceMeasurementsPanel";
import {AngleMeasurementsPanel} from "./angleMeasurementsPanel/AngleMeasurementsPanel";
import {SectionPlanesPanel} from "./sectionPlanesPanel/SectionPlanesPanel";

import {DistanceMeasurementTool} from "../../tools/measurements/distance/DistanceMeasurementTool";
import type {DistanceMeasurementToolParams} from "../../tools/measurements/distance/DistanceMeasurementToolParams";
import {AngleMeasurementsTool} from "../../tools/measurements/angle/AngleMeasurementsTool";
import type {AngleMeasurementsToolParams} from "../../tools/measurements/angle/AngleMeasurementsToolParams";
import {TransformControls} from "../../viewing/transformControls";
import type {TransformControlsParams} from "../../viewing/transformControls";

import type {PanelRegistry} from "./PanelRegistry";

declare module "./PanelRegistry" {
  interface PanelMap {
    modelsPanel:               {panel: ModelsPanel;                params: void};
    sceneHealth:               {panel: SceneHealthPanel;           params: {focusSceneModel?: SceneModel}};
    dataHealth:                {panel: DataHealthPanel;            params: {focusDataModel?: DataModel; schema?: DataFormatSchema}};
    boundariesPanel:           {panel: BoundariesPanel;            params: void};
    tilesPanel:                {panel: TilesPanel;                 params: void};
    sceneStats:                {panel: SceneStatsPanel;            params: void};
    dataStats:                 {panel: DataStatsPanel;             params: void};
    tasksPanel:                {panel: TasksPanel;                 params: void};
    shadersPanel:              {panel: ShadersPanel;               params: void};
    dataTexturesPanel:         {panel: DataTexturesPanel;          params: void};
    drawingsPanel:             {panel: DrawingsPanel;              params: void};
    exportDialog:              {panel: ExportDialog;               params: void};
    exportBCFPanel:            {panel: ExportBCFPanel;             params: void};
    explorerPanel:             {panel: ExplorerPanel;              params: void};
    issuesPanel:               {panel: IssuesPanel;                params: void};
    toolbar:                   {panel: Toolbar;                    params: void};
    viewerConfig:              {panel: ViewerConfigPanel;          params: void};
    gpuMemory:                 {panel: GPUMemoryPanel;             params: void};
    rendererPanel:             {panel: RendererPanel;              params: void};
    schemaMaterials:           {panel: SchemaMaterialsPanel;       params: {focusSceneModel?: SceneModel}};
    sampleModels:              {panel: SampleModelsPanel;          params: void};

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
        console.warn("[PanelRegistry/boundariesPanel] No View available — needs a View for the camera-pose pointer.");
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
    find: (ctx) => TilesPanel.getFor(ctx.studio.scene),
    create: (ctx) => {
      const view = ctx.studio.viewer?.viewList?.[0];
      if (!view) {
        console.warn("[PanelRegistry/tilesPanel] No View available — needs a View for the camera-pose pointer.");
        return undefined;
      }
      const inspectorRes = ctx.studio.renderer.getRenderInspector();
      if (inspectorRes.ok === false) {
        console.warn("[PanelRegistry/tilesPanel] Renderer doesn't expose a RenderInspector:", inspectorRes.error);
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
      const res = ctx.studio.renderer.getShaderInspector();
      return res.ok ? ShadersPanel.getFor(res.value) : undefined;
    },
    create: (ctx) => {
      const res = ctx.studio.renderer.getShaderInspector();
      if (res.ok === false) {
        console.warn("[PanelRegistry/shadersPanel] Renderer doesn't expose a ShaderInspector:", res.error);
        return undefined;
      }
      return ShadersPanel.openFor({inspector: res.value});
    },
  });

  registry.register("dataTexturesPanel", {
    find: (ctx) => {
      const res = ctx.studio.renderer.getMemoryInspector();
      if (res.ok === false) return undefined;
      const dt = res.value.dataTextures;
      return dt ? DataTexturesPanel.getFor(dt) : undefined;
    },
    create: (ctx) => {
      const res = ctx.studio.renderer.getMemoryInspector();
      if (res.ok === false) {
        console.warn("[PanelRegistry/dataTexturesPanel] Renderer doesn't expose a MemoryInspector:", res.error);
        return undefined;
      }
      const dt = res.value.dataTextures;
      if (!dt) {
        console.warn("[PanelRegistry/dataTexturesPanel] MemoryInspector has no DataTextures bundle.");
        return undefined;
      }
      return DataTexturesPanel.openFor({dataTextures: dt});
    },
  });

  registry.register("drawingsPanel", {
    find:   (ctx) => DrawingsPanel.getFor(ctx.studio),
    create: (ctx) => DrawingsPanel.openFor({studio: ctx.studio}),
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
        console.warn("[PanelRegistry/exportBCFPanel] No View available — BCF export needs a View to capture state from.");
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
        console.warn("[PanelRegistry/explorerPanel] No View available — Explorer needs a View for visibility checkboxes.");
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
        console.warn("[PanelRegistry/issuesPanel] Studio not fully initialised yet — Viewer/Scene/Data/WebGLRenderer must exist.");
        return undefined;
      }
      return IssuesPanel.openFor({viewer, scene, data, renderer, visible: true});
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
    find:   (ctx) => GPUMemoryPanel.getFor(ctx.studio.renderer),
    create: (ctx) => GPUMemoryPanel.openFor({renderer: ctx.studio.renderer}),
  });

  registry.register("rendererPanel", {
    find:   (ctx) => RendererPanel.getFor(ctx.studio.renderer),
    create: (ctx) => RendererPanel.openFor({renderer: ctx.studio.renderer}),
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
