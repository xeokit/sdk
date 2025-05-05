
import {type ModelConverterResult} from "../ModelConverterResult";

/**
 * Represents a function that generates a report based on the model conversion process.
 *
 * The `ModelConverterReporter` type defines a function that takes {@link ModelConverterReportParams | ModelConverterReportParams}
 * as an argument and returns a report, which could be in any form. The report typically contains metadata,
 * diagnostic information, and statistics related to the model conversion.
 *
 * The returned report can be used for logging, analysis, or debugging purposes.
 *
 * @param params - Model conversion result.
 * @returns A report, which can be in any form depending on the implementation (e.g., an object, string, etc.).
 */
export type ModelConverterReporter = (params: ModelConverterResult) => any;
