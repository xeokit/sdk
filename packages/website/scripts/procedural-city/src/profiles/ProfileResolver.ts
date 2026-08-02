import fs from "node:fs/promises";
import path from "node:path";
import type {CityProfile, DistributionProfile} from "../types";
import centralEuropean from "./central-european.json";
import historicEuropean from "./historic-european.json";
import northAmericanGrid from "./north-american-grid.json";
import london from "./london.json";
import paris from "./paris.json";
import berlin from "./berlin.json";
import amsterdam from "./amsterdam.json";
import newYork from "./new-york.json";
import tokyo from "./tokyo.json";
import chicagoRiver from "./chicago-river.json";

const BUILT_IN_PROFILES: Record<string, CityProfile> = {
  "central-european": centralEuropean as CityProfile,
  "historic-european": historicEuropean as CityProfile,
  "north-american-grid": northAmericanGrid as CityProfile,
  london: london as CityProfile,
  paris: paris as CityProfile,
  berlin: berlin as CityProfile,
  amsterdam: amsterdam as CityProfile,
  "new-york": newYork as CityProfile,
  tokyo: tokyo as CityProfile,
  "chicago-river": chicagoRiver as CityProfile
};

export async function resolveCityProfile(profile: CityProfile | string | undefined, cwd = process.cwd()): Promise<CityProfile> {
  if (!profile) {
    return normalizeProfile(BUILT_IN_PROFILES["central-european"]);
  }
  if (typeof profile !== "string") {
    return normalizeProfile(profile);
  }
  if (BUILT_IN_PROFILES[profile]) {
    return normalizeProfile(BUILT_IN_PROFILES[profile]);
  }
  const filePath = path.isAbsolute(profile) ? profile : path.resolve(cwd, profile);
  const json = JSON.parse(await fs.readFile(filePath, "utf8")) as CityProfile;
  return normalizeProfile(json);
}

export function normalizeProfile(profile: CityProfile): CityProfile {
  return {
    schema: "xeokit-procedural-city-profile/1.0",
    schemaVersion: profile.schemaVersion || profile.version || 1,
    version: profile.version || 1,
    name: profile.name || "unnamed-profile",
    description: profile.description,
    source: profile.source,
    sampleCounts: profile.sampleCounts,
    roads: profile.roads || {},
    blocks: profile.blocks || {},
    parcels: profile.parcels || {},
    buildings: profile.buildings || {},
    landUse: profile.landUse || {},
    publicSpace: profile.publicSpace || {},
    waterways: profile.waterways,
    districts: profile.districts || {},
    relationships: profile.relationships || {}
  };
}

export function distributionValue(distribution: DistributionProfile | undefined, fallback: number, key: keyof DistributionProfile = "mean"): number {
  const value = distribution?.[key] ?? distribution?.median ?? distribution?.mean;
  return Number.isFinite(value) ? Number(value) : fallback;
}

export function distributionRange(distribution: DistributionProfile | undefined, fallbackMin: number, fallbackMax: number): [number, number] {
  const min = distribution?.p25 ?? distribution?.min ?? fallbackMin;
  const max = distribution?.p75 ?? distribution?.max ?? fallbackMax;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [fallbackMin, fallbackMax];
  }
  return [Number(min), Number(max)];
}

export function profileNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export function clampProfileValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
