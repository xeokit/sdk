import {NavigationRender} from "../../../base/constants";
import {Scene} from "../../../model/scene";
import {Viewer} from "../Viewer";
import {installViewerTestGlobals} from "./installViewerTestGlobals";

class FakeHTMLElement {
  offsetLeft = 0;
  offsetTop = 0;
  clientWidth = 640;
  clientHeight = 480;
}

class FakeResizeObserver {
  observe() {}
  disconnect() {}
}

let restoreGlobals: (() => void) | null = null;

beforeAll(() => {
  restoreGlobals = installViewerTestGlobals(FakeHTMLElement, FakeResizeObserver);
});

afterAll(() => {
  restoreGlobals?.();
});

function createHostElement(): HTMLElement {
  return new FakeHTMLElement() as any;
}

describe("View resolution scale", () => {

  it("is inactive by default in every render mode", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      renderMode: NavigationRender
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.resolutionScale.renderModes).toEqual([]);
    expect(view.resolutionScale.applied).toBe(false);
  });

  it("can still be explicitly enabled for navigation rendering", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      renderMode: NavigationRender,
      resolutionScale: {
        renderModes: [NavigationRender],
        resolutionScale: 0.5
      }
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.resolutionScale.renderModes).toEqual([NavigationRender]);
    expect(view.resolutionScale.applied).toBe(true);
  });
});
