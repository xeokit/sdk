import type {SceneModel} from "../../model/scene";
import type {Data} from "../../model/data";
import type {FloatArrayParam} from "../../base/math";
import type {Vec3} from "../../base/math/vector";

import type {DrawingProjectionDirection} from "./DrawingProjectionDirection";
import type {DrawingClipSpec} from "./DrawingClipSpec";
import type {ProgressiveSpec} from "./ProgressiveSpec";
import type {HLEOptions} from "./hle/HLEOptions";
import type {FillSpec} from "./fills/FillSpec";
import type {PanelSpec} from "./chrome/PanelSpec";
import type {TitleBlockSpec} from "./chrome/TitleBlockSpec";
import type {SpaceLabelSpec} from "./labels/SpaceLabelSpec";

export interface DrawingProjectionParams {

  /**
   * Source {@link model!scene.SceneModel | SceneModel} whose geometry
   * is projected. Read-only — the projection consumes its
   * triangles and edges but does not mutate it.
   */
  sourceModel: SceneModel;

  /**
   * Caller-owned target {@link model!scene.SceneModel | SceneModel} the
   * projection writes into. May live in the same
   * {@link model!scene.Scene | Scene} as `sourceModel`, or in a different
   * one — the function only needs `targetModel.scene` for the
   * components it creates on the target side, and reads world
   * orientation and collision data from `sourceModel.scene`.
   *
   * The caller creates and destroys this SceneModel. On error,
   * partial state may have been written; the caller is
   * responsible for tearing it down if needed.
   */
  targetModel: SceneModel;

  /**
   * Projection direction. Pass one of the six face-name
   * presets ({@link DrawingProjectionFace}) for an
   * axis-aligned view of the AABB, or a
   * {@link DrawingProjectionRay | `{forward, up?}`} for an
   * arbitrary diagonal direction.
   */
  direction: DrawingProjectionDirection;

  /**
   * Optional offset (world units) of the projection plane beyond
   * the AABB face, in the outward face-normal direction. Useful
   * when you want the wireframe to float a hair outside the box
   * so it doesn't z-fight the source geometry. Default 0.
   */
  offset?: number;

  /**
   * Optional world-space AABB to use as the projection box.
   * Format: `[xMin, yMin, zMin, xMax, yMax, zMax]`. When omitted
   * the function computes it on the fly by walking every mesh's
   * world-space positions — the bound matches the source model's
   * actual extent. Pass an explicit AABB (e.g. from
   * `studio.picking.collisionIndex.getSceneAABB()`) when you want
   * the wireframe to sit on the bounds of more than one model.
   */
  aabb?: FloatArrayParam;

  /**
   * Optional RGB line color (each channel in `[0, 1]`) applied
   * to every emitted wireframe mesh. Defaults to black. Per-mesh
   * colour overrides aren't supported yet; the prototype is
   * single-style for now.
   */
  color?: Vec3;

  /**
   * Optional pixel thickness for the projected line meshes
   * (wireframe + frame border). When set, the projector creates
   * a single SceneMaterial inside the target SceneModel
   * (`{targetModel.id}__lineMat`) carrying this `lineWidth`, and
   * attaches it to every emitted line mesh. The thick-line
   * draw technique reads the material's `lineWidth` per mesh in
   * the vertex shader. Omit to fall back to the View's
   * `linesMaterial.lineWidth`.
   *
   * The panel quads are triangles, not lines, so this value
   * doesn't affect them.
   */
  lineWidth?: number;

  /**
   * Optional ViewLayer id assigned to every {@link model!scene.SceneObject | SceneObject}
   * the projector emits — wireframe-line objects, the frame
   * border, the backing panel, and the optional title block.
   * Lets the host keep the default ViewLayer clear of
   * projection artefacts so the loaded model rules its own
   * layer, while a host-defined "drawings" layer (or
   * similar) carries every projection. Omit to leave each
   * emitted object on the SceneModel's default layer.
   */
  layerId?: string;

  /**
   * Optional rectangular frame drawn on the projection plane,
   * sized to enclose the projected geometry plus a margin.
   * Drawn as a single un-pickable {@link model!scene.SceneObject | SceneObject} inside the
   * target SceneModel with id `"{targetModel.id}__frame"`. Set
   * `true` for a default `1` world-unit margin, or pass a
   * number to set the margin explicitly. Default `false` —
   * no frame.
   */
  frame?: boolean | number;

  /**
   * Optional RGB color for the frame rectangle. Falls back to
   * {@link DrawingProjectionParams.color | color} when not
   * supplied, then to black.
   */
  frameColor?: Vec3;

  /**
   * Optional title block — a standard technical-drawing title
   * cartouche drawn at the bottom-right of the frame. Pass a
   * heading plus zero or more labelled rows. The block sizes
   * itself relative to the frame dimensions; text is built via
   * `procgen.buildVectorText`
   * and oriented to face the viewer for each AABB face.
   */
  titleBlock?: TitleBlockSpec;

  /**
   * Optional translucent backing quad — a filled triangle pair
   * drawn on the projection plane, slightly inset toward the
   * AABB so the wireframe and frame lines render in front of
   * it. Gives the projection a "ghosted drawing" look against
   * the model behind. Pass `true` for a default white-grey with
   * 0.55 opacity, or pass the spec object to customise.
   */
  panel?: boolean | PanelSpec;

  /**
   * Optional hidden-line elimination. When enabled, every edge
   * is tested against a depth buffer rasterised from the source
   * model's triangles along the projection direction, and
   * occluded portions are dropped from the emitted line
   * geometry. Pass `true` for defaults, or pass {@link HLEOptions}
   * to tune the depth-buffer resolution, per-edge sample count,
   * and visibility-bias tolerance.
   *
   * Trades off speed vs. quality: a 1024-pixel buffer over a
   * typical building takes ~100 ms to build, and the per-edge
   * test adds ~`samples` × O(1) per edge — usually a small
   * fraction of the projection cost.
   */
  hideHidden?: boolean | HLEOptions;

  /**
   * Optional filled-polygon emission alongside the wireframe
   * edges. When enabled, the projector reuses the HLE depth
   * buffer (building one if {@link DrawingProjectionParams.hideHidden | hideHidden}
   * is off) to derive per-pixel ownership, traces each source
   * SceneObject's visibility mask into closed contours, and
   * emits a TrianglesPrimitive fill mesh attached to the same
   * {@link model!scene.SceneObject | SceneObject} as that source's wireframe lines.
   *
   * Fill polygons are pixel-aligned with the wireframe edges
   * because both derive from the same depth buffer — no halo
   * at occlusion boundaries. Pass `true` for a light off-white
   * opaque default, or pass a {@link FillSpec} to customise.
   */
  fill?: boolean | FillSpec;

  /**
   * Whether to emit projected line geometry. Default `true`.
   * Set to `false` to produce a fills-only projection — useful
   * with {@link DrawingProjectionParams.fill | fill} for a
   * "solid drawing" look where each source SceneObject's
   * silhouette is filled without any line work. With no lines
   * and no fills the projection is empty and the call fails.
   */
  lines?: boolean;

  /**
   * Optional clipping plane(s) — turn the projection into a
   * cut-away / sliced cross-section. Source geometry whose
   * centroid lies on the discarded side of **any** supplied
   * plane is dropped during rasterisation (HLE) and
   * tile-rasterisation (fills), and skipped in the per-edge
   * wireframe loop. The kept region is the intersection of
   * every plane's kept half-space.
   *
   * Pass a single {@link DrawingClipSpec} for one cut, or an
   * array of specs to apply multiple cuts at once — typically
   * fed from a View's
   * {@link viewing!viewer.View.sectionPlanesList | active SectionPlanes}.
   *
   * Each spec takes one of two shapes:
   *
   * - `{depth: number}` — plane perpendicular to
   *   `basis.forward` at the given basis-d coordinate. The
   *   side **closer to the camera** (smaller basis-d) is
   *   discarded, the side farther in is kept. Matches the
   *   architectural "plan" / "section" convention: for a top
   *   view, `depth = -worldUpValue` cuts the model at the
   *   floor level `worldUpValue` and keeps everything below.
   *
   * - `{point, normal}` — arbitrary world-space plane. The
   *   side `normal` points toward is kept; the opposite side
   *   is discarded. Useful for diagonal cut-aways (e.g. a
   *   knife cut along an oblique direction) or for mirroring
   *   a {@link viewing!viewer.SectionPlane | SectionPlane}
   *   (use `point: plane.pos` and `normal: -plane.dir` so the
   *   kept side matches what the View renders).
   *
   * Clipping is centroid-based (per-triangle), so the cut
   * boundary is sub-pixel jagged — invisible at the default
   * 2048+ buffer resolutions. Chrome (frame border, panel
   * box, title block) is never clipped — it's not part of
   * the source model.
   */
  clip?: DrawingClipSpec | DrawingClipSpec[];

  /**
   * Optional {@link model!data.Data | Data} graph that pairs
   * with `sourceModel` by SceneObject id. Required when
   * {@link DrawingProjectionParams.spaceLabels | spaceLabels}
   * is enabled — the label pass reads each source object's
   * {@link model!data.DataObject.type | DataObject.type} and
   * {@link model!data.DataObject.name | DataObject.name} from
   * this graph. Ignored when no Data-driven feature is on.
   */
  data?: Data;

  /**
   * Optional in-polygon labels for each labelled source object
   * (rooms / spaces). Requires {@link DrawingProjectionParams.fill | fill}
   * to be on so the projector has the fill polygons it needs
   * to find the pole-of-inaccessibility per object, and
   * requires {@link DrawingProjectionParams.data | data} so it
   * can read each candidate's name + type. Pass `true` for
   * AEC defaults (all-caps `IfcSpace.name`, no area annotation),
   * or pass a {@link SpaceLabelSpec} to tune the data-type
   * filter, font scaling, casing, area annotation, and colour.
   * Default `false` — no labels.
   */
  spaceLabels?: boolean | SpaceLabelSpec;

  /**
   * Treat transparent meshes as wireframe-only. Each source
   * {@link model!scene.SceneMesh | SceneMesh} whose
   * {@link model!scene.SceneMesh.effectiveOpacity | effectiveOpacity}
   * is strictly below
   * {@link DrawingProjectionParams.transparentThreshold | transparentThreshold}
   * is excluded from the HLE depth buffer and from the fills
   * pass, but its edges are still emitted. The edges are still
   * HLE-tested against opaque geometry, so a window edge behind
   * a wall stays hidden by the wall — only the *self*-occlusion
   * goes away.
   *
   * Practical effect: a curtain wall draws its frame as
   * solid+filled (opaque mesh) and its glass as wireframe
   * (transparent mesh), and the room behind the glass shows
   * through. Default `false` — every mesh occludes regardless
   * of opacity.
   */
  transparentAsWireframe?: boolean;

  /**
   * Effective-opacity cutoff used by
   * {@link DrawingProjectionParams.transparentAsWireframe | transparentAsWireframe}.
   * A mesh is considered transparent when its
   * {@link model!scene.SceneMesh.effectiveOpacity | effectiveOpacity}
   * is strictly less than this. Default `0.99` — leaves a tiny
   * margin for assets that store "fully opaque" as `0.999`
   * after a colour-space round-trip.
   *
   * Ignored when `transparentAsWireframe` is `false`.
   */
  transparentThreshold?: number;

  /**
   * Yield to the host between batches of per-source-object
   * createObject calls so the drawing paints progressively
   * instead of blocking the main thread. Pass `true` for
   * defaults (50 objects per batch, RAF-driven yields), or a
   * {@link ProgressiveSpec} for finer control. Default `false`
   * — synchronous, no yields.
   *
   * When enabled, the function still returns a single
   * `SDKResult` but only after the *last* object has been
   * emitted; intermediate frames render whatever was emitted
   * up to each yield point. If the target SceneModel is
   * destroyed mid-flight (e.g. the caller's teardown ran
   * while a yield was outstanding), the projection bails
   * cleanly on the next batch boundary.
   */
  progressive?: boolean | ProgressiveSpec;
}
