import type {SceneModel} from "../../../../model/scene/SceneModel";
import type {SDKResult} from "../../../../base/core";
import {LinesPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import type {FDSModel, FDSXB} from "./types";
import {applyHoles} from "./applyHoles";
import {idMesh, idObst, idVent} from "./buildDataModel";

const GEOM_CUBE = "FDS::geom::cube";
const GEOM_QUAD = "FDS::geom::quad";
const GEOM_WIRE = "FDS::geom::wireBox";

const DEFAULT_OBST_COLOR: readonly [number, number, number] = [0.78, 0.78, 0.78];
const VENT_DEFAULT_COLOR: readonly [number, number, number] = [0.55, 0.75, 0.95];
const MESH_WIRE_COLOR:    readonly [number, number, number] = [0.45, 0.45, 0.45];

/**
 * Builds geometry for the parsed {@link FDSModel} into `sceneModel`.
 *
 * Three reusable {@link SceneGeometry} instances are created up front
 * (`cube`, `quad`, `wireBox`); per-element work is just a transformed
 * {@link SceneMesh} reference plus a {@link SceneObject} that owns it.
 *
 * SceneObject IDs match the DataObject IDs the
 * {@link buildDataModel} step produces so the renderer's
 * {@link viewing!viewer.ViewObject | ViewObject}s pair up with
 * semantics by default.
 *
 * @internal
 */
export function buildGeometry(model: FDSModel, sceneModel: SceneModel): SDKResult<void> {

  const cube = sceneModel.createGeometry(unitCube(GEOM_CUBE));
  if (cube.ok === false) return cube;

  const quad = sceneModel.createGeometry(unitQuad(GEOM_QUAD));
  if (quad.ok === false) return quad;

  const wire = sceneModel.createGeometry(unitWireBox(GEOM_WIRE));
  if (wire.ok === false) return wire;

  // ── Mesh outlines ────────────────────────────────────────────
  for (let i = 0; i < model.meshes.length; i++) {
    const xb = model.meshes[i].xb;
    const oid = idMesh(i);
    const meshId = `${oid}:wire`;
    const r = sceneModel.createMesh({
      id:         meshId,
      geometryId: GEOM_WIRE,
      color:      [...MESH_WIRE_COLOR],
      ...xbToTransform(xb),
    });
    if (r.ok === false) return r;
    const obj = sceneModel.createObject({id: oid, meshIds: [meshId]});
    if (obj.ok === false) return obj;
  }

  // ── Obstructions (post-hole remainder boxes) ─────────────────
  const remainders = applyHoles(model.obsts, model.holes);
  const obstMeshIds = new Map<number, string[]>();
  for (const r of remainders) {
    const obstIdx = model.obsts.indexOf(r.obst);  // O(N) but N is in the hundreds
    const oid = idObst(obstIdx);
    const meshId = `${oid}:${r.index}`;
    const color = resolveColor(model, r.obst.surfId, r.obst.rgb, DEFAULT_OBST_COLOR);
    const res = sceneModel.createMesh({
      id:         meshId,
      geometryId: GEOM_CUBE,
      color,
      ...xbToTransform(r.xb),
    });
    if (res.ok === false) return res;
    let arr = obstMeshIds.get(obstIdx);
    if (!arr) { arr = []; obstMeshIds.set(obstIdx, arr); }
    arr.push(meshId);
  }
  for (const [i, meshIds] of obstMeshIds) {
    if (meshIds.length === 0) continue;
    const obj = sceneModel.createObject({id: idObst(i), meshIds});
    if (obj.ok === false) return obj;
  }

  // ── Vents ────────────────────────────────────────────────────
  for (let i = 0; i < model.vents.length; i++) {
    const v = model.vents[i];
    const xb = v.xb;
    if (!xb) continue;     // MB-only VENTs are skipped in v1
    const oid = idVent(i);
    const meshId = `${oid}:quad`;
    const color = resolveColor(model, v.surfId, v.rgb, VENT_DEFAULT_COLOR);
    const res = sceneModel.createMesh({
      id:         meshId,
      geometryId: GEOM_QUAD,
      color,
      ...xbToTransform(xb),
    });
    if (res.ok === false) return res;
    const obj = sceneModel.createObject({id: oid, meshIds: [meshId]});
    if (obj.ok === false) return obj;
  }

  return {ok: true, value: undefined};
}

// ─────────── helpers ───────────

/**
 * Translation + scale that maps a unit-`[0,1]^3` source geometry onto
 * the AABB defined by `xb`. The cube / quad / wireBox geometries are
 * authored in `[0,1]^3` so this is just (origin, extent).
 *
 * Quad faces +Z by default — when XB describes a face with zero extent
 * on one axis, the quad is sized to zero on that axis and lies flat
 * in the other two, which is the result we want for VENTs.
 */
function xbToTransform(xb: FDSXB) {
  const x1 = Math.min(xb[0], xb[1]); const x2 = Math.max(xb[0], xb[1]);
  const y1 = Math.min(xb[2], xb[3]); const y2 = Math.max(xb[2], xb[3]);
  const z1 = Math.min(xb[4], xb[5]); const z2 = Math.max(xb[4], xb[5]);
  return {
    position: [x1, y1, z1] as [number, number, number],
    scale:    [Math.max(x2 - x1, 0), Math.max(y2 - y1, 0), Math.max(z2 - z1, 0)] as [number, number, number],
  };
}

function resolveColor(
  model: FDSModel,
  surfId: string | undefined,
  rgb: readonly [number, number, number] | undefined,
  fallback: readonly [number, number, number],
): [number, number, number] {
  if (rgb) return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
  if (surfId) {
    const surf = model.surfs.get(surfId);
    if (surf?.rgb)   return [surf.rgb[0] / 255, surf.rgb[1] / 255, surf.rgb[2] / 255];
    if (surf?.color) {
      const named = NAMED_COLORS[surf.color.toUpperCase()];
      if (named) return [...named];
    }
  }
  return [fallback[0], fallback[1], fallback[2]];
}

/**
 * The 16 most common FDS COLOR names. Anything else falls back to
 * the obstruction default grey. FDS supports the full X11 list; we
 * only need the handful authors actually use.
 */
const NAMED_COLORS: Record<string, readonly [number, number, number]> = {
  WHITE:      [1.00, 1.00, 1.00],
  BLACK:      [0.00, 0.00, 0.00],
  RED:        [1.00, 0.00, 0.00],
  GREEN:      [0.00, 0.80, 0.00],
  BLUE:       [0.00, 0.00, 1.00],
  YELLOW:     [1.00, 1.00, 0.00],
  ORANGE:     [1.00, 0.55, 0.00],
  CYAN:       [0.00, 1.00, 1.00],
  MAGENTA:    [1.00, 0.00, 1.00],
  GRAY:       [0.50, 0.50, 0.50],
  GREY:       [0.50, 0.50, 0.50],
  BROWN:      [0.55, 0.27, 0.07],
  TAN:        [0.82, 0.71, 0.55],
  STEEL:      [0.45, 0.55, 0.60],
  CONCRETE:   [0.78, 0.78, 0.74],
  WOOD:       [0.55, 0.40, 0.20],
};

// ─────────── unit geometries ───────────

function unitCube(id: string) {
  // 8 vertices, 12 triangles. Authored in [0,1]^3 so a per-mesh
  // (position, scale) does all the placement.
  const positions = new Float32Array([
    0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0,   // bottom z=0
    0, 0, 1,  1, 0, 1,  1, 1, 1,  0, 1, 1,   // top    z=1
  ]);
  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3,    // bottom (Z-min)
    4, 6, 5, 4, 7, 6,    // top    (Z-max)
    0, 4, 5, 0, 5, 1,    // front  (Y-min)
    2, 6, 7, 2, 7, 3,    // back   (Y-max)
    0, 3, 7, 0, 7, 4,    // left   (X-min)
    1, 5, 6, 1, 6, 2,    // right  (X-max)
  ]);
  return {id, primitive: TrianglesPrimitive, positions, indices};
}

function unitQuad(id: string) {
  // Quad in the XY plane at Z=0. VENT bounds typically have zero
  // extent on one axis; that axis's scale=0 collapses the quad to a
  // line, which we accept silently — the FDS author asked for it.
  const positions = new Float32Array([
    0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0,
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  return {id, primitive: TrianglesPrimitive, positions, indices};
}

function unitWireBox(id: string) {
  // 12 line segments outlining a unit cube.
  const positions = new Float32Array([
    0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0,
    0, 0, 1,  1, 0, 1,  1, 1, 1,  0, 1, 1,
  ]);
  const indices = new Uint32Array([
    0, 1,  1, 2,  2, 3,  3, 0,   // bottom loop
    4, 5,  5, 6,  6, 7,  7, 4,   // top loop
    0, 4,  1, 5,  2, 6,  3, 7,   // verticals
  ]);
  return {id, primitive: LinesPrimitive, positions, indices};
}
