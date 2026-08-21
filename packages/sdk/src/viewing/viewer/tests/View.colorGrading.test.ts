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

describe("View color grading", () => {

  it("is inactive by default", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;
    expect(view.effects.colorGrading.enabled).toBe(false);
    expect(view.effects.colorGrading.applied).toBe(false);
    expect(view.effects.colorGrading.brightness).toBe(0);
    expect(view.effects.colorGrading.contrast).toBe(1);
    expect(view.effects.colorGrading.saturation).toBe(1);
    expect(view.effects.colorGrading.gamma).toBe(1);
    expect(view.effects.colorGrading.temperature).toBe(0);
    expect(view.effects.colorGrading.tint).toBe(0);
  });

  it("round-trips through params", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      effects: {
        colorGrading: {
          enabled: true,
          brightness: 0.08,
          contrast: 1.25,
          saturation: 0.82,
          gamma: 1.1,
          temperature: 0.35,
          tint: -0.2
        }
      }
    });
    expect(viewResult.ok).toBe(true);

    const params = viewResult.value!.toParams();
    expect(params.ok).toBe(true);

    const nextViewResult = viewer.createView({
      id: "nextView",
      htmlElement: createHostElement(),
      effects: params.value!.effects
    });
    expect(nextViewResult.ok).toBe(true);

    const colorGrading = nextViewResult.value!.effects.colorGrading;
    expect(colorGrading.enabled).toBe(true);
    expect(colorGrading.brightness).toBe(0.08);
    expect(colorGrading.contrast).toBe(1.25);
    expect(colorGrading.saturation).toBe(0.82);
    expect(colorGrading.gamma).toBe(1.1);
    expect(colorGrading.temperature).toBe(0.35);
    expect(colorGrading.tint).toBe(-0.2);
  });

  it("clamps numeric params", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      effects: {
        colorGrading: {
          enabled: true,
          brightness: 5,
          contrast: -1,
          saturation: 8,
          gamma: 0,
          temperature: -5,
          tint: 5
        }
      }
    });
    expect(viewResult.ok).toBe(true);

    const colorGrading = viewResult.value!.effects.colorGrading;
    expect(colorGrading.brightness).toBe(1);
    expect(colorGrading.contrast).toBe(0);
    expect(colorGrading.saturation).toBe(4);
    expect(colorGrading.gamma).toBe(0.1);
    expect(colorGrading.temperature).toBe(-1);
    expect(colorGrading.tint).toBe(1);
  });
});
