import type {
  Block,
  BlockGrammar,
  BlockUrbanContext,
  CityGeneratorConfig,
  DistrictName,
  GrowthPhase,
  Parcel,
  ParcelUrbanContext,
  RoadHierarchy,
  RoadNetwork
} from "../types";

export interface PatternContext {
  scope: "city" | "district" | "block" | "parcel" | "building";
  config: CityGeneratorConfig;
  network?: RoadNetwork;
  block?: Block;
  parcel?: Parcel;
  blockContext?: BlockUrbanContext;
  parcelContext?: ParcelUrbanContext;
  district?: DistrictName;
  roadHierarchy?: RoadHierarchy;
  roadInfluence?: number;
  landValue?: number;
  densityBias?: number;
  heightBias?: number;
  coverageBias?: number;
  setbackBias?: number;
  courtyardProbability?: number;
  streetAlignment?: number;
  landmarkInfluence?: number;
  waterfrontInfluence?: number;
  viewCorridorPressure?: number;
  downtownInfluence?: number;
  neighborContinuity?: number;
  imperfection?: number;
  blockArea?: number;
  blockGrammar?: BlockGrammar;
  growthPhase?: GrowthPhase;
  hasWaterways?: boolean;
  hasOpenSpace?: boolean;
  hasLandmark?: boolean;
}
