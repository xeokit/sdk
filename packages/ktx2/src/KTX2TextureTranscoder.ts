import {
    LinearEncoding,
    LinearFilter,
    LinearMipmapLinearFilter,
    RGB_ETC1_Format,
    RGB_ETC2_Format,
    RGB_PVRTC_4BPPV1_Format,
    RGB_S3TC_DXT1_Format,
    RGBA_ASTC_4x4_Format,
    RGBA_BPTC_Format,
    RGBA_ETC2_EAC_Format,
    RGBA_PVRTC_4BPPV1_Format,
    RGBA_S3TC_DXT5_Format,
    RGBAFormat,
    sRGBEncoding
} from "@xeokit/constants";
import {FileLoader, WorkerPool} from "@xeokit/utils";
import type {Capabilities, TextureCompressedParams, TextureTranscoder} from "@xeokit/core";

const KTX2TransferSRGB = 2;
const KTX2_ALPHA_PREMULTIPLIED = 1;

let activeTranscoders = 0;

const BasisFormat = {
    ETC1S: 0,
    UASTC_4x4: 1
};

const TranscoderFormat = {
    ETC1: 0,
    ETC2: 1,
    BC1: 2,
    BC3: 3,
    BC4: 4,
    BC5: 5,
    BC7_M6_OPAQUE_ONLY: 6,
    BC7_M5: 7,
    PVRTC1_4_RGB: 8,
    PVRTC1_4_RGBA: 9,
    ASTC_4x4: 10,
    ATC_RGB: 11,
    ATC_RGBA_INTERPOLATED_ALPHA: 12,
    RGBA32: 13,
    RGB565: 14,
    BGR565: 15,
    RGBA4444: 16
};

const EngineFormat = {
    RGBAFormat: RGBAFormat,
    RGBA_ASTC_4x4_Format: RGBA_ASTC_4x4_Format,
    RGBA_BPTC_Format: RGBA_BPTC_Format,
    RGBA_ETC2_EAC_Format: RGBA_ETC2_EAC_Format,
    RGBA_PVRTC_4BPPV1_Format: RGBA_PVRTC_4BPPV1_Format,
    RGBA_S3TC_DXT5_Format: RGBA_S3TC_DXT5_Format,
    RGB_ETC1_Format: RGB_ETC1_Format,
    RGB_ETC2_Format: RGB_ETC2_Format,
    RGB_PVRTC_4BPPV1_Format: RGB_PVRTC_4BPPV1_Format,
    RGB_S3TC_DXT1_Format: RGB_S3TC_DXT1_Format
};

/**
 * [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) texture decompression strategy.
 *
 * See {@link @xeokit/ktx2} for usage.
 */
export class KTX2TextureTranscoder implements TextureTranscoder {

    #transcoderPath: string;
    #transcoderBinary: any;
    #transcoderPending: null | Promise<void>;
    #workerPool: WorkerPool;
    #workerSourceURL: string;
    #workerConfig: null | { astcSupported: any; etc1Supported: any; pvrtcSupported: any; etc2Supported: any; dxtSupported: any; bptcSupported: any };
    #supportedFileTypes: string[];
    #withCredentials: boolean;

    /**
     * Creates a new KTX2TextureTranscoder.
     *
     * @param {String} [params.transcoderPath="https://cdn.jsdelivr.net/npm/@xeokit/sdk/dist/basis/"] Path to the Basis
     * transcoder module that internally does the heavy lifting for our KTX2TextureTranscoder. If we omit this configuration,
     * then our KTX2TextureTranscoder will load it from ````https://cdn.jsdelivr.net/npm/@xeokit/sdk/dist/basis/```` by
     * default. Therefore, make sure your application is connected to the internet if you wish to use the default transcoder path.
     * @param {Number} [params.workerLimit] The maximum number of Workers to use for transcoding.
     */
    constructor(params: { transcoderPath?: string, workerLimit?: number }) {

        this.#transcoderPath = params.transcoderPath || "https://cdn.jsdelivr.net/npm/@xeokit/sdk/dist/basis/";
        this.#transcoderBinary = null;
        this.#transcoderPending = null;
        this.#workerPool = new WorkerPool();
        this.#workerSourceURL = '';

        if (params.workerLimit) {
            this.#workerPool.setWorkerLimit(params.workerLimit);
        }

        this.#workerConfig = null;
        this.#withCredentials = false;
        this.#supportedFileTypes = ["xgf2"];
    }

    /**
     * Initializes this transcoder.
     *
     * @param capabilities A set of flags indicating the capabilities of this TextureTranscoder.
     */
    init(capabilities: Capabilities) {
        this.#workerConfig = {
            astcSupported: capabilities.astcSupported,
            etc1Supported: capabilities.etc1Supported,
            etc2Supported: capabilities.etc2Supported,
            dxtSupported: capabilities.dxtSupported,
            bptcSupported: capabilities.bptcSupported,
            pvrtcSupported: capabilities.pvrtcSupported
        };
    }

    /**
     * Transcodes texture data from transcoded buffers.
     *
     * @param {ArrayBuffer[]} buffers Transcoded input texture data. Given as an array of buffers so that we can support multi-image textures, such as cube maps.
     * @param {*} config Transcoding options.
     * @returns {Promise<TextureCompressedParams>} Transcoded output texture data.
     */
    transcode(buffers: ArrayBuffer[], config = {}): Promise<TextureCompressedParams> {
        return new Promise<TextureCompressedParams>((resolve, reject) => {
            const taskConfig = config;
            this.#initTranscoder().then(() => {
                return this.#workerPool.postMessage({
                    type: 'transcode',
                    buffers,
                    taskConfig: taskConfig
                }, buffers);
            }).then((e) => {
                // @ts-ignore
                const transcodeResult = e.data;
                const {mipmaps, width, height, format, type, error, dfdTransferFn, dfdFlags} = transcodeResult;
                if (type === 'error') {
                    return reject(error);
                }
                resolve(<TextureCompressedParams>{
                    mipmaps,
                    props: {
                        format,
                        minFilter: mipmaps.length === 1 ? LinearFilter : LinearMipmapLinearFilter,
                        magFilter: mipmaps.length === 1 ? LinearFilter : LinearMipmapLinearFilter,
                        encoding: dfdTransferFn === KTX2TransferSRGB ? sRGBEncoding : LinearEncoding,
                        premultiplyAlpha: !!(dfdFlags & KTX2_ALPHA_PREMULTIPLIED)
                    }
                });
            });
        });
    }

    /**
     * Destroys this KTX2TextureTranscoder
     */
    destroy() {
        URL.revokeObjectURL(this.#workerSourceURL);
        this.#workerPool.destroy();
        activeTranscoders--;
    }

    #initTranscoder() {
        if (!this.#transcoderPending) {
            const jsLoader = new FileLoader();
            jsLoader.setPath(this.#transcoderPath);
            jsLoader.setWithCredentials(this.#withCredentials);
            // @ts-ignore
            const jsContent = jsLoader.loadAsync('basis_transcoder.js');
            const binaryLoader = new FileLoader();
            binaryLoader.setPath(this.#transcoderPath);
            binaryLoader.setResponseType('arraybuffer');
            binaryLoader.setWithCredentials(this.#withCredentials);
            // @ts-ignore
            const binaryContent = binaryLoader.loadAsync('basis_transcoder.wasm');
            this.#transcoderPending = Promise.all([jsContent, binaryContent])
                .then(([jsContent, binaryContent]) => {
                    const fn = BasisWorker.toString();
                    const body = [
                        '/* constants */',
                        'let _EngineFormat = ' + JSON.stringify(EngineFormat),
                        'let _TranscoderFormat = ' + JSON.stringify(TranscoderFormat),
                        'let _BasisFormat = ' + JSON.stringify(BasisFormat),
                        '/* basis_transcoder.js */',
                        jsContent,
                        '/* worker */',
                        fn.substring(fn.indexOf('{') + 1, fn.lastIndexOf('}'))
                    ].join('\n');
                    this.#workerSourceURL = URL.createObjectURL(new Blob([body]));
                    this.#transcoderBinary = binaryContent;
                    this.#workerPool.setWorkerCreator(() => {
                        const worker = new Worker(this.#workerSourceURL);
                        const transcoderBinary = this.#transcoderBinary.slice(0);
                        worker.postMessage({
                            type: 'init',
                            config: this.#workerConfig,
                            transcoderBinary
                        }, [transcoderBinary]);
                        return worker;
                    });
                });
            if (activeTranscoders > 0) {
                console.warn('KTX2TextureTranscoder: Multiple active KTX2TextureTranscoder may cause performance issues.' + ' Use a single KTX2TextureTranscoder instance, or call .dispose() on old instances.');
            }
            activeTranscoders++;
        }
        return this.#transcoderPending;
    }
}


const BasisWorker = function () {

    let config: { [x: string]: any; };
    let transcoderPending: Promise<any>;
    let BasisModule: any;

    // @ts-ignore
    const EngineFormat = _EngineFormat; // eslint-disable-line no-undef
    // @ts-ignore
    const TranscoderFormat = _TranscoderFormat; // eslint-disable-line no-undef
    // @ts-ignore
    const BasisFormat = _BasisFormat; // eslint-disable-line no-undef

    self.addEventListener('message', function (e) {
        const message = e.data;
        switch (message.type) {
            case 'init':
                config = message.config;
                init(message.transcoderBinary);
                break;
            case 'transcode':
                transcoderPending.then(() => {
                    try {
                        const {
                            width,
                            height,
                            hasAlpha,
                            mipmaps,
                            format,
                            dfdTransferFn,
                            dfdFlags
                        } = transcode(message.buffers[0]);
                        const buffers = [];
                        for (let i = 0; i < mipmaps.length; ++i) {
                            buffers.push(mipmaps[i].data.buffer);
                        }
                        self.postMessage({
                            type: 'transcode',
                            id: message.id,
                            width,
                            height,
                            hasAlpha,
                            mipmaps,
                            format,
                            dfdTransferFn,
                            dfdFlags
                            // @ts-ignore
                        }, buffers);
                    } catch (error) {
                        console.error(`[BasisWorker]: ${error}`);
                        // @ts-ignore
                        self.postMessage({type: 'error', id: message.id, error: error.message});
                    }
                });
                break;
        }
    });

    function init(wasmBinary: any) {
        transcoderPending = new Promise(resolve => {
            BasisModule = {
                wasmBinary,
                onRuntimeInitialized: resolve
            };
            // @ts-ignore
            BASIS(BasisModule); // eslint-disable-line no-undef
        }).then(() => {
            BasisModule.initializeBasis();
            if (BasisModule.KTX2File === undefined) {
                console.warn('KTX2TextureTranscoder: Please update Basis Universal transcoder.');
            }
        });
    }

    function transcode(buffer: Iterable<number>) {
        const ktx2File = new BasisModule.KTX2File(new Uint8Array(buffer));

        function cleanup() {
            ktx2File.close();
            ktx2File.delete();
        }

        if (!ktx2File.isValid()) {
            cleanup();
            throw new Error('KTX2TextureTranscoder: Invalid or unsupported .ktx2 file');
        }
        const basisFormat = ktx2File.isUASTC() ? BasisFormat.UASTC_4x4 : BasisFormat.ETC1S;
        const width = ktx2File.getWidth();
        const height = ktx2File.getHeight();
        const levels = ktx2File.getLevels();
        const hasAlpha = ktx2File.getHasAlpha();
        const dfdTransferFn = ktx2File.getDFDTransferFunc();
        const dfdFlags = ktx2File.getDFDFlags();
        const {transcoderFormat, engineFormat} = getTranscoderFormat(basisFormat, width, height, hasAlpha);
        if (!width || !height || !levels) {
            cleanup();
            throw new Error('KTX2TextureTranscoder: Invalid texture');
        }
        if (!ktx2File.startTranscoding()) {
            cleanup();
            throw new Error('KTX2TextureTranscoder: .startTranscoding failed');
        }
        const mipmaps = [];
        for (let mip = 0; mip < levels; mip++) {
            const levelInfo = ktx2File.getImageLevelInfo(mip, 0, 0);
            const mipWidth = levelInfo.origWidth;
            const mipHeight = levelInfo.origHeight;
            const dst = new Uint8Array(ktx2File.getImageTranscodedSizeInBytes(mip, 0, 0, transcoderFormat));
            const status = ktx2File.transcodeImage(dst, mip, 0, 0, transcoderFormat, 0, -1, -1);
            if (!status) {
                cleanup();
                throw new Error('KTX2TextureTranscoder: .transcodeImage failed.');
            }
            mipmaps.push({data: dst, width: mipWidth, height: mipHeight});
        }
        cleanup();
        return {width, height, hasAlpha, mipmaps, format: engineFormat, dfdTransferFn, dfdFlags};
    }

    // Optimal choice of a transcoder target format depends on the Basis format (ETC1S or UASTC),
    // device capabilities, and texture dimensions. The list below ranks the formats separately
    // for ETC1S and UASTC.
    //
    // In some cases, transcoding UASTC to RGBA32 might be preferred for higher quality (at
    // significant memory cost) compared to ETC1/2, BC1/3, and PVRTC. The transcoder currently
    // chooses RGBA32 only as a last resort and does not expose that option to the caller.

    const FORMAT_OPTIONS = [{
        if: 'astcSupported',
        basisFormat: [BasisFormat.UASTC_4x4],
        transcoderFormat: [TranscoderFormat.ASTC_4x4, TranscoderFormat.ASTC_4x4],
        engineFormat: [EngineFormat.RGBA_ASTC_4x4_Format, EngineFormat.RGBA_ASTC_4x4_Format],
        priorityETC1S: Infinity,
        priorityUASTC: 1,
        needsPowerOfTwo: false
    }, {
        if: 'bptcSupported',
        basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
        transcoderFormat: [TranscoderFormat.BC7_M5, TranscoderFormat.BC7_M5],
        engineFormat: [EngineFormat.RGBA_BPTC_Format, EngineFormat.RGBA_BPTC_Format],
        priorityETC1S: 3,
        priorityUASTC: 2,
        needsPowerOfTwo: false
    }, {
        if: 'dxtSupported',
        basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
        transcoderFormat: [TranscoderFormat.BC1, TranscoderFormat.BC3],
        engineFormat: [EngineFormat.RGB_S3TC_DXT1_Format, EngineFormat.RGBA_S3TC_DXT5_Format],
        priorityETC1S: 4,
        priorityUASTC: 5,
        needsPowerOfTwo: false
    }, {
        if: 'etc2Supported',
        basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
        transcoderFormat: [TranscoderFormat.ETC1, TranscoderFormat.ETC2],
        engineFormat: [EngineFormat.RGB_ETC2_Format, EngineFormat.RGBA_ETC2_EAC_Format],
        priorityETC1S: 1,
        priorityUASTC: 3,
        needsPowerOfTwo: false
    }, {
        if: 'etc1Supported',
        basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
        transcoderFormat: [TranscoderFormat.ETC1],
        engineFormat: [EngineFormat.RGB_ETC1_Format],
        priorityETC1S: 2,
        priorityUASTC: 4,
        needsPowerOfTwo: false
    }, {
        if: 'pvrtcSupported',
        basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
        transcoderFormat: [TranscoderFormat.PVRTC1_4_RGB, TranscoderFormat.PVRTC1_4_RGBA],
        engineFormat: [EngineFormat.RGB_PVRTC_4BPPV1_Format, EngineFormat.RGBA_PVRTC_4BPPV1_Format],
        priorityETC1S: 5,
        priorityUASTC: 6,
        needsPowerOfTwo: true
    }];
    const ETC1S_OPTIONS = FORMAT_OPTIONS.sort(function (a, b) {
        return a.priorityETC1S - b.priorityETC1S;
    });
    const UASTC_OPTIONS = FORMAT_OPTIONS.sort(function (a, b) {
        return a.priorityUASTC - b.priorityUASTC;
    });

    function getTranscoderFormat(basisFormat: number, width: number, height: number, hasAlpha: any) {
        let transcoderFormat;
        let engineFormat;
        const options = basisFormat === BasisFormat.ETC1S ? ETC1S_OPTIONS : UASTC_OPTIONS;
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            if (!config[opt.if]) continue;
            if (!opt.basisFormat.includes(basisFormat)) continue;
            if (hasAlpha && opt.transcoderFormat.length < 2) continue;
            if (opt.needsPowerOfTwo && !(isPowerOfTwo(width) && isPowerOfTwo(height))) continue;
            transcoderFormat = opt.transcoderFormat[hasAlpha ? 1 : 0];
            engineFormat = opt.engineFormat[hasAlpha ? 1 : 0];
            return {
                transcoderFormat,
                engineFormat
            };
        }
        console.warn('KTX2TextureTranscoder: No suitable compressed texture format found. Decoding to RGBA32.');
        transcoderFormat = TranscoderFormat.RGBA32;
        engineFormat = EngineFormat.RGBAFormat;
        return {
            transcoderFormat,
            engineFormat
        };
    }

    function isPowerOfTwo(value: number) {
        if (value <= 2) return true;
        return (value & value - 1) === 0 && value !== 0;
    }
};

