import type { DataModelStats } from "../../../data";
import type { SceneModelStats } from "../../../scene";
import type { XeoConvertStatsReportInput } from "./XeoConvertStatsReportInput";

export interface XeoConvertStatsReport {
  description: string,
  command: string,
  time: string,
  pipeline: string,
  inputs: {
    [key: string]: XeoConvertStatsReportInput;
  },
  sceneModels: {
    [key: string]: SceneModelStats;
  },
  dataModels: {
    [key: string]: DataModelStats;
  },
  outputs: {
    [key: string]: XeoConvertStatsReportInput;
  }
}
