import {DetailedRender, RealisticRender} from "../../../base/constants";
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

describe("View renderModes params", () => {

  it("defaults base effect edges to one pixel wide", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.effects.edges.edgeWidth).toBe(1);
  });

  it("applies renderer effect renderModes from createView params", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      renderMode: RealisticRender,
      effects: {
        sao: {renderModes: []},
        tonemap: {renderModes: []},
        antiAliasing: {renderModes: []}
      }
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.effects.sao.renderModes).toEqual([]);
    expect(view.effects.sao.applied).toBe(false);
    expect(view.effects.tonemap.renderModes).toEqual([]);
    expect(view.effects.tonemap.applied).toBe(false);
    expect(view.effects.antiAliasing.renderModes).toEqual([]);
    expect(view.effects.antiAliasing.applied).toBe(false);
  });

  it("applies Texturing params and round-trips them through View params", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      renderMode: DetailedRender,
      texturing: {
        enabled: false,
        renderModes: []
      }
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;
    const params = view.toParams();

    expect(view.texturing.enabled).toBe(false);
    expect(view.texturing.renderModes).toEqual([]);
    expect(view.texturing.applied).toBe(false);
    expect(params.ok).toBe(true);
    expect(params.value!.texturing).toEqual({
      enabled: false,
      renderModes: []
    });
  });

  it("round-trips Lights params through View params", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      renderMode: RealisticRender,
      lights: {
        ibl: {
          intensity: 0,
          renderModes: []
        },
        hemispheric: {
          intensity: 0,
          renderModes: []
        }
      }
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;
    const params = view.toParams();

    expect(view.lights.ibl.renderModes).toEqual([]);
    expect(view.lights.ibl.applied).toBe(false);
    expect(view.lights.hemispheric.renderModes).toEqual([]);
    expect(view.lights.hemispheric.applied).toBe(false);
    expect(params.ok).toBe(true);
    expect(params.value!.lights!.ibl!.renderModes).toEqual([]);
    expect(params.value!.lights!.hemispheric!.renderModes).toEqual([]);
  });
});
