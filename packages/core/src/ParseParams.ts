import type {BuildableModel} from "@xeokit/core/components";

/**
 * ScratchModel parsing params.
 */
export interface ParseParams {
    data: ArrayBuffer,
    log: Function,
    buildableModel: BuildableModel
}