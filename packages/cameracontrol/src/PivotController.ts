
import {View} from "@xeokit/viewer";
import {
    addVec3,
    compareVec3,
    createMat4,
    createVec2,
    createVec3,
    createVec4,
    cross3Vec3,
    decomposeMat4, distVec3, dotVec4,
    inverseMat4, lenVec3, lookAtMat4v, mulVec3Scalar, normalizeVec3, sqLenVec3, subVec3,
    transformPoint3, transformPoint4, transformVec3
} from "@xeokit/matrix";
import {clamp, FloatArrayParam} from "@xeokit/math";
import {worldToRTCPos} from "@xeokit/rtc";

const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();

const tempVec4a = createVec4();
const tempVec4b = createVec4();
const tempVec4c = createVec4();


/** @private */
class PivotController {
    #view: View;
    #configs: any;
    #pivotWorldPos: Float64Array;
    #cameraOffset: Float64Array;
    #azimuth: number;
    #polar: number;
    #radius: number;
    #pivotPosSet: boolean;
    #pivoting: boolean;
    #shown: boolean;
    #pivotSphereEnabled: boolean;
    #pivotSphere: any;
    #pivotSphereSize: number;
    #pivotSphereGeometry: any;
    #pivotSphereMaterial: any;
    #rtcCenter: Float64Array;
    #rtcPos: Float64Array;
    #pivotViewPos: any;
    #pivotProjPos: any;
    #pivotCanvasPos: any;
    #cameraDirty: boolean;
    #onViewMatrix: any;
    #onProjMatrix: () => void;
    #onTick: () => void;
    #pivotElement: any;

    /**
     * @private
     */
    constructor(view: View, configs) {

        // Pivot math by: http://www.derschmale.com/

        this.#view = view;
        this.#configs = configs;
        this.#pivotWorldPos = createVec3();
        this.#cameraOffset = createVec3();
        this.#azimuth = 0;
        this.#polar = 0;
        this.#radius = 0;
        this.#pivotPosSet = false; // Initially false, true as soon as #pivotWorldPos has been set to some value
        this.#pivoting = false; // True while pivoting
        this.#shown = false;

        this.#pivotSphereEnabled = false;
        this.#pivotSphere = null;
        this.#pivotSphereSize = 1;
        this.#pivotSphereGeometry = null;
        this.#pivotSphereMaterial = null;
        this.#rtcCenter = createVec3();
        this.#rtcPos = createVec3();

        this.#pivotViewPos = createVec4();
        this.#pivotProjPos = createVec4();
        this.#pivotCanvasPos = createVec2();
        this.#cameraDirty = true;

        this.#onViewMatrix = this.#view.camera.onViewMatrix.sub(() => {
            this.#cameraDirty = true;
        });

        this.#onProjMatrix = this.#view.camera.onProjMatrix.sub(() => {
            this.#cameraDirty = true;
        });

        this.#onTick = this.#view.viewer.onTick.sub(() => {
            this.updatePivotElement();
            this.updatePivotSphere();
        });
    }

    createPivotSphere() {
        // const currentPos = this.getPivotPos();
        // const cameraPos = createVec3();
        // decomposeMat4(inverseMat4(this.#view.camera.viewMatrix, createMat4()), cameraPos, createVec4(), createVec3());
        // const length = distVec3(cameraPos, currentPos);
        // let radius = (Math.tan(Math.PI / 500) * length) * this.#pivotSphereSize;
        //
        // if (this.#view.camera.projectionType == OrthoProjectionType) {
        //     radius /= (this.#view.camera.orthoProjection.scale / 2);
        // }
        //
        // worldToRTCPos(currentPos, this.#rtcCenter, this.#rtcPos);
        // this.#pivotSphereGeometry = new VBOGeometry(
        //     this.#view,
        //     buildSphereGeometry({ radius })
        // );
        // this.#pivotSphere = new Mesh(this.#view, {
        //     geometry: this.#pivotSphereGeometry,
        //     material: this.#pivotSphereMaterial,
        //     pickable: false,
        //     position: this.#rtcPos,
        //     rtcCenter: this.#rtcCenter
        // });
    };

    destroyPivotSphere() {
        if (this.#pivotSphere) {
            this.#pivotSphere.destroy();
            this.#pivotSphere = null;
        }
        if (this.#pivotSphereGeometry) {
            this.#pivotSphereGeometry.destroy();
            this.#pivotSphereGeometry = null;
        }
    }

    updatePivotElement() {

        // const camera = this.#view.camera;
        // const htmlElement = this.#view.htmlElement;
        //
        // if (this.#pivoting && this.#cameraDirty) {
        //
        //     transformPoint3(camera.viewMatrix, this.getPivotPos(), this.#pivotViewPos);
        //     this.#pivotViewPos[3] = 1;
        //     transformPoint4(camera.projMatrix, this.#pivotViewPos, this.#pivotProjPos);
        //
        //     const canvasAABB = this.#view.boundary;
        //     const canvasWidth = canvasAABB[2];
        //     const canvasHeight = canvasAABB[3];
        //
        //     this.#pivotCanvasPos[0] = Math.floor((1 + this.#pivotProjPos[0] / this.#pivotProjPos[3]) * canvasWidth / 2);
        //     this.#pivotCanvasPos[1] = Math.floor((1 - this.#pivotProjPos[1] / this.#pivotProjPos[3]) * canvasHeight / 2);
        //
        //     // data-textures: avoid to do continuous DOM layout calculations
        //     let canvasBoundingRect = htmlElement.#lastBoundingClientRect;
        //     if (!canvasBoundingRect || htmlElement.#canvasSizeChanged) {
        //         canvasBoundingRect = htmlElement.#lastBoundingClientRect = htmlElement.getBoundingClientRect ();
        //     }
        //
        //     if (this.#pivotElement) {
        //         this.#pivotElement.style.left = (Math.floor(canvasBoundingRect.left + this.#pivotCanvasPos[0]) - (this.#pivotElement.clientWidth / 2) + window.scrollX) + "px";
        //         this.#pivotElement.style.top = (Math.floor(canvasBoundingRect.top + this.#pivotCanvasPos[1]) - (this.#pivotElement.clientHeight / 2) + window.scrollY) + "px";
        //     }
        //     this.#cameraDirty = false;
        // }
    }

    updatePivotSphere() {
        if (this.#pivoting && this.#pivotSphere) {
            worldToRTCPos(this.getPivotPos(), this.#rtcCenter, this.#rtcPos);
            if(!compareVec3(this.#rtcPos, this.#pivotSphere.position)) {
                this.destroyPivotSphere();
                this.createPivotSphere();
            }
        }
    }
    /**
     * Sets the HTML DOM element that will represent the pivot position.
     *
     * @param pivotElement
     */
    setPivotElement(pivotElement) {
        this.#pivotElement = pivotElement;
    }

    /**
     * Sets a sphere as the representation of the pivot position.
     *
     * @param {Object} [cfg] Sphere configuration.
     * @param {String} [cfg.size=1] Optional size factor of the sphere. Defaults to 1.
     * @param {String} [cfg.color=Array] Optional maretial color. Defaults to a red.
     */
    enablePivotSphere(cfg = {
        size: 0,
        color: [1,1,1]
    }) {
        // this.destroyPivotSphere();
        // this.#pivotSphereEnabled = true;
        // if (cfg.size) {
        //     this.#pivotSphereSize = cfg.size;
        // }
        // const color = cfg.color || [1, 0, 0];
        // this.#pivotSphereMaterial = new PhongMaterial(this.#view, {
        //     emissive: color,
        //     ambient: color,
        //     specular: [0,0,0],
        //     diffuse: [0,0,0],
        // });
    }

    /**
     * Remove the sphere as the representation of the pivot position.
     *
     */
    disablePivotSphere() {
        this.destroyPivotSphere();
        this.#pivotSphereEnabled = false;
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

        let lookat = lookAtMat4v(camera.eye, camera.look, camera.worldUp);
        transformPoint3(lookat, this.getPivotPos(), this.#cameraOffset);

        const pivotPos = this.getPivotPos();
        this.#cameraOffset[2] += distVec3(camera.eye, pivotPos);

        lookat = inverseMat4(lookat);

        const offset = transformVec3(lookat, this.#cameraOffset);
        const diff = createVec3();

        subVec3(camera.eye, pivotPos, diff);
        addVec3(diff, offset);

        if (camera.zUp) {
            const t = diff[1];
            diff[1] = diff[2];
            diff[2] = t;
        }

        this.#radius = lenVec3(diff);
        this.#polar = Math.acos(diff[1] / this.#radius);
        this.#azimuth = Math.atan2(diff[0], diff[2]);
        this.#pivoting = true;
    }

    #cameraLookingDownwards() { // Returns true if angle between camera viewing direction and World-space "up" axis is too small
        const camera = this.#view.camera;
        const forwardAxis = normalizeVec3(subVec3(camera.look, camera.eye, tempVec3a));
        const rightAxis = cross3Vec3(forwardAxis, camera.worldUp, tempVec3b);
        let rightAxisLen = sqLenVec3(rightAxis);
        return (rightAxisLen <= 0.0001);
    }

    /**
     * Returns true if we are currently pivoting.
     *
     * @returns {Boolean}
     */
    getPivoting() {
        return this.#pivoting;
    }

    /**
     * Sets a 3D World-space position to pivot about.
     *
     * @param {Number[]} worldPos The new World-space pivot position.
     */
    setPivotPos(worldPos) {
        this.#pivotWorldPos.set(worldPos);
        this.#pivotPosSet = true;
    }

    /**
     * Sets the pivot position to the 3D projection of the given 2D canvas coordinates on a sphere centered
     * at the viewpoint. The radius of the sphere is configured via {@link CameraControl#smartPivot}.
     *
     *
     * @param canvasPos
     */
    setCanvasPivotPos(canvasPos) {
        const camera = this.#view.camera;
        const pivotShereRadius = Math.abs(distVec3(this.#view.viewer.scene.center, camera.eye));
        const transposedProjectMat = camera.projection.transposedProjMatrix;
        // @ts-ignore
        const Pt3 = transposedProjectMat.subarray(8, 12);
        // @ts-ignore
        const Pt4 = transposedProjectMat.subarray(12);
        const D = [0, 0, -1.0, 1];
        const screenZ = dotVec4(D, Pt3) / dotVec4(D, Pt4);
        const worldPos = tempVec4a;
        camera.projection.unproject(canvasPos, screenZ, tempVec4b, tempVec4c, worldPos);
        const eyeWorldPosVec = normalizeVec3(subVec3(worldPos, camera.eye, tempVec3a));
        const posOnSphere = addVec3(camera.eye, mulVec3Scalar(eyeWorldPosVec, pivotShereRadius, tempVec3b), tempVec3c);
        this.setPivotPos(posOnSphere);
    }

    /**
     * Gets the current position we're pivoting about.
     * @returns {Number[]} The current World-space pivot position.
     */
    getPivotPos():FloatArrayParam {
        return (this.#pivotPosSet) ? this.#pivotWorldPos : this.#view.camera.look; // Avoid pivoting about [0,0,0] by default
    }

    /**
     * Continues to pivot.
     *
     * @param {Number} yawInc Yaw rotation increment.
     * @param {Number} pitchInc Pitch rotation increment.
     */
    continuePivot(yawInc, pitchInc) {
        if (!this.#pivoting) {
            return;
        }
        if (yawInc === 0 && pitchInc === 0) {
            return;
        }
        const camera = this.#view.camera;
        var dx = -yawInc;
        const dy = -pitchInc;
        if (camera.worldUp[2] === 1) {
            dx = -dx;
        }
        this.#azimuth += -dx * .01;
        this.#polar += dy * .01;
        this.#polar = clamp(this.#polar, .001, Math.PI - .001);
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
        const eyeLookLen = lenVec3(subVec3(camera.look, camera.eye, createVec3()));
        const pivotPos = this.getPivotPos();
        addVec3(pos, pivotPos);
        let lookat = lookAtMat4v(pos, pivotPos, camera.worldUp);
        lookat = inverseMat4(lookat);
        const offset = transformVec3(lookat, this.#cameraOffset);
        lookat[12] -= offset[0];
        lookat[13] -= offset[1];
        lookat[14] -= offset[2];
        const zAxis = [lookat[8], lookat[9], lookat[10]];
        camera.eye = [lookat[12], lookat[13], lookat[14]];
        subVec3(camera.eye, mulVec3Scalar(zAxis, eyeLookLen), camera.look);
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
        if (this.#pivotElement) {
            this.updatePivotElement();
            this.#pivotElement.style.visibility = "visible";
        }
        if (this.#pivotSphereEnabled) {
            this.destroyPivotSphere();
            this.createPivotSphere();
        }
        this.#shown = true;
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
        if (this.#pivotElement) {
            this.#pivotElement.style.visibility = "hidden";
        }
        if (this.#pivotSphereEnabled) {
            this.destroyPivotSphere();
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
        this.destroyPivotSphere();
        this.#view.camera.onViewMatrix.unsub(this.#onViewMatrix);
        this.#view.camera.onProjMatrix.unsub(this.#onProjMatrix);
        this.#view.viewer.onTick.unsub(this.#onTick);
    }
}


export {PivotController};
