/**
 * Handles camera updates on each "tick" that were scheduled by the various controllers.
 *
 * @private
 */
declare class CameraUpdater {
    #private;
    constructor(view: any, controllers: any, configs: any, states: any, updates: any);
    destroy(): void;
}
export { CameraUpdater };
