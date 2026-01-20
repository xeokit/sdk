import {addVec3, createVec3Float64, type Vec3, negateVec3, subVec3} from "../math/vector";
import {IfcOpeningElement, IfcSpace} from "../formats/ifc/ifctypes_4_0_2_1";
import {OrthoProjectionType, PerspectiveProjectionType} from "../constants";
import {BasicAggregation} from "../formats/datamodel/basicTypes";
import type {BCFComponent} from "./BCFComponent";
import type {BCFVector} from "./BCFVector";
import type {DataObject} from "../data";
import type {LoadBCFViewpointParams} from "./LoadBCFViewpointParams";
import {ViewObject} from "../viewer";
import {searchObjects} from "../data";

const tempVec3 = createVec3Float64();
const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();
const tempVec3c = createVec3Float64();

/**
 * Loads a {@link BCFViewpoint | BCFViewpoint} into a {@link viewer!View | View}.
 *
 * See {@link bcf | @xeokit/sdk/bcf} for usage.
 *
 * @param params BCF viewpoint loading parameters.
 */
export function loadBCFViewpoint(params: LoadBCFViewpointParams): void {

  const includeViewLayers = params.includeViewLayerIds ? new Set(params.includeViewLayerIds) : null;
  const excludeViewLayers = params.excludeViewLayerIds ? new Set(params.excludeViewLayerIds) : null;

  const view = params.view;
  const data = params.data;
  const camera = view.camera;
  const coordinateSystem = view.viewer.scene.coordinateSystem;
  const rayCast = (!!params.rayCast);
  const reset = (params.reset !== false);
  //const realWorldOffset = scene.realWorldOffset;
  const realWorldOffset = createVec3Float64();
  const reverseClippingPlanes = (params.reverseClippingPlanes === true);
  const bcfViewpoint = params.bcfViewpoint;

  view.clearSectionPlanes();

  if (bcfViewpoint.clipping_planes) {
    bcfViewpoint.clipping_planes.forEach((e) => {
      let pos = xyzObjectToArray(e.location, tempVec3a);
      let dir = xyzObjectToArray(e.direction, tempVec3b);
      if (reverseClippingPlanes) {
        negateVec3(dir);
      }
      subVec3(pos, realWorldOffset);
      if (coordinateSystem.yUp) {
        pos = ZToY(pos);
        dir = ZToY(dir);
      }
      view.createSectionPlane({
        pos,
        dir
      });
    });
  }

  // scene.clearLines();

  if (bcfViewpoint.lines) {
    const positions: any[] = [];
    const indices: any[] = [];
    let i = 0;
    bcfViewpoint.lines.forEach((e) => {
      if (!e.start_point) {
        return;
      }
      if (!e.end_point) {
        return;
      }
      positions.push(e.start_point.x);
      positions.push(e.start_point.y);
      positions.push(e.start_point.z);
      positions.push(e.end_point.x);
      positions.push(e.end_point.y);
      positions.push(e.end_point.z);
      indices.push(i++);
      indices.push(i++);
    });
    // new LineSet(scene, {
    //     positions,
    //     indices,
    //     clippable: false,
    //     collidable: true
    // });
  }

  // scene.clearBitmaps();

  if (bcfViewpoint.bitmaps) {
    bcfViewpoint.bitmaps.forEach(e => {
      const bitmap_type = e.bitmap_type || "jpg"; // "jpg" | "png"
      const bitmap_data = e.bitmap_data; // base64
      let location = xyzObjectToArray(e.location, tempVec3a);
      let normal = xyzObjectToArray(e.normal, tempVec3b);
      let up = xyzObjectToArray(e.up, tempVec3c);
      const height = e.height || 1;
      if (!bitmap_type) {
        return;
      }
      if (!bitmap_data) {
        return;
      }
      if (!location) {
        return;
      }
      if (!normal) {
        return;
      }
      if (!up) {
        return;
      }
      if (coordinateSystem.yUp) {
        location = ZToY(location);
        normal = ZToY(normal);
        up = ZToY(up);
      }
      // new Bitmap(scene, {
      //     src: bitmap_data,
      //     type: bitmap_type,
      //     pos: location,
      //     normal: normal,
      //     up: up,
      //     clippable: false,
      //     collidable: true,
      //     height
      // });
    });
  }

  function filterViewObject(viewObject: ViewObject) {
    return !viewObject.layer ||
      ((!includeViewLayers || includeViewLayers.has(viewObject.layer.id)) &&
        (!excludeViewLayers || !excludeViewLayers.has(viewObject.layer.id)));
  }

  function withFilteredViewLayers(callback: any) {
    for (const layerId in view.layers) {
      if (excludeViewLayers && excludeViewLayers.has(layerId)) {
        continue;
      }
      if (includeViewLayers && !includeViewLayers.has(layerId)) {
        continue;
      }
      callback(view.layers[layerId]);
    }
  }

  function withViewObjectsOfType(type: any, callback: any) {
    const dataObjects = data.objectsByType[type];
    for (const dataObjectId in dataObjects) {
      const viewObject = view.objects[dataObjectId];
      if (viewObject && filterViewObject(viewObject)) {
        callback(viewObject);
      }
    }
  }

  function withBCFComponent(component: BCFComponent, callback: any) {

    if (component.authoring_tool_id && component.originating_system === params.originatingSystem) {
      const id = component.authoring_tool_id;
      const viewObject = view.objects[id];
      if (viewObject) {
        if (filterViewObject(viewObject)) {
          callback(viewObject);
        }
        return
      }
      if (params.updateCompositeObjects) {
        const dataObject = data.objects[id];
        if (dataObject) {
          searchObjects(data, { // Updated aggregated IFC elements
            startObjectId: dataObject.id,
            includeStart: true,
            includeRelated: [BasicAggregation],
            resultCallback: (dataObject: DataObject): boolean => {
              const viewObject = view.objects[dataObject.id];
              if (viewObject) {
                if (filterViewObject(viewObject)) {
                  callback(viewObject);
                }
              }
              return false;
            }
          });
          return;
        }
      }
    }

    if (component.ifc_guid) {
      const originalSystemId = component.ifc_guid;
      const viewObject = view.objects[originalSystemId];
      if (viewObject) {
        callback(viewObject);
        return;
      }
      if (params.updateCompositeObjects) {
        const dataObject = data.objects[originalSystemId];
        if (dataObject) {
          searchObjects(data, {
            startObjectId: dataObject.id,
            includeStart: true,
            includeRelated: [BasicAggregation],
            resultCallback: (dataObject: DataObject): boolean => {
              const viewObject = view.objects[dataObject.id];
              if (viewObject) {
                if (filterViewObject(viewObject)) {
                  callback(viewObject);
                }
              }
              return false;
            }
          });
          return;
        }
      }
    }
  }

  if (reset) {
    withFilteredViewLayers(viewLayer => {
      viewLayer.setObjectsXRayed(viewLayer.xrayedObjectIds, false);
      viewLayer.setObjectsHighlighted(viewLayer.highlightedObjectIds, false);
      viewLayer.setObjectsSelected(viewLayer.selectedObjectIds, false);
    });
  }

  if (bcfViewpoint.components) {
    if (bcfViewpoint.components.visibility) {
      if (!bcfViewpoint.components.visibility.default_visibility) {
        withFilteredViewLayers(viewLayer => {
          viewLayer.setObjectsVisible(viewLayer.objectIds, false);
        });
        if (bcfViewpoint.components.visibility.exceptions) {
          bcfViewpoint.components.visibility.exceptions.forEach(
            component =>
              withBCFComponent(component,
                viewObject => {
                  viewObject.visible = true;
                }));
        }
      } else {
        withFilteredViewLayers(viewLayer => {
          viewLayer.setObjectsVisible(viewLayer.objectIds, true);
        });
        if (bcfViewpoint.components.visibility.exceptions) {
          bcfViewpoint.components.visibility.exceptions.forEach(
            component => withBCFComponent(component,
              viewObject => {
                viewObject.visible = false;
              }));
        }
      }
      const view_setup_hints = bcfViewpoint.components.visibility.view_setup_hints;
      if (view_setup_hints) {
        if (view_setup_hints.spaces_visible === false) { // Hide IfcSpaces
          withViewObjectsOfType(IfcSpace, viewObject => {
            viewObject.visible = false;
          });
        }
        if (view_setup_hints.spaces_translucent !== undefined) { // X-ray IfcSpaces
          withViewObjectsOfType(IfcSpace, viewObject => {
            viewObject.xrayed = true;
          });
        }
        if (view_setup_hints.space_boundaries_visible !== undefined) {
          // TODO
        }
        if (view_setup_hints.openings_visible === false) { // Hide IfcOpeningElements
          withViewObjectsOfType(IfcOpeningElement, viewObject => {
            viewObject.visible = false;
          });
        }
        if (view_setup_hints.space_boundaries_translucent !== undefined) {
          // TODO
        }
        if (view_setup_hints.openings_translucent !== undefined) { // X-ray IfcOpeningElements
          withViewObjectsOfType(IfcOpeningElement, viewObject => {
            viewObject.xrayed = true;
          });
        }
      }
    }
    if (bcfViewpoint.components.selection) {
      withFilteredViewLayers(viewLayer => {
        viewLayer.setObjectsSelected(viewLayer.selectedObjectIds, false);
      });
      bcfViewpoint.components.selection.forEach(
        component => withBCFComponent(component,
          viewObject => {
            viewObject.selected = true;
          }));
    }
    if (bcfViewpoint.components.translucency) {
      view.setObjectsXRayed(view.xrayedObjectIds, false);
      bcfViewpoint.components.translucency.forEach(
        component => withBCFComponent(component,
          viewObject => {
            viewObject.xrayed = true;
          }));
    }
    if (bcfViewpoint.components.coloring) {
      bcfViewpoint.components.coloring.forEach(coloring => {
        let color = coloring.color;
        let alpha = 0;
        let alphaDefined = false;
        if (color.length === 8) {
          alpha = parseInt(color.substring(0, 2), 16) / 256;
          if (alpha <= 1.0 && alpha >= 0.95) {
            alpha = 1.0;
          }
          color = color.substring(2);
          alphaDefined = true;
        }
        const colorize = [
          parseInt(color.substring(0, 2), 16) / 256,
          parseInt(color.substring(2, 4), 16) / 256,
          parseInt(color.substring(4, 6), 16) / 256
        ];
        coloring.components.map(component =>
          withBCFComponent(component,
            viewObject => {
              viewObject.colorize = colorize;
              if (alphaDefined) {
                viewObject.opacity = alpha;
              }
            }));
      });
    }
  }

  if (bcfViewpoint.perspective_camera || bcfViewpoint.orthogonal_camera) {
    let eye;
    let look;
    let up;
    let projection;
    if (bcfViewpoint.perspective_camera) {
      eye = xyzObjectToArray(bcfViewpoint.perspective_camera.camera_view_point, tempVec3a);
      look = xyzObjectToArray(bcfViewpoint.perspective_camera.camera_direction, tempVec3b);
      up = xyzObjectToArray(bcfViewpoint.perspective_camera.camera_up_vector, tempVec3c);
      camera.perspectiveProjection.fov = bcfViewpoint.perspective_camera.field_of_view;
      projection = PerspectiveProjectionType;
    } else {
      eye = xyzObjectToArray(bcfViewpoint.orthogonal_camera.camera_view_point, tempVec3a);
      look = xyzObjectToArray(bcfViewpoint.orthogonal_camera.camera_direction, tempVec3b);
      up = xyzObjectToArray(bcfViewpoint.orthogonal_camera.camera_up_vector, tempVec3c);
      camera.orthoProjection.scale = bcfViewpoint.orthogonal_camera.view_to_world_scale;
      projection = OrthoProjectionType;
    }
    subVec3(eye, realWorldOffset);
    if (coordinateSystem.yUp) {
      eye = ZToY(eye);
      look = ZToY(look);
      up = ZToY(up);
    }
    // if (rayCast) {
    //   const hit = view.pick({
    //     pickSurface: true, // <<------ This causes picking to find the intersection point on the viewObject
    //     rayOrigin: eye,
    //     rayDirection: look
    //   });
    //   look = (hit instanceof PickResult ? hit.worldPos : addVec3(eye, look, tempVec3));
    // } else {
      look = addVec3(eye, look, tempVec3);
   // }
    camera.eye = eye;
    camera.look = look;
    camera.up = up;
    camera.projectionType = projection;
  }
}


function globalizeObjectId(modelId: string, objectId: string): string {
  return (modelId + "#" + objectId)
}

function xyzObjectToArray(xyz: BCFVector, arry: Vec3): Vec3 {
  arry[0] = xyz.x;
  arry[1] = xyz.y;
  arry[2] = xyz.z;
  return arry;
}

function ZToY(vec: Vec3): Vec3 {
  return createVec3Float64([vec[0], vec[2], -vec[1]]);
}
