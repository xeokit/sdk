/**
 * Click-to-pick world map for the {@link SunStudyPanel}, in Plate
 * Carrée (equirectangular) projection. The projection is chosen
 * for trivial pixel ↔ lat/lon math — `x = lon + 180`, `y = 90 - lat`
 * — which is the whole point: no inverse-projection libraries, no
 * sphere math, exact at the cursor.
 *
 * Land outlines are hand-traced from memory at roughly the
 * Natural-Earth-110m level: recognizable continental shapes with
 * the major peninsulas, gulfs, and large islands, but no country
 * borders and no microscopic coast detail. The whole world is
 * stored as `(lon, lat)` arrays (one per polygon, see {@link CONTINENTS})
 * and converted to SVG `<path>` data at module load.
 *
 */


/** SVG viewBox width — one unit per longitude degree, so x = lon + 180. */
export const WORLD_MAP_VIEW_W = 360;

/** SVG viewBox height — one unit per latitude degree, so y = 90 - lat. */
export const WORLD_MAP_VIEW_H = 180;


/** One closed land polygon, stored as an array of `[lon, lat]` pairs. */
type LandPolygon = Array<[number, number]>;


/**
 * Continental + major-island land polygons. Each entry is a single
 * closed polygon traced counter-clockwise in `(lon, lat)`. Authoring
 * in lon/lat (not SVG x/y) keeps the data legible — anyone can read
 * "(-122, 49) → (-117, 32)" as "BC coast → Baja" without doing the
 * mental projection.
 */
const CONTINENTS: LandPolygon[] = [

  // ── North America ────────────────────────────────────────────
  // Counter-clockwise from the Alaska Panhandle around the Pacific
  // coast, through Mexico (with Baja peninsula + Gulf), Yucatán,
  // Florida, up the East Coast to Newfoundland, around Hudson Bay,
  // across the Canadian Arctic archipelago.
  [
    [-167,  66], [-164,  60], [-160,  58], [-155,  57], [-153,  60],
    [-148,  60], [-141,  60], [-138,  59], [-135,  58], [-133,  56],
    [-130,  55], [-128,  54], [-126,  52], [-125,  51], [-124,  49],
    [-124,  47], [-124,  46], [-124,  43], [-124,  41], [-122,  39],
    [-121,  36], [-120,  35], [-119,  34], [-118,  33], [-117,  32],
    [-116,  31], [-115,  30], [-114,  29], [-114,  28], [-112,  25],
    [-110,  23], [-109,  23], [-105,  21], [-103,  20], [-100,  17],
    [ -96,  16], [ -94,  16], [ -91,  15], [ -89,  16], [ -87,  17],
    [ -87,  18], [ -86,  20], [ -87,  21], [ -90,  21], [ -91,  19],
    [ -94,  18], [ -95,  19], [ -95,  21], [ -97,  26], [ -97,  28],
    [ -94,  30], [ -91,  30], [ -89,  30], [ -86,  30], [ -85,  29],
    [ -83,  28], [ -82,  27], [ -81,  26], [ -80,  25], [ -80,  27],
    [ -81,  31], [ -80,  32], [ -79,  33], [ -77,  35], [ -75,  37],
    [ -75,  38], [ -74,  39], [ -73,  40], [ -72,  41], [ -71,  41],
    [ -69,  42], [ -68,  44], [ -67,  45], [ -65,  44], [ -63,  45],
    [ -60,  46], [ -57,  47], [ -53,  47], [ -53,  49], [ -56,  51],
    [ -57,  53], [ -64,  55], [ -65,  58], [ -67,  60], [ -69,  61],
    [ -78,  62], [ -80,  60], [ -82,  58], [ -82,  56], [ -83,  55],
    [ -85,  55], [ -88,  56], [ -88,  60], [ -94,  60], [ -95,  58],
    [ -94,  57], [ -90,  53], [ -85,  52], [ -83,  53], [ -80,  56],
    [ -78,  60], [ -78,  64], [ -82,  68], [ -82,  73], [ -90,  76],
    [ -95,  74], [-100,  74], [-105,  73], [-110,  74], [-115,  73],
    [-120,  72], [-125,  71], [-130,  70], [-135,  70], [-140,  70],
    [-150,  71], [-155,  71], [-160,  70], [-165,  69], [-167,  68],
    [-167,  66],
  ],

  // ── Greenland ────────────────────────────────────────────────
  [
    [ -50,  60], [ -45,  60], [ -42,  62], [ -42,  66], [ -38,  66],
    [ -32,  68], [ -22,  70], [ -18,  74], [ -20,  78], [ -28,  82],
    [ -45,  83], [ -55,  82], [ -60,  78], [ -55,  74], [ -53,  68],
    [ -50,  64], [ -50,  60],
  ],

  // ── Iceland ──────────────────────────────────────────────────
  [
    [ -24,  66], [ -21,  66], [ -14,  66], [ -13,  65], [ -16,  63],
    [ -21,  63], [ -24,  65], [ -24,  66],
  ],

  // ── South America ────────────────────────────────────────────
  // Caribbean (Panama / Venezuela) → Brazilian Atlantic coast →
  // Río de la Plata → Patagonia → Tierra del Fuego → Chilean
  // fjord coast → Andean Pacific coast → Ecuador → back.
  [
    [ -77,  10], [ -75,  11], [ -72,  12], [ -68,  12], [ -64,  11],
    [ -62,  11], [ -60,   8], [ -58,   7], [ -55,   6], [ -52,   5],
    [ -50,   2], [ -49,   0], [ -48,  -1], [ -45,  -2], [ -44,  -3],
    [ -42,  -3], [ -39,  -3], [ -38,  -4], [ -36,  -5], [ -35,  -8],
    [ -37, -10], [ -38, -10], [ -39, -13], [ -39, -15], [ -39, -18],
    [ -40, -20], [ -41, -22], [ -43, -23], [ -45, -23], [ -48, -26],
    [ -50, -28], [ -52, -29], [ -54, -32], [ -56, -34], [ -57, -35],
    [ -58, -38], [ -61, -39], [ -63, -41], [ -64, -43], [ -65, -45],
    [ -67, -47], [ -68, -50], [ -69, -52], [ -71, -53], [ -69, -55],
    [ -71, -55], [ -73, -54], [ -74, -53], [ -74, -50], [ -75, -47],
    [ -74, -45], [ -73, -42], [ -75, -40], [ -73, -36], [ -72, -34],
    [ -72, -32], [ -71, -30], [ -71, -28], [ -70, -25], [ -70, -23],
    [ -70, -20], [ -71, -18], [ -76, -14], [ -77, -12], [ -78, -10],
    [ -79,  -7], [ -80,  -5], [ -81,  -3], [ -81,  -2], [ -80,   0],
    [ -80,   1], [ -78,   2], [ -78,   4], [ -77,   6], [ -77,   8],
    [ -77,  10],
  ],

  // ── Africa ───────────────────────────────────────────────────
  // Western Sahara → Mediterranean Maghreb → Libya/Egypt → Sinai →
  // Red Sea coast → Horn of Africa → East Africa → Mozambique →
  // Cape → Namibia → Gulf of Guinea → Senegal → back to Western Sahara.
  [
    [ -17,  21], [ -16,  24], [ -16,  26], [ -16,  28], [ -10,  31],
    [  -8,  33], [  -5,  35], [  -2,  35], [   0,  36], [   3,  36],
    [   5,  37], [   8,  37], [  10,  37], [  11,  35], [  10,  33],
    [  12,  33], [  15,  32], [  20,  31], [  25,  31], [  29,  31],
    [  31,  31], [  33,  32], [  34,  31], [  34,  29], [  35,  28],
    [  36,  28], [  37,  22], [  38,  18], [  40,  16], [  43,  12],
    [  44,  12], [  46,  11], [  48,  12], [  51,  12], [  51,  10],
    [  50,   8], [  48,   5], [  48,   2], [  44,   1], [  43,   1],
    [  41,  -2], [  40,  -4], [  40,  -6], [  40,  -8], [  40, -10],
    [  39, -12], [  39, -14], [  39, -16], [  39, -18], [  37, -20],
    [  35, -22], [  34, -24], [  35, -26], [  33, -28], [  32, -29],
    [  30, -31], [  28, -33], [  25, -34], [  22, -34], [  18, -34],
    [  17, -32], [  15, -29], [  14, -25], [  13, -23], [  13, -20],
    [  13, -17], [  12, -14], [  12, -12], [  13, -10], [  13,  -6],
    [  12,  -5], [  10,  -2], [   9,   0], [   8,   2], [   8,   4],
    [   6,   5], [   3,   6], [   0,   6], [  -3,   5], [  -5,   5],
    [  -8,   5], [ -10,   6], [ -13,   8], [ -15,  11], [ -16,  13],
    [ -17,  15], [ -17,  18], [ -17,  21],
  ],

  // ── Madagascar ───────────────────────────────────────────────
  [
    [  44, -12], [  47, -15], [  48, -20], [  49, -25], [  46, -25],
    [  44, -21], [  43, -17], [  44, -12],
  ],

  // ── Eurasia ──────────────────────────────────────────────────
  // Iberia → Mediterranean → Black Sea → Caspian → Persian Gulf →
  // Arabia → India → SE Asia → China east coast → Korea → Russian
  // Far East → Siberia → Scandinavia → back to Iberia.
  [
    [ -10,  37], [  -9,  38], [  -9,  43], [  -5,  44], [  -2,  43],
    [   3,  43], [   7,  43], [  10,  42], [  15,  40], [  18,  40],
    [  16,  43], [  13,  46], [  13,  45], [  17,  41], [  19,  40],
    [  23,  40], [  23,  37], [  25,  37], [  27,  37], [  29,  36],
    [  30,  37], [  32,  36], [  33,  35], [  36,  35], [  36,  37],
    [  39,  37], [  41,  41], [  46,  38], [  49,  37], [  51,  36],
    [  53,  37], [  56,  27], [  57,  25], [  52,  24], [  49,  28],
    [  48,  29], [  43,  29], [  39,  21], [  42,  16], [  52,  18],
    [  56,  20], [  60,  25], [  64,  25], [  67,  25], [  71,  20],
    [  73,  16], [  75,   8], [  78,  11], [  80,  13], [  80,  20],
    [  84,  22], [  88,  21], [  90,  22], [  91,  22], [  92,  21],
    [  94,  17], [  96,  16], [  98,  11], [ 100,   8], [ 102,   5],
    [ 105,   2], [ 105,   7], [ 108,  11], [ 109,  18], [ 112,  21],
    [ 117,  23], [ 121,  31], [ 121,  37], [ 124,  40], [ 127,  39],
    [ 126,  37], [ 130,  35], [ 132,  43], [ 138,  46], [ 142,  47],
    [ 142,  52], [ 145,  57], [ 156,  60], [ 162,  60], [ 167,  61],
    [ 170,  66], [ 175,  68], [ 179,  70], [ 180,  72], [ 165,  73],
    [ 155,  72], [ 140,  76], [ 130,  74], [ 110,  74], [  95,  76],
    [  75,  73], [  60,  70], [  50,  68], [  35,  68], [  30,  70],
    [  25,  71], [  28,  68], [  31,  62], [  30,  60], [  24,  60],
    [  18,  58], [  12,  58], [  10,  55], [   5,  53], [   2,  51],
    [  -1,  49], [  -4,  48], [  -5,  44], [  -7,  43], [  -9,  39],
    [ -10,  37],
  ],

  // ── Scandinavia (Norway / Sweden / Finland) ──────────────────
  // Drawn separately because the Eurasia ring goes via the Baltic.
  [
    [   5,  58], [   5,  62], [  11,  64], [  18,  69], [  22,  70],
    [  28,  71], [  31,  70], [  30,  66], [  26,  66], [  23,  64],
    [  21,  61], [  18,  58], [  12,  56], [   8,  58], [   5,  58],
  ],

  // ── British Isles ────────────────────────────────────────────
  // Great Britain (1).
  [
    [  -5,  50], [  -2,  50], [   1,  51], [   2,  53], [  -1,  56],
    [  -4,  58], [  -5,  58], [  -5,  55], [  -5,  53], [  -5,  50],
  ],
  // Ireland.
  [
    [ -10,  52], [  -7,  52], [  -6,  54], [  -8,  55], [ -10,  54],
    [ -10,  52],
  ],

  // ── Japan ────────────────────────────────────────────────────
  [
    [ 130,  31], [ 132,  33], [ 135,  34], [ 138,  35], [ 141,  39],
    [ 142,  43], [ 145,  45], [ 142,  41], [ 140,  38], [ 137,  36],
    [ 133,  34], [ 130,  31],
  ],

  // ── Philippines ──────────────────────────────────────────────
  [
    [ 120,   6], [ 122,   8], [ 124,  11], [ 125,  14], [ 122,  18],
    [ 120,  16], [ 119,  12], [ 120,   6],
  ],

  // ── Indonesia (Sumatra + Java as a single simplified blob) ──
  [
    [  95,   5], [ 100,   2], [ 104,  -1], [ 106,  -6], [ 112,  -8],
    [ 117,  -8], [ 122,  -8], [ 128,  -8], [ 131,  -8], [ 128,  -3],
    [ 122,  -1], [ 116,  -3], [ 110,  -5], [ 105,  -3], [ 100,   1],
    [  98,   3], [  95,   5],
  ],

  // ── Borneo ───────────────────────────────────────────────────
  [
    [ 108,   1], [ 113,   3], [ 117,   5], [ 118,   3], [ 117,  -1],
    [ 115,  -4], [ 111,  -3], [ 109,  -1], [ 108,   1],
  ],

  // ── New Guinea ───────────────────────────────────────────────
  [
    [ 131,  -1], [ 135,  -1], [ 140,  -2], [ 146,  -5], [ 150,  -9],
    [ 144,  -9], [ 139,  -8], [ 134,  -8], [ 132,  -5], [ 131,  -1],
  ],

  // ── Australia ────────────────────────────────────────────────
  [
    [ 114, -22], [ 114, -26], [ 117, -34], [ 121, -34], [ 126, -32],
    [ 130, -32], [ 134, -33], [ 136, -34], [ 139, -36], [ 144, -38],
    [ 147, -43], [ 150, -38], [ 150, -34], [ 153, -28], [ 153, -25],
    [ 148, -19], [ 145, -15], [ 142, -11], [ 137, -12], [ 134, -12],
    [ 130, -12], [ 124, -16], [ 121, -20], [ 116, -22], [ 114, -22],
  ],

  // ── Tasmania ─────────────────────────────────────────────────
  [
    [ 144, -41], [ 146, -41], [ 148, -41], [ 148, -43], [ 146, -44],
    [ 144, -43], [ 144, -41],
  ],

  // ── New Zealand (single simplified mass) ─────────────────────
  [
    [ 173, -34], [ 175, -37], [ 178, -38], [ 178, -41], [ 174, -41],
    [ 171, -43], [ 168, -46], [ 167, -47], [ 170, -45], [ 173, -41],
    [ 173, -34],
  ],

  // ── Cuba ─────────────────────────────────────────────────────
  [
    [ -85,  22], [ -83,  23], [ -80,  23], [ -77,  21], [ -75,  20],
    [ -78,  20], [ -82,  21], [ -84,  21], [ -85,  22],
  ],

  // ── Hispaniola (Haiti + Dominican Republic) ──────────────────
  [
    [ -74,  18], [ -71,  20], [ -68,  19], [ -69,  18], [ -71,  18],
    [ -74,  18],
  ],

  // ── Sri Lanka ────────────────────────────────────────────────
  [
    [  80,   9], [  82,   8], [  82,   6], [  80,   6], [  80,   9],
  ],

  // ── Sicily ───────────────────────────────────────────────────
  [
    [  12,  38], [  15,  38], [  15,  37], [  13,  37], [  12,  38],
  ],

  // ── Sardinia ─────────────────────────────────────────────────
  [
    [   8,  41], [  10,  41], [  10,  39], [   8,  39], [   8,  41],
  ],

  // ── Crete ────────────────────────────────────────────────────
  [
    [  24,  35], [  26,  35], [  26,  35], [  24,  35],
  ],

  // ── Hokkaido (Japan's northern island, separate from Honshu) ─
  [
    [ 140,  42], [ 144,  43], [ 145,  44], [ 145,  45], [ 142,  46],
    [ 140,  44], [ 140,  42],
  ],

  // ── Sakhalin ─────────────────────────────────────────────────
  [
    [ 142,  46], [ 144,  47], [ 143,  52], [ 142,  54], [ 141,  53],
    [ 141,  47], [ 142,  46],
  ],

  // ── Kamchatka Peninsula (separate visual element) ────────────
  [
    [ 156,  51], [ 162,  53], [ 163,  56], [ 162,  60], [ 158,  60],
    [ 158,  56], [ 156,  53], [ 156,  51],
  ],

  // ── Svalbard ─────────────────────────────────────────────────
  [
    [  12,  78], [  17,  78], [  20,  79], [  19,  80], [  14,  80],
    [  12,  79], [  12,  78],
  ],

  // ── Novaya Zemlya ────────────────────────────────────────────
  [
    [  52,  70], [  56,  70], [  58,  73], [  56,  76], [  52,  74],
    [  52,  70],
  ],

  // ── Antarctica (full band along the bottom) ──────────────────
  // Antarctica is a continuous mass, but in Plate Carrée it
  // unfolds across the entire 360°. A simple band reads as the
  // pole.
  [
    [-180, -72], [-150, -75], [-110, -73], [ -65, -68], [ -55, -64],
    [ -45, -78], [   0, -70], [  40, -68], [  80, -67], [ 110, -67],
    [ 140, -67], [ 170, -73], [ 180, -75], [ 180, -90], [-180, -90],
    [-180, -72],
  ],

];


/**
 * Convert a single `LandPolygon` to SVG path-data fragment.
 * Each `(lon, lat)` becomes `(lon + 180, 90 - lat)` in the
 * 360 × 180 viewBox. First vertex uses `M`, the rest `L`, and
 * the path closes with `Z`.
 */
function polyToPath(poly: LandPolygon): string {
  const parts: string[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [lon, lat] = poly[i];
    const x = (lon + 180).toFixed(1);
    const y = (90 - lat).toFixed(1);
    parts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  parts.push("Z");
  return parts.join(" ");
}


/** Combined SVG `d` attribute for every land polygon. */
const LAND_PATH = CONTINENTS.map(polyToPath).join(" ");


/**
 * Full SVG markup for the click-to-pick map. Pin overlay is added
 * inside the SVG so it scales with the viewBox; callers update
 * `#pin-dot` / `#pin-halo` `cx`/`cy` attributes (see
 * {@link latLonToViewBox}).
 */
export function worldMapSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `viewBox="0 0 ${WORLD_MAP_VIEW_W} ${WORLD_MAP_VIEW_H}" ` +
        `preserveAspectRatio="none" ` +
        `class="xkt-sun-map-svg">` +
      `<rect width="${WORLD_MAP_VIEW_W}" height="${WORLD_MAP_VIEW_H}" fill="#bcd5ec"/>` +
      // Graticule — major parallels (equator, tropics, polar
      // circles) at the angles a sun-study user actually cares
      // about; meridians at 60° intervals.
      `<g stroke="#9fbdd6" stroke-width="0.25" fill="none">` +
        `<line x1="0" y1="90"     x2="360" y2="90"     stroke-width="0.45"/>` +  // equator
        `<line x1="0" y1="66.56"  x2="360" y2="66.56" />` +                       // Tropic of Cancer
        `<line x1="0" y1="113.44" x2="360" y2="113.44"/>` +                       // Tropic of Capricorn
        `<line x1="0" y1="23.44"  x2="360" y2="23.44" />` +                       // Arctic Circle
        `<line x1="0" y1="156.56" x2="360" y2="156.56"/>` +                       // Antarctic Circle
        `<line x1="60"  y1="0" x2="60"  y2="180"/>` +
        `<line x1="120" y1="0" x2="120" y2="180"/>` +
        `<line x1="180" y1="0" x2="180" y2="180" stroke-width="0.45"/>` +         // prime meridian
        `<line x1="240" y1="0" x2="240" y2="180"/>` +
        `<line x1="300" y1="0" x2="300" y2="180"/>` +
      `</g>` +
      `<path id="land" d="${LAND_PATH}" ` +
            `fill="#dde2e7" stroke="#6e7480" stroke-width="0.35" ` +
            `stroke-linejoin="round"/>` +
      // Pin overlay — classic balloon-pointer shape, transform-
      // positioned so the *tip* sits exactly on the lat/lon.
      // The drop shadow under the tip and the strong red fill make
      // it pop against any land / ocean colour. Updated each time
      // SunStudy fires `onChanged` (see SunStudyPanel._refreshFromStudy).
      `<g id="pin" pointer-events="none" transform="translate(180, 90)">` +
        `<ellipse id="pin-shadow" cx="0" cy="1.2" rx="3.2" ry="1.0" ` +
                 `fill="#000" fill-opacity="0.30"/>` +
        `<path id="pin-body" ` +
              `d="M 0 0 C -5 -4, -5 -10, 0 -12 C 5 -10, 5 -4, 0 0 Z" ` +
              `fill="#e63946" stroke="#1b1b1b" stroke-width="0.5" ` +
              `stroke-linejoin="round"/>` +
        `<circle id="pin-hole" cx="0" cy="-8" r="1.8" fill="white" ` +
                `stroke="#1b1b1b" stroke-width="0.35"/>` +
      `</g>` +
    `</svg>`
  );
}


/**
 * Convert a click point on the SVG to `{latitude, longitude}`.
 *
 * `preserveAspectRatio="none"` means the SVG fills its container
 * exactly, so the click fraction across the rendered box maps
 * straight to the viewBox fraction.
 */
export function clientPointToLatLon(
  svg: SVGElement,
  clientX: number,
  clientY: number,
): { latitude: number; longitude: number } {
  const rect = svg.getBoundingClientRect();
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top)  / rect.height;
  return {
    latitude:  Math.max(-90,  Math.min(90,  90 - v * 180)),
    longitude: Math.max(-180, Math.min(180, u * 360 - 180)),
  };
}


/**
 * Convert `{latitude, longitude}` to SVG viewBox coordinates.
 * Used to position the pin overlay each time the SunStudy's
 * location changes.
 */
export function latLonToViewBox(
  latitude: number,
  longitude: number,
): { x: number; y: number } {
  return {
    x: (longitude + 180),
    y: (90 - latitude),
  };
}
