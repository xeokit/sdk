/**
 * @jest-environment jsdom
 */

jest.mock("../RenderContext", () => ({
  RenderContext: class RenderContext {}
}));
jest.mock("../renderManager", () => ({
  RenderManager: class RenderManager {}
}));
jest.mock("../pickManager", () => ({
  PickManager: class PickManager {}
}));
jest.mock("../snapManager", () => ({
  SnapManager: class SnapManager {}
}));
jest.mock("../gpuMemoryManager", () => ({
  GPUMemoryManager: class GPUMemoryManager {}
}));
jest.mock("../meshManager", () => ({
  MeshManager: class MeshManager {}
}));
jest.mock("../ViewRenderState", () => ({
  ViewRenderState: class ViewRenderState {}
}));

import {ViewManager} from "../ViewManager";

describe("ViewManager inactive view snapshots", () => {

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("skips the blocking inactive snapshot when the previous host is not an image", () => {
    const manager = createManager();
    const previous = createRendererView(document.createElement("canvas"));
    const next = createRendererView(document.createElement("canvas"));
    document.body.append(previous.view.htmlElement, next.view.htmlElement);
    (manager as any)._activeView = previous;

    (manager as any)._activateView(next);

    expect((manager as any)._renderManager.render).not.toHaveBeenCalled();
    expect((manager as any)._renderContext.webglCanvasElement.toDataURL).not.toHaveBeenCalled();
    expect(previous.view.htmlElement.style.opacity).toBe("");
    expect(next.view.htmlElement.style.opacity).toBe("0");
  });

  it("keeps the existing inactive snapshot behavior for visible image hosts", () => {
    const manager = createManager();
    const previous = createRendererView(document.createElement("img"));
    const next = createRendererView(document.createElement("img"));
    document.body.append(previous.view.htmlElement, next.view.htmlElement);
    mockRect(previous.view.htmlElement, 640, 480);
    (manager as any)._activeView = previous;

    (manager as any)._activateView(next);

    expect((manager as any)._renderManager.render).toHaveBeenCalledWith(previous, {clear: true});
    expect((manager as any)._renderContext.webglCanvasElement.toDataURL).toHaveBeenCalledWith("image/png");
    expect((previous.view.htmlElement as HTMLImageElement).src).toContain("data:image/png");
    expect(previous.view.htmlElement.style.opacity).toBe("");
    expect(next.view.htmlElement.style.opacity).toBe("0");
  });
});

function createManager(): ViewManager {
  const manager = Object.create(ViewManager.prototype) as ViewManager;
  (manager as any)._renderManager = {
    render: jest.fn(() => ({ok: true, value: undefined}))
  };
  (manager as any)._renderContext = {
    webglCanvasElement: {
      style: {},
      toDataURL: jest.fn(() => "data:image/png;base64,snapshot")
    }
  };
  (manager as any)._observeActiveViewElement = jest.fn();
  (manager as any)._scheduleActiveViewCanvasAlignment = jest.fn();
  return manager;
}

function createRendererView(htmlElement: HTMLElement): any {
  htmlElement.style.opacity = "0";
  mockRect(htmlElement, 640, 480);
  return {
    view: {
      htmlElement
    }
  };
}

function mockRect(element: HTMLElement, width: number, height: number): void {
  element.getBoundingClientRect = jest.fn(() => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({})
  } as DOMRect));
}
