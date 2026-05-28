import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec3} from "./Vec3";


/**
 * AutoCAD `INSERT` — places an instance of a named {@link DWGBlock}
 * at `position`, optionally scaled per-axis and rotated around +Z.
 * The loader expands each INSERT by recursively walking the block's
 * entities under the composed transform, capped at
 * {@link DWGLoadOptions.maxInsertDepth} to defend against cyclic
 * block references.
 *
 * @private
 */
export interface DWGInsert extends DWGEntityCommon {
  type: "INSERT";
  /** Name of the {@link DWGBlock} this insert references. */
  blockName: string;
  position:  Vec3;
  /** Per-axis scale; defaults to `[1, 1, 1]` if omitted. */
  scale?:    Vec3;
  /** Rotation around +Z in radians. */
  rotation?: number;
}
