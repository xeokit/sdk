// import {Component} from "@xeokit/core";
// import {SceneObjectsKdTree3} from "@xeokit/kdtree3";
// import {View} from "@xeokit/viewer";
// import {createMat4, createVec2, frustumMat4} from "@xeokit/math";
// import {FloatArrayParam} from "@xeokit/math";
// import {createAABB2, Frustum3, setFrustum3} from "@xeokit/boundaries";
//
// /**
//  *
//  */
// export class MarqueePicker extends Component {
//
//     view: View;
//
//     #objectsKdTree3: SceneObjectsKdTree3;
//     #canvasMarqueeCorner1: FloatArrayParam;
//     #canvasMarqueeCorner2: FloatArrayParam;
//     #canvasMarquee: FloatArrayParam;
//     #marqueeFrustum: Frustum3;
//     #marqueeFrustumProjMat: FloatArrayParam;
//     #pickMode: number;
//     #marqueeElement: HTMLDivElement;
//     #marqueVisible: boolean;
//
//
//     static PICK_MODE_INSIDE: number;
//     static PICK_MODE_INTERSECTS: number;
//
//     constructor(cfg = {
//         view: View,
//         objectsKdTree3: SceneObjectsKdTree3
//     }) {
//
//         if (!cfg.view) {
//             throw "[MarqueePicker] Missing config: view";
//         }
//
//         if (!cfg.objectsKdTree3) {
//             throw "[MarqueePicker] Missing config: objectsKdTree3";
//         }
//
//         super(cfg.view, cfg);
//
//         this.view = cfg.view;
//         this.#objectsKdTree3 = cfg.objectsKdTree3;
//         this.#canvasMarqueeCorner1 = createVec2();
//         this.#canvasMarqueeCorner2 = createVec2();
//         this.#canvasMarquee = createAABB2();
//         this.#marqueeFrustum = new Frustum3();
//         this.#marqueeFrustumProjMat = createMat4();
//         this.#pickMode = MarqueePicker.PICK_MODE_INSIDE;
//
//         this.#marqueeElement = document.createElement('div');
//         document.body.appendChild(this.#marqueeElement);
//
//         this.#marqueeElement.style.position = "absolute";
//         this.#marqueeElement.style["z-tileIndex"] = "40000005";
//         this.#marqueeElement.style.width = 8 + "px";
//         this.#marqueeElement.style.height = 8 + "px";
//         this.#marqueeElement.style.visibility = "hidden";
//         this.#marqueeElement.style.top = 0 + "px";
//         this.#marqueeElement.style.left = 0 + "px";
//         this.#marqueeElement.style["box-shadow"] = "0 2px 5px 0 #182A3D;";
//         this.#marqueeElement.style["opacity"] = "1.0";
//         this.#marqueeElement.style["pointer-events"] = "none";
//     }
//
//     /**
//      * Sets the canvas-space position of the first marquee box corner.
//      *
//      * @param corner1
//      */
//     setMarqueeCorner1(corner1: FloatArrayParam) {
//         // @ts-ignore
//         this.#canvasMarqueeCorner1.set(corner1);
//         // @ts-ignore
//         this.#canvasMarqueeCorner2.set(corner1);
//         this.#updateMarquee();
//     }
//
//     /**
//      * Sets the canvas-space position of the second marquee box corner.
//      *
//      * @param corner2
//      */
//     setMarqueeCorner2(corner2: FloatArrayParam) {
//         // @ts-ignore
//         this.#canvasMarqueeCorner2.set(corner2);
//         this.#updateMarquee();
//     }
//
//     /**
//      * Sets both canvas-space corner positions of the marquee box.
//      *
//      * @param corner1
//      * @param corner2
//      */
//     setMarquee(corner1: FloatArrayParam, corner2: FloatArrayParam) {
//         // @ts-ignore
//         this.#canvasMarqueeCorner1.set(corner1);
//         // @ts-ignore
//         this.#canvasMarqueeCorner2.set(corner2);
//         this.#updateMarquee();
//     }
//
//     /**
//      * Sets if the marquee box is visible.
//      *
//      * @param {boolean} visible True if the marquee box is to be visible, else false.
//      */
//     setMarqueeVisible(visible: boolean) {
//         this.#marqueVisible = visible;
//         this.#marqueeElement.style.visibility = visible ? "visible" : "hidden";
//     }
//
//     /**
//      * Gets if the marquee box is visible.
//      *
//      * @returns {boolean} True if the marquee box is visible, else false.
//      */
//     getMarqueeVisible(): boolean {
//         return this.#marqueVisible;
//     }
//
//     /**
//      * Sets the pick mode.
//      *
//      * Supported pick modes are:
//      *
//      * * MarqueePicker.PICK_MODE_INSIDE - picks {@link viewer!ViewObject | ViewObjects} that are completely inside the marquee box.
//      * * MarqueePicker.PICK_MODE_INTERSECTS - picks {@link viewer!ViewObject | ViewObjects} that intersect the marquee box.
//      *
//      * @param {number} pickMode The pick mode.
//      */
//     setPickMode(pickMode: number): void {
//         if (pickMode !== MarqueePicker.PICK_MODE_INSIDE && pickMode !== MarqueePicker.PICK_MODE_INTERSECTS) {
//             throw "Illegal MarqueePicker pickMode: must be MarqueePicker.PICK_MODE_INSIDE or MarqueePicker.PICK_MODE_INTERSECTS";
//         }
//         if (pickMode !== this.#pickMode) {
//             this.#marqueeElement.style["background-image"] =
//                 pickMode === MarqueePicker.PICK_MODE_INSIDE
//                     /* Solid */ ? "url(\"data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='6' ry='6' stroke='%23333' stroke-width='4'/%3e%3c/svg%3e\")"
//                     /* Dashed */ : "url(\"data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='6' ry='6' stroke='%23333' stroke-width='4' stroke-dasharray='6%2c 14' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e\")";
//             this.#pickMode = pickMode;
//         }
//     }
//
//     /**
//      * Gets the pick mode.
//      *
//      * Supported pick modes are:
//      *
//      * * MarqueePicker.PICK_MODE_INSIDE - picks {@link viewer!ViewObject | ViewObjects} that are completely inside the marquee box.
//      * * MarqueePicker.PICK_MODE_INTERSECTS - picks {@link viewer!ViewObject | ViewObjects} that intersect the marquee box.
//      *
//      * @returns {number} The pick mode.
//      */
//     getPickMode() {
//         return this.#pickMode;
//     }
//
//     /**
//      * Fires a "clear" event on this MarqueePicker.
//      */
//     clear() {
//         this.fire("clear", {})
//     }
//
//     /**
//      * Attempts to pick {@link viewer!ViewObject | ViewObjects}, using the current MarquePicker settings.
//      *
//      * Fires a "picked" event with the IDs of the {@link viewer!ViewObject | ViewObjects} that were picked, if any.
//      *
//      * @returns {string[]} IDs of the {@link viewer!ViewObject | ViewObjects} that were picked, if any
//      */
//     pick(): string[] {
//         this.#updateMarquee();
//         this.#buildMarqueeFrustum();
//         const objectIds = [];
//         const visitNode = (node, intersects = Frustum.INTERSECT) => {
//             if (intersects === Frustum3.INTERSECT) {
//                 intersects = frustumIntersectsAABB3(this.#marqueeFrustum, node.aabb);
//             }
//             if (intersects === Frustum3.OUTSIDE) {
//                 return;
//             }
//             if (node.SceneObjects) {
//                 const SceneObjects = node.SceneObjects;
//                 for (let i = 0, len = SceneObjects.length; i < len; i++) {
//                     const object = SceneObjects[i];
//                     if (!object.visible) {
//                         continue;
//                     }
//                     const objectAABB = object.aabb;
//                     if (this.#pickMode === MarqueePicker.PICK_MODE_INSIDE) {
//                         // Select SceneObjects that are completely inside marquee
//                         const intersection = frustumIntersectsAABB3(this.#marqueeFrustum, objectAABB);
//                         if (intersection === Frustum.INSIDE) {
//                             objectIds.push(object.id);
//                         }
//                     } else {
//                         // Select SceneObjects that are partially inside marquee
//                         const intersection = frustumIntersectsAABB3(this.#marqueeFrustum, objectAABB);
//                         if (intersection !== Frustum.OUTSIDE) {
//                             objectIds.push(object.id);
//                         }
//                     }
//                 }
//             }
//             if (node.left) {
//                 visitNode(node.left, intersects);
//             }
//             if (node.right) {
//                 visitNode(node.right, intersects);
//             }
//         }
//         if (this.#canvasMarquee[2] - this.#canvasMarquee[0] > 3 || this.#canvasMarquee[3] - this.#canvasMarquee[1] > 3) { // Marquee pick if rectangle big enough
//             visitNode(this.#objectsKdTree3.root);
//         }
//         this.fire("picked", objectIds);
//         return objectIds;
//     }
//
//     #updateMarquee(): void {
//         this.#canvasMarquee[0] = Math.min(this.#canvasMarqueeCorner1[0], this.#canvasMarqueeCorner2[0]);
//         this.#canvasMarquee[1] = Math.min(this.#canvasMarqueeCorner1[1], this.#canvasMarqueeCorner2[1]);
//         this.#canvasMarquee[2] = Math.max(this.#canvasMarqueeCorner1[0], this.#canvasMarqueeCorner2[0]);
//         this.#canvasMarquee[3] = Math.max(this.#canvasMarqueeCorner1[1], this.#canvasMarqueeCorner2[1]);
//         this.#marqueeElement.style.width = `${this.#canvasMarquee[2] - this.#canvasMarquee[0]}px`;
//         this.#marqueeElement.style.height = `${this.#canvasMarquee[3] - this.#canvasMarquee[1]}px`;
//         this.#marqueeElement.style.left = `${this.#canvasMarquee[0]}px`;
//         this.#marqueeElement.style.top = `${this.#canvasMarquee[1]}px`;
//     }
//
//     #buildMarqueeFrustum(): void { // https://github.com/xeokit/xeokit-sdk/issues/869#issuecomment-1165375770
//         const canvas = this.view.htmlElement;
//         const canvasWidth = canvas.clientWidth;
//         const canvasHeight = canvas.clientHeight;
//         const canvasLeft = canvas.clientLeft;
//         const canvasTop = canvas.clientTop;
//         const xCanvasToClip = 2.0 / canvasWidth;
//         const yCanvasToClip = 2.0 / canvasHeight;
//         const NEAR_SCALING = 17;
//         const ratio = canvas.clientHeight / canvas.clientWidth;
//         const FAR_PLANE = 10000;
//         const left = (this.#canvasMarquee[0] - canvasLeft) * xCanvasToClip + -1;
//         const right = (this.#canvasMarquee[2] - canvasLeft) * xCanvasToClip + -1;
//         const bottom = -(this.#canvasMarquee[3] - canvasTop) * yCanvasToClip + 1;
//         const top = -(this.#canvasMarquee[1] - canvasTop) * yCanvasToClip + 1;
//         const near = this.view.camera.frustumProjection.near * (NEAR_SCALING * ratio);
//         const far = FAR_PLANE;
//         frustumMat4(
//             left,
//             right,
//             bottom * ratio,
//             top * ratio,
//             near,
//             far,
//             this.#marqueeFrustumProjMat,
//         );
//         setFrustum3(this.#marqueeFrustum, this.view.camera.viewMatrix, this.#marqueeFrustumProjMat);
//     }
//
//     /**
//      * Destroys this MarqueePicker.
//      *
//      * Does not destroy the {@link Viewer} or the {@link ObjectsKdTree3} provided to the constructor of this MarqueePicker.
//      */
//     destroy() {
//         super.destroy();
//         if (this.#marqueeElement.parentElement) {
//             this.#marqueeElement.parentElement.removeChild(this.#marqueeElement);
//             this.#marqueeElement = null;
//             this.#objectsKdTree3 = null;
//         }
//     }
// }
//
