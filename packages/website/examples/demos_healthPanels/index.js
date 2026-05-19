// Demo: Scene Health × Data Health panels.
//
// Builds a small synthetic "factory" SceneModel + DataModel
// programmatically with ~20 deliberate defects spanning both
// inspectors. Every flaw is annotated inline — chase the comments
// to see what each inspection code is detecting.
//
// The example opens both health panels via Studio factory
// methods. SceneHealth defaults to the right side; DataHealth is
// pre-positioned to the left so they don't overlap on first run.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const SCHEMA_ID = "IFC4";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene, data} = studio;

  studio.viewManager.createView({
    renderMode: xeokit.base.constants.RealisticRender,
    camera: {
      eye:  [12, -12, 9],
      look: [0, 0, 1.5],
      up:   [0, 0, 1],
    },
  });

  // No coordinateSystem override — fall back to the Scene's
  // default Z-up basis so the local geometry (built with Z as
  // the vertical axis) renders straight up.
  const sceneModel = mustCreate(scene.createModel({id: "myTestModel"}));
  const dataModel  = mustCreate(data.createModel({id: "myTestModel", schema: SCHEMA_ID}));

  buildSceneModel(sceneModel);
  buildDataModel(dataModel);


  // First-run: park DataHealth on the left so it sits beside
  // SceneHealth instead of stacking on top of it. Honour any
  // saved layout the user has dragged into place.
  if (!window.localStorage.getItem("xkt-dh-panel")) {
    window.localStorage.setItem(
      "xkt-dh-panel",
      JSON.stringify({left: 17, top: 115, hidden: false}),
    );
  }

  studio.panels.open("sceneHealth");
  studio.panels.open("dataHealth", {focusDataModel: dataModel, schema: IFC4_DEMO_SCHEMA});

  studio.finished();
});


// ── SceneModel construction ──────────────────────────────────────
//
// The factory: a 6×6 floor slab with four wall panels arranged
// around it, one door, one machine. Every flaw is called out in a
// trailing comment.

function buildSceneModel(sceneModel) {

  // Materials.
  sceneModel.createMaterial({
    id: "mat-default",
    color: [0.78, 0.76, 0.7],
  });
  sceneModel.createMaterial({
    id: "mat-textured",
    color: [1, 1, 1],
    colorTextureId: "tex-pattern",
  });
  sceneModel.createMaterial({
    id: "mat-orphan",                                  // → MATERIAL_UNUSED
    color: [0.9, 0.2, 0.2],
  });

  // Textures — `tex-pattern` is bound to mat-textured (POT 4×4
  // so the WebGL upload is unconditional); `tex-orphan` stays
  // dangling and its NPOT 5×3 dims trigger TEXTURE_NPOT on top
  // of TEXTURE_UNUSED.
  sceneModel.createTexture({
    id: "tex-pattern",
    imageData: makePatternImageData(4, 4),
  });
  sceneModel.createTexture({                           // → TEXTURE_UNUSED + TEXTURE_NPOT
    id: "tex-orphan",
    imageData: makePatternImageData(5, 3),
  });

  // Transforms.
  sceneModel.createTransform({
    id: "tx-identity",                                 // → TRANSFORM_IDENTITY
    matrix: [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1],
  });
  sceneModel.createTransform({
    id: "tx-orphan",                                   // → TRANSFORM_UNUSED
    position: [100, 0, 0],
  });

  // Geometries. Built in a Z-up frame: floor on the XY plane,
  // walls extruded along +Z.

  sceneModel.createGeometry({
    id: "geom-floor",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: [-3, -3, 0,  3, -3, 0,  3, 3, 0,  -3, 3, 0],
    indices:   [0, 1, 2,  0, 2, 3],
  });

  // Three byte-identical wall geometries — should have been one
  // shared geometry instanced three times. Triggers
  // GEOMETRY_DUPLICATE on the b/c copies.
  const wallPositions = boxPositions(3, 0.15, 2);  // X=length, Y=thickness, Z=height
  const wallIndices   = BOX_INDICES;
  sceneModel.createGeometry({
    id: "geom-wall-a",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: wallPositions,
    indices:   wallIndices,
  });
  sceneModel.createGeometry({                          // → GEOMETRY_DUPLICATE
    id: "geom-wall-b",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: wallPositions,
    indices:   wallIndices,
  });
  sceneModel.createGeometry({                          // → GEOMETRY_DUPLICATE
    id: "geom-wall-c",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: wallPositions,
    indices:   wallIndices,
  });

  // Hand-assembled wall with two unused vertex slots and one
  // degenerate triangle. Unused positions sit INSIDE the wall's
  // box bounds so they don't bloat the geometry's AABB beyond
  // the rest of the model.
  sceneModel.createGeometry({                          // → GEOMETRY_DEGENERATE_TRIANGLES
    id: "geom-bad-wall",                               // → GEOMETRY_UNUSED_VERTICES
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: [
      ...boxPositions(3, 0.15, 2),
       0.4,  0.05,  0.2,                               // unused vertex (inside bounds)
      -0.4, -0.05, -0.2,                               // unused vertex (inside bounds)
    ],
    indices: [
      ...BOX_INDICES,
       0, 0, 1,                                        // degenerate
    ],
  });

  // Door + machine — plain box geometries (X=width, Y=depth,
  // Z=height in this Z-up frame).
  sceneModel.createGeometry({
    id: "geom-door",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: boxPositions(0.9, 0.1, 2),
    indices:   BOX_INDICES,
  });
  sceneModel.createGeometry({
    id: "geom-machine",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: boxPositions(1.4, 1.4, 1.6),
    indices:   BOX_INDICES,
  });

  // Meshes + objects.

  sceneModel.createMesh({
    id: "mesh-floor",
    geometryId: "geom-floor",
    materialId: "mat-default",
    color: [0.65, 0.62, 0.55],
  });
  sceneModel.createObject({id: "floor", meshIds: ["mesh-floor"]});

  // Four walls around the floor — three sharing the duplicated
  // geometries, one using the bad-wall geometry. The N/S walls
  // run along the X axis; the E/W walls are rotated 90° around
  // Z so they run along the Y axis. All walls sit with their
  // base on the floor (z=0..2, centre at z=1).
  createWall(sceneModel, "wall-N", "geom-wall-a",   [0, -3, 1], [0.7, 0.7, 0.75]);
  createWall(sceneModel, "wall-S", "geom-wall-b",   [0,  3, 1], [0.7, 0.7, 0.75]);
  createWall(sceneModel, "wall-E", "geom-wall-c",   [ 3, 0, 1], [0.7, 0.7, 0.75], 90);
  createWall(sceneModel, "wall-W", "geom-bad-wall", [-3, 0, 1], [0.7, 0.7, 0.75], 90);

  // Textured wall — material expects UVs that geom-wall-a lacks.
  sceneModel.createMesh({                              // → MATERIAL_TEXTURED_GEOMETRY_NO_UVS
    id: "mesh-wall-textured",
    geometryId: "geom-wall-a",
    materialId: "mat-textured",
    parentTransformId: "tx-identity",                  // (identity matrix, see TRANSFORM_IDENTITY)
    matrix: xeokit.model.scene.buildMat4({
      position: [-1.5, -2.99, 1],
      scale: [0.5, 1, 0.7],
    }),
  });
  sceneModel.createObject({id: "wall-textured", meshIds: ["mesh-wall-textured"]});

  // Door cut into the south wall.
  sceneModel.createMesh({
    id: "mesh-door-1",
    geometryId: "geom-door",
    materialId: "mat-default",
    color: [0.55, 0.4, 0.2],
    matrix: xeokit.model.scene.buildMat4({position: [1.5, 2.99, 1]}),
  });
  sceneModel.createObject({id: "door-1", meshIds: ["mesh-door-1"]});

  // Machine — slate-coloured box parked inside the room, base
  // resting on the floor (z=0..1.6, centre at z=0.8).
  sceneModel.createMesh({
    id: "mesh-machine-1",
    geometryId: "geom-machine",
    materialId: "mat-default",
    color: [0.4, 0.42, 0.5],
    matrix: xeokit.model.scene.buildMat4({position: [-1.2, 1.2, 0.8]}),
  });
  sceneModel.createObject({id: "machine-1", meshIds: ["mesh-machine-1"]});

  // (No far-from-origin scene object: a 10⁶-unit-away mesh
  // bloats the Scene AABB and breaks "Frame Model" / view-fit.
  // The OBJECT_FAR_FROM_ORIGIN inspection lives on real-world
  // coordinate-mismatch loaders; demoing it here isn't worth
  // breaking the framing UX.)
}


function createWall(sceneModel, id, geometryId, position, color, yawDeg) {
  const meshId = `mesh-${id}`;
  sceneModel.createMesh({
    id: meshId,
    geometryId,
    materialId: "mat-default",
    color,
    matrix: xeokit.model.scene.buildMat4({
      position,
      ...(yawDeg ? {rotation: [0, 0, yawDeg]} : {}),  // yaw around Z (Z-up)
    }),
  });
  sceneModel.createObject({id, meshIds: [meshId]});
}


// ── DataModel construction ───────────────────────────────────────
//
// Spatial structure (Project → Site → Building → Storey1) plus a
// scattering of element DataObjects. Most are correctly tagged
// IFC4; a handful carry deliberate semantic flaws.

function buildDataModel(dataModel) {

  // Property sets — schema-tag-matched so the propertySetIds
  // builder check passes.
  dataModel.createPropertySet({
    id: "Pset_WallCommon",
    schema: SCHEMA_ID,
    name: "Pset_WallCommon",
    properties: [
      {name: "FireRating", value: "60min", type: "string"},
      {name: "IsExternal", value: false,    type: "boolean"},
    ],
  });
  dataModel.createPropertySet({
    id: "Pset_DoorCommon",
    schema: SCHEMA_ID,
    name: "Pset_DoorCommon",
    properties: [
      {name: "Reference", value: "DR-001", type: "string"},
    ],
  });

  // Spatial structure — canonical IFC4 chain.
  dataModel.createObject({id: "Project",  type: "IfcProject",        schema: SCHEMA_ID, name: "Demo Factory"});
  dataModel.createObject({id: "Site",     type: "IfcSite",           schema: SCHEMA_ID, name: "Site"});
  dataModel.createObject({id: "Building", type: "IfcBuilding",       schema: SCHEMA_ID, name: "Building"});
  dataModel.createObject({id: "Storey1",  type: "IfcBuildingStorey", schema: SCHEMA_ID, name: "Floor 1"});

  // Stamped with the wrong schema id → OBJECT_SCHEMA_MISMATCH.
  // Kept off-island so the same-schema relationship check
  // doesn't reject every IfcRelAggregates that touches it.
  dataModel.createObject({                             // → OBJECT_SCHEMA_MISMATCH
    id: "Storey-LegacyTag",
    type: "IfcBuildingStorey",
    schema: "IFC2X3",
    name: "Floor 2 (legacy schema tag)",
  });

  // IfcSpace with no spatial parent → IFC_SPATIAL_ORPHAN.
  dataModel.createObject({                             // → IFC_SPATIAL_ORPHAN
    id: "Space-Orphan",
    type: "IfcSpace",
    schema: SCHEMA_ID,
    name: "Orphaned space",
  });

  // Type "IfcWidget" doesn't exist in the schema we'll feed
  // the inspector → OBJECT_UNKNOWN_TYPE.
  dataModel.createObject({                             // → OBJECT_UNKNOWN_TYPE
    id: "Mystery-Widget",
    type: "IfcWidget",
    schema: SCHEMA_ID,
    name: "Mystery widget",
  });

  // Walls — wall-1 picks up a duplicated property-set ref.
  dataModel.createObject({
    id: "wall-N",
    type: "IfcWall",
    schema: SCHEMA_ID,
    name: "North wall",
    propertySetIds: ["Pset_WallCommon", "Pset_WallCommon"], // → OBJECT_DUPLICATE_PROPERTY_SET_REF
  });
  dataModel.createObject({id: "wall-S", type: "IfcWall", schema: SCHEMA_ID, name: "South wall", propertySetIds: ["Pset_WallCommon"]});
  dataModel.createObject({id: "wall-E", type: "IfcWall", schema: SCHEMA_ID, name: "East wall",  propertySetIds: ["Pset_WallCommon"]});
  dataModel.createObject({id: "wall-W", type: "IfcWall", schema: SCHEMA_ID, name: "West wall",  propertySetIds: ["Pset_WallCommon"]});
  dataModel.createObject({id: "wall-textured", type: "IfcWall",          schema: SCHEMA_ID, name: "Textured wall"});
  dataModel.createObject({id: "door-1",        type: "IfcDoor",          schema: SCHEMA_ID, name: "Door 1", propertySetIds: ["Pset_DoorCommon"]});
  dataModel.createObject({id: "machine-1",     type: "IfcFurnishingElement", schema: SCHEMA_ID, name: "Machine 1"});
  dataModel.createObject({id: "floor",         type: "IfcSlab",          schema: SCHEMA_ID, name: "Slab"});

  // Spatial decomposition — correct IfcRelAggregates chain.
  dataModel.createRelationship({type: "IfcRelAggregates", relatingObjectId: "Project",  relatedObjectId: "Site"});
  dataModel.createRelationship({type: "IfcRelAggregates", relatingObjectId: "Site",     relatedObjectId: "Building"});
  dataModel.createRelationship({type: "IfcRelAggregates", relatingObjectId: "Building", relatedObjectId: "Storey1"});

  // Walls / doors / machine attached via IfcRelAggregates instead
  // of IfcRelContainedInSpatialStructure → IFC_ELEMENT_AGGREGATED_NOT_CONTAINED
  // (one warning per element).
  for (const elementId of ["wall-N", "wall-S", "wall-E", "wall-W", "wall-textured", "door-1", "machine-1", "floor"]) {
    dataModel.createRelationship({                     // → IFC_ELEMENT_AGGREGATED_NOT_CONTAINED
      type: "IfcRelAggregates",
      relatingObjectId: "Storey1",
      relatedObjectId:  elementId,
    });
  }

  // Self-reference: a wall that contains itself. The inspector
  // raises both RELATIONSHIP_SELF_REFERENCE (always-on) and the
  // schema-driven RELATIONSHIP_SELF_REFERENCE_FORBIDDEN (because
  // our schema disallows self-aggregation).
  dataModel.createRelationship({                       // → RELATIONSHIP_SELF_REFERENCE(_FORBIDDEN)
    type: "IfcRelAggregates",
    relatingObjectId: "wall-textured",
    relatedObjectId:  "wall-textured",
  });

  // Two-way IfcRelAggregates between machine-1 and door-1 →
  // RELATIONSHIP_CYCLE.
  dataModel.createRelationship({                       // → RELATIONSHIP_CYCLE
    type: "IfcRelAggregates",
    relatingObjectId: "machine-1",
    relatedObjectId:  "door-1",
  });
  dataModel.createRelationship({
    type: "IfcRelAggregates",
    relatingObjectId: "door-1",
    relatedObjectId:  "machine-1",
  });
}


// ── Schema fed to the data inspector ─────────────────────────────
//
// Curated IFC4 subset covering the types our DataModel uses, plus
// the IfcObjectDefinition super-type chain so the
// relationshipTypeBinding inspection can resolve allowedRelating /
// allowedRelated against subtypes.

const IFC4_DEMO_SCHEMA = {
  id: SCHEMA_ID,
  description: "Curated IFC4 subset — Demos_HealthPanels showcase",
  objectTypes: {
    IfcObjectDefinition:         {label: "IFC Object Definition"},
    IfcContext:                  {superType: "IfcObjectDefinition", label: "IFC Context"},
    IfcProject:                  {superType: "IfcContext",          label: "Project"},
    IfcSpatialStructureElement:  {superType: "IfcObjectDefinition", label: "Spatial Structure"},
    IfcSite:                     {superType: "IfcSpatialStructureElement", label: "Site"},
    IfcBuilding:                 {superType: "IfcSpatialStructureElement", label: "Building"},
    IfcBuildingStorey:           {superType: "IfcSpatialStructureElement", label: "Building Storey"},
    IfcSpace:                    {superType: "IfcSpatialStructureElement", label: "Space"},
    IfcElement:                  {superType: "IfcObjectDefinition", label: "Element"},
    IfcBuildingElement:          {superType: "IfcElement",          label: "Building Element"},
    IfcWall:                     {superType: "IfcBuildingElement",  label: "Wall"},
    IfcDoor:                     {superType: "IfcBuildingElement",  label: "Door"},
    IfcSlab:                     {superType: "IfcBuildingElement",  label: "Slab"},
    IfcFurnishingElement:        {superType: "IfcElement",          label: "Furnishing Element"},
  },
  relationshipTypes: {
    IfcRelAggregates: {
      label: "Aggregates / decomposes a parent into parts",
      allowedRelatingTypes: ["IfcObjectDefinition"],
      allowedRelatedTypes:  ["IfcObjectDefinition"],
      allowSelfReference:   false,
    },
    IfcRelContainedInSpatialStructure: {
      label: "Contains an element in a spatial structure",
      allowedRelatingTypes: ["IfcSpatialStructureElement"],
      allowedRelatedTypes:  ["IfcElement"],
    },
  },
};


// ── Geometry helpers ─────────────────────────────────────────────

// Box positions for a (w, h, d) box centred on the origin. 24
// vertices arranged as 6 faces × 4 corners — same layout as the
// canonical SceneModel_DataModel_build_table example.
function boxPositions(w, h, d) {
  const x = w / 2, y = h / 2, z = d / 2;
  return [
    // +Z
     x,  y,  z,  -x,  y,  z,  -x, -y,  z,   x, -y,  z,
    // +X
     x,  y,  z,   x, -y,  z,   x, -y, -z,   x,  y, -z,
    // +Y
     x,  y,  z,   x,  y, -z,  -x,  y, -z,  -x,  y,  z,
    // -X
    -x,  y,  z,  -x,  y, -z,  -x, -y, -z,  -x, -y,  z,
    // -Y
    -x, -y, -z,   x, -y, -z,   x, -y,  z,  -x, -y,  z,
    // -Z
     x, -y, -z,  -x, -y, -z,  -x,  y, -z,   x,  y, -z,
  ];
}

const BOX_INDICES = [
  0, 1, 2,    0, 2, 3,
  4, 5, 6,    4, 6, 7,
  8, 9, 10,   8, 10, 11,
  12, 13, 14, 12, 14, 15,
  16, 17, 18, 16, 18, 19,
  20, 21, 22, 20, 22, 23,
];

// Tiny pixel-art chequerboard packed as ImageData. The unbound
// orphan texture uses NPOT dimensions to trigger the texture
// inspector; the bound texture uses POT to keep WebGL happy.
function makePatternImageData(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = ((x + y) & 1) ? 255 : 90;
      data[i]     = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return {data, width: w, height: h};
}


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
