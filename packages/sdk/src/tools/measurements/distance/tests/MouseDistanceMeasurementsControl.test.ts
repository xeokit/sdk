/**
 * @jest-environment jsdom
 */

import {MouseDistanceMeasurementsControl} from "../MouseDistanceMeasurementsControl";

describe("MouseDistanceMeasurementsControl picking", () => {

  it("uses the snapped world and canvas positions when snap lands", () => {
    const {control, picker, view} = createControl();
    picker.pick.mockReturnValue({
      hit: true,
      view,
      worldPos: [9, 9, 9],
      snap: {
        type: "vertex",
        worldPos: [1, 2, 3],
        canvasPos: [4, 5],
      },
      strategyUsed: "gpu",
    });

    const hit = pickAt(control, mouseEvent(20, 40));

    expect(hit).toEqual({
      worldPos: [1, 2, 3],
      viewportX: 14,
      viewportY: 25,
    });
    expect(picker.pick).toHaveBeenCalledTimes(1);
    expect(picker.pick).toHaveBeenCalledWith({
      view,
      canvasPos: [10, 20],
      snapToVertex: true,
      snapToEdge: true,
      snapRadius: 30,
    });
  });

  it("falls back to a plain surface pick when GPU snap does not land", () => {
    const {control, picker, view} = createControl();
    picker.pick
      .mockReturnValueOnce({
        hit: true,
        view,
        worldPos: null,
        snap: null,
        strategyUsed: "gpu",
      })
      .mockReturnValueOnce({
        hit: true,
        view,
        worldPos: [7, 8, 9],
        snap: null,
        strategyUsed: "bvh",
      });

    const hit = pickAt(control, mouseEvent(20, 40));

    expect(hit).toEqual({
      worldPos: [7, 8, 9],
      viewportX: 20,
      viewportY: 40,
    });
    expect(picker.pick).toHaveBeenCalledTimes(2);
    expect(picker.pick).toHaveBeenNthCalledWith(2, {
      view,
      canvasPos: [10, 20],
    });
  });

  it("does not duplicate work when the snap request already used BVH", () => {
    const {control, picker, view} = createControl();
    picker.pick.mockReturnValue({
      hit: true,
      view,
      worldPos: [7, 8, 9],
      snap: null,
      strategyUsed: "bvh",
    });

    const hit = pickAt(control, mouseEvent(20, 40));

    expect(hit).toEqual({
      worldPos: [7, 8, 9],
      viewportX: 20,
      viewportY: 40,
    });
    expect(picker.pick).toHaveBeenCalledTimes(1);
  });
});

function createControl() {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = jest.fn(() => ({
    left: 10,
    top: 20,
    right: 110,
    bottom: 120,
    width: 100,
    height: 100,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  }));
  const view = {htmlElement: canvas} as any;
  const picker = {pick: jest.fn()} as any;
  const tool = {view, picker} as any;
  return {
    control: new MouseDistanceMeasurementsControl(tool),
    picker,
    view,
  };
}

function pickAt(control: MouseDistanceMeasurementsControl, event: MouseEvent) {
  return (control as any)._pickAt(event);
}

function mouseEvent(clientX: number, clientY: number): MouseEvent {
  return new MouseEvent("mousemove", {clientX, clientY});
}
