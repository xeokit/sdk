import type {CityProfile, DistrictName, Vec2} from "../types";
import {clamp, distance} from "../geometry/PolygonUtils";

const DOWNTOWN: Vec2 = [95, -80];
const HISTORIC: Vec2 = [-195, 90];
const CIVIC: Vec2 = [220, 165];

export function assignDistrict(point: Vec2, size: number, boundaryNoise = 0, profile?: CityProfile): DistrictName {
  const downtownScale = districtScale(profile, "Downtown", 0.22);
  const historicScale = districtScale(profile, "Historic Core", 0.25);
  const civicScale = districtScale(profile, "Civic District", 0.11);
  const downtownScore = 1 - distance(point, DOWNTOWN) / (size * 0.33 * downtownScale) + boundaryNoise * 0.08;
  const historicScore = 1 - distance(point, HISTORIC) / (size * 0.31 * historicScale) - boundaryNoise * 0.04;
  const civicScore = 1 - distance(point, CIVIC) / (size * 0.25 * civicScale) + boundaryNoise * 0.05;
  if (downtownScore > 0.1 && downtownScore > historicScore && downtownScore > civicScore) {
    return "Downtown";
  }
  if (civicScore > 0.05 && civicScore > historicScore) {
    return "Civic District";
  }
  if (historicScore > -0.08) {
    return "Historic Core";
  }
  return "Mixed Residential";
}

function districtScale(profile: CityProfile | undefined, district: DistrictName, fallbackShare: number): number {
  const share = profile?.districts?.[district];
  if (!Number.isFinite(share)) {
    return 1;
  }
  return clamp(Math.sqrt(Number(share) / fallbackShare), 0.7, 1.45);
}

export function downtownFactor(point: Vec2, size: number): number {
  return Math.max(0, 1 - distance(point, DOWNTOWN) / (size * 0.36));
}

export function landmarkAnchors(): Vec2[] {
  return [HISTORIC, CIVIC, DOWNTOWN];
}

export function districtColor(district: DistrictName): [number, number, number] {
  switch (district) {
    case "Historic Core": return [0.78, 0.56, 0.42];
    case "Downtown": return [0.46, 0.62, 0.70];
    case "Civic District": return [0.70, 0.66, 0.56];
    case "Mixed Residential":
    default: return [0.58, 0.66, 0.54];
  }
}
