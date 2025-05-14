const nodeResolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const dts = require('rollup-plugin-dts');

module.exports = [
  {
    input: './gen/index.js',
    output: [
      { file: './lib/index.js', format: 'cjs' },
      { file: './lib/index.mjs', format: 'es' },
    ],
    external: ['glob'],
    plugins: [nodeResolve(), commonjs()],
  },
  {
    input: './gen/bin/index.js',
    output: {
      file: './lib/toofast.js',
      format: 'cjs',
      banner: '#!/usr/bin/env node',
    },
    external: ['glob'],
    plugins: [nodeResolve(), commonjs()],
  },
  {
    input: './gen/index.d.ts',
    output: { file: './lib/index.d.ts', format: 'es' },
    plugins: [dts.default()],
  },
];
