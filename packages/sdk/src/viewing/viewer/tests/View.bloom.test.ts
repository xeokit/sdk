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

describe("View bloom", () => {

  it("round-trips enabled through params", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      effects: {
        bloom: {
          enabled: false,
          threshold: 0.7,
          intensity: 0.65
        }
      }
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;
    const params = view.toParams();
    expect(params.ok).toBe(true);

    const nextViewResult = viewer.createView({
      id: "nextView",
      htmlElement: createHostElement(),
      effects: params.value!.effects
    });
    expect(nextViewResult.ok).toBe(true);

    const nextView = nextViewResult.value!;
    expect(nextView.effects.bloom.enabled).toBe(false);
    expect(nextView.effects.bloom.threshold).toBe(0.7);
    expect(nextView.effects.bloom.intensity).toBe(0.65);
  });
});
