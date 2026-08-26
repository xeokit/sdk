import type {Vec3} from "@xeokit/sdk/base/math/vector";

/**
 * Customisation for the per-space label pass of
 * {@link buildDrawing}.
 *
 * Phase 1 of the labelling system: emits text **inside** each
 * eligible source object's projected fill polygon, anchored at
 * the pole-of-inaccessibility (max-distance interior point). No leader
 * lines or collision checks with other labels.
 *
 * Eligibility is the intersection of:
 *
 *   - The source SceneObject contributed a non-empty fill
 *     polygon for this drawing (so the projection had to be
 *     called with `fill: true`).
 *   - There is a {@link model!data.DataObject | DataObject} in
 *     the supplied {@link DrawingProjectionParams.data | data}
 *     graph with the same id, AND its `type` is one of
 *     {@link SpaceLabelSpec.dataTypes | dataTypes}.
 *   - The fill polygon's bounding rectangle is at least
 *     {@link SpaceLabelSpec.minArea | minArea} world units².
 *
 * Typography defaults to all-caps single-line text, sized to a
 * fraction of the inscribed circle's radius. Override
 * {@link SpaceLabelSpec.fontScale | fontScale} to tighten or
 * loosen the fit.
 */
export interface SpaceLabelSpec {

  /**
   * {@link model!data.DataObject.type | DataObject.type} values
   * eligible for labels. Default `["IfcSpace"]`. Pass other types
   * such as `["IfcZone", "IfcSpatialZone"]` to extend the pass.
   * Empty array disables the pass entirely.
   */
  dataTypes?: string[];

  /**
   * Minimum fill polygon area (world units², measured on the
   * projection plane) below which a label is skipped. Default
   * `0.5` m². Set to `0` to label everything that has any fill.
   */
  minArea?: number;

  /**
   * Label height as a fraction of the polygon's inscribed-circle
   * radius (the radius of the largest circle that fits inside
   * the polygon, centred at the pole of inaccessibility).
   * Default `0.30`.
   *
   * Final font size is clamped to
   * {@link SpaceLabelSpec.maxFontSize | maxFontSize} so giant
   * atria don't end up with metre-tall text.
   */
  fontScale?: number;

  /**
   * Hard ceiling on label height in world units. Default `0.45`.
   */
  maxFontSize?: number;

  /**
   * Lower floor on label height in world units. Labels that
   * would render smaller than this after the inscribed-radius
   * scale are dropped entirely (the space is too narrow to read
   * a label in). Default `0.10`.
   */
  minFontSize?: number;

  /**
   * When `true` (default), label text is rendered in upper-case
   * regardless of how the source name is stored:
   * `"Kitchen"` → `"KITCHEN"`. Set to `false` to preserve source casing.
   */
  upperCase?: boolean;

  /**
   * When `true`, a second line carrying the polygon's area in
   * m² (formatted with one decimal) is emitted below the name.
   * Default `false` — the name alone is the room-label
   * convention; area annotation is an opt-in extension.
   */
  showArea?: boolean;

  /**
   * RGB colour for the label line geometry. Each channel in
   * `[0, 1]`. Defaults to the drawing's
   * {@link DrawingProjectionParams.color | color}.
   */
  color?: Vec3;

  /**
   * Optional pixel thickness for the label line meshes. Falls
   * back to the drawing's
   * {@link DrawingProjectionParams.lineWidth | lineWidth} when
   * not set.
   */
  lineWidth?: number;

  /**
   * Optional ViewLayer id assigned to every label
   * SceneObject. Defaults to the drawing's
   * {@link DrawingProjectionParams.layerId | layerId} so labels
   * follow the same layer policy as the rest of the projection.
   */
  layerId?: string;
}
