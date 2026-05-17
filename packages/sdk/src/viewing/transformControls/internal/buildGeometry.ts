import {TrianglesPrimitive} from "../../../base/constants";
import {composeMat4, createMat4Float64, type Mat4} from "../../../base/math/matrix";
import type {Vec3, Vec4} from "../../../base/math/vector";
import {angleAxisToQuaternion, type Quat} from "../../../base/math/quat";
import type {SceneModel} from "../../../model/scene";
import {
  COLOR_CENTER, COLOR_E, COLOR_PLANE_XY, COLOR_PLANE_XZ, COLOR_PLANE_YZ,
  COLOR_X, COLOR_Y, COLOR_Z,
} from "./colors";
import {
  H_AXIS_X, H_AXIS_Y, H_AXIS_Z,
  R_E, R_X, R_XYZE, R_Y, R_Z,
  S_X, S_XY, S_XYZ, S_XZ, S_Y, S_YZ, S_Z,
  T_X, T_XY, T_XYZ, T_XZ, T_Y, T_YZ, T_Z,
} from "./handleIds";
import {box, coneX, quadXY, sphere, torusX} from "./primitives";

const ZERO: Vec3 = [0, 0, 0];
const ONE:  Vec3 = [1, 1, 1];

function localMatrix(q: Quat): Mat4 {
  return composeMat4(ZERO, q, ONE, createMat4Float64());
}

/**
 * Output of {@link buildGeometry}.
 *
 * Hover-highlight on a SceneMesh works by mutating `mesh.color`, which
 * means each handle mesh must render with **no material** (otherwise
 * the material's colour wins). We therefore record the normal axis
 * colour per-mesh here so it can be restored on pointer-out.
 */
export interface BuiltGeometry {
  /** Per-mesh local matrix the gizmo uses to compose root × local each frame. */
  meshLocals: Record<string, Mat4>;
  /** Per-mesh normal colour, restored when the pointer leaves the handle. */
  meshNormalColor: Record<string, Vec3>;
}

/**
 * Builds every handle for every mode into the supplied SceneModel. Each
 * handle is its own SceneObject so the picker can identify it; each mesh
 * is created with a per-axis local matrix that the gizmo recomposes
 * against its root transform every frame.
 */
export function buildGeometry(
    sceneModel: SceneModel,
    layerId: string,
): BuiltGeometry {

  // ----- Geometries ---------------------------------------------
  const tShaftLen = 0.85;
  const tShaftR = 0.018;
  const tConeLen = 0.18;
  const tConeR = 0.07;
  const tPlaneOffset = 0.30;
  const tPlaneHalf = 0.16;
  const centreHalf = 0.075;

  const rMajorR = 1.0;
  const rTubeR  = 0.022;
  const rViewMajor = 1.18;
  const rViewTube = 0.022;

  const sShaftLen = 0.80;
  const sShaftR   = 0.018;
  const sEndHalf  = 0.08;
  const sPlaneOffset = 0.30;
  const sPlaneHalf   = 0.14;

  // Companion-picker dimensions. The picker geometry is a "fat
  // invisible collider" — same shape as the visible handle but
  // inflated so the user can click slightly outside the visible
  // mesh and still grab it. Runs as visible:false / pickable:true.
  const pickArrowR    = 0.05;
  const pickArrowLen  = tShaftLen + tConeLen;       // covers shaft + cone
  const pickPlaneHalf = 0.20;                       // tPlaneHalf 0.16 + tolerance
  const pickCentreHalf = 0.13;                      // centreHalf 0.075 + tolerance
  const pickRingTube  = 0.06;                       // rTubeR 0.022 + tolerance
  const pickSphereR   = 0.14;                       // sphere 0.085 + tolerance
  const pickSPlaneHalf = 0.18;                      // sPlaneHalf 0.14 + tolerance

  sceneModel.createGeometry({id: "__tc.shaft",     primitive: TrianglesPrimitive, ...box(0, -tShaftR, -tShaftR, tShaftLen, tShaftR, tShaftR)});
  sceneModel.createGeometry({id: "__tc.cone",      primitive: TrianglesPrimitive, ...coneX(tShaftLen, tShaftLen + tConeLen, tConeR, 16)});
  sceneModel.createGeometry({id: "__tc.plane",     primitive: TrianglesPrimitive, ...quadXY(tPlaneOffset - tPlaneHalf, tPlaneOffset - tPlaneHalf, tPlaneOffset + tPlaneHalf, tPlaneOffset + tPlaneHalf)});
  sceneModel.createGeometry({id: "__tc.centre",    primitive: TrianglesPrimitive, ...box(-centreHalf, -centreHalf, -centreHalf, centreHalf, centreHalf, centreHalf)});
  sceneModel.createGeometry({id: "__tc.ring",      primitive: TrianglesPrimitive, ...torusX(rMajorR, rTubeR, 64, 8)});
  sceneModel.createGeometry({id: "__tc.ringView",  primitive: TrianglesPrimitive, ...torusX(rViewMajor, rViewTube, 64, 8)});
  sceneModel.createGeometry({id: "__tc.sphere",    primitive: TrianglesPrimitive, ...sphere(0.085, 18, 12)});
  sceneModel.createGeometry({id: "__tc.sShaft",    primitive: TrianglesPrimitive, ...box(0, -sShaftR, -sShaftR, sShaftLen, sShaftR, sShaftR)});
  sceneModel.createGeometry({id: "__tc.sEnd",      primitive: TrianglesPrimitive, ...box(sShaftLen, -sEndHalf, -sEndHalf, sShaftLen + sEndHalf * 2, sEndHalf, sEndHalf)});
  sceneModel.createGeometry({id: "__tc.sPlane",    primitive: TrianglesPrimitive, ...quadXY(sPlaneOffset - sPlaneHalf, sPlaneOffset - sPlaneHalf, sPlaneOffset + sPlaneHalf, sPlaneOffset + sPlaneHalf)});

  // Picker geometries — lower-poly versions of the visible shapes,
  // inflated for tolerance. Reused across X/Y/Z variants via per-axis
  // mesh quaternions, same as the visible geometry.
  sceneModel.createGeometry({id: "__tc.pickArrow",   primitive: TrianglesPrimitive, ...box(0, -pickArrowR, -pickArrowR, pickArrowLen, pickArrowR, pickArrowR)});
  sceneModel.createGeometry({id: "__tc.pickPlane",   primitive: TrianglesPrimitive, ...quadXY(tPlaneOffset - pickPlaneHalf, tPlaneOffset - pickPlaneHalf, tPlaneOffset + pickPlaneHalf, tPlaneOffset + pickPlaneHalf)});
  sceneModel.createGeometry({id: "__tc.pickSPlane",  primitive: TrianglesPrimitive, ...quadXY(sPlaneOffset - pickSPlaneHalf, sPlaneOffset - pickSPlaneHalf, sPlaneOffset + pickSPlaneHalf, sPlaneOffset + pickSPlaneHalf)});
  sceneModel.createGeometry({id: "__tc.pickCentre",  primitive: TrianglesPrimitive, ...box(-pickCentreHalf, -pickCentreHalf, -pickCentreHalf, pickCentreHalf, pickCentreHalf, pickCentreHalf)});
  sceneModel.createGeometry({id: "__tc.pickRing",    primitive: TrianglesPrimitive, ...torusX(rMajorR, pickRingTube, 32, 6)});
  sceneModel.createGeometry({id: "__tc.pickRingV",   primitive: TrianglesPrimitive, ...torusX(rViewMajor, pickRingTube, 32, 6)});
  sceneModel.createGeometry({id: "__tc.pickSphere",  primitive: TrianglesPrimitive, ...sphere(pickSphereR, 12, 8)});

  // Hover-helper geometry: a single very thin, very long box along +X.
  // Reused for the X, Y, Z helpers via the same per-axis quaternions
  // that orient the visible arrows. Local-space length 200 units; with
  // the gizmo's screen-space root scale that's ~200× the rig's pixel
  // size in world space — long enough to read as an "infinite" axis
  // line for any reasonable camera distance, without making the GPU
  // vertex pipeline chew through a literal infinite-length primitive.
  const helperAxisHalfLen = 100;
  const helperAxisHalfThick = 0.003;
  sceneModel.createGeometry({
    id: "__tc.helperAxis",
    primitive: TrianglesPrimitive,
    ...box(-helperAxisHalfLen, -helperAxisHalfThick, -helperAxisHalfThick,
           +helperAxisHalfLen, +helperAxisHalfThick, +helperAxisHalfThick),
  });

  // ----- Local rotations (mesh-local quaternions) ---------------
  const qI: Quat = [0, 0, 0, 1];
  const qToY = angleAxisToQuaternion([0, 0, 1,  Math.PI / 2] as Vec4, [0, 0, 0, 1] as Quat);
  const qToZ = angleAxisToQuaternion([0, 1, 0, -Math.PI / 2] as Vec4, [0, 0, 0, 1] as Quat);
  // Plane-handle rotations place the visible quad in the
  // `(+X, +Y, +Z)` octant — between the two positive axes of the
  // plane it represents — to match the layout every other transform
  // gizmo uses. Flipping either sign here moves that plane handle
  // to the corresponding negative-axis octant.
  const qPlaneYZ = angleAxisToQuaternion([0, 1, 0, -Math.PI / 2] as Vec4, [0, 0, 0, 1] as Quat);
  const qPlaneXZ = angleAxisToQuaternion([1, 0, 0,  Math.PI / 2] as Vec4, [0, 0, 0, 1] as Quat);

  const meshLocals: Record<string, Mat4> = {};
  const meshNormalColor: Record<string, Vec3> = {};

  // ----- Helpers ------------------------------------------------
  // No materialId — runtime hover-swap writes mesh.color, which is
  // ignored when a material is attached. Each mesh gets its colour
  // (and per-handle opacity for plane handles) at construction.
  //
  // `bin: "overlay"` routes every gizmo handle through the renderer's
  // depth-cleared overlay pass so the rig appears to float over the
  // host scene, regardless of where the target sits in world space.
  const addMesh = (id: string, geometryId: string, color: Vec3, opacity: number, m: Mat4) => {
    sceneModel.createMesh({id, geometryId, color, opacity, matrix: m, bin: "overlay"});
    meshLocals[id] = m;
    meshNormalColor[id] = color;
  };
  const addObject = (objectId: string, meshIds: string[]) => {
    sceneModel.createObject({id: objectId, meshIds, layerId});
  };

  /**
   * Creates a companion-picker SceneObject for the visible handle
   * `objectId` using `pickerGeometryId`. The picker shares the
   * visible handle's local matrix so it tracks gizmo movement
   * automatically through `_syncTransform`.
   *
   * The picker is tagged with `bin: "overlayPicker"` — a sibling of
   * the `"overlay"` bin that the **colour** render path skips
   * entirely (it filters on `bin === "overlay"`), while the **pick**
   * path is extended to treat both `"overlay"` and `"overlayPicker"`
   * as overlay-bin so the picker mesh enters the depth-cleared,
   * `depthFunc(ALWAYS)` pick re-pass and wins pick priority. Result:
   * the picker draws nothing visible but still emits a pick ID when
   * the pointer lands within its inflated bounds.
   *
   * Marking the ViewObject `visible: false` would defeat this — the
   * renderer removes invisible meshes from the per-view pick
   * primitive ranges entirely, so `pickInvisible: true` can't get
   * them back. Keeping the ViewObject visible but bin-segregated is
   * the reliable path.
   */
  const addPicker = (objectId: string, pickerGeometryId: string, m: Mat4) => {
    const meshId = `${objectId}.picker.mesh`;
    sceneModel.createMesh({id: meshId, geometryId: pickerGeometryId, color: [0, 0, 0], opacity: 1.0, matrix: m, bin: "overlayPicker"});
    meshLocals[meshId] = m;
    sceneModel.createObject({id: `${objectId}.picker`, meshIds: [meshId], layerId});
  };

  // ----- Translate ---------------------------------------------
  const mkTAxis = (objectId: string, color: Vec3, q: Quat) => {
    const m = localMatrix(q);
    const sId = `${objectId}.shaft`;
    const cId = `${objectId}.cone`;
    addMesh(sId, "__tc.shaft", color, 1.0, m);
    addMesh(cId, "__tc.cone",  color, 1.0, m);
    addObject(objectId, [sId, cId]);
    addPicker(objectId, "__tc.pickArrow", m);
  };
  mkTAxis(T_X, COLOR_X, qI);
  mkTAxis(T_Y, COLOR_Y, qToY);
  mkTAxis(T_Z, COLOR_Z, qToZ);

  const mkTPlane = (objectId: string, color: Vec3, q: Quat) => {
    const m = localMatrix(q);
    const meshId = `${objectId}.quad`;
    addMesh(meshId, "__tc.plane", color, 0.45, m);
    addObject(objectId, [meshId]);
    addPicker(objectId, "__tc.pickPlane", m);
  };
  mkTPlane(T_XY, COLOR_PLANE_XY, qI);
  mkTPlane(T_YZ, COLOR_PLANE_YZ, qPlaneYZ);
  mkTPlane(T_XZ, COLOR_PLANE_XZ, qPlaneXZ);

  // Translate free
  const tCentreId = `${T_XYZ}.cube`;
  const tCentreM = localMatrix(qI);
  addMesh(tCentreId, "__tc.centre", COLOR_CENTER, 1.0, tCentreM);
  addObject(T_XYZ, [tCentreId]);
  addPicker(T_XYZ, "__tc.pickCentre", tCentreM);

  // ----- Rotate -------------------------------------------------
  const mkRRing = (objectId: string, color: Vec3, q: Quat, geomId: string, pickGeomId: string) => {
    const m = localMatrix(q);
    const meshId = `${objectId}.ring`;
    addMesh(meshId, geomId, color, 1.0, m);
    addObject(objectId, [meshId]);
    addPicker(objectId, pickGeomId, m);
  };
  mkRRing(R_X, COLOR_X, qI,   "__tc.ring", "__tc.pickRing");
  mkRRing(R_Y, COLOR_Y, qToY, "__tc.ring", "__tc.pickRing");
  mkRRing(R_Z, COLOR_Z, qToZ, "__tc.ring", "__tc.pickRing");
  // E ring (view-aligned) and XYZE trackball — initial local matrix is
  // identity; TransformControls re-orients them every frame against the
  // camera in _syncTransform.
  mkRRing(R_E, COLOR_E, qI, "__tc.ringView", "__tc.pickRingV");
  const xyzeId = `${R_XYZE}.sphere`;
  const xyzeM = localMatrix(qI);
  addMesh(xyzeId, "__tc.sphere", COLOR_CENTER, 1.0, xyzeM);
  addObject(R_XYZE, [xyzeId]);
  addPicker(R_XYZE, "__tc.pickSphere", xyzeM);

  // ----- Scale --------------------------------------------------
  const mkSAxis = (objectId: string, color: Vec3, q: Quat) => {
    const m = localMatrix(q);
    const sId = `${objectId}.shaft`;
    const eId = `${objectId}.end`;
    addMesh(sId, "__tc.sShaft", color, 1.0, m);
    addMesh(eId, "__tc.sEnd",   color, 1.0, m);
    addObject(objectId, [sId, eId]);
    addPicker(objectId, "__tc.pickArrow", m);
  };
  mkSAxis(S_X, COLOR_X, qI);
  mkSAxis(S_Y, COLOR_Y, qToY);
  mkSAxis(S_Z, COLOR_Z, qToZ);

  const mkSPlane = (objectId: string, color: Vec3, q: Quat) => {
    const m = localMatrix(q);
    const meshId = `${objectId}.quad`;
    addMesh(meshId, "__tc.sPlane", color, 0.45, m);
    addObject(objectId, [meshId]);
    addPicker(objectId, "__tc.pickSPlane", m);
  };
  mkSPlane(S_XY, COLOR_PLANE_XY, qI);
  mkSPlane(S_YZ, COLOR_PLANE_YZ, qPlaneYZ);
  mkSPlane(S_XZ, COLOR_PLANE_XZ, qPlaneXZ);

  const sCentreId = `${S_XYZ}.cube`;
  const sCentreM = localMatrix(qI);
  addMesh(sCentreId, "__tc.centre", COLOR_CENTER, 1.0, sCentreM);
  addObject(S_XYZ, [sCentreId]);
  addPicker(S_XYZ, "__tc.pickCentre", sCentreM);

  // ----- Hover helpers -----------------------------------------
  // One axis-line helper per axis. Shared across translate / rotate
  // / scale modes — the hover dispatcher in TransformControls picks
  // which helper(s) to show based on the hovered handle's axis label.
  // Helpers render through the `"overlay"` bin (so they float over
  // host geometry like the rest of the rig) and start out
  // ViewObject-hidden; TransformControls toggles them via the
  // dedicated ViewLayer's `objects[id].visible`.
  const mkHelperAxis = (objectId: string, color: Vec3, q: Quat) => {
    const m = localMatrix(q);
    const meshId = `${objectId}.line`;
    addMesh(meshId, "__tc.helperAxis", color, 1.0, m);
    addObject(objectId, [meshId]);
  };
  mkHelperAxis(H_AXIS_X, COLOR_X, qI);
  mkHelperAxis(H_AXIS_Y, COLOR_Y, qToY);
  mkHelperAxis(H_AXIS_Z, COLOR_Z, qToZ);

  return {meshLocals, meshNormalColor};
}
