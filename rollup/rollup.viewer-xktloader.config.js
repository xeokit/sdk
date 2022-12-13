import buildBaseConfig from "./rollup.base.config";

const input = process.env.INPUT;

const baseConfig = buildBaseConfig(input, 'viewer-xktloader');

export default {
    ...baseConfig,
}