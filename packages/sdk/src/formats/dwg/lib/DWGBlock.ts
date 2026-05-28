import type {DWGEntity} from "./DWGEntity";
import type {Vec3} from "./Vec3";


/**
 * Named block definition referenced by {@link DWGInsert} entities.
 *
 * Entities inside `entities` carry positions in the block's LOCAL
 * coordinate frame, relative to `basePoint` (default `[0, 0, 0]`).
 * An INSERT places the block by composing its position / scale /
 * rotation onto each contained entity's local coordinates; nested
 * INSERTs are walked recursively, capped at
 * {@link DWGLoadOptions.maxInsertDepth}.
 *
 * @private
 */
export interface DWGBlock {
  name:     string;
  entities: DWGEntity[];
  /** Optional base point (defaults to `[0, 0, 0]` if omitted). */
  basePoint?: Vec3;
}
