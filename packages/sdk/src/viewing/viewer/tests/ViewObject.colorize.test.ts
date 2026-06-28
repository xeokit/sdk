import {ViewObject} from "../ViewObject";

// ViewObject._colorize (RGBA: [0..2] colorize, [3] opacity) is lazily allocated
// — most objects are never colorized or opacity-overridden, and a
// Float32Array(4) costs ~230 B in V8. These cover that the lazy store stays
// null until a real override is applied and that defaults/clearing behave as
// before. Built with minimal fakes (no canvas/renderer needed).

function fakeLayer(): any {
  return {
    objectVisibilityUpdated() {},
    objectColorizeUpdated() {},
    objectOpacityUpdated() {},
    view: {viewer: {logError: () => ({ok: false})}},
  };
}

function makeObject(): any {
  return new ViewObject(fakeLayer(), {id: "o1", originalSystemId: "o1", clippable: true} as any);
}

describe("ViewObject lazy colorize/opacity", () => {

  it("allocates no colorize store and returns defaults when untouched", () => {
    const o = makeObject();
    expect(o._colorize).toBeNull();
    expect(o.colorize).toBeNull();
    expect(o.opacity).toBe(1.0);
  });

  it("allocates only when colorize is set, and clears back to null-equivalent", () => {
    const o = makeObject();
    o.colorize = [0.2, 0.4, 0.6];
    expect(o._colorize).not.toBeNull();
    expect(o.colorize[0]).toBeCloseTo(0.2, 6);
    expect(o.colorize[1]).toBeCloseTo(0.4, 6);
    expect(o.colorize[2]).toBeCloseTo(0.6, 6);

    o.colorize = null; // reset
    expect(o.colorize).toBeNull();      // flag cleared
    expect(o.opacity).toBe(1.0);        // alpha untouched/default
  });

  it("allocates only when opacity is set; opacity=1 still counts as an override", () => {
    const o = makeObject();
    o.opacity = 0.5;
    expect(o._colorize).not.toBeNull();
    expect(o.opacity).toBe(0.5);
    expect(o.opacityUpdated).toBe(true);

    o.opacity = 1;                      // explicit override at 1.0
    expect(o.opacity).toBe(1.0);
    expect(o.opacityUpdated).toBe(true);

    o.opacity = null;                   // clear override
    expect(o.opacity).toBe(1.0);
    expect(o.opacityUpdated).toBe(false);
  });

  it("keeps colorize and opacity independent in the shared store", () => {
    const o = makeObject();
    o.colorize = [0.1, 0.2, 0.3];
    o.opacity = 0.25;                   // 0.25 is exact in Float32
    expect(o.colorize[0]).toBeCloseTo(0.1, 6);
    expect(o.colorize[2]).toBeCloseTo(0.3, 6);
    expect(o.opacity).toBe(0.25);

    o.colorize = null;                  // clearing colorize must not disturb opacity
    expect(o.colorize).toBeNull();
    expect(o.opacity).toBe(0.25);
  });

  it("does not allocate when opacity is cleared on an untouched object", () => {
    const o = makeObject();
    o.opacity = null;                   // no-op clear, nothing to allocate
    expect(o._colorize).toBeNull();
    expect(o.opacityUpdated).toBe(false);
  });
});
