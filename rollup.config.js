import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import babel from '@rollup/plugin-babel'
import preserveShebang from 'rollup-plugin-preserve-shebang'

export default [
  { input: 'src/lint-unpushed.ts', output: 'lib/lint-unpushed.js' },
  { input: 'src/lint-unpushed-post-checkout.ts', output: 'lib/lint-unpushed-post-checkout.js' },
].map(({ input, output }) => ({
  input,
  output: {
    file: output,
  },
  external: ['fs', 'path', 'child_process', 'stream', 'util', 'events', 'assert', 'constants', 'readline', 'os'],
  plugins: [
    json(),
    preserveShebang(),
    babel({
      extensions: ['.ts'],
      babelHelpers: 'bundled',
    }),
    resolve({ extensions: ['.js', '.ts'], preferBuiltins: true }),
    commonjs(),
  ],
}))
