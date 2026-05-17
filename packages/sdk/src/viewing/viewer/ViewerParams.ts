import type {ViewParams} from "./ViewParams";

/**
 * Parameters for a {@link viewing!viewer.Viewer | Viewer}.
 *
 * * Passed to {@link Viewer.fromParams | Viewer.fromParams}
 * * Returned by {@link Viewer.toParams | Viewer.toParams}
 */
export interface ViewerParams {

  /**
   * Optional ID for the Viewer, generated automatically by the {@link viewing!viewer.Viewer | Viewer} constructor if omitted.
   */
  id?: string;

  /**
   * Paramaters to create or configure {@link View | Views} within the target {@link viewing!viewer.Viewer | Viewer}.
   *
   * When the ViewerParsms is passed to {@link Viewer.fromParams}, for each {@link ViewParams | ViewParams}
   * that matches the ID of a pre-existing View, the View is updated with whatever properties are provided on the ViewParams.
   *
   * For each ViewParams whose ID matches no existiong View, a new View is created, giving it the ID and
   * whatever configurations are provided on the ViewParams.
   */
  views?: ViewParams[];
}
