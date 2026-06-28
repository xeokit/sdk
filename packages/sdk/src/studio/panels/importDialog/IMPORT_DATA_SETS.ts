/**
 */

import type {ImportDataSet} from "./ImportDataSet";


export const IMPORT_DATA_SETS: ImportDataSet[] = [
  {
    id: "ifc",
    label: "IFC",
    defaultBasisId: "z-up",
    files: [
      {key: "ifc", label: "IFC file", accept: ".ifc", loadFormat: "ifc", required: true},
    ],
  },
  {
    id: "gltf",
    label: "glTF (.glb)",
    defaultBasisId: "y-up",
    loadsDataSemantics: false,
    files: [
      {key: "glb", label: "GLB file", accept: ".glb", loadFormat: "gltf", required: true},
    ],
  },
  {
    id: "fbx",
    label: "FBX",
    defaultBasisId: "y-up",
    loadsDataSemantics: false,
    files: [
      {key: "fbx", label: "FBX file", accept: ".fbx", loadFormat: "fbx", required: true},
    ],
  },
  {
    id: "usdz",
    label: "USDZ (Pixar)",
    defaultBasisId: "z-up",
    loadsDataSemantics: false,
    files: [
      {key: "usdz", label: "USDZ file", accept: ".usdz", loadFormat: "usdz", required: true},
    ],
  },
  {
    id: "e57",
    label: "E57 point cloud (ASTM)",
    defaultBasisId: "z-up",
    loadsDataSemantics: false,
    files: [
      {key: "e57", label: "E57 file", accept: ".e57", loadFormat: "e57", required: true},
    ],
  },
  {
    id: "laz",
    label: "LAS / LAZ point cloud",
    defaultBasisId: "z-up",
    loadsDataSemantics: false,
    files: [
      {key: "laz", label: "LAS / LAZ file", accept: ".las,.laz", loadFormat: "laz", required: true},
    ],
  },
  {
    id: "threedxml",
    label: "3DXML (Dassault)",
    defaultBasisId: "y-up",
    loadsDataSemantics: false,
    files: [
      {key: "threedxml", label: "3DXML file", accept: ".3dxml", loadFormat: "threedxml", required: true},
    ],
  },
  {
    id: "splat",
    label: "3D Gaussian Splatting (.splat)",
    defaultBasisId: "y-down",
    loadsDataSemantics: false,
    files: [
      {key: "splat", label: "Splat file", accept: ".splat", loadFormat: "splat", required: true},
    ],
  },
  {
    id: "threedtiles",
    label: "3D Tiles (tileset.json)",
    defaultBasisId: "z-up",
    files: [
      {key: "tileset", label: "Tileset JSON", accept: ".json", loadFormat: "threedtiles", required: true},
    ],
  },
  {
    id: "xkt",
    label: "XKT (xeokit v2)",
    defaultBasisId: "z-up",
    files: [
      {key: "xkt", label: "XKT file", accept: ".xkt", loadFormat: "xkt", required: true},
    ],
  },
  {
    id: "gltf+datamodel",
    label: "glTF + DataModel JSON",
    defaultBasisId: "y-up",
    files: [
      {key: "glb",       label: "GLB file",         accept: ".glb",  loadFormat: "gltf",      required: true},
      {key: "datamodel", label: "DataModel JSON",   accept: ".json", loadFormat: "datamodel", required: true},
    ],
  },
  {
    id: "xgf",
    label: "XGF",
    defaultBasisId: "z-up",
    loadsDataSemantics: false,
    files: [
      {key: "xgf", label: "XGF file", accept: ".xgf", loadFormat: "xgf", required: true},
    ],
  },
  {
    id: "xgf+datamodel",
    label: "XGF + DataModel JSON",
    defaultBasisId: "z-up",
    files: [
      {key: "xgf",       label: "XGF file",       accept: ".xgf",  loadFormat: "xgf",       required: true},
      {key: "datamodel", label: "DataModel JSON", accept: ".json", loadFormat: "datamodel", required: true},
    ],
  },
  {
    id: "obj",
    label: "OBJ",
    defaultBasisId: "y-up",
    loadsDataSemantics: false,
    files: [
      {key: "obj", label: "OBJ file",                   accept: ".obj", loadFormat: "obj", required: true},
      {key: "mtl", label: "Materials (.mtl, optional)", accept: ".mtl", loadFormat: "mtl", required: false},
    ],
  },
  {
    id: "dotbim",
    label: ".bim",
    defaultBasisId: "z-up",
    files: [
      {key: "bim", label: ".bim file", accept: ".bim", loadFormat: "dotbim", required: true},
    ],
  },
  {
    id: "scenemodel",
    label: "SceneModel JSON",
    defaultBasisId: "z-up",
    loadsDataSemantics: false,
    files: [
      {key: "scenemodel", label: "SceneModel JSON", accept: ".json", loadFormat: "scenemodel", required: true},
    ],
  },
  {
    id: "scenemodel+datamodel",
    label: "SceneModel + DataModel JSON",
    defaultBasisId: "z-up",
    files: [
      {key: "scenemodel", label: "SceneModel JSON", accept: ".json", loadFormat: "scenemodel", required: true},
      {key: "datamodel",  label: "DataModel JSON",  accept: ".json", loadFormat: "datamodel",  required: true},
    ],
  },
  {
    id: "datamodel",
    label: "DataModel JSON",
    loadsSceneGeometry: false,
    files: [
      {key: "datamodel", label: "DataModel JSON", accept: ".json", loadFormat: "datamodel", required: true},
    ],
  },
  {
    id: "metamodel",
    label: "MetaModel JSON (legacy)",
    loadsSceneGeometry: false,
    files: [
      {key: "metamodel", label: "MetaModel JSON", accept: ".json", loadFormat: "metamodel", required: true},
    ],
  },
  {
    id: "cityjson",
    label: "CityJSON",
    defaultBasisId: "z-up",
    files: [
      {key: "cityjson", label: "CityJSON file", accept: ".json", loadFormat: "cityjson", required: true},
    ],
  },
  {
    id: "fds",
    label: "FDS (Fire Dynamics Simulator)",
    defaultBasisId: "z-up",
    files: [
      {key: "fds", label: "FDS file", accept: ".fds", loadFormat: "fds", required: true},
    ],
  },
];
