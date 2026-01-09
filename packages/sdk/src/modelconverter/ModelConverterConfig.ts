import type {ModelConverterPipelineConfig} from "./ModelConverterPipelineConfig";

/**
 * Configurations for a {@link ModelConverter | ModelConverter}.
 */
export interface ModelConverterConfig {

  /**
   * The available pipelines within the ModelConverter.
   */
  pipelines: {
    [key: string]: ModelConverterPipelineConfig
  };
}
