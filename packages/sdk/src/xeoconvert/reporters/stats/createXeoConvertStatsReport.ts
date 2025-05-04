import type { XeoConvertReporter } from "../XeoConvertReporter";
import type { XeoConvertReportParams } from "../XeoConvertReportParams";
import type { XeoConvertStatsReport } from "./XeoConvertStatsReport";

/**
 * @private
 */
export const createXeoConvertStatsReport: XeoConvertReporter = (params: XeoConvertReportParams): XeoConvertStatsReport => {
  return params.xeoConvertStatsReport;
}
