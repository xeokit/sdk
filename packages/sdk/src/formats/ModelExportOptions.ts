import {CoordinateSystemParams} from "../scene";

/**
 * Options for customizing the export process when exporting a {@link scene!SceneModel | SceneModel}
 * and/or a {@link data!DataModel | DataModel} to a file.
 */
export type ModelExportOptions = {

  /**
   * Optional target CoordinateSystem for export. If not provided,
   * the SceneModel's CoordinateSystem will be used.
   */
  coordinateSystem?: CoordinateSystemParams;
} & Record<string, any>;
