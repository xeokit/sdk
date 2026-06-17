import {SDKErrorType, type SDKResult} from "../../base/core";
import type {SceneModel} from "./SceneModel";
import type {SceneTechniqueParams} from "./SceneTechniqueParams";


/**
 * Render-style mode of a {@link SceneTechnique}.
 *
 *   - `"substitutive"` — the technique *replaces* the default
 *     draw path for its primitive. Multiple substitutive
 *     techniques are mutually exclusive on a single mesh.
 *   - `"additive"`     — the technique runs as an *extra pass*
 *     on top of the default draw. Multiple additive techniques
 *     stack.
 *
 * Currently only `"substitutive"` techniques exist; the mode
 * field is kept on the base so future additive families
 * (sketch outlines, halo glow, ghost overlay) slot in without
 * an API break.
 */
export type SceneTechniqueMode = "substitutive" | "additive";


/**
 * A rendering-style declaration on a {@link model!scene.SceneModel | SceneModel} — the
 * non-default draw path a {@link model!scene.SceneMesh | SceneMesh} runs through, as
 * distinct from the BRDF / shading model a {@link model!scene.SceneMaterial | SceneMaterial}
 * carries.
 *
 *   - {@link model!scene.SceneMaterial | SceneMaterial} answers: *what does the surface
 *     look like?* (colour, roughness, metallic, normal map,
 *     opacity, textures.)
 *   - {@link SceneTechnique} answers: *how is it drawn?*
 *     (which shader family runs, which extra passes
 *     participate, what style-specific options apply.)
 *
 * The two are orthogonal — a SceneMesh may carry neither,
 * either, or both. The most common pairing is a colour
 * SceneMaterial together with a style SceneTechnique (e.g.
 * "blueprint blue" + "thick lines, 3 px"); standard PBR meshes
 * carry only a material.
 *
 * @see {@link ThickLinesTechnique}
 */
export abstract class SceneTechnique {

  /**
   * ID, unique within the parent {@link model!scene.SceneModel | SceneModel}'s
   * `techniques` registry.
   */
  readonly id: string;

  /**
   * Globally-unique ID — the concatenation of the parent
   * SceneModel's id and this technique's id, separated by
   * `"__"`. Mirrors the same convention used by SceneGeometry,
   * SceneMaterial, etc.
   */
  readonly uniqueId: string;

  /**
   * The SceneModel that owns this technique.
   */
  readonly model: SceneModel;

  /**
   * Discriminator string identifying the technique family. The
   * renderer's variant selection maps this to a DrawTechnique.
   */
  abstract readonly type: string;

  /**
   * Whether this technique replaces the default draw path or
   * adds an extra pass on top of it. See {@link SceneTechniqueMode}.
   */
  abstract readonly mode: SceneTechniqueMode;

  /**
   * The count of {@link SceneMesh | SceneMeshes} that reference
   * this SceneTechnique. Maintained by `SceneModel.createMesh` /
   * `SceneModel._destroyMesh`. Used by {@link destroy} to refuse
   * destruction while at least one mesh still references the
   * technique (same guard as {@link SceneMaterial.destroy}).
   */
  numMeshes: number = 0;

  /**
   * True if this SceneTechnique has been destroyed.
   */
  destroyed: boolean = false;

  /**
   * @private
   */
  constructor(model: SceneModel, params: SceneTechniqueParams) {
    this.model = model;
    this.id = params.id;
    this.uniqueId = `${model.id}__${this.id}`;
  }

  /**
   * Destroys this SceneTechnique.
   *
   * Refuses to destroy while at least one {@link model!scene.SceneMesh | SceneMesh} in
   * the SceneModel still references this technique. Reassign
   * those meshes (or destroy them) first.
   */
  destroy(): SDKResult<void> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTechnique.destroy] Cannot destroy already-destroyed SceneTechnique ${this.id}`,
      });
    }
    if (this.numMeshes > 0) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTechnique.destroy] Cannot destroy SceneTechnique ${this.id} - still referenced by ${this.numMeshes} mesh(es)`,
      });
    }
    this.destroyed = true;
    delete this.model.techniques[this.id];
    this.model.scene.events.onSceneTechniqueDestroyed.dispatch(this.model.scene, this);
    return {ok: true, value: undefined};
  }
}
