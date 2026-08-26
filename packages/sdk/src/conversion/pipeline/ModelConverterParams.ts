import {type ModelLoader} from "../../formats";
import {type ModelExporter} from "../../formats";
import {type ModelConverterPipelineConfig} from "./ModelConverterPipelineConfig";

/**
 * Constructor parameters for a {@link ModelConverter | ModelConverter}.
 */
export interface ModelConverterParams {

  /**
   * A map of {@link formats!ModelLoader | ModelLoaders} for supported input formats.
   */
  loaders?: { [key: string]: ModelLoader };

  /**
   * A map of {@link formats!ModelExporter | ModelExporters} for supported output formats.
   */
  exporters?: { [key: string]: ModelExporter };

  /**
   * Configures  pipelines within the ModelConverter.
   */
  pipelines: {
    [key: string]: ModelConverterPipelineConfig
  };
}
