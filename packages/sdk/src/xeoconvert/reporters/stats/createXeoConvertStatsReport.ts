import { XeoConvertReporter } from "../XeoConvertReporter";
import { XeoConvertReportParams } from "../XeoConvertReportParams";
import { XeoConvertStatsReport } from "./XeoConvertStatsReport";

/**
 * @private
 */
export const createXeoConvertStatsReport: XeoConvertReporter = (params: XeoConvertReportParams): XeoConvertStatsReport => {
  return params.xeoConvertStatsReport;
}
