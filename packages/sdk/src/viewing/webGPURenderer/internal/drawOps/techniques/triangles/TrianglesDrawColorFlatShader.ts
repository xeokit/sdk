import {TRIANGLE_POSITION_DECODE_WGSL, TRIANGLE_RTC_TILE_WGSL} from "./TrianglePositionPacking";
import {
  triangleLogDepthFragmentOutputStruct,
  triangleLogDepthReturn,
  triangleLogDepthReturnType,
  triangleLogDepthVertexField,
  triangleLogDepthVertexWrite
} from "./TriangleLogDepth";

/**
 * WGSL shader for flat, unlit triangle overlay rendering.
 *
 * @internal
 */
export function createTrianglesDrawColorFlatShader(logDepth = false): string {
  return `
struct FrameUniforms {
  viewProjection: mat4x4<f32>,
  ambientLight: vec4<f32>,
  dirLightDirections: array<vec4<f32>, 3>,
  dirLightColors: array<vec4<f32>, 3>,
  sectionPlaneState: vec4<f32>,
  sectionPlanes: array<vec4<f32>, 8>,
  sectionPlaneCapColors: array<vec4<f32>, 8>,
  depthParams: vec4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct MeshInstance {
  modelMatrix: mat4x4<f32>,
  color: vec4<f32>,
  flags: vec4<f32>,
};

@group(1) @binding(0) var<storage, read> instances: array<MeshInstance>;

${TRIANGLE_POSITION_DECODE_WGSL}
${TRIANGLE_RTC_TILE_WGSL}

struct VertexInput {
  @location(0) packedPosition: vec4<f32>,
  @location(1) vertexMetadata: vec2<u32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
${triangleLogDepthVertexField(logDepth, 1)}
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let instance = instances[input.vertexMetadata.x];
  let rtcTile = getInstanceRTCTile(instance);
  let localPosition = decodePackedPosition(input.packedPosition, input.vertexMetadata.y);
  let rtcWorldPos = instance.modelMatrix * vec4<f32>(localPosition, 1.0);
  var output: VertexOutput;
  output.position = rtcTile.viewProjection * rtcWorldPos;
  output.color = instance.color;
${triangleLogDepthVertexWrite(logDepth)}
  return output;
}

${triangleLogDepthFragmentOutputStruct(logDepth, true)}

@fragment
fn fs_main(input: VertexOutput) -> ${triangleLogDepthReturnType(logDepth, true)} {
  let alpha = input.color.a;
  let color = pow(max(input.color.rgb, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
  return ${triangleLogDepthReturn(logDepth, "vec4<f32>(color * alpha, alpha)")};
}
`;
}
