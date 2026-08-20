/**
 * @jest-environment jsdom
 */

jest.mock("../../viewing/viewer", () => ({
  View: class View {},
  Viewer: class Viewer {},
  ViewObject: class ViewObject {},
}));

jest.mock("../../viewing/webGLRenderer", () => ({
  WebGLRenderer: class WebGLRenderer {},
}));

jest.mock("../../viewing/webGPURenderer", () => ({
  WebGPURenderer: class WebGPURenderer {
    static create = jest.fn(async () => ({
      ok: true,
      value: new WebGPURenderer(),
    }));
  },
}));

jest.mock("../dialogs/LoaderProgressDialog", () => ({
  LoaderProgressDialog: {
    runWith: jest.fn(async (params: any) => {
      await params.run(jest.fn(), new AbortController().signal);
    }),
  },
}));

jest.mock("../loading", () => {
  class LoaderRegistry {
    private formats = new Map<string, any>();
    register(format: string, descriptor: any): void {
      this.formats.set(format, descriptor);
    }
    get(format: string): any {
      return this.formats.get(format);
    }
  }
  return {
    createDefaultLoaderRegistry: jest.fn(() => new LoaderRegistry()),
    DefaultModelLocator: class DefaultModelLocator {
      resolve() {
        return "";
      }
      resolveSidecar() {
        return "";
      }
    },
    LoaderRegistry,
  };
});

jest.mock("../panels", () => ({
  PanelRegistry: class PanelRegistry {
    constructor(_params: any) {}
    open = jest.fn();
  },
  registerBuiltinPanels: jest.fn(),
}));

import {Data} from "../../model/data";
import {Scene} from "../../model/scene";
import {sdkProgress} from "../../base/core";
import {ImportDialog} from "../panels/importDialog/ImportDialog";
import {SampleModelsPanel} from "../panels/sampleModelsPanel/SampleModelsPanel";
import {Studio} from "../Studio";

function createStudioWithLoader(load: jest.Mock): Studio {
  const loaders = {
    get: jest.fn(() => ({
      fetch: "json",
      needsScene: true,
      needsData: false,
      load,
    })),
  };
  const locator = {
    resolve: jest.fn(() => "/models/test/model.json"),
    resolveSidecar: jest.fn(() => "/models/test/coordSys.json"),
  };
  const studio = new Studio({loaders: loaders as any, locator: locator as any});
  studio.scene = new Scene();
  studio.data = new Data();
  studio.viewer = {viewList: []} as any;
  return studio;
}

beforeEach(() => {
  document.body.innerHTML = "";
  sdkProgress.numTasks = 0;
  sdkProgress.phase = "Booting example";
  (globalThis as any).fetch = jest.fn(async (url: string) => {
    if (url.endsWith("coordSys.json")) {
      return {
        ok: false,
        json: async () => ({}),
      };
    }
    return {
      ok: true,
      json: async () => ({ok: true}),
    };
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: jest.fn(() => "blob:model"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: jest.fn(),
  });
});

describe("Studio SceneModel update hint", () => {

  it("passes loadModel updateHint to a newly-created SceneModel", async () => {
    const load = jest.fn(async ({sceneModel}) => ({
      ok: true,
      value: sceneModel.updateHint,
    }));
    const studio = createStudioWithLoader(load);

    const result = await studio.loadModel({
      modelId: "test",
      format: "fake",
      updateHint: "dynamic",
    }, {});

    expect(result.ok).toBe(true);
    expect(studio.scene.models.test.updateHint).toBe("dynamic");
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneModel: expect.objectContaining({updateHint: "dynamic"}),
      }),
      expect.any(Object),
    );
  });

  it("applies loadModel updateHint to an existing SceneModel", async () => {
    const load = jest.fn(async ({sceneModel}) => ({
      ok: true,
      value: sceneModel.updateHint,
    }));
    const studio = createStudioWithLoader(load);
    const sceneModel = studio.scene.createModel({
      id: "existing",
      updateHint: "static",
    }).value!;

    const result = await studio.loadModel({
      modelId: "existing",
      format: "fake",
      sceneModel,
      updateHint: "dynamic",
    }, {});

    expect(result.ok).toBe(true);
    expect(sceneModel.updateHint).toBe("dynamic");
  });

  it("passes loadDataset updateHint into the shared SceneModel", async () => {
    const load = jest.fn(async ({sceneModel}) => ({
      ok: true,
      value: sceneModel.updateHint,
    }));
    const studio = createStudioWithLoader(load);

    const result = await studio.loadDataset({
      modelId: "dataset",
      formats: ["fake"],
      updateHint: "dynamic",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sceneModel.updateHint).toBe("dynamic");
    }
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneModel: expect.objectContaining({updateHint: "dynamic"}),
      }),
      expect.any(Object),
    );
  });

  it("completes the global progress task after loadDataset", async () => {
    const load = jest.fn(async ({sceneModel}) => ({
      ok: true,
      value: sceneModel.updateHint,
    }));
    const studio = createStudioWithLoader(load);
    const added: number[] = [];
    const remaining: number[] = [];
    const unsubscribeAdded = sdkProgress.onTasksAdded.subscribe((_progress, count) => {
      added.push(count);
    });
    const unsubscribeCompleted = sdkProgress.onTaskCompleted.subscribe((_progress, count) => {
      remaining.push(count);
    });

    try {
      const result = await studio.loadDataset({
        modelId: "dataset",
        formats: ["fake"],
        updateHint: "dynamic",
      });

      expect(result.ok).toBe(true);
      expect(added).toEqual([1]);
      expect(remaining).toEqual([0]);
      expect(sdkProgress.numTasks).toBe(0);
    } finally {
      unsubscribeAdded();
      unsubscribeCompleted();
    }
  });

  it("passes the import dialog SceneModel update selection into model creation and loading", async () => {
    const sceneModel = {id: "imported", destroy: jest.fn()};
    const studio = {
      scene: {
        createModel: jest.fn(() => ({ok: true, value: sceneModel})),
      },
      data: {
        createModel: jest.fn(() => ({ok: true, value: {id: "imported"}})),
      },
      loadModel: jest.fn(async () => ({ok: true})),
      recordModelOrigin: jest.fn(),
      reportError: jest.fn(),
      reportWarning: jest.fn(),
    };
    const dialog = new ImportDialog({studio: studio as any});
    const select = document.getElementById("xkt-imp-model-update-hint") as HTMLSelectElement;

    select.value = "static";
    select.dispatchEvent(new Event("change"));
    (dialog as any)._chosenFiles.set("xgf", new File(["xgf"], "model.xgf"));

    await (dialog as any)._loadActiveDataSet();

    expect(studio.scene.createModel).toHaveBeenCalledWith(
      expect.objectContaining({updateHint: "static"}),
    );
    expect(studio.loadModel).toHaveBeenCalledWith(
      expect.objectContaining({updateHint: "static"}),
      expect.any(Object),
    );
  });

  it("passes the sample-models SceneModel update selection into dataset loading", async () => {
    const studio = {
      scene: {
        models: {},
        events: {
          onSceneModelDestroyed: {subscribe: jest.fn(() => jest.fn())},
        },
      },
      loadDataset: jest.fn(async () => ({
        ok: true,
        value: {sceneModel: {id: "sample-1"}},
      })),
      destroyModel: jest.fn(),
      reportError: jest.fn(),
      reportWarning: jest.fn(),
    };
    const panel = new SampleModelsPanel({
      studio: studio as any,
      visible: false,
    });
    const select = document.querySelector(".xkt-sam-model-update-hint select") as HTMLSelectElement;
    const button = document.createElement("button");
    const row = {
      modelId: "Sample",
      datasetLabel: "xgf",
      formats: ["xgf"],
      baseTitle: "Sample (xgf)",
      button,
      loadedSceneModelId: undefined,
    };

    select.value = "static";
    select.dispatchEvent(new Event("change"));
    await (panel as any)._runLoad("Sample", ["xgf"], button, row);

    expect(studio.loadDataset).toHaveBeenCalledWith(
      expect.objectContaining({updateHint: "static"}),
    );
  });
});
