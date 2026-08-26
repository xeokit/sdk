import type {Block, CityGeneratorConfig, CityProfile, CityUrbanContext, DistrictName, Parcel, Road, RoadNetwork} from "../types";

export type EvaluationStage =
  | "road-layout"
  | "district-boundary"
  | "block-subdivision"
  | "parcel-subdivision"
  | "building-massing"
  | "landmark-placement"
  | "park-placement";

export interface EvaluationContext {
  stage: EvaluationStage;
  subjectId?: string;
  config?: CityGeneratorConfig;
  profile?: CityProfile;
  district?: DistrictName;
  block?: Block;
  parcel?: Parcel;
  roads?: Road[];
  network?: RoadNetwork;
  blocks?: Block[];
  urbanContext?: CityUrbanContext;
  nearbyBlocks?: Block[];
  centerDistance?: number;
}
