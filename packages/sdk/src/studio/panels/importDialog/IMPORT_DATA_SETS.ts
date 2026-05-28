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
];
