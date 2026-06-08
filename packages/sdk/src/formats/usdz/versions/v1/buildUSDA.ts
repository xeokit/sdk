/**
 * Serialises a normalised scene description to an ASCII USD (`.usda`)
 * layer.
 *
 * Pure and dependency-light by design (takes plain arrays, returns a
 * string) so it can be unit-tested without a SceneModel. The encoder
 * ({@link encode}) reads the SceneModel, dequantises geometry, and feeds
 * the result here.
 *
 * Emits the standard UsdPreviewSurface pattern: a `Looks` scope of
 * `Material` prims, then one `Xform` per object containing `Mesh` prims
 * with inlined points / faceVertexCounts / faceVertexIndices / normals,
 * a per-mesh `matrix4d xformOp:transform`, and a `material:binding`.
 *
 * @internal
 */

export interface USDAMaterial {
  /** Sanitised, unique USD prim name. */
  name: string;
  color?: ArrayLike<number>;      // rgb 0..1
  opacity?: number;
  metallic?: number;
  roughness?: number;
}

export interface USDAMesh {
  /** Sanitised, unique-within-object USD prim name. */
  name: string;
  positions: ArrayLike<number>;   // flat xyz, world units
  indices: ArrayLike<number>;     // triangle indices into positions
  normals?: ArrayLike<number>;    // flat xyz, one per position
  /** 16-element column-major transform. */
  matrix?: ArrayLike<number>;
  /** Name of a material in `materials`, or undefined. */
  materialName?: string;
}

export interface USDAObject {
  /** Sanitised, unique USD prim name. */
  name: string;
  meshes: USDAMesh[];
}

export interface USDAScene {
  objects: USDAObject[];
  materials: USDAMaterial[];
}

export function buildUSDA(scene: USDAScene): string {
  const out: string[] = [];
  out.push("#usda 1.0");
  out.push("(");
  out.push(`    defaultPrim = "World"`);
  out.push("    metersPerUnit = 1");
  out.push(`    upAxis = "Y"`);
  out.push(")");
  out.push("");
  out.push(`def Xform "World"`);
  out.push("{");

  if (scene.materials.length > 0) {
    out.push(`    def Scope "Looks"`);
    out.push("    {");
    for (const mat of scene.materials) {
      emitMaterial(out, mat);
    }
    out.push("    }");
    out.push("");
  }

  for (const obj of scene.objects) {
    out.push(`    def Xform "${obj.name}"`);
    out.push("    {");
    for (const mesh of obj.meshes) {
      emitMesh(out, mesh);
    }
    out.push("    }");
  }

  out.push("}");
  out.push("");
  return out.join("\n");
}

function emitMaterial(out: string[], mat: USDAMaterial): void {
  const path = `</World/Looks/${mat.name}>`;
  out.push(`        def Material "${mat.name}"`);
  out.push("        {");
  out.push(`            token outputs:surface.connect = <${path.slice(1, -1)}/Shader.outputs:surface>`);
  out.push(`            def Shader "Shader"`);
  out.push("            {");
  out.push(`                uniform token info:id = "UsdPreviewSurface"`);
  if (mat.color && mat.color.length >= 3) {
    out.push(`                color3f inputs:diffuseColor = (${num(mat.color[0])}, ${num(mat.color[1])}, ${num(mat.color[2])})`);
  }
  if (typeof mat.metallic === "number") {
    out.push(`                float inputs:metallic = ${num(mat.metallic)}`);
  }
  if (typeof mat.roughness === "number") {
    out.push(`                float inputs:roughness = ${num(mat.roughness)}`);
  }
  if (typeof mat.opacity === "number") {
    out.push(`                float inputs:opacity = ${num(mat.opacity)}`);
  }
  out.push(`                token outputs:surface`);
  out.push("            }");
  out.push("        }");
}

function emitMesh(out: string[], mesh: USDAMesh): void {
  out.push(`        def Mesh "${mesh.name}"`);
  out.push("        {");
  out.push(`            point3f[] points = [${vec3List(mesh.positions)}]`);

  const triCount = Math.floor(mesh.indices.length / 3);
  out.push(`            int[] faceVertexCounts = [${repeat3(triCount)}]`);
  out.push(`            int[] faceVertexIndices = [${intList(mesh.indices)}]`);

  if (mesh.normals && mesh.normals.length) {
    out.push(`            normal3f[] normals = [${vec3List(mesh.normals)}]`);
  }
  if (mesh.materialName) {
    out.push(`            rel material:binding = </World/Looks/${mesh.materialName}>`);
  }
  if (mesh.matrix && mesh.matrix.length === 16) {
    out.push(`            matrix4d xformOp:transform = ${matrix4(mesh.matrix)}`);
    out.push(`            uniform token[] xformOpOrder = ["xformOp:transform"]`);
  }
  out.push("        }");
}

// ── formatting helpers ──────────────────────────────────────────────────

/** USD's usda `matrix4d` is row-major row-vectors; chunking the column-major
 *  storage into four consecutive rows of four yields the correct matrix. */
function matrix4(m: ArrayLike<number>): string {
  const row = (i: number) => `(${num(m[i])}, ${num(m[i + 1])}, ${num(m[i + 2])}, ${num(m[i + 3])})`;
  return `( ${row(0)}, ${row(4)}, ${row(8)}, ${row(12)} )`;
}

function vec3List(a: ArrayLike<number>): string {
  const parts: string[] = [];
  for (let i = 0; i + 2 < a.length; i += 3) {
    parts.push(`(${num(a[i])}, ${num(a[i + 1])}, ${num(a[i + 2])})`);
  }
  return parts.join(", ");
}

function intList(a: ArrayLike<number>): string {
  const parts: string[] = [];
  for (let i = 0; i < a.length; i++) parts.push(String(a[i]));
  return parts.join(", ");
}

function repeat3(n: number): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push("3");
  return parts.join(", ");
}

/** Formats a number for usda — finite, never exponential. */
function num(x: number): string {
  if (!isFinite(x)) return "0";
  const s = x.toString();
  return (s.includes("e") || s.includes("E")) ? x.toFixed(9) : s;
}
