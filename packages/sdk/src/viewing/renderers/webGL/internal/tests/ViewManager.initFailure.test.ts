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

function createViewer(numViews: number) {
  return {
    numViews,
    viewList: Array.from({length: numViews}, (_, i) => ({id: `view-${i}`})),
  };
}

describe("ViewManager init failure cleanup", () => {
  test("destroy is safe after init fails before RenderContext creation", () => {
    const manager = new ViewManager();

    const result = manager.init({
      viewer: createViewer(4) as any,
      memoryConfigs: {} as any,
    });

    expect(result.ok).toBe(false);
    expect(() => manager.destroy()).not.toThrow();
  });
});
