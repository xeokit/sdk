/**
 * Options for creating a DTXStructArray.
 */
import {WebGLDataTexture} from "../WebGLDataTexture";

export interface DTXStructArrayOptions {
  gl: WebGL2RenderingContext;
  capacity: number;
  structSpec: DTXStructSpec;
}

/**
 * Defines the specification for a field in a struct.
 * - "scalar" is stored as 4 float components encoding a single uint32.
 * - "vec2", "vec3", and "vec4" are stored as-is.
 */
export interface DTXStructFieldSpec {
  name: string;
  type: "scalar" | "vec2" | "vec3" | "vec4";
}

/**
 * Defines the specification for the structure stored in a DTXStructArray.
 */
export interface DTXStructSpec {
  name: string;
  fields: DTXStructFieldSpec[];
}

/**
 * Handle for referencing a specific struct instance within the array.
 */
export interface DTXStructHandle {
  id: number;
  base: number;
}

/**
 * A GPU-backed struct array with support for per-struct packing and partial texture updates.
 *
 * ## Usage
 *
 * ````javascript
 * // 1. Initialize WebGL2 context
 * const canvas = document.createElement("canvas");
 * document.body.appendChild(canvas);
 * const gl = canvas.getContext("webgl2");
 * if (!gl) {
 *   throw new Error("WebGL2 not supported");
 * }
 *
 * // 2. Define the struct layout using DTXStructFieldSpec[]
 * const layout: DTXStructFieldSpec[] = [
 *   { name: "id", type: "scalar" },
 *   { name: "position", type: "vec3" },
 *   { name: "velocity", type: "vec3" },
 *   { name: "color", type: "vec4" }
 * ];
 *
 * // 3. Wrap it in a DTXStructSpec
 * const spec: DTXStructSpec = {
 *   name: "MyStruct",
 *   fields: layout
 * };
 *
 * // 4. Create a DTXStructArray instance
 * const array = new DTXStructArray({
 *   gl,
 *   capacity: 100,
 *   structSpec: spec
 * });
 *
 * // 5. Write data to index 0
 * array.setStructObject(0, {
 *   id: 123456789,
 *   position: [1.0, 2.0, 3.0],
 *   velocity: [0.1, 0.0, -0.1],
 *   color: [1.0, 0.0, 0.0, 1.0]
 * });
 *
 * // 6. Write multiple values
 * array.setStructObjects(1, [
 *   {
 *     id: 987654321,
 *     position: [4.0, 5.0, 6.0],
 *     velocity: [0.2, 0.3, 0.4],
 *     color: [0.0, 1.0, 0.0, 1.0]
 *   },
 *   {
 *     id: 13579,
 *     position: [7.0, 8.0, 9.0],
 *     velocity: [0.5, -0.2, 0.0],
 *     color: [0.0, 0.0, 1.0, 1.0]
 *   }
 * ]);
 *
 * // 7. Read back a struct
 * const obj = array.getStructObject(0);
 * console.log("Object at index 0:", obj);
 *
 * // 8. Flush to upload modified parts to the GPU
 * array.flush();
 *
 * // 9. Generate and print GLSL code
 * const glsl = glslUnpackFunction(spec);
 * console.log("GLSL struct unpack function:\n", glsl);
 *
 * // 10. Bind texture for use in a shader
 * gl.activeTexture(gl.TEXTURE0);
 * gl.bindTexture(gl.TEXTURE_2D, array.getTexture());
 * ````
 */
export class DTXStructArray {

  /**
   *
   */
  readonly texture: WebGLDataTexture;

  /**
   *
   */
  readonly structSpec: DTXStructSpec;

  private gl: WebGL2RenderingContext;
  private capacity: number;
  private stride: number; // in floats
  private buffer: Float32Array<any>;
  private dirtyIndices = new Set<number>();

  /**
   * Creates a new DTXStructArray instance.
   */
  constructor(options: DTXStructArrayOptions) {

    this.gl = options.gl;
    this.structSpec = options.structSpec;
    this.capacity = options.capacity;

    const gl = this.gl;

    this.stride = this.structSpec.fields.reduce((acc, field) => {
      switch (field.type) {
        case "scalar":
          return acc + 4; // packed RGBA per scalar
        case "vec2":
          return acc + 2;
        case "vec3":
          return acc + 3;
        case "vec4":
          return acc + 4;
      }
    }, 0);

    this.buffer = new Float32Array(this.capacity * this.stride);

    const textureWidth = 4096;
    const floatsPerRow = textureWidth * 4; // 4 floats per RGBA texel
    const totalFloats = this.buffer.length;
    const textureHeight = Math.ceil(totalFloats / floatsPerRow);

    const texture = this.gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      textureWidth,
      textureHeight,
      0,
      gl.RGBA,
      gl.FLOAT,
      this.buffer
    );

    this.texture = new WebGLDataTexture({
      gl,
      texture,
      textureWidth,
      textureHeight,
      format: gl.RGBA,
      type: gl.FLOAT,
      textureData: this.buffer
    });
  }

  /**
   * Returns the number of floats used per struct.
   */
  getStride(): number {
    return this.stride;
  }

  /**
   * Returns a view into the underlying buffer for a specific struct.
   */
  getStructView(index: number): Float32Array<any> {
    const offset = index * this.stride;
    return this.buffer.subarray(offset, offset + this.stride);
  }

  /**
   * Reads and unpacks the struct at the given index as a JS object.
   */
  getStructObject(index: number): Record<string, number | number[]> {
    const view = this.getStructView(index);
    const result: Record<string, number | number[]> = {};
    let offset = 0;
    for (const field of this.structSpec.fields) {
      switch (field.type) {
        case "scalar": {
          const r = view[offset];
          const g = view[offset + 1];
          const b = view[offset + 2];
          const a = view[offset + 3];
          result[field.name] =
            ((a << 24) >>> 0) + ((b << 16) >>> 0) + ((g << 8) >>> 0) + (r >>> 0);
          offset += 4;
          break;
        }
        case "vec2":
          result[field.name] = [view[offset], view[offset + 1]];
          offset += 2;
          break;
        case "vec3":
          result[field.name] = [view[offset], view[offset + 1], view[offset + 2]];
          offset += 3;
          break;
        case "vec4":
          result[field.name] = [view[offset], view[offset + 1], view[offset + 2], view[offset + 3]];
          offset += 4;
          break;
      }
    }
    return result;
  }

  /**
   * Writes the given JS object into the buffer at the specified struct index.
   */
  setStructObject(index: number, data: Record<string, number | number[]>): void {
    const view = this.getStructView(index);
    let offset = 0;
    for (const field of this.structSpec.fields) {
      const value = data[field.name];
      switch (field.type) {
        case "scalar": {
          const uintVal = Math.min(Math.max(Number(value), 0), 0xFFFFFFFF) >>> 0;
          view[offset] = uintVal & 0xFF;
          view[offset + 1] = (uintVal >> 8) & 0xFF;
          view[offset + 2] = (uintVal >> 16) & 0xFF;
          view[offset + 3] = (uintVal >> 24) & 0xFF;
          offset += 4;
          break;
        }
        case "vec2": {
          const v = value as number[];
          view[offset] = v[0];
          view[offset + 1] = v[1];
          offset += 2;
          break;
        }
        case "vec3": {
          const v = value as number[];
          view[offset] = v[0];
          view[offset + 1] = v[1];
          view[offset + 2] = v[2];
          offset += 3;
          break;
        }
        case "vec4": {
          const v = value as number[];
          view[offset] = v[0];
          view[offset + 1] = v[1];
          view[offset + 2] = v[2];
          view[offset + 3] = v[3];
          offset += 4;
          break;
        }
      }
    }
    this.dirtyIndices.add(index);
  }

  /**
   * Uploads all dirty struct regions to the GPU texture.
   */
  flush(): void {
    const gl = this.gl;
    const floatsPerRow = this.texture.textureWidth * 4;
    const stride = this.stride;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    for (const index of this.dirtyIndices) {
      const offset = index * stride;
      const rowOffset = offset % floatsPerRow;
      const rowIndex = Math.floor(offset / floatsPerRow);
      const floatsLeft = this.buffer.length - offset;
      const floatsToUpload = Math.min(floatsLeft, stride);

      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        Math.floor(rowOffset / 4),
        rowIndex,
        Math.ceil(floatsToUpload / 4),
        1,
        gl.RGBA,
        gl.FLOAT,
        this.buffer.subarray(offset, offset + floatsToUpload)
      );
    }

    this.dirtyIndices.clear();
  }

  /**
   * Returns the backing WebGL texture.
   */
  getTexture(): WebGLTexture {
    return this.texture;
  }

  /**
   * Writes a batch of JS objects into the buffer starting at a given index.
   */
  setStructObjects(startIndex: number, objects: Record<string, number | number[]>[]): void {
    for (let i = 0; i < objects.length; i++) {
      this.setStructObject(startIndex + i, objects[i]);
    }
  }

  /**
   * Reads and returns a batch of JS objects from the buffer starting at a given index.
   */
  getStructObjects(startIndex: number, count: number): Record<string, number | number[]>[] {
    const result: Record<string, number | number[]>[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.getStructObject(startIndex + i));
    }
    return result;
  }
}


/**
 * Generates a GLSL unpacking function to access struct fields from a data texture.
 *
 * ## Usage
 *
 * ````javascript
 * // Define the struct specification
 * const structSpec: DTXStructSpec = {
 *   name: "MyStruct",
 *   fields: [
 *     { name: "id", type: "scalar" },
 *     { name: "position", type: "vec3" },
 *     { name: "color", type: "vec4" }
 *   ]
 * };
 *
 * // Generate the GLSL unpacking function from the spec
 * const glslCode = glslUnpackFunction(structSpec);
 *
 * // Print or inject this into a GLSL shader
 * console.log("Generated GLSL unpack function:\n", glslCode);
 * ````
 *
 * ### Output GLSL Code
 *
 * This is what glslUnpackFunction() would generate based on the above spec:
 *
 * ````glsl
 * struct MyStruct {
 *   scalar id;
 *   vec3 position;
 *   vec4 color;
 * };
 *
 * Struct unpackStruct(sampler2D tex, int floatIdx, int texWidth) {
 *   MyStruct s;
 *   {
 *     vec4 packed = texelFetch(tex, ivec2((floatIdx + 0) % texWidth, (floatIdx + 0) / texWidth), 0);
 *     s.id = uint(packed.r) + (uint(packed.g) << 8u) + (uint(packed.b) << 16u) + (uint(packed.a) << 24u);
 *   }
 *   s.position = vec3(
 *     texelFetch(tex, ivec2((floatIdx + 4) % texWidth, (floatIdx + 4) / texWidth), 0).r,
 *     texelFetch(tex, ivec2((floatIdx + 4) % texWidth, (floatIdx + 4) / texWidth), 0).g,
 *     texelFetch(tex, ivec2((floatIdx + 4) % texWidth, (floatIdx + 4) / texWidth), 0).b
 *   );
 *   s.color = texelFetch(tex, ivec2((floatIdx + 7) % texWidth, (floatIdx + 7) / texWidth), 0);
 *   return s;
 * }
 * ````
 *
 * ### Shader Integration Example
 *
 * You can use this in your GLSL vertex/fragment shader like so:
 *
 * ````glsl
 * uniform sampler2D u_structTex;
 * uniform int u_texWidth;
 * in int a_structIndex;
 *
 * void main() {
 *   int floatOffset = a_structIndex * STRIDE_IN_FLOATS; // from host-side knowledge
 *   MyStruct s = unpackStruct(u_structTex, floatOffset, u_texWidth);
 *
 *   vec3 pos = s.position;
 *   vec4 col = s.color;
 *   uint id = s.id;
 *
 *   // Now use s in your rendering logic
 *   gl_Position = vec4(pos, 1.0);
 * }
 * ````
 */
export function glslUnpackFunction(structSpec: DTXStructSpec): string {
  let offset = 0;
  const lines: string[] = [];

  lines.push(`struct ${structSpec.name} {`);
  for (const field of structSpec.fields) {
    lines.push(`  ${field.type} ${field.name};`);
  }
  lines.push("};\n");

  lines.push("Struct unpackStruct(sampler2D tex, int floatIdx, int texWidth) {");
  lines.push(`  ${structSpec.name} s;`);

  for (const field of structSpec.fields) {
    const base = `floatIdx + ${offset}`;
    const fetch = (ofs: number) => `texelFetch(tex, ivec2((${base} + ${ofs}) % texWidth, (${base} + ${ofs}) / texWidth), 0)`;

    if (field.type === "scalar") {
      lines.push(`  {`);
      lines.push(`    vec4 packed = ${fetch(0)};`);
      lines.push(`    s.${field.name} = uint(packed.r) + (uint(packed.g) << 8u) + (uint(packed.b) << 16u) + (uint(packed.a) << 24u);`);
      lines.push(`  }`);
      offset += 4;
    } else if (field.type === "vec2") {
      lines.push(`  s.${field.name} = vec2(`);
      lines.push(`    ${fetch(0)}.r, ${fetch(0)}.g`);
      lines.push(`  );`);
      offset += 2;
    } else if (field.type === "vec3") {
      lines.push(`  s.${field.name} = vec3(`);
      lines.push(`    ${fetch(0)}.r, ${fetch(0)}.g, ${fetch(0)}.b`);
      lines.push(`  );`);
      offset += 3;
    } else if (field.type === "vec4") {
      lines.push(`  s.${field.name} = ${fetch(0)};`);
      offset += 4;
    }
  }

  lines.push("  return s;");
  lines.push("}");
  return lines.join("\n");
}
