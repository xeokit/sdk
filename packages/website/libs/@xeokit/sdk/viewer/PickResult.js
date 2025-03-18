/**
 * Results of a pick attempted with {@link View.pick}.
 */
class PickResult {
    #viewObject;
    #gotCanvasPos;
    #gotSnappedCanvasPos;
    #gotOrigin;
    #gotDirection;
    #gotIndices;
    #gotLocalPos;
    #gotWorldPos;
    #gotViewPos;
    #gotWorldNormal;
    #gotUV;
    #snappedToVertex;
    #snappedToEdge;
    #canvasPos;
    #snappedCanvasPos;
    #origin;
    #direction;
    #indices;
    #localPos;
    #worldPos;
    #viewPos;
    #worldNormal;
    #uv;
    constructor() {
        this.#viewObject = null;
        this.#canvasPos = new Int16Array([0, 0]);
        this.#origin = new Float64Array([0, 0, 0]);
        this.#direction = new Float64Array([0, 0, 0]);
        this.#indices = new Int32Array(3);
        this.#localPos = new Float64Array([0, 0, 0]);
        this.#worldPos = new Float64Array([0, 0, 0]);
        this.#viewPos = new Float64Array([0, 0, 0]);
        this.#worldNormal = new Float64Array([0, 0, 0]);
        this.#uv = new Float64Array([0, 0]);
        this.#gotOrigin = false;
        this.#gotDirection = false;
        this.#gotIndices = false;
        this.#gotCanvasPos = false;
        this.#gotSnappedCanvasPos = false;
        this.#gotLocalPos = false;
        this.#gotWorldPos = false;
        this.#gotViewPos = false;
        this.#gotWorldNormal = false;
        this.#gotUV = false;
        this.#snappedToVertex = false;
        this.#snappedToEdge = false;
        this.reset();
    }
    /**
     * The picked {@link viewer!ViewObject}.
     */
    get viewObject() {
        return this.#viewObject;
    }
    /**
     * @private
     */
    set viewObject(value) {
        this.#viewObject = value;
    }
    /**
     * Canvas coordinates when picking with a 2D pointer.
     */
    get canvasPos() {
        return this.#gotCanvasPos ? this.#canvasPos : undefined;
    }
    /**
     * @private
     */
    set canvasPos(value) {
        if (value) {
            this.#canvasPos[0] = value[0];
            this.#canvasPos[1] = value[1];
            this.#gotCanvasPos = true;
        }
        else {
            this.#gotCanvasPos = false;
        }
    }
    /**
     * World-space 3D ray origin when raypicked.
     */
    get origin() {
        return this.#gotOrigin ? this.#origin : null;
    }
    /**
     * @private
     */
    set origin(value) {
        if (value) {
            this.#origin[0] = value[0];
            this.#origin[1] = value[1];
            this.#origin[2] = value[2];
            this.#gotOrigin = true;
        }
        else {
            this.#gotOrigin = false;
        }
    }
    /**
     * World-space 3D ray direction when raypicked.
     */
    get direction() {
        return this.#gotDirection ? this.#direction : null;
    }
    /**
     * @private
     */
    set direction(value) {
        if (value) {
            this.#direction[0] = value[0];
            this.#direction[1] = value[1];
            this.#direction[2] = value[2];
            this.#gotDirection = true;
        }
        else {
            this.#gotDirection = false;
        }
    }
    /**
     * Picked triangle's vertex indices.
     * Only defined when an object and triangle was picked.
     */
    get indices() {
        return this.#viewObject !== null && this.#gotIndices ? this.#indices : null;
    }
    /**
     * @private
     */
    set indices(value) {
        if (value) {
            this.#indices[0] = value[0];
            this.#indices[1] = value[1];
            this.#indices[2] = value[2];
            this.#gotIndices = true;
        }
        else {
            this.#gotIndices = false;
        }
    }
    /**
     * Picked Local-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get localPos() {
        return this.#viewObject !== null && this.#gotLocalPos ? this.#localPos : null;
    }
    /**
     * @private
     */
    set localPos(value) {
        if (value) {
            this.#localPos[0] = value[0];
            this.#localPos[1] = value[1];
            this.#localPos[2] = value[2];
            this.#gotLocalPos = true;
        }
        else {
            this.#gotLocalPos = false;
        }
    }
    /**
     * Picked World-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get worldPos() {
        return this.#viewObject && this.#gotWorldPos ? this.#worldPos : null;
    }
    /**
     * @private
     */
    set worldPos(value) {
        if (value) {
            this.#worldPos[0] = value[0];
            this.#worldPos[1] = value[1];
            this.#worldPos[2] = value[2];
            this.#gotWorldPos = true;
        }
        else {
            this.#gotWorldPos = false;
        }
    }
    /**
     * Picked View-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get viewPos() {
        return this.#viewObject && this.#gotViewPos ? this.#viewPos : null;
    }
    /**
     * @private
     */
    set viewPos(value) {
        if (value) {
            this.#viewPos[0] = value[0];
            this.#viewPos[1] = value[1];
            this.#viewPos[2] = value[2];
            this.#gotViewPos = true;
        }
        else {
            this.#gotViewPos = false;
        }
    }
    /**
     * Normal vector at picked position on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get worldNormal() {
        return this.#viewObject !== null && this.#gotWorldNormal ? this.#worldNormal : null;
    }
    /**
     * @private
     */
    set worldNormal(value) {
        if (value) {
            this.#worldNormal[0] = value[0];
            this.#worldNormal[1] = value[1];
            this.#worldNormal[2] = value[2];
            this.#gotWorldNormal = true;
        }
        else {
            this.#gotWorldNormal = false;
        }
    }
    /**
     * UV coordinates at picked position on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get uv() {
        return this.#viewObject !== null && this.#gotUV ? this.#uv : null;
    }
    /**
     * @private
     */
    set uv(value) {
        if (value) {
            this.#uv[0] = value[0];
            this.#uv[1] = value[1];
            this.#gotUV = true;
        }
        else {
            this.#gotUV = false;
        }
    }
    /**
     * Returns `true` if picking has snapped to the canvas coordinates of the nearest vertex.
     * When this is `true`, then {@link PickResult.snappedCanvasPos} will contain the canvas coordinates of the nearest position on teh nearest vertex.
     */
    get snappedToVertex() {
        return this.#viewObject !== null && this.#snappedToVertex;
    }
    /**
     * @private
     */
    set snappedToVertex(value) {
        this.#snappedToVertex = value;
    }
    /**
     * Returns `true` if picking has snapped to the canvas coordinates of the nearest edge.
     * When this is `true`, then {@link PickResult.snappedCanvasPos} will contain the canvas coordinates of the nearest position on teh nearest edge.
     */
    get snappedToEdge() {
        return this.#viewObject !== null && this.#snappedToEdge;
    }
    set snappedToEdge(value) {
        this.#snappedToEdge = value;
    }
    /**
     * Snapped canvas coordinates when picking with a 2D pointer.
     * This has a value when {@link PickResult.snappedToEdge} or {@link PickResult.snappedToVertex} is `true`, otherwise will be `null`.
     */
    get snappedCanvasPos() {
        return this.#gotSnappedCanvasPos ? this.#snappedCanvasPos : undefined;
    }
    /**
     * @private
     */
    set snappedCanvasPos(value) {
        if (value) {
            this.#snappedCanvasPos[0] = value[0];
            this.#snappedCanvasPos[1] = value[1];
            this.#gotSnappedCanvasPos = true;
        }
        else {
            this.#gotSnappedCanvasPos = false;
        }
    }
    /**
     * @private
     */
    reset() {
        this.#viewObject = null;
        this.#gotCanvasPos = false;
        this.#gotSnappedCanvasPos = false;
        this.#gotOrigin = false;
        this.#gotDirection = false;
        this.#gotIndices = false;
        this.#gotLocalPos = false;
        this.#gotWorldPos = false;
        this.#gotViewPos = false;
        this.#gotWorldNormal = false;
        this.#gotUV = false;
        this.#snappedToVertex = false;
        this.#snappedToEdge = false;
    }
}
export { PickResult };
//# sourceMappingURL=PickResult.js.map