import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";
import { createLandscapeSource, GEOM_BOX, GEOM_SLAB, GEOM_CYLINDER, GEOM_DOME } from "./landscape-source.js";
const { paintGranite } = xeokit.model.generation.paintMaterials;
const SLOT_COUNT = 1600;
const WINDOW_W = 320;
const WINDOW_H = 320;
const studio = new xeokit.studio.Studio({});
studio.init().then(async () => {
    const { scene } = studio;
    const sceneModel = mustCreate(scene.createModel({
        id: "infiniteLandscape",
        updateHint: "dynamic",
        coordinateSystem: {
            basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
            origin: [0, 0, 0],
            units: "meters",
            scaleToMeters: 1
        }
    }));
    const pushGeom = (id, g) => sceneModel.createGeometry({
        id,
        primitive: xeokit.base.constants.TrianglesPrimitive,
        positions: g.positions,
        normals: g.normals,
        indices: g.indices
    });
    pushGeom("box", mustBuild(xeokit.model.generation.buildGeometry.buildBox({ xSize: 1, ySize: 1, zSize: 1 })));
    const cylRaw = mustBuild(xeokit.model.generation.buildGeometry.buildCylinder({
        radiusTop: 0.5,
        radiusBottom: 0.5,
        height: 1,
        radialSegments: 24
    }));
    const cylPositions = new Float32Array(cylRaw.positions);
    const cylNormals = new Float32Array(cylRaw.normals);
    rotateXBy90(cylPositions);
    rotateXBy90(cylNormals);
    sceneModel.createGeometry({
        id: "cyl",
        primitive: xeokit.base.constants.TrianglesPrimitive,
        positions: cylPositions,
        normals: cylNormals,
        indices: cylRaw.indices
    });
    pushGeom("dome", mustBuild(xeokit.model.generation.buildGeometry.buildSphere({
        radius: 0.5,
        widthSegments: 24,
        heightSegments: 16
    })));
    const GEOM_TO_GEOMETRY_ID = {
        [GEOM_BOX]: "box",
        [GEOM_SLAB]: "box",
        [GEOM_CYLINDER]: "cyl",
        [GEOM_DOME]: "dome"
    };
    const ALL_GEOM_TYPES = [GEOM_BOX, GEOM_SLAB, GEOM_CYLINDER, GEOM_DOME];
    mustCreate(sceneModel.createMaterial({
        id: "FLOOR",
        color: [0.2, 0.22, 0.22],
        roughness: 1,
        metallic: 0
    }));
    const STONE_TEX_SIZE = 512;
    const stoneMaps = paintGranite(STONE_TEX_SIZE);
    mustCreate(sceneModel.createTexture({
        id: "tex_stone_color",
        imageData: stoneMaps.color,
        encoding: xeokit.base.constants.sRGBEncoding,
        minFilter: xeokit.base.constants.LinearFilter,
        mipmap: true,
        flipY: false
    }));
    mustCreate(sceneModel.createTexture({
        id: "tex_stone_normal",
        imageData: stoneMaps.normal,
        encoding: xeokit.base.constants.LinearEncoding,
        minFilter: xeokit.base.constants.LinearFilter,
        mipmap: true,
        flipY: false
    }));
    mustCreate(sceneModel.createTexture({
        id: "tex_stone_mr",
        imageData: stoneMaps.mr,
        encoding: xeokit.base.constants.LinearEncoding,
        minFilter: xeokit.base.constants.LinearFilter,
        mipmap: true,
        flipY: false
    }));
    mustCreate(sceneModel.createMaterial({
        id: "STONE",
        color: [1, 1, 1],
        roughness: 1,
        metallic: 0,
        colorTextureId: "tex_stone_color",
        normalsTextureId: "tex_stone_normal",
        metallicRoughnessTextureId: "tex_stone_mr"
    }));
    const FLOOR_SIZE = WINDOW_W * 6;
    sceneModel.createMesh({
        id: "floorMesh",
        geometryId: "box",
        materialId: "FLOOR",
        matrix: xeokit.model.scene.buildMat4({
            position: [0, 0, -2.5],
            scale: [FLOOR_SIZE, FLOOR_SIZE, 5]
        })
    });
    sceneModel.createObject({ id: "floor", meshIds: ["floorMesh"] });
    const floorMesh = sceneModel.meshes["floorMesh"];
    const PARK_MATRIX = xeokit.model.scene.buildMat4({
        position: [0, 0, -1e4],
        scale: [1e-4, 1e-4, 1e-4]
    });
    const activeGeomBySlot = new Int8Array(SLOT_COUNT);
    for (let i = 0; i < SLOT_COUNT; i++)
        activeGeomBySlot[i] = -1;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const meshIds = [];
        for (const gt of ALL_GEOM_TYPES) {
            const meshId = `s${slot}_g${gt}`;
            const useStone = gt === GEOM_BOX || gt === GEOM_SLAB;
            sceneModel.createMesh({
                id: meshId,
                geometryId: GEOM_TO_GEOMETRY_ID[gt],
                matrix: PARK_MATRIX,
                color: initialSlotColor(slot, gt),
                ...useStone ? { materialId: "STONE" } : {}
            });
            meshIds.push(meshId);
        }
        sceneModel.createObject({ id: `slot_${slot}`, meshIds });
    }
    const view = studio.viewManager.createView({
        camera: {
            eye: [0, -110, 95],
            look: [0, 5, 6],
            up: [0, 0, 1]
        },
        effects: {
            tonemap: { sRGBEncode: true },
            sky: { enabled: false }
        }
    });
    view.effects.sao.enabled = true;
    view.effects.sao.intensity = 0.2;
    view.effects.sao.kernelRadius = 50;
    view.effects.shadows.enabled = true;
    view.effects.shadows.intensity = 0.55;
    view.effects.shadows.cascadeCount = 3;
    view.effects.shadows.pcfKernelSize = 3;
    view.effects.shadows.resolution = 2048;
    view.effects.shadows.direction = [-0.45, -0.35, -0.85];
    view.lights.ibl.intensity = 0.9;
    view.lights.hemispheric.skyColor = [0.78, 0.84, 0.95];
    view.lights.hemispheric.groundColor = [0.5, 0.42, 0.34];
    view.lights.hemispheric.worldUp = [0, 0, 1];
    view.lights.ibl.enabled = true;
    view.effects.tonemap.mode = "aces";
    view.effects.edges.enabled = false;
    let flyActive = false;
    let spaceHeld = false;
    let flySpeed = 3;
    window.addEventListener("keydown", (ev) => {
        if (ev.code === "Space" && !spaceHeld) {
            spaceHeld = true;
            ev.preventDefault();
        }
    });
    window.addEventListener("keyup", (ev) => {
        if (ev.code === "Space")
            spaceHeld = false;
    });
    const source = createLandscapeSource({
        slotCount: SLOT_COUNT,
        windowWidth: WINDOW_W,
        windowHeight: WINDOW_H,
        seed: 42
    });
    new xeokit.base.core.SDKTask({
        name: "Infinite landscape \u2014 apply instruction stream",
        repeat: true,
        stage: xeokit.base.core.SDKTask.CollectInputStage,
        task: () => {
            if ((flyActive || spaceHeld) && flySpeed > 0) {
                const cam = view.camera;
                const e = cam.eye;
                const l = cam.look;
                let fx = l[0] - e[0];
                let fy = l[1] - e[1];
                const flen = Math.hypot(fx, fy);
                if (flen > 1e-6) {
                    fx = fx / flen * flySpeed;
                    fy = fy / flen * flySpeed;
                    cam.eye = [e[0] + fx, e[1] + fy, e[2]];
                    cam.look = [l[0] + fx, l[1] + fy, l[2]];
                }
            }
            const eye = view.camera.eye;
            const cx = eye[0], cy = eye[1];
            floorMesh.matrix = xeokit.model.scene.buildMat4({
                position: [cx, cy, -2.5],
                scale: [FLOOR_SIZE, FLOOR_SIZE, 5]
            });
            const instructions = source.nextFrame(cx, cy);
            for (let k = 0; k < instructions.length; k++) {
                const ins = instructions[k];
                const previous = activeGeomBySlot[ins.slotId];
                if (ins.hidden) {
                    if (previous !== -1) {
                        const old = sceneModel.meshes[`s${ins.slotId}_g${previous}`];
                        if (old)
                            old.matrix = PARK_MATRIX;
                        activeGeomBySlot[ins.slotId] = -1;
                    }
                    continue;
                }
                const desired = ins.geomType;
                if (previous !== desired && previous !== -1) {
                    const old = sceneModel.meshes[`s${ins.slotId}_g${previous}`];
                    if (old)
                        old.matrix = PARK_MATRIX;
                }
                const mesh = sceneModel.meshes[`s${ins.slotId}_g${desired}`];
                if (!mesh)
                    continue;
                mesh.matrix = xeokit.model.scene.buildMat4({
                    position: ins.position,
                    scale: ins.scale,
                    rotation: ins.rotation
                });
                mesh.color = ins.color;
                if (ins.opacity < 1) {
                    const vobj = view.objects[`slot_${ins.slotId}`];
                    if (vobj)
                        vobj.opacity = ins.opacity;
                }
                activeGeomBySlot[ins.slotId] = desired;
            }
        }
    });
    const info = await studio.openInfoPanelFromMeta();
    info.addToggle({
        label: "Fly forward",
        value: flyActive,
        onChange: (on) => {
            flyActive = on;
        }
    });
    info.addSlider({
        label: "Speed (m/frame)",
        min: 0,
        max: 10,
        step: 0.1,
        value: flySpeed,
        digits: 1,
        onChange: (v) => {
            flySpeed = v;
        }
    });
    studio.finished();
});
function rotateXBy90(arr) {
    for (let i = 0; i < arr.length; i += 3) {
        const y = arr[i + 1];
        const z = arr[i + 2];
        arr[i + 1] = -z;
        arr[i + 2] = y;
    }
}
function mustCreate(result) {
    if (!result.ok)
        throw new Error(result.error);
    return result.value;
}
function initialSlotColor(slot, geomType) {
    const tag = slot * 73856093 ^ geomType * 19349663 ^ 12648430;
    const h = (Math.sin(tag * 91.117) * 47453.5453 % 1 + 1) % 1;
    const s = 0.7;
    const l = 0.5;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h * 6;
    const x = c * (1 - Math.abs(hp % 2 - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1) {
        r = c;
        g = x;
    }
    else if (hp < 2) {
        r = x;
        g = c;
    }
    else if (hp < 3) {
        g = c;
        b = x;
    }
    else if (hp < 4) {
        g = x;
        b = c;
    }
    else if (hp < 5) {
        r = x;
        b = c;
    }
    else {
        r = c;
        b = x;
    }
    const m = l - c / 2;
    return [r + m, g + m, b + m];
}
function mustBuild(result) {
    if (!result.ok)
        throw new Error(result.error);
    return result.value;
}
