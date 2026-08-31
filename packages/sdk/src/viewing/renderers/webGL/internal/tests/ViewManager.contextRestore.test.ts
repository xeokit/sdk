/**
 * @jest-environment jsdom
 */

jest.mock("../webGL", () => ({
  WEBGL_INFO: {MAX_TEXTURE_UNITS: 8},
}));
jest.mock("../../../../viewer", () => ({
  Camera: class {},
  Effect: class {},
  View: class {},
  Viewer: class {},
  ViewObject: class {},
}));

import {ViewManager} from "../ViewManager";

function ok(): any {
  return {ok: true, value: undefined};
}

describe("ViewManager WebGL context restore", () => {
  test("restores RenderContext before GL-backed managers", () => {
    const calls: string[] = [];
    const viewManager = Object.create(ViewManager.prototype) as ViewManager;
    const vm = viewManager as unknown as Record<string, unknown>;

    const gl = {id: "restored-gl"} as never;
    vm._renderContext = {
      gl: {id: "current-gl"},
      webglContextRestored: jest.fn((receivedGL) => {
        calls.push("context");
        expect(receivedGL).toBe(gl);
        return ok();
      }),
    };
    vm._gpuMemoryManager = {
      webglContextRestored: jest.fn(() => {
        calls.push("gpu");
        return ok();
      }),
    };
    vm._meshManager = {
      webglContextRestored: jest.fn(() => {
        calls.push("mesh");
        return ok();
      }),
    };
    vm._renderManager = {
      webglContextRestored: jest.fn(() => {
        calls.push("render");
        return ok();
      }),
    };
    vm._pickManager = {
      webglContextRestored: jest.fn(() => {
        calls.push("pick");
        return ok();
      }),
    };
    vm._snapManager = {
      webglContextRestored: jest.fn(() => {
        calls.push("snap");
        return ok();
      }),
    };
    vm._rendererViewsList = [
      {
        renderBuffers: {
          webglContextRestored: jest.fn((receivedGL) => {
            calls.push("buffers");
            expect(receivedGL).toBe((vm._renderContext as any).gl);
          }),
        },
      },
    ];
    vm._activeView = null;

    const result = viewManager.webglContextRestored(gl);

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["context", "buffers", "gpu", "mesh", "render", "pick", "snap"]);
  });

  test("marks RenderContext lost before tearing down GL-backed managers", () => {
    const calls: string[] = [];
    const viewManager = Object.create(ViewManager.prototype) as ViewManager;
    const vm = viewManager as unknown as Record<string, unknown>;

    vm._renderContext = {
      webglContextLost: jest.fn(() => calls.push("context")),
    };
    vm._renderManager = {
      webglContextLost: jest.fn(() => calls.push("render")),
    };
    vm._pickManager = {
      webglContextLost: jest.fn(() => calls.push("pick")),
    };
    vm._rendererViewsList = [
      {renderBuffers: {webglContextLost: jest.fn(() => calls.push("buffers"))}},
    ];

    viewManager.webglContextLost();

    expect(calls).toEqual(["context", "render", "pick", "buffers"]);
  });
});
