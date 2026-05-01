/**
 * Optional viewer-highlight payload attached to an {@link Issue} by
 * inspections whose target maps cleanly to one or more renderable
 * SceneObjects. UI consumers (e.g. an inspector panel sitting next
 * to a {@link Viewer}) read this to wire a "Locate" / "Show in
 * viewer" affordance per issue.
 *
 * Inspections that target unrenderable state — dangling resource
 * references, malformed positions, transform cycles — leave
 * {@link Issue.highlight} `undefined`, so consumers can key off the
 * field's presence to decide whether to expose the affordance.
 *
 * The field carries SceneObject ids only — pure data-layer, no
 * Viewer / ViewObject dependency. The actual highlight idiom (xray
 * others, fly camera to AABB union, colorize, …) lives in the
 * consumer.
 */
export interface IssueHighlight {

  /**
   * SceneObject ids the inspection wants to bring to the user's
   * attention. The owning {@link SceneModel} is implicit — the
   * inspection ran against a single SceneModel and these ids are
   * keys into its `objects` map.
   *
   * Always non-empty when present.
   */
  objectIds: string[];
}
