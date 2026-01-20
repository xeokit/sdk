import { IfcAPI } from "web-ifc";

let ifcAPIInstance: IfcAPI | null = null;

/**
 * @private
 */
export async function getInitializedIFCAPI(): Promise<IfcAPI> {
  if (ifcAPIInstance) {
    return ifcAPIInstance;
  }

  const wasmPath = getWasmPath();
  if (!wasmPath) {
    throw new Error("[IFCLoader] Failed to determine environment");
  }

  const api = new IfcAPI();
  api.SetWasmPath(wasmPath);
  await api.Init();
  ifcAPIInstance = api;
  return ifcAPIInstance;
}

function getWasmPath(): string | null {
  const env = detectEnvironment();
  switch (env) {
    case "browser":
      return "https://cdn.jsdelivr.net/npm/web-ifc@0.0.50/";
    case "node":
      return "../../node_modules/web-ifc/";
    default:
      return null;
  }
}

function detectEnvironment(): "node" | "browser" | "unknown" {
  if (typeof process !== "undefined" && process.versions?.node) {
    return "node";
  }
  if (typeof window !== "undefined" && typeof window.document !== "undefined") {
    return "browser";
  }
  return "unknown";
}
