import {Data} from "../data";
import {Scene} from "../scene";
import {Loader, Exporter} from "../io";
import {SDKError} from "../core";
import {ModelConverterParams} from "./ModelConverterParams";
import {ModelConverterPipelineParams} from "./ModelConverterPipelineParams";
import {ModelConverterRequest} from "./ModelConverterRequest";
import {ModelConverterResult} from "./ModelConverterResult";
import {ModelConverterConfig} from "./ModelConverterConfig";


/**
 * Transforms 3D model data between different file formats.
 *
 * The `ModelConverter` class manages file format conversions using a set of predefined
 * **loaders** (parsers for input formats) and **exporters** (generators for output formats).
 * It uses **pipelines** to define structured conversion workflows.
 */
export class ModelConverter {

    /**
     * A collection of available loaders, mapped by format identifiers.
     * Each loader is responsible for parsing specific file formats.
     */
    loaders: { [key: string]: Loader };

    /**
     * A collection of available exporters, mapped by format identifiers.
     * Each exporter generates output files in a specific format.
     */
    exporters: { [key: string]: Exporter };

    /**
     * A collection of conversion pipelines, indexed by pipeline name.
     * Each pipeline defines how input data is processed and converted into output formats.
     */
    pipelines: { [key: string]: ModelConverterPipelineParams };

    /**
     * Creates a new ModelConverter instance with the provided configuration.
     *
     * @param params - An object containing configured loaders, exporters, and optional pipelines.
     */
    constructor(params: ModelConverterParams) {
        this.loaders = params.loaders;
        this.exporters = params.exporters;
        this.pipelines = params.pipelines || {};
    }

    /**
     * Transforms 3D model data using a specified conversion pipeline.
     *
     * This method loads the given input file data, constructs scene and data models, and then
     * writes the converted output using the configured exporters.
     *
     * @param convertRequest - The parameters specifying the pipeline and input data.
     * @returns A promise that resolves to a `ModelConverterResult` object containing the output files.
     *
     * @throws {SDKError} If required parameters are missing or if an unsupported pipeline is specified.
     *
     * @example
     * ```ts
     * converter.convert({
     *     pipeline: "gltf2xgf",
     *     inputs: { inputFileData: gltfArraybuffer }
     * }).then(conversionResults => {
     *     const xgfArraybuffer = conversionResults.outputs["xgf"].fileData;
     *     const
     *     console.log("conversion completed:", conversionResults);
     * }).catch(error => {
     *     console.error("conversion failed:", error);
     * });
     * ```
     */
    convert(convertRequest: ModelConverterRequest): Promise<ModelConverterResult> {

        return new Promise((resolve, reject) => {

            if (!convertRequest) {
                return reject(`Argument expected: convertRequest`);
            }

            const pipelineId = convertRequest.pipeline;
            if (!pipelineId) {
                return reject(`Argument expected: pipelineId`);
            }

            const pipeline = this.pipelines[pipelineId];
            if (!pipeline) {
                return reject(`Unsupported pipeline: "${pipelineId}" - supported pipelines are [${Object.keys(this.pipelines || {})}]`);
            }

            const conversionParamsInputs = convertRequest.inputs;
            if (!conversionParamsInputs) {
                return reject(`Argument expected: convertRequest.inputs`);
            }

            const pipelineInputs = pipeline.inputs;
            if (!pipelineInputs) {
                return reject(`No inputs defined on pipeline "${pipelineId}"`);
            }

            const pipelineInputIds = Object.keys(pipelineInputs);
            if (pipelineInputIds.length === 0) {
                return reject(`No inputs defined on pipeline "${pipelineId}"`);
            }

            const pipelineOutputs = pipeline.outputs;
            if (!pipelineOutputs) {
                return reject(`No outputs defined on pipeline "${pipelineId}"`);
            }

            const pipelineOutputIds = Object.keys(pipelineOutputs);
            if (pipelineOutputIds.length === 0) {
                return reject(`No outputs defined on pipeline "${pipelineId}"`);
            }

            for (let inputId in pipelineInputs) {
                const inputParams = pipelineInputs[inputId];
                const loaderId = inputParams.loader;
                if (!loaderId) {
                    return reject(`No loader defined on input "${inputId}" of pipeline "${pipelineId}"`);
                }
                const loader = this.loaders[loaderId];
                if (!loader) {
                    return reject(`Can't resolve loader "${loaderId}", referenced by input "${inputId}" of pipeline "${pipelineId}"`);
                }
            }

            for (let outputId in pipelineOutputs) {
                const outputParams = pipelineOutputs[outputId];
                const exporterId = outputParams.exporter;
                if (!exporterId) {
                    return reject(`No exporter defined on output "${outputId}" of pipeline "${pipelineId}"`);
                }
                const exporter = this.exporters[exporterId];
                if (!exporter) {
                    return reject(`Can't resolve exporter "${exporterId}", referenced by output "${outputId}" of pipeline "${pipelineId}"`);
                }
            }

            const result = {
                pipeline: pipelineId,
                outputs: {}
            };

            const scene = new Scene();
            const data = new Data();

            const processInputs = (done) => {
                const processNextInput = (index = 0) => {
                    if (index >= pipelineInputIds.length) {
                        done();
                        return;
                    }
                    const pipelineInputId = pipelineInputIds[index];
                    const pipelineInput = pipelineInputs[index];
                    const conversionParamsInput = conversionParamsInputs[pipelineInputId];
                    const loader = this.loaders[pipelineInput.loader];
                    const fileData = conversionParamsInput;
                    const sceneModelId = pipelineInput.sceneModel || "default";
                    const sceneModel = scene.models[sceneModelId] || scene.createModel({
                        id: sceneModelId
                    });
                    const dataModelId = pipelineInput.dataModel || "default";
                    const dataModel = data.models[dataModelId] || data.createModel({
                        id: dataModelId
                    });
                    if (sceneModel instanceof SDKError || dataModel instanceof SDKError) {
                        processNextInput(index + 1);
                    } else {
                        loader.load({
                            fileData,
                            sceneModel,
                            dataModel
                        }).then(() => {
                            processNextInput(index + 1);
                        });
                    }
                }
                processNextInput(0);
            }

            const buildSceneModels = (done) => {
                const sceneModelIds = Object.keys(scene.models);
                const buildNextSceneModel = (index = 0) => {
                    if (index >= sceneModelIds.length) {
                        done();
                        return;
                    }
                    const sceneModelId = sceneModelIds[index];
                    const sceneModel = scene.models[sceneModelId];
                    sceneModel.build().then(() => {
                        buildNextSceneModel(index + 1);
                    }).catch(errMsg => {
                        // reject(`Failed to build SceneModel "${sceneModelId}": ${errMsg}`);
                        done();
                    });
                }
                buildNextSceneModel(0);
            }

            const buildDataModels = (done) => {
                const dataModelIds = Object.keys(data.models);
                const buildNextDataModel = (index = 0) => {
                    if (index >= dataModelIds.length) {
                        done();
                        return;
                    }
                    const dataModelId = dataModelIds[index];
                    const dataModel = data.models[dataModelId];
                    dataModel.build().then(() => {
                        buildNextDataModel(index + 1);
                    }).catch(errMsg => {
                        //   return reject(`Failed to build DataModel "${dataModelId}": ${errMsg}`);
                        done();
                    });
                }
                buildNextDataModel(0);
            }

            const processOutputs = (done) => {
                const processNextOutput = (index) => {
                    if (index >= pipelineOutputIds.length) {
                        done();
                        return;
                    }
                    const pipelineOutputId = pipelineOutputIds[index];
                    const pipelineOutput = pipelineOutputs[index];
                    const exporter = this.exporters[pipelineOutput.exporter];
                    const version = pipelineOutput.version;
                    const sceneModelId = pipelineOutput.sceneModel || "default";
                    const sceneModel = scene.models[sceneModelId] || scene.createModel({
                        id: sceneModelId
                    });
                    const dataModelId = pipelineOutput.dataModel || "default";
                    const dataModel = data.models[dataModelId] || data.createModel({
                        id: dataModelId
                    });
                    if (sceneModel instanceof SDKError || dataModel instanceof SDKError) {
                        processNextOutput(index + 1);
                    } else {
                        exporter.write({
                            sceneModel,
                            dataModel
                        }).then(fileData => {
                            result.outputs[pipelineOutputId] = {
                                fileData,
                                fileDataType: exporter.fileDataType,
                                version,
                                sceneModel,
                                dataModel
                            };
                            processNextOutput(index + 1);
                        });
                    }
                }
                processNextOutput(0);
            }

            processInputs(() => {
                buildSceneModels(() => {
                    buildDataModels(() => {
                        processOutputs(() => {
                            return resolve(result);
                        });
                    });
                });
            });
        });
    }

    /**
     * Clears all pipeline configurations within this ModelConverter instance.
     *
     * After calling this method, the converter will not have any conversion pipelines configured.
     * You will need to call `setConfigs` to add new pipelines before calling `convert`.
     */
    clearConfigs() {
        this.pipelines = {};
    }

    /**
     * Configures conversion pipelines for this ModelConverter instance.
     *
     * This method allows updating or adding new conversion pipelines dynamically.
     *
     * @param params - An object containing new pipeline configurations.
     * @returns An `SDKError` if configuration validation fails, otherwise `void`.
     */
    setConfigs(params: ModelConverterConfig): SDKError | void {
        for (let pipelineId in params.pipelines) {
            const pipeline = params.pipelines[pipelineId];
            const pipelineInputs = pipeline.inputs;
            if (!pipelineInputs) {
                return new SDKError(`No inputs defined on pipeline "${pipelineId}"`);
            }
            const pipelineInputIds = Object.keys(pipelineInputs);
            if (pipelineInputIds.length === 0) {
                return new SDKError(`No inputs defined on pipeline "${pipelineId}"`);
            }
            const pipelineOutputs = pipeline.outputs;
            if (!pipelineOutputs) {
                return new SDKError(`No outputs defined on pipeline "${pipelineId}"`);
            }
            const pipelineOutputIds = Object.keys(pipelineOutputs);
            if (pipelineOutputIds.length === 0) {
                return new SDKError(`No outputs defined on pipeline "${pipelineId}"`);
            }
            for (let inputId in pipelineInputs) {
                const inputParams = pipelineInputs[inputId];
                const loaderId = inputParams.loader;
                if (!loaderId) {
                    return new SDKError(`No loader defined on input "${inputId}" of pipeline "${pipelineId}"`);
                }
                const loader = this.loaders[loaderId];
                if (!loader) {
                    return new SDKError(`Can't resolve loader "${loaderId}" on input "${inputId}" of pipeline "${pipelineId}"`);
                }
            }
            for (let outputId in pipelineOutputs) {
                const outputParams = pipelineOutputs[outputId];
                const exporterId = outputParams.exporter;
                if (!exporterId) {
                    return new SDKError(`No exporter defined on output "${outputId}" of pipeline "${pipelineId}"`);
                }
                const exporter = this.exporters[exporterId];
                if (!exporter) {
                    return new SDKError(`Can't resolve exporter "${exporterId}" on output "${outputId}" of pipeline "${pipelineId}"`);
                }
            }
        }
        for (let pipelineId in params.pipelines) {
            this.pipelines[pipelineId] = params.pipelines[pipelineId];
        }
    }
}
