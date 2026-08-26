import type {EvaluationReport} from "./evaluation/EvaluationReport";

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type DistrictName =
  | "Historic Core"
  | "Downtown"
  | "Mixed Residential"
  | "Civic District";

export type RoadHierarchy = "arterial" | "collector" | "local" | "alley" | "pedestrian";

export type GrowthPhase =
  | "historic-core"
  | "industrial-expansion"
  | "postwar-rebuild"
  | "contemporary-infill"
  | "waterfront-renewal";

export type BlockGrammar =
  | "mixed-infill"
  | "fine-grain-streetwall"
  | "perimeter-courtyard"
  | "commercial-corridor"
  | "civic-campus"
  | "tower-podium"
  | "waterfront-edge";

export type UrbanPatternCategory = "city" | "district" | "street" | "block" | "building";

export type EvaluationPresetName = "fast" | "balanced" | "quality";

export interface UrbanPatternApplication {
  id: string;
  name: string;
  category: UrbanPatternCategory;
  weight: number;
  stages: string[];
  tags: string[];
}

export interface DistrictUrbanContext {
  district: DistrictName;
  identity: string;
  dominantGrowthPhase: GrowthPhase;
  landValueBase: number;
  densityBias: number;
  heightBias: number;
  courtyardBias: number;
  streetAlignmentBias: number;
  imperfection: number;
  preferredMaterials: string[];
  facadeRhythm: number;
  patterns: UrbanPatternApplication[];
}

export interface BlockUrbanContext {
  blockId: string;
  district: DistrictName;
  grammar: BlockGrammar;
  growthPhase: GrowthPhase;
  landValue: number;
  densityBias: number;
  heightBias: number;
  coverageBias: number;
  setbackBias: number;
  courtyardProbability: number;
  streetAlignment: number;
  roadInfluence: number;
  roadHierarchy: RoadHierarchy;
  landmarkInfluence: number;
  waterfrontInfluence: number;
  viewCorridorPressure: number;
  imperfection: number;
  neighborContinuity: number;
  patterns: UrbanPatternApplication[];
  treeDensityMultiplier: number;
}

export interface ParcelUrbanContext {
  parcelId: string;
  blockId: string;
  grammar: BlockGrammar;
  growthPhase: GrowthPhase;
  landValue: number;
  densityBias: number;
  heightBias: number;
  coverageBias: number;
  setbackBias: number;
  courtyardProbability: number;
  streetAlignment: number;
  roadInfluence: number;
  roadHierarchy: RoadHierarchy;
  landmarkInfluence: number;
  waterfrontInfluence: number;
  viewCorridorPressure: number;
  imperfection: number;
  neighborContinuity: number;
  patterns: UrbanPatternApplication[];
}

export interface BuildingUrbanContext {
  parcelId: string;
  blockId: string;
  grammar: BlockGrammar;
  growthPhase: GrowthPhase;
  landValue: number;
  heightMultiplier: number;
  coverageMultiplier: number;
  towerProbability: number;
  courtyardProbability: number;
  setbackTowerProbability: number;
  streetAlignment: number;
  facadeRhythm: number;
  facadeAge: "historic" | "industrial" | "postwar" | "contemporary";
  materialFamily: string;
  useBias: "residential" | "mixed" | "commercial" | "civic";
  viewCorridorPressure: number;
  imperfection: number;
  patterns: UrbanPatternApplication[];
}

export interface CityUrbanContext {
  schema: "xeokit-procedural-city-urban-context/1.0";
  profileName: string;
  growthPhases: GrowthPhase[];
  districtContexts: Record<DistrictName, DistrictUrbanContext>;
  blockContexts: Record<string, BlockUrbanContext>;
  parcelContexts: Record<string, ParcelUrbanContext>;
  buildingContexts: Record<string, BuildingUrbanContext>;
  viewCorridors: Array<{
    id: string;
    from: Vec2;
    to: Vec2;
    protectedHeightFactor: number;
  }>;
  patternSummary: Record<string, number>;
  cityPatterns: UrbanPatternApplication[];
}

export interface CityGeneratorConfig {
  seed: number | string;
  size: number;
  style: "european";
  density: "medium" | "high";
  buildingCount?: number;
  profile?: string | CityProfile;
  profileData?: CityProfile;
  outputPath: string;
  evaluationPreset?: EvaluationPresetName;
  evaluation?: {
    enabled?: boolean;
    threshold?: number;
    maxRetries?: number;
    weights?: Record<string, number>;
  };
}

export interface DistributionProfile {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  p05?: number;
  p25?: number;
  p75?: number;
  p95?: number;
  stdDev?: number;
}

export interface CityProfile {
  schema: "xeokit-procedural-city-profile/1.0";
  schemaVersion?: number;
  version: number;
  name: string;
  description?: string;
  source?: {
    type: "osm" | "preset";
    input?: string;
    region?: string;
    areaSquareMeters?: number;
    generatedAt?: string;
    note?: string;
  };
  sampleCounts?: {
    roads?: number;
    roadSegments?: number;
    intersections?: number;
    blocks?: number;
    buildings?: number;
    buildingsWithLevels?: number;
    buildingsWithHeights?: number;
    parks?: number;
    plazas?: number;
  };
  roads: {
    hierarchyShare?: Partial<Record<RoadHierarchy, number>>;
    widthByHierarchy?: Partial<Record<RoadHierarchy, number>>;
    arterialSpacing?: DistributionProfile;
    collectorSpacing?: DistributionProfile;
    segmentLength?: DistributionProfile;
    intersectionAngles?: DistributionProfile;
    nodeDegree?: DistributionProfile;
    streetOrientation?: DistributionProfile;
    curvature?: DistributionProfile;
    intersectionSpacing?: DistributionProfile;
    intersectionDegreeWeights?: Partial<Record<string, number>>;
    orientationPeaksDegrees?: number[];
    averageSpacing?: number;
    roadDensityKmPerSquareKm?: number;
    intersectionDensityPerSquareKm?: number;
  };
  blocks: {
    area?: DistributionProfile;
    perimeter?: DistributionProfile;
    compactness?: DistributionProfile;
    aspectRatio?: DistributionProfile;
    frontageLength?: DistributionProfile;
    courtyardFrequency?: number;
    irregularity?: DistributionProfile;
    measuredCount?: number;
    openCellRatio?: number;
  };
  parcels: {
    frontage?: DistributionProfile;
    depth?: DistributionProfile;
    area?: DistributionProfile;
    buildableCoverage?: DistributionProfile;
    setbacks?: DistributionProfile;
  };
  buildings: {
    footprintArea?: DistributionProfile;
    aspectRatio?: DistributionProfile;
    coverage?: DistributionProfile;
    levels?: DistributionProfile;
    heights?: DistributionProfile;
    spacing?: DistributionProfile;
    streetAlignment?: DistributionProfile;
    streetAlignmentProbability?: number;
    streetDistance?: DistributionProfile;
    gapFrequency?: number;
    levelsConfidence?: number;
    heightsConfidence?: number;
  };
  landUse: {
    residential?: number;
    commercial?: number;
    mixedUse?: number;
    industrial?: number;
    parks?: number;
    civic?: number;
  };
  publicSpace: {
    parkFrequency?: number;
    plazaSize?: DistributionProfile;
    streetTreeDensity?: DistributionProfile;
    openSpaceRatio?: number;
    areaRatio?: number;
    parkFrequencyPerSquareKm?: number;
    plazaFrequencyPerSquareKm?: number;
    averageOpenSpaceSize?: number;
  };
  waterways?: {
    enabled?: boolean;
    style?: "chicago-river" | "river" | "thames";
    width?: DistributionProfile;
    branchWidth?: DistributionProfile;
    bridgeSpacing?: DistributionProfile;
    waterfrontSetback?: number;
  };
  districts: Partial<Record<DistrictName, number>>;
  relationships: {
    downtownHeightGradient?: number;
    commercialRoadBias?: number;
    courtyardProbability?: number;
    roadHierarchyBlockScale?: number;
    streetIrregularity?: number;
    buildingStreetAlignment?: number;
    heightRoadBias?: number;
    perimeterBlockBias?: number;
    pedestrianStreetBias?: number;
    localRoadDensityBias?: number;
    commercialIntersectionBias?: number;
  };
}

export interface RandomStreams {
  roads: () => number;
  blocks: () => number;
  parcels: () => number;
  zoning: () => number;
  buildings: () => number;
  facades: () => number;
  roofs: () => number;
  vegetation: () => number;
  furniture: () => number;
  waterways: () => number;
  roadNoise: (x: number, y: number) => number;
  waterNoise: (x: number, y: number) => number;
  heightNoise: (x: number, y: number) => number;
}

export interface Road {
  id: string;
  name: string;
  hierarchy: RoadHierarchy;
  width: number;
  polyline: Vec2[];
  pedestrianPriority?: boolean;
  routedAroundWater?: boolean;
}

export interface RoadNetwork {
  roads: Road[];
  xCoords: number[];
  yCoords: number[];
  gridPoints: Vec2[][];
  diagonalRoads: Road[];
  landmarkAnchors: Vec2[];
  waterways: Waterway[];
}

export interface BridgeCrossing {
  id: string;
  roadId: string;
  roadName: string;
  hierarchy: RoadHierarchy;
  point: Vec2;
  tangent: Vec2;
  roadWidth: number;
  waterwayId: string;
  metadata?: Record<string, unknown>;
}

export interface Waterway {
  id: string;
  name: string;
  style: "chicago-river" | "river" | "thames";
  width: number;
  polyline: Vec2[];
  polygon: Vec2[];
  bridgeCrossings: BridgeCrossing[];
  metadata: Record<string, unknown>;
}

export interface Block {
  id: string;
  polygon: Vec2[];
  center: Vec2;
  district: DistrictName;
  pattern: "historic-narrow" | "perimeter-courtyard" | "podium-tower" | "mixed-use" | "standalone-civic";
  area: number;
  edgeMargins?: {
    u0: number;
    u1: number;
    v0: number;
    v1: number;
  };
  openSpace?: "central-park" | "neighborhood-park" | "plaza" | "civic-plaza";
  landmark?: "city-hall" | "cathedral" | "museum" | "observation-tower";
  metadata: Record<string, unknown>;
}

export interface Parcel {
  id: string;
  blockId: string;
  polygon: Vec2[];
  center: Vec2;
  area: number;
  district: DistrictName;
  frontageHierarchy: RoadHierarchy;
  setback: number;
}

export interface MaterialDefinition {
  id: string;
  color: Vec3;
  opacity?: number;
  roughness?: number;
  metallic?: number;
  alphaMode?: "OPAQUE" | "BLEND" | "MASK";
}

export interface MeshData {
  id?: string;
  materialId: string;
  positions: number[];
  normals: number[];
  indices: number[];
}

export interface CityObject {
  id: string;
  name: string;
  type: string;
  layerId: "buildings" | "roads" | "vegetation" | "streetFurniture" | "parks" | "landmarks" | "blocks" | "water";
  meshes: MeshData[];
  metadata: Record<string, unknown>;
}

export interface CityScene {
  id: string;
  config: CityGeneratorConfig;
  materials: MaterialDefinition[];
  objects: CityObject[];
  blocks: Block[];
  roads: Road[];
  urbanContext?: CityUrbanContext;
  evaluationReports?: EvaluationReport[];
  metadata: Record<string, Record<string, unknown>>;
  stats: {
    buildings: number;
    blocks: number;
    roads: number;
    parks: number;
    landmarks: number;
    trees: number;
    streetFurniture: number;
    waterways: number;
    bridges: number;
    triangles: number;
  };
}
