import {DetailedRender, RealisticRender} from "../../../base/constants";
import {Scene} from "../../../model/scene";
import {Viewer} from "../Viewer";

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

const originalHTMLElement = globalThis.HTMLElement;
const originalResizeObserver = globalThis.ResizeObserver;
const originalWindow = globalThis.window;

beforeAll(() => {
  (globalThis as any).HTMLElement = FakeHTMLElement;
  (globalThis as any).ResizeObserver = FakeResizeObserver;
  (globalThis as any).window = {
    addEventListener() {},
    removeEventListener() {}
  };
});

afterAll(() => {
  (globalThis as any).HTMLElement = originalHTMLElement;
  (globalThis as any).ResizeObserver = originalResizeObserver;
  (globalThis as any).window = originalWindow;
});

function createHostElement(): HTMLElement {
  return new FakeHTMLElement() as any;
}

describe("View anti-aliasing", () => {

  it("defaults to SMAA in detailed and realistic render modes", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      renderMode: RealisticRender
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.effects.antiAliasing.mode).toBe("smaa");
    expect(view.effects.antiAliasing.renderModes).toEqual([DetailedRender, RealisticRender]);
    expect(view.effects.antiAliasing.applied).toBe(true);
  });

  it("accepts SMAA from view params and round-trips it", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      renderMode: RealisticRender,
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
