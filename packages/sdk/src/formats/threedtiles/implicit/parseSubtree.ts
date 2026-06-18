/**
 * Parser for a 3D Tiles implicit-tiling `.subtree` file: a 24-byte header
 * (magic `subt`, version, JSON byte length, binary byte length), a JSON chunk
 * describing buffers / buffer views / availability, and a binary chunk holding
 * the availability bitstreams.
 *
 * Availability is exposed as predicates over a tile's local level + Morton
 * index (and a child subtree's Morton index), reading either a constant or a
 * little-endian bitstream.
 */

import {tilesBeforeLevel} from "./morton";

export interface SubtreeAvailability {
  isTileAvailable(localLevel: number, morton: number): boolean;
  isContentAvailable(localLevel: number, morton: number): boolean;
  isChildSubtreeAvailable(morton: number): boolean;
}

type BitPredicate = (index: number) => boolean;

export async function parseSubtree(
  buffer: ArrayBuffer,
  branch: number,
  fetchBuffer: (uri: string) => Promise<ArrayBuffer>,
): Promise<SubtreeAvailability> {
  const dv = new DataView(buffer);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== "subt") {
    throw new Error(`[ThreeDTilesLoader] Invalid subtree magic "${magic}"`);
  }
  const jsonByteLength = Number(dv.getBigUint64(8, true));
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 24, jsonByteLength)).trim());
  const binaryChunk = new Uint8Array(buffer, 24 + jsonByteLength);

  const buffers: (Uint8Array | null)[] = await Promise.all(
    (json.buffers || []).map(async (b: any) =>
      b.uri ? new Uint8Array(await fetchBuffer(b.uri)) : binaryChunk),
  );
  const bufferViews: Uint8Array[] = (json.bufferViews || []).map((bv: any) => {
    const buf = buffers[bv.buffer];
    return new Uint8Array(buf!.buffer, buf!.byteOffset + bv.byteOffset, bv.byteLength);
  });

  const predicate = (spec: any): BitPredicate => {
    if (!spec) return () => false;
    if (typeof spec.constant === "number") {
      const value = spec.constant === 1;
      return () => value;
    }
    const bvIndex = spec.bitstream ?? spec.bufferView;
    const bytes = bufferViews[bvIndex];
    return (index: number) => ((bytes[index >> 3] >> (index & 7)) & 1) === 1;
  };

  const tileAvail = predicate(json.tileAvailability);
  const contentSpec = Array.isArray(json.contentAvailability)
    ? json.contentAvailability[0]
    : json.contentAvailability;
  const contentAvail = predicate(contentSpec);
  const childAvail = predicate(json.childSubtreeAvailability);

  const indexOf = (localLevel: number, morton: number) => tilesBeforeLevel(branch, localLevel) + morton;

  return {
    isTileAvailable: (localLevel, morton) => tileAvail(indexOf(localLevel, morton)),
    isContentAvailable: (localLevel, morton) => contentAvail(indexOf(localLevel, morton)),
    isChildSubtreeAvailable: (morton) => childAvail(morton),
  };
}
