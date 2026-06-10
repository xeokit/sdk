import {CullBoundsMirror} from "../CullBoundsMirror";
import type {SceneCollisionIndex} from "../../collision/SceneCollisionIndex";
import type {AABB3Float} from "../../../base/math/boundaries";

// Minimal stand-in for the collision index: a fixed objectId → AABB table.
function fakeIndex(aabbs: Record<string, AABB3Float>): SceneCollisionIndex {
  return {
    getObjectAABB: (objectId: string): AABB3Float | null => aabbs[objectId] ?? null
  } as unknown as SceneCollisionIndex;
}

describe("CullBoundsMirror", () => {

  it("allocates dense indices and marshals spheres from the collision index", () => {
    const mirror = new CullBoundsMirror(fakeIndex({
      a: [-1, -1, -1, 1, 1, 1],   // centre origin, diagonal length 2√3
      b: [9, 9, 9, 11, 11, 11]    // centre (10,10,10)
    }));
    expect(mirror.put("a", true)).toBe(0);
    expect(mirror.put("b", false)).toBe(1);

    const msg = mirror.marshal()!;
    expect(msg.indices).toEqual([0, 1]);
    expect(Array.from(msg.centers)).toEqual([0, 0, 0, 10, 10, 10]);
    expect(msg.radii[0]).toBeCloseTo(Math.sqrt(3), 10); // 0.5 * 2√3
    expect(Array.from(msg.cullable)).toEqual([1, 0]);
    expect(msg.removed).toEqual([]);
  });

  it("returns null when nothing is pending", () => {
    const mirror = new CullBoundsMirror(fakeIndex({a: [0, 0, 0, 1, 1, 1]}));
    mirror.put("a", true);
    mirror.marshal();
    expect(mirror.pending).toBe(false);
    expect(mirror.marshal()).toBeNull();
  });

  it("re-marshals an object after touch()", () => {
    const mirror = new CullBoundsMirror(fakeIndex({a: [0, 0, 0, 1, 1, 1]}));
    mirror.put("a", true);
    mirror.marshal();
    mirror.touch("a");
    expect(mirror.pending).toBe(true);
    expect(mirror.marshal()!.indices).toEqual([0]);
  });

  it("frees indices on remove and reuses them, cancelling a same-batch removal", () => {
    const mirror = new CullBoundsMirror(fakeIndex({a: [0, 0, 0, 1, 1, 1], b: [0, 0, 0, 2, 2, 2]}));
    mirror.put("a", true);   // index 0
    mirror.marshal();
    mirror.remove("a");      // frees 0
    const reused = mirror.put("b", true); // reuses 0
    expect(reused).toBe(0);
    const msg = mirror.marshal()!;
    expect(msg.indices).toEqual([0]);     // b re-added at 0
    expect(msg.removed).toEqual([]);      // removal of 0 was cancelled
  });

  it("emits a removal-only message when an object is deleted", () => {
    const mirror = new CullBoundsMirror(fakeIndex({a: [0, 0, 0, 1, 1, 1]}));
    mirror.put("a", true);
    mirror.marshal();
    mirror.remove("a");
    const msg = mirror.marshal()!;
    expect(msg.indices).toEqual([]);
    expect(msg.removed).toEqual([0]);
  });

  it("keeps an object dirty until it has bounds", () => {
    const aabbs: Record<string, AABB3Float> = {};
    const mirror = new CullBoundsMirror(fakeIndex(aabbs));
    mirror.put("a", true);
    expect(mirror.marshal()).toBeNull(); // no bounds yet
    expect(mirror.pending).toBe(true);   // still dirty
    aabbs.a = [0, 0, 0, 1, 1, 1];
    expect(mirror.marshal()!.indices).toEqual([0]);
  });

  it("maps dense indices back to object ids", () => {
    const mirror = new CullBoundsMirror(fakeIndex({a: [0, 0, 0, 1, 1, 1]}));
    const i = mirror.put("a", true);
    expect(mirror.objectIdAt(i)).toBe("a");
    mirror.remove("a");
    expect(mirror.objectIdAt(i)).toBeUndefined();
  });
});
