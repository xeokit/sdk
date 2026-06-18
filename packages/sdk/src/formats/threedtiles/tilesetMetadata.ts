/**
 * Maps 3D Tiles 1.1 tileset-level metadata (the inline JSON `metadata`,
 * `groups`, and per-tile / per-content `metadata` entities in `tileset.json`)
 * onto the DataModel as DataObjects with property sets.
 *
 * Metadata entity values are stored inline in `tileset.json`, so no binary
 * decoding is needed; the class schema is used only for naming. Property
 * textures, per-feature glTF metadata (`EXT_structural_metadata`), and external
 * `schemaUri` / enum-name resolution are out of scope here.
 */

import type {DataModel} from "../../model/data/DataModel";

export interface TilesetMetadataRoots {
  rootDataObjectId: string;
  groupObjectIds: string[];
}

function toProperties(props: any): {name: string; value: any}[] {
  return Object.keys(props || {}).map(name => ({name, value: props[name]}));
}

/**
 * Creates the root tileset DataObject (carrying tileset-level metadata) and a
 * DataObject per metadata group. Returns the ids so per-tile metadata and
 * content features can aggregate under the root and reference their group.
 */
export function applyTilesetMetadata(dataModel: DataModel, tileset: any): TilesetMetadataRoots {
  const rootDataObjectId = "tileset";
  const propertySetIds: string[] = [];

  const tilesetMeta = tileset.metadata;
  if (tilesetMeta?.properties) {
    const psId = "tileset-metadata";
    dataModel.createPropertySet({
      id: psId,
      name: tilesetMeta.class || "Tileset",
      type: tilesetMeta.class || "Tileset",
      properties: toProperties(tilesetMeta.properties),
    });
    propertySetIds.push(psId);
  }
  dataModel.createObject({id: rootDataObjectId, type: "Tileset", name: "3D Tiles", propertySetIds});

  const groupObjectIds: string[] = [];
  const groups: any[] = tileset.groups || [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const psId = `group-${i}-metadata`;
    dataModel.createPropertySet({
      id: psId,
      name: group.class || "Group",
      type: group.class || "Group",
      properties: toProperties(group.properties),
    });
    const objId = `group-${i}`;
    dataModel.createObject({id: objId, type: group.class || "Group", name: `Group ${i}`, propertySetIds: [psId]});
    dataModel.createRelationship({type: "BasicAggregation", relatingObjectId: rootDataObjectId, relatedObjectId: objId});
    groupObjectIds.push(objId);
  }

  return {rootDataObjectId, groupObjectIds};
}

/**
 * Creates a DataObject for one tile's `metadata` / `content.metadata`, related
 * to the root tileset object (and to its content group, when set). No-op when
 * the tile carries no metadata.
 */
export function applyTileMetadata(
  dataModel: DataModel,
  tile: any,
  rootDataObjectId: string,
  groupObjectIds: string[],
  index: number,
): void {
  const tileMeta = tile.metadata;
  const content = tile.content || (tile.contents && tile.contents[0]);
  const contentMeta = content && content.metadata;
  if (!tileMeta?.properties && !contentMeta?.properties) return;

  const propertySetIds: string[] = [];
  if (tileMeta?.properties) {
    const psId = `tile-${index}-metadata`;
    dataModel.createPropertySet({
      id: psId,
      name: tileMeta.class || "Tile",
      type: tileMeta.class || "Tile",
      properties: toProperties(tileMeta.properties),
    });
    propertySetIds.push(psId);
  }
  if (contentMeta?.properties) {
    const psId = `tile-${index}-content-metadata`;
    dataModel.createPropertySet({
      id: psId,
      name: contentMeta.class || "Content",
      type: contentMeta.class || "Content",
      properties: toProperties(contentMeta.properties),
    });
    propertySetIds.push(psId);
  }

  const objId = `tile-${index}`;
  dataModel.createObject({id: objId, type: tileMeta?.class || "Tile", name: `Tile ${index}`, propertySetIds});
  dataModel.createRelationship({type: "BasicAggregation", relatingObjectId: rootDataObjectId, relatedObjectId: objId});

  const group = content && content.group;
  if (typeof group === "number" && groupObjectIds[group]) {
    dataModel.createRelationship({type: "BasicAggregation", relatingObjectId: groupObjectIds[group], relatedObjectId: objId});
  }
}
