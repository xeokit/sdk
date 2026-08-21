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

describe("View engineering effects", () => {

  it("defaults body hatch and section-plane caps to disabled", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.effects.bodyHatch.enabled).toBe(false);
    expect(view.effects.bodyHatch.applied).toBe(false);
    expect(view.effects.sectionPlaneCaps.enabled).toBe(false);
    expect(view.effects.sectionPlaneCaps.applied).toBe(false);
  });

  it("can explicitly enable body hatch and section-plane caps", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      effects: {
        bodyHatch: {enabled: true},
        sectionPlaneCaps: {enabled: true}
      }
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.effects.bodyHatch.enabled).toBe(true);
    expect(view.effects.bodyHatch.applied).toBe(true);
    expect(view.effects.sectionPlaneCaps.enabled).toBe(true);
    expect(view.effects.sectionPlaneCaps.applied).toBe(true);
  });
});
