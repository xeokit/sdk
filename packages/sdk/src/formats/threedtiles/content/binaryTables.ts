/**
 * Readers for the binary Feature Tables and Batch Tables shared by the 3D Tiles
 * tile content formats (b3dm, pnts, i3dm). A table is a JSON header optionally
 * referencing typed arrays packed in a trailing binary body.
 *
 * Layout reference: 3D Tiles 1.0 §"Feature Table" and §"Batch Table".
 */

const COMPONENT_ARRAYS: { [k: string]: any } = {
  BYTE: Int8Array,
  UNSIGNED_BYTE: Uint8Array,
  SHORT: Int16Array,
  UNSIGNED_SHORT: Uint16Array,
  INT: Int32Array,
  UNSIGNED_INT: Uint32Array,
  FLOAT: Float32Array,
  DOUBLE: Float64Array,
};

const COMPONENTS_PER_TYPE: { [k: string]: number } = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
};

/** Decodes a table's JSON header from its UTF-8 bytes (trailing pad stripped). */
export function decodeTableJSON(bytes: Uint8Array): any {
  if (bytes.length === 0) return {};
  const text = new TextDecoder().decode(bytes).trim();
  return text.length ? JSON.parse(text) : {};
}

/**
 * Reads a Feature Table property that is either an inline value (number or
 * array) or a `{byteOffset}` reference into `binary`. `ArrayType` and the
 * element count describe the typed-array layout for the reference case.
 */
export function readFeatureValue(
  json: any,
  binary: Uint8Array,
  key: string,
  ArrayType: any = Float32Array,
  components = 1,
  count = 1,
): any {
  const prop = json[key];
  if (prop == null) return null;
  if (typeof prop === "number" || Array.isArray(prop)) return prop;
  if (typeof prop.byteOffset === "number") {
    return new ArrayType(binary.buffer, binary.byteOffset + prop.byteOffset, components * count);
  }
  return null;
}

/**
 * Reads every Batch Table property into a per-feature row array of length
 * `count`. Inline JSON arrays are returned as-is; binary references are decoded
 * via their declared `componentType` / `type`, with multi-component values
 * grouped per feature.
 */
export function readBatchTable(
  json: any,
  binary: Uint8Array,
  count: number,
): { [key: string]: any[] } {
  const out: { [key: string]: any[] } = {};
  for (const key in json) {
    const prop = json[key];
    if (Array.isArray(prop)) {
      out[key] = prop;
      continue;
    }
    if (prop && typeof prop.byteOffset === "number") {
      const ArrayType = COMPONENT_ARRAYS[prop.componentType] || Float32Array;
      const comps = COMPONENTS_PER_TYPE[prop.type] || 1;
      const typed = new ArrayType(binary.buffer, binary.byteOffset + prop.byteOffset, comps * count);
      const rows: any[] = [];
      for (let i = 0; i < count; i++) {
        rows.push(comps === 1 ? typed[i] : Array.from(typed.subarray(i * comps, i * comps + comps)));
      }
      out[key] = rows;
    }
  }
  return out;
}
