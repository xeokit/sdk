import { ModelConverterInputParams } from "./ModelConverterInputParams";
import { ModelConverterOutputParams } from "./ModelConverterOutputParams";

/**
 * Defines the structure of a conversion pipeline within a {@link ModelConverter | ModelConverter}.
 *
 * A pipeline consists of one or more inputs and outputs, each identified by a unique key.
 */
export interface ModelConverterPipelineParams {

    /**
     * A map of input configurations, where each key identifies a pipeline input.
     *
     * Each input specifies how the source data is loaded into the pipeline.
     */
    inputs: {
        [key: string]: ModelConverterInputParams;
    };

    /**
     * A map of output configurations, where each key identifies a pipeline output.
     *
     * Each output specifies how the processed data is exported from the pipeline.
     */
    outputs?: {
        [key: string]: ModelConverterOutputParams;
    };

}
