import type {BuildableModel} from "@xeokit/core/components";

/**
 * DocModel parsing params.
 */
export interface ParseParams {
    data: ArrayBuffer,
    log: Function,
    buildableModel: BuildableModel
}