import {TransformControls} from "../../../../viewing/transformControls";
import {SectionPlanesController} from "../SectionPlanesController";

describe("SectionPlanesController gizmo integration", () => {
  const originalGetFor = TransformControls.getFor;

  afterEach(() => {
    (TransformControls as any).getFor = originalGetFor;
  });

  function makeTransformControls(space: "world" | "local" = "world") {
    const tc: any = {
      space,
      showX: false,
      showY: false,
      showZ: false,
      attach: jest.fn(),
      detach: jest.fn(),
      setMode: jest.fn(),
      setSpace: jest.fn((next: "world" | "local") => {
        tc.space = next;
      }),
      setShowX: jest.fn((next: boolean) => {
        tc.showX = next;
      }),
      setShowY: jest.fn((next: boolean) => {
        tc.showY = next;
      }),
      setShowZ: jest.fn((next: boolean) => {
        tc.showZ = next;
      }),
    };
    return tc;
  }

  function makeController(view: object = {needsRender: jest.fn()}) {
    const controller = Object.create(SectionPlanesController.prototype) as any;
    controller.view = view;
    controller._destroyed = false;
    controller._selected = null;
    controller._mode = "translate";
    controller._previousTransformSpace = null;
    controller._previousTransformShow = null;
    controller._transformControlsFactory = undefined;
    controller.onSelectionChanged = {dispatch: jest.fn()};
    controller._syncProxyMatrix = jest.fn();
    return controller;
  }

  function makePlane(id = "plane") {
    return {
      id,
      destroyed: false,
      pos: [0, 0, 0],
      dir: [0, 0, 1],
    };
  }

  it("edits section planes in local transform space", () => {
    const tc = makeTransformControls("world");
    (TransformControls as any).getFor = jest.fn(() => tc);
    const controller = makeController();

    controller._applyGizmo(makePlane(), "rotate");

    expect(tc.attach).toHaveBeenCalledTimes(1);
    expect(tc.setSpace).toHaveBeenCalledWith("local");
    expect(tc.setShowX).toHaveBeenCalledWith(true);
    expect(tc.setShowY).toHaveBeenCalledWith(true);
    expect(tc.setShowZ).toHaveBeenCalledWith(true);
    expect(tc.setMode).toHaveBeenCalledWith("rotate");
    expect(controller._previousTransformSpace).toBe("world");
    expect(controller._previousTransformShow).toEqual({x: false, y: false, z: false});
  });

  it("keeps all axes visible while editing section planes", () => {
    const tc = makeTransformControls("world");
    (TransformControls as any).getFor = jest.fn(() => tc);
    const controller = makeController();

    controller._applyGizmo(makePlane(), "translate");

    expect(tc.setShowX).toHaveBeenCalledWith(true);
    expect(tc.setShowY).toHaveBeenCalledWith(true);
    expect(tc.setShowZ).toHaveBeenCalledWith(true);
  });

  it("uses a configured TransformControls factory", () => {
    const tc = makeTransformControls("world");
    (TransformControls as any).getFor = jest.fn(() => undefined);
    const view = {needsRender: jest.fn()};
    const controller = makeController(view);
    controller._transformControlsFactory = jest.fn(() => tc);

    controller._applyGizmo(makePlane(), "translate");

    expect(controller._transformControlsFactory).toHaveBeenCalledWith(view);
    expect(tc.attach).toHaveBeenCalledTimes(1);
  });

  it("selects section planes from proxy object ids", () => {
    const plane = makePlane("slice");
    const controller = makeController({
      sectionPlanesList: [plane],
    });
    controller.select = jest.fn();

    expect(controller.selectByProxyObjectId("__sp.obj.slice")).toBe(true);
    expect(controller.select).toHaveBeenCalledWith(plane);
    expect(controller.selectByProxyObjectId("__sp.obj.missing")).toBe(false);
    expect(controller.selectByProxyObjectId("__tc.t.x")).toBe(false);
  });

  it("restores the previous transform space when selection clears", () => {
    const tc = makeTransformControls("world");
    (TransformControls as any).getFor = jest.fn(() => tc);
    const controller = makeController();
    const plane = makePlane();

    controller._applyGizmo(plane, "translate");
    controller._selected = plane;
    controller.select(null);

    expect(tc.detach).toHaveBeenCalledTimes(1);
    expect(tc.setShowX).toHaveBeenLastCalledWith(false);
    expect(tc.setShowY).toHaveBeenLastCalledWith(false);
    expect(tc.setShowZ).toHaveBeenLastCalledWith(false);
    expect(tc.setSpace).toHaveBeenLastCalledWith("world");
    expect(controller._previousTransformSpace).toBeNull();
    expect(controller._previousTransformShow).toBeNull();
  });
});
