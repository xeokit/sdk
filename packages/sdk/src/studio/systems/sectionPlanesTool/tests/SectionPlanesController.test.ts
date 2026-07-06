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

  function makeController(view: object = {}) {
    const controller = Object.create(SectionPlanesController.prototype) as any;
    controller.view = view;
    controller._destroyed = false;
    controller._selected = null;
    controller._mode = "translate";
    controller._previousTransformSpace = null;
    controller._previousTransformShow = null;
    controller.onSelectionChanged = {dispatch: jest.fn()};
    controller._syncProxyMatrix = jest.fn();
    return controller;
  }

  function makePlane() {
    return {
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
