import * as math from "../../../../math/index";
import type {FloatArrayParam} from "../../../../math/index";
import type {View} from "../../../View";
import type {CameraControl} from "../../CameraControl";

const tempVec3a = math.vec3();
const tempVec3b = math.vec3();
const tempVec3c = math.vec3();

const tempVec4a = math.vec4();
const tempVec4b = math.vec4();
const tempVec4c = math.vec4();

/**
 * @private
 */
class PivotController {

    #view: View;
    #configs: any;
    #pivotWorldPos: FloatArrayParam;
    #cameraOffset: FloatArrayParam;
    #azimuth: number;
    #polar: number;
    #radius: number;
    #pivotPosSet: boolean;
    #pivoting: boolean;
    #shown: boolean;
    #pivotViewPos: FloatArrayParam;
    #pivotProjPos: FloatArrayParam;
    #pivotCanvasPos: FloatArrayParam;
    #cameraDirty: boolean;
    #onViewMatrix: any;
    #onProjMatrix: any;
    #onTick: any;
    #hideTimeout: any;
    #pivotElement: any;

    /**
     * @private
     */
    constructor(cameraControl: CameraControl, configs: any) {

        this.#view = cameraControl.view;
        this.#configs = configs;
        this.#pivotWorldPos = math.vec3();
        this.#cameraOffset = math.vec3();
        this.#azimuth = 0;
        this.#polar = 0;
        this.#radius = 0;
        this.#pivotPosSet = false; // Initially false, true as soon as #pivotWorldPos has been set to some value
        this.#pivoting = false; // True while pivoting
        this.#shown = false;
        this.#pivotViewPos = math.vec4();
        this.#pivotProjPos = math.vec4();
        this.#pivotCanvasPos = math.vec2();
        this.#cameraDirty = true;

        this.#onViewMatrix = this.#view.camera.onViewMatrix.subscribe(() => {
            this.#cameraDirty = true;
        });

        this.#onProjMatrix = this.#view.camera.onProjMatrix.subscribe(() => {
            this.#cameraDirty = true;
        });

        this.#onTick = this.#view.viewer.onTick.subscribe(() => {
            this.updatePivotElement();
        });
    }

    updatePivotElement() {
        const camera = this.#view.camera;
        const canvas = this.#view.canvas;
        if (this.#pivoting && this.#cameraDirty) {
            math.transformPoint3(camera.viewMatrix, this.getPivotPos(), this.#pivotViewPos);
            this.#pivotViewPos[3] = 1;
            math.transformPoint4(camera.projMatrix, this.#pivotViewPos, this.#pivotProjPos);
            const canvasAABB = canvas.boundary;
            const canvasWidth = canvasAABB[2];
            const canvasHeight = canvasAABB[3];
            this.#pivotCanvasPos[0] = Math.floor((1 + this.#pivotProjPos[0] / this.#pivotProjPos[3]) * canvasWidth / 2);
            this.#pivotCanvasPos[1] = Math.floor((1 - this.#pivotProjPos[1] / this.#pivotProjPos[3]) * canvasHeight / 2);
            const canvasElem = canvas.canvas;
            const canvasBoundingRect = canvasElem.getBoundingClientRect();
            if (this.#pivotElement) {
                this.#pivotElement.style.left = (Math.floor(canvasBoundingRect.left + this.#pivotCanvasPos[0]) - (this.#pivotElement.clientWidth / 2) + window.scrollX) + "px";
                this.#pivotElement.style.top = (Math.floor(canvasBoundingRect.top + this.#pivotCanvasPos[1]) - (this.#pivotElement.clientHeight / 2) + window.scrollY) + "px";
            }
            this.#cameraDirty = false;
        }
    }

    /**
     * Sets the HTML DOM element that will represent the pivot position.
     *
     * @param pivotElement
     */
    setPivotElement(pivotElement: HTMLElement) {
        this.#pivotElement = pivotElement;
    }

    /**
     * Begins pivoting.
     */
    startPivot() {
        if (this.#cameraLookingDownwards()) {
            this.#pivoting = false;
            return false;
        }
        const camera = this.#view.camera;
        let lookat = math.lookAtMat4v(camera.eye, camera.look, camera.worldUp);
        math.transformPoint3(lookat, this.getPivotPos(), this.#cameraOffset);
        const pivotPos = this.getPivotPos();
        this.#cameraOffset[2] += math.distVec3(camera.eye, pivotPos);
        lookat = math.inverseMat4(lookat);
        const offset = math.transformVec3(lookat, this.#cameraOffset);
        const diff = math.vec3();
        math.subVec3(camera.eye, pivotPos, diff);
        math.addVec3(diff, offset);
        if (camera.zUp) {
            const t = diff[1];
            diff[1] = diff[2];
            diff[2] = t;
        }
        this.#radius = math.lenVec3(diff);
        this.#polar = Math.acos(diff[1] / this.#radius);
        this.#azimuth = Math.atan2(diff[0], diff[2]);
        this.#pivoting = true;
    }

    /**
     * Returns true if we are currently pivoting.
     *
     * @returns {boolean}
     */
    getPivoting(): boolean {
        return this.#pivoting;
    }

    /**
     * Sets a 3D World-space position to pivot about.
     *
     * @param worldPos The new World-space pivot position.
     */
    setPivotPos(worldPos: math.FloatArrayParam) {
        // @ts-ignore
        this.#pivotWorldPos.set(worldPos);
        this.#pivotPosSet = true;
    }

    /**
     * Sets the pivot position to the 3D projection of the given 2D canvas coordinates on a sphere centered
     * at the viewpoint. The radius of the sphere is configured via {@link CameraControl#smartPivot}.
     *
     * @param canvasPos
     */
    setCanvasPivotPos(canvasPos: math.FloatArrayParam) {
        const camera = this.#view.camera;
        const pivotShereRadius = Math.abs(math.distVec3(this.#view.viewer.scene.center, camera.eye));
        const transposedProjectMat = camera.project.transposedProjMatrix;
        // @ts-ignore
        const Pt3 = transposedProjectMat.subarray(8, 12);
        // @ts-ignore
        const Pt4 = transposedProjectMat.subarray(12);
        const D = [0, 0, -1.0, 1];
        const screenZ = math.dotVec4(D, Pt3) / math.dotVec4(D, Pt4);
        const worldPos = tempVec4a;
        camera.project.unproject(canvasPos, screenZ, tempVec4b, tempVec4c, worldPos);
        const eyeWorldPosVec = math.normalizeVec3(math.subVec3(worldPos, camera.eye, tempVec3a));
        const posOnSphere = math.addVec3(camera.eye, math.mulVec3Scalar(eyeWorldPosVec, pivotShereRadius, tempVec3b), tempVec3c);
        this.setPivotPos(posOnSphere);
    }

    /**
     * Gets the current position we're pivoting about.
     * @returns {Number[]} The current World-space pivot position.
     */
    getPivotPos() {
        return (this.#pivotPosSet) ? this.#pivotWorldPos : this.#view.camera.look; // Avoid pivoting about [0,0,0] by default
    }

    /**
     * Continues to pivot.
     *
     * @param yawInc Yaw rotation increment.
     * @param pitchInc Pitch rotation increment.
     */
    continuePivot(yawInc: number, pitchInc: number) {
        if (!this.#pivoting) {
            return;
        }
        if (yawInc === 0 && pitchInc === 0) {
            return;
        }
        const camera = this.#view.camera;
        let dx = -yawInc;
        const dy = -pitchInc;
        if (camera.worldUp[2] === 1) {
            dx = -dx;
        }
        this.#azimuth += -dx * .01;
        this.#polar += dy * .01;
        this.#polar = math.clamp(this.#polar, .001, Math.PI - .001);
        const pos = [
            this.#radius * Math.sin(this.#polar) * Math.sin(this.#azimuth),
            this.#radius * Math.cos(this.#polar),
            this.#radius * Math.sin(this.#polar) * Math.cos(this.#azimuth)
        ];
        if (camera.worldUp[2] === 1) {
            const t = pos[1];
            pos[1] = pos[2];
            pos[2] = t;
        }
        // Preserve the eye->look distance, since in xeokit "look" is the point-of-interest, not the direction vector.
        const eyeLookLen = math.lenVec3(math.subVec3(camera.look, camera.eye, math.vec3()));
        const pivotPos = this.getPivotPos();
        math.addVec3(pos, pivotPos);
        let lookat = math.lookAtMat4v(pos, pivotPos, camera.worldUp);
        lookat = math.inverseMat4(lookat);
        const offset = math.transformVec3(lookat, this.#cameraOffset);
        lookat[12] -= offset[0];
        lookat[13] -= offset[1];
        lookat[14] -= offset[2];
        const zAxis = [lookat[8], lookat[9], lookat[10]];
        camera.eye = [lookat[12], lookat[13], lookat[14]];
        math.subVec3(camera.eye, math.mulVec3Scalar(zAxis, eyeLookLen), camera.look);
        camera.up = [lookat[4], lookat[5], lookat[6]];
        this.showPivot();
    }

    /**
     * Shows the pivot position.
     *
     * Only works if we set an  HTML DOM element to represent the pivot position.
     */
    showPivot() {
        if (this.#shown) {
            return;
        }
        if (this.#hideTimeout !== null) {
            window.clearTimeout(this.#hideTimeout);
            this.#hideTimeout = null;
        }
        if (this.#pivotElement) {
            this.updatePivotElement();
            this.#pivotElement.style.visibility = "visible";
            this.#shown = true;
            this.#hideTimeout = window.setTimeout(() => {
                this.hidePivot();
            }, 1000);
        }
    }

    /**
     * Hides the pivot position.
     *
     * Only works if we set an  HTML DOM element to represent the pivot position.
     */
    hidePivot() {
        if (!this.#shown) {
            return;
        }
        if (this.#hideTimeout !== null) {
            window.clearTimeout(this.#hideTimeout);
            this.#hideTimeout = null;
        }
        if (this.#pivotElement) {
            this.#pivotElement.style.visibility = "hidden";
        }
        this.#shown = false;
    }

    /**
     * Finishes pivoting.
     */
    endPivot() {
        this.#pivoting = false;
    }

    destroy() {
        this.#view.camera.onViewMatrix.unsubscribe(this.#onViewMatrix);
        this.#view.camera.onProjMatrix.unsubscribe(this.#onProjMatrix);
        this.#view.viewer.onTick.unsubscribe(this.#onTick);
    }

    #cameraLookingDownwards() { // Returns true if angle between camera viewing direction and World-space "up" axis is too small
        const camera = this.#view.camera;
        const forwardAxis = math.normalizeVec3(math.subVec3(camera.look, camera.eye, tempVec3a));
        const rightAxis = math.cross3Vec3(forwardAxis, camera.worldUp, tempVec3b);
        let rightAxisLen = math.sqLenVec3(rightAxis);
        return (rightAxisLen <= 0.0001);
    }
}

export {PivotController};