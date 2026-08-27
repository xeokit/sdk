import type {Data} from "./Data";
import type {DataObject} from "./DataObject";
import {SDKErrorType, type SDKResult} from "../../base/core";
import type {SearchParams} from "./SearchParams";

/**
 * Finds {@link DataObject | DataObjects} in a {@link Data | Data} using a customized
 * depth-first traversal.
 *
 * Usually used to recursively find DataObjects of specific {@link DataObject.type | types}
 * within a hierarchy.
 *
 * See {@link model!data | @xeokit/sdk/model/data} for usage.
 *
 * @param data The Data to search.
 * @param searchParams Search parameters.
 * @returns A result indicating success or an error message on failure.
 * - On success: `{ ok: true, value: undefined }`
 * - On failure: `{ ok: false, error: string }`
 */
export function searchObjects(data: Data, searchParams: SearchParams): SDKResult<void> {
  if (data.destroyed) {
    return {
      ok: false,
      type: SDKErrorType.InvalidOperation,
      error: "[searchObjects] Data already destroyed"
    };
  }
  const includeObjects = (searchParams.includeObjects && searchParams.includeObjects.length > 0) ? arrayToMap(searchParams.includeObjects) : null;
  const excludeObjects = (searchParams.excludeObjects && searchParams.excludeObjects.length > 0) ? arrayToMap(searchParams.excludeObjects) : null;
  const includeRelated = filterToMap(searchParams.includeRelated, searchParams.includeRelating);
  const excludeRelated = filterToMap(searchParams.excludeRelated, searchParams.excludeRelating);
  const visitedObjects: { [key: string]: boolean } = {};
  let stopped = false;

  function visit(dataObject: DataObject, depth: number) {
    if (!dataObject || stopped || visitedObjects[dataObject.id]) {
      return;
    }
    visitedObjects[dataObject.id] = true;
    let includeObject = true;
    if (excludeObjects && excludeObjects[dataObject.type]) {
      includeObject = false;
    } else {
      if (includeObjects && (!includeObjects[dataObject.type])) {
        includeObject = false;
      }
    }
    if (depth === 0 && searchParams.includeStart === false) {
      includeObject = false;
    }
    if (includeObject) {
      if (searchParams.resultObjectIds) {
        searchParams.resultObjectIds.push(dataObject.id);
      } else if (searchParams.resultObjects) {
        searchParams.resultObjects.push(dataObject);
      } else if (searchParams.resultCallback) {
        if (searchParams.resultCallback(dataObject)) {
          stopped = true;
          return;
        }
      }
    }
    const related = dataObject.related;
    for (const type in related) {
      const relations = related[type];
      if (relations) {
        for (let i = 0, len = relations.length; i < len; i++) {
          let includeRelation = true;
          // Filter by the RELATIONSHIP type (the `related` map key), per the
          // documented "types of Relationships to follow/exclude" — not the
          // relating object's own type.
          if (excludeRelated && excludeRelated[type]) {
            includeRelation = false;
          } else {
            if (includeRelated && (!includeRelated[type])) {
              includeRelation = false;
            }
          }
          if (includeRelation) {
            visit(relations[i].relatedObject, depth + 1);
            if (stopped) {
              return;
            }
          }
        }
      }
    }
  }

  const depth = 0;
  if (searchParams.startObjectId) {
    const startObject = data.objects[searchParams.startObjectId];
    if (!startObject) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[searchObjects] Cannot search DataObjects - starting DataObject not found in Data: "${searchParams.startObjectId}"`
      };
    }
    visit(startObject, depth);
  } else if (searchParams.startObject) {
    if (searchParams.startObject.data != data) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[searchObjects] Cannot search DataObjects - starting DataObject not in same Data: "${searchParams.startObjectId}"`
      };
    }
    visit(searchParams.startObject, depth);
  } else {
    for (const id in data.rootObjects) {
      visit(data.rootObjects[id], depth + 1);
      if (stopped) {
        break;
      }
    }
  }

  return {
    ok: true,
    value: undefined
  };
}
function arrayToMap(array: any[]): { [key: string]: any } {
  const map: { [key: string]: any } = {};
  for (let i = 0, len = array.length; i < len; i++) {
    map[array[i]] = true;
  }
  return map;
}

function filterToMap(primary?: any[], fallback?: any[]): { [key: string]: any } | null {
  const values = (primary && primary.length > 0) ? primary : fallback;
  return (values && values.length > 0) ? arrayToMap(values) : null;
}
