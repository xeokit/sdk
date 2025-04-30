import { ModelConverterPipelineParams } from "./ModelConverterPipelineParams";
import { ModelExporter } from "../io";
import { ModelLoader } from "../io";

/**
 * Constructor parameters for a {@link ModelConverter | ModelConverter}.
 */
export interface ModelConverterParams {

  /**
     * A map of {@link core!Loader | Loaders} for supported input formats.
     */
  loaders?: { [key: string]: ModelLoader };

  /**
     * A map of {@link core!Exporter | Writers} for supported output formats.
     */
  exporters?: { [key: string]: ModelExporter };

  /**
     * The available pipelines within the ModelConverter.
     */
  pipelines: {
    [key: string]: ModelConverterPipelineParams
  };
}
