import {DetailedRender, NavigationRender, RealisticRender} from "../../../base/constants";
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

describe("View edges", () => {

  it("defaults base effect edges to detailed rendering only", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.effects.edges.renderModes).toEqual([DetailedRender]);
    expect(view.effects.edges.edgeWidth).toBe(1);

    view.renderMode = NavigationRender;
    expect(view.effects.edges.applied).toBe(false);

    view.renderMode = DetailedRender;
    expect(view.effects.edges.applied).toBe(true);

    view.renderMode = RealisticRender;
    expect(view.effects.edges.applied).toBe(false);
  });
});
