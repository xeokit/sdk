import type {DataFormatSchema} from "../../../../quality/dataModel/DataFormatSchema";

/**
 * Data schema for FDS-6 input files.
 *
 * Types:
 *  - `FDSProject` — the model itself (one per file, from `&HEAD`).
 *  - `FDSMesh` — a computational grid (`&MESH`).
 *  - `FDSElement` — abstract parent for OBST / VENT / HOLE / DEVC so
 *    relationships can target "any element".
 *  - `FDSObstruction`, `FDSVent`, `FDSHole`, `FDSDevice` — concrete
 *    elements.
 *  - `FDSSurface` — material referenced by elements via `SURF_ID`.
 *
 * Relationships:
 *  - `contains` — project → mesh, mesh → element.
 *  - `usesSurface` — element → surface.
 *
 * @internal
 */
export const FDS_SCHEMA_ID = "fds6";

export const FDSSchema: DataFormatSchema = {
  id: FDS_SCHEMA_ID,
  description: "NIST Fire Dynamics Simulator v6 input file",
  objectTypes: {
    FDSProject:     {label: "Project"},
    FDSMesh:        {superType: "FDSProject", label: "Mesh"},
    FDSElement:     {label: "Element"},
    FDSObstruction: {superType: "FDSElement", label: "Obstruction"},
    FDSVent:        {superType: "FDSElement", label: "Vent"},
    FDSHole:        {superType: "FDSElement", label: "Hole"},
    FDSDevice:      {superType: "FDSElement", label: "Device"},
    FDSSurface:     {label: "Surface"},
  },
  relationshipTypes: {
    contains: {
      allowedRelatingTypes: ["FDSProject", "FDSMesh"],
      allowedRelatedTypes:  ["FDSMesh", "FDSElement"],
    },
    usesSurface: {
      allowedRelatingTypes: ["FDSElement"],
      allowedRelatedTypes:  ["FDSSurface"],
    },
  },
};
