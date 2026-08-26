export type LonLat = [number, number];
export type Ring = LonLat[];
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];

export interface EarthOptions {
  out: string;
  forceDownload: boolean;
  land: boolean;
  water: boolean;
  countryRegions: boolean;
  coastlines: boolean;
  countryBoundaries: boolean;
  ocean: boolean;
  tileDegrees: number;
  maxEdgeAngle: number;
  simplify: number;
  earthRadius: number;
  oceanOffset: number;
  landOffset: number;
  coastlineOffset: number;
  boundaryOffset: number;
  chunkSize: number;
  verbose: boolean;
  debugGeojson: boolean;
  debugObj: boolean;
  maxLandFeatures: number;
  maxCountryRegionFeatures: number;
  maxCoastlineFeatures: number;
  maxBoundaryFeatures: number;
  minLon?: number;
  maxLon?: number;
  minLat?: number;
  maxLat?: number;
}

export interface TileKey {
  x: number;
  y: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface MeshData {
  id: string;
  positions: Float64Array;
  normals: Float32Array;
  indices: Uint32Array;
  materialId: string;
  layerId?: string;
}

export interface LineData {
  id: string;
  positions: Float64Array;
  indices: Uint32Array;
  materialId: string;
  layerId?: string;
}

export interface BuildStats {
  sourceFeatures: number;
  sourcePolygons: number;
  sourceRings: number;
  landObjects: number;
  waterObjects: number;
  countryRegionObjects: number;
  coastlineObjects: number;
  countryBoundaryObjects: number;
  vertices: number;
  triangles: number;
  coastlineSegments: number;
  countryBoundarySegments: number;
  chunks: number;
  outputBytes: number;
}
