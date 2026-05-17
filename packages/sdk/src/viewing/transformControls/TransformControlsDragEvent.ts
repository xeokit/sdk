import type {TransformControlsAxis} from "./TransformControlsAxis";
import type {TransformControlsMode} from "./TransformControlsMode";
import type {TransformControlsSpace} from "./TransformControlsSpace";

/**
 * Payload of {@link TransformControlsEvents.onDragStart} and
 * {@link TransformControlsEvents.onDragEnd}.
 */
export interface TransformControlsDragEvent {

  /**
   * The handle axis the drag is operating on. One of `"X"`, `"Y"`,
   * `"Z"`, `"XY"`, `"YZ"`, `"XZ"`, `"XYZ"`, `"E"`, `"XYZE"`.
   */
  axis: TransformControlsAxis;

  /**
   * The active mode at the moment the drag event fires.
   */
  mode: TransformControlsMode;

  /**
   * The active coordinate space at the moment the drag event fires.
   */
  space: TransformControlsSpace;
}
