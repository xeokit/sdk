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

describe("View anti-aliasing", () => {

  it("defaults to enabled SMAA", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.effects.antiAliasing.mode).toBe("smaa");
    expect(view.effects.antiAliasing.enabled).toBe(true);
    expect(view.effects.antiAliasing.applied).toBe(true);
  });

  it("accepts SMAA from view params and round-trips it", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      effects: {
        antiAliasing: {
          mode: "smaa"
        }
      }
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;
    const params = view.effects.antiAliasing.toParams();

    expect(view.effects.antiAliasing.mode).toBe("smaa");
    expect(params.ok).toBe(true);
    expect(params.value!.mode).toBe("smaa");
  });

  it("accepts FXAA when explicitly configured", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      effects: {
        antiAliasing: {
          mode: "fxaa"
        }
      }
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.effects.antiAliasing.mode).toBe("fxaa");
  });

  it("ignores invalid AA modes", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;
    view.effects.antiAliasing.mode = "smaa";
    view.effects.antiAliasing.mode = "bad-mode" as any;

    expect(view.effects.antiAliasing.mode).toBe("smaa");
  });
});
