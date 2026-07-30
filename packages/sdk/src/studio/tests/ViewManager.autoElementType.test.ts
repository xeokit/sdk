/**
 * @jest-environment jsdom
 */

jest.mock("../../viewing/cameraFlight", () => ({
  CameraFlightAnimation: class CameraFlightAnimation {
    readonly view: any;
    constructor(view: any) {
      this.view = view;
    }
    jumpTo = jest.fn();
  },
}));

jest.mock("../../viewing/viewController", () => ({
  ViewController: class ViewController {
    readonly view: any;
    readonly cfg: any;
    constructor(view: any, cfg: any) {
      this.view = view;
      this.cfg = cfg;
    }
  },
}));

import {ViewManager} from "../viewManager";

describe("Studio ViewManager auto-created view elements", () => {

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("uses image elements by default for WebGL-backed Studio views", () => {
    const viewer = createViewer();
    const manager = createManager(viewer);

    const view = manager.createView({id: "default-view"});

    expect(view.htmlElement).toBeInstanceOf(HTMLImageElement);
    expect(viewer.createView).toHaveBeenCalledWith(expect.objectContaining({
      htmlElement: expect.any(HTMLImageElement),
    }));
  });

  it("uses canvas elements when configured for WebGPU-backed Studio views", () => {
    const viewer = createViewer();
    const manager = createManager(viewer, {autoElementType: "canvas"});

    const view = manager.createView({id: "webgpu-view"});

    expect(view.htmlElement).toBeInstanceOf(HTMLCanvasElement);
    expect(viewer.createView).toHaveBeenCalledWith(expect.objectContaining({
      htmlElement: expect.any(HTMLCanvasElement),
    }));
  });

  it("passes adaptiveQuality through Studio hooks without forwarding it to Viewer.createView", () => {
    const viewer = createViewer();
    const onViewCreated = jest.fn();
    const manager = createManager(viewer, {}, {onViewCreated});
    const adaptiveQuality = {restMs: 250};

    const view = manager.createView({id: "adaptive-view", adaptiveQuality});

    expect(viewer.createView).toHaveBeenCalledWith(expect.not.objectContaining({
      adaptiveQuality: expect.anything(),
    }));
    expect(onViewCreated).toHaveBeenCalledWith(
      view,
      expect.objectContaining({view}),
      expect.objectContaining({adaptiveQuality}),
    );
  });

  it("does not add resolution scale render modes to Studio-created views", () => {
    const viewer = createViewer();
    const manager = createManager(viewer);

    manager.createView({id: "resolution-scale-view"});

    expect(viewer.createView).toHaveBeenCalledWith(expect.not.objectContaining({
      resolutionScale: expect.anything(),
    }));
  });
});

function createManager(
  viewer: any,
  options: {autoElementType?: "image" | "canvas"} = {},
  hooks: ConstructorParameters<typeof ViewManager>[1] = {},
): ViewManager {
  return new ViewManager(
    {
      viewer,
      pickFn: jest.fn(() => ({ok: false, error: "not used"})),
    } as any,
    hooks,
    options,
  );
}

function createViewer(): any {
  const viewer: any = {
    numViews: 0,
    createView: jest.fn((params: any) => {
      viewer.numViews++;
      return {
        ok: true,
        value: {
          id: params.id,
          htmlElement: params.htmlElement,
          viewer,
          needsRender: jest.fn(),
          destroy: jest.fn(),
        },
      };
    }),
  };
  return viewer;
}
