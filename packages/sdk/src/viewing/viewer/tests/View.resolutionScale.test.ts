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

  it("is inactive by default", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.resolutionScale.enabled).toBe(false);
    expect(view.resolutionScale.applied).toBe(false);
  });

  it("can be explicitly enabled", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      resolutionScale: {
        enabled: true,
        resolutionScale: 0.5
      }
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.resolutionScale.enabled).toBe(true);
    expect(view.resolutionScale.applied).toBe(true);
  });
});
