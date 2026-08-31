import {SDKErrorType} from "../../../../base/core";
import {createMat4Float64, identityMat4} from "../../../../base/math/matrix";
import {createVec3Float64, type Vec3} from "../../../../base/math/vector";
import {MarkerOcclusionTester} from "../MarkerOcclusionTester";

function makeView(overrides: Partial<any> = {}) {
  const htmlElement = {
    getBoundingClientRect: () => ({width: 100, height: 100}),
    clientWidth: 100,
    clientHeight: 100,
    offsetWidth: 100,
    offsetHeight: 100
  };
  const projection = {
    unproject: jest.fn((canvasPos, screenZ, screenPos, viewPos, worldPos) => {
      worldPos[0] = (canvasPos[0] - 50) / 50;
      worldPos[1] = (50 - canvasPos[1]) / 50;
      worldPos[2] = screenZ;
      screenPos[0] = worldPos[0];
      screenPos[1] = worldPos[1];
      screenPos[2] = screenZ;
      viewPos[0] = worldPos[0];
      viewPos[1] = worldPos[1];
      viewPos[2] = screenZ;
      return worldPos;
    })
  };
  const objects = {
    wall: makeViewObject(),
    hidden: makeViewObject({visible: false}),
    culled: makeViewObject({culled: true}),
    ghosted: makeViewObject({styleBinIds: ["ghosted"]}),
    transparent: makeViewObject({opacityUpdated: true, opacity: 0.5}),
    global: makeViewObject(),
    global2: makeViewObject(),
    local: makeViewObject(),
    local2: makeViewObject()
  };
  return {
    htmlElement,
    camera: {
      viewMatrix: identityMat4(createMat4Float64()),
      projMatrix: identityMat4(createMat4Float64()),
      projection
    },
    viewer: {scene: {}},
    objects,
    sectionPlanes: {},
    ...overrides
  } as any;
}

function makeViewObject(overrides: Partial<any> = {}) {
  return {
    visible: true,
    culled: false,
    styleBinIds: [],
    hasStyleBin(styleBinId: string) {
      return this.styleBinIds.includes(styleBinId);
    },
    opacityUpdated: false,
    opacity: 1,
    clippable: true,
    ...overrides
  };
}

function makeRaycaster(results: any[]) {
  let index = 0;
  return {
    pick: jest.fn((params) => results[Math.min(index++, results.length - 1)] ?? miss(params))
  };
}

function miss(params: any = {}) {
  return {
    ok: true,
    value: {
      hit: false,
      objectId: null,
      meshId: null,
      worldPos: null,
      tHit: null,
      triangleIndex: -1,
      rayOrigin: createVec3Float64(params.ray?.origin ?? [0, 0, -1]),
      rayDir: createVec3Float64(params.ray?.dir ?? [0, 0, 1])
    }
  };
}

function hit(params: {
  objectId?: string;
  meshId?: string;
  worldPos?: Vec3;
  tHit?: number;
} = {}) {
  return {
    ok: true,
    value: {
      hit: true,
      objectId: params.objectId ?? "wall",
      meshId: params.meshId ?? "mesh",
      worldPos: createVec3Float64(params.worldPos ?? [0, 0, -0.5]),
      tHit: params.tHit ?? 0.5,
      triangleIndex: 0,
      rayOrigin: createVec3Float64([0, 0, -1]),
      rayDir: createVec3Float64([0, 0, 1])
    }
  };
}

describe("MarkerOcclusionTester", () => {

  it("projects visible markers and raycasts only up to the biased marker distance", () => {
    const view = makeView();
    const raycaster = makeRaycaster([miss()]);
    const tester = new MarkerOcclusionTester({view, raycaster});

    const result = tester.update([{id: "m1", worldPos: [0, 0, 0]}]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0].visible).toBe(true);
    expect(result.value[0].occluded).toBe(false);
    expect(result.value[0].canvasPos).toEqual(new Float64Array([50, 50]));

    expect(raycaster.pick).toHaveBeenCalledTimes(1);
    const pickParams = raycaster.pick.mock.calls[0][0];
    expect(Array.from(pickParams.ray.origin)).toEqual([0, 0, -1]);
    expect(Array.from(pickParams.ray.dir)).toEqual([0, 0, 1]);
    expect(pickParams.tMin).toBeGreaterThan(0);
    expect(pickParams.tMax).toBeCloseTo(0.99);
    expect(pickParams.visiblePickableOnly).toBe(false);
  });

  it("reports markers hidden when an accepted hit is before the marker", () => {
    const view = makeView();
    const raycaster = makeRaycaster([hit()]);
    const tester = new MarkerOcclusionTester({view, raycaster});

    const result = tester.update([{id: "m1", worldPos: [0, 0, 0]}]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      visible: false,
      occluded: true,
      occluderObjectId: "wall",
      occluderMeshId: "mesh"
    });
  });

  it("filters occluders using rendered view state and caller filters", () => {
    const view = makeView();
    const raycaster = makeRaycaster([miss()]);
    const tester = new MarkerOcclusionTester({
      view,
      raycaster,
      params: {
        excludeObjectIds: ["global"],
        excludeStyleBinIds: ["ghosted"],
        occluderFilter: (objectId) => objectId !== "global2"
      }
    });

    const result = tester.update([{
      id: "m1",
      worldPos: [0, 0, 0],
      excludeObjectIds: ["local"],
      occluderFilter: (objectId) => objectId !== "local2"
    }]);

    expect(result.ok).toBe(true);
    const filter = raycaster.pick.mock.calls[0][0].filter;
    expect(filter("wall")).toBe(true);
    expect(filter("hidden")).toBe(false);
    expect(filter("culled")).toBe(false);
    expect(filter("ghosted")).toBe(false);
    expect(filter("transparent")).toBe(false);
    expect(filter("global")).toBe(false);
    expect(filter("global2")).toBe(false);
    expect(filter("local")).toBe(false);
    expect(filter("local2")).toBe(false);
  });

  it("continues past hits clipped by active section planes", () => {
    const view = makeView({
      sectionPlanes: {
        cut: {active: true, dir: [0, 0, 1], dist: 0}
      }
    });
    const raycaster = makeRaycaster([
      hit({worldPos: [0, 0, 0.5], tHit: 0.5}),
      miss()
    ]);
    const tester = new MarkerOcclusionTester({view, raycaster});

    const result = tester.update([{id: "m1", worldPos: [0, 0, 0]}]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0].visible).toBe(true);
    expect(result.value[0].occluded).toBe(false);
    expect(raycaster.pick).toHaveBeenCalledTimes(2);
    expect(raycaster.pick.mock.calls[1][0].tMin).toBeGreaterThan(0.5);
  });

  it("uses hide hysteresis for transient occlusion", () => {
    const view = makeView();
    const raycaster = makeRaycaster([miss(), hit(), hit()]);
    const tester = new MarkerOcclusionTester({
      view,
      raycaster,
      params: {hideDelayFrames: 2}
    });

    const first = tester.update([{id: "m1", worldPos: [0, 0, 0]}]);
    const second = tester.update();
    const third = tester.update();

    expect(first.ok && first.value[0].visible).toBe(true);
    expect(second.ok && second.value[0].visible).toBe(true);
    expect(second.ok && second.value[0].occluded).toBe(true);
    expect(third.ok && third.value[0].visible).toBe(false);
  });

  it("rejects duplicate marker ids", () => {
    const view = makeView();
    const raycaster = makeRaycaster([miss()]);
    const tester = new MarkerOcclusionTester({view, raycaster});

    const result = tester.setMarkers([
      {id: "m1", worldPos: [0, 0, 0]},
      {id: "m1", worldPos: [1, 0, 0]}
    ]);

    expect(result).toEqual({
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[MarkerOcclusionTester.setMarkers] Duplicate marker id: m1"
    });
  });
});
