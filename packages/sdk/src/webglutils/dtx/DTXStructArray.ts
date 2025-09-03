
/**
 * Configuration options for creating a `DTXStructArray`.
 *
 * Defines the WebGL context, capacity, and structure specification for the array.
 * Used to initialize a GPU-backed array of structured data for efficient rendering.
 *
 * ### Properties:
 * - `gl`: The WebGL2 rendering context.
 * - `capacity`: Maximum number of structs the array can hold.
 * - `structSpec`: Specification of the struct layout, including field names and types.
 *
 * ### Usage:
 * ```typescript
 * const options: DTXStructArrayOptions = {
 *   gl: webglContext,
 *   capacity: 1000,
 *   structSpec: {
 *     name: "MyStruct",
 *     fields: [
 *       { name: "id", type: "scalar" },
 *       { name: "position", type: "vec3" },
 *       { name: "color", type: "vec4" }
 *     ]
 *   }
 * };
 * const structArray = new DTXStructArray(options);
 */
export interface DTXStructArrayOptions {
  gl: WebGL2RenderingContext;
  capacity: number;
  structSpec: DTXStructSpec;
}

/**
 * Defines the specification for a field in a struct used by `DTXStructArray`.
 *
 * Each field represents a component of the struct, specifying its name and type.
 * Supported types include scalar values and vector types commonly used in WebGL.
 *
 * ### Properties:
 * - `name`: The name of the field.
 * - `type`: The data type of the field, which can be:
 *   - `"scalar"`: Encodes a single uint32 value using 4 float components.
 *   - `"vec2"`: A 2-component vector.
 *   - `"vec3"`: A 3-component vector.
 *   - `"vec4"`: A 4-component vector.
 *
 * ### Usage:
 * Used as part of a `DTXStructSpec` to define the layout of structs stored in a `DTXStructArray`.
 *
 * ### Example:
 * ```typescript
 * const fieldSpec: DTXStructFieldSpec = {
 *   name: "position",
 *   type: "vec3"
 * };
 */
export interface DTXStructFieldSpec {
  name: string;
  type: "scalar" | "vec2" | "vec3" | "vec4";
}

/**
 * Defines the specification for a struct used by `DTXStructArray`.
 *
 * A `DTXStructSpec` describes the layout of a struct, including its name and fields.
 * Each field specifies its name and type, which can be scalar or vector types commonly
 * used in WebGL. This specification is used to define how data is stored and accessed
 * in a GPU-backed array.
 *
 * ### Properties:
 * - `name`: The name of the struct.
 * - `fields`: An array of `DTXStructFieldSpec` objects, each defining a field's name and type.
 *
 * ### Example:
 * ```typescript
 * const structSpec: DTXStructSpec = {
 *   name: "MyStruct",
 *   fields: [
 *     { name: "id", type: "scalar" },
 *     { name: "position", type: "vec3" },
 *     { name: "color", type: "vec4" }
 *   ]
 * };
 */
export interface DTXStructSpec {
  name: string;
  fields: DTXStructFieldSpec[];
}

/**
 * Represents a GPU-backed array of structured data, stored in a WebGL texture.
 *
 * The `DTXStructArray` class provides efficient storage and management of structured data
 * (e.g., positions, colors, attributes) for use in WebGL rendering. It supports dynamic updates,
 * partial texture uploads, and GLSL integration for accessing the data in shaders.
 *
 * ### Features:
 * - **Custom Struct Layouts**: Define struct layouts using `DTXStructSpec` with fields like `scalar`, `vec2`, `vec3`, and `vec4`.
 * - **Dynamic Updates**: Modify individual structs or batches and flush changes to the GPU.
 * - **Partial Uploads**: Upload only modified regions of the texture for performance.
 * - **GLSL Integration**: Generate GLSL unpacking functions for accessing struct data in shaders.
 *
 * ### Usage:
 * 1. Define a struct layout using `DTXStructSpec`.
 * 2. Create an instance of `DTXStructArray` with the desired capacity and layout.
 * 3. Use `setStructObject()` or `setStructObjects()` to write data.
 * 4. Call `flush()` to upload changes to the GPU.
 * 5. Access the data in GLSL using a generated unpacking function.
 *
 * ### Example:
 * ```typescript
 * const spec: DTXStructSpec = {
 *   name: "MyStruct",
 *   fields: [
 *     { name: "id", type: "scalar" },
 *     { name: "position", type: "vec3" },
 *     { name: "color", type: "vec4" }
 *   ]
 * };
 *
 * const array = new DTXStructArray({
 *   gl,
 *   capacity: 100,
 *   structSpec: spec
 * });
 *
 * array.setStructObject(0, {
 *   id: 123,
 *   position: [1.0, 2.0, 3.0],
 *   color: [1.0, 0.0, 0.0, 1.0]
 * });
 *
 * array.flush();
 *
 * const myObject = array.getStructObject(0);
 * myObject.id; // 123
 * myObject.position; // [1.0, 2.0, 3.0]
 * myObject.color; // [1.0, 0.0, 0.0, 1.0]
 * ````
 *
 * ### Methods:
 * * setStructObject(tileIndex, data): Writes a single struct to the array.
 * * setStructObjects(startIndex, objects): Writes multiple structs to the array.
 * * getStructObject(tileIndex): Reads a struct as a JavaScript object.
 * * flush(): Uploads modified data to the GPU.
 * * getTexture(): Returns the WebGL texture for use in shaders.
 */
export class DTXStructArray {

  /**
   * The WebGL texture storing the struct data.
   */
  readonly texture: WebGLTexture;

  /**
   * The struct specification defining the layout of each struct.
   */
  readonly structSpec: DTXStructSpec;

  /**
   * The backing Float32Array for struct data.
   */
  public readonly buffer: Float32Array<any>;

  private gl: WebGL2RenderingContext;
  private capacity: number;
  private stride: number; // in floats
  private strideAligned: number;

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
          return acc + 4; // one full texel
        case "vec2":
          return acc + 2;
        case "vec3":
          return acc + 3;
        case "vec4":
          return acc + 4;
      }
    }, 0);

  // Align stride to next multiple of 4
    this.strideAligned = (this.stride + 3) & ~3;

    const totalFloats = this.capacity * this.strideAligned;

    const textureWidth = 4096;
    const floatsPerRow = textureWidth * 4;
    const textureHeight = Math.ceil(totalFloats / floatsPerRow);

    const totalTexFloats = textureWidth * textureHeight * 4;
    this.buffer = new Float32Array(totalTexFloats);

    const texture = this.gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

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

    this.texture = texture;
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
    const offset = index * this.strideAligned;
    return this.buffer.subarray(offset, offset + this.stride);
  }

  /**
   * Reads and unpacks the struct at the given tileIndex as a JS object.
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
   * Writes the given JS object into the buffer at the specified struct tileIndex.
   */
  setStructObject(index: number, data: Record<string, number | number[]>): void {
    const view = this.getStructView(index);
    let offset = 0;
    for (const field of this.structSpec.fields) {
      const value = data[field.name];
      if (value === undefined) {
        continue;
        // throw new Error(`Missing field '${field.name}' in struct data`);
      }
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

  // --- flush(): upload dirty structs as whole-texel chunks, split at row ends ---
  flush(): void {
    const gl = this.gl;
    const texWidth = 4096;
    const floatsPerRow = texWidth * 4;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    for (const index of this.dirtyIndices) {
      const offset = index * this.strideAligned;
      const floatsToUpload = this.strideAligned;

      const rowIndex = Math.floor(offset / floatsPerRow);
      const rowOffset = offset % floatsPerRow;
      const xTexel = Math.floor(rowOffset / 4);
      const texels = floatsToUpload / 4;

      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        xTexel,
        rowIndex,
        texels,
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
   * Writes a batch of JS objects into the buffer starting at a given tileIndex.
   */
  setStructObjects(startIndex: number, objects: Record<string, number | number[]>[]): void {
    for (let i = 0; i < objects.length; i++) {
      this.setStructObject(startIndex + i, objects[i]);
    }
  }

  /**
   * Reads and returns a batch of JS objects from the buffer starting at a given tileIndex.
   */
  getStructObjects(startIndex: number, count: number): Record<string, number | number[]>[] {
    const result: Record<string, number | number[]>[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.getStructObject(startIndex + i));
    }
    return result;
  }

  /**
   * Destroys the internal resources.
   */
  destroy(): void {
    this.gl.deleteTexture(this.texture);
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
