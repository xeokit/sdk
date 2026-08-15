import {TRIANGLE_POSITION_DECODE_WGSL, TRIANGLE_RTC_TILE_WGSL} from "./TrianglePositionPacking";
import {
  triangleLogDepthFragmentOutputStruct,
  triangleLogDepthReturn,
  triangleLogDepthReturnType,
  triangleLogDepthVertexField,
  triangleLogDepthVertexWrite
} from "./TriangleLogDepth";

/**
 * WGSL shader for WebGPU triangle edge color rendering.
 *
 * @internal
 */
export function createTrianglesDrawEdgeColorShader(logDepth = false): string {
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
  @location(1) worldPos: vec3<f32>,
  @location(2) clippable: f32,
${triangleLogDepthVertexField(logDepth, 3)}
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let instance = instances[input.vertexMetadata.x];
  let rtcTile = getInstanceRTCTile(instance);
  let localPosition = decodePackedPosition(input.packedPosition, input.vertexMetadata.y);
  let rtcWorldPos = instance.modelMatrix * vec4<f32>(localPosition, 1.0);
  var output: VertexOutput;
  output.position = rtcTile.viewProjection * rtcWorldPos;
  output.color = vec4<f32>(instance.color.rgb * 0.25, instance.color.a);
  output.worldPos = (rtcWorldPos.xyz / rtcWorldPos.w) + rtcTile.center.xyz;
  output.clippable = instance.flags.x;
${triangleLogDepthVertexWrite(logDepth)}
  return output;
}

${triangleLogDepthFragmentOutputStruct(logDepth, true)}

@fragment
fn fs_main(input: VertexOutput) -> ${triangleLogDepthReturnType(logDepth, true)} {
  if (input.clippable > 0.5) {
    for (var i = 0u; i < 8u; i = i + 1u) {
      if (i >= u32(frame.sectionPlaneState.x)) {
        break;
      }
      let plane = frame.sectionPlanes[i];
      if (dot(plane.xyz, input.worldPos) + plane.w > 0.0) {
        discard;
      }
    }
  }
  return ${triangleLogDepthReturn(logDepth, "input.color")};
}
`;
}

/**
 * @internal
 */
export const TRIANGLES_DRAW_EDGE_COLOR_SHADER = createTrianglesDrawEdgeColorShader(false);
