import { DataModelStats } from "../../../data";
import { SceneModelStats } from "../../../scene";
import { XeoConvertStatsReportInput } from "./XeoConvertStatsReportInput";

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
