import {createCullKernel} from "../CullKernel";
import type {CullingOutputMessage, UpdateItemsMessage, ViewChangedMessage} from "../CullingProtocol";
import {setFrustum3} from "../../../base/math/boundaries";
import {lookAtMat4v, perspectiveMat4} from "../../../base/math/matrix";

interface Item {
  index: number;
  center: [number, number, number];
  radius: number;
  cullable?: boolean;
}

function updateItems(items: Item[], removed: number[] = []): UpdateItemsMessage {
  const centers = new Float64Array(items.length * 3);
  const radii = new Float64Array(items.length);
  const cullable = new Uint8Array(items.length);
  const indices: number[] = [];
  items.forEach((item, k) => {
    indices.push(item.index);
    centers[k * 3] = item.center[0];
    centers[k * 3 + 1] = item.center[1];
    centers[k * 3 + 2] = item.center[2];
    radii[k] = item.radius;
    cullable[k] = (item.cullable ?? true) ? 1 : 0;
  });
  return {type: "UpdateItems", indices, centers, radii, cullable, removed};
}

// A perspective camera at `eye` looking at `look`, packed into a ViewChanged.
function viewChanged(
  viewId: string,
  eye: [number, number, number],
  look: [number, number, number],
  solidAngleLimit = 0.004
): ViewChangedMessage {
  const viewMat = lookAtMat4v(eye, look, [0, 1, 0]);
  const projMat = perspectiveMat4(Math.PI / 3, 1, 0.1, 10000);
  const frustum = setFrustum3(viewMat, projMat);
  const planes = new Float64Array(24);
  for (let i = 0; i < 6; i++) {
    const p = frustum.planes[i];
    planes[i * 4] = p.normal[0];
    planes[i * 4 + 1] = p.normal[1];
    planes[i * 4 + 2] = p.normal[2];
    planes[i * 4 + 3] = p.offset;
  }
  return {type: "ViewChanged", viewId, planes, eye: new Float64Array(eye), solidAngleLimit};
}

// Drives the kernel and returns every message it posted.
function run(messages: (UpdateItemsMessage | ViewChangedMessage)[]): CullingOutputMessage[] {
  const kernel = createCullKernel();
  const out: CullingOutputMessage[] = [];
  for (const message of messages) {
    kernel.handleMessage(message, (m) => out.push(m));
  }
  return out;
}

// Merges every CullResults posted for a view into a final culled set.
function culledSet(out: CullingOutputMessage[], viewId = "v1"): Set<number> {
  const culled = new Set<number>();
  for (const m of out) {
    if (m.type !== "CullResults" || m.viewId !== viewId) {
      continue;
    }
    m.newlyCulled.forEach((i) => culled.add(i));
    m.newlyUnCulled.forEach((i) => culled.delete(i));
  }
  return culled;
}

// Camera at origin looking down -Z.
const ITEMS: Item[] = [
  {index: 0, center: [0, 0, -10], radius: 1},      // in front, decent size
  {index: 1, center: [0, 0, 10], radius: 1},       // directly behind camera
  {index: 2, center: [100, 0, -10], radius: 1},    // far off to the side
  {index: 3, center: [0, 0, -500], radius: 0.1},   // tiny + far → small solid angle
  {index: 4, center: [0, 0, 0], radius: 5}          // camera is inside this sphere
];

describe("CullKernel", () => {

  it("culls behind, off-frustum, and sub-solid-angle items; keeps in-view and enclosing items", () => {
    const out = run([updateItems(ITEMS), viewChanged("v1", [0, 0, 0], [0, 0, -10])]);
    const culled = culledSet(out);
    expect(culled.has(1)).toBe(true);   // behind
    expect(culled.has(2)).toBe(true);   // to the side
    expect(culled.has(3)).toBe(true);   // too small
    expect(culled.has(0)).toBe(false);  // in view
    expect(culled.has(4)).toBe(false);  // camera inside
  });

  it("works regardless of message order (ViewChanged before UpdateItems)", () => {
    const out = run([viewChanged("v1", [0, 0, 0], [0, 0, -10]), updateItems(ITEMS)]);
    const culled = culledSet(out);
    expect([...culled].sort()).toEqual([1, 2, 3]);
  });

  it("emits an empty Done when the camera repeats with no changes", () => {
    const kernel = createCullKernel();
    const out: CullingOutputMessage[] = [];
    const post = (m: CullingOutputMessage) => out.push(m);
    kernel.handleMessage(updateItems(ITEMS), post);
    kernel.handleMessage(viewChanged("v1", [0, 0, 0], [0, 0, -10]), post);
    out.length = 0;
    kernel.handleMessage(viewChanged("v1", [0, 0, 0], [0, 0, -10]), post);
    expect(out).toEqual([{type: "Done", viewId: "v1"}]);
  });

  it("never size-culls a non-cullable item", () => {
    const items: Item[] = [{index: 0, center: [0, 0, -500], radius: 0.1, cullable: false}];
    const culled = culledSet(run([updateItems(items), viewChanged("v1", [0, 0, 0], [0, 0, -10])]));
    expect(culled.has(0)).toBe(false);
  });

  it("tracks cull state independently per view", () => {
    // One sphere in front of v1's camera but behind v2's (opposite-facing).
    const items: Item[] = [{index: 0, center: [0, 0, -10], radius: 1}];
    const kernel = createCullKernel();
    const out: CullingOutputMessage[] = [];
    const post = (m: CullingOutputMessage) => out.push(m);
    kernel.handleMessage(updateItems(items), post);
    kernel.handleMessage(viewChanged("v1", [0, 0, 0], [0, 0, -10]), post);   // looks at the sphere
    kernel.handleMessage(viewChanged("v2", [0, 0, 0], [0, 0, 10]), post);    // looks away
    expect(culledSet(out, "v1").has(0)).toBe(false);
    expect(culledSet(out, "v2").has(0)).toBe(true);
  });

  it("culls identically when the whole scene is offset to large world coordinates", () => {
    const OFFSET = 1_000_000;
    const offset = (c: [number, number, number]): [number, number, number] => [c[0] + OFFSET, c[1], c[2] + OFFSET];
    const items = ITEMS.map((it) => ({...it, center: offset(it.center)}));
    const out = run([
      updateItems(items),
      viewChanged("v1", [OFFSET, 0, OFFSET], [OFFSET, 0, OFFSET - 10])
    ]);
    const culled = culledSet(out);
    expect([...culled].sort()).toEqual([1, 2, 3]);
  });
});
