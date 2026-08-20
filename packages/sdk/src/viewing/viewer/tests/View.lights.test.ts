import {Scene} from "../../../model/scene";
import {AmbientLight} from "../AmbientLight";
import {DirLight} from "../DirLight";
import {PointLight} from "../PointLight";
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

describe("View lights", () => {

  it("uses default ambient lighting components", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;

    expect(view.lights.hemispheric.enabled).toBe(true);
    expect(view.lights.hemispheric.intensity).toBe(0.8);
    expect(view.lights.ibl.enabled).toBe(true);
    expect(view.lights.ibl.intensity).toBe(1.0);
    expect(view.lightsList.find((light: any) => light._type === "ambient")?.intensity).toBe(0.0);
    expect(view.lights.hemispheric.applied).toBe(true);
    expect(view.lights.ibl.applied).toBe(true);
  });

  it("schedules render when legacy lights are created and destroyed", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;
    const needsRender = jest.spyOn(view, "needsRender").mockImplementation(() => {});

    const ambient = new AmbientLight(view, {id: "ambient"});
    expect(needsRender).toHaveBeenCalledTimes(1);
    ambient.destroy();
    expect(needsRender).toHaveBeenCalledTimes(2);

    const dir = new DirLight(view, {id: "dir"});
    expect(needsRender).toHaveBeenCalledTimes(3);
    dir.destroy();
    expect(needsRender).toHaveBeenCalledTimes(4);

    const point = new PointLight(view, {id: "point"});
    expect(needsRender).toHaveBeenCalledTimes(5);
    point.destroy();
    expect(needsRender).toHaveBeenCalledTimes(6);
  });

  it("assigns generated IDs to directional lights", () => {
    const viewer = new Viewer({scene: new Scene()});
    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });
    expect(viewResult.ok).toBe(true);

    const view = viewResult.value!;
    const light = new DirLight(view);

    expect(typeof light.id).toBe("string");
    expect(light.id.length).toBeGreaterThan(0);
    expect(view.lightSources[light.id]).toBe(light);
  });
});
