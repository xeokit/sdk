/**
 * Sun position computation — given a date / time / latitude / longitude
 * and timezone, returns the sun's altitude (degrees above the local
 * horizon) and azimuth (degrees clockwise from local north) at that
 * site.
 *
 * Implements the **NOAA Solar Position Algorithm** (Spencer / Reda &
 * Andreas, simplified). Accuracy is ≈±0.1° over the period 1950–2050
 * — sub-arc-minute, plenty for daylight visualisation, shadow studies,
 * LEED EQ Credit 8.1 sufficiency analysis, and code-compliance reports
 * up to BREEAM Hea 01 / EN 17037 tolerances.
 *
 * Pure function, zero allocations beyond the returned `SunPosition`
 * object. Safe to call inside a per-frame animation loop — the cost
 * is a handful of trig ops, not a numerical-integration pass.
 *
 * ## Coordinate convention
 *
 * - **Altitude** in `[-90, 90]` degrees. `0` = on the horizon,
 *   `+90` = straight up, negative = below the horizon (night).
 * - **Azimuth** in `[0, 360)` degrees, **clockwise from north**.
 *   `0` = due north, `90` = due east, `180` = due south, `270` = west.
 *
 * To convert to a Cartesian direction-from-sun vector in a Z-up world
 * with X=east, Y=north, Z=up (see {@link sunDirection}):
 * ```
 *   x = -cos(altitude) * sin(azimuth)
 *   y = -cos(altitude) * cos(azimuth)
 *   z = -sin(altitude)
 * ```
 * (negated because the directional-light's `dir` vector points FROM
 * the sun TO the scene, opposite to the sun's apparent direction
 * from the observer.)
 *
 * @module presentations/sunStudy
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;


/**
 * Computed sun state at a moment in time at a particular site.
 */
export interface SunPosition {

  /** Degrees above the local horizon (positive = day, negative = night). */
  altitude: number;

  /** Degrees clockwise from local north (0 = N, 90 = E, 180 = S, 270 = W). */
  azimuth: number;

  /** `true` when `altitude > 0` — useful for shaders / scheduler logic
   *  that wants to switch between "day" and "night" environment lighting. */
  aboveHorizon: boolean;
}


/**
 * Compute the sun's position at `date` (treated as the absolute moment
 * in UTC) as seen from `latitude` / `longitude`.
 *
 * @param date              JS `Date` — interpreted as the UTC moment
 *                          regardless of the running environment's
 *                          timezone. Pass `new Date()` for "now".
 * @param latitudeDegrees   Site latitude in degrees, positive north,
 *                          range `[-90, 90]`.
 * @param longitudeDegrees  Site longitude in degrees, positive east,
 *                          range `[-180, 180]`.
 */
export function computeSunPosition(
  date: Date,
  latitudeDegrees: number,
  longitudeDegrees: number,
): SunPosition {

  // ── Julian Day for the given UTC moment ─────────────────────────
  // Standard astronomical formula via JS Date's getTime() (epoch ms)
  // — independent of the host's local timezone.
  const julianDay = date.getTime() / 86400000 + 2440587.5;
  const T = (julianDay - 2451545.0) / 36525.0;

  // ── Geometric mean longitude of the sun (degrees) ───────────────
  let L0 = 280.46646 + T * (36000.76983 + T * 0.0003032);
  L0 = ((L0 % 360) + 360) % 360;

  // ── Geometric mean anomaly of the sun (degrees → rad) ───────────
  const M = (357.52911 + T * (35999.05029 - 0.0001537 * T)) * DEG2RAD;

  // ── Eccentricity of earth's orbit (dimensionless) ───────────────
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  // ── Sun's equation of centre (degrees) ──────────────────────────
  const C = Math.sin(M)     * (1.914602 - T * (0.004817 + 0.000014 * T))
          + Math.sin(2 * M) * (0.019993 - 0.000101 * T)
          + Math.sin(3 * M) *  0.000289;

  // ── Sun's true longitude (degrees) ──────────────────────────────
  const trueLong = L0 + C;

  // ── Sun's apparent longitude (degrees → rad), nutation-corrected.
  const omega = (125.04 - 1934.136 * T) * DEG2RAD;
  const appLong = (trueLong - 0.00569 - 0.00478 * Math.sin(omega)) * DEG2RAD;

  // ── Obliquity of the ecliptic (degrees → rad) ───────────────────
  const e0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const epsilon = (e0 + 0.00256 * Math.cos(omega)) * DEG2RAD;

  // ── Sun's declination (rad) and right ascension (rad) ──────────
  const declination = Math.asin(Math.sin(epsilon) * Math.sin(appLong));

  // ── Equation of time (minutes), modified for apparent longitude ─
  const y = Math.tan(epsilon / 2) ** 2;
  const L0r = L0 * DEG2RAD;
  const eot = 4 * RAD2DEG * (
      y *               Math.sin(2 * L0r)
    - 2 * e          *  Math.sin(M)
    + 4 * e * y      *  Math.sin(M) * Math.cos(2 * L0r)
    - 0.5 * y * y    *  Math.sin(4 * L0r)
    - 1.25 * e * e   *  Math.sin(2 * M)
  );

  // ── True solar time (minutes since local midnight) ──────────────
  // Convert the absolute UTC moment + equation-of-time + longitude
  // into "minutes since local solar midnight". Doesn't reference the
  // observer's wall-clock timezone — the math works in absolute solar
  // time, and the caller has already encoded any wall-clock offset
  // into `date`.
  const utcMinutes =
      date.getUTCHours()        * 60
    + date.getUTCMinutes()
    + date.getUTCSeconds()      / 60
    + date.getUTCMilliseconds() / 60000;
  let tst = utcMinutes + eot + 4 * longitudeDegrees;
  tst = ((tst % 1440) + 1440) % 1440;

  // ── Hour angle (degrees → rad), zenith, altitude, azimuth ───────
  const hourAngleDeg = tst / 4 - 180;
  const H = hourAngleDeg * DEG2RAD;
  const latR = latitudeDegrees * DEG2RAD;

  const cosZ =   Math.sin(latR) * Math.sin(declination)
              + Math.cos(latR) * Math.cos(declination) * Math.cos(H);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  const altitude = (90 - zenith * RAD2DEG);

  // Azimuth via the atan2 form (NOAA SPA / SunCalc) — covers both
  // morning and afternoon in a single expression without sign-of-H
  // disambiguation. Returns the angle measured **from south,
  // clockwise**, in (-π, π]:
  //   - Solar noon (H = 0):     atan2(0, +) = 0          ⇒ +180° N-CW = 180° (south)
  //   - Summer NE sunrise:      atan2(-, -) ∈ third quad ⇒ ~50° N-CW   (NE-of-E)
  //   - Solar afternoon west:   atan2(+, +) ∈ first quad ⇒ ~270° N-CW  (W)
  // Add 180° at the end to convert from south-origin to the
  // north-origin convention this module promises.
  const tanDecl = Math.tan(declination);
  const azFromSouthRad = Math.atan2(
    Math.sin(H),
    Math.cos(H) * Math.sin(latR) - tanDecl * Math.cos(latR),
  );
  const azimuth = ((azFromSouthRad * RAD2DEG) + 180 + 360) % 360;

  return {
    altitude,
    azimuth,
    aboveHorizon: altitude > 0,
  };
}


/**
 * Convert a {@link SunPosition} to a Cartesian direction-of-light
 * vector suitable for `view.lights.* DirLight.dir`. Output is a unit
 * vector in **Z-up, X=east, Y=north** world frame.
 *
 * The vector points FROM the sun INTO the scene — i.e. it's the
 * direction sunlight travels, not the direction back to the sun.
 * That matches how every renderer in this SDK interprets a directional
 * light's `dir`.
 *
 * @param position    Sun position from {@link computeSunPosition}.
 * @param northAngleRadians  Optional clockwise rotation of the scene's
 *                           Y-axis away from true north. `0` (default)
 *                           means the scene's `+Y` IS true north.
 * @param out         Pre-allocated output (Float32Array | number[]).
 *                    Allocated fresh if omitted.
 */
export function sunDirection(
  position: SunPosition,
  northAngleRadians: number = 0,
  out?: Float32Array | number[],
): Float32Array | number[] {
  const dst = out ?? new Float32Array(3);
  const azR = position.azimuth * DEG2RAD - northAngleRadians;
  const altR = position.altitude * DEG2RAD;
  const cosAlt = Math.cos(altR);
  dst[0] = -cosAlt * Math.sin(azR);
  dst[1] = -cosAlt * Math.cos(azR);
  dst[2] = -Math.sin(altR);
  return dst;
}
