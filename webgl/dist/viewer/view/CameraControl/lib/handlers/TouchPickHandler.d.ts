/**
 * @private
 */
declare class TouchPickHandler {
    #private;
    private _canvasTouchStartHandler;
    private _canvasTouchEndHandler;
    constructor(components: any, controllers: any, configs: any, states: any, updates: any);
    reset(): void;
    destroy(): void;
}
export { TouchPickHandler };
