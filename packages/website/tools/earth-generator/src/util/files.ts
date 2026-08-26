import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, {recursive: true});
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function emptyDir(dir: string): Promise<void> {
  await fs.rm(dir, {recursive: true, force: true});
  await ensureDir(dir);
}

export async function writeFileAny(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  if (data instanceof ArrayBuffer) {
    await fs.writeFile(filePath, Buffer.from(data));
  } else if (ArrayBuffer.isView(data)) {
    await fs.writeFile(filePath, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  } else if (typeof data === "string") {
    await fs.writeFile(filePath, data, "utf8");
  } else {
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
}

export async function dirBytes(dir: string): Promise<number> {
  let total = 0;
  async function walk(current: string): Promise<void> {
    for (const entry of await fs.readdir(current, {withFileTypes: true})) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else {
        total += (await fs.stat(entryPath)).size;
      }
    }
  }
  await walk(dir);
  return total;
}
