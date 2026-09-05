import {LinearEncoding, sRGBEncoding, TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {buildSphere, buildVectorText} from "@xeokit/sdk/model/generation/buildGeometry";
import {paintBrick} from "@xeokit/sdk/model/generation/paintMaterials";
import {buildMat4, Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, mustElement, mustOk, signalExampleLoaded, toNavigationPick} from "../../../utils/standaloneRuntime.js";

main().catch((error) => failExample("view/texture-matrix/render-paths", error));

async function main() {
  // This example uses generated assets only, so the Scene's default coordinate
  // system is the authored coordinate system: +Z up, meters.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "textureMatrixRenderPathsView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.95, 0.95, 0.97],
    texturing: {enabled: true},
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [16, -10, 10],
      look: [4.5, 4.5, 4.5],
      up: [0, 0, 1]
    },
    effects: {
      sao: {enabled: true, intensity: 0.08, scale: 0.9},
      tonemap: {enabled: true, mode: "aces", sRGBEncode: true},
      antiAliasing: {enabled: true, mode: "smaa"}
    }
  }));
  const renderer = await createRenderer(viewer);

  // Add simple direct lighting so differences between normals, UVs and textures
  // are visible without requiring an HDR environment.
  view.clearLights();
  new AmbientLight(view, {color: [1, 1, 1], intensity: 0.22});
  new DirLight(view, {dir: [-0.45, -0.65, -0.62], color: [1, 0.96, 0.9], intensity: 1.35, space: "world"});

  // Navigation uses renderer picking; this is unrelated to the texture matrix but
  // keeps the example interactive for inspecting shader-path differences.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    },
    followPointer: true
  });

  // One SceneModel holds the whole matrix. Each row changes geometry attributes;
  // each column changes material or sampler state.
  const sceneModel = mustOk(scene.createModel({id: "matrixModel", updateHint: "static"}));
  createGeometryVariants(sceneModel);
  createTextureVariants(sceneModel);
  createMaterialVariants(sceneModel);
  createMatrixObjects(sceneModel);

  signalExampleLoaded();
  window.textureMatrixRenderPathsExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") {
    return new WebGLRenderer({viewer, logging: false});
  }
  const result = await WebGPURenderer.create({viewer, logging: false});
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function createGeometryVariants(sceneModel) {
  // The generator returns positions, normals, UVs and indices. Stripping normals
  // or UVs lets the renderer exercise flat-shaded and triplanar fallback paths.
  const sphere = mustOk(buildSphere({radius: 1, widthSegments: 32, heightSegments: 32}));
  mustOk(sceneModel.createGeometry({id: "sphere_NU", primitive: TrianglesPrimitive, positions: sphere.positions, normals: sphere.normals, uvs: sphere.uv, indices: sphere.indices}));
  mustOk(sceneModel.createGeometry({id: "sphere_N", primitive: TrianglesPrimitive, positions: sphere.positions, normals: sphere.normals, indices: sphere.indices}));
  mustOk(sceneModel.createGeometry({id: "sphere_U", primitive: TrianglesPrimitive, positions: sphere.positions, uvs: sphere.uv, indices: sphere.indices}));
  mustOk(sceneModel.createGeometry({id: "sphere_0", primitive: TrianglesPrimitive, positions: sphere.positions, indices: sphere.indices}));
}

function createTextureVariants(sceneModel) {
  // The same brick pixels are uploaded twice so only the mipmap flag changes.
  const brick = paintBrick(256);
  for (const [suffix, mipmap] of [["nomip", false], ["mip", true]]) {
    mustOk(sceneModel.createTexture({id: `tex_color_${suffix}`, imageData: brick.color, encoding: sRGBEncoding, mipmap}));
    mustOk(sceneModel.createTexture({id: `tex_normal_${suffix}`, imageData: brick.normal, encoding: LinearEncoding, mipmap}));
    mustOk(sceneModel.createTexture({id: `tex_mr_${suffix}`, imageData: brick.mr, encoding: LinearEncoding, mipmap}));
  }
}

function createMaterialVariants(sceneModel) {
  // Column 0 is untextured. Columns 1-3 progressively change sampler and
  // triplanar settings while reusing the same authored texture pixels.
  mustOk(sceneModel.createMaterial({id: "mat_plain", color: [0.85, 0.55, 0.45], roughness: 0.7, metallic: 0}));
  mustOk(sceneModel.createMaterial({id: "mat_brick_nomip", color: [1, 1, 1], roughness: 0.7, metallic: 0, colorTextureId: "tex_color_nomip", normalsTextureId: "tex_normal_nomip", metallicRoughnessTextureId: "tex_mr_nomip", triplanarScale: 1}));
  mustOk(sceneModel.createMaterial({id: "mat_brick_mip", color: [1, 1, 1], roughness: 0.7, metallic: 0, colorTextureId: "tex_color_mip", normalsTextureId: "tex_normal_mip", metallicRoughnessTextureId: "tex_mr_mip", triplanarScale: 1}));
  mustOk(sceneModel.createMaterial({id: "mat_brick_mip_tri4", color: [1, 1, 1], roughness: 0.7, metallic: 0, colorTextureId: "tex_color_mip", normalsTextureId: "tex_normal_mip", metallicRoughnessTextureId: "tex_mr_mip", triplanarScale: 4}));
  mustOk(sceneModel.createMaterial({id: "mat_label", color: [0.1, 0.12, 0.18], roughness: 1, metallic: 0}));
}

function createMatrixObjects(sceneModel) {
  const geomByRow = ["sphere_NU", "sphere_N", "sphere_U", "sphere_0"];
  const matByCol = ["mat_plain", "mat_brick_nomip", "mat_brick_mip", "mat_brick_mip_tri4"];
  const rowLabels = ["N+UV", "N", "UV", "flat"];
  const colLabels = ["untex", "nomip", "mip", "mip-tri4"];
  const spacing = 3;
  let nextId = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * spacing;
      const y = row * spacing;
      mustOk(sceneModel.createMesh({
        id: `m${nextId}`,
        geometryId: geomByRow[row],
        materialId: matByCol[col],
        matrix: buildMat4({position: [x, y, 1.2], scale: [1, 1, 1]})
      }));
      mustOk(sceneModel.createObject({id: `o${nextId}`, meshIds: [`m${nextId}`]}));

      // Vector text is scene geometry, so labels move with the model and render
      // through the same draw list as other line primitives.
      const label = mustOk(buildVectorText({
        origin: [x - 0.7, y - 1.45, 0.005],
        size: 0.3,
        text: `${rowLabels[row]}\n${colLabels[col]}`
      }));
      mustOk(sceneModel.createGeometry({id: `lbl_g_${nextId}`, primitive: label.primitive, positions: label.positions, indices: label.indices}));
      mustOk(sceneModel.createMesh({id: `lbl_m_${nextId}`, geometryId: `lbl_g_${nextId}`, materialId: "mat_label"}));
      mustOk(sceneModel.createObject({id: `lbl_o_${nextId}`, meshIds: [`lbl_m_${nextId}`]}));
      nextId++;
    }
  }
}

