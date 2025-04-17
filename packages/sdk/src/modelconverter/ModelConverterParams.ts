import {Loader} from "../io";
import {Exporter} from "../io";
import {ModelConverterPipelineParams} from "./ModelConverterPipelineParams";

/**
 * Constructor parameters for a {@link ModelConverter | ModelConverter}.
 */
export interface ModelConverterParams {

    /**
     * A map of {@link core!Loader | Loaders} for supported input formats.
     */
    loaders?: { [key: string]: Loader };

    /**
     * A map of {@link core!Exporter | Writers} for supported output formats.
     */
    exporters?: { [key: string]: Exporter };

    /**
     * The available pipelines within the ModelConverter.
     */
    pipelines: {
        [key: string]: ModelConverterPipelineParams
    };
}
