import {ModelExporter} from "../ModelExporter";
import type {ModelEncodeParams} from "../ModelEncodeParams";
import {PointsPrimitive} from "../../base/constants";
import {decompressPoint3WithAABB3} from "../../base/math/compression";
import {createVec3Float64} from "../../base/math/vector";
import {transformPoint3} from "../../base/math/matrix";
import {createUUID} from "../../base/utils";
import {crc32c, logicalToPhysical} from "./parser";

const PAGE_SIZE = 1024;
const SECTION_LOGICAL_START = 48;     // header is 48 bytes; the section follows
const SECTION_HEADER_LENGTH = 32;
const DATA_PACKET = 1;
const COMPRESSED_VECTOR_SECTION = 1;
// f32 XYZ (+ optional 8-bit RGB) keep packets well under the uint16 length cap.
const RECORDS_PER_PACKET = 4000;

/**
 * Exports a {@link model!scene.SceneModel | SceneModel}'s point geometry to an
 * E57 (ASTM E2807) file.
 *
 * Writes a single `data3D` scan: world-space cartesian points as
 * `Float`/single, plus 8-bit RGB when the points carry colour. Emits the
 * page/CRC layer (CRC-32C, big-endian) so the file is valid for conformant
 * readers.
 *
 * v1 exports points only — non-{@link base!constants.PointsPrimitive} geometry
 * is skipped. There is no intensity / pose / multi-scan output yet.
 *
 * For detailed usage, refer to {@link e57 | @xeokit/sdk/formats/e57}.
 */
export class E57Exporter extends ModelExporter {
  constructor() {
    super({
      format: "E57",
      fileDataType: "arraybuffer",
      encoders: {"1.0": encodeE57},
      defaultVersion: "1.0",
    });
  }
}

interface Bounds {
  xmin: number; xmax: number; ymin: number; ymax: number; zmin: number; zmax: number;
}

async function encodeE57(params: ModelEncodeParams): Promise<Uint8Array> {
  const {sceneModel} = params;
  if (!sceneModel) {
    throw new Error("[E57Exporter] a sceneModel is required");
  }

  // ── 1. Gather world-space points + colours from point geometry ──
  const positions: number[] = [];
  const colors: number[] = [];
  let anyColor = false;
  const b: Bounds = {xmin: Infinity, xmax: -Infinity, ymin: Infinity, ymax: -Infinity, zmin: Infinity, zmax: -Infinity};
  const local = createVec3Float64();
  const world = createVec3Float64();

  for (const objectId of Object.keys(sceneModel.objects)) {
    for (const mesh of sceneModel.objects[objectId].meshes) {
      const geom = mesh.geometry;
      if (!geom || geom.primitive !== PointsPrimitive) continue;
      const pc = geom.positionsCompressed;
      const aabb = geom.aabb;
      if (!pc || !aabb) continue;
      const wm = mesh.worldMatrix;
      const cc = geom.colorsCompressed;
      if (cc) anyColor = true;
      const np = (pc.length / 3) | 0;
      for (let i = 0; i < np; i++) {
        local[0] = pc[i * 3]; local[1] = pc[i * 3 + 1]; local[2] = pc[i * 3 + 2];
        decompressPoint3WithAABB3(local, aabb, local);
        transformPoint3(wm, local, world);
        const x = world[0], y = world[1], z = world[2];
        positions.push(x, y, z);
        if (x < b.xmin) b.xmin = x; if (x > b.xmax) b.xmax = x;
        if (y < b.ymin) b.ymin = y; if (y > b.ymax) b.ymax = y;
        if (z < b.zmin) b.zmin = z; if (z > b.zmax) b.zmax = z;
        if (cc) colors.push(cc[i * 4], cc[i * 4 + 1], cc[i * 4 + 2]);
        else colors.push(255, 255, 255);
      }
    }
  }

  const count = (positions.length / 3) | 0;
  if (count === 0) {
    throw new Error("[E57Exporter] no point-cloud geometry found to export");
  }
  const hasColor = anyColor;

  // ── 2. CompressedVector binary section ──
  const dataPhysicalOffset = logicalToPhysical(SECTION_LOGICAL_START + SECTION_HEADER_LENGTH, PAGE_SIZE);
  const packets = buildPackets(positions, colors, hasColor, count);
  const sectionLength = SECTION_HEADER_LENGTH + packets.length;
  const section = new Uint8Array(sectionLength);
  const sdv = new DataView(section.buffer);
  sdv.setUint8(0, COMPRESSED_VECTOR_SECTION);
  sdv.setBigUint64(8, BigInt(sectionLength), true);
  sdv.setBigUint64(16, BigInt(dataPhysicalOffset), true);
  sdv.setBigUint64(24, 0n, true); // no packet index emitted
  section.set(packets, SECTION_HEADER_LENGTH);

  // ── 3. XML ──
  const fileOffset = logicalToPhysical(SECTION_LOGICAL_START, PAGE_SIZE);
  const xmlBytes = new TextEncoder().encode(buildXml(sceneModel.id, fileOffset, count, hasColor, b));

  // ── 4. Assemble the logical stream (header + section + xml), then header ──
  const xmlLogicalStart = SECTION_LOGICAL_START + section.length;
  const xmlPhysicalOffset = logicalToPhysical(xmlLogicalStart, PAGE_SIZE);
  const logicalLength = xmlLogicalStart + xmlBytes.length;
  const pages = Math.ceil(logicalLength / (PAGE_SIZE - 4));
  const filePhysicalLength = pages * PAGE_SIZE;

  const logical = new Uint8Array(logicalLength);
  const sig = "ASTM-E57";
  for (let i = 0; i < 8; i++) logical[i] = sig.charCodeAt(i);
  const hdv = new DataView(logical.buffer, 0, SECTION_LOGICAL_START);
  hdv.setUint32(8, 1, true);   // versionMajor
  hdv.setUint32(12, 0, true);  // versionMinor
  hdv.setBigUint64(16, BigInt(filePhysicalLength), true);
  hdv.setBigUint64(24, BigInt(xmlPhysicalOffset), true);
  hdv.setBigUint64(32, BigInt(xmlBytes.length), true);
  hdv.setBigUint64(40, BigInt(PAGE_SIZE), true);
  logical.set(section, SECTION_LOGICAL_START);
  logical.set(xmlBytes, xmlLogicalStart);

  // ── 5. Page/CRC layer ──
  return toPhysical(logical);
}

/** Splits records into 4-byte-aligned DATA packets, each carrying a contiguous
 *  slice of every field's bytestream (XYZ as f32, then RGB as bytes). */
function buildPackets(positions: number[], colors: number[], hasColor: boolean, count: number): Uint8Array {
  const nFields = hasColor ? 6 : 3;
  const parts: Uint8Array[] = [];
  for (let from = 0; from < count; from += RECORDS_PER_PACKET) {
    const recs = Math.min(RECORDS_PER_PACKET, count - from);
    const xyzBytes = recs * 4;
    const bsLens = hasColor
      ? [xyzBytes, xyzBytes, xyzBytes, recs, recs, recs]
      : [xyzBytes, xyzBytes, xyzBytes];
    const bufLen = bsLens.reduce((a, c) => a + c, 0);
    let packetLen = 6 + 2 * nFields + bufLen;
    packetLen += (4 - (packetLen & 3)) & 3; // 4-byte align

    const pk = new Uint8Array(packetLen);
    const dv = new DataView(pk.buffer);
    dv.setUint8(0, DATA_PACKET);
    dv.setUint8(1, 0); // flags
    dv.setUint16(2, packetLen - 1, true);
    dv.setUint16(4, nFields, true);
    let p = 6;
    for (const L of bsLens) { dv.setUint16(p, L, true); p += 2; }
    for (let axis = 0; axis < 3; axis++) {
      for (let k = 0; k < recs; k++) dv.setFloat32(p + k * 4, positions[(from + k) * 3 + axis], true);
      p += xyzBytes;
    }
    if (hasColor) {
      for (let ch = 0; ch < 3; ch++) {
        for (let k = 0; k < recs; k++) pk[p + k] = colors[(from + k) * 3 + ch];
        p += recs;
      }
    }
    parts.push(pk);
  }
  return concat(parts);
}

function buildXml(name: string, fileOffset: number, count: number, hasColor: boolean, b: Bounds): string {
  const colorProto = hasColor
    ? `
          <colorRed type="Integer" minimum="0" maximum="255"/>
          <colorGreen type="Integer" minimum="0" maximum="255"/>
          <colorBlue type="Integer" minimum="0" maximum="255"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<e57Root type="Structure" xmlns="http://www.astm.org/COMMIT/E57/2010-e57-v1.0">
  <formatName type="String"><![CDATA[ASTM E57 3D Imaging Data File]]></formatName>
  <guid type="String"><![CDATA[{${createUUID()}}]]></guid>
  <versionMajor type="Integer">1</versionMajor>
  <versionMinor type="Integer">0</versionMinor>
  <e57LibraryVersion type="String"><![CDATA[@xeokit/sdk]]></e57LibraryVersion>
  <data3D type="Vector" allowHeterogeneousChildren="1">
    <vectorChild type="Structure">
      <guid type="String"><![CDATA[{${createUUID()}}]]></guid>
      <name type="String"><![CDATA[${name}]]></name>
      <cartesianBounds type="Structure">
        <xMinimum type="Float">${b.xmin}</xMinimum><xMaximum type="Float">${b.xmax}</xMaximum>
        <yMinimum type="Float">${b.ymin}</yMinimum><yMaximum type="Float">${b.ymax}</yMaximum>
        <zMinimum type="Float">${b.zmin}</zMinimum><zMaximum type="Float">${b.zmax}</zMaximum>
      </cartesianBounds>
      <points type="CompressedVector" fileOffset="${fileOffset}" recordCount="${count}">
        <prototype type="Structure">
          <cartesianX type="Float" precision="single" minimum="${b.xmin}" maximum="${b.xmax}"/>
          <cartesianY type="Float" precision="single" minimum="${b.ymin}" maximum="${b.ymax}"/>
          <cartesianZ type="Float" precision="single" minimum="${b.zmin}" maximum="${b.zmax}"/>${colorProto}
        </prototype>
        <codecs type="Vector" allowHeterogeneousChildren="1"/>
      </points>
    </vectorChild>
  </data3D>
  <images2D type="Vector" allowHeterogeneousChildren="1"/>
</e57Root>`;
}

/** Wraps the logical stream in the physical page layer: `pageSize-4` data bytes
 *  per page followed by a big-endian CRC-32C of those bytes. */
function toPhysical(logical: Uint8Array): Uint8Array {
  const dataPer = PAGE_SIZE - 4;
  const pages = Math.ceil(logical.length / dataPer);
  const out = new Uint8Array(pages * PAGE_SIZE);
  const dv = new DataView(out.buffer);
  for (let p = 0; p < pages; p++) {
    const ls = p * dataPer;
    const le = Math.min(ls + dataPer, logical.length);
    out.set(logical.subarray(ls, le), p * PAGE_SIZE);
    // Remaining bytes of the last page stay zero (padding) and are covered by
    // the CRC over the full pageSize-4 data region.
    const crc = crc32c(out, p * PAGE_SIZE, p * PAGE_SIZE + dataPer);
    dv.setUint32(p * PAGE_SIZE + dataPer, crc, false); // big-endian, per the E57 page convention
  }
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of parts) total += c.length;
  const out = new Uint8Array(total);
  let w = 0;
  for (const c of parts) { out.set(c, w); w += c.length; }
  return out;
}
