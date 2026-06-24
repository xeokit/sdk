/**
 * 3DXML v1 encode pipeline: SceneModel → `.3dxml` (a ZIP of XML documents).
 *
 * The inverse of {@link parse}. Each triangle SceneMesh becomes a self-contained
 * part: its (dequantized) geometry is written to a `Rep_<n>.3DRep` representation
 * document, and the product structure places it under a single root with the
 * mesh's matrix as the instance `RelativeMatrix`:
 *
 *   model.3dxml (ProductStructure)
 *     Reference3D id=1 "root"
 *     per mesh: Reference3D (part) + Instance3D(root→part, RelativeMatrix)
 *               + ReferenceRep(→Rep_n.3DRep) + InstanceRep(part→rep)
 *   Rep_<n>.3DRep:  <Rep><SurfaceAttributes><Color…> <Faces><Face triangles…>
 *                        <VertexBuffer><Positions/><Normals/>
 *   Manifest.xml:   <Root>model.3dxml</Root>
 *
 * Geometry is *not* deduplicated across instances in v1 — one representation per
 * mesh — and only triangle-family geometry is exported. Builds XML as strings
 * (no DOMParser), so it runs in browser and Node alike.
 *
 * @internal
 */
import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {octDecodeNormalsU16, decompressPositions3WithAABB3} from "../../../../base/math/compression";

const textEncoder = new TextEncoder();

export async function encode(params: ModelEncodeParams, _options?: any): Promise<ArrayBuffer> {
  const sceneModel = params.sceneModel;
  if (!sceneModel) {
    throw new Error("[3DXMLExporter] params.sceneModel is required");
  }

  const structure: string[] = [`<Reference3D id="1" name="${esc(sceneModel.id)}"/>`];
  const repFiles: {name: string; data: Uint8Array}[] = [];

  let nextId = 2;      // structure node ids (1 is the root Reference3D)
  let repIndex = 0;    // representation file index

  for (const mesh of Object.values(sceneModel.meshes)) {
    const geom = mesh.geometry;
    if (!isTriangleFamily(geom.primitive) || !geom.indices || geom.indices.length === 0) {
      continue;   // v1 exports triangle geometry only
    }

    const positions = decompressPositions3WithAABB3(geom.positionsCompressed, geom.aabb as any);
    const normals = geom.normalsCompressed
      ? octDecodeNormalsU16(geom.normalsCompressed, new Float32Array((geom.normalsCompressed.length / 2) * 3))
      : null;

    const repName = `Rep_${repIndex}.3DRep`;
    repFiles.push({name: repName, data: textEncoder.encode(repDocument(positions, normals, geom.indices, mesh))});

    const partRefId = nextId++;
    const instId = nextId++;
    const repRefId = nextId++;
    const instRepId = nextId++;
    const name = esc(mesh.object?.id ?? mesh.id);

    structure.push(
      `<Reference3D id="${partRefId}" name="${name}"/>`,
      `<Instance3D id="${instId}" name="${name}">` +
        `<IsAggregatedBy>1</IsAggregatedBy><IsInstanceOf>${partRefId}</IsInstanceOf>` +
        `<RelativeMatrix>${relativeMatrix(mesh.matrix)}</RelativeMatrix></Instance3D>`,
      `<ReferenceRep id="${repRefId}" associatedFile="urn:3DXML:${repName}" format="TESSELLATED"/>`,
      `<InstanceRep id="${instRepId}">` +
        `<IsAggregatedBy>${partRefId}</IsAggregatedBy><IsInstanceOf>${repRefId}</IsInstanceOf></InstanceRep>`,
    );

    repIndex++;
  }

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Model_3dxml xmlns="http://www.3ds.com/xsd/3DXML">` +
    `<ProductStructure root="1">${structure.join("")}</ProductStructure></Model_3dxml>`;

  const manifest =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Manifest xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:noNamespaceSchemaLocation="Manifest.xsd"><Root>model.3dxml</Root></Manifest>`;

  return makeZip([
    {name: "Manifest.xml", data: textEncoder.encode(manifest)},
    {name: "model.3dxml", data: textEncoder.encode(model)},
    ...repFiles,
  ]);
}

function isTriangleFamily(primitive: number): boolean {
  return primitive === TrianglesPrimitive || primitive === SolidPrimitive || primitive === SurfacePrimitive;
}

/** Builds one `.3DRep` representation document for a mesh's geometry + colour. */
function repDocument(
  positions: ArrayLike<number>, normals: ArrayLike<number> | null, indices: ArrayLike<number>, mesh: any,
): string {
  const c = mesh.color;
  const color =
    `<SurfaceAttributes><Color red="${num(c[0])}" green="${num(c[1])}" blue="${num(c[2])}" alpha="${num(mesh.opacity)}"/></SurfaceAttributes>`;
  const faces = `<Faces><Face triangles="${ints(indices)}"/></Faces>`;
  const normalsXml = normals ? `<Normals>${floats(normals)}</Normals>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<XMLRepresentation xmlns="http://www.3ds.com/xsd/3DXML"><Rep>` +
    `${color}${faces}<VertexBuffer><Positions>${floats(positions)}</Positions>${normalsXml}</VertexBuffer>` +
    `</Rep></XMLRepresentation>`;
}

/** Mat4 (column-major) → 3DXML RelativeMatrix: 3 axis columns then translation (12 values). */
function relativeMatrix(m: ArrayLike<number>): string {
  return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10], m[12], m[13], m[14]].map(num).join(" ");
}

function floats(arr: ArrayLike<number>): string {
  let s = "";
  for (let i = 0; i < arr.length; i++) {
    s += (i ? " " : "") + num(arr[i]);
  }
  return s;
}

function ints(arr: ArrayLike<number>): string {
  let s = "";
  for (let i = 0; i < arr.length; i++) {
    s += (i ? " " : "") + (arr[i] | 0);
  }
  return s;
}

/** Compact number formatting — 6 dp, trailing zeros trimmed. */
function num(v: number): string {
  return String(+v.toFixed(6));
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Minimal STORED ZIP writer (valid CRC-32, so any reader accepts it) ─────────

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeZip(files: {name: string; data: Uint8Array}[]): ArrayBuffer {
  const parts: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = textEncoder.encode(f.name);
    const data = f.data;
    const crc = crc32(data);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);   // local file header
    lh.setUint16(4, 20, true);           // version needed
    lh.setUint16(8, 0, true);            // method 0 (STORED)
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); // compressed size
    lh.setUint32(22, data.length, true); // uncompressed size
    lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);   // central directory header
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(10, 0, true);           // method 0
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);      // local header offset
    centrals.push(new Uint8Array(ch.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of centrals) {
    cdSize += c.length;
  }

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);   // end of central directory
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, cdStart, true);

  const all = [...parts, ...centrals, new Uint8Array(eocd.buffer)];
  let total = 0;
  for (const a of all) {
    total += a.length;
  }
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of all) {
    out.set(a, p);
    p += a.length;
  }
  return out.buffer;
}
