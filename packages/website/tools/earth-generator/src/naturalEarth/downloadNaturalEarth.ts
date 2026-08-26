import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import {ensureDir, exists} from "../util/files";

const BASE_URL = "https://naturalearth.s3.amazonaws.com";

export async function ensureNaturalEarthDataset(name: string, forceDownload: boolean, verbose: boolean): Promise<string> {
  const cacheDir = path.resolve("data/cache");
  const extractRoot = path.resolve("data/natural-earth");
  const zipPath = path.join(cacheDir, `${name}.zip`);
  const datasetDir = path.join(extractRoot, name);
  const shpPath = path.join(datasetDir, `${name}.shp`);

  await ensureDir(cacheDir);
  await ensureDir(datasetDir);

  if (forceDownload || !(await exists(zipPath))) {
    const url = `${BASE_URL}/${datasetCategory(name)}/${name}.zip`;
    if (verbose) {
      console.log(`[earth-generator] downloading ${url}`);
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }
    await fs.writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  }

  if (forceDownload || !(await exists(shpPath))) {
    if (verbose) {
      console.log(`[earth-generator] extracting ${zipPath}`);
    }
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(datasetDir, true);
  }

  if (!(await exists(shpPath))) {
    throw new Error(`Expected shapefile was not extracted: ${shpPath}`);
  }
  return shpPath;
}

function datasetCategory(name: string): "10m_physical" | "10m_cultural" {
  return name.startsWith("ne_10m_admin_") ? "10m_cultural" : "10m_physical";
}
