import {RealisticRender} from "../../../base/constants";
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

describe("View atmosphere", () => {

  it("keeps atmosphere inactive when omitted", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      renderMode: RealisticRender
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.effects.atmosphere.renderModes).toEqual([]);
    expect(view.effects.atmosphere.applied).toBe(false);
  });

  it("enables RealisticRender defaults when explicitly configured", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      renderMode: RealisticRender,
      effects: {
        atmosphere: {}
      }
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;
    const params = view.toParams();

    expect(view.effects.atmosphere.renderModes).toEqual([RealisticRender]);
    expect(view.effects.atmosphere.applied).toBe(true);
    expect(params.ok).toBe(true);
    expect(params.value!.effects!.atmosphere!.renderModes).toEqual([RealisticRender]);
  });
});
