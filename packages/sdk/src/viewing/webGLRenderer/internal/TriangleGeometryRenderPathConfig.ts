import {NavigationRender} from "../../../base/constants";

export type OpaqueTriangleRenderPath = "dtx-only" | "vbo-first" | "vbo-only" | "hybrid";
export type TriangleGeometryStorageMode = "dtx" | "vbo";

const TRIANGLE_VBO_GEOMETRY_DRAWTECHNIQUES_FLAG = "XEOKIT_WEBGL_DRAWTECHNIQUE_VBO_GEOMETRY";

export function shouldUseTriangleVBOGeometry(view: any): boolean {
  const configured = readOptionalBooleanFlag(TRIANGLE_VBO_GEOMETRY_DRAWTECHNIQUES_FLAG);
  if (configured !== null) {
    return configured;
  }
  return getConfiguredOpaqueTriangleRenderPath(view) !== "dtx-only";
}

export function shouldUseTriangleVBOGeometryDrawTechnique(view: any): boolean {
  return shouldUseTriangleVBOGeometry(view);
}

export function getConfiguredTriangleGeometryStorage(view: any): TriangleGeometryStorageMode {
  return shouldUseTriangleVBOGeometry(view) ? "vbo" : "dtx";
}

export function getConfiguredOpaqueTriangleRenderPath(view: any): OpaqueTriangleRenderPath {
  const forcedPath = readOpaqueTriangleRenderPath("XEOKIT_WEBGL_OPAQUE_TRIANGLES_RENDER_PATH");
  if (forcedPath) {
    return forcedPath;
  }

  if (view?.renderMode === NavigationRender) {
    const navigationPath = readOpaqueTriangleRenderPath("XEOKIT_WEBGL_OPAQUE_TRIANGLES_NAVIGATION_RENDER_PATH");
    if (navigationPath) {
      return navigationPath;
    }
  }

  // Compatibility toggle used by the original profiling examples. The old
  // cached VBO renderer is gone; this now enables the batch-owned VBO geometry
  // source inside the normal triangle DrawTechnique variants.
  if (readBooleanFlag("XEOKIT_WEBGL_VBO_OPAQUE_TRIANGLES")) {
    const path = readOpaqueTriangleRenderPath("XEOKIT_WEBGL_VBO_OPAQUE_TRIANGLES_MODE");
    return path === "vbo-only" ? "vbo-only" : "hybrid";
  }

  return "hybrid";
}

function readOpaqueTriangleRenderPath(key: string): OpaqueTriangleRenderPath | null {
  const root = globalThis as any;
  const globalValue = normalizeOpaqueTriangleRenderPath(root[key]);
  if (globalValue) {
    return globalValue;
  }
  try {
    return normalizeOpaqueTriangleRenderPath(root.localStorage?.getItem(key));
  } catch (_e) {
    return null;
  }
}

function normalizeOpaqueTriangleRenderPath(value: any): OpaqueTriangleRenderPath | null {
  if (value === "dtx-only" || value === "hybrid" || value === "vbo-only" || value === "vbo-first") {
    return value;
  }
  if (value === "vboFirst") {
    return "vbo-first";
  }
  if (value === "baked") {
    return "vbo-only";
  }
  if (value === "dtx") {
    return "dtx-only";
  }
  return null;
}

function readBooleanFlag(key: string): boolean {
  const root = globalThis as any;
  const globalValue = root[key];
  if (globalValue === true || globalValue === "true" || globalValue === "1") {
    return true;
  }
  try {
    const localValue = root.localStorage?.getItem(key);
    return localValue === "true" || localValue === "1";
  } catch (_e) {
    return false;
  }
}

function readOptionalBooleanFlag(key: string): boolean | null {
  const root = globalThis as any;
  const globalValue = root[key];
  if (globalValue === true || globalValue === "true" || globalValue === "1" || globalValue === 1) {
    return true;
  }
  if (globalValue === false || globalValue === "false" || globalValue === "0" || globalValue === 0) {
    return false;
  }
  try {
    const localValue = root.localStorage?.getItem(key);
    if (localValue === "true" || localValue === "1") {
      return true;
    }
    if (localValue === "false" || localValue === "0") {
      return false;
    }
    return null;
  } catch (_e) {
    return null;
  }
}
