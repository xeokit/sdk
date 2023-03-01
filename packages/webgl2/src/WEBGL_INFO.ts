/**
 * Information about WebGL2 support on the client machine.
 */
const WEBGL_INFO: {
    [key: string]: any
} = {
    WEBGL: false,
    SUPPORTED_EXTENSIONS: {}
};

const canvas = document.createElement("canvas");

if (canvas) {

    // @ts-ignore
    const gl: WebGL2RenderingContext = canvas.getContext("webgl2", {antialias: true});

    WEBGL_INFO.WEBGL = !!gl;

    if (WEBGL_INFO.WEBGL) {
        // @ts-ignore
        WEBGL_INFO.ANTIALIAS = gl.getContextAttributes().antialias;
        if (gl.getShaderPrecisionFormat) {
            // @ts-ignore
            if (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0) {
                WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "highp";
            } else { // @ts-ignore
                if (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT).precision > 0) {
                                WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "mediump";
                            } else {
                                WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "lowp";
                            }
            }
        } else {
            WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "mediump";
        }
        WEBGL_INFO.DEPTH_BUFFER_BITS = gl.getParameter(gl.DEPTH_BITS);
        WEBGL_INFO.MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        WEBGL_INFO.MAX_CUBE_MAP_SIZE = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
        WEBGL_INFO.MAX_RENDERBUFFER_SIZE = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        WEBGL_INFO.MAX_TEXTURE_UNITS = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
        WEBGL_INFO.MAX_TEXTURE_IMAGE_UNITS = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        WEBGL_INFO.MAX_VERTEX_ATTRIBS = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
        WEBGL_INFO.MAX_VERTEX_UNIFORM_VECTORS = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
        WEBGL_INFO.MAX_FRAGMENT_UNIFORM_VECTORS = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
        WEBGL_INFO.MAX_VARYING_VECTORS = gl.getParameter(gl.MAX_VARYING_VECTORS);
        // @ts-ignore
        gl.getSupportedExtensions().forEach(function (ext: any) {
            WEBGL_INFO.SUPPORTED_EXTENSIONS[ext] = true;
        });
        WEBGL_INFO.depthTexturesSupported = WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"];
    }
}

export {WEBGL_INFO};