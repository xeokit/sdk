import type {ModelParser} from "../../../ModelParser";
import {tokenize} from "./tokenize";
import {buildGeometry} from "./buildGeometry";
import {buildDataModel} from "./buildDataModel";
import type {
  FDSHead, FDSHole, FDSMesh, FDSModel, FDSObst, FDSRecord, FDSSurf, FDSVent,
  FDSRGB, FDSXB,
} from "./types";

/**
 * Top-level v6 FDS parser.
 *
 * @internal
 */
export const parse: ModelParser = async (params) => {
  const {fileData, sceneModel, dataModel} = params;
  if (typeof fileData !== "string") {
    throw new Error("[FDS/v6/parse] expected fileData to be a string");
  }

  const records = tokenize(fileData);
  const model = dispatch(records);

  if (sceneModel) {
    const r = buildGeometry(model, sceneModel);
    if (r.ok === false) throw new Error(r.error);
  }
  if (dataModel) {
    buildDataModel(model, dataModel, "fds");
  }

  // Build is in-memory only — caller is responsible for committing the
  // SceneModel / DataModel via their own `build()` afterwards, matching
  // how every other loader is wired (see XGFLoader callers in Studio).

  return {warnings: model.warnings};
};

/**
 * Dispatch the tokenizer's flat record stream into a typed
 * {@link FDSModel}. Unknown groups become warnings.
 */
function dispatch(records: readonly FDSRecord[]): FDSModel {
  const model: FDSModel = {
    head: null,
    meshes: [],
    surfs: new Map(),
    obsts: [],
    vents: [],
    holes: [],
    warnings: [],
  };

  for (const rec of records) {
    switch (rec.group) {
      case "HEAD":  model.head = parseHead(rec); break;
      case "MESH":  pushIf(model.meshes, parseMesh(rec, model)); break;
      case "SURF":  pushSurf(model, rec); break;
      case "OBST":  pushIf(model.obsts, parseObst(rec, model)); break;
      case "VENT":  pushIf(model.vents, parseVent(rec, model)); break;
      case "HOLE":  pushIf(model.holes, parseHole(rec, model)); break;
      case "DEVC":
      case "REAC":
      case "CTRL":
      case "MULT":
      case "GEOM":
      case "PART":
      case "RAMP":
      case "MATL":
      case "TIME":
      case "DUMP":
      case "MISC":
      case "INIT":
      case "PROP":
      case "RADI":
      case "SPEC":
        // Honoured group names we currently ignore; no warning, they're
        // common in any non-trivial input file.
        break;
      default:
        model.warnings.push(`Ignored unknown namelist group '${rec.group}' at line ${rec.line}`);
    }
  }

  return model;
}

function pushIf<T>(arr: T[], item: T | null): void {
  if (item !== null) arr.push(item);
}

function parseHead(rec: FDSRecord): FDSHead {
  return {
    chid:  asString(rec.params.get("CHID")),
    title: asString(rec.params.get("TITLE")),
  };
}

function parseMesh(rec: FDSRecord, model: FDSModel): FDSMesh | null {
  const xb = asXB(rec.params.get("XB"));
  if (!xb) {
    model.warnings.push(`MESH at line ${rec.line} missing/invalid XB; skipped`);
    return null;
  }
  const ijk = asTriple(rec.params.get("IJK"));
  return {
    id:  asString(rec.params.get("ID")),
    xb,
    ijk: ijk ?? undefined,
  };
}

function pushSurf(model: FDSModel, rec: FDSRecord): void {
  const id = asString(rec.params.get("ID"));
  if (!id) {
    model.warnings.push(`SURF at line ${rec.line} missing ID; skipped`);
    return;
  }
  const surf: FDSSurf = {
    id,
    rgb:          asRGB(rec.params.get("RGB")),
    color:        asString(rec.params.get("COLOR")),
    transparency: asNumber(rec.params.get("TRANSPARENCY")),
    extras:       extras(rec.params, ["ID", "RGB", "COLOR", "TRANSPARENCY"]),
  };
  model.surfs.set(id, surf);
}

function parseObst(rec: FDSRecord, model: FDSModel): FDSObst | null {
  const xb = asXB(rec.params.get("XB"));
  if (!xb) {
    model.warnings.push(`OBST at line ${rec.line} missing/invalid XB; skipped`);
    return null;
  }
  return {
    id:     asString(rec.params.get("ID")),
    xb,
    surfId: asString(rec.params.get("SURF_ID")),
    rgb:    asRGB(rec.params.get("RGB")),
    color:  asString(rec.params.get("COLOR")),
    extras: extras(rec.params, ["ID", "XB", "SURF_ID", "RGB", "COLOR"]),
  };
}

function parseVent(rec: FDSRecord, model: FDSModel): FDSVent | null {
  const xb = asXB(rec.params.get("XB"));
  const mb = asString(rec.params.get("MB"));
  if (!xb && !mb) {
    model.warnings.push(`VENT at line ${rec.line} missing XB and MB; skipped`);
    return null;
  }
  return {
    id:     asString(rec.params.get("ID")),
    xb:     xb ?? undefined,
    mb:     mb ?? undefined,
    ior:    asNumber(rec.params.get("IOR")),
    surfId: asString(rec.params.get("SURF_ID")),
    rgb:    asRGB(rec.params.get("RGB")),
    color:  asString(rec.params.get("COLOR")),
    extras: extras(rec.params, ["ID", "XB", "MB", "IOR", "SURF_ID", "RGB", "COLOR"]),
  };
}

function parseHole(rec: FDSRecord, model: FDSModel): FDSHole | null {
  const xb = asXB(rec.params.get("XB"));
  if (!xb) {
    model.warnings.push(`HOLE at line ${rec.line} missing/invalid XB; skipped`);
    return null;
  }
  return {
    id:     asString(rec.params.get("ID")),
    xb,
    extras: extras(rec.params, ["ID", "XB"]),
  };
}

// ─────────── primitive coercion ───────────

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asXB(v: unknown): FDSXB | undefined {
  if (!Array.isArray(v) || v.length < 6) return undefined;
  const out: number[] = [];
  for (let i = 0; i < 6; i++) {
    const n = v[i];
    if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
    out.push(n);
  }
  return out as unknown as FDSXB;
}

function asTriple(v: unknown): [number, number, number] | undefined {
  if (!Array.isArray(v) || v.length < 3) return undefined;
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    const n = v[i];
    if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
    out.push(n);
  }
  return [out[0], out[1], out[2]];
}

function asRGB(v: unknown): FDSRGB | undefined {
  if (!Array.isArray(v) || v.length < 3) return undefined;
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    const n = v[i];
    if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
    out.push(n);
  }
  return [out[0], out[1], out[2]];
}

function extras(params: ReadonlyMap<string, unknown>, consumed: readonly string[]): ReadonlyMap<string, unknown> {
  const skip = new Set(consumed);
  const out = new Map<string, unknown>();
  for (const [k, v] of params) {
    if (skip.has(k)) continue;
    out.set(k, v);
  }
  return out;
}
