// Routing rule coverage for RoutingPickStrategy — in particular that a scene
// holding gaussian splats sends plain canvas picks to the GPU leaf (splats have
// no BVH triangles, so only the GPU pick pass can hit them), while filter / ray
// picks still fall through to BVH. The BVH/GPU leaves are mocked so the test
// exercises only the routing decision, not the real raycaster / renderer.

import {GaussianSplatsPrimitive, PointsPrimitive} from "../../../base/constants";
import {RoutingPickStrategy} from "../RoutingPickStrategy";

jest.mock("../BVHPickStrategy", () => ({
  BVHPickStrategy: jest.fn().mockImplementation(() => ({
    pick: jest.fn(() => ({_stateEpoch: 0, leaf: "bvh"})),
  })),
}));
jest.mock("../RendererPickStrategy", () => ({
  RendererPickStrategy: jest.fn().mockImplementation(() => ({
    pick: jest.fn(() => ({_stateEpoch: 0, leaf: "gpu"})),
  })),
}));

function makeRenderer(opts: {rendering: boolean}) {
  const event = {subscribe: () => () => { /* unsub */ }};
  return {
    rendering: opts.rendering,
    events: {
      onViewerAttached: event,
      onViewerDetached: event,
      onRendererStarted: event,
      onRendererStopped: event,
      onRendererDestroyed: event,
      webglContextLost: event,
      webglContextRestored: event,
    },
  } as any;
}

// Primitive presence is scene state — the strategy asks scene.containsPrimitive().
function makeScene(opts: {hasSplats?: boolean; hasPoints?: boolean}) {
  return {
    containsPrimitive: (primitive: number) =>
      (primitive === GaussianSplatsPrimitive && !!opts.hasSplats) ||
      (primitive === PointsPrimitive && !!opts.hasPoints)
  } as any;
}

function leafOf(strategy: RoutingPickStrategy, params: any): string {
  return strategy.pick(params).leaf;
}

describe("RoutingPickStrategy splat routing", () => {

  it("sends plain canvas picks to the GPU when the scene has splats", () => {
    const strategy = new RoutingPickStrategy(makeScene({hasSplats: true}), makeRenderer({rendering: true}));
    expect(leafOf(strategy, {canvasPos: [10, 10]})).toBe("gpu");
  });

  it("sends plain canvas picks to the GPU when the scene has points", () => {
    const strategy = new RoutingPickStrategy(makeScene({hasPoints: true}), makeRenderer({rendering: true}));
    expect(leafOf(strategy, {canvasPos: [10, 10]})).toBe("gpu");
  });

  it("keeps surface-normal picks on BVH even when the scene has splats", () => {
    const strategy = new RoutingPickStrategy(makeScene({hasSplats: true}), makeRenderer({rendering: true}));
    expect(leafOf(strategy, {canvasPos: [10, 10], pickSurfaceNormal: true})).toBe("bvh");
  });

  it("keeps surface-normal picks on BVH even when the scene has points", () => {
    const strategy = new RoutingPickStrategy(makeScene({hasPoints: true}), makeRenderer({rendering: true}));
    expect(leafOf(strategy, {canvasPos: [10, 10], pickSurfaceNormal: true})).toBe("bvh");
  });

  it("sends plain canvas picks to BVH when the scene has no splats", () => {
    const strategy = new RoutingPickStrategy(makeScene({hasSplats: false}), makeRenderer({rendering: true}));
    expect(leafOf(strategy, {canvasPos: [10, 10]})).toBe("bvh");
  });

  it("keeps filter picks on BVH even with splats (GPU has no filter)", () => {
    const strategy = new RoutingPickStrategy(makeScene({hasSplats: true}), makeRenderer({rendering: true}));
    expect(leafOf(strategy, {canvasPos: [10, 10], filter: () => true})).toBe("bvh");
  });

  it("keeps ray picks on BVH even with splats (GPU pick is canvas-only)", () => {
    const strategy = new RoutingPickStrategy(makeScene({hasSplats: true}), makeRenderer({rendering: true}));
    expect(leafOf(strategy, {ray: {origin: [0, 0, 0], dir: [0, 0, 1]}})).toBe("bvh");
  });

  it("falls back to BVH when the GPU isn't ready, even with splats", () => {
    const strategy = new RoutingPickStrategy(makeScene({hasSplats: true}), makeRenderer({rendering: false}));
    expect(leafOf(strategy, {canvasPos: [10, 10]})).toBe("bvh");
  });

  it("still routes snap requests to the GPU (existing behaviour)", () => {
    const strategy = new RoutingPickStrategy(makeScene({hasSplats: false}), makeRenderer({rendering: true}));
    expect(leafOf(strategy, {canvasPos: [10, 10], snapToVertex: true})).toBe("gpu");
  });
});
