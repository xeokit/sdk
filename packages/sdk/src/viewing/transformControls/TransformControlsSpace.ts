/**
 * Coordinate space in which a {@link TransformControls} interprets its
 * handles.
 *
 * - `"world"` — the handles are aligned with the world axes.
 *   Translation, rotation and scale drags are evaluated in world space.
 * - `"local"` — the handles are aligned with the target's current
 *   rotation. Drags are evaluated in the target's local frame.
 */
export type TransformControlsSpace = "world" | "local";
