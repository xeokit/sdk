import {RealisticRender} from "../../../base/constants";
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
