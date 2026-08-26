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

describe("View effect defaults", () => {

  it("keeps expensive effects disabled when omitted", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const effects = viewResult.value!.effects;
    expect(effects.sao.enabled).toBe(false);
    expect(effects.edges.enabled).toBe(false);
    expect(effects.bloom.enabled).toBe(false);
    expect(effects.atmosphere.enabled).toBe(false);
    expect(effects.depthOfField.enabled).toBe(false);
    expect(effects.colorGrading.enabled).toBe(false);
    expect(effects.tonemap.enabled).toBe(false);
    expect(effects.antiAliasing.enabled).toBe(false);
    expect(effects.shadows.enabled).toBe(false);
    expect(effects.sky.enabled).toBe(false);
    expect(viewResult.value!.lights.ibl.enabled).toBe(false);
    expect(viewResult.value!.lights.hemispheric.enabled).toBe(false);
  });

  it("keeps empty effect parameter objects disabled", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      effects: {
        sao: {},
        edges: {},
        bloom: {},
        atmosphere: {},
        depthOfField: {},
        colorGrading: {},
        antiAliasing: {},
        shadows: {}
      }
    });
    expect(viewResult.ok).toBe(true);

    const effects = viewResult.value!.effects;
    expect(effects.sao.enabled).toBe(false);
    expect(effects.edges.enabled).toBe(false);
    expect(effects.bloom.enabled).toBe(false);
    expect(effects.atmosphere.enabled).toBe(false);
    expect(effects.depthOfField.enabled).toBe(false);
    expect(effects.colorGrading.enabled).toBe(false);
    expect(effects.tonemap.enabled).toBe(false);
    expect(effects.antiAliasing.enabled).toBe(false);
    expect(effects.shadows.enabled).toBe(false);
    expect(effects.sky.enabled).toBe(false);
    expect(viewResult.value!.lights.ibl.enabled).toBe(false);
    expect(viewResult.value!.lights.hemispheric.enabled).toBe(false);
  });

  it("enables expensive effects only when explicitly requested", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      effects: {
        sao: {enabled: true},
        edges: {enabled: true},
        bloom: {enabled: true},
        atmosphere: {enabled: true},
        depthOfField: {enabled: true},
        colorGrading: {enabled: true},
        tonemap: {enabled: true},
        antiAliasing: {enabled: true},
        shadows: {enabled: true},
        sky: {enabled: true},
        ibl: {enabled: true}
      },
      lights: {
        hemispheric: {enabled: true}
      }
    });
    expect(viewResult.ok).toBe(true);

    const effects = viewResult.value!.effects;
    expect(effects.sao.enabled).toBe(true);
    expect(effects.edges.enabled).toBe(true);
    expect(effects.bloom.enabled).toBe(true);
    expect(effects.atmosphere.enabled).toBe(true);
    expect(effects.depthOfField.enabled).toBe(true);
    expect(effects.colorGrading.enabled).toBe(true);
    expect(effects.tonemap.enabled).toBe(true);
    expect(effects.antiAliasing.enabled).toBe(true);
    expect(effects.shadows.enabled).toBe(true);
    expect(effects.sky.enabled).toBe(true);
    expect(viewResult.value!.lights.ibl.enabled).toBe(true);
    expect(viewResult.value!.lights.hemispheric.enabled).toBe(true);
  });

  it("applies deferred lighting effect enablement from params", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;
    const result = view.fromParams({
      effects: {
        ibl: {enabled: true}
      },
      lights: {
        hemispheric: {enabled: true}
      }
    });

    expect(result.ok).toBe(true);
    expect(view.lights.ibl.enabled).toBe(true);
    expect(view.lights.hemispheric.enabled).toBe(true);
  });
});
