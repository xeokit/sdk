/**
 * @jest-environment jsdom
 */

jest.mock("../../viewing/viewer", () => ({
  View: class View {},
  Viewer: class Viewer {},
  ViewObject: class ViewObject {},
}));

jest.mock("../../viewing/webGLRenderer", () => {
  class WebGLRenderer {
    readonly params: any;
    constructor(params: any = {}) {
      this.params = params;
    }
    getMemoryConfigs() {
      return this.params.memoryConfigs;
    }
  }
  return {WebGLRenderer};
});

jest.mock("../../viewing/webGPURenderer", () => {
  class WebGPURenderer {
    readonly params: any;
    constructor(params: any = {}) {
      this.params = params;
    }
    static isSupported = jest.fn(() => false);
    static create = jest.fn(async (params: any = {}) => ({
      ok: true,
      value: new WebGPURenderer(params),
    }));
  }
  return {WebGPURenderer};
});

jest.mock("../loading", () => ({
  createDefaultLoaderRegistry: jest.fn(() => ({get: jest.fn()})),
  DefaultModelLocator: class DefaultModelLocator {
    readonly modelsDir: string;
    constructor(modelsDir: string) {
      this.modelsDir = modelsDir;
    }
    resolve() {
      return "";
    }
    resolveSidecar() {
      return "";
    }
  },
}));

jest.mock("../panels", () => ({
  PanelRegistry: class PanelRegistry {
    constructor(_params: any) {}
    open = jest.fn();
  },
  registerBuiltinPanels: jest.fn(),
}));

import {Studio} from "../Studio";
import {WebGLRenderer} from "../../viewing/webGLRenderer";
import {WebGPURenderer} from "../../viewing/webGPURenderer";

describe("Studio renderer backend selection", () => {

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    (WebGPURenderer as any).isSupported.mockReturnValue(false);
    (WebGPURenderer as any).create.mockClear();
  });

  it("creates a WebGLRenderer by default", async () => {
    const studio = studioWithViewLimit(3);

    const result = await (studio as any)._createRenderer({});

    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(WebGLRenderer);
    expect(result.value.getMemoryConfigs().maxViews).toBe(3);
  });

  it("creates a WebGPURenderer by default when WebGPU is supported", async () => {
    (WebGPURenderer as any).isSupported.mockReturnValue(true);
    const studio = studioWithViewLimit(2);

    const result = await (studio as any)._createRenderer({});

    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(WebGPURenderer);
    expect(WebGPURenderer.create).toHaveBeenCalledWith({});
  });

  it("creates a WebGLRenderer when explicitly configured even when WebGPU is supported", async () => {
    (WebGPURenderer as any).isSupported.mockReturnValue(true);
    const studio = studioWithViewLimit(3);

    const result = await (studio as any)._createRenderer({
      renderer: "webgl",
    });

    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(WebGLRenderer);
    expect(WebGPURenderer.create).not.toHaveBeenCalled();
  });

  it("creates a WebGPURenderer when configured", async () => {
    const studio = studioWithViewLimit(4);
    const result = await (studio as any)._createRenderer({
      renderer: "webgpu",
      webGPU: {
        device: {},
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(WebGPURenderer);
  });

  it("creates a WebGPURenderer when forced by URL renderer param", async () => {
    window.history.replaceState(null, "", "/examples/building_materials_aecChart/index.html?renderer=webgpu");
    const studio = studioWithViewLimit(4);

    const result = await (studio as any)._createRenderer({});

    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(WebGPURenderer);
  });

  it("creates a WebGLRenderer when forced by URL renderer param", async () => {
    (WebGPURenderer as any).isSupported.mockReturnValue(true);
    window.history.replaceState(null, "", "/examples/building_materials_aecChart/index.html?renderer=webgl");
    const studio = studioWithViewLimit(4);

    const result = await (studio as any)._createRenderer({});

    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(WebGLRenderer);
    expect(WebGPURenderer.create).not.toHaveBeenCalled();
  });

  it("accepts backend as a URL alias for renderer", async () => {
    window.history.replaceState(null, "", "/examples/building_materials_aecChart/index.html?backend=webgpu");
    const studio = studioWithViewLimit(4);

    const result = await (studio as any)._createRenderer({});

    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(WebGPURenderer);
  });

  it("prefers explicit renderer config over URL renderer param", async () => {
    window.history.replaceState(null, "", "/examples/building_materials_aecChart/index.html?renderer=webgpu");
    const studio = studioWithViewLimit(4);

    const result = await (studio as any)._createRenderer({
      renderer: "webgl",
    });

    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(WebGLRenderer);
    expect(WebGPURenderer.create).not.toHaveBeenCalled();
  });

  it("ignores unsupported URL renderer values", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    window.history.replaceState(null, "", "/examples/building_materials_aecChart/index.html?renderer=canvas2d");
    const studio = studioWithViewLimit(4);

    const result = await (studio as any)._createRenderer({});

    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(WebGLRenderer);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Ignoring unsupported URL renderer backend 'canvas2d'"));
    warn.mockRestore();
  });

  it("reports unsupported renderer backends", async () => {
    const studio = studioWithViewLimit(4);

    const result = await (studio as any)._createRenderer({
      renderer: "canvas2d",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Expected 'auto', 'webgl', or 'webgpu'");
  });
});

function studioWithViewLimit(maxViews: number): Studio {
  const studio = new Studio();
  (studio as any).viewManager = {maxViews};
  return studio;
}
