import {getGLEnum} from './webglEnums';
import * as utils from '../../../utils';
import * as math from "../../../math/";

const color = new Uint8Array([0, 0, 0, 1]);

function clampImageSize(image: any, numPixels: number): any {
    const n = image.width * image.height;
    if (n > numPixels) {
        const ratio = numPixels / n;
        const width = image.width * ratio;
        const height = image.height * ratio;
        const canvas = document.createElement("canvas");
        canvas.width = nextHighestPowerOfTwo(width);
        canvas.height = nextHighestPowerOfTwo(height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
        image = canvas;
    }
    return image;
}

function ensureImageSizePowerOfTwo(image: any): any {
    if (!isPowerOfTwo(image.width) || !isPowerOfTwo(image.height)) {
        const canvas = document.createElement("canvas");
        canvas.width = nextHighestPowerOfTwo(image.width);
        canvas.height = nextHighestPowerOfTwo(image.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image,
            0, 0, image.width, image.height,
            0, 0, canvas.width, canvas.height);
        image = canvas;
    }
    return image;
}

function isPowerOfTwo(x: number) {
    return (x & (x - 1)) === 0;
}

function nextHighestPowerOfTwo(x: number) {
    --x;
    for (let i = 1; i < 32; i <<= 1) {
        x = x | x >> i;
    }
    return x + 1;
}

export class Texture2D {

    private allocated: Boolean;
    private gl: WebGLRenderingContext;
    private target: GLenum;
    private texture: WebGLTexture;

    constructor(gl: WebGLRenderingContext, target: GLenum) {
        this.gl = gl;
        this.target = target || gl.TEXTURE_2D;
        this.texture = gl.createTexture();
        this.setPreloadColor([0, 0, 0, 0]); // Prevents "there is no texture bound to the unit 0" error
        this.allocated = true;
    }

    setPreloadColor(value: math.FloatArrayType) {
        if (!value) {
            color[0] = 0;
            color[1] = 0;
            color[2] = 0;
            color[3] = 255;
        } else {
            color[0] = Math.floor(value[0] * 255);
            color[1] = Math.floor(value[1] * 255);
            color[2] = Math.floor(value[2] * 255);
            color[3] = Math.floor((value[3] !== undefined ? value[3] : 1) * 255);
        }

        const gl = this.gl;

        gl.bindTexture(this.target, this.texture);
        gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

        if (this.target === gl.TEXTURE_CUBE_MAP) {

            const faces = [
                gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
            ];

            for (let i = 0, len = faces.length; i < len; i++) {
                gl.texImage2D(faces[i], 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, color);
            }

        } else {
            gl.texImage2D(this.target, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, color);
        }

        gl.bindTexture(this.target, null);
    }

    setTarget(target: any) {
        this.target = target || this.gl.TEXTURE_2D;
    }

    setImage(image: (HTMLImageElement | HTMLImageElement[]), props: { flipY?: boolean; }) {
        const gl = this.gl;
        gl.bindTexture(this.target, this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, props.flipY);
        if (this.target === gl.TEXTURE_CUBE_MAP) {
            if (utils.isArray(image)) {
                const faces = [
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                    gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                    gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
                ];
                for (let i = 0, len = faces.length; i < len; i++) {
                    // @ts-ignore
                    gl.texImage2D(faces[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image[i]);
                }
            }
        } else {
            // @ts-ignore
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        }
        gl.bindTexture(this.target, null);
    }

    setProps(props: {
        minFilter?: string;
        magFilter?: string;
        wrapS?: string;
        wrapT?: string;
    }) {
        const gl = this.gl;
        gl.bindTexture(this.target, this.texture);
        if (props.minFilter) {
            const minFilter = getGLEnum(gl, props.minFilter);
            if (minFilter) {
                gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, minFilter);
                if (minFilter === gl.NEAREST_MIPMAP_NEAREST ||
                    minFilter === gl.LINEAR_MIPMAP_NEAREST ||
                    minFilter === gl.NEAREST_MIPMAP_LINEAR ||
                    minFilter === gl.LINEAR_MIPMAP_LINEAR) {
                    gl.generateMipmap(this.target);
                }
            }
        }
        if (props.magFilter) {
            const magFilter = getGLEnum(gl, props.magFilter);
            if (magFilter) {
                gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, magFilter);
            }
        }
        if (props.wrapS) {
            const wrapS = getGLEnum(gl, props.wrapS);
            if (wrapS) {
                gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, wrapS);
            }
        }
        if (props.wrapT) {
            const wrapT = getGLEnum(gl, props.wrapT);
            if (wrapT) {
                gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, wrapT);
            }
        }
        gl.bindTexture(this.target, null);
    }

    bind(unit: number) {
        if (!this.allocated) {
            return;
        }
        if (this.texture) {
            const gl = this.gl;
            // @ts-ignore
            gl.activeTexture(gl["TEXTURE" + unit]);
            gl.bindTexture(this.target, this.texture);
            return true;
        }
        return false;
    }

    unbind(unit: number) {
        if (!this.allocated) {
            return;
        }
        if (this.texture) {
            const gl = this.gl;
            // @ts-ignore
            gl.activeTexture(gl["TEXTURE" + unit]);
            gl.bindTexture(this.target, null);
        }
    }

    destroy() {
        if (!this.allocated) {
            return;
        }
        if (this.texture) {
            this.gl.deleteTexture(this.texture);
            this.texture = null;
        }
    }
}
