/**
 * Curated city + design-reference-site presets for the
 * {@link SunStudyPanel}'s site picker. Two flat groups:
 *
 *   - **Cities** — major world cities indexed for the dropdown's
 *     native typeahead (first-character match). Globally balanced
 *     so a user picking a hemisphere / climate band has a plausible
 *     city in each.
 *   - **Reference sites** — pedagogically useful latitudes:
 *     equator, tropics, polar circles, poles. Useful for solar-arc
 *     comparisons and "what does Sun Study look like at the Arctic
 *     Circle?" demos.
 *
 * Coordinates are city-centre, rounded to 2 decimals — enough
 * precision for hour-by-hour solar-position work (under 1 km), with
 * none of the precision drift of full-precision OSM data.
 *
 */

export interface SitePreset {
  /** Display label shown in the dropdown. */
  label: string;
  /** Latitude in degrees, positive north. */
  latitude: number;
  /** Longitude in degrees, positive east. */
  longitude: number;
}


/** Major world cities, alphabetical. */
export const SITE_PRESET_CITIES: SitePreset[] = [
  { label: "Anchorage",        latitude:  61.22, longitude: -149.90 },
  { label: "Athens",           latitude:  37.98, longitude:   23.73 },
  { label: "Auckland",         latitude: -36.85, longitude:  174.76 },
  { label: "Beijing",          latitude:  39.90, longitude:  116.41 },
  { label: "Berlin",           latitude:  52.52, longitude:   13.40 },
  { label: "Bogotá",           latitude:   4.71, longitude:  -74.07 },
  { label: "Buenos Aires",     latitude: -34.61, longitude:  -58.38 },
  { label: "Cairo",            latitude:  30.04, longitude:   31.24 },
  { label: "Cape Town",        latitude: -33.92, longitude:   18.42 },
  { label: "Chicago",          latitude:  41.88, longitude:  -87.63 },
  { label: "Delhi",            latitude:  28.61, longitude:   77.21 },
  { label: "Dubai",            latitude:  25.20, longitude:   55.27 },
  { label: "Helsinki",         latitude:  60.17, longitude:   24.94 },
  { label: "Hong Kong",        latitude:  22.32, longitude:  114.17 },
  { label: "Honolulu",         latitude:  21.31, longitude: -157.86 },
  { label: "Istanbul",         latitude:  41.01, longitude:   28.98 },
  { label: "Jakarta",          latitude:  -6.21, longitude:  106.85 },
  { label: "Johannesburg",     latitude: -26.20, longitude:   28.05 },
  { label: "Lagos",            latitude:   6.52, longitude:    3.38 },
  { label: "Lima",             latitude: -12.05, longitude:  -77.04 },
  { label: "London",           latitude:  51.51, longitude:   -0.13 },
  { label: "Los Angeles",      latitude:  34.05, longitude: -118.24 },
  { label: "Madrid",           latitude:  40.42, longitude:   -3.70 },
  { label: "Melbourne",        latitude: -37.81, longitude:  144.96 },
  { label: "Mexico City",      latitude:  19.43, longitude:  -99.13 },
  { label: "Moscow",           latitude:  55.76, longitude:   37.62 },
  { label: "Mumbai",           latitude:  19.08, longitude:   72.88 },
  { label: "Nairobi",          latitude:  -1.29, longitude:   36.82 },
  { label: "New York",         latitude:  40.71, longitude:  -74.01 },
  { label: "Oslo",             latitude:  59.91, longitude:   10.75 },
  { label: "Paris",            latitude:  48.86, longitude:    2.35 },
  { label: "Quito",            latitude:  -0.18, longitude:  -78.47 },
  { label: "Reykjavík",        latitude:  64.13, longitude:  -21.95 },
  { label: "Rio de Janeiro",   latitude: -22.91, longitude:  -43.17 },
  { label: "Rome",             latitude:  41.90, longitude:   12.50 },
  { label: "San Francisco",    latitude:  37.77, longitude: -122.42 },
  { label: "São Paulo",        latitude: -23.55, longitude:  -46.63 },
  { label: "Seoul",            latitude:  37.57, longitude:  126.98 },
  { label: "Shanghai",         latitude:  31.23, longitude:  121.47 },
  { label: "Singapore",        latitude:   1.35, longitude:  103.82 },
  { label: "Stockholm",        latitude:  59.33, longitude:   18.07 },
  { label: "Sydney",           latitude: -33.87, longitude:  151.21 },
  { label: "Tehran",           latitude:  35.69, longitude:   51.39 },
  { label: "Tokyo",            latitude:  35.68, longitude:  139.65 },
  { label: "Toronto",          latitude:  43.65, longitude:  -79.38 },
  { label: "Vancouver",        latitude:  49.28, longitude: -123.12 },
];


/** Pedagogical solar-reference latitudes. */
export const SITE_PRESET_REFERENCES: SitePreset[] = [
  { label: "Equator",                 latitude:   0.00, longitude:   0.00 },
  { label: "Tropic of Cancer",        latitude:  23.44, longitude:   0.00 },
  { label: "Tropic of Capricorn",     latitude: -23.44, longitude:   0.00 },
  { label: "Arctic Circle",           latitude:  66.56, longitude:   0.00 },
  { label: "Antarctic Circle",        latitude: -66.56, longitude:   0.00 },
  { label: "Greenwich (Prime Mer.)",  latitude:  51.48, longitude:   0.00 },
  { label: "North Pole",              latitude:  90.00, longitude:   0.00 },
  { label: "South Pole",              latitude: -90.00, longitude:   0.00 },
];


/** Tolerance for "does this preset match these coords" — 0.05° ≈ 5 km
 *  at the equator. Tight enough to avoid false positives but loose
 *  enough that the dropdown still highlights the right entry after
 *  the user rounded the inputs in the UI. */
const MATCH_TOL = 0.05;

/**
 * Look up the preset whose coords match `lat` / `lon` within
 * {@link MATCH_TOL}. Returns the matched `label` or `undefined`
 * for "custom" coords that don't match any preset.
 *
 * Used to keep the dropdown highlight in sync after the user
 * manually edits the lat / lon inputs.
 */
export function findMatchingPreset(lat: number, lon: number): string | undefined {
  for (const list of [SITE_PRESET_CITIES, SITE_PRESET_REFERENCES]) {
    for (const p of list) {
      if (Math.abs(p.latitude - lat) < MATCH_TOL &&
          Math.abs(p.longitude - lon) < MATCH_TOL) {
        return p.label;
      }
    }
  }
  return undefined;
}
