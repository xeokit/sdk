
import {type DataModel} from "../../model/data";
import {type SceneModel} from "../../model/scene";
import {createUUID} from "../../base/utils";

/**
 * Populates a DataModel with a minimal IFC spatial structure and creates
 * DataObjects for displayable SceneObjects.
 *
 * This function ensures that the DataModel contains a valid IFC hierarchy:
 *
 *   IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey
 *
 * If any of these elements are missing, they are created. Existing ones are reused.
 *
 * For each renderable SceneObject in the SceneModel:
 * - Ensures a corresponding DataObject exists (creating an IfcBuildingElementProxy if needed)
 * - Links the DataObject into the spatial structure using IfcRelContainedInSpatialStructure
 *
 * The function does not overwrite existing DataObjects or relationships, and avoids
 * duplicating relationships where they already exist.
 *
 * This is intended as a preparation step for IFC export, ensuring that all visible
 * geometry is associated with a valid spatial container and will be displayable
 * in IFC viewers.
 *
 * Assumptions:
 * - SceneObject IDs are used as DataObject IDs when creating new elements
 * - Only SceneObjects with meshes are considered displayable
 *
 * @param sceneModel Source of renderable geometry
 * @param dataModel  Target semantic model to populate/augment
 */
export function createDefaultIFCDataModel(sceneModel: SceneModel, dataModel: DataModel) {

  const getFirstObjectOfType = (type: string) => {
    const bucket = dataModel.objectsByType?.[type];
    return bucket ? Object.values(bucket)[0] : undefined;
  };

  const ensureObject = (type: string, name: string) => {
    const existing = getFirstObjectOfType(type);
    if (existing) {
      return existing;
    }

    const result = dataModel.createObject({
      id: createUUID(),
      type,
      name
    });

    if (result.ok !== true) {
      throw new Error(result.error);
    }

    return result.value;
  };

  const hasRelationship = (type: string, relatingObjectId: string, relatedObjectId: string) => {
    for (let i = 0, len = dataModel.relationships.length; i < len; i++) {
      const rel = dataModel.relationships[i];
      if (
        rel.type === type &&
        rel.relatingObject.id === relatingObjectId &&
        rel.relatedObject.id === relatedObjectId
      ) {
        return true;
      }
    }
    return false;
  };

  const ensureRelationship = (type: string, relatingObjectId: string, relatedObjectId: string) => {
    if (hasRelationship(type, relatingObjectId, relatedObjectId)) {
      return;
    }

    const result = dataModel.createRelationship({
      type,
      relatingObjectId,
      relatedObjectId
    });

    if (result.ok !== true) {
      throw new Error(result.error);
    }
  };

  const isSpatialType = (type: string | undefined) => {
    return (
      type === "IfcProject" ||
      type === "IfcSite" ||
      type === "IfcBuilding" ||
      type === "IfcBuildingStorey" ||
      type === "IfcSpace"
    );
  };

  const isContainedAlready = (objectId: string) => {
    for (let i = 0, len = dataModel.relationships.length; i < len; i++) {
      const rel = dataModel.relationships[i];
      if (
        rel.type === "IfcRelContainedInSpatialStructure" &&
        rel.relatedObject.id === objectId
      ) {
        return true;
      }
    }
    return false;
  };

  // ---------------------------------------------------------------------------
  // Ensure minimal IFC spatial structure
  // ---------------------------------------------------------------------------

  const project = ensureObject("IfcProject", dataModel.name || sceneModel.id || "Project");
  const site = ensureObject("IfcSite", "Default Site");
  const building = ensureObject("IfcBuilding", "Default Building");
  const storey = ensureObject("IfcBuildingStorey", "Default Storey");

  ensureRelationship("IfcRelAggregates", project.id, site.id);
  ensureRelationship("IfcRelAggregates", site.id, building.id);
  ensureRelationship("IfcRelAggregates", building.id, storey.id);

  // ---------------------------------------------------------------------------
  // Ensure one IFC element per SceneObject, then contain it in the storey
  // ---------------------------------------------------------------------------

  for (const objectId in sceneModel.objects) {
    const sceneObject = sceneModel.objects[objectId];
    if (!sceneObject) {
      continue;
    }

    // Skip empty/non-renderable scene objects
    if (!sceneObject.meshes || sceneObject.meshes.length === 0) {
      continue;
    }

    let dataObject = dataModel.objects[objectId];

    if (!dataObject) {
      const result = dataModel.createObject({
        id: objectId,
        type: "IfcBuildingElementProxy",
        name: sceneObject.id || "IfcBuildingElementProxy"
      });

      if (result.ok !== true) {
        throw new Error(result.error);
      }

      dataObject = result.value;
    }

    // Don’t spatially contain the spatial structure nodes themselves
    if (isSpatialType(dataObject.type)) {
      continue;
    }

    if (!isContainedAlready(dataObject.id)) {
      ensureRelationship("IfcRelContainedInSpatialStructure", storey.id, dataObject.id);
    }
  }
}
