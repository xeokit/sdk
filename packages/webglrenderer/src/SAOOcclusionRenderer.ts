import {WebGLArrayBuf, WebGLAttribute, WebGLProgram, WebGLRenderBuffer} from "@xeokit/webglutils";
import {createMat4, createVec2, inverseMat4} from "@xeokit/matrix";
import {RenderContext} from "./RenderContext";
import {PerspectiveProjection, View} from "@xeokit/viewer";
import {PerspectiveProjectionType} from "@xeokit/constants";

const tempVec2 = createVec2();

/**
 * @private
 */
export class SAOOcclusionRenderer {

    #numSamples: number;
    #program: WebGLProgram;
    #programError: boolean;
    #aPosition: WebGLAttribute;
    #aUV: WebGLAttribute;
    #uDepthTexture: string;
    #uCameraNear: WebGLUniformLocation;
    #uCameraFar: WebGLUniformLocation;
    #uCameraProjectionMatrix: WebGLUniformLocation;
    #uCameraInverseProjectionMatrix: WebGLUniformLocation;
    #uScale: WebGLUniformLocation;
    #uIntensity: WebGLUniformLocation;
    #uBias: WebGLUniformLocation;
    #uKernelRadius: WebGLUniformLocation;
    #uMinResolution: WebGLUniformLocation;
    #uRandomSeed: WebGLUniformLocation;
    #uvBuf: WebGLArrayBuf;
    #positionsBuf: WebGLArrayBuf;
    #indicesBuf: WebGLArrayBuf;
    #uPerspective: WebGLUniformLocation;
    #uViewport: WebGLUniformLocation;
    #dirty: boolean;
    #renderContext: RenderContext;

    constructor(params: {
        renderContext: RenderContext
    }) {

        this.#renderContext = params.renderContext;

        this.#numSamples = null;

        // The program

        this.#program = null;
        this.#programError = false;

        // Variable locations

        this.#aPosition = null;
        this.#aUV = null;

        this.#uDepthTexture = "uDepthTexture";

        this.#uCameraNear = null;
        this.#uCameraFar = null;
        this.#uCameraProjectionMatrix = null;
        this.#uCameraInverseProjectionMatrix = null;

        this.#uScale = null;
        this.#uIntensity = null;
        this.#uBias = null;
        this.#uKernelRadius = null;
        this.#uMinResolution = null;
        this.#uRandomSeed = null;

        // VBOs

        this.#uvBuf = null;
        this.#positionsBuf = null;
        this.#indicesBuf = null;
    }

    render(params: {
        depthRenderBuffer: WebGLRenderBuffer
        view: View
    }) {

        this.#build();

        if (this.#programError) {
            return;
        }

        const {depthRenderBuffer, view} = params;

        const gl = this.#renderContext.gl;

        const program = this.#program;
        const sao = view.sao;
        const viewportWidth = gl.drawingBufferWidth;
        const viewportHeight = gl.drawingBufferHeight;
        const projection = view.camera.projectionType === PerspectiveProjectionType
            ? view.camera.perspectiveProjection
            : view.camera.orthoProjection;
        const near = projection.near;
        const far = projection.far;
        const projectionMatrix = projection.projMatrix;
        const inverseProjectionMatrix = projection.inverseProjMatrix;
        const randomSeed = Math.random();
        const perspective = (view.camera.projectionType === PerspectiveProjectionType);

        tempVec2[0] = viewportWidth;
        tempVec2[1] = viewportHeight;

        gl.viewport(0, 0, viewportWidth, viewportHeight);
        gl.clearColor(0, 0, 0, 1);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.frontFace(gl.CCW);
        gl.clear(gl.COLOR_BUFFER_BIT);

        program.bind();

        gl.uniform1f(this.#uCameraNear, near);
        gl.uniform1f(this.#uCameraFar, far);

        gl.uniformMatrix4fv(this.#uCameraProjectionMatrix, false, <Float32Array | GLfloat[]>projectionMatrix);
        gl.uniformMatrix4fv(this.#uCameraInverseProjectionMatrix, false, <Float32Array | GLfloat[]>inverseProjectionMatrix);

        gl.uniform1i(this.#uPerspective, perspective ? 1 : 0);

        gl.uniform1f(this.#uScale, sao.scale * (far / 5));
        gl.uniform1f(this.#uIntensity, sao.intensity);
        gl.uniform1f(this.#uBias, sao.bias);
        gl.uniform1f(this.#uKernelRadius, sao.kernelRadius);
        gl.uniform1f(this.#uMinResolution, sao.minResolution);
        gl.uniform2fv(this.#uViewport, <Float32Array | GLfloat[]>tempVec2);
        gl.uniform1f(this.#uRandomSeed, randomSeed);

        const depthTexture = depthRenderBuffer.getDepthTexture();

        program.bindTexture(this.#uDepthTexture, depthTexture, 0);

        this.#aUV.bindArrayBuffer(this.#uvBuf);
        this.#aPosition.bindArrayBuffer(this.#positionsBuf);
        this.#indicesBuf.bind();

        gl.drawElements(gl.TRIANGLES, this.#indicesBuf.numItems, this.#indicesBuf.itemType, 0);
    }

    #build() {

        let dirty = false;

        const sao = this.#renderContext.view.sao;

        if (sao.numSamples !== this.#numSamples) {
            this.#numSamples = Math.floor(sao.numSamples);
            dirty = true;
        }

        if (!dirty) {
            return;
        }

        const gl = this.#renderContext.gl;

        if (this.#program) {
            this.#program.destroy();
            this.#program = null;
        }

        this.#program = new WebGLProgram(gl, {
            vertex: `#version 300 es
                    precision highp float;
                    precision highp int;

                    in vec3 aPosition;
                    in vec2 aUV;

                    out vec2 vUV;

                    void main () {
                        gl_Position = vec4(aPosition, 1.0);
                        vUV = aUV;
                    }`,

            fragment: `#version 300 es
                precision highp float;
                precision highp int;

                #define NORMAL_TEXTURE 0
                #define PI 3.14159265359
                #define PI2 6.28318530718
                #define EPSILON 1e-6
                #define NUM_SAMPLES ${this.#numSamples}
                #define NUM_RINGS 4

                in vec2        vUV;

                uniform sampler2D   uDepthTexture;

                uniform float       uCameraNear;
                uniform float       uCameraFar;
                uniform mat4        uProjectMatrix;
                uniform mat4        uInverseProjectMatrix;

                uniform bool        uPerspective;

                uniform float       uScale;
                uniform float       uIntensity;
                uniform float       uBias;
                uniform float       uKernelRadius;
                uniform float       uMinResolution;
                uniform vec2        uViewport;
                uniform float       uRandomSeed;

                float pow2( const in float x ) { return x*x; }

                highp float rand( const in vec2 uv ) {
                    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
                    highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
                    return fract(sin(sn) * c);
                }

                vec3 packNormalToRGB( const in vec3 normal ) {
                    return normalize( normal ) * 0.5 + 0.5;
                }

                vec3 unpackRGBToNormal( const in vec3 rgb ) {
                    return 2.0 * rgb.xyz - 1.0;
                }

                const float packUpscale = 256. / 255.;
                const float unpackDownScale = 255. / 256.;

                const vec3 packFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );
                const vec4 unPackFactors = unpackDownScale / vec4( packFactors, 1. );

                const float shiftRights = 1. / 256.;

                vec4 packFloatToRGBA( const in float v ) {
                    vec4 r = vec4( fract( v * packFactors ), v );
                    r.yzw -= r.xyz * shiftRights;
                    return r * packUpscale;
                }

                float unpackRGBAToFloat( const in vec4 v ) {
                    return dot( floor( v * 255.0 + 0.5 ) / 255.0, unPackFactors );
                }

                float perspectiveDepthToViewZ( const in float invClipZ, const in float near, const in float far ) {
                    return ( near * far ) / ( ( far - near ) * invClipZ - far );
                }

                float orthographicDepthToViewZ( const in float linearClipZ, const in float near, const in float far ) {
                    return linearClipZ * ( near - far ) - near;
                }

                float getDepth( const in vec2 screenPosition ) {
                    return vec4(texture(uDepthTexture, screenPosition)).r;
                }

                float getViewZ( const in float depth ) {
                     if (uPerspective) {
                         return perspectiveDepthToViewZ( depth, uCameraNear, uCameraFar );
                     } else {
                        return orthographicDepthToViewZ( depth, uCameraNear, uCameraFar );
                     }
                }

                vec3 getViewPos( const in vec2 screenPos, const in float depth, const in float viewZ ) {
                	float clipW = uProjectMatrix[2][3] * viewZ + uProjectMatrix[3][3];
                	vec4 clipPosition = vec4( ( vec3( screenPos, depth ) - 0.5 ) * 2.0, 1.0 );
                	clipPosition *= clipW;
                	return ( uInverseProjectMatrix * clipPosition ).xyz;
                }

                vec3 getViewNormal( const in vec3 viewPosition, const in vec2 screenPos ) {
                    return normalize( cross( dFdx( viewPosition ), dFdy( viewPosition ) ) );
                }

                float scaleDividedByCameraFar;
                float minResolutionMultipliedByCameraFar;

                float getOcclusion( const in vec3 centerViewPosition, const in vec3 centerViewNormal, const in vec3 sampleViewPosition ) {
                	vec3 viewDelta = sampleViewPosition - centerViewPosition;
                	float viewDistance = length( viewDelta );
                	float scaledScreenDistance = scaleDividedByCameraFar * viewDistance;
                	return max(0.0, (dot(centerViewNormal, viewDelta) - minResolutionMultipliedByCameraFar) / scaledScreenDistance - uBias) / (1.0 + pow2( scaledScreenDistance ) );
                }

                const float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( NUM_SAMPLES );
                const float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );

                float getAmbientOcclusion( const in vec3 centerViewPosition ) {

                	scaleDividedByCameraFar = uScale / uCameraFar;
                	minResolutionMultipliedByCameraFar = uMinResolution * uCameraFar;
                	vec3 centerViewNormal = getViewNormal( centerViewPosition, vUV );

                	float angle = rand( vUV + uRandomSeed ) * PI2;
                	vec2 radius = vec2( uKernelRadius * INV_NUM_SAMPLES ) / uViewport;
                	vec2 radiusStep = radius;

                	float occlusionSum = 0.0;
                	float weightSum = 0.0;

                	for( int i = 0; i < NUM_SAMPLES; i ++ ) {
                		vec2 sampleUv = vUV + vec2( cos( angle ), sin( angle ) ) * radius;
                		radius += radiusStep;
                		angle += ANGLE_STEP;

                		float sampleDepth = getDepth( sampleUv );
                		if( sampleDepth >= ( 1.0 - EPSILON ) ) {
                			continue;
                		}

                		float sampleViewZ = getViewZ( sampleDepth );
                		vec3 sampleViewPosition = getViewPos( sampleUv, sampleDepth, sampleViewZ );
                		occlusionSum += getOcclusion( centerViewPosition, centerViewNormal, sampleViewPosition );
                		weightSum += 1.0;
                	}

                	if( weightSum == 0.0 ) discard;

                	return occlusionSum * ( uIntensity / weightSum );
                }

                out vec4 outColor;

                void main() {

                	float centerDepth = getDepth( vUV );

                	if( centerDepth >= ( 1.0 - EPSILON ) ) {
                		discard;
                	}

                	float centerViewZ = getViewZ( centerDepth );
                	vec3 viewPosition = getViewPos( vUV, centerDepth, centerViewZ );

                	float ambientOcclusion = getAmbientOcclusion( viewPosition );

                	outColor = packFloatToRGBA(  1.0- ambientOcclusion );
                }`
        });

        if (this.#program.errors) {
            console.error(this.#program.errors.join("\n"));
            this.#programError = true;
            return;
        }

        const uv = new Float32Array([1, 1, 0, 1, 0, 0, 1, 0]);
        const positions = new Float32Array([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0]);

        // Mitigation: if Uint8Array is used, the geometry is corrupted on OSX when using Chrome with data-textures
        const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

        this.#positionsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, positions, positions.length, 3, gl.STATIC_DRAW);
        this.#uvBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, uv, uv.length, 2, gl.STATIC_DRAW);
        this.#indicesBuf = new WebGLArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, indices, indices.length, 1, gl.STATIC_DRAW);

        this.#program.bind();

        this.#uCameraNear = this.#program.getLocation("uCameraNear");
        this.#uCameraFar = this.#program.getLocation("uCameraFar");

        this.#uCameraProjectionMatrix = this.#program.getLocation("uProjectMatrix");
        this.#uCameraInverseProjectionMatrix = this.#program.getLocation("uInverseProjectMatrix");

        this.#uPerspective = this.#program.getLocation("uPerspective");

        this.#uScale = this.#program.getLocation("uScale");
        this.#uIntensity = this.#program.getLocation("uIntensity");
        this.#uBias = this.#program.getLocation("uBias");
        this.#uKernelRadius = this.#program.getLocation("uKernelRadius");
        this.#uMinResolution = this.#program.getLocation("uMinResolution");
        this.#uViewport = this.#program.getLocation("uViewport");
        this.#uRandomSeed = this.#program.getLocation("uRandomSeed");

        this.#aPosition = this.#program.getAttribute("aPosition");
        this.#aUV = this.#program.getAttribute("aUV");

        this.#dirty = false;
    }

    destroy() {
        if (this.#program) {
            this.#program.destroy();
            this.#program = null;
        }
    }
}

