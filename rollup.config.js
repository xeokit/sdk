import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';

const packageJson = require('./package.json');

const globals = {
    ...packageJson.devDependencies,
};

export default {
    input: 'src/index.ts',
    output: [
        {
            file: packageJson.module,
            format: 'esm', // ES Modules
            sourcemap: true,
        },
    ],
    plugins: [
        peerDepsExternal(),
        resolve(),
        commonjs(),
        typescript({
            useTsconfigDeclarationDir: true,
            tsconfigOverride: {
                exclude: ['**/*.stories.*'],
            },
        }),
        commonjs({
            exclude: 'node_modules',
            ignoreGlobal: true,
        }),
    ],
    external: Object.keys(globals),
};
