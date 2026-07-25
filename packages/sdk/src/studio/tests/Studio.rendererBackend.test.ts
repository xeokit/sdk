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

  it("creates a WebGLRenderer by default", async () => {
    const studio = studioWithViewLimit(3);

    const result = await (studio as any)._createRenderer({});

    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(WebGLRenderer);
    expect(result.value.getMemoryConfigs().maxViews).toBe(3);
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

  it("reports unsupported renderer backends", async () => {
    const studio = studioWithViewLimit(4);

    const result = await (studio as any)._createRenderer({
      renderer: "canvas2d",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unsupported renderer backend");
  });
});

function studioWithViewLimit(maxViews: number): Studio {
  const studio = new Studio();
  (studio as any).viewManager = {maxViews};
  return studio;
}
