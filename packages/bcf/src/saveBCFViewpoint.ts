import type {BCFViewpoint} from "./BCFViewpoint";
import type {SaveBCFViewpointParams} from "./SaveBCFViewpointParams";
import {addVec3, createVec3, normalizeVec3, subVec3} from "@xeokit/matrix";
import {FloatArrayParam} from "@xeokit/math";
import {OrthoProjectionType} from "@xeokit/constants";
import {ViewObject} from "@xeokit/viewer";

/**
 * Saves a {@link @xeokit/viewer!View | View} to a {@link @xeokit/bcf!BCFViewpoint | BCFViewpoint}.
 *
 * See {@link "@xeokit/bcf" | @xeokit/bcf} for usage.
 *
 * @param params BCF saving parameers.
 * @returns The BCF viewpoint.
 */
export function saveBCFViewpoint(params: SaveBCFViewpointParams): BCFViewpoint {

    const includeViewLayers = params.includeLayerIds ? new Set(params.includeLayerIds) : null;
    const excludeViewLayers = params.excludeLayerIds ? new Set(params.excludeLayerIds) : null;

    const view = params.view;
    const camera = view.camera;
    // const realWorldOffset = view.realWorldOffset;
    const realWorldOffset = createVec3();
    const reverseClippingPlanes = (params.reverseClippingPlanes === true);
    let bcfViewpoint: any = {};

    let lookDirection = normalizeVec3(subVec3(camera.look, camera.eye, createVec3()));
    let eye = camera.eye;
    let up = camera.up;

    if (camera.yUp) {
        // BCF is Z up
        lookDirection = YToZ(lookDirection);
        eye = YToZ(eye);
        up = YToZ(up);
    }

    const camera_view_point = xyzArrayToObject(addVec3(eye, realWorldOffset));

    if (camera.projectionType === OrthoProjectionType) {
        bcfViewpoint.orthogonal_camera = {
            camera_view_point: camera_view_point,
            camera_direction: xyzArrayToObject(lookDirection),
            camera_up_vector: xyzArrayToObject(up),
            view_to_world_scale: camera.orthoProjection.scale,
        };
    } else {
        bcfViewpoint.perspective_camera = {
            camera_view_point: camera_view_point,
            camera_direction: xyzArrayToObject(lookDirection),
            camera_up_vector: xyzArrayToObject(up),
            field_of_view: camera.perspectiveProjection.fov,
        };
    }

    // Section planes

    // const sectionPlanes = view.sectionPlanes;
    // for (let id in sectionPlanes) {
    //     if (sectionPlanes.hasOwnProperty(id)) {
    //         let sectionPlane = sectionPlanes[id];
    //         if (!sectionPlane.active) {
    //             continue;
    //         }
    //         let location = sectionPlane.pos;
    //
    //         let direction;
    //         if (reverseClippingPlanes) {
    //             direction = negateVec3(sectionPlane.dir, createVec3());
    //         } else {
    //             direction = sectionPlane.dir;
    //         }
    //
    //         if (camera.yUp) {
    //             // BCF is Z up
    //             location = YToZ(location);
    //             direction = YToZ(direction);
    //         }
    //         addVec3(location, realWorldOffset);
    //
    //         location = xyzArrayToObject(location);
    //         direction = xyzArrayToObject(direction);
    //         if (!bcfViewpoint.clipping_planes) {
    //             bcfViewpoint.clipping_planes = [];
    //         }
    //         bcfViewpoint.clipping_planes.push({location, direction});
    //     }
    // }

    // Lines

    // const lineSets = view.lineSets;
    // for (let id in lineSets) {
    //     if (lineSets.hasOwnProperty(id)) {
    //         const lineSet = lineSets[id];
    //         if (!bcfViewpoint.lines) {
    //             bcfViewpoint.lines = [];
    //         }
    //         const positions = lineSet.positions;
    //         const indices = lineSet.indices;
    //         for (let i = 0, len = indices.length / 2; i < len; i++) {
    //             const a = indices[i * 2];
    //             const b = indices[(i * 2) + 1];
    //             bcfViewpoint.lines.push({
    //                 start_point: {
    //                     x: positions[a * 3 + 0],
    //                     y: positions[a * 3 + 1],
    //                     z: positions[a * 3 + 2]
    //                 },
    //                 end_point: {
    //                     x: positions[b * 3 + 0],
    //                     y: positions[b * 3 + 1],
    //                     z: positions[b * 3 + 2]
    //                 }
    //             });
    //         }
    //
    //     }
    // }

    // Bitmaps

    // const bitmaps = view.bitmaps;
    // for (let id in bitmaps) {
    //     if (bitmaps.hasOwnProperty(id)) {
    //         let bitmap = bitmaps[id];
    //         let location = bitmap.pos;
    //         let normal = bitmap.normal;
    //         let up = bitmap.up;
    //         if (camera.yUp) {
    //             // BCF is Z up
    //             location = YToZ(location);
    //             normal = YToZ(normal);
    //             up = YToZ(up);
    //         }
    //         addVec3(location, realWorldOffset);
    //         if (!bcfViewpoint.bitmaps) {
    //             bcfViewpoint.bitmaps = [];
    //         }
    //         bcfViewpoint.bitmaps.push({
    //             bitmap_type: bitmap.type,
    //             bitmap_data: bitmap.imageData,
    //             location: xyzArrayToObject(location),
    //             normal: xyzArrayToObject(normal),
    //             up: xyzArrayToObject(up),
    //             height: bitmap.height
    //         });
    //     }
    // }

    // Entity states

    bcfViewpoint.components = {
        visibility: {
            view_setup_hints: {
                spaces_visible: !!params.spacesVisible,
                space_boundaries_visible: !!params.spaceBoundariesVisible,
                openings_visible: !!params.openingsVisible,
                spaces_translucent: !!params.spaces_translucent,
                space_boundaries_translucent: !!params.space_boundaries_translucent,
                openings_translucent: !!params.openings_translucent
            }
        }
    };

    const opacityObjectIds = new Set(view.opacityObjectIds);
    const xrayedObjectIds = new Set(view.xrayedObjectIds);
    const colorizedObjectIds = new Set(view.colorizedObjectIds);

    const coloringMap = Object.values(view.objects)
        .filter(viewObject =>

            /////////////////////////////////
        // TODO filter visible, highlioghted, selected x-rayed etc
        ///////////////////////////////////////////////////////

            !viewObject.layer ||
            ((!includeViewLayers || includeViewLayers.has(viewObject.layer.id)) &&
                (!excludeViewLayers || !excludeViewLayers.has(viewObject.layer.id)))

            && opacityObjectIds.has(viewObject.id)
            || colorizedObjectIds.has(viewObject.id)
            || xrayedObjectIds.has(viewObject.id))
        .reduce((coloringMap, viewObject: ViewObject) => {

            let color = colorizeToRGB(viewObject.colorize);
            let alpha;

            if (viewObject.xrayed) {
                if (view.xrayMaterial.fillAlpha === 0.0 && view.xrayMaterial.edgeAlpha !== 0.0) {
                    // BCF can't deal with edges. If xRay is implemented only with edges, set an arbitrary opacity
                    alpha = 0.1;
                } else {
                    alpha = view.xrayMaterial.fillAlpha;
                }
                alpha = Math.round(alpha * 255).toString(16).padStart(2, "0");
                color = alpha + color;
            } else if (opacityObjectIds.has(viewObject.id)) {
                alpha = Math.round(viewObject.opacity * 255).toString(16).padStart(2, "0");
                color = alpha + color;
            }

            if (!coloringMap[color]) {
                coloringMap[color] = [];
            }

            const objectId = viewObject.id;
            const originalSystemId = viewObject.originalSystemId;
            const component: any = {
                ifc_guid: originalSystemId,
                originating_system: params.originatingSystem
            };
            if (originalSystemId !== objectId) {
                component.authoring_tool_id = objectId;
            }

            coloringMap[color].push(component);

            return coloringMap;

        }, {});

    const coloringArray = Object.entries(coloringMap).map(([color, components]) => {
        return {color, components};
    });

    bcfViewpoint.components.coloring = coloringArray;

    const objectIds = view.objectIds;
    const visibleObjects = view.visibleObjects;
    const visibleObjectIds = view.visibleObjectIds;
    const invisibleObjectIds = objectIds.filter(id => !visibleObjects[id]);
    const selectedObjectIds = view.selectedObjectIds;

    if (params.defaultInvisible || visibleObjectIds.length < invisibleObjectIds.length) {
        bcfViewpoint.components.visibility.exceptions = createBCFComponents(params, visibleObjectIds);
        bcfViewpoint.components.visibility.default_visibility = false;
    } else {
        bcfViewpoint.components.visibility.exceptions = createBCFComponents(params, invisibleObjectIds);
        bcfViewpoint.components.visibility.default_visibility = true;
    }

    bcfViewpoint.components.selection = createBCFComponents(params, selectedObjectIds);

    bcfViewpoint.components.translucency = createBCFComponents(params, view.xrayedObjectIds);

    if (params.snapshot !== false) {
        bcfViewpoint.snapshot = {
            snapshot_type: "png",
            snapshot_data: view.getSnapshot({format: "png"})
        };
    }

    return bcfViewpoint;
}

function createBCFComponents(params: SaveBCFViewpointParams, objectIds) {
    const view = params.view;
    const components = [];
    for (let i = 0, len = objectIds.length; i < len; i++) {
        const objectId = objectIds[i];
        const viewObject = view.objects[objectId];
        if (viewObject) {
            const component: any = {
                ifc_guid: viewObject.originalSystemId,
                originating_system: params.originatingSystem
            };
            if (viewObject.originalSystemId !== objectId) {
                component.authoring_tool_id = objectId;
            }
            components.push(component);
        }
    }
    return components;
}


function globalizeObjectId(modelId: string, objectId: string): string {
    return (modelId + "#" + objectId)
}

function xyzArrayToObject(arr: FloatArrayParam): any {
    return {"x": arr[0], "y": arr[1], "z": arr[2]};
}

function YToZ(vec: FloatArrayParam): FloatArrayParam {
    return new Float64Array([vec[0], -vec[2], vec[1]]);
}

function ZToY(vec: FloatArrayParam): FloatArrayParam {
    return new Float64Array([vec[0], vec[2], -vec[1]]);
}

function colorizeToRGB(color) {
    let rgb = "";
    rgb += Math.round(color[0] * 255).toString(16).padStart(2, "0");
    rgb += Math.round(color[1] * 255).toString(16).padStart(2, "0");
    rgb += Math.round(color[2] * 255).toString(16).padStart(2, "0");
    return rgb;
}

function convertListToMap(strings) {
    const resultMap = new Map();
    strings.forEach((str) => {
        resultMap.set(str, true);
    });
    return resultMap;
}
