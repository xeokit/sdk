import {type ModelConverterResult} from "../ModelConverterResult";

/**
 * A function that generates a report based on the model conversion process.
 *
 * @param params - Model conversion result.
 * @returns A report, which can be in any form depending on the implementation.
 */
export type ModelConverterReporter = (params: ModelConverterResult) => any;
