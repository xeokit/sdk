/**
 * @jest-environment jsdom
 */

jest.mock("../webGL", () => ({
  WEBGL_INFO: {MAX_TEXTURE_UNITS: 8},
}));

import {RenderContext} from "../RenderContext";

describe("RenderContext init failure cleanup", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  test("does not append a canvas when WebGL2 context creation fails", () => {
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null as any);
    const context = new RenderContext({} as any);

    const result = context.init({} as any);

    expect(result.ok).toBe(false);
    expect(document.body.querySelectorAll("canvas")).toHaveLength(0);
    expect(() => context.destroy()).not.toThrow();
  });
});
