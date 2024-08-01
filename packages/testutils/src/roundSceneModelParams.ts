import {SceneModelParams} from "@xeokit/scene";
import {createMat4} from "@xeokit/matrix";

/**
 * Rounds the values of certains arrays in the given SceneModelParams for the purpose of
 * making comparison tests less picky when comparing their values.
 *
 * @param sceneModelParams
 * @param options
 */
export function roundSceneModelParams(sceneModelParams: any, options?: any): SceneModelParams {
    options = options || {};
    if (sceneModelParams.geometriesCompressed) {
        for (let i = 0, len = sceneModelParams.geometriesCompressed.length; i < len; i++) {
            const geometry = sceneModelParams.geometriesCompressed[i];
            if (geometry.positionsDecompressMatrix) {
                geometry.positionsDecompressMatrix = roundArrayToTwoDecimalPlaces(geometry.positionsDecompressMatrix);
            }
            if (geometry.positionsCompressed) {
                geometry.positionsCompressed = roundArrayToTwoDecimalPlaces(geometry.positionsCompressed);
            }
            if (geometry.uvsCompressed) {
                geometry.uvsCompressed = roundArrayToTwoDecimalPlaces(geometry.uvsCompressed);
            }
            if (geometry.colorsCompressed) {
                geometry.colorsCompressed = roundArrayToTwoDecimalPlaces(geometry.colorsCompressed);
            }
        }
    }
    for (let i = 0, len = sceneModelParams.meshes.length; i < len; i++) {
        const mesh = sceneModelParams.meshes[i];
        if (mesh.color) {
            mesh.color = roundArrayToTwoDecimalPlaces(mesh.color);
        }
        if (mesh.matrix) {
            if (options.stripMeshMatrices) {
                mesh.matrix = createMat4();
            } else {
                mesh.matrix = roundArrayToTwoDecimalPlaces(mesh.matrix);
            }
        }
    }
    return sceneModelParams;
}

function roundArrayToTwoDecimalPlaces(arr: any): any {
    return arr.map(element => Math.round(element * 10) / 10);
}
