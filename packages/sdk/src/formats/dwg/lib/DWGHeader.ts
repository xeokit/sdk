import type {Vec3} from "./Vec3";


/**
 * Document-level metadata on a {@link DWGDocument}.
 *
 * All fields optional — the loader only uses `units` for diagnostic
 * purposes today and doesn't depend on any of them. The DWG `INSUNITS`
 * system variable lands here when libredwg surfaces it; callers that
 * build a `DWGDocument` by hand (e.g. from a server-side conversion)
 * can omit the header entirely.
 *
 * @private
 */
export interface DWGHeader {
  /** DWG units enum value (`INSUNITS` system var). 1=in, 4=mm, 6=m, etc. */
  units?: number;
  /** Drawing AABB if the parser exposes it. */
  extents?: { min: Vec3; max: Vec3 };
}
