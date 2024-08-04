import type {LoadBCFViewpointParams} from "./LoadBCFViewpointParams";
import {addVec3, createVec3, negateVec3, subVec3} from "@xeokit/matrix";
import {View} from "@xeokit/viewer";
import {Data, DataObject} from "@xeokit/data";
import {OrthoProjectionType, PerspectiveProjectionType} from "@xeokit/constants";
import {FloatArrayParam} from "@xeokit/math";
import {IfcOpeningElement, IfcSpace} from "@xeokit/ifctypes";
import {BasicAggregation} from "@xeokit/basictypes";
import {BCFVector} from "./BCFVector";
import {BCFComponent} from "./BCFComponent";

const tempVec3 = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();

/**
 * Loads a {@link @xeokit/bcf!BCFViewpoint | BCFViewpoint} into a {@link @xeokit/viewer!View | View}.
 *
 * See {@link "@xeokit/bcf" | @xeokit/bcf} for usage.
 *
 * @param params BCF viewpoint loading paremeters.
 */
export function loadBCFViewpoint(params: LoadBCFViewpointParams): void {

    const includeViewLayers = params.includeLayerIds ? new Set(params.includeLayerIds) : null;
    const excludeViewLayers = params.excludeLayerIds ? new Set(params.excludeLayerIds) : null;

    const view = params.view;
    const data = params.data;
    const camera = view.camera;
    const rayCast = (!!params.rayCast);
    const immediate = (params.immediate !== false);
    const reset = (params.reset !== false);
    //const realWorldOffset = scene.realWorldOffset;
    const realWorldOffset = createVec3();
    const reverseClippingPlanes = (params.reverseClippingPlanes === true);
    const bcfViewpoint = params.bcfViewpoint;

    view.clearSectionPlanes();

    if (bcfViewpoint.clipping_planes && bcfViewpoint.clipping_planes.length > 0) {
        bcfViewpoint.clipping_planes.forEach(function (e) {
            let pos = xyzObjectToArray(e.location, tempVec3);
            let dir = xyzObjectToArray(e.direction, tempVec3);
            if (reverseClippingPlanes) {
                negateVec3(dir);
            }
            subVec3(pos, realWorldOffset);
            if (camera.yUp) {
                pos = ZToY(pos);
                dir = ZToY(dir);
            }
            view.createSectionPlane({pos, dir});
        });
    }
    /*
        scene.clearLines();

        if (bcfViewpoint.lines && bcfViewpoint.lines.length > 0) {
            const positions = [];
            const indices = [];
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
            new LineSet(scene, {
                positions,
                indices,
                clippable: false,
                collidable: true
            });
        }

        scene.clearBitmaps();

        if (bcfViewpoint.bitmaps && bcfViewpoint.bitmaps.length > 0) {
            bcfViewpoint.bitmaps.forEach(function (e) {
                const bitmap_type = e.bitmap_type || "jpg"; // "jpg" | "png"
                const bitmap_data = e.bitmap_data; // base64
                let location = xyzObjectToArray(e.location, tempVec3a);
                let normal = xyzObjectToArray(e.normal, tempVec3b);
                let up = xyzObjectToArray(e.up, tempVec3c);
                let height = e.height || 1;
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
                if (camera.yUp) {
                    location = ZToY(location);
                    normal = ZToY(normal);
                    up = ZToY(up);
                }
                new Bitmap(scene, {
                    src: bitmap_data,
                    type: bitmap_type,
                    pos: location,
                    normal: normal,
                    up: up,
                    clippable: false,
                    collidable: true,
                    height
                });
            });
        }
    */

    ///////////////////////////////////////////
    // TODO
    // Filter on layers
    ///////////////////////////////////////////

    if (reset) {
        view.setObjectsXRayed(view.xrayedObjectIds, false);
        view.setObjectsHighlighted(view.highlightedObjectIds, false);
        view.setObjectsSelected(view.selectedObjectIds, false);
    }

    function filterViewObject(viewObject) {
        return !viewObject.layer ||
            ((!includeViewLayers || includeViewLayers.has(viewObject.layer.id)) &&
            (!excludeViewLayers || !excludeViewLayers.has(viewObject.layer.id)));
    }

    if (bcfViewpoint.components) {
        if (bcfViewpoint.components.visibility) {
            if (!bcfViewpoint.components.visibility.default_visibility) {
                view.setObjectsVisible(view.objectIds, false);
                if (bcfViewpoint.components.visibility.exceptions) {
                    bcfViewpoint.components.visibility.exceptions.forEach(
                        component =>
                            withBCFComponent(data, view, params, component,
                                (viewObject) => {
                                    if (filterViewObject(viewObject)) {
                                        viewObject.visible = true;
                                    }
                                }));
                }
            } else {
                view.setObjectsVisible(view.objectIds, true);
                if (bcfViewpoint.components.visibility.exceptions) {
                    bcfViewpoint.components.visibility.exceptions.forEach(
                        component => withBCFComponent(data, view, params, component,
                            (viewObject) => {
                                if (filterViewObject(viewObject)) {
                                    viewObject.visible = false;
                                }
                            }));
                }
            }
            const view_setup_hints = bcfViewpoint.components.visibility.view_setup_hints;
            if (view_setup_hints) {
                if (view_setup_hints.spaces_visible === false) { // Hide IfcSpaces
                    data.searchObjects({
                        includeObjects: [IfcSpace],
                        resultCallback: (dataObject: DataObject): boolean => {
                            const viewObject = view.objects[dataObject.id];
                            if (viewObject && filterViewObject(viewObject)) {
                                viewObject.visible = false;
                            }
                            return false;
                        }
                    });
                }
                if (view_setup_hints.spaces_translucent !== undefined) { // X-ray IfcSpaces
                    data.searchObjects({
                        includeObjects: [IfcSpace],
                        resultCallback: (dataObject: DataObject): boolean => {
                            const viewObject = view.objects[dataObject.id];
                            if (viewObject && filterViewObject(viewObject)) {
                                viewObject.xrayed = true;
                            }
                            return false;
                        }
                    });
                }
                if (view_setup_hints.space_boundaries_visible !== undefined) {
                    // TODO
                }
                if (view_setup_hints.openings_visible === false) { // Hide IfcOpeningElements
                    data.searchObjects({
                        includeObjects: [IfcOpeningElement],
                        resultCallback: (dataObject: DataObject): boolean => {
                            const viewObject = view.objects[dataObject.id];
                            if (viewObject && filterViewObject(viewObject)) {
                                viewObject.visible = false;
                            }
                            return false;
                        }
                    });
                }
                if (view_setup_hints.space_boundaries_translucent !== undefined) {
                    // TODO
                }
                if (view_setup_hints.openings_translucent !== undefined) { // // X-ray IfcOpeningElements
                    data.searchObjects({
                        includeObjects: [IfcOpeningElement],
                        resultCallback: (dataObject: DataObject): boolean => {
                            const viewObject = view.objects[dataObject.id];
                            if (viewObject && filterViewObject(viewObject)) {
                                viewObject.xrayed = true;
                            }
                            return false;
                        }
                    });
                }
            }
        }

        if (bcfViewpoint.components.selection) {
            view.setObjectsSelected(view.selectedObjectIds, false);
            bcfViewpoint.components.selection.forEach(
                component => withBCFComponent(data, view, params, component,
                    (viewObject) => {
                        if (filterViewObject(viewObject)) {
                            viewObject.selected = true;
                        }
                    }));

        }
        if (bcfViewpoint.components.translucency) {
            view.setObjectsXRayed(view.xrayedObjectIds, false);
            bcfViewpoint.components.translucency.forEach(
                component => withBCFComponent(data, view, params, component,
                    (viewObject) => {
                        if (filterViewObject(viewObject)) {
                            viewObject.xrayed = true;
                        }
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
                    withBCFComponent(data, view, params, component,
                        (viewObject) => {
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
            eye = xyzObjectToArray(bcfViewpoint.perspective_camera.camera_view_point, tempVec3);
            look = xyzObjectToArray(bcfViewpoint.perspective_camera.camera_direction, tempVec3);
            up = xyzObjectToArray(bcfViewpoint.perspective_camera.camera_up_vector, tempVec3);

            camera.perspectiveProjection.fov = bcfViewpoint.perspective_camera.field_of_view;

            projection = PerspectiveProjectionType;
        } else {
            eye = xyzObjectToArray(bcfViewpoint.orthogonal_camera.camera_view_point, tempVec3);
            look = xyzObjectToArray(bcfViewpoint.orthogonal_camera.camera_direction, tempVec3);
            up = xyzObjectToArray(bcfViewpoint.orthogonal_camera.camera_up_vector, tempVec3);

            camera.orthoProjection.scale = bcfViewpoint.orthogonal_camera.view_to_world_scale;

            projection = OrthoProjectionType;
        }

        subVec3(eye, realWorldOffset);

        if (camera.yUp) {
            eye = ZToY(eye);
            look = ZToY(look);
            up = ZToY(up);
        }

        if (rayCast) {
            const hit = view.pick({
                pickSurface: true,  // <<------ This causes picking to find the intersection point on the viewObject
                rayOrigin: eye,
                rayDirection: look
            });
            look = (hit ? hit.worldPos : addVec3(eye, look, tempVec3));
        } else {
            look = addVec3(eye, look, tempVec3);
        }

        if (immediate) {
            camera.eye = eye;
            camera.look = look;
            camera.up = up;
            camera.projectionType = projection;
        } else {
            view.cameraFlight.flyTo({eye, look, up, duration: params.duration, projection}, () => {
                // TODO
            });
        }
    }
}


function withBCFComponent(data: Data, view: View, params: LoadBCFViewpointParams, component: BCFComponent, callback) {


    if (component.authoring_tool_id && component.originating_system === params.originatingSystem) {

        const id = component.authoring_tool_id;
        const viewObject = view.objects[id];

        if (viewObject) {
            callback(viewObject);
            return
        }

        if (params.updateCompositeObjects) {
            const dataObject = data.objects[id];
            if (dataObject) {
                data.searchObjects({ // Updated aggregated IFC elements
                    startObjectId: dataObject.id,
                    includeStart: true,
                    includeRelated: [BasicAggregation],
                    resultCallback: (dataObject: DataObject): boolean => {
                        const viewObject = view.objects[dataObject.id];
                        if (viewObject) {
                            callback(viewObject);
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
                data.searchObjects({
                    startObjectId: dataObject.id,
                    includeStart: true,
                    includeRelated: [BasicAggregation],
                    resultCallback: (dataObject: DataObject): boolean => {
                        const viewObject = view.objects[dataObject.id];
                        if (viewObject) {
                            callback(viewObject);
                        }
                        return false;
                    }
                });
                return;
            }
        }

        // Object.keys(scene.models).forEach((modelId) => {
        //
        //     const id = globalizeObjectId(modelId, originalSystemId);
        //     const viewObject = scene.objects[id];
        //
        //     if (viewObject) {
        //         callback(viewObject);
        //         return;
        //     }
        //
        //     if (params.updateCompositeObjects) {
        //         const dataObject = data.objects[id];
        //         if (dataObject) {
        //             scene.withObjects(viewer.metaScene.getObjectIDsInSubtree(id), callback);
        //
        //         }
        //     }
        // });
    }
}

function globalizeObjectId(modelId: string, objectId: string): string {
    return (modelId + "#" + objectId)
}

function xyzObjectToArray(xyz: BCFVector, arry: FloatArrayParam): FloatArrayParam {
    arry = new Float64Array(3);
    arry[0] = xyz.x;
    arry[1] = xyz.y;
    arry[2] = xyz.z;
    return arry;
}

function YToZ(vec: FloatArrayParam): FloatArrayParam {
    return new Float64Array([vec[0], -vec[2], vec[1]]);
}

function ZToY(vec: FloatArrayParam): FloatArrayParam {
    return new Float64Array([vec[0], vec[2], -vec[1]]);
}

function colorizeToRGB(color: FloatArrayParam): string {
    let rgb = "";
    rgb += Math.round(color[0] * 255).toString(16).padStart(2, "0");
    rgb += Math.round(color[1] * 255).toString(16).padStart(2, "0");
    rgb += Math.round(color[2] * 255).toString(16).padStart(2, "0");
    return rgb;
}
