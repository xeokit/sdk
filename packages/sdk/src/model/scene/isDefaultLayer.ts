import type {SceneModel} from "./SceneModel";
import type {SceneObject} from "./SceneObject";


/**
 * `true` when `layerId` refers to the default ViewLayer —
 * either literally `"default"` or omitted (the View treats
 * omission as default). This is the layer the user's primary
 * model content lives in; **named layers** carry auxiliary
 * content — tool overlays (TransformControls, section-plane
 * proxies, NavCube), user annotations, comparison snapshots,
 * etc.
 *
 * Enumerators that list "the SceneModels the user authored" —
 * user-facing tab strips, source-model pickers, inspection
 * walkers — call {@link isDefaultLayerModel} to whitelist the
 * default layer. Anything in a named layer is skipped, regardless
 * of name.
 *
 * Consumption-side only — the renderer's draw, pick, and clip
 * paths see every layer normally.
 */
export function isDefaultLayer(layerId: string | undefined): boolean {
  return layerId === undefined || layerId === "default";
}

/** {@link isDefaultLayer} applied to a SceneModel's `layerId`. */
export function isDefaultLayerModel(model: SceneModel): boolean {
  return isDefaultLayer(model.layerId);
}

/** {@link isDefaultLayer} applied to a SceneObject's effective
 *  layer id (the object's own `layerId` when set, else the
 *  parent SceneModel's). */
export function isDefaultLayerObject(object: SceneObject): boolean {
  return isDefaultLayer(object.layerId ?? object.model.layerId);
}
