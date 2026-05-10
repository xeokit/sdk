import {ChunkReader} from "./chunkReader";
import {RVMPrimitive} from "./RVMPrimitive";
import {
  buildBox,
  buildCylinder,
  buildSphere
} from "../../../../procgen/buildGeometry";
import type {SceneGeometryParams} from "../../../../scene";
import {TrianglesPrimitive} from "../../../../constants";
import {
  buildCircTorus,
  buildEllipDish,
  buildFacetGroup,
  buildPyramid,
  buildRectTorus,
  buildSpherDish,
  type BuiltMesh
} from "./buildMeshes";

/**
 * Decodes an RVM primitive payload into a procedurally built geometry.
 * Returns `null` for primitives we don't materialise as triangle
 * meshes (currently: Line — 1D centerline data).
 *
 * Each primitive's payload has a known fixed size (FacetGroup excepted
 * — it walks a hierarchical contour structure). RVM has no per-chunk
 * size field, so every byte read here matters: under-reading would
 * mis-align every following chunk in the file.
 *
 * Translations / lengths in RVM are in millimetres and pmuc applies a
 * 0.001 scale at read-time. For consistency this loader does the same
 * on the matrix translation (in `parse.ts`) and scales each primitive
 * dimension here. Per-primitive scaling keeps every geometry on the
 * metres scale the SceneModel expects.
 *
 * @internal
 */
export function parsePrimitive(
  reader: ChunkReader,
  primitiveKind: RVMPrimitive
): SceneGeometryParams | null {

  switch (primitiveKind) {

    case RVMPrimitive.Pyramid: {
      const bottomX = reader.readFloat32() * 0.001;
      const bottomY = reader.readFloat32() * 0.001;
      const topX    = reader.readFloat32() * 0.001;
      const topY    = reader.readFloat32() * 0.001;
      const offsetX = reader.readFloat32() * 0.001;
      const offsetY = reader.readFloat32() * 0.001;
      const height  = reader.readFloat32() * 0.001;
      return paramsFromBuilt(buildPyramid(bottomX, bottomY, topX, topY, offsetX, offsetY, height));
    }

    case RVMPrimitive.Box: {
      const xLen = reader.readFloat32() * 0.001;
      const yLen = reader.readFloat32() * 0.001;
      const zLen = reader.readFloat32() * 0.001;
      const built = buildBox({ xSize: xLen, ySize: yLen, zSize: zLen });
      if (!built.ok) return null;
      return paramsFromProcgen(built.value);
    }

    case RVMPrimitive.RectTorus: {
      const rIn  = reader.readFloat32() * 0.001;
      const rOut = reader.readFloat32() * 0.001;
      const h    = reader.readFloat32() * 0.001;
      const ang  = reader.readFloat32();             // angle stays in radians
      return paramsFromBuilt(buildRectTorus(rIn, rOut, h, ang));
    }

    case RVMPrimitive.CircTorus: {
      const centreRadius = reader.readFloat32() * 0.001;
      const tubeRadius   = reader.readFloat32() * 0.001;
      const sweepAngle   = reader.readFloat32();
      return paramsFromBuilt(buildCircTorus(centreRadius, tubeRadius, sweepAngle));
    }

    case RVMPrimitive.EllipDish: {
      const baseRadius = reader.readFloat32() * 0.001;
      const height     = reader.readFloat32() * 0.001;
      return paramsFromBuilt(buildEllipDish(baseRadius, height));
    }

    case RVMPrimitive.SpherDish: {
      const baseRadius = reader.readFloat32() * 0.001;
      const height     = reader.readFloat32() * 0.001;
      return paramsFromBuilt(buildSpherDish(baseRadius, height));
    }

    case RVMPrimitive.Snout: {
      // 9 floats: bottomRadius, topRadius, height, xOffset, yOffset,
      // xBottomShear, yBottomShear, xTopShear, yTopShear. Shears /
      // offsets are recognised but not yet applied to the geometry.
      const bottomRadius = reader.readFloat32() * 0.001;
      const topRadius    = reader.readFloat32() * 0.001;
      const height       = reader.readFloat32() * 0.001;
      reader.skip(6 * 4);                            // 6 unused floats
      const built = buildCylinder({
        radiusTop: topRadius,
        radiusBottom: bottomRadius,
        height,
        radialSegments: 24,
        heightSegments: 1
      });
      if (!built.ok) return null;
      return paramsFromProcgen(built.value);
    }

    case RVMPrimitive.Cylinder: {
      const radius = reader.readFloat32() * 0.001;
      const height = reader.readFloat32() * 0.001;
      const built = buildCylinder({
        radiusTop: radius,
        radiusBottom: radius,
        height,
        radialSegments: 24,
        heightSegments: 1
      });
      if (!built.ok) return null;
      return paramsFromProcgen(built.value);
    }

    case RVMPrimitive.Sphere: {
      const diameter = reader.readFloat32() * 0.001;
      const built = buildSphere({
        radius: diameter * 0.5,
        widthSegments: 24,
        heightSegments: 16
      });
      if (!built.ok) return null;
      return paramsFromProcgen(built.value);
    }

    case RVMPrimitive.Line: {
      // 2 floats — centerline parameters. Skipped (no triangle mesh).
      reader.skip(2 * 4);
      return null;
    }

    case RVMPrimitive.FacetGroup: {
      const built = buildFacetGroup(reader, 0.001);
      if (built.indices.length === 0) return null;
      return paramsFromBuilt(built);
    }

    default:
      throw new Error(`[RVMLoader] unknown primitive type ${primitiveKind} — cannot resync without size field`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Adapters
// ─────────────────────────────────────────────────────────────────────

function paramsFromProcgen(geom: any): SceneGeometryParams {
  return {
    id: "",
    primitive: TrianglesPrimitive,
    positions: geom.positions,
    normals:   geom.normals,
    uvs:       geom.uv,
    indices:   geom.indices
  };
}

function paramsFromBuilt(built: BuiltMesh): SceneGeometryParams {
  return {
    id: "",
    primitive: TrianglesPrimitive,
    positions: built.positions,
    normals:   built.normals,
    indices:   built.indices
  };
}
