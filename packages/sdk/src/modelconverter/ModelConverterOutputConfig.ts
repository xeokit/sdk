/**
 * Defines the configuration for a single output in a conversion pipeline.
 */
export interface ModelConverterOutputConfig {

  /**
   * The key of an {@link io!ModelExporter | ModelExporter} declared in
   * {@link ModelConverterParams.exporters | ModelConverterParams.exporters}, which the
   * pipeline will use to write the output file.
   */
  exporter: string;

  /**
   * Optional schema version to be used by the {@link io!ModelExporter | ModelExporter}
   * when generating the output file.
   */
  version?: string;

  /**
   * Optional ID of the {@link scene!SceneModel | SceneModel} that provides the
   * scene data for export. Must reference a SceneModel defined in a pipeline input.
   */
  sceneModel?: string;

  /**
   * Optional ID of the {@link data!DataModel | DataModel} that provides the
   * structured data for export. Must reference a DataModel defined in a pipeline input.
   */
  dataModel?: string;

  /**
   * Optional exporter-specific configuration as key-value pairs.
   */
  options?: {
    [key: string]: any;
  };
}
