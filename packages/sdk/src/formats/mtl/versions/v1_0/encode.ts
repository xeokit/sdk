import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import type {SceneMaterial} from "../../../../scene";

/**
 * Encodes a SceneModel's materials as WaveFront MTL text.
 *
 * Compatible with the accompanying OBJ encoder:
 * - If a SceneMesh has `mesh.material`, exports `newmtl <material.id>`
 * - Otherwise exports fallback `newmtl mesh_<mesh.id>`
 *
 * Notes:
 * - Exports one `newmtl` block per SceneMaterial in sceneModel.materials.
 * - Also exports fallback materials for SceneMeshes that have no SceneMaterial,
 *   using each mesh's local color/opacity.
 * - Texture map export is optional and path-only.
 *
 * @private
 */
export function encode(params: ModelEncodeParams, options?: any): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    try {
      const {sceneModel} = params;

      const lines: string[] = [];
      const writtenMaterialIds = new Set<string>();

      lines.push("# WaveFront MTL");
      lines.push(`# SceneModel: ${sceneModel.id}`);
      lines.push("");

      // ------------------------------------------------------------------------------------------------
      // Export explicit SceneMaterials
      // ------------------------------------------------------------------------------------------------

      const sceneMaterials = Object.values(sceneModel.materials || {});

      for (let i = 0, len = sceneMaterials.length; i < len; i++) {
        const material = sceneMaterials[i];
        if (!material || writtenMaterialIds.has(material.id)) {
          continue;
        }

        const materialName = getMaterialNameForSceneMaterial(material);
        writeSceneMaterial(lines, materialName, material);
        writtenMaterialIds.add(materialName);
      }

      // ------------------------------------------------------------------------------------------------
      // Export fallback mesh-local materials for meshes without SceneMaterial
      // ------------------------------------------------------------------------------------------------

      const sceneMeshes = Object.values(sceneModel.meshes || {});

      for (let i = 0, len = sceneMeshes.length; i < len; i++) {
        const mesh = sceneMeshes[i];
        if (!mesh || mesh.material) {
          continue;
        }

        const fallbackMaterialId = getMaterialNameForMesh(mesh);

        if (writtenMaterialIds.has(fallbackMaterialId)) {
          continue;
        }

        const color = mesh.color || [1, 1, 1];
        const opacity = mesh.opacity ?? 1.0;
        const dissolve = clamp01(opacity);

        lines.push(`newmtl ${sanitizeMTLName(fallbackMaterialId)}`);
        lines.push(`Kd ${formatNum(color[0])} ${formatNum(color[1])} ${formatNum(color[2])}`);
        lines.push(`Ka 0.000000 0.000000 0.000000`);
        lines.push(`Ks 0.000000 0.000000 0.000000`);
        lines.push(`Ns 0.000000`);
        lines.push(`d ${formatNum(dissolve)}`);
        lines.push(`Tr ${formatNum(1.0 - dissolve)}`);
        lines.push(`illum 2`);
        lines.push("");

        writtenMaterialIds.add(fallbackMaterialId);
      }

      resolve(lines.join("\n"));
    } catch (e) {
      reject(e);
    }
  });
}

function writeSceneMaterial(lines: string[], materialName: string, material: SceneMaterial) {
  const color = material.color || [1, 1, 1];
  const opacity = material.opacity ?? 1.0;
  const dissolve = clamp01(opacity);

  lines.push(`newmtl ${sanitizeMTLName(materialName)}`);
  lines.push(`Kd ${formatNum(color[0])} ${formatNum(color[1])} ${formatNum(color[2])}`);
  lines.push(`Ka 0.000000 0.000000 0.000000`);
  lines.push(`Ks 0.000000 0.000000 0.000000`);
  lines.push(`Ns 0.000000`);
  lines.push(`d ${formatNum(dissolve)}`);
  lines.push(`Tr ${formatNum(1.0 - dissolve)}`);
  lines.push(`illum 2`);

  if (material.colorTexture?.src) {
    lines.push(`map_Kd ${sanitizeTexturePath(material.colorTexture.src)}`);
  }
  if (material.occlusionTexture?.src) {
    lines.push(`map_Ka ${sanitizeTexturePath(material.occlusionTexture.src)}`);
  }
  if (material.emissiveTexture?.src) {
    lines.push(`map_Ke ${sanitizeTexturePath(material.emissiveTexture.src)}`);
  }

  lines.push("");
}

function getMaterialNameForSceneMaterial(material: SceneMaterial): string {
  return material.id;
}

function getMaterialNameForMesh(mesh: any): string {
  return mesh.material?.id || `mesh_${mesh.id}`;
}

function sanitizeMTLName(name: string): string {
  return String(name || "unnamed").replace(/\s+/g, "_");
}

function sanitizeTexturePath(path: string): string {
  return String(path || "").trim();
}

function clamp01(value: number): number {
  if (!isFinite(value)) {
    return 1.0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function formatNum(value: number): string {
  if (!isFinite(value)) {
    return "0";
  }
  return Number(value.toFixed(9)).toString();
}
