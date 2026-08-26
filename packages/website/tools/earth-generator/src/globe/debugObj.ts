import fs from "node:fs/promises";
import path from "node:path";
import type {LineData, MeshData} from "../types";
import {ensureDir} from "../util/files";

export async function writeDebugObj(outDir: string, meshes: MeshData[], lines: LineData[]): Promise<void> {
  const debugDir = path.join(outDir, "debug");
  await ensureDir(debugDir);
  let text = "# earth-generator debug geometry\n";
  let base = 1;
  for (const mesh of meshes) {
    text += `o ${mesh.id}\n`;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      text += `v ${mesh.positions[i]} ${mesh.positions[i + 1]} ${mesh.positions[i + 2]}\n`;
    }
    for (let i = 0; i < mesh.indices.length; i += 3) {
      text += `f ${base + mesh.indices[i]} ${base + mesh.indices[i + 1]} ${base + mesh.indices[i + 2]}\n`;
    }
    base += mesh.positions.length / 3;
  }
  for (const line of lines) {
    text += `o ${line.id}\n`;
    for (let i = 0; i < line.positions.length; i += 3) {
      text += `v ${line.positions[i]} ${line.positions[i + 1]} ${line.positions[i + 2]}\n`;
    }
    for (let i = 0; i < line.indices.length; i += 2) {
      text += `l ${base + line.indices[i]} ${base + line.indices[i + 1]}\n`;
    }
    base += line.positions.length / 3;
  }
  await fs.writeFile(path.join(debugDir, "earth.obj"), text, "utf8");
}
