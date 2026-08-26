/**
 * Standalone builder for the translucent backing panel that sits
 * behind a 2D orthographic drawing.
 *
 * Inside {@link buildDrawing} the same function is called whenever
 * {@link DrawingProjectionParams.panel} is supplied; the result is
 * the inside-out 3D box (one wall on either side of the projection
 * plane, framed by `margin` in the basis u/v axes) used as the
 * backing surface for wireframe, fills, and title block.
 *
 * @module drawings/buildDrawingPanel
 */
import {
  LinearEncoding,
  LinearFilter,
  sRGBEncoding,
  TrianglesPrimitive,
} from "@xeokit/sdk/base/constants";
import type {SDKResult} from "@xeokit/sdk/base/core";
import type {FloatArrayParam} from "@xeokit/sdk/base/math";
import type {SceneModel} from "@xeokit/sdk/model/scene";

import type {PanelSpec} from "./chrome/PanelSpec";
import type {ProjectionBasis} from "./ProjectionBasis";
import {
  basisHandedness,
  basisUVExtents,
  computeBasisDMin,
  recenterPositions,
} from "./internal/basisMath";


/**
 * Inputs to {@link buildDrawingPanel}.
 */
export interface BuildDrawingPanelParams {

  /**
   * SceneModel the panel geometry / material / mesh / object are
   * created in. Must be unfinalised.
   */
  targetModel: SceneModel;

  /**
   * Orthonormal `{right, up, forward}` basis. The panel box is
   * thin along `forward` and grows in `right` / `up`.
   */
  basis: ProjectionBasis;

  /**
   * World-space AABB the panel must cover —
   * `[xMin, yMin, zMin, xMax, yMax, zMax]`. The panel's
   * image-plane extent comes from projecting these 8 corners onto
   * the basis `right`/`up` axes (plus {@link margin}).
   */
  aabb: FloatArrayParam;

  /**
   * Basis-d coord of the projection plane the panel sits on —
   * the same plane the rest of the drawing's geometry is projected
   * onto. The panel box is positioned slightly on either side of
   * this depth to avoid coincident geometry.
   */
  planeDepth: number;

  /**
   * World-space margin grown beyond the AABB's projected extent
   * on every side, in the basis u and v axes. Match the drawing's
   * frame margin so the panel covers the framed area plus its
   * border. Default `0`.
   */
  margin?: number;

  /**
   * Panel styling: colour, opacity, optional PBR painter,
   * triplanar texture scale. See {@link PanelSpec}.
   */
  spec?: PanelSpec;

  /**
   * Anchor subtracted from every emitted position before
   * `createGeometry`, then passed back as the mesh's `position`
   * so the world placement carries the full-precision offset in
   * the mesh's Float64 local matrix. Lets the panel sit far from
   * the world origin without losing precision in the
   * SceneGeometry's Float32 AABB. Default `[0, 0, 0]`.
   */
  origin?: [number, number, number];

  /**
   * Optional ViewLayer id assigned to the emitted SceneObject so
   * the host can hide / show / style the panel collectively with
   * the rest of the drawing's chrome.
   */
  layerId?: string;
}


/**
 * Emit the translucent backing panel for a drawing into a
 * SceneModel.
 *
 * Builds an inside-out 3D box around the projected AABB region —
 * one wall on either side of the projection plane, framed by
 * `margin` in the basis u/v axes. Inside-out winding (vertices
 * ordered so face normals point inward) routes the geometry
 * through the renderer's transparent pass with `gl.CULL_FACE`
 * enabled, so the camera-facing wall's back face is culled and
 * the opposite wall shows through as the backdrop.
 *
 * When {@link PanelSpec.paint} is supplied, the painter is called
 * once and a SceneMaterial bound to the resulting colour + normal
 * + metallic-roughness textures is created on the target
 * SceneModel. The panel mesh has no UVs; the renderer's triplanar
 * fallback samples by world position and `triplanarScale` =
 * {@link PanelSpec.textureScale}.
 *
 * Creates four ids on the target SceneModel:
 *  - `{targetId}__panel_geom` — SceneGeometry
 *  - `{targetId}__panel_mesh` — SceneMesh
 *  - `{targetId}__panel`      — SceneObject (clippable: false)
 *  - `{targetId}__panel_mat`  — SceneMaterial (only when `spec.paint` is set)
 */
export function buildDrawingPanel(params: BuildDrawingPanelParams): SDKResult<unknown> {
  const target     = params.targetModel;
  const basis      = params.basis;
  const aabb       = params.aabb;
  const planeDepth = params.planeDepth;
  const margin     = params.margin ?? 0;
  const spec       = params.spec   ?? {};
  const origin     = params.origin ?? [0, 0, 0];
  const layerId    = params.layerId;

  // Default colour swaps depending on whether a painter is
  // supplied: a painter expects a white tint so its sampled
  // colour shows through unmodified; without one, we fall back
  // to the cool off-white the old flat-colour panel used.
  const color   = spec.color   ?? (spec.paint ? [1, 1, 1] : [0.96, 0.97, 0.99]);
  const opacity = spec.opacity ?? 0.55;
  const gap = 0.05;

  // Box extents in basis space. The box is thin along
  // `basis.forward` (one wall on the camera side of the plane,
  // one on the AABB side) and is grown by `margin` in the
  // image-plane axes so it covers the framed area plus border.
  //
  // `dInner` (the AABB-side wall) is clamped so the inset
  // never crosses into the source AABB — when `offset < gap`
  // the inner wall coincides with the AABB face instead of
  // dipping inside.
  const {uMin, uMax, vMin, vMax} = basisUVExtents(basis, aabb);
  const dMin = computeBasisDMin(basis, aabb);
  const u0 = uMin - margin, u1 = uMax + margin;
  const v0 = vMin - margin, v1 = vMax + margin;
  const dOuter = planeDepth - gap;
  const dInner = Math.min(planeDepth + gap, dMin);

  // 8 corners of the box, numbered by a 3-bit basis-axis bit
  // pattern: bit 0 = u choice (0 → u0, 1 → u1), bit 1 = v
  // choice, bit 2 = d choice (0 → dInner, 1 → dOuter).
  //
  //         7──────6           +up
  //        ╱│      │            │  +forward
  //       3──────2 │            │ ╱
  //       │ 4────│─5            │╱
  //       │╱     │╱             ┕── +right
  //       0──────1
  //
  // World position of corner i is `u_i*right + v_i*up + d_i*forward`.
  const r = basis.right, up = basis.up, f = basis.forward;
  const corner = (uu: number, vv: number, dd: number): [number, number, number] => [
    uu * r[0] + vv * up[0] + dd * f[0],
    uu * r[1] + vv * up[1] + dd * f[1],
    uu * r[2] + vv * up[2] + dd * f[2],
  ];
  const c0 = corner(u0, v0, dInner);
  const c1 = corner(u1, v0, dInner);
  const c2 = corner(u1, v1, dInner);
  const c3 = corner(u0, v1, dInner);
  const c4 = corner(u0, v0, dOuter);
  const c5 = corner(u1, v0, dOuter);
  const c6 = corner(u1, v1, dOuter);
  const c7 = corner(u0, v1, dOuter);
  const positions: number[] = [
    c0[0], c0[1], c0[2],  c1[0], c1[1], c1[2],  c2[0], c2[1], c2[2],  c3[0], c3[1], c3[2],
    c4[0], c4[1], c4[2],  c5[0], c5[1], c5[2],  c6[0], c6[1], c6[2],  c7[0], c7[1], c7[2],
  ];

  // Inside-out winding: triangles oriented so `(b-a)×(c-a)`
  // points *into* the box. For a left-handed basis (the case
  // for five of the six face presets — only "front" is
  // right-handed) the natural index table below is correct;
  // for a right-handed basis the cross-product direction flips
  // through the basis-to-world transform, so we swap the last
  // two vertices of each triangle to reverse the world normal
  // back to inward.
  const flip = basisHandedness(basis) > 0;
  const tri = (a: number, b: number, c: number): number[] =>
      flip ? [a, c, b] : [a, b, c];
  const indices: number[] = [
    // dInner face (AABB-side wall, corners 0,1,2,3)
    ...tri(0, 1, 2), ...tri(0, 2, 3),
    // dOuter face (camera-side wall, corners 4,5,6,7)
    ...tri(4, 7, 6), ...tri(4, 6, 5),
    // v=v0 face (corners 0,1,5,4)
    ...tri(0, 4, 5), ...tri(0, 5, 1),
    // v=v1 face (corners 2,3,7,6)
    ...tri(3, 2, 6), ...tri(3, 6, 7),
    // u=u0 face (corners 0,3,7,4)
    ...tri(0, 3, 7), ...tri(0, 7, 4),
    // u=u1 face (corners 1,2,6,5)
    ...tri(1, 5, 6), ...tri(1, 6, 2),
  ];

  const gid = `${target.id}__panel_geom`;
  const mid = `${target.id}__panel_mesh`;
  const oid = `${target.id}__panel`;

  recenterPositions(positions, origin);
  const gRes = target.createGeometry({
    id: gid,
    // TrianglesPrimitive routes through the renderer's transparent
    // pass when opacity < 1, which enables `gl.CULL_FACE` —
    // that's what makes the inward-wound box render as
    // "inside-out": the camera-facing wall's back face is culled
    // and the opposite wall's front face shows through as the
    // backdrop. (`SolidPrimitive` isn't registered in the
    // renderer's draw-op map and would silently skip the mesh.)
    primitive: TrianglesPrimitive,
    positions,
    indices,
  });
  if (gRes.ok === false) return gRes;

  // Optional PBR material — paint once and upload colour, normal,
  // and metallic-roughness textures into the target SceneModel.
  // The mesh below binds the material via `materialId`; the
  // renderer's triplanar fallback samples the textures by world
  // position because the quad geometry has no UVs.
  let materialId: string | undefined;
  if (spec.paint) {
    const maps = spec.paint();
    const matSuffix = "__panel";
    const cTexId = `${target.id}${matSuffix}_color_tex`;
    const nTexId = `${target.id}${matSuffix}_normal_tex`;
    const mTexId = `${target.id}${matSuffix}_mr_tex`;
    const matId  = `${target.id}${matSuffix}_mat`;

    const cTex = target.createTexture({
      id: cTexId, mipmap: true, imageData: maps.color,
      encoding: sRGBEncoding, minFilter: LinearFilter, flipY: false,
    });
    if (cTex.ok === false) return cTex;
    const nTex = target.createTexture({
      id: nTexId, mipmap: true, imageData: maps.normal,
      encoding: LinearEncoding, minFilter: LinearFilter, flipY: false,
    });
    if (nTex.ok === false) return nTex;
    const mTex = target.createTexture({
      id: mTexId, mipmap: true, imageData: maps.mr,
      encoding: LinearEncoding, minFilter: LinearFilter, flipY: false,
    });
    if (mTex.ok === false) return mTex;

    const matRes = target.createMaterial({
      id:                         matId,
      colorTextureId:             cTexId,
      normalsTextureId:           nTexId,
      metallicRoughnessTextureId: mTexId,
      triplanarScale:             spec.textureScale ?? 1.0,
      alphaMode:                  opacity < 1 ? "BLEND" : "OPAQUE",
    });
    if (matRes.ok === false) return matRes;
    materialId = matId;
  }

  const mRes = target.createMesh({
    id: mid,
    geometryId: gid,
    position: origin,
    color,
    opacity,
    ...(materialId ? {materialId} : {}),
  });
  if (mRes.ok === false) return mRes;
  return target.createObject({
    id: oid,
    meshIds: [mid],
    clippable: false,
    ...(layerId ? {layerId} : {}),
  });
}
