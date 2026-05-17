import type {SceneMesh, SceneObject} from "../../model/scene";

/**
 * Anything {@link TransformControls.attach} accepts as a manipulation
 * target.
 *
 * - {@link model!scene.SceneObject | SceneObject} — uses the matrix
 *   of the object's first {@link model!scene.SceneMesh | SceneMesh}.
 *   For multi-mesh objects, prefer the adapter form below.
 * - {@link model!scene.SceneMesh | SceneMesh} — uses the mesh's
 *   matrix directly.
 * - Adapter object — supplies a `getMatrix` / `setMatrix` pair, which
 *   lets the gizmo manipulate any caller-owned source of a 4x4
 *   transform (for example a `SceneTransform` chain, or application
 *   state that backs a custom rendering layer).
 */
export type TransformControlsTarget = SceneObject | SceneMesh | {
  getMatrix(): Float64Array | number[];
  setMatrix(m: Float64Array | number[]): void;
};
