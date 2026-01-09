import {type ModelLoader} from "../io";
import {type ModelExporter} from "../io";
import {type ModelConverterPipelineConfig} from "./ModelConverterPipelineConfig";

/**
 * Constructor parameters for a {@link ModelConverter | ModelConverter}.
 */
export interface ModelConverterParams {

  /**
   * A map of {@link io!ModelLoader | ModelLoaders} for supported input formats.
   */
  loaders?: { [key: string]: ModelLoader };

  /**
   * A map of {@link io!ModelExporter | ModelExporters} for supported output formats.
   */
  exporters?: { [key: string]: ModelExporter };

  /**
   * Configures  pipelines within the ModelConverter.
   */
  pipelines: {
    [key: string]: ModelConverterPipelineConfig
  };
}
