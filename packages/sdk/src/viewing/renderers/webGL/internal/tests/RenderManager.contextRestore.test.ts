/**
 * @jest-environment jsdom
 */

jest.mock("../webGL", () => ({
  WEBGL_INFO: {MAX_TEXTURE_UNITS: 8},
}));

import {RenderManager} from "../renderManager/RenderManager";

function ok(): any {
  return {ok: true, value: undefined};
}

describe("RenderManager WebGL context restore", () => {
  test("drops cached IBL textures before reinitializing", () => {
    const manager = Object.create(RenderManager.prototype) as RenderManager;
    const rm = manager as unknown as Record<string, any>;

    const pipeline = {destroy: jest.fn()};
    const brdfLUT = {destroy: jest.fn()};
    const calls: string[] = [];

    rm._renderContext = {
      renderInspector: {
        webglContextRestored: jest.fn(() => calls.push("inspector")),
      },
    };
    rm.drawOps = {
      webglContextRestored: jest.fn(() => {
        calls.push("drawOps");
        expect(rm._brdfLUT).toBeNull();
        expect(rm._iblPrefilters.size).toBe(0);
        return ok();
      }),
    };
    rm.init = jest.fn(() => {
      calls.push("init");
      expect(rm._brdfLUT).toBeNull();
      expect(rm._iblPrefilters.size).toBe(0);
      return ok();
    });
    rm._iblPrefilters = new Map([[0, pipeline]]);
    rm._iblParamSignatures = new Map([[0, "old-sky"]]);
    rm._iblEnvVersions = new Map([[0, 1]]);
    rm._brdfLUT = brdfLUT;

    const result = manager.webglContextRestored();

    expect(result.ok).toBe(true);
    expect(pipeline.destroy).toHaveBeenCalledTimes(1);
    expect(brdfLUT.destroy).toHaveBeenCalledTimes(1);
    expect(rm._iblPrefilters.size).toBe(0);
    expect(rm._iblParamSignatures.size).toBe(0);
    expect(rm._iblEnvVersions.size).toBe(0);
    expect(rm._brdfLUT).toBeNull();
    expect(calls).toEqual(["inspector", "drawOps", "init"]);
  });
});
