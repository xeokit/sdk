/**
 * Defines the configuration for a single input in a conversion pipeline.
 */
export interface ModelConverterInputConfig {

  /**
   * Specifies the key of a {@link formats!ModelLoader | ModelLoader} defined in
   * {@link ModelConverterParams.loaders | ModelConverterParams.loaders}, which will be used
   * by the pipeline to read the source file.
   */
  loader: string;

  /**
   * Optional ID of the {@link model!scene.SceneModel | SceneModel} into which the loader
   * will import scene-related data. The SceneModel can be shared with other inputs and outputs, and
   * will be created if not already existing.
   */
  sceneModel?: string;

  /**
   * Optional ID of the {@link model!data.DataModel | DataModel} into which the loader
   * will import semantic data. The DataModel can be shared with other inputs and outputs, and
   * will be created if not already existing.
   */
  dataModel?: string;

  /**
   * Optional set of key-value pairs for loader-specific configuration.
   */
  options?: {
    [key: string]: any;
  };
}
