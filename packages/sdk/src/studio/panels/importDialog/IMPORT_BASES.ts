/**
 */

import type {ImportCoordSysBasis} from "./ImportCoordSysBasis";


export const IMPORT_BASES: ImportCoordSysBasis[] = [
  {
    id:    "unknown",
    label: "Unknown",
    basis: null,
  },
  {
    id:    "z-up",
    label: "Z-up (Revit, IFC, AutoCAD, ArchiCAD, SketchUp)",
    basis: [1, 0, 0,   0, 1, 0,   0, 0, 1],
  },
  {
    id:    "y-up",
    label: "Y-up (glTF, Three.js, Unity, Maya, Blender export)",
    basis: [1, 0, 0,   0, 0, 1,   0, 1, 0],
  },
  {
    id:    "z-up-y-forward",
    label: "Z-up, Y-forward (Blender native)",
    basis: [1, 0, 0,   0, 1, 0,   0, 0, 1],
  },
  {
    id:    "z-up-x-forward",
    label: "Z-up, X-forward (Rhino, Civil 3D)",
    basis: [0, 1, 0,   -1, 0, 0,   0, 0, 1],
  },
];
