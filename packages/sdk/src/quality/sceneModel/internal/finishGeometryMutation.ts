import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../base/constants";
import type {SceneGeometry} from "../../../model/scene";
import {getInspectionIndex} from "./getInspectionIndex";


export interface GeometryMutationSnapshot {
  primitive: number;
  positionsLength: number;
  indicesLength: number;
}


/**
 * Capture the SceneModel counters affected by a direct SceneGeometry mutation.
 */
export function snapshotGeometryMutation(geom: SceneGeometry): GeometryMutationSnapshot {
  return {
    primitive: geom.primitive,
    positionsLength: geom.positionsCompressed ? geom.positionsCompressed.length : 0,
    indicesLength: geom.indices ? geom.indices.length : 0,
  };
}


/**
 * Reconcile SceneModel bookkeeping after an inspect fix mutates a geometry in
 * place, then notify renderer-side subscribers that the geometry buffer changed.
 */
export function finishGeometryMutation(
  geom: SceneGeometry,
  before: GeometryMutationSnapshot,
): void {
  const model = geom.model;
  const after = snapshotGeometryMutation(geom);

  model.stats.numVertices += vertexCount(after) - vertexCount(before);
  model.stats.numTriangles += triangleCount(after) - triangleCount(before);
  model.stats.numLines += lineCount(after) - lineCount(before);
  model.stats.numPoints += pointCount(after) - pointCount(before);

  if (after.primitive !== before.primitive) {
    const bumpPrimitiveCount = (model as unknown as PrimitiveCounter)._bumpPrimitiveCount;
    if (bumpPrimitiveCount) {
      bumpPrimitiveCount.call(model, before.primitive, -1);
      bumpPrimitiveCount.call(model, after.primitive, 1);
    }
  }

  getInspectionIndex(model).invalidateGeometry(geom.id);
  model.scene.events.onSceneGeometryUpdated.dispatch(model.scene, geom);
}


interface PrimitiveCounter {
  _bumpPrimitiveCount?: (primitive: number, delta: number) => void;
}


function vertexCount(snapshot: GeometryMutationSnapshot): number {
  return snapshot.positionsLength / 3;
}


function triangleCount(snapshot: GeometryMutationSnapshot): number {
  return snapshot.primitive === TrianglesPrimitive ? snapshot.indicesLength / 3 : 0;
}


function lineCount(snapshot: GeometryMutationSnapshot): number {
  return snapshot.primitive === LinesPrimitive ? snapshot.indicesLength / 2 : 0;
}


function pointCount(snapshot: GeometryMutationSnapshot): number {
  return snapshot.primitive === PointsPrimitive && snapshot.indicesLength === 0
    ? snapshot.positionsLength / 3
    : 0;
}
